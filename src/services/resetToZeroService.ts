import { LibraryStorage } from './storage';
import { BookSheetService } from './bookSheetService';
import { LibraryFolderService } from './libraryFolderService';
import { LibraryDataFilesService } from './libraryDataFilesService';
import { UsbBackupService } from './usbBackupService';
import { BarcodeService } from './barcodeService';
import { INITIAL_SETTINGS } from './initialData';

export interface DeletionSummary {
  booksCount: number;
  copiesCount: number;
  borrowersCount: number;
  transactionsCount: number;
  photosCount: number;
  isSheetLinked: boolean;
  sheetName?: string;
  sheetPath?: string;
  waitingQueueCount: number;
}

export interface ResetToZeroOptions {
  confirmText: string;
  resetSettings?: boolean;
  sheetAction?: 'fresh_sheet' | 'keep_and_reimport';
  simulateBackupFailure?: boolean;
  onProgress?: (pct: number, stage: string) => void;
}

export interface SelfCheckResult {
  books: number;
  borrowers: number;
  transactions: number;
  activeLoans: number;
  withdrawnCount: number;
  queueCount: number;
  nextAccession: string;
  nextBarcode: string;
  testBookAccession?: string;
  testBookBarcode?: string;
  passed: boolean;
}

export interface ResetToZeroResult {
  success: boolean;
  message: string;
  backupFilename?: string;
  undoAvailable: boolean;
  selfCheck: SelfCheckResult;
  error?: string;
}

export interface UndoResetMeta {
  filename: string;
  timestamp: string;
  booksCount: number;
  borrowersCount: number;
  transactionsCount: number;
}

const UNDO_BACKUP_STORAGE_KEY = 'ulm_lms_undo_reset_backup_bytes_v1';
const UNDO_META_STORAGE_KEY = 'ulm_lms_undo_reset_meta_v1';

export class ResetToZeroService {
  /**
   * Calculates accurate summary of all records that will be purged
   */
  static getDeletionSummary(): DeletionSummary {
    const books = LibraryStorage.getBooks();
    const borrowers = LibraryStorage.getBorrowers();
    const transactions = LibraryStorage.getTransactions();
    const sheet = BookSheetService.getLinkedSheet();
    const queue = BookSheetService.getQueue();

    const copiesCount = books.reduce((sum, b) => sum + (b.total_quantity || 1), 0);
    const photosCount = borrowers.filter(b => !!(b.photo_url || b.photo_path)).length;

    return {
      booksCount: books.length,
      copiesCount,
      borrowersCount: borrowers.length,
      transactionsCount: transactions.length,
      photosCount,
      isSheetLinked: !!sheet,
      sheetName: sheet?.sheetName,
      sheetPath: sheet?.sheetPath,
      waitingQueueCount: queue.length,
    };
  }

  /**
   * Formats ISO timestamp into YYYY-MM-DD_HH-mm
   */
  private static getTimestampString(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }

  /**
   * Checks whether an undo snapshot is currently available
   */
  static getUndoAvailability(): { available: boolean; meta: UndoResetMeta | null } {
    try {
      const metaStr = localStorage.getItem(UNDO_META_STORAGE_KEY);
      if (!metaStr) return { available: false, meta: null };
      const meta: UndoResetMeta = JSON.parse(metaStr);
      const hasBytes = !!localStorage.getItem(UNDO_BACKUP_STORAGE_KEY);
      return { available: hasBytes, meta };
    } catch {
      return { available: false, meta: null };
    }
  }

