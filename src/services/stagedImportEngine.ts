import { Book, ImportJob, ImportJobRoundRecord } from '../types/library';
import { CleanedBookRow, RowProblem } from './importerEngine';
import { LibraryStorage } from './storage';
import { AlmariService } from './almariService';
import { BarcodeService } from './barcodeService';
import { UsbBackupService } from './usbBackupService';
import { BookSheetService } from './bookSheetService';

const ACTIVE_JOB_KEY = 'ulm_lms_active_import_job_v2';
const ROW_CACHE_KEY_PREFIX = 'ulm_lms_import_rows_';

export interface StagedImportProgressUpdate {
  roundNo: number;
  totalRounds: number;
  percent: number;
  currentStage: string;
  placedSummaryText: string;
  roundDurationMs?: number;
  memoryMb?: number;
  roundsList: ImportJobRoundRecord[];
  isWarning?: boolean;
  warningMessage?: string;
}

export class StagedImportEngine {
  private static isRunning = false;
  private static isPaused = false;
  private static isCancelled = false;

  static getActiveJob(): ImportJob | null {
    try {
      const raw = localStorage.getItem(ACTIVE_JOB_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static saveActiveJob(job: ImportJob | null): void {
    if (!job) {
      localStorage.removeItem(ACTIVE_JOB_KEY);
    } else {
      localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job));
    }
  }

  static storeRows(fileHash: string, rows: CleanedBookRow[]): void {
    try {
      sessionStorage.setItem(`${ROW_CACHE_KEY_PREFIX}${fileHash}`, JSON.stringify(rows));
    } catch {
      // If sessionStorage full, rows remain in memory in component
    }
  }

  static getStoredRows(fileHash: string): CleanedBookRow[] | null {
    try {
      const raw = sessionStorage.getItem(`${ROW_CACHE_KEY_PREFIX}${fileHash}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Initializes a new staged import job
   */
  static async initJob(
    fileHash: string,
    fileName: string,
    readyRows: CleanedBookRow[],
    roundSize = 1000,
    autoArrange = true,
    pauseAfterRound = false
  ): Promise<ImportJob> {
    const totalRows = readyRows.length;
    const clampedRoundSize = Math.max(200, Math.min(2000, roundSize));
    const totalRounds = totalRows <= 1000 ? 1 : Math.ceil(totalRows / clampedRoundSize);
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Create safety snapshot before job begins
    await UsbBackupService.createPreRestoreSafetyBackup();

    const job: ImportJob = {
      id,
      file_hash: fileHash,
      file_name: fileName,
      total_rows: totalRows,
      next_row: 0,
      rounds_done: 0,
      total_rounds: totalRounds,
      round_size: clampedRoundSize,
      status: 'pending',
      auto_arrange: autoArrange,
      pause_after_round: pauseAfterRound,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      round_history: [],
      all_imported_book_ids: [],
      created_almari_ids: [],
    };

    this.saveActiveJob(job);
    this.storeRows(fileHash, readyRows);
    return job;
  }

  /**
   * Executes the staged import job round by round
   */
  static async runJob(
    job: ImportJob,
    readyRows: CleanedBookRow[],
    onProgress: (update: StagedImportProgressUpdate) => void
  ): Promise<{ success: boolean; job: ImportJob; message: string }> {
    this.isRunning = true;
    this.isPaused = false;
    this.isCancelled = false;

    job.status = 'running';
    this.saveActiveJob(job);

    const initialExistingBooks = LibraryStorage.getBooks();
    const existingBarcodes = new Set(initialExistingBooks.map(b => (b.barcode || '').trim().toUpperCase()));
    const existingAccessions = new Set(initialExistingBooks.map(b => String(b.accession_no || '').trim().toUpperCase()));

    let nextAccessionCounter = BookSheetService.getNextAccessionNumber(initialExistingBooks).highestNum + 1;

    while (job.next_row < job.total_rows && !this.isCancelled) {
      if (this.isPaused) {
        job.status = 'paused';
        this.saveActiveJob(job);
        return { success: false, job, message: 'Import job paused by user.' };
      }

      const currentRoundNo = job.rounds_done + 1;
      const currentRoundSize = job.round_size;
      const startIdx = job.next_row;
      const endIdx = Math.min(startIdx + currentRoundSize, job.total_rows);
      const rowsChunk = readyRows.slice(startIdx, endIdx);

      const roundStartTime = performance.now();
      const roundStartIso = new Date().toISOString();

      onProgress({
        roundNo: currentRoundNo,
        totalRounds: job.total_rounds,
        percent: Math.round((startIdx / job.total_rows) * 100),
        currentStage: `Executing Round ${currentRoundNo} of ${job.total_rounds} (${rowsChunk.length} books)...`,
        placedSummaryText: 'Preparing atomic batch transaction...',
        roundsList: job.round_history,
      });

      // Memory Watchdog check
      const mem = (performance as any).memory?.usedJSHeapSize;
      const memMb = mem ? Math.round(mem / (1024 * 1024)) : undefined;
      if (memMb && memMb > 500) {
        job.status = 'paused';
        this.saveActiveJob(job);
        onProgress({
          roundNo: currentRoundNo,
          totalRounds: job.total_rounds,
          percent: Math.round((startIdx / job.total_rows) * 100),
          currentStage: `Memory budget limit reached (${memMb} MB). Paused for garbage collection.`,
          placedSummaryText: 'Paused due to memory threshold.',
          roundsList: job.round_history,
          isWarning: true,
          warningMessage: `Memory usage is ${memMb} MB. Paused safely. You can resume at any time.`,
        });
        return { success: false, job, message: 'Paused due to memory limit (>500MB).' };
      }

      // Construct Book objects in memory without per-row saves
      const booksToInsert: Book[] = [];
      const batchId = `${job.id}-R${currentRoundNo}`;
      const nowIso = new Date().toISOString();

      for (const row of rowsChunk) {
        let acc = row.accessionNo ? String(row.accessionNo).trim() : '';
        if (!acc || existingAccessions.has(acc.toUpperCase())) {
          acc = String(nextAccessionCounter).padStart(5, '0');
          nextAccessionCounter++;
        }
        existingAccessions.add(acc.toUpperCase());

        let bc = row.barcode ? row.barcode.trim().toUpperCase() : '';
        if (!bc || existingBarcodes.has(bc)) {
          bc = BarcodeService.generateBarcode(acc, existingBarcodes).barcode;
        }
        existingBarcodes.add(bc);

        const newBook: Book = {
          id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          barcode: bc,
          isbn: row.isbn || '',
          book_name: row.title,
          author: row.author,
          publisher: row.publisher,
          place: row.place,
          category: 'General Reference',
          edition: row.edition,
          publication_year: row.year || 2024,
          language: row.language,
          description: row.sourceRemarks,
          book_image_path: '',
          total_quantity: 1,
          available_quantity: 1,
          shelf: 'General-Stack-01',
          row: 'Row-A',
          section: 'Main Stacks',
          dewey_call_number: '000 ULM',
          date_added: row.dateAdded || nowIso.split('T')[0],
          group_id: row.groupId || null,
          almari_id: row.almariId || null,
          shelf_no: row.shelfNo || null,
          binding: row.binding,
          pages: row.pages,
          price: row.price,
          source_remarks: row.sourceRemarks,
          accession_no: acc,
          import_batch_id: batchId,
          imported_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
          is_active: true,
        };

        booksToInsert.push(newBook);
      }

      // Check cancellation before commit
      if (this.isCancelled) {
        job.status = 'cancelled';
        this.saveActiveJob(job);
        return { success: false, job, message: 'Import cancelled before committing round.' };
      }

      // ATOMIC INSERTION: 1 save operation for the entire round
      try {
        LibraryStorage.addBooksBatchAtomic(booksToInsert);
      } catch (err: any) {
        // Storage quota error
        job.status = 'failed';
        job.error_message = 'Storage quota reached or localStorage full.';
        this.saveActiveJob(job);
        return { success: false, job, message: 'Storage quota reached. Round rolled back.' };
      }

      let arrangedCount = 0;
      let placedSummaryText = `${booksToInsert.length} books registered in catalogue.`;

      // INCREMENTAL AUTO-ARRANGE: arrange this round's books
      if (job.auto_arrange) {
        const arrangeRes = AlmariService.autoArrangeBooks(booksToInsert, {
          mode: 'incremental',
          scope: 'unassigned',
          batchId,
          roundNo: currentRoundNo,
        });

        if (arrangeRes.booksToUpdate.length > 0) {
          // Update locations in storage
          const allCurrent = LibraryStorage.getBooks();
          const updateMap = new Map(arrangeRes.booksToUpdate.map(b => [b.id, b]));
          const updatedCatalog = allCurrent.map(b => updateMap.get(b.id) || b);
          LibraryStorage.saveBooks(updatedCatalog);
          arrangedCount = arrangeRes.booksToUpdate.length;

          // Track any new almaris created
          if (arrangeRes.almarisCreated.length > 0) {
            job.created_almari_ids.push(...arrangeRes.almarisCreated.map(a => a.id));
          }

          const topAlm = arrangeRes.preview.almarisSummary[0];
          if (topAlm) {
            placedSummaryText = `Placed in: ${topAlm.name_en} (${topAlm.code}) ${topAlm.booksAssignedCount} / ${topAlm.totalCapacity}`;
          }
        }
      }

      const roundEndTime = performance.now();
      const durationMs = Math.round(roundEndTime - roundStartTime);

      // ADAPTIVE SIZING: If round takes > 15 seconds, halve next round size (min 200)
      if (durationMs > 15000 && job.round_size > 200) {
        job.round_size = Math.max(200, Math.floor(job.round_size / 2));
      }

      const roundRecord: ImportJobRoundRecord = {
        round_no: currentRoundNo,
        rows_in_round: rowsChunk.length,
        books_imported: booksToInsert.length,
        books_arranged: arrangedCount,
        start_time: roundStartIso,
        end_time: new Date().toISOString(),
        duration_ms: durationMs,
        status: 'done',
      };

      job.round_history.push(roundRecord);
      job.rounds_done++;
      job.next_row = endIdx;
      job.all_imported_book_ids.push(...booksToInsert.map(b => b.id));
      job.updated_at = new Date().toISOString();

      this.saveActiveJob(job);

      onProgress({
        roundNo: currentRoundNo,
        totalRounds: job.total_rounds,
        percent: Math.round((endIdx / job.total_rows) * 100),
        currentStage: `Round ${currentRoundNo} complete in ${(durationMs / 1000).toFixed(1)}s.`,
        placedSummaryText,
        roundDurationMs: durationMs,
        roundsList: job.round_history,
      });

      // Pause if pauseAfterRound is enabled
      if (job.pause_after_round && job.next_row < job.total_rows) {
        job.status = 'paused';
        this.saveActiveJob(job);
        return { success: true, job, message: `Round ${currentRoundNo} finished. Paused as requested.` };
      }

      // Breathe 200ms before next round
      await new Promise(r => setTimeout(r, 200));
    }

    if (this.isCancelled) {
      job.status = 'cancelled';
      this.saveActiveJob(job);
      return { success: false, job, message: 'Import job was cancelled by user.' };
    }

    job.status = 'completed';
    this.saveActiveJob(job);

    return {
      success: true,
      job,
      message: `All ${job.total_rows.toLocaleString()} books imported successfully in ${job.rounds_done} rounds!`,
    };
  }

  static pause(): void {
    this.isPaused = true;
  }

  static resume(): void {
    this.isPaused = false;
  }

  static cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Undoes the whole import job: removes all books created by this job,
   * cleans up location history, and removes empty auto-created almaris.
   */
  static undoWholeJob(jobId: string): { removedCount: number; message: string } {
    const allBooks = LibraryStorage.getBooks();
    const booksToRemove = allBooks.filter(b => b.import_batch_id?.startsWith(jobId));
    const retainedBooks = allBooks.filter(b => !b.import_batch_id?.startsWith(jobId));

    LibraryStorage.saveBooks(retainedBooks);

    // Undo location movements
    const history = AlmariService.getLocationHistory();
    const remainingHistory = history.filter(h => !h.batch_id?.startsWith(jobId));
    localStorage.setItem('ulm_lms_location_history_v1', JSON.stringify(remainingHistory));

    // Remove empty auto-created almaris
    const almaris = AlmariService.getAlmaris();
    const cleanedAlmaris = almaris.filter(a => {
      if (a.auto_created && !a.name_locked) {
        const hasBooks = retainedBooks.some(b => b.almari_id === a.id);
        return hasBooks;
      }
      return true;
    });
    AlmariService.saveAlmaris(cleanedAlmaris);

    this.saveActiveJob(null);
    return {
      removedCount: booksToRemove.length,
      message: `Undone complete import job. Removed ${booksToRemove.length} imported volumes and restored shelves.`,
    };
  }

  /**
   * Undoes only the last completed round of a job
   */
  static undoLastRound(job: ImportJob): { undoneCount: number; updatedJob: ImportJob } {
    if (job.round_history.length === 0) {
      return { undoneCount: 0, updatedJob: job };
    }

    const lastRound = job.round_history[job.round_history.length - 1];
    const roundBatchId = `${job.id}-R${lastRound.round_no}`;

    const res = LibraryStorage.rollbackImportRound(roundBatchId);

    // Remove round from job
    job.round_history.pop();
    job.rounds_done = Math.max(0, job.rounds_done - 1);
    job.next_row = Math.max(0, job.next_row - lastRound.rows_in_round);
    this.saveActiveJob(job);

    return { undoneCount: res.removedCount, updatedJob: job };
  }

  /**
   * Generates downloadable CSV problem report
   */
  static generateProblemReportCsv(problems: RowProblem[]): string {
    const headers = ['Excel Row', 'Accession Number', 'Problem Type', 'Field', 'Description'];
    const rows = problems.map(p => [
      p.excelRowNumber,
      `"${(p.accessionNo || '').replace(/"/g, '""')}"`,
      p.type,
      `"${(p.field || '').replace(/"/g, '""')}"`,
      `"${(p.message || '').replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Generates a printable shelving list for the imported books grouped by Almari and Shelf
   */
  static generateShelvingList(job: ImportJob, books: Book[]): { almariName: string; code: string; shelfNo: number; rangeStr: string; count: number; titles: string[] }[] {
    const jobBooks = books.filter(b => b.import_batch_id?.startsWith(job.id));
    const almaris = AlmariService.getAlmaris();
    const almarisMap = new Map(almaris.map(a => [a.id, a]));

    const groupsMap = new Map<string, Book[]>();
    for (const b of jobBooks) {
      const key = `${b.almari_id || 'none'}:${b.shelf_no || 1}`;
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(b);
    }

    const result: { almariName: string; code: string; shelfNo: number; rangeStr: string; count: number; titles: string[] }[] = [];
    for (const [key, bList] of groupsMap.entries()) {
      const [almId, sNoStr] = key.split(':');
      const shelfNo = parseInt(sNoStr, 10);
      const alm = almarisMap.get(almId);
      const range = AlmariService.computeShelfRange(bList);
      result.push({
        almariName: alm ? alm.name_en : 'Unassigned Stacks',
        code: alm ? alm.code : 'UNASSIGNED',
        shelfNo,
        rangeStr: range.rangeStr,
        count: bList.length,
        titles: bList.slice(0, 10).map(b => b.book_name),
      });
    }

    return result.sort((a, b) => a.code.localeCompare(b.code) || a.shelfNo - b.shelfNo);
  }
}
