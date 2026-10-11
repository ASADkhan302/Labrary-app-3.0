import { LibraryStorage } from './storage';
import { BookSheetService } from './bookSheetService';
import { LibraryDataFilesService } from './libraryDataFilesService';
import { UsbBackupService } from './usbBackupService';
import { StorageLocationConfig } from '../types/library';

export interface FolderStatus {
  isConfigured: boolean;
  isMissing: boolean;
  folderPath: string;
  folderName: string;
  databasePath: string;
  hasPermission: boolean;
  sheetStatus: {
    name: string;
    lastSynced: string | null;
    booksWaiting: number;
  };
  dataFilesStatus: {
    lastUpdated: string | null;
    isLockedByExcel: boolean;
  };
}

const STORAGE_KEYS = {
  REMEMBERED_FOLDER: 'ulm_lms_library_folder_v1',
  REMEMBERED_HANDLE_ID: 'ulm_lms_dir_handle_id_v1',
  DATA_FILES_STATUS: 'ulm_lms_data_files_meta_v1',
};

// IndexedDB Helper for preserving FileSystemDirectoryHandle across sessions
const IDB_NAME = 'ulm_lms_handles_db';
const IDB_STORE = 'handles_store';

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
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

async function saveHandleToIdb(key: string, handle: any): Promise<void> {
  try {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(handle, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to save handle to IDB:', e);
  }
}

async function getHandleFromIdb(key: string): Promise<any> {
  try {
    const db = await openHandleDb();
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

export class LibraryFolderService {
  private static rootDirHandle: any = null;
  private static isRefreshingDataFiles = false;
  private static autoRefreshTimer: any = null;

  static getRootDirHandle(): any {
    return this.rootDirHandle;
  }

  static setRootDirHandle(handle: any): void {
    this.rootDirHandle = handle;
    LibraryStorage.setDirectoryHandle(handle);
  }

  /**
   * Initializes folder state on app launch
   */
  static async init(): Promise<{
    status: 'first_run' | 'missing' | 'ready';
    folderPath: string;
    message?: string;
  }> {
    const loc = LibraryStorage.getStorageLocation();
    
    // Check if user has previously set up a folder
    if (!loc.isConfigured || !loc.folderPath) {
      return { status: 'first_run', folderPath: 'Documents\\ULM Library' };
    }

    // Try restoring directory handle from IndexedDB
    try {
      const savedHandle = await getHandleFromIdb('library_root');
      if (savedHandle) {
        this.setRootDirHandle(savedHandle);
        const perm = await this.verifyPermission(savedHandle, false);
        if (perm) {
          // Verify Library.ulmlib exists in directory
          try {
            await savedHandle.getFileHandle('Library.ulmlib', { create: false });
            // Save automatic backup on startup
            this.createAutoBackup().catch(() => {});
            this.scheduleDataFilesRefresh(30000);
            return { status: 'ready', folderPath: loc.folderPath };
          } catch {
            return {
              status: 'missing',
              folderPath: `${loc.folderPath}\\Library.ulmlib`,
              message: `Library file not found at ${loc.folderPath}\\Library.ulmlib`,
            };
          }
        }
      }
    } catch {
      // Fallback
    }

    // If Electron or non-handle environment, verify path
    if (loc.isConfigured) {
      this.scheduleDataFilesRefresh(30000);
      return { status: 'ready', folderPath: loc.folderPath };
    }

    return { status: 'first_run', folderPath: 'Documents\\ULM Library' };
  }

  /**
   * Checks or requests permission on directory handle with single click
   */
  static async verifyPermission(handle: any, promptUser = true): Promise<boolean> {
    if (!handle || typeof handle.queryPermission !== 'function') return true;
    try {
      const status = await handle.queryPermission({ mode: 'readwrite' });
      if (status === 'granted') return true;
      if (promptUser && typeof handle.requestPermission === 'function') {
        const req = await handle.requestPermission({ mode: 'readwrite' });
        return req === 'granted';
      }
    } catch (e) {
      console.warn('Permission query warning:', e);
    }
    return false;
  }

  /**
   * "Start as a beginner" flow:
   * Creates the library folder, Library.ulmlib, Book Sheet\ULM_Book_Entry_Sheet.xlsx, and Data Files\
   * Refuses if Library.ulmlib already exists.
   */
  static async startAsBeginner(
    chosenDirHandle?: any,
    suggestedPath: string = 'Documents\\ULM Library'
  ): Promise<{ success: boolean; message: string; folderPath: string }> {
    let dirHandle = chosenDirHandle || this.rootDirHandle;

    // Check File System Access API
    if (!dirHandle && typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents',
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: false, message: 'Folder selection was cancelled.', folderPath: suggestedPath };
        }
      }
    }

    const folderName = dirHandle?.name || 'ULM Library';
    const cleanPath = dirHandle ? `Documents\\${folderName}` : suggestedPath;

    // NEVER overwrite an existing library in this folder
    if (dirHandle) {
      try {
        await dirHandle.getFileHandle('Library.ulmlib', { create: false });
        // File exists! Reject to prevent overwriting
        return {
          success: false,
          message: `The folder "${folderName}" already contains an existing library (Library.ulmlib). To protect your records, please choose another folder or open the existing library.`,
          folderPath: cleanPath,
        };
      } catch {
        // Does not exist: safe to proceed
      }
    }

    if (dirHandle) {
      this.setRootDirHandle(dirHandle);
      await saveHandleToIdb('library_root', dirHandle);
    }

    // Save configuration
    const config: StorageLocationConfig = {
      mode: 'LOCAL_DISK',
      folderPath: cleanPath,
      folderName,
      fileName: 'Library.ulmlib',
      autoSaveToDisk: true,
      askOnStartup: false,
      isConfigured: true,
      lastSyncTimestamp: new Date().toLocaleTimeString(),
    };
    LibraryStorage.saveStorageLocation(config);

    // 1. Write Library.ulmlib
    await this.saveDatabaseFile();

    // 2. Create Book Sheet\ULM_Book_Entry_Sheet.xlsx
    await this.createBlankBookSheet(dirHandle);

    // 3. Create Data Files\ (books.csv, members.csv, loans.csv, LibraryData.xlsx)
    await this.refreshDataFiles(true);

    // 4. Save first automatic backup in Backups\
    await this.createAutoBackup();

    return {
      success: true,
      message: `Created library folder at "${cleanPath}" with blank book sheet and initial data files.`,
      folderPath: cleanPath,
    };
  }

  /**
   * Creates the blank book sheet from template in "Book Sheet" subfolder
   */
  static async createBlankBookSheet(dirHandle?: any): Promise<void> {
    const handle = dirHandle || this.rootDirHandle;
    try {
      let sheetDirHandle = handle;
      if (handle && typeof handle.getDirectoryHandle === 'function') {
        try {
          sheetDirHandle = await handle.getDirectoryHandle('Book Sheet', { create: true });
        } catch {
          sheetDirHandle = handle;
        }
      }

      let fileHandle: any = null;
      if (sheetDirHandle) {
        fileHandle = await sheetDirHandle.getFileHandle('ULM_Book_Entry_Sheet.xlsx', { create: true });
      }

      const sheetPath = `${LibraryStorage.getStorageLocation().folderPath}\\Book Sheet\\ULM_Book_Entry_Sheet.xlsx`;
      await BookSheetService.startNewAndCreateSheet(sheetPath, fileHandle);
    } catch (err: any) {
      console.warn('Failed to create Book Sheet file on disk:', err.message);
    }
  }

  /**
   * Saves the primary database file (Library.ulmlib)
   */
  static async saveDatabaseFile(): Promise<{ success: boolean; message: string }> {
    const payload = JSON.stringify({
      format: 'ULM_LIBRARY_DATABASE',
      schema_version: 3,
      app_name: 'University of Lakki Marwat Library Management System',
      university: 'University of Lakki Marwat',
      updated_at: new Date().toISOString(),
      books: LibraryStorage.getBooks(),
      borrowers: LibraryStorage.getBorrowers(),
      transactions: LibraryStorage.getTransactions(),
      history: LibraryStorage.getHistory(),
      settings: LibraryStorage.getSettings(),
    }, null, 2);

    const handle = this.rootDirHandle;
    if (handle) {
      try {
        const fileHandle = await handle.getFileHandle('Library.ulmlib', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(payload);
        await writable.close();
        return { success: true, message: 'Saved Library.ulmlib' };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    }

    return { success: true, message: 'Saved to local repository' };
  }

  /**
   * Alias for saveDatabaseFile
   */
  static async saveDatabaseSnapshot(): Promise<{ success: boolean; message: string }> {
    return this.saveDatabaseFile();
  }

  /**
   * Creates an automatic backup in "Backups\" subfolder, retaining the last 14 backups.
   */
  static async createAutoBackup(): Promise<void> {
    const handle = this.rootDirHandle;
    if (!handle || typeof handle.getDirectoryHandle !== 'function') return;

    try {
      const backupsDir = await handle.getDirectoryHandle('Backups', { create: true });
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const filename = `Backup_${timestamp}.ulmlib`;

      const payload = JSON.stringify({
        format: 'ULM_LIBRARY_DATABASE_BACKUP',
        schema_version: 3,
        created_at: now.toISOString(),
        books: LibraryStorage.getBooks(),
        borrowers: LibraryStorage.getBorrowers(),
        transactions: LibraryStorage.getTransactions(),
        history: LibraryStorage.getHistory(),
        settings: LibraryStorage.getSettings(),
      }, null, 2);

      const backupFile = await backupsDir.getFileHandle(filename, { create: true });
      const writable = await backupFile.createWritable();
      await writable.write(payload);
      await writable.close();

      // Prune backups beyond the last 14
      const existingEntries: string[] = [];
      for await (const name of (backupsDir as any).keys()) {
        if (name.startsWith('Backup_') && name.endsWith('.ulmlib')) {
          existingEntries.push(name);
        }
      }

      existingEntries.sort(); // Lexicographical sort corresponds to timestamp
      if (existingEntries.length > 14) {
        const toDelete = existingEntries.slice(0, existingEntries.length - 14);
        for (const oldFile of toDelete) {
          try {
            await backupsDir.removeEntry(oldFile);
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn('Auto-backup notice:', err.message);
    }
  }

  /**
   * Refreshes Data Files\ (books.csv, members.csv, loans.csv, LibraryData.xlsx).
   * Writes to a temp file first, then replaces.
   * If Excel has a file open, retries later and reports "Close Excel to refresh the data files".
   */
  static async refreshDataFiles(force = false): Promise<{ success: boolean; message: string }> {
    if (this.isRefreshingDataFiles && !force) {
      return { success: true, message: 'Refresh already in progress' };
    }
    this.isRefreshingDataFiles = true;

    try {
      const books = LibraryStorage.getBooks();
      const borrowers = LibraryStorage.getBorrowers();
      const transactions = LibraryStorage.getTransactions();

      const workbook = await LibraryDataFilesService.generateLibraryDataWorkbook(books, borrowers, transactions);
      const xlsxBuffer = await workbook.xlsx.writeBuffer();
      const booksCsv = LibraryDataFilesService.generateBooksCsv(books);
      const membersCsv = LibraryDataFilesService.generateMembersCsv(borrowers);
      const loansCsv = LibraryDataFilesService.generateTransactionsCsv(transactions);

      const handle = this.rootDirHandle;
      if (handle && typeof handle.getDirectoryHandle === 'function') {
        try {
          const dataFilesDir = await handle.getDirectoryHandle('Data Files', { create: true });

          // Helper to write to temp file then replace
          const safeWrite = async (finalName: string, data: any) => {
            const tempName = `${finalName}.tmp_${Date.now()}`;
            const tempHandle = await dataFilesDir.getFileHandle(tempName, { create: true });
            const writable = await tempHandle.createWritable();
            await writable.write(data);
            await writable.close();

            // Replace final file
            const finalHandle = await dataFilesDir.getFileHandle(finalName, { create: true });
            const finalWritable = await finalHandle.createWritable();
            await finalWritable.write(data);
            await finalWritable.close();

            // Clean up temp
            try {
              await dataFilesDir.removeEntry(tempName);
            } catch {}
          };

          await safeWrite('LibraryData.xlsx', xlsxBuffer);
          await safeWrite('books.csv', booksCsv);
          await safeWrite('members.csv', membersCsv);
          await safeWrite('loans.csv', loansCsv);

          const timeStr = new Date().toLocaleTimeString();
          localStorage.setItem(STORAGE_KEYS.DATA_FILES_STATUS, JSON.stringify({
            lastUpdated: timeStr,
            isLockedByExcel: false,
          }));

          return { success: true, message: `Data files refreshed at ${timeStr}` };
        } catch (diskErr: any) {
          if (diskErr?.message?.includes('EBUSY') || diskErr?.name === 'NoModificationAllowedError') {
            localStorage.setItem(STORAGE_KEYS.DATA_FILES_STATUS, JSON.stringify({
              lastUpdated: new Date().toLocaleTimeString(),
              isLockedByExcel: true,
            }));
            // Retry in 15 seconds
            setTimeout(() => this.refreshDataFiles(false), 15000);
            return {
              success: false,
              message: 'Close Excel to refresh the data files.',
            };
          }
          return { success: false, message: diskErr.message };
        }
      }

      return { success: true, message: 'Data files refreshed in application cache' };
    } finally {
      this.isRefreshingDataFiles = false;
    }
  }

  /**
   * Schedules a debounced 30-second data files refresh
   */
  static scheduleDataFilesRefresh(delayMs = 30000): void {
    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
    }
    this.autoRefreshTimer = setTimeout(() => {
      this.refreshDataFiles(false).catch(() => {});
    }, delayMs);
  }

  /**
   * Reads the current status for UI display
   */
  static getFolderStatus(): FolderStatus {
    const loc = LibraryStorage.getStorageLocation();
    const sheet = BookSheetService.getLinkedSheet();
    const queue = BookSheetService.getQueue();
    let dataMeta: any = {};
    try {
      dataMeta = JSON.parse(localStorage.getItem(STORAGE_KEYS.DATA_FILES_STATUS) || '{}');
    } catch {}

    return {
      isConfigured: loc.isConfigured,
      isMissing: false,
      folderPath: loc.folderPath,
      folderName: loc.folderName,
      databasePath: `${loc.folderPath}\\Library.ulmlib`,
      hasPermission: Boolean(this.rootDirHandle),
      sheetStatus: {
        name: sheet ? sheet.sheetName : 'ULM_Book_Entry_Sheet.xlsx',
        lastSynced: sheet?.lastSynced || null,
        booksWaiting: queue.filter(q => q.status === 'waiting').length,
      },
      dataFilesStatus: {
        lastUpdated: dataMeta.lastUpdated || null,
        isLockedByExcel: Boolean(dataMeta.isLockedByExcel),
      },
    };
  }
}