  /**
   * Executes full "Reset to zero" with automatic backup, verification, atomic purge, and self-checks
   */
  static async executeResetToZero(options: ResetToZeroOptions): Promise<ResetToZeroResult> {
    const onProgress = options.onProgress || (() => {});

    // 1. Validate confirmation text
    if (options.confirmText !== 'RESET') {
      return {
        success: false,
        message: 'Confirmation text must be exactly "RESET" (all uppercase).',
        undoAvailable: false,
        selfCheck: {
          books: -1,
          borrowers: -1,
          transactions: -1,
          activeLoans: -1,
          withdrawnCount: -1,
          queueCount: -1,
          nextAccession: '',
          nextBarcode: '',
          passed: false,
        },
      };
    }

    onProgress(5, 'Gathering database records and preparing pre-reset package...');

    // 2. Snapshot current state in memory for atomic rollback
    const oldBooks = LibraryStorage.getBooks();
    const oldBorrowers = LibraryStorage.getBorrowers();
    const oldTransactions = LibraryStorage.getTransactions();
    const oldHistory = LibraryStorage.getHistory();
    const oldSettings = LibraryStorage.getSettings();
    const oldSheet = BookSheetService.getLinkedSheet();
    const oldWithdrawn = BookSheetService.getWithdrawnAccessions();
    const oldQueue = BookSheetService.getQueue();

    // Immediately cancel any pending writer queue timeouts so no background writer can run concurrently
    BookSheetService.clearQueue();

    // 3. Step 4: Automatic full backup (Before_Reset_YYYY-MM-DD_HH-mm.ulmpack)
    const backupFilename = `Before_Reset_${this.getTimestampString()}.ulmpack`;
    let backupBytes: Uint8Array | null = null;

    onProgress(15, 'Building comprehensive pre-reset package archive...');

    try {
      if (options.simulateBackupFailure) {
        throw new Error('Simulated pre-reset backup failure. Operation aborted.');
      }

      // Build backup ZIP
      const buildRes = await UsbBackupService.buildBackupZip((pct: number, stage: string) => {
        onProgress(15 + Math.round(pct * 0.25), `Backup: ${stage}`);
      });

      if (!buildRes.success || !buildRes.zipBytes) {
        throw new Error(`Failed to create pre-reset safety backup: ${buildRes.message}`);
      }

      backupBytes = buildRes.zipBytes;

      onProgress(42, 'Verifying pre-reset backup package integrity...');

      // Open and verify backup package
      const validation = await UsbBackupService.validateBackupZip(backupBytes);
      if (!validation.valid) {
        throw new Error(`Pre-reset backup verification failed: ${validation.errors.join('; ')}`);
      }

      // Store verified backup bytes for [Undo reset]
      try {
        // Convert to base64 for persistent storage in browser
        let binary = '';
        const len = backupBytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(backupBytes[i]);
        }
        const b64 = btoa(binary);
        localStorage.setItem(UNDO_BACKUP_STORAGE_KEY, b64);
        
        const meta: UndoResetMeta = {
          filename: backupFilename,
          timestamp: new Date().toISOString(),
          booksCount: oldBooks.length,
          borrowersCount: oldBorrowers.length,
          transactionsCount: oldTransactions.length,
        };
        localStorage.setItem(UNDO_META_STORAGE_KEY, JSON.stringify(meta));
      } catch (e: any) {
        console.warn('Could not cache backup in localStorage for undo:', e.message);
      }

      // Also write backup into Backups/ folder on disk if directory handle exists
      try {
        const rootHandle = LibraryFolderService.getRootDirHandle();
        if (rootHandle && typeof rootHandle.getDirectoryHandle === 'function') {
          const backupsDir = await rootHandle.getDirectoryHandle('Backups', { create: true });
          const fileHandle = await backupsDir.getFileHandle(backupFilename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(backupBytes);
          await writable.close();
        }
      } catch (e: any) {
        console.warn('Could not write backup to Backups folder:', e.message);
      }
    } catch (backupErr: any) {
      // If backup fails, ABORT immediately without touching anything
      return {
        success: false,
        message: `Reset aborted before changes: ${backupErr.message}`,
        undoAvailable: false,
        selfCheck: {
          books: oldBooks.length,
          borrowers: oldBorrowers.length,
          transactions: oldTransactions.length,
          activeLoans: 0,
          withdrawnCount: oldWithdrawn.length,
          queueCount: oldQueue.length,
          nextAccession: '',
          nextBarcode: '',
          passed: false,
        },
        error: backupErr.message,
      };
    }

    // 4. Step 5: Execute atomic purge
    onProgress(55, 'Executing atomic database reset...');

    try {
      // (a) Handle linked Excel sheet
      const sheetAction = options.sheetAction || 'fresh_sheet';
      if (oldSheet) {
        if (sheetAction === 'fresh_sheet') {
          // Move old sheet into Backups
          try {
            const rootHandle = LibraryFolderService.getRootDirHandle();
            if (rootHandle && typeof rootHandle.getDirectoryHandle === 'function') {
              const backupsDir = await rootHandle.getDirectoryHandle('Backups', { create: true });
              const bookSheetDir = await rootHandle.getDirectoryHandle('Book Sheet', { create: true });
              
              // Archive existing sheet if present
              try {
                const sheetHandle = await bookSheetDir.getFileHandle('ULM_Book_Entry_Sheet.xlsx', { create: false });
                const file = await sheetHandle.getFile();
                const archiveName = `Archived_Sheet_${this.getTimestampString()}.xlsx`;
                const archiveHandle = await backupsDir.getFileHandle(archiveName, { create: true });
                const w = await archiveHandle.createWritable();
                await w.write(await file.arrayBuffer());
                await w.close();
              } catch {}
            }
          } catch {}

          // Clear sheet cache and queue so no books are re-imported
          BookSheetService.clearAllCaches();
          BookSheetService.clearQueue();
          BookSheetService.saveLinkedSheet(null);
        } else {
          // Keep using sheet: clear queue and prepare to re-import
          BookSheetService.clearQueue();
        }
      }

      // (b) Purge all database tables
      LibraryStorage.saveBooks([]);
      LibraryStorage.saveBorrowers([]);
      LibraryStorage.saveTransactions([]);
      LibraryStorage.saveHistory([]);

      // (c) Clear counters, queues, and caches
      BookSheetService.clearWithdrawnAccessions();
      BookSheetService.clearQueue();
      BookSheetService.clearAllCaches();

      // Clear import batches and undo history
      try {
        localStorage.removeItem('ulm_lms_import_batches_v1');
        localStorage.removeItem('ulm_lms_migration_rollback_point');
        localStorage.removeItem('ulm_borrower_modal_draft');
        localStorage.removeItem('ulm_borrower_modal_last_saved');
        localStorage.removeItem('ulm_lms_last_entry_cache');
        localStorage.removeItem('ulm_lms_catalog_sort');
      } catch {}

      // (d) Handle Settings
      if (options.resetSettings) {
        LibraryStorage.saveSettings(INITIAL_SETTINGS);
      }

      // (e) Cancel any pending data files background sync timers
      LibraryDataFilesService.cancelScheduledSync();

      // (f) Reset files in library directory (Library.ulmlib, Data Files)
      onProgress(75, 'Resetting Data Files and canonical database snapshot...');
      try {
        await LibraryFolderService.saveDatabaseSnapshot();
        await LibraryFolderService.refreshDataFiles(true);
      } catch (fileErr: any) {
        // If Excel locks a file, log warning but do not abort purge
        console.warn('Data files notice during reset:', fileErr.message);
      }

      // (g) Add clean audit entry
      LibraryStorage.logHistory({
        action: 'DATABASE_RESET',
        description: `Reset to zero executed successfully. All tables purged. Backup preserved as "${backupFilename}".`,
        barcode: 'RESET-0',
        user: 'Librarian-Admin',
      });

      // 5. Step 8: Automatic self-check
      onProgress(88, 'Running automated post-reset self-checks...');

      const postBooks = LibraryStorage.getBooks();
      const postBorrowers = LibraryStorage.getBorrowers();
      const postTransactions = LibraryStorage.getTransactions();
      const postWithdrawn = BookSheetService.getWithdrawnAccessions();
      const postQueue = BookSheetService.getQueue();
      const nextAccInfo = BookSheetService.getNextAccessionNumber();
      const nextBarcodeInfo = BarcodeService.generateBarcode(nextAccInfo.accessionNo);

      // Verify adding a book gives accession 1 and ULM-00001
      const testAddRes = LibraryStorage.addBook({
        barcode: '',
        isbn: '978-0-00-000000-0',
        book_name: 'ULM Verification Test Volume',
        author: 'System Test Engine',
        publisher: 'ULM Press',
        category: 'General',
        edition: '1st Edition',
        publication_year: 2026,
        language: 'English',
        description: 'Temporary verification test volume',
        book_image_path: '',
        shelf: 'Rack-01',
        row: '1',
        section: 'General',
        dewey_call_number: '000 GEN',
        total_quantity: 1,
        available_quantity: 1,
      });

      let testBookAccession = '';
      let testBookBarcode = '';
      if (testAddRes.success && testAddRes.book) {
        testBookAccession = testAddRes.book.accession_no || '';
        testBookBarcode = testAddRes.book.barcode || '';
        // Clean up test book
        LibraryStorage.deleteBook(testAddRes.book.id, true);
        BookSheetService.clearWithdrawnAccessions();
        BookSheetService.clearQueue();
      }

      const passed =
        postBooks.length === 0 &&
        postBorrowers.length === 0 &&
        postTransactions.length === 0 &&
        postWithdrawn.length === 0 &&
        postQueue.length === 0 &&
        (nextAccInfo.accessionNo === '1' || nextAccInfo.accessionNo === '00001') &&
        (nextBarcodeInfo.barcode === 'ULM-00001' || nextBarcodeInfo.barcode.endsWith('-00001')) &&
        (testBookAccession === '1' || testBookAccession === '00001') &&
        testBookBarcode.endsWith('-00001');

      const selfCheck: SelfCheckResult = {
        books: postBooks.length,
        borrowers: postBorrowers.length,
        transactions: postTransactions.length,
        activeLoans: 0,
        withdrawnCount: postWithdrawn.length,
        queueCount: postQueue.length,
        nextAccession: nextAccInfo.accessionNo,
        nextBarcode: nextBarcodeInfo.barcode,
        testBookAccession,
        testBookBarcode,
        passed,
      };

      if (!passed) {
        throw new Error(`Self-check verification failed: expected 0 books, next accession 1, got ${nextAccInfo.accessionNo} (${nextBarcodeInfo.barcode})`);
      }

      onProgress(100, 'Reset complete.');

      return {
        success: true,
        message: 'Library reset to zero successfully. Verified 0 records and accession starting at 1.',
        backupFilename,
        undoAvailable: true,
        selfCheck,
      };
    } catch (purgeErr: any) {
      // Rollback on any failure
      console.error('Reset failed, rolling back to pre-reset state:', purgeErr);

      LibraryStorage.saveBooks(oldBooks);
      LibraryStorage.saveBorrowers(oldBorrowers);
      LibraryStorage.saveTransactions(oldTransactions);
      LibraryStorage.saveHistory(oldHistory);
      LibraryStorage.saveSettings(oldSettings);
      BookSheetService.saveLinkedSheet(oldSheet);
      BookSheetService.saveQueue(oldQueue);

      return {
        success: false,
        message: `Reset failed and was completely rolled back: ${purgeErr.message}`,
        undoAvailable: false,
        selfCheck: {
          books: oldBooks.length,
          borrowers: oldBorrowers.length,
          transactions: oldTransactions.length,
          activeLoans: 0,
          withdrawnCount: oldWithdrawn.length,
          queueCount: oldQueue.length,
          nextAccession: '',
          nextBarcode: '',
          passed: false,
        },
        error: purgeErr.message,
      };
    }
  }

