import * as fflate from 'fflate';
import { Book, LinkedSheetInfo, SystemSettings } from '../types/library';
import { LibraryStorage } from './storage';
import { BarcodeService } from './barcodeService';
import { ImporterEngine } from './importerEngine';
import { getTodayIso, formatDisplayDate } from '../utils/dateUtils';
import { sanitizeBidiOverrides, isArabicOrUrduScript } from '../utils/urduUtils';

export interface SheetQueueItem {
  bookId: string;
  accessionNo: string;
  title: string;
  barcode: string;
  status: 'waiting' | 'written' | 'failed';
  addedAt: string;
  error?: string;
}

export interface SheetBackupEntry {
  fileName: string;
  timestamp: string;
  bytes: Uint8Array;
  size: number;
}

export interface AccessionValidationResult {
  valid: boolean;
  type: 'OK' | 'BELOW_HIGHEST' | 'JUMP_ABOVE' | 'DUPLICATE';
  message?: string;
  suggested?: string;
}

const STORAGE_KEYS = {
  LINKED_SHEET: 'ulm_lms_linked_sheet_v2',
  WRITE_QUEUE: 'ulm_lms_sheet_write_queue_v2',
  WITHDRAWN_ACCESSIONS: 'ulm_lms_withdrawn_accessions_v2',
  SHEET_BYTES_CACHE: 'ulm_lms_sheet_bytes_cache_v2',
  FIRST_RUN_CHOICE: 'ulm_lms_first_run_choice_v2',
};

export class BookSheetService {
  private static memStore = new Map<string, string>();
  private static fileHandle: any = null;
  private static cachedFileBytes: Uint8Array | null = null;
  private static backups: SheetBackupEntry[] = [];
  private static hasBackedUpThisSession = false;
  private static backgroundInterval: any = null;
  private static queueTimeout: any = null;
  private static isWriting = false;

  private static storageGet(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return this.memStore.get(key) || null;
  }

