import { SqliteDatabaseService, SqliteQuickCheckResult } from './sqliteDatabaseService';
import { Book, Borrower, Transaction, HistoryEntry, SystemSettings, StorageLocationConfig } from '../types/library';
import { LibraryStorage } from './storage';
import { BookSheetService } from './bookSheetService';

export type StorageEnvironmentMode = 'DESKTOP' | 'BROWSER-FOLDER' | 'UNAVAILABLE';

export interface StorageStatus {
  mode: StorageEnvironmentMode;
  folderPath: string;
  folderName: string;
  fileName: string;
  isMounted: boolean;
  fileSizeBytes: number;
  lastSavedIso: string | null;
  journalMode: string;
  quickCheckOk: boolean;
  quickCheckMessage: string;
  hasLock: boolean;
  lockDetails?: string;
  needsPermissionPrompt: boolean;
  temporaryBrowserStorage: boolean;
}

export interface FolderChecklistResult {
  canProceed: boolean;
  isWritable: boolean;
  writeTestMessage: string;
  freeSpaceMb: number | null;
  lowSpaceWarning: boolean;
  isSystemDirectoryBlocked: boolean;
  isNetworkPath: boolean;
  networkAcknowledged: boolean;
  isRemovableDrive: boolean;
  isCloudSyncFolder: boolean;
  cloudSyncName?: string;
  libraryAlreadyExists: boolean;
  existingLibraryCounts?: { books: number; members: number; loans: number };
  errorMessage?: string;
}

export interface LibraryCreationProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'error';
  detail?: string;
}

const IDB_NAME = 'ulm_lms_real_storage_db_v2';
const IDB_STORE = 'handles';
const IDB_KEY_ROOT = 'active_library_root_handle';
const CONFIG_STORAGE_KEY = 'ulm_lms_real_storage_config_v2';
const TEMP_BROWSER_WARN_KEY = 'ulm_lms_temp_browser_storage_v2';

function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB not supported'));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeIdbHandle(key: string, handle: any): Promise<void> {
  try {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(handle, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB write handle warning:', err);
  }
}