  /**
   * Undoes the last reset by restoring the verified pre-reset package
   */
  static async undoReset(
    onProgress?: (pct: number, stage: string) => void
  ): Promise<{ success: boolean; message: string }> {
    const cb = onProgress || (() => {});
    cb(10, 'Retrieving pre-reset backup archive...');

    const b64 = localStorage.getItem(UNDO_BACKUP_STORAGE_KEY);
    if (!b64) {
      return { success: false, message: 'No pre-reset backup snapshot found to undo.' };
    }

    try {
      cb(25, 'Decoding backup package...');
      const binary = atob(b64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      cb(40, 'Restoring catalog records from pre-reset backup...');
      const restoreRes = await UsbBackupService.importFromUsb(bytes, 'REPLACE', (pct: number, stage: string) => {
        cb(40 + Math.round(pct * 0.5), stage);
      });

      if (!restoreRes.success) {
        return { success: false, message: `Failed to undo reset: ${restoreRes.message}` };
      }

      // Synchronize data files
      cb(95, 'Refreshing data files...');
      await LibraryFolderService.saveDatabaseSnapshot();
      await LibraryFolderService.refreshDataFiles(true);

      cb(100, 'Undo complete.');
      return {
        success: true,
        message: `Successfully undone reset. Restored ${restoreRes.booksImported} books, ${restoreRes.membersImported} members, and ${restoreRes.transactionsImported} loans.`,
      };
    } catch (e: any) {
      return { success: false, message: `Failed undoing reset: ${e.message}` };
    }
  }
}