  private static storageSet(key: string, val: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
      }
    } catch {}
    this.memStore.set(key, val);
  }

  private static storageRemove(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}
    this.memStore.delete(key);
  }

  // Cloud synced folder keywords
  private static CLOUD_KEYWORDS = ['onedrive', 'dropbox', 'google drive', 'gdrive', 'icloud', 'box sync'];

  /**
   * Initializes background writer on app start
   */
  static init(): void {
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }
    // Try restoring file bytes from localStorage cache
    try {
      const cachedB64 = this.storageGet(STORAGE_KEYS.SHEET_BYTES_CACHE);
      if (cachedB64 && !this.cachedFileBytes) {
        const binStr = atob(cachedB64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        this.cachedFileBytes = bytes;
      }
    } catch {
      // Ignore cache restore errors
    }

    // Process queue immediately on start
    setTimeout(() => {
      this.processQueue().catch(() => {});
    }, 1500);

    // Process waiting queue every 60 seconds
    this.backgroundInterval = setInterval(() => {
      const queue = this.getQueue();
      const waiting = queue.filter(q => q.status === 'waiting');
      if (waiting.length > 0 && !this.isWriting) {
        this.processQueue().catch(() => {});
      }
    }, 60000);
  }

  static setFileHandle(handle: any): void {
    this.fileHandle = handle;
  }

  static getFileHandle(): any {
    return this.fileHandle;
  }

  static setCachedBytes(bytes: Uint8Array): void {
    this.cachedFileBytes = bytes;
    try {
      // Save up to 5MB in storage as base64 for instant reloads
      if (bytes.length < 5 * 1024 * 1024) {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        this.storageSet(STORAGE_KEYS.SHEET_BYTES_CACHE, btoa(binary));
      }
    } catch {
      // Ignore quota errors
    }
  }

  static getCachedBytes(): Uint8Array | null {
    return this.cachedFileBytes;
  }

  /**
   * Checks if a path is inside a cloud-synced folder
   */
  static isCloudSyncedPath(path: string): { isCloud: boolean; provider?: string } {
    if (!path) return { isCloud: false };
    const lower = path.toLowerCase();
    for (const kw of this.CLOUD_KEYWORDS) {
      if (lower.includes(kw)) {
        let provider = 'Cloud Sync Folder';
        if (lower.includes('onedrive')) provider = 'Microsoft OneDrive';
        else if (lower.includes('dropbox')) provider = 'Dropbox';
        else if (lower.includes('google drive') || lower.includes('gdrive')) provider = 'Google Drive';
        else if (lower.includes('icloud')) provider = 'iCloud Drive';
        return { isCloud: true, provider };
      }
    }
    return { isCloud: false };
  }

  /**
   * Linked Sheet Information
   */
  static getLinkedSheet(): LinkedSheetInfo | null {
    try {
      const data = this.storageGet(STORAGE_KEYS.LINKED_SHEET);
      if (!data) return null;
      const parsed: LinkedSheetInfo = JSON.parse(data);
      const queue = this.getQueue();
      parsed.booksWaiting = queue.filter(q => q.status === 'waiting').length;
      return parsed;
    } catch {
      return null;
    }
  }

  static saveLinkedSheet(info: LinkedSheetInfo | null): void {
    if (!info) {
      this.storageRemove(STORAGE_KEYS.LINKED_SHEET);
      return;
    }
    const cloudCheck = this.isCloudSyncedPath(info.sheetPath);
    info.isCloudFolder = cloudCheck.isCloud;
    info.cloudProviderName = cloudCheck.provider;
    this.storageSet(STORAGE_KEYS.LINKED_SHEET, JSON.stringify(info));
  }

  static disconnectSheet(): void {
    this.saveLinkedSheet(null);
    this.fileHandle = null;
    this.cachedFileBytes = null;
    this.storageRemove(STORAGE_KEYS.SHEET_BYTES_CACHE);
  }

  /**
   * First Run State
   */
  static getFirstRunChoice(): 'choose_sheet' | 'start_new_sheet' | 'start_no_sheet' | null {
    return this.storageGet(STORAGE_KEYS.FIRST_RUN_CHOICE) as any;
  }

  static setFirstRunChoice(choice: 'choose_sheet' | 'start_new_sheet' | 'start_no_sheet'): void {
    this.storageSet(STORAGE_KEYS.FIRST_RUN_CHOICE, choice);
  }

  /**
   * Queue Management
   */
  static getQueue(): SheetQueueItem[] {
    try {
      const data = this.storageGet(STORAGE_KEYS.WRITE_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveQueue(queue: SheetQueueItem[]): void {
    this.storageSet(STORAGE_KEYS.WRITE_QUEUE, JSON.stringify(queue));
    // Update linked sheet waiting count
    const sheet = this.getLinkedSheet();
    if (sheet) {
      sheet.booksWaiting = queue.filter(q => q.status === 'waiting').length;
      this.saveLinkedSheet(sheet);
    }
  }

  static enqueueBook(book: Book): void {
    const queue = this.getQueue();
    const existing = queue.find(q => q.bookId === book.id);
    if (!existing) {
      queue.push({
        bookId: book.id,
        accessionNo: book.accession_no || book.barcode.replace(/^[A-Z]+-/, ''),
        title: book.book_name,
        barcode: book.barcode,
        status: 'waiting',
        addedAt: new Date().toISOString(),
      });
      this.saveQueue(queue);
    }

    // Trigger immediate background write attempt
    if (this.queueTimeout) {
      clearTimeout(this.queueTimeout);
    }
    this.queueTimeout = setTimeout(() => {
      this.queueTimeout = null;
      this.processQueue().catch(() => {});
    }, 100);
  }

  static clearWithdrawnAccessions(): void {
    this.storageRemove(STORAGE_KEYS.WITHDRAWN_ACCESSIONS);
  }

  static clearQueue(): void {
    if (this.queueTimeout) {
      clearTimeout(this.queueTimeout);
      this.queueTimeout = null;
    }
    this.isWriting = false;
    this.storageRemove(STORAGE_KEYS.WRITE_QUEUE);
  }

  static clearAllCaches(): void {
    if (this.queueTimeout) {
      clearTimeout(this.queueTimeout);
      this.queueTimeout = null;
    }
    this.isWriting = false;
    this.cachedFileBytes = null;
    this.fileHandle = null;
    this.storageRemove(STORAGE_KEYS.SHEET_BYTES_CACHE);
  }

  /**
   * Withdrawn / Purged Accession Registry: Numbers are NEVER reused
   */
  static getWithdrawnAccessions(): string[] {
    try {
      const data = this.storageGet(STORAGE_KEYS.WITHDRAWN_ACCESSIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static registerWithdrawnAccession(accessionNo: string): void {
    if (!accessionNo) return;
    const list = this.getWithdrawnAccessions();
    if (!list.includes(accessionNo)) {
      list.push(accessionNo);
      this.storageSet(STORAGE_KEYS.WITHDRAWN_ACCESSIONS, JSON.stringify(list));
    }
  }

  /**
   * Extracts accession numbers from column A of linked sheet XML bytes
   */
  static extractAccessionsFromSheetBytes(bytes: Uint8Array): string[] {
    try {
      const unzipped = fflate.unzipSync(bytes);
      const sheet1U8 = unzipped['xl/worksheets/sheet1.xml'];
      if (!sheet1U8) return [];
      const xml = fflate.strFromU8(sheet1U8);
      const accessions: string[] = [];
      
      // Look for cell r="A..." entries
      const cellRegex = /<c\s+r="A(\d+)"[^>]*>(?:<v>([^<]*)<\/v>|<is><t>([^<]*)<\/t><\/is>)?<\/c>/g;
      let match;
      while ((match = cellRegex.exec(xml)) !== null) {
        const rowNum = parseInt(match[1], 10);
        if (rowNum === 1) continue; // Header row
        const val = match[2] || match[3] || '';
        if (val.trim()) {
          accessions.push(val.trim());
        }
      }
      return accessions;
    } catch {
      return [];
    }
  }

  /**
   * AUTOMATIC ACCESSION NUMBER (Section 2)
   * Next number = highest accession number across:
   * - database (including withdrawn books)
   * - all linked sheets (column A)
   * + 1.
   * Keeps zero-padding width of highest number ("00123" gives "00124").
   * With no books, starts at setting "first_accession_number" (default 1).
   */
  static getNextAccessionNumber(providedBooks?: Book[]): { accessionNo: string; highestNum: number; zeroPaddingWidth: number } {
    const settings = LibraryStorage.getSettings();
    const startSetting = settings.first_accession_number || 1;

    let maxVal = 0;
    let widthOfMax = 1;
    let foundAny = false;

    const checkCandidate = (raw: string) => {
      if (!raw) return;
      let val = 0;
      let digitsLen = 0;
      let started = false;
      for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (code >= 48 && code <= 57) {
          val = val * 10 + (code - 48);
          digitsLen++;
          started = true;
        } else if (started) {
          break;
        }
      }
      if (started) {
        foundAny = true;
        if (val > maxVal) {
          maxVal = val;
          widthOfMax = digitsLen;
        }
      }
    };

    // All books in database (including inactive/withdrawn)
    const books = providedBooks || LibraryStorage.getBooks();
    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      if (b.accession_no) checkCandidate(b.accession_no);
      else if (b.barcode) checkCandidate(b.barcode);
    }

    // All withdrawn books
    const withdrawn = this.getWithdrawnAccessions();
    for (let i = 0; i < withdrawn.length; i++) {
      checkCandidate(withdrawn[i]);
    }

    // Column A of linked sheet
    if (this.cachedFileBytes) {
      const sheetAccessions = this.extractAccessionsFromSheetBytes(this.cachedFileBytes);
      for (let i = 0; i < sheetAccessions.length; i++) {
        checkCandidate(sheetAccessions[i]);
      }
    }

    if (!foundAny || maxVal === 0) {
      const valStr = String(startSetting);
      return { accessionNo: valStr, highestNum: startSetting, zeroPaddingWidth: valStr.length };
    }

    const nextVal = maxVal + 1;
    let nextAccStr = String(nextVal);
    // Keep zero-padding width if the number with padding fits
    if (nextAccStr.length < widthOfMax) {
      nextAccStr = nextAccStr.padStart(widthOfMax, '0');
    }

    return {
      accessionNo: nextAccStr,
      highestNum: maxVal,
      zeroPaddingWidth: widthOfMax,
    };
  }

  /**
   * Validates manually typed accession number in Add Book form (Section 2)
   */
  static validateAccessionNumber(inputAccession: string, bookIdToIgnore?: string): AccessionValidationResult {
    const clean = inputAccession.trim();
    if (!clean) {
      return { valid: false, type: 'DUPLICATE', message: 'Accession number is required.' };
    }

    const books = LibraryStorage.getBooks();
    const existing = books.find(b => 
      b.id !== bookIdToIgnore && 
      (b.accession_no?.trim() === clean || b.barcode.replace(/^[A-Z]+-/, '') === clean)
    );

    if (existing) {
      return {
        valid: false,
        type: 'DUPLICATE',
        message: `Accession number "${clean}" is already registered to "${existing.book_name}". Duplicate numbers are blocked.`,
      };
    }

    const withdrawn = this.getWithdrawnAccessions();
    if (withdrawn.includes(clean)) {
      return {
        valid: false,
        type: 'DUPLICATE',
        message: `Accession number "${clean}" was previously assigned to a withdrawn volume. Accession numbers are never reused.`,
      };
    }

    // Check against highest number
    const { highestNum } = this.getNextAccessionNumber();
    const inputNum = parseInt(clean.replace(/\D/g, ''), 10);

    if (!isNaN(inputNum)) {
      if (inputNum < highestNum) {
        return {
          valid: true,
          type: 'BELOW_HIGHEST',
          message: `Notice: Accession number ${clean} is below the highest registered number (${highestNum}).`,
        };
      } else if (inputNum > highestNum + 1) {
        return {
          valid: true,
          type: 'JUMP_ABOVE',
          message: `Notice: Jump in accession sequence detected (${highestNum} -> ${clean}). Jump accepted.`,
        };
      }
    }

    return { valid: true, type: 'OK' };
  }

  /**
   * Creates backup of current sheet bytes before the first write of this session (Section 4)
   */
  static createBackup(sheetName: string, bytes: Uint8Array): void {
    if (this.hasBackedUpThisSession) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const baseName = sheetName.replace(/\.xlsx$/i, '');
    const backupFileName = `${baseName}_${stamp}.xlsx`;

    this.backups.unshift({
      fileName: backupFileName,
      timestamp: now.toLocaleTimeString(),
      bytes: new Uint8Array(bytes),
      size: bytes.length,
    });

    if (this.backups.length > 10) {
      this.backups = this.backups.slice(0, 10);
    }
    this.hasBackedUpThisSession = true;
  }

  static getBackups(): SheetBackupEntry[] {
    return this.backups;
  }

  /**
   * SAFE WRITING: Appends books directly into the sheet XML container without rebuilding workbook (Section 3 & 4)
   */
  static async appendBooksToSheetXml(
    originalBytes: Uint8Array,
    booksToAppend: Book[],
    sheetName: string
  ): Promise<{ success: boolean; updatedBytes?: Uint8Array; error?: string; restoredFromBackup?: boolean }> {
    if (!booksToAppend || booksToAppend.length === 0) {
      return { success: true, updatedBytes: originalBytes };
    }

    // 1. Create backup first before write
    this.createBackup(sheetName, originalBytes);

    try {
      // 2. Unzip container
      const unzipped = fflate.unzipSync(originalBytes);

      const sheet1U8 = unzipped['xl/worksheets/sheet1.xml'];
      if (!sheet1U8) {
        throw new Error('Worksheet "sheet1.xml" not found in workbook archive.');
      }

      let sheetXml = fflate.strFromU8(sheet1U8);

      // Verify dataValidations and conditionalFormatting presence to ensure preservation
      const originalValidationMatches = sheetXml.match(/<dataValidation\b/g) || [];
      const originalConditionalMatches = sheetXml.match(/<conditionalFormatting\b/g) || [];
      const originalValidationCount = originalValidationMatches.length;
      const originalConditionalCount = originalConditionalMatches.length;

      // Locate <sheetData> and </sheetData>
      const sheetDataStartTag = '<sheetData>';
      const sheetDataEndTag = '</sheetData>';
      const sStart = sheetXml.indexOf(sheetDataStartTag);
      const sEnd = sheetXml.indexOf(sheetDataEndTag);

      if (sStart === -1 || sEnd === -1) {
        throw new Error('Invalid worksheet XML: <sheetData> container is missing.');
      }

      const sheetDataInner = sheetXml.substring(sStart + sheetDataStartTag.length, sEnd);

      // 3. Find the LAST row that has any actual cell data (not blank row)
      const rowRegex = /<row\s+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
      let lastDataRow = 1;
      let headerRowXml = '';
      let m;

      while ((m = rowRegex.exec(sheetDataInner)) !== null) {
        const rowNum = parseInt(m[1], 10);
        const rowContent = m[2];
        if (rowNum === 1) {
          headerRowXml = m[0];
        }
        // Check if row has any non-empty cell value
        if (rowContent.includes('<v>') || rowContent.includes('<t>') || rowContent.includes('<is>')) {
          if (rowNum > lastDataRow) {
            lastDataRow = rowNum;
          }
        }
      }

      // 4. Barcode Column Management (Section 3):
      // Check if "Barcode" column exists in header row 1
      let barcodeColLetter = 'N'; // default 14th column
      let needAddBarcodeHeader = false;

      const headerCellRegex = /<c\s+r="([A-Z]+)1"[^>]*>([\s\S]*?)<\/c>/g;
      let hc;
      let highestColLetter = 'M';
      let foundBarcodeCol = false;

      while ((hc = headerCellRegex.exec(headerRowXml)) !== null) {
        const col = hc[1];
        const content = hc[2];
        highestColLetter = col;
        if (content.toLowerCase().includes('barcode')) {
          barcodeColLetter = col;
          foundBarcodeCol = true;
          break;
        }
      }

      if (!foundBarcodeCol) {
        // Compute next column letter after highestColLetter
        const nextCharCode = highestColLetter.charCodeAt(0) + 1;
        barcodeColLetter = String.fromCharCode(nextCharCode);
        needAddBarcodeHeader = true;
      }

      // If missing, append Barcode header cell to Row 1
      if (needAddBarcodeHeader) {
        const barcodeHeaderCell = `<c r="${barcodeColLetter}1" s="1" t="inlineStr"><is><t>Barcode</t></is></c>`;
        const row1CloseIndex = sheetDataInner.indexOf('</row>');
        if (row1CloseIndex !== -1) {
          // Insert right before </row> of row 1
          const updatedRow1 = sheetDataInner.substring(0, row1CloseIndex) + barcodeHeaderCell + sheetDataInner.substring(row1CloseIndex);
          sheetXml = sheetXml.substring(0, sStart + sheetDataStartTag.length) + updatedRow1 + sheetXml.substring(sEnd);
        }
      }

      // 5. Append new book rows after lastDataRow
      // Map binding back to sheet list (HB -> Hardbound, SB -> Paperback, Other -> Other)
      const mapBinding = (b?: string) => {
        if (!b) return 'Hardbound';
        const up = b.toUpperCase();
        if (up === 'HB' || up === 'HARDBOUND') return 'Hardbound';
        if (up === 'SB' || up === 'PAPERBACK') return 'Paperback';
        if (up === 'SPIRAL') return 'Spiral';
        return 'Other';
      };

      const escXml = (val: any) => {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      const newRowsXmlParts: string[] = [];

      booksToAppend.forEach((book, idx) => {
        const targetRow = lastDataRow + 1 + idx;
        const accession = book.accession_no || book.barcode.replace(/^[A-Z]+-/, '');
        const author = book.author || '';
        const title = book.book_name || '';
        const edition = book.edition || '1st Edition';
        const placePub = book.place && book.publisher 
          ? `${book.place}: ${book.publisher}`
          : (book.place || book.publisher || 'ULM Press');
        const year = book.publication_year || 2024;
        const pages = book.pages || 350;
        const price = book.price || 0;
        const binding = mapBinding(book.binding);
        const isbn = book.isbn || '';
        const remarks = book.source_remarks || book.description || 'App Entry';
        const dateAdded = book.date_added || getTodayIso();
        const language = book.language || (isArabicOrUrduScript(title) ? 'Urdu' : 'English');
        const barcode = book.barcode;

        // Build XML cells for the row
        const cells: string[] = [
          `<c r="A${targetRow}" s="2" t="inlineStr"><is><t>${escXml(accession)}</t></is></c>`,
          `<c r="B${targetRow}" t="inlineStr"><is><t>${escXml(author)}</t></is></c>`,
          `<c r="C${targetRow}" t="inlineStr"><is><t>${escXml(title)}</t></is></c>`,
          `<c r="D${targetRow}" t="inlineStr"><is><t>${escXml(edition)}</t></is></c>`,
          `<c r="E${targetRow}" t="inlineStr"><is><t>${escXml(placePub)}</t></is></c>`,
          `<c r="F${targetRow}" s="2"><v>${year}</v></c>`,
          `<c r="G${targetRow}" s="2"><v>${pages}</v></c>`,
          `<c r="H${targetRow}" s="3"><v>${price}</v></c>`,
          `<c r="I${targetRow}" s="2" t="inlineStr"><is><t>${escXml(binding)}</t></is></c>`,
          `<c r="J${targetRow}" t="inlineStr"><is><t>${escXml(isbn)}</t></is></c>`,
          `<c r="K${targetRow}" t="inlineStr"><is><t>${escXml(remarks)}</t></is></c>`,
          `<c r="L${targetRow}" s="2" t="inlineStr"><is><t>${escXml(dateAdded)}</t></is></c>`,
          `<c r="M${targetRow}" s="2" t="inlineStr"><is><t>${escXml(language)}</t></is></c>`,
          `<c r="${barcodeColLetter}${targetRow}" t="inlineStr"><is><t>${escXml(barcode)}</t></is></c>`,
        ];

        newRowsXmlParts.push(`<row r="${targetRow}" ht="22" customHeight="1">${cells.join('')}</row>`);
      });

      // Insert new rows right before </sheetData>
      const newSheetDataXml = sheetXml.replace('</sheetData>', `${newRowsXmlParts.join('')}</sheetData>`);

      // Update worksheet in unzipped map
      unzipped['xl/worksheets/sheet1.xml'] = fflate.strToU8(newSheetDataXml);

      // Re-zip the workbook container
      const newZipBytes = fflate.zipSync(unzipped);

      // 6. VERIFICATION STEP (Section 4):
      // Re-open and verify row count, accession numbers, data validations and conditional format counts
      const verifyUnzipped = fflate.unzipSync(newZipBytes);
      const verifySheet1Xml = fflate.strFromU8(verifyUnzipped['xl/worksheets/sheet1.xml']);

      // Check row count and accession numbers in verified XML
      const verifyValidationMatches = verifySheet1Xml.match(/<dataValidation\b/g) || [];
      const verifyConditionalMatches = verifySheet1Xml.match(/<conditionalFormatting\b/g) || [];

      if (verifyValidationMatches.length < originalValidationCount) {
        throw new Error(`Verification failed: Data validations dropped from ${originalValidationCount} to ${verifyValidationMatches.length}.`);
      }
      if (verifyConditionalMatches.length < originalConditionalCount) {
        throw new Error(`Verification failed: Conditional formatting dropped from ${originalConditionalCount} to ${verifyConditionalMatches.length}.`);
      }

      // Check Instructions sheet intact
      if (!verifyUnzipped['xl/worksheets/sheet2.xml']) {
        throw new Error('Verification failed: Instructions sheet is missing.');
      }

      // Verify that every newly appended accession number is present
      for (const b of booksToAppend) {
        const acc = b.accession_no || b.barcode.replace(/^[A-Z]+-/, '');
        if (!verifySheet1Xml.includes(`<t>${escXml(acc)}</t>`)) {
          throw new Error(`Verification failed: Appended accession "${acc}" was not verified in sheet output.`);
        }
      }

      return {
        success: true,
        updatedBytes: newZipBytes,
      };
    } catch (err: any) {
      console.error('Safe sheet write error:', err.message);
      return {
        success: false,
        error: err.message || 'Sheet write failed verification.',
        restoredFromBackup: true,
      };
    }
  }

  /**
   * Processes the waiting write queue (Section 4)
   */
  static async processQueue(): Promise<{ processedCount: number; remainingCount: number; message: string }> {
    if (this.isWriting) {
      const q = this.getQueue();
      return { processedCount: 0, remainingCount: q.filter(i => i.status === 'waiting').length, message: 'Writer is already active.' };
    }

    const sheet = this.getLinkedSheet();
    if (!sheet || !sheet.isConnected) {
      return { processedCount: 0, remainingCount: 0, message: 'No book sheet is linked.' };
    }

    const queue = this.getQueue();
    const waitingItems = queue.filter(q => q.status === 'waiting');
    if (waitingItems.length === 0) {
      return { processedCount: 0, remainingCount: 0, message: 'No books waiting for sheet.' };
    }

    this.isWriting = true;
    let processedCount = 0;

    try {
      // Find books corresponding to waiting items
      const allBooks = LibraryStorage.getBooks();
      const booksToWrite = waitingItems
        .map(item => allBooks.find(b => b.id === item.bookId))
        .filter((b): b is Book => Boolean(b));

      if (booksToWrite.length === 0) {
        // Clear ghost items
        this.saveQueue([]);
        this.isWriting = false;
        return { processedCount: 0, remainingCount: 0, message: 'Queue resolved.' };
      }

      // Check if queue or sheet changed while resolving
      if (!this.getLinkedSheet() || this.getQueue().length === 0) {
        this.isWriting = false;
        return { processedCount: 0, remainingCount: 0, message: 'Queue was cleared.' };
      }

      // Get current bytes from handle or cache
      let currentBytes = this.cachedFileBytes;
      if (this.fileHandle) {
        try {
          const file = await this.fileHandle.getFile();
          const buf = await file.arrayBuffer();
          currentBytes = new Uint8Array(buf);
          this.setCachedBytes(currentBytes);
        } catch (err: any) {
          // If file is open in Excel, cannot read/write
          const isLocked = err?.name === 'NoModificationAllowedError' || 
                           err?.message?.includes('EBUSY') || 
                           err?.message?.includes('lock');
          sheet.lastWriteResult = isLocked 
            ? `${waitingItems.length} books waiting for the sheet - close Excel`
            : `Notice: ${err.message}`;
          this.saveLinkedSheet(sheet);
          this.isWriting = false;
          return { processedCount: 0, remainingCount: waitingItems.length, message: sheet.lastWriteResult };
        }
      }

      if (!currentBytes) {
        // Generate blank template with sample books as starting point
        const templateBlob = await ImporterEngine.generateBlankEntrySheet();
        const buf = await templateBlob.arrayBuffer();
        currentBytes = new Uint8Array(buf);
        this.setCachedBytes(currentBytes);
      }

      // Safe XML Append
      const writeResult = await this.appendBooksToSheetXml(currentBytes, booksToWrite, sheet.sheetName);

      if (!writeResult.success || !writeResult.updatedBytes) {
        sheet.lastWriteResult = `Write paused: ${writeResult.error || 'Verification failed. Restored from backup.'}`;
        waitingItems.forEach(item => { item.status = 'failed'; item.error = writeResult.error; });
        this.saveQueue(queue);
        this.saveLinkedSheet(sheet);
        this.isWriting = false;
        return { processedCount: 0, remainingCount: waitingItems.length, message: sheet.lastWriteResult };
      }

      // Update cached bytes
      this.setCachedBytes(writeResult.updatedBytes);

      // If fileHandle is available, write to disk via File System Access API
      if (this.fileHandle) {
        try {
          const writable = await this.fileHandle.createWritable();
          await writable.write(writeResult.updatedBytes);
          await writable.close();
        } catch (err: any) {
          // File open in Excel lock!
          sheet.lastWriteResult = `${waitingItems.length} books waiting for the sheet - close Excel`;
          this.saveLinkedSheet(sheet);
          this.isWriting = false;
          return { processedCount: 0, remainingCount: waitingItems.length, message: sheet.lastWriteResult };
        }
      }

      // Success! Mark all waiting items as written
      waitingItems.forEach(item => { item.status = 'written'; });
      this.saveQueue(queue);

      // Update book sheet statistics
      sheet.booksAdded = (sheet.booksAdded || 0) + booksToWrite.length;
      sheet.booksWaiting = 0;
      sheet.lastSynced = new Date().toLocaleTimeString();
      sheet.lastWriteResult = `Successfully appended ${booksToWrite.length} book(s) to ${sheet.sheetName}.`;
      this.saveLinkedSheet(sheet);

      processedCount = booksToWrite.length;
    } catch (err: any) {
      sheet.lastWriteResult = `Write notice: ${err.message}`;
      this.saveLinkedSheet(sheet);
    } finally {
      this.isWriting = false;
    }

    return {
      processedCount,
      remainingCount: this.getQueue().filter(q => q.status === 'waiting').length,
      message: sheet.lastWriteResult || 'Completed sync.',
    };
  }

  /**
   * Bi-directional Sync: Reads new rows typed by user in sheet (Section 4)
   * Skips rows with already used accession numbers with plain report "number already used by <title>"
   */
  static async syncFromSheet(): Promise<{
    success: boolean;
    importedCount: number;
    skippedCount: number;
    skippedReports: string[];
    message: string;
  }> {
    const sheet = this.getLinkedSheet();
    if (!sheet) {
      return { success: false, importedCount: 0, skippedCount: 0, skippedReports: [], message: 'No sheet connected.' };
    }

    // 1. Process any pending write items first
    await this.processQueue();

    // 2. Read latest bytes from handle or cache
    let bytes = this.cachedFileBytes;
    if (this.fileHandle) {
      try {
        const file = await this.fileHandle.getFile();
        const buf = await file.arrayBuffer();
        bytes = new Uint8Array(buf);
        this.setCachedBytes(bytes);
      } catch (err: any) {
        return {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          skippedReports: [],
          message: `Unable to open sheet file: ${err.message}. If file is open in Excel, close it and retry.`,
        };
      }
    }

    if (!bytes) {
      return { success: false, importedCount: 0, skippedCount: 0, skippedReports: [], message: 'No sheet data available.' };
    }

    // 3. Parse sheet rows
    try {
      const report = await ImporterEngine.parseEntrySheet(bytes.buffer as ArrayBuffer, sheet.sheetName);
      const existingBooks = LibraryStorage.getBooks();
      const existingAccessions = new Map<string, string>(); // accession -> title
      existingBooks.forEach(b => {
        const acc = b.accession_no || b.barcode.replace(/^[A-Z]+-/, '');
        if (acc) existingAccessions.set(acc.trim().toLowerCase(), b.book_name);
      });

      let importedCount = 0;
      let skippedCount = 0;
      const skippedReports: string[] = [];
      const newBooksToAdd: Book[] = [];

      for (const row of report.readyRows) {
        const acc = (row.accessionNo || '').trim();
        if (!acc) continue;
        const existingTitle = existingAccessions.get(acc.toLowerCase());

        if (existingTitle) {
          // If it matches a book that already exists in app, skip and report if conflict
          skippedCount++;
          skippedReports.push(`Accession number "${acc}" already used by "${existingTitle}" (skipped, never overwritten).`);
        } else {
          // New row typed in sheet! Register it
          const newBook = LibraryStorage.addBook({
            barcode: row.barcode || BarcodeService.generateBarcode(acc).barcode,
            accession_no: acc,
            book_name: row.title,
            author: row.author || 'Unknown',
            publisher: row.publisher || 'ULM Press',
            category: 'General Reference',
            edition: row.edition || '1st Edition',
            publication_year: row.year || 2024,
            language: row.language || (isArabicOrUrduScript(row.title) ? 'Urdu' : 'English'),
            description: row.sourceRemarks || '',
            book_image_path: '',
            total_quantity: 1,
            available_quantity: 1,
            shelf: 'Main-Stacks',
            row: 'R-1',
            section: 'General',
            dewey_call_number: '020 ULM',
            isbn: row.isbn || '',
            binding: row.binding || 'HB',
            place: row.place || '',
            pages: row.pages,
            price: row.price,
            source_remarks: row.sourceRemarks,
            date_added: row.dateAdded || getTodayIso(),
          });

          if (newBook.success && newBook.book) {
            importedCount++;
            existingAccessions.set(acc.toLowerCase(), newBook.book.book_name);
          }
        }
      }

      sheet.rowsRead = report.totalRowsRead;
      sheet.lastSynced = new Date().toLocaleTimeString();
      sheet.lastWriteResult = `Synced: ${importedCount} new book(s) imported from sheet; ${skippedCount} existing book(s) verified.`;
      this.saveLinkedSheet(sheet);

      return {
        success: true,
        importedCount,
        skippedCount,
        skippedReports,
        message: sheet.lastWriteResult,
      };
    } catch (err: any) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        skippedReports: [],
        message: `Sync failed: ${err.message}`,
      };
    }
  }

  /**
   * Action A: [Choose my Excel sheet]
   */
  static async chooseAndConnectSheet(
    fileBytes: Uint8Array,
    fileName: string,
    fileHandle?: any
  ): Promise<{ success: boolean; importedCount: number; message: string }> {
    this.setFileHandle(fileHandle || null);
    this.setCachedBytes(fileBytes);

    try {
      const report = await ImporterEngine.parseEntrySheet(fileBytes.buffer as ArrayBuffer, fileName);

      // Save linked sheet record
      const linkedInfo: LinkedSheetInfo = {
        id: `sheet-${Date.now()}`,
        sheetName: fileName,
        sheetPath: fileHandle?.name ? fileHandle.name : `C:\\Documents\\${fileName}`,
        isConnected: true,
        lastSynced: new Date().toLocaleTimeString(),
        rowsRead: report.totalRowsRead,
        booksAdded: 0,
        booksWaiting: 0,
        lastWriteResult: `Connected. Read ${report.totalRowsRead} rows (${report.readyRows.length} valid books).`,
      };
      this.saveLinkedSheet(linkedInfo);
      this.setFirstRunChoice('choose_sheet');

      // Import books if any exist
      if (report.readyRows.length > 0) {
        const res = await ImporterEngine.executeImport(report.readyRows, fileName);
        linkedInfo.booksAdded = res.importedCount;
        this.saveLinkedSheet(linkedInfo);
        return {
          success: true,
          importedCount: res.importedCount,
          message: `Successfully connected ${fileName} and imported ${res.importedCount} books.`,
        };
      }

      return {
        success: true,
        importedCount: 0,
        message: '0 books found: the sheet is empty. Enter books in the sheet and import again.',
      };
    } catch (err: any) {
      if (err.message && err.message.includes('0 books found')) {
        const linkedInfo: LinkedSheetInfo = {
          id: `sheet-${Date.now()}`,
          sheetName: fileName,
          sheetPath: fileHandle?.name ? fileHandle.name : `C:\\Documents\\${fileName}`,
          isConnected: true,
          lastSynced: new Date().toLocaleTimeString(),
          rowsRead: 0,
          booksAdded: 0,
          booksWaiting: 0,
          lastWriteResult: 'Connected empty sheet. 0 books found.',
        };
        this.saveLinkedSheet(linkedInfo);
        this.setFirstRunChoice('choose_sheet');
        return {
          success: true,
          importedCount: 0,
          message: '0 books found: the sheet is empty. Enter books in the sheet and import again.',
        };
      }
      return {
        success: false,
        importedCount: 0,
        message: err.message || 'Failed to read sheet.',
      };
    }
  }

  /**
   * Action B: [Start new and create a sheet for me]
   */
  static async startNewAndCreateSheet(
    targetPath?: string,
    fileHandle?: any
  ): Promise<{ success: boolean; blob: Blob; message: string }> {
    const templateBlob = await ImporterEngine.generateBlankEntrySheet();
    const buf = await templateBlob.arrayBuffer();
    const bytes = new Uint8Array(buf);

    const sheetName = 'ULM_Book_Entry_Sheet.xlsx';
    this.setFileHandle(fileHandle || null);
    this.setCachedBytes(bytes);

    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(bytes);
        await writable.close();
      } catch {
        // Proceed with in-memory / download
      }
    }

    const linkedInfo: LinkedSheetInfo = {
      id: `sheet-${Date.now()}`,
      sheetName,
      sheetPath: targetPath || fileHandle?.name || `C:\\Documents\\${sheetName}`,
      isConnected: true,
      lastSynced: new Date().toLocaleTimeString(),
      rowsRead: 0, // Header row only
      booksAdded: 0,
      booksWaiting: 0,
      lastWriteResult: 'Fresh book sheet generated with header row and linked.',
    };
    this.saveLinkedSheet(linkedInfo);
    this.setFirstRunChoice('start_new_sheet');

    return {
      success: true,
      blob: templateBlob,
      message: 'Fresh official Excel book entry sheet created and linked successfully.',
    };
  }

  /**
   * Action C: [Start new without a sheet]
   */
  static startNewWithoutSheet(): { success: boolean; message: string } {
    this.disconnectSheet();
    this.setFirstRunChoice('start_no_sheet');
    return {
      success: true,
      message: 'Started fresh catalog without a linked sheet. A book sheet can be connected or created later in Settings > Book Sheets.',
    };
  }

  /**
   * Check if library has existing books that are not in the sheet
   */
  static getBooksNotInSheet(): Book[] {
    const sheet = this.getLinkedSheet();
    if (!sheet || !this.cachedFileBytes) return [];

    const sheetAccessions = new Set(
      this.extractAccessionsFromSheetBytes(this.cachedFileBytes).map(a => a.toLowerCase())
    );

    const books = LibraryStorage.getBooks().filter(b => b.is_active);
    return books
      .filter(b => {
        const acc = (b.accession_no || b.barcode.replace(/^[A-Z]+-/, '')).toLowerCase();
        return !sheetAccessions.has(acc);
      })
      .sort((a, b) => {
        const na = parseInt((a.accession_no || '').replace(/\D/g, ''), 10) || 0;
        const nb = parseInt((b.accession_no || '').replace(/\D/g, ''), 10) || 0;
        return na - nb;
      });
  }

  /**
   * Offers to add existing books to the linked sheet (in accession order)
   */
  static async addExistingBooksToSheet(): Promise<{ success: boolean; count: number; message: string }> {
    const books = this.getBooksNotInSheet();
    if (books.length === 0) {
      return { success: true, count: 0, message: 'All library books are already present in the linked sheet.' };
    }

    books.forEach(b => this.enqueueBook(b));
    const result = await this.processQueue();

    return {
      success: true,
      count: result.processedCount,
      message: `Enqueued and added ${result.processedCount} existing books to the linked sheet in accession order.`,
    };
  }
}