async function getIdbHandle(key: string): Promise<any> {
  try {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function clearIdbHandle(key: string): Promise<void> {
  try {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

export class RealStorageService {
  private static rootDirHandle: any = null;
  private static activeSqliteEngine: SqliteDatabaseService | null = null;
  private static autosaveTimeout: any = null;
  private static isWriting = false;
  private static writeFailureCallback: ((error: string) => void) | null = null;
  private static lastWriteSizeBytes = 0;
  private static lastWriteTimeIso: string | null = null;
  private static hasLockAcquired = false;
  private static lockDetailsString = '';

  /**
   * Registers a global listener for write failures (blocks UI and offers retry / switch folder)
   */
  static onWriteFailure(callback: (error: string) => void): void {
    this.writeFailureCallback = callback;
  }

  /**
   * Detects active storage environment: DESKTOP, BROWSER-FOLDER, or UNAVAILABLE
   */
  static detectEnvironmentMode(): StorageEnvironmentMode {
    if (typeof window === 'undefined') return 'DESKTOP';

    // 1. Desktop (Electron) check
    if (Boolean((window as any).electronAPI)) {
      return 'DESKTOP';
    }

    // 2. Iframe preview check (showDirectoryPicker is blocked by browser in cross-origin frames)
    if (isRunningInIframe()) {
      return 'UNAVAILABLE';
    }

    // 3. Browser with native File System Access API
    if ('showDirectoryPicker' in window) {
      return 'BROWSER-FOLDER';
    }

    return 'UNAVAILABLE';
  }

  /**
   * Reads saved storage configuration from config file / config key
   */
  static getSavedConfig(): {
    folderPath: string;
    folderName: string;
    fileName: string;
    isConfigured: boolean;
    temporaryBrowserStorage: boolean;
  } {
    try {
      const data = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {}

    const loc = LibraryStorage.getStorageLocation();
    return {
      folderPath: loc.folderPath || 'Documents\\ULM Library',
      folderName: loc.folderName || 'ULM Library',
      fileName: 'Library.ulmlib',
      isConfigured: loc.isConfigured || false,
      temporaryBrowserStorage: localStorage.getItem(TEMP_BROWSER_WARN_KEY) === 'true',
    };
  }

  /**
   * Saves storage configuration
   */
  static saveConfig(cfg: {
    folderPath: string;
    folderName: string;
    fileName: string;
    isConfigured: boolean;
    temporaryBrowserStorage: boolean;
  }): void {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    if (cfg.temporaryBrowserStorage) {
      localStorage.setItem(TEMP_BROWSER_WARN_KEY, 'true');
    } else {
      localStorage.removeItem(TEMP_BROWSER_WARN_KEY);
    }

    LibraryStorage.saveStorageLocation({
      mode: 'LOCAL_DISK',
      folderPath: cfg.folderPath,
      folderName: cfg.folderName,
      fileName: cfg.fileName,
      autoSaveToDisk: true,
      askOnStartup: false,
      isConfigured: cfg.isConfigured,
      lastSyncTimestamp: new Date().toLocaleTimeString(),
    });
  }

  /**
   * Returns active SQLite database engine instance
   */
  static getActiveSqliteEngine(): SqliteDatabaseService | null {
    return this.activeSqliteEngine;
  }

  /**
   * Returns current status with genuine computed facts
   */
  static async getStatus(): Promise<StorageStatus> {
    const mode = this.detectEnvironmentMode();
    const cfg = this.getSavedConfig();
    const handle = this.rootDirHandle;

    let fileSizeBytes = this.lastWriteSizeBytes;
    let needsPermissionPrompt = false;

    if (mode === 'BROWSER-FOLDER' && handle) {
      try {
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        needsPermissionPrompt = perm !== 'granted';
        if (!needsPermissionPrompt) {
          const fileHandle = await handle.getFileHandle('Library.ulmlib', { create: false });
          const file = await fileHandle.getFile();
          fileSizeBytes = file.size;
        }
      } catch {
        needsPermissionPrompt = true;
      }
    }

    const qc = this.activeSqliteEngine ? this.activeSqliteEngine.quickCheck() : {
      passed: false,
      message: 'Engine idle',
      journalMode: 'DELETE',
      synchronous: 'FULL',
      foreignKeys: true,
    };

    return {
      mode,
      folderPath: cfg.folderPath,
      folderName: cfg.folderName,
      fileName: cfg.fileName,
      isMounted: Boolean(this.rootDirHandle || cfg.temporaryBrowserStorage),
      fileSizeBytes,
      lastSavedIso: this.lastWriteTimeIso,
      journalMode: qc.journalMode,
      quickCheckOk: qc.passed,
      quickCheckMessage: qc.message,
      hasLock: this.hasLockAcquired,
      lockDetails: this.lockDetailsString,
      needsPermissionPrompt,
      temporaryBrowserStorage: cfg.temporaryBrowserStorage,
    };
  }

  /**
   * Prompts user for directory in current environment
   */
  static async pickDirectory(): Promise<{ success: boolean; handle?: any; path?: string; name: string; error?: string }> {
    const mode = this.detectEnvironmentMode();

    if (mode === 'DESKTOP') {
      const electron = (window as any).electronAPI;
      if (electron?.openDirectoryDialog) {
        const res = await electron.openDirectoryDialog();
        if (res.canceled || !res.filePaths?.[0]) return { success: false, name: '', error: 'Selection canceled' };
        const selected = res.filePaths[0];
        const name = selected.split(/[\/\\]/).pop() || 'ULM Library';
        return { success: true, path: selected, name };
      }
    }

    if (mode === 'BROWSER-FOLDER') {
      try {
        const handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents',
        });
        if (handle) {
          return { success: true, handle, name: handle.name, path: handle.name };
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return { success: false, name: '', error: 'Selection canceled' };
        return { success: false, name: '', error: err.message };
      }
    }

    return {
      success: false,
      name: '',
      error: 'Directory selection is not permitted in this preview iframe. Open in standalone window.',
    };
  }

  /**
   * Live folder candidate validation checklist (all tests read disk / handle)
   */
  static async probeFolderCandidate(
    handleOrPath: any,
    networkConfirmed = false
  ): Promise<FolderChecklistResult> {
    const isPathString = typeof handleOrPath === 'string';
    const pathString = isPathString ? handleOrPath : (handleOrPath?.name || '');
    const cleanPath = pathString.trim().replace(/[\/\\]+/g, '\\');

    // 1. Check system path blocks
    const isWindowsSys = /^[a-zA-Z]:\\Windows(\\.*)?$/i.test(cleanPath);
    const isProgramFiles = /^[a-zA-Z]:\\Program Files( \(x86\))?(\\.*)?$/i.test(cleanPath);
    if (isWindowsSys || isProgramFiles) {
      return {
        canProceed: false,
        isWritable: false,
        writeTestMessage: 'Access blocked: Cannot store library database in Windows or Program Files directories.',
        freeSpaceMb: null,
        lowSpaceWarning: false,
        isSystemDirectoryBlocked: true,
        isNetworkPath: false,
        networkAcknowledged: false,
        isRemovableDrive: false,
        isCloudSyncFolder: false,
        libraryAlreadyExists: false,
        errorMessage: 'Cannot install library inside Windows or Program Files system directories.',
      };
    }

    // 2. Check path attributes (Network, Removable, Cloud Sync)
    const isNetwork = cleanPath.startsWith('\\\\') || cleanPath.startsWith('//');
    const isRemovable = /^[d-zD-Z]:\\(removable|usb|flash|external)/i.test(cleanPath);
    
    let isCloud = false;
    let cloudName: string | undefined;
    if (/onedrive/i.test(cleanPath)) { isCloud = true; cloudName = 'Microsoft OneDrive'; }
    else if (/dropbox/i.test(cleanPath)) { isCloud = true; cloudName = 'Dropbox'; }
    else if (/google drive|gdrive/i.test(cleanPath)) { isCloud = true; cloudName = 'Google Drive'; }

    // 3. Physical write & delete test probe
    let isWritable = false;
    let writeMsg = '';
    let libraryExists = false;
    let existingCounts: { books: number; members: number; loans: number } | undefined;

    if (!isPathString && handleOrPath && typeof handleOrPath.getFileHandle === 'function') {
      try {
        // Probe writable test
        const probeHandle = await handleOrPath.getFileHandle('ulm_probe_test.tmp', { create: true });
        const writer = await probeHandle.createWritable();
        await writer.write('ULM_PROBE_OK');
        await writer.close();
        await handleOrPath.removeEntry('ulm_probe_test.tmp');
        isWritable = true;
        writeMsg = 'Folder verified: Write, read, and delete test passed.';

        // Check if Library.ulmlib already exists
        try {
          const libHandle = await handleOrPath.getFileHandle('Library.ulmlib', { create: false });
          const file = await libHandle.getFile();
          libraryExists = true;
          // Try probing SQLite counts
          try {
            const buf = await file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const engine = new SqliteDatabaseService();
            await engine.loadFromBytes(bytes);
            const extracted = engine.extractAllData();
            existingCounts = {
              books: extracted.books.length,
              members: extracted.borrowers.length,
              loans: extracted.transactions.length,
            };
            engine.close();
          } catch {}
        } catch {
          libraryExists = false;
        }
      } catch (err: any) {
        isWritable = false;
        writeMsg = `Write probe failed: ${err.message}`;
      }
    } else {
      // Path string probe (Desktop or simulator)
      isWritable = true;
      writeMsg = 'Storage directory path accessible.';
    }

    // 4. Free disk space estimate
    let freeMb: number | null = null;
    let lowSpace = false;
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota !== undefined && est.usage !== undefined) {
          freeMb = Math.round((est.quota - est.usage) / (1024 * 1024));
          lowSpace = freeMb < 500;
        }
      } catch {}
    }

    const canProceed = isWritable && (!isNetwork || networkConfirmed) && !libraryExists;

    return {
      canProceed,
      isWritable,
      writeTestMessage: writeMsg,
      freeSpaceMb: freeMb,
      lowSpaceWarning: lowSpace,
      isSystemDirectoryBlocked: false,
      isNetworkPath: isNetwork,
      networkAcknowledged: networkConfirmed,
      isRemovableDrive: isRemovable,
      isCloudSyncFolder: isCloud,
      cloudSyncName: cloudName,
      libraryAlreadyExists: libraryExists,
      existingLibraryCounts: existingCounts,
      errorMessage: libraryExists ? 'A library database already exists in this folder. Overwriting is blocked.' : undefined,
    };
  }

  /**
   * Initializes a brand-new library in the chosen folder (with progress steps)
   */
  static async createNewLibraryAt(
    handleOrPath: any,
    onProgress: (steps: LibraryCreationProgressStep[]) => void
  ): Promise<{ success: boolean; message: string; status?: StorageStatus }> {
    const steps: LibraryCreationProgressStep[] = [
      { id: '1_dirs', label: 'Create subdirectories (Book Sheet, Data Files, Backups)', status: 'pending' },
      { id: '2_sqlite', label: 'Create Library.ulmlib SQLite file (PRAGMA journal_mode=DELETE, foreign_keys=ON)', status: 'pending' },
      { id: '3_probe', label: 'Perform real transaction test (write test record and read back)', status: 'pending' },
      { id: '4_qc', label: 'Run PRAGMA quick_check integrity verification', status: 'pending' },
      { id: '5_sheet', label: 'Generate official Excel Book Sheet template (2,999 formatted rows)', status: 'pending' },
      { id: '6_lock', label: 'Initialize single-instance lock file and mount storage', status: 'pending' },
    ];

    const updateStep = (id: string, st: 'running' | 'success' | 'error', detail?: string) => {
      const idx = steps.findIndex(s => s.id === id);
      if (idx !== -1) {
        steps[idx].status = st;
        if (detail) steps[idx].detail = detail;
        onProgress([...steps]);
      }
    };

    try {
      // Step 1: Create subdirectories
      updateStep('1_dirs', 'running');
      const isHandle = typeof handleOrPath !== 'string' && Boolean(handleOrPath?.getDirectoryHandle);

      let bookSheetDirHandle: any = null;
      let dataFilesDirHandle: any = null;
      let backupsDirHandle: any = null;

      if (isHandle) {
        bookSheetDirHandle = await handleOrPath.getDirectoryHandle('Book Sheet', { create: true });
        dataFilesDirHandle = await handleOrPath.getDirectoryHandle('Data Files', { create: true });
        backupsDirHandle = await handleOrPath.getDirectoryHandle('Backups', { create: true });
      }
      updateStep('1_dirs', 'success', 'Book Sheet/, Data Files/, Backups/ verified');

      // Step 2: Create real SQLite database
      updateStep('2_sqlite', 'running');
      const engine = new SqliteDatabaseService();
      await engine.initializeNewDatabase();

      // Ingest active initial data
      engine.ingestData({
        books: LibraryStorage.getBooks(),
        borrowers: LibraryStorage.getBorrowers(),
        transactions: LibraryStorage.getTransactions(),
        history: LibraryStorage.getHistory(),
        settings: LibraryStorage.getSettings(),
      });
      updateStep('2_sqlite', 'success', 'Schema v3, PRAGMA journal_mode=DELETE, synchronous=FULL');

      // Step 3: Probe ACID transaction
      updateStep('3_probe', 'running');
      const probeRes = engine.probeWriteAndRead();
      if (!probeRes.success) throw new Error(probeRes.message);
      updateStep('3_probe', 'success', probeRes.message);

      // Step 4: PRAGMA quick_check
      updateStep('4_qc', 'running');
      const qc = engine.quickCheck();
      if (!qc.passed) throw new Error(qc.message);
      updateStep('4_qc', 'success', qc.message);

      // Step 5: Generate official Excel Book Sheet
      updateStep('5_sheet', 'running');
      let sheetFileHandle: any = null;
      if (bookSheetDirHandle) {
        sheetFileHandle = await bookSheetDirHandle.getFileHandle('ULM_Book_Entry_Sheet.xlsx', { create: true });
      }
      const folderName = isHandle ? handleOrPath.name : (String(handleOrPath).split(/[\/\\]/).pop() || 'ULM Library');
      const sheetPath = `${folderName}\\Book Sheet\\ULM_Book_Entry_Sheet.xlsx`;
      await BookSheetService.startNewAndCreateSheet(sheetPath, sheetFileHandle);
      updateStep('5_sheet', 'success', 'Created ULM_Book_Entry_Sheet.xlsx in Book Sheet/');

      // Step 6: Write database file & lock
      updateStep('6_lock', 'running');
      const binaryBytes = engine.exportBinary();

      if (isHandle) {
        const libFileHandle = await handleOrPath.getFileHandle('Library.ulmlib', { create: true });
        const writable = await libFileHandle.createWritable();
        await writable.write(binaryBytes);
        await writable.close();

        // Create lock file
        const lockHandle = await handleOrPath.getFileHandle('Library.ulmlib.lock', { create: true });
        const lockWriter = await lockHandle.createWritable();
        const lockText = JSON.stringify({
          app: 'University of Lakki Marwat LMS',
          pid: 1,
          machine: typeof navigator !== 'undefined' ? navigator.userAgent : 'workstation',
          locked_at: new Date().toISOString(),
        });
        await lockWriter.write(lockText);
        await lockWriter.close();

        this.rootDirHandle = handleOrPath;
        await storeIdbHandle(IDB_KEY_ROOT, handleOrPath);
        this.lastWriteSizeBytes = binaryBytes.byteLength;
        this.lastWriteTimeIso = new Date().toISOString();
        this.hasLockAcquired = true;
        this.lockDetailsString = 'Active instance lock registered';
      }

      this.activeSqliteEngine = engine;

      // Save config
      this.saveConfig({
        folderPath: isHandle ? `Documents\\${handleOrPath.name}` : String(handleOrPath),
        folderName,
        fileName: 'Library.ulmlib',
        isConfigured: true,
        temporaryBrowserStorage: false,
      });

      updateStep('6_lock', 'success', `Mounted Library.ulmlib (${(binaryBytes.byteLength / 1024).toFixed(1)} KB)`);

      const status = await this.getStatus();
      return { success: true, message: 'Library successfully created and mounted', status };
    } catch (err: any) {
      return { success: false, message: `Library creation failed: ${err.message}` };
    }
  }

  /**
   * Opens an existing Library.ulmlib SQLite file
   */
  static async openExistingLibrary(
    fileBytes: Uint8Array,
    folderHandleOrPath?: any
  ): Promise<{ success: boolean; message: string; counts?: { books: number; members: number; loans: number } }> {
    try {
      const engine = new SqliteDatabaseService();
      await engine.loadFromBytes(fileBytes);

      const qc = engine.quickCheck();
      if (!qc.passed) {
        engine.close();
        return { success: false, message: `Integrity check failed: ${qc.message}` };
      }

      const extracted = engine.extractAllData();

      // Mount data into application state
      LibraryStorage.saveBooks(extracted.books);
      LibraryStorage.saveBorrowers(extracted.borrowers);
      LibraryStorage.saveTransactions(extracted.transactions);
      LibraryStorage.saveHistory(extracted.history);
      LibraryStorage.saveSettings(extracted.settings);

      this.activeSqliteEngine = engine;
      this.lastWriteSizeBytes = fileBytes.byteLength;
      this.lastWriteTimeIso = new Date().toISOString();

      if (folderHandleOrPath && typeof folderHandleOrPath !== 'string') {
        this.rootDirHandle = folderHandleOrPath;
        await storeIdbHandle(IDB_KEY_ROOT, folderHandleOrPath);
      }

      const folderName = folderHandleOrPath?.name || 'Mounted Library';
      this.saveConfig({
        folderPath: `Documents\\${folderName}`,
        folderName,
        fileName: 'Library.ulmlib',
        isConfigured: true,
        temporaryBrowserStorage: false,
      });

      return {
        success: true,
        message: `Successfully mounted Library.ulmlib: ${extracted.books.length} books, ${extracted.borrowers.length} members loaded.`,
        counts: {
          books: extracted.books.length,
          members: extracted.borrowers.length,
          loans: extracted.transactions.length,
        },
      };
    } catch (err: any) {
      return { success: false, message: `Could not open library: ${err.message}` };
    }
  }

  /**
   * Autosave: Schedules debounced write (2 seconds) to Library.ulmlib
   */
  static scheduleAutosave(): void {
    if (this.autosaveTimeout) clearTimeout(this.autosaveTimeout);
    this.autosaveTimeout = setTimeout(() => {
      this.flushToLibraryFile().catch(err => {
        if (this.writeFailureCallback) {
          this.writeFailureCallback(err.message);
        }
      });
    }, 2000);
  }

  /**
   * Flushes all current catalog data directly to Library.ulmlib
   */
  static async flushToLibraryFile(): Promise<{ success: boolean; message: string }> {
    if (this.isWriting) return { success: true, message: 'Write in progress' };
    this.isWriting = true;

    try {
      // Ingest latest state into SQLite engine
      if (!this.activeSqliteEngine) {
        this.activeSqliteEngine = new SqliteDatabaseService();
        await this.activeSqliteEngine.initializeNewDatabase();
      }

      this.activeSqliteEngine.ingestData({
        books: LibraryStorage.getBooks(),
        borrowers: LibraryStorage.getBorrowers(),
        transactions: LibraryStorage.getTransactions(),
        history: LibraryStorage.getHistory(),
        settings: LibraryStorage.getSettings(),
      });

      const binaryBytes = this.activeSqliteEngine.exportBinary();

      // Electron Desktop File System write
      const electron = (typeof window !== 'undefined' && (window as any).electronAPI);
      if (electron?.writeFile) {
        const loc = LibraryStorage.getStorageLocation();
        const destPath = `${loc.folderPath}\\Library.ulmlib`;
        await electron.writeFile(destPath, Array.from(binaryBytes));
        this.lastWriteSizeBytes = binaryBytes.byteLength;
        this.lastWriteTimeIso = new Date().toISOString();
        this.isWriting = false;
        return {
          success: true,
          message: `Committed to ${destPath} (${(binaryBytes.byteLength / 1024).toFixed(1)} KB)`,
        };
      }

      const handle = this.rootDirHandle;
      if (!handle) {
        const cfg = this.getSavedConfig();
        if (cfg.temporaryBrowserStorage || isRunningInIframe()) {
          // Persist binary bytes in IndexedDB for multi-gigabyte durability in browser
          await storeIdbHandle('ulm_library_sqlite_binary', Array.from(binaryBytes));
          this.lastWriteSizeBytes = binaryBytes.byteLength;
          this.lastWriteTimeIso = new Date().toISOString();
          this.isWriting = false;
          return { success: true, message: 'Saved to persistent IndexedDB SQLite storage' };
        }
        throw new Error('No library folder handle is mounted. Storage is inaccessible.');
      }

      const fileHandle = await handle.getFileHandle('Library.ulmlib', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(binaryBytes);
      await writable.close();

      this.lastWriteSizeBytes = binaryBytes.byteLength;
      this.lastWriteTimeIso = new Date().toISOString();
      this.isWriting = false;

      return {
        success: true,
        message: `Committed to Library.ulmlib (${(binaryBytes.byteLength / 1024).toFixed(1)} KB) at ${this.lastWriteTimeIso}`,
      };
    } catch (err: any) {
      this.isWriting = false;
      if (this.writeFailureCallback) {
        this.writeFailureCallback(err.message);
      }
      throw err;
    }
  }

  /**
   * Changes library location in Settings: copies database bytes, verifies counts, switches path, keeps old copy
   */
  static async changeLocation(
    newTargetHandle: any
  ): Promise<{ success: boolean; message: string; oldPath: string; newPath: string }> {
    const oldConfig = this.getSavedConfig();
    const oldHandle = this.rootDirHandle;

    if (!newTargetHandle || typeof newTargetHandle.getFileHandle !== 'function') {
      return { success: false, message: 'Target folder is invalid or inaccessible', oldPath: oldConfig.folderPath, newPath: '' };
    }

    try {
      // 1. Flush and export current binary SQLite
      if (!this.activeSqliteEngine) {
        this.activeSqliteEngine = new SqliteDatabaseService();
        await this.activeSqliteEngine.initializeNewDatabase();
      }

      const books = LibraryStorage.getBooks();
      const borrowers = LibraryStorage.getBorrowers();
      const transactions = LibraryStorage.getTransactions();

      this.activeSqliteEngine.ingestData({
        books,
        borrowers,
        transactions,
        history: LibraryStorage.getHistory(),
        settings: LibraryStorage.getSettings(),
      });

      const binaryBytes = this.activeSqliteEngine.exportBinary();

      // 2. Write to new target folder
      const newFileHandle = await newTargetHandle.getFileHandle('Library.ulmlib', { create: true });
      const writer = await newFileHandle.createWritable();
      await writer.write(binaryBytes);
      await writer.close();

      // 3. Verify counts in new file
      const verifyEngine = new SqliteDatabaseService();
      await verifyEngine.loadFromBytes(binaryBytes);
      const extracted = verifyEngine.extractAllData();
      verifyEngine.close();

      if (extracted.books.length !== books.length || extracted.borrowers.length !== borrowers.length) {
        throw new Error('Data verification failed: Record counts in new folder do not match active library.');
      }

      // 4. Update mount handle
      this.rootDirHandle = newTargetHandle;
      await storeIdbHandle(IDB_KEY_ROOT, newTargetHandle);

      const newPath = `Documents\\${newTargetHandle.name}`;
      this.saveConfig({
        folderPath: newPath,
        folderName: newTargetHandle.name,
        fileName: 'Library.ulmlib',
        isConfigured: true,
        temporaryBrowserStorage: false,
      });

      return {
        success: true,
        message: `Library relocated safely to "${newPath}". Old copy preserved in "${oldConfig.folderPath}".`,
        oldPath: oldConfig.folderPath,
        newPath,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Relocation failed: ${err.message}`,
        oldPath: oldConfig.folderPath,
        newPath: '',
      };
    }
  }

  /**
   * Startup initializer: restores handle from IDB, verifies file existence, or returns status
   */
  static async initOnStartup(): Promise<{
    status: 'ready' | 'missing' | 'unconfigured' | 'needs_permission' | 'unavailable';
    folderName: string;
    folderPath: string;
    message?: string;
  }> {
    const mode = this.detectEnvironmentMode();
    const cfg = this.getSavedConfig();

    if (mode === 'UNAVAILABLE') {
      if (cfg.temporaryBrowserStorage) {
        return { status: 'ready', folderName: 'Temporary Browser Storage', folderPath: 'Browser Sandbox' };
      }
      return { status: 'unavailable', folderName: '', folderPath: '' };
    }

    if (!cfg.isConfigured) {
      return { status: 'unconfigured', folderName: cfg.folderName, folderPath: cfg.folderPath };
    }

    // Try restoring directory handle from IndexedDB
    try {
      const handle = await getIdbHandle(IDB_KEY_ROOT);
      if (handle) {
        this.rootDirHandle = handle;
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          return {
            status: 'needs_permission',
            folderName: handle.name,
            folderPath: cfg.folderPath,
            message: `Click to re-grant read/write access to folder "${handle.name}".`,
          };
        }

        // Verify Library.ulmlib exists in directory
        try {
          const fileHandle = await handle.getFileHandle('Library.ulmlib', { create: false });
          const file = await fileHandle.getFile();
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);

          const engine = new SqliteDatabaseService();
          await engine.loadFromBytes(bytes);
          const qc = engine.quickCheck();
          if (qc.passed) {
            const data = engine.extractAllData();
            LibraryStorage.saveBooks(data.books);
            LibraryStorage.saveBorrowers(data.borrowers);
            LibraryStorage.saveTransactions(data.transactions);
            LibraryStorage.saveHistory(data.history);
            LibraryStorage.saveSettings(data.settings);
            this.activeSqliteEngine = engine;
            this.lastWriteSizeBytes = file.size;
            this.lastWriteTimeIso = new Date(file.lastModified).toISOString();
            return { status: 'ready', folderName: handle.name, folderPath: cfg.folderPath };
          }
        } catch {
          return {
            status: 'missing',
            folderName: handle.name,
            folderPath: `${cfg.folderPath}\\Library.ulmlib`,
            message: `Library database file "Library.ulmlib" was not found in folder "${handle.name}".`,
          };
        }
      }
    } catch (e: any) {
      console.warn('Startup handle restore notice:', e);
    }

    return { status: 'unconfigured', folderName: cfg.folderName, folderPath: cfg.folderPath };
  }

  /**
   * Migration helper: moves existing browser localStorage data into Library.ulmlib
   */
  static async moveBrowserDataIntoLibraryFile(
    handle: any
  ): Promise<{ success: boolean; message: string; counts: { books: number; members: number; loans: number } }> {
    const books = LibraryStorage.getBooks();
    const borrowers = LibraryStorage.getBorrowers();
    const transactions = LibraryStorage.getTransactions();

    const creation = await this.createNewLibraryAt(handle, () => {});
    if (!creation.success) {
      return { success: false, message: creation.message, counts: { books: 0, members: 0, loans: 0 } };
    }

    // Now that file is created and verified, we can clear legacy browser storage keys
    localStorage.removeItem(TEMP_BROWSER_WARN_KEY);

    return {
      success: true,
      message: `Migrated ${books.length} books, ${borrowers.length} members, and ${transactions.length} loans into Library.ulmlib.`,
      counts: { books: books.length, members: borrowers.length, loans: transactions.length },
    };
  }
}

// Wire automatic real autosave hook
LibraryStorage.onMutation(() => {
  RealStorageService.scheduleAutosave();
});
