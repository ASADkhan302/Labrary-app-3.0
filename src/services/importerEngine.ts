import ExcelJS from 'exceljs';
import { Book, ImportBatchRecord } from '../types/library';
import { LibraryStorage } from './storage';
import { BarcodeService } from './barcodeService';
import { UsbBackupService } from './usbBackupService';
import { getTodayIso, normalizeDateAdded } from '../utils/dateUtils';
import { isArabicOrUrduScript, sanitizeBidiOverrides, normalizeUrduForSearch } from '../utils/urduUtils';
import { AlmariService } from './almariService';

// ============================================================================
// CONSTANTS & SAFETY LIMITS (Section 2)
// ============================================================================
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_ROWS = 100_000;
export const ZIP_BOMB_MAX_UNCOMPRESSED = 500 * 1024 * 1024; // 500 MB
export const ZIP_BOMB_MAX_ENTRIES = 500;

export const TEXT_LIMITS = {
  TITLE: 500,
  AUTHOR: 300,
  PUBLISHER: 300,
  REMARKS: 1000,
  DEFAULT: 100,
};

export type RowResultType = 'READY' | 'ERROR' | 'DUPLICATE' | 'WARNING';

export interface RowProblem {
  excelRowNumber: number;
  accessionNo: string;
  type: 'ERROR' | 'DUPLICATE' | 'WARNING';
  field?: string;
  message: string;
}

export interface CleanedBookRow {
  excelRowNumber: number;
  accessionNo: string;
  author: string;
  title: string;
  edition: string;
  place: string;
  publisher: string;
  year: number;
  pages: number;
  price: number;
  binding: string;
  bindingOriginal: string;
  isbn: string;
  sourceRemarks: string;
  dateAdded: string;
  language: string;
  barcode: string;
  group?: string;
  groupId?: string | null;
  almariId?: string | null;
  shelfNo?: number | null;
  warnings: string[];
}

export interface ImportPreviewReport {
  fileName: string;
  fileSizeBytes: number;
  totalRowsRead: number;
  readyToImportCount: number;
  duplicatesInFileCount: number;
  alreadyInLibraryCount: number;
  errorsCount: number;
  warningsCount: number;
  blankAuthorCount: number;
  urduCount: number;
  englishCount: number;
  leadingZerosCount: number;
  unknownHeaders: string[];
  problems: RowProblem[];
  readyRows: CleanedBookRow[];
}

export interface ImportExecutionResult {
  success: boolean;
  batchId?: string;
  importedCount: number;
  skippedCount: number;
  warningsCount: number;
  message: string;
  bookIds: string[];
}

export interface UndoImportResult {
  success: boolean;
  batchId: string;
  removedCount: number;
  retainedCount: number;
  retainedBooksWithHistory: string[];
  message: string;
}

// ============================================================================
// SHARED IMPORTER ENGINE CLASS
// ============================================================================
export class ImporterEngine {
  /**
   * Validates file signature (magic bytes) to strictly allow .xlsx and reject .xlsm, .xls, .exe
   */
  static validateFileSignature(buffer: ArrayBuffer, fileName: string): { valid: boolean; error?: string } {
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds the 50 MB limit (${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB).`,
      };
    }

    if (buffer.byteLength < 4) {
      return { valid: false, error: 'File is empty or corrupted (too small).' };
    }

    const uint8 = new Uint8Array(buffer);

    // 1. Check for executable header (MZ)
    if (uint8[0] === 0x4D && uint8[1] === 0x5A) {
      return { valid: false, error: 'Security rejection: Executable (.exe) or binary file detected.' };
    }

    // 2. Check for legacy Excel 97-2003 OLE2 (.xls)
    if (uint8[0] === 0xD0 && uint8[1] === 0xCF && uint8[2] === 0x11 && uint8[3] === 0xE0) {
      return {
        valid: false,
        error: 'Legacy Excel format (.xls) detected. Please open the file in Excel and save as modern Excel Workbook (.xlsx).',
      };
    }

    // 3. Must be PK ZIP container (0x50, 0x4B, 0x03, 0x04)
    const isZip = uint8[0] === 0x50 && uint8[1] === 0x4B;
    if (!isZip) {
      return {
        valid: false,
        error: `Invalid file signature: "${fileName}" is not a valid Excel (.xlsx) workbook.`,
      };
    }

    // 4. Quick inspection for macro-enabled workbook (.xlsm)
    // VBA project binary inside zip container has "vbaProject.bin" string
    const sample = new TextDecoder('latin1').decode(uint8.slice(0, Math.min(uint8.length, 65536)));
    if (sample.includes('vbaProject.bin') || fileName.toLowerCase().endsWith('.xlsm')) {
      return {
        valid: false,
        error: 'Security rejection: Macro-enabled workbook (.xlsm) detected. Only standard macro-free .xlsx files are permitted.',
      };
    }

    return { valid: true };
  }

  /**
   * Sanitizes all cell text: removes control characters, zero-width spaces, and bidi overrides
   */
  static cleanCellText(val: unknown): string {
    if (val === null || val === undefined) return '';

    let text = '';
    if (typeof val === 'object') {
      // ExcelJS may return rich text object or formula result
      const obj = val as any;
      if (obj.result !== undefined) {
        text = String(obj.result ?? '');
      } else if (Array.isArray(obj.richText)) {
        text = obj.richText.map((t: any) => t.text || '').join('');
      } else if (obj.text !== undefined) {
        text = String(obj.text);
      } else {
        text = String(val);
      }
    } else {
      text = String(val);
    }

    // 1. Strip bidi overrides (\u202A-\u202E, \u2066-\u2069)
    text = sanitizeBidiOverrides(text);

    // 2. Strip zero-width chars and byte order marks
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // 3. Strip ASCII control characters except \t and \n
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return text.trim();
  }

  /**
   * Parses and validates a Book Entry Sheet buffer, returning an interactive preview report
   */
  static async parseEntrySheet(
    buffer: ArrayBuffer,
    fileName: string,
    onProgress?: (pct: number, stage: string) => void
  ): Promise<ImportPreviewReport> {
    onProgress?.(5, 'Validating Excel package signature...');

    const sigCheck = this.validateFileSignature(buffer, fileName);
    if (!sigCheck.valid) {
      throw new Error(sigCheck.error);
    }

    onProgress?.(15, 'Loading Excel workbook data...');

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('EBUSY') || msg.includes('locked')) {
        throw new Error('Close Excel or save a copy of the file and choose the copy.');
      }
      throw new Error(`Failed to parse Excel workbook: ${msg}`);
    }

    // 1. Read the first sheet (match columns by header name, not by column position)
    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      throw new Error('0 books found: the sheet is empty. Enter books in the sheet and import again.');
    }

    onProgress?.(30, 'Mapping column headers...');

    // Read header row (Row 1)
    const headerRow = worksheet.getRow(1);
    const colMap: Record<string, number> = {};
    const unknownHeaders: string[] = [];

    const KNOWN_HEADER_KEYS: Record<string, string> = {
      'accession no': 'accession',
      'accession no.': 'accession',
      'accession number': 'accession',
      'accession': 'accession',
      'author': 'author',
      'title': 'title',
      'book title': 'title',
      'edition': 'edition',
      'place & publisher': 'place_publisher',
      'place and publisher': 'place_publisher',
      'place / publisher': 'place_publisher',
      'place/publisher': 'place_publisher',
      'publisher': 'publisher',
      'place': 'place',
      'year': 'year',
      'publication year': 'year',
      'pages': 'pages',
      'price (rs/ps)': 'price',
      'price (rs)': 'price',
      'price': 'price',
      'binding': 'binding',
      'isbn': 'isbn',
      'source / remarks': 'remarks',
      'source and remarks': 'remarks',
      'source/remarks': 'remarks',
      'source': 'remarks',
      'remarks': 'remarks',
      'date added': 'date_added',
      'date': 'date_added',
      'language': 'language',
      'group': 'group',
      'book group': 'group',
    };

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const rawText = this.cleanCellText(cell.value).toLowerCase().replace(/\s+/g, ' ').trim();
      const mapped = KNOWN_HEADER_KEYS[rawText];
      if (mapped) {
        colMap[mapped] = colNumber;
      } else if (rawText) {
        unknownHeaders.push(this.cleanCellText(cell.value));
      }
    });

    // Verify required header: Title
    if (!colMap['title']) {
      throw new Error('Missing required column header: "Title". Please verify your entry sheet.');
    }

    onProgress?.(45, 'Scanning catalog records & detecting duplicates...');

    // Load active library books for duplicate checks
    const activeBooks = LibraryStorage.getBooks().filter(b => b.is_active);
    const existingBarcodes = new Set(activeBooks.map(b => b.barcode.trim().toUpperCase()));
    const existingAccessions = new Set<string>();

    for (const b of activeBooks) {
      if (b.accession_no) {
        existingAccessions.add(b.accession_no.trim().toLowerCase());
        const num = parseInt(b.accession_no, 10);
        if (!isNaN(num)) existingAccessions.add(String(num));
      }
      // Also check barcode extraction
      const match = b.barcode.match(/\d+/);
      if (match) {
        existingAccessions.add(match[0].toLowerCase());
        existingAccessions.add(String(parseInt(match[0], 10)));
      }
    }

    const seenInFileAccessions = new Set<string>();
    const problems: RowProblem[] = [];
    const readyRows: CleanedBookRow[] = [];

    let duplicatesInFileCount = 0;
    let alreadyInLibraryCount = 0;
    let errorsCount = 0;
    let warningsCount = 0;
    let blankAuthorCount = 0;
    let urduCount = 0;
    let englishCount = 0;
    let leadingZerosCount = 0;
    let totalRowsRead = 0;

    const rowCount = worksheet.rowCount;
    const today = getTodayIso();

    for (let r = 2; r <= rowCount; r++) {
      if (totalRowsRead >= MAX_ROWS) {
        problems.push({
          excelRowNumber: r,
          accessionNo: 'LIMIT',
          type: 'ERROR',
          message: `Import exceeded maximum limit of ${MAX_ROWS.toLocaleString()} rows. Subsequent rows skipped.`,
        });
        errorsCount++;
        break;
      }

      const row = worksheet.getRow(r);
      const rawTitle = colMap['title'] ? this.cleanCellText(row.getCell(colMap['title']).value) : '';

      // Ignore completely blank rows (rows where every mapped cell is empty)
      const hasAnyData = Object.values(colMap).some(colIdx => {
        const val = this.cleanCellText(row.getCell(colIdx).value);
        return Boolean(val && val.trim() !== '');
      });

      if (!hasAnyData) {
        continue;
      }

      totalRowsRead++;

      // Validate required Title field
      if (!rawTitle || rawTitle.trim() === '') {
        const rawAcc = colMap['accession'] ? this.cleanCellText(row.getCell(colMap['accession']).value) : '';
        problems.push({
          excelRowNumber: r,
          accessionNo: rawAcc || '(Empty)',
          type: 'ERROR',
          field: 'Title',
          message: 'Missing Book Title (Required field).',
        });
        errorsCount++;
        continue;
      }

      // Progress reporting every 200 rows
      if (r % 200 === 0) {
        onProgress?.(45 + Math.round((r / rowCount) * 45), `Validating row ${r} of ${rowCount}...`);
        // Yield to browser event loop
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const rowWarnings: string[] = [];

      // 1. Validate Accession No
      const rawAccession = colMap['accession'] ? this.cleanCellText(row.getCell(colMap['accession']).value) : '';
      if (!rawAccession) {
        problems.push({
          excelRowNumber: r,
          accessionNo: '(Empty)',
          type: 'ERROR',
          field: 'Accession No',
          message: 'Missing Accession Number (Required).',
        });
        errorsCount++;
        continue;
      }

      // Check scientific notation conversion (e.g. 1.0021E+4)
      let cleanAccession = rawAccession;
      if (/e\+/i.test(rawAccession)) {
        const numVal = Number(rawAccession);
        if (!isNaN(numVal)) {
          cleanAccession = String(Math.floor(numVal));
          rowWarnings.push('Converted scientific notation accession number to standard digits.');
        }
      }

      // Check leading zeros
      if (/^0+\d+$/.test(cleanAccession)) {
        leadingZerosCount++;
      }

      // 2. Validate Title
      if (!rawTitle) {
        problems.push({
          excelRowNumber: r,
          accessionNo: cleanAccession,
          type: 'ERROR',
          field: 'Title',
          message: 'Missing Book Title (Required).',
        });
        errorsCount++;
        continue;
      }

      if (rawTitle.length > TEXT_LIMITS.TITLE) {
        problems.push({
          excelRowNumber: r,
          accessionNo: cleanAccession,
          type: 'ERROR',
          field: 'Title',
          message: `Title exceeds maximum limit of ${TEXT_LIMITS.TITLE} characters (Found ${rawTitle.length}).`,
        });
        errorsCount++;
        continue;
      }

      // 3. Duplicate checks
      const numericAcc = parseInt(cleanAccession, 10);
      const accKeyNumeric = !isNaN(numericAcc) ? String(numericAcc) : cleanAccession.toLowerCase();

      // Check duplicate within the same file
      if (seenInFileAccessions.has(accKeyNumeric)) {
        problems.push({
          excelRowNumber: r,
          accessionNo: cleanAccession,
          type: 'DUPLICATE',
          message: `Duplicate Accession #${cleanAccession} earlier in this file (first occurrence will be imported).`,
        });
        duplicatesInFileCount++;
        continue;
      }
      seenInFileAccessions.add(accKeyNumeric);

      // Check duplicate in library
      if (existingAccessions.has(accKeyNumeric) || existingAccessions.has(cleanAccession.toLowerCase())) {
        problems.push({
          excelRowNumber: r,
          accessionNo: cleanAccession,
          type: 'DUPLICATE',
          message: `Accession #${cleanAccession} already exists in university catalog database.`,
        });
        alreadyInLibraryCount++;
        continue;
      }

      // 4. Author (Optional)
      const rawAuthor = colMap['author'] ? this.cleanCellText(row.getCell(colMap['author']).value) : '';
      if (!rawAuthor) {
        blankAuthorCount++;
      } else if (rawAuthor.length > TEXT_LIMITS.AUTHOR) {
        problems.push({
          excelRowNumber: r,
          accessionNo: cleanAccession,
          type: 'ERROR',
          field: 'Author',
          message: `Author exceeds maximum limit of ${TEXT_LIMITS.AUTHOR} characters.`,
        });
        errorsCount++;
        continue;
      }

      // 5. Edition
      const rawEdition = colMap['edition'] ? this.cleanCellText(row.getCell(colMap['edition']).value) : '';
      const edition = rawEdition.slice(0, TEXT_LIMITS.DEFAULT) || '1st Edition';

      // 6. Place & Publisher
      let place = 'Lakki Marwat';
      let publisher = 'ULM Press';

      if (colMap['place_publisher']) {
        const placePubText = this.cleanCellText(row.getCell(colMap['place_publisher']).value);
        if (placePubText) {
          const colonIdx = placePubText.indexOf(':');
          if (colonIdx !== -1) {
            place = placePubText.substring(0, colonIdx).trim();
            publisher = placePubText.substring(colonIdx + 1).trim();
          } else {
            place = placePubText;
            publisher = '';
          }
        }
      } else {
        if (colMap['place']) {
          const p = this.cleanCellText(row.getCell(colMap['place']).value);
          if (p) place = p;
        }
        if (colMap['publisher']) {
          const pub = this.cleanCellText(row.getCell(colMap['publisher']).value);
          if (pub) publisher = pub;
        }
      }

      if (publisher.length > TEXT_LIMITS.PUBLISHER) {
        problems.push({
          excelRowNumber: r,
          accessionNo: cleanAccession,
          type: 'ERROR',
          field: 'Publisher',
          message: `Publisher text exceeds ${TEXT_LIMITS.PUBLISHER} characters limit.`,
        });
        errorsCount++;
        continue;
      }

      // 7. Publication Year
      let year = 2024;
      if (colMap['year']) {
        const rawYear = this.cleanCellText(row.getCell(colMap['year']).value);
        if (rawYear) {
          const parsedYear = parseInt(rawYear, 10);
          if (!isNaN(parsedYear) && parsedYear >= 1000 && parsedYear <= 2100) {
            year = parsedYear;
          } else {
            rowWarnings.push(`Invalid publication year "${rawYear}". Accepted range: 1000-2100. Reset to default 2024.`);
            warningsCount++;
          }
        }
      }

      // 8. Pages
      let pages = 300;
      if (colMap['pages']) {
        const rawPages = this.cleanCellText(row.getCell(colMap['pages']).value);
        if (rawPages) {
          const parsedPages = parseInt(rawPages, 10);
          if (!isNaN(parsedPages) && parsedPages > 0) {
            pages = parsedPages;
          } else {
            rowWarnings.push(`Invalid page count "${rawPages}". Reset to 300.`);
            warningsCount++;
          }
        }
      }

      // 9. Price
      let price = 0;
      if (colMap['price']) {
        const rawPrice = this.cleanCellText(row.getCell(colMap['price']).value);
        if (rawPrice) {
          // Remove "Rs", "Rs.", "/-", spaces, commas
          const cleanedPrice = rawPrice.replace(/[Rr][Ss]\.?|\/-|\s|,/g, '');
          const parsedPrice = parseFloat(cleanedPrice);
          if (!isNaN(parsedPrice) && parsedPrice >= 0) {
            price = Math.round(parsedPrice * 100) / 100;
          } else {
            rowWarnings.push(`Could not parse price "${rawPrice}". Left as 0.`);
            warningsCount++;
          }
        }
      }

      // 10. Binding
      let binding = 'HB';
      let bindingOriginal = '';
      if (colMap['binding']) {
        const rawBinding = this.cleanCellText(row.getCell(colMap['binding']).value);
        bindingOriginal = rawBinding;
        const bLower = rawBinding.toLowerCase();
        if (bLower === 'hardbound' || bLower === 'hb' || bLower === 'h.b') {
          binding = 'HB';
        } else if (bLower === 'paperback' || bLower === 'sb' || bLower === 's.b') {
          binding = 'SB';
        } else if (bLower) {
          binding = 'Other';
        }
      }

      // 11. ISBN
      let isbn = '';
      if (colMap['isbn']) {
        const rawIsbn = this.cleanCellText(row.getCell(colMap['isbn']).value);
        if (rawIsbn) {
          const stripped = rawIsbn.replace(/[-\s]/g, '');
          if (stripped.length !== 10 && stripped.length !== 13) {
            rowWarnings.push(`Non-standard ISBN "${rawIsbn}" (${stripped.length} digits, expected 10 or 13).`);
            warningsCount++;
          }
          isbn = rawIsbn;
        }
      }
      if (!isbn) {
        isbn = `978-0-${cleanAccession.slice(-4).padStart(4, '0')}-001-1`;
      }

      // 12. Remarks / Source
      let remarks = 'Excel Entry Sheet Import';
      if (colMap['remarks']) {
        const rawRemarks = this.cleanCellText(row.getCell(colMap['remarks']).value);
        if (rawRemarks) {
          remarks = rawRemarks.slice(0, TEXT_LIMITS.REMARKS);
        }
      }

      // 13. Date Added
      let dateAdded = today;
      if (colMap['date_added']) {
        const rawDate = this.cleanCellText(row.getCell(colMap['date_added']).value);
        if (rawDate) {
          const valRes = normalizeDateAdded(rawDate);
          if (valRes.valid && valRes.date) {
            dateAdded = valRes.date;
          } else {
            rowWarnings.push(`Invalid or future Date Added "${rawDate}". Assigned current date (${today}).`);
            warningsCount++;
          }
        }
      }

      // 14. Language
      let language = 'English';
      if (colMap['language']) {
        const rawLang = this.cleanCellText(row.getCell(colMap['language']).value);
        if (rawLang) {
          language = rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
        } else {
          language = isArabicOrUrduScript(rawTitle) || isArabicOrUrduScript(rawAuthor) ? 'Urdu' : 'English';
        }
      } else {
        language = isArabicOrUrduScript(rawTitle) || isArabicOrUrduScript(rawAuthor) ? 'Urdu' : 'English';
      }

      if (language.toLowerCase() === 'urdu') {
        urduCount++;
      } else {
        englishCount++;
      }

      // Generate automatic barcode
      const barcodeGen = BarcodeService.generateBarcode(cleanAccession, existingBarcodes);
      const barcode = barcodeGen.barcode;

      // 15. Group & Almari suggestion
      let groupName = '';
      let assignedGroupId: string | null = null;
      let assignedAlmariId: string | null = null;
      let assignedShelfNo: number | null = null;

      if (colMap['group']) {
        const rawGroup = this.cleanCellText(row.getCell(colMap['group']).value);
        if (rawGroup) {
          groupName = rawGroup;
          const allGroups = AlmariService.getGroups();
          const match = allGroups.find(g => g.name_en.toLowerCase() === rawGroup.toLowerCase() || g.name_ur === rawGroup);
          if (match) {
            assignedGroupId = match.id;
          } else {
            // Auto create group or assign
            const created = AlmariService.addGroup({
              name_en: rawGroup,
              name_ur: rawGroup,
              color: '#3B82F6',
              sort_order: allGroups.length + 1,
              is_active: true,
            });
            assignedGroupId = created.id;
          }
        }
      }

      if (!assignedGroupId) {
        const suggested = AlmariService.suggestGroup({ category: 'General Reference', language, book_name: rawTitle });
        if (suggested) {
          assignedGroupId = suggested.id;
          groupName = suggested.name_en;
        }
      }

      if (assignedGroupId) {
        const suggestedLoc = AlmariService.suggestAlmariAndShelf(assignedGroupId, activeBooks);
        if (suggestedLoc) {
          assignedAlmariId = suggestedLoc.almari.id;
          assignedShelfNo = suggestedLoc.shelf_no;
        }
      }

      // Add to ready rows
      readyRows.push({
        excelRowNumber: r,
        accessionNo: cleanAccession,
        author: rawAuthor || 'Anonymous / Organization',
        title: rawTitle,
        edition,
        place,
        publisher,
        year,
        pages,
        price,
        binding,
        bindingOriginal,
        isbn,
        sourceRemarks: remarks,
        dateAdded,
        language,
        barcode,
        group: groupName || undefined,
        groupId: assignedGroupId,
        almariId: assignedAlmariId,
        shelfNo: assignedShelfNo,
        warnings: rowWarnings,
      });

      // Record warnings into problem list
      for (const w of rowWarnings) {
        problems.push({
          excelRowNumber: r,
          accessionNo: cleanAccession,
          type: 'WARNING',
          message: w,
        });
      }
    }

    if (readyRows.length === 0) {
      throw new Error('0 books found: the sheet is empty. Enter books in the sheet and import again.');
    }

    onProgress?.(100, 'Preview analysis ready.');

    return {
      fileName,
      fileSizeBytes: buffer.byteLength,
      totalRowsRead,
      readyToImportCount: readyRows.length,
      duplicatesInFileCount,
      alreadyInLibraryCount,
      errorsCount,
      warningsCount,
      blankAuthorCount,
      urduCount,
      englishCount,
      leadingZerosCount,
      unknownHeaders,
      problems,
      readyRows,
    };
  }

  /**
   * Generates a sanitized problem report CSV (UTF-8 with BOM, neutralizes formula injection)
   */
  static generateProblemReportCsv(preview: ImportPreviewReport): Blob {
    const lines: string[] = [];
    lines.push('Excel Row Number,Accession Number,Category,Issue Description');

    for (const p of preview.problems) {
      const cleanMsg = p.message.replace(/"/g, '""');
      const cleanAcc = p.accessionNo.replace(/"/g, '""');

      // Neutralize formula injection
      const safeAcc = /^[=+\-@]/.test(cleanAcc) ? `'${cleanAcc}` : cleanAcc;
      const safeMsg = /^[=+\-@]/.test(cleanMsg) ? `'${cleanMsg}` : cleanMsg;

      lines.push(`${p.excelRowNumber},"${safeAcc}",${p.type},"${safeMsg}"`);
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Executes the batch import using the exact same addBook logic as the Add Book form.
   * Runs in chunks of 500, creates pre-restore safety backup, rolls back on cancel or error.
   */
  static async executeImport(
    readyRows: CleanedBookRow[],
    fileName: string,
    onProgress?: (pct: number, stage: string) => void,
    shouldCancelRef?: { current: boolean }
  ): Promise<ImportExecutionResult> {
    if (readyRows.length === 0) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        warningsCount: 0,
        message: 'No valid books to import.',
        bookIds: [],
      };
    }

    // 1. Safety backup first
    onProgress?.(5, 'Creating safety snapshot before executing import...');
    const preBackup = await UsbBackupService.createPreRestoreSafetyBackup();
    if (!preBackup.success) {
      throw new Error(`Safety backup failed: ${preBackup.message}. Import cancelled.`);
    }

    const snapshotBooks = JSON.stringify(LibraryStorage.getBooks());
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const importedAt = new Date().toISOString();

    const BATCH_SIZE = 500;
    const total = readyRows.length;
    const createdBookIds: string[] = [];
    let warningsCount = 0;

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        if (shouldCancelRef?.current) {
          // ROLLBACK
          LibraryStorage.saveBooks(JSON.parse(snapshotBooks));
          return {
            success: false,
            importedCount: 0,
            skippedCount: total,
            warningsCount: 0,
            message: 'Import cancelled by user. All changes rolled back to previous state.',
            bookIds: [],
          };
        }

        const chunk = readyRows.slice(i, i + BATCH_SIZE);
        const startPct = 10 + Math.round((i / total) * 80);
        onProgress?.(startPct, `Importing books ${i + 1} to ${Math.min(i + BATCH_SIZE, total)} of ${total}...`);

        for (const row of chunk) {
          warningsCount += row.warnings.length;

          // Call identical add-book logic
          const addRes = LibraryStorage.addBook({
            barcode: row.barcode,
            accession_no: row.accessionNo,
            isbn: row.isbn,
            book_name: row.title,
            author: row.author,
            publisher: row.publisher,
            place: row.place,
            category: 'General Reference',
            edition: row.edition,
            publication_year: row.year,
            language: row.language,
            description: row.sourceRemarks,
            book_image_path: '',
            total_quantity: 1,
            available_quantity: 1,
            shelf: 'General-Stack-01',
            row: 'A-1',
            section: 'Main Stacks',
            dewey_call_number: '000 ULM',
            date_added: row.dateAdded,
            group_id: row.groupId || null,
            almari_id: row.almariId || null,
            shelf_no: row.shelfNo || null,
            binding: row.binding,
            pages: row.pages,
            price: row.price,
            source_remarks: row.sourceRemarks,
            import_batch_id: batchId,
            imported_at: importedAt,
          });

          if (addRes.success && addRes.book) {
            createdBookIds.push(addRes.book.id);
          }
        }

        // Allow UI to breathe
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Record batch metadata in localStorage for "Undo last import"
      const batchRecord: ImportBatchRecord = {
        id: batchId,
        filename: fileName,
        imported_at: importedAt,
        total_rows: total,
        imported_count: createdBookIds.length,
        skipped_count: total - createdBookIds.length,
        warnings_count: warningsCount,
        book_ids: createdBookIds,
      };

      const existingBatchesStr = localStorage.getItem('ulm_lms_import_batches_v1');
      const batches: ImportBatchRecord[] = existingBatchesStr ? JSON.parse(existingBatchesStr) : [];
      batches.unshift(batchRecord);
      localStorage.setItem('ulm_lms_import_batches_v1', JSON.stringify(batches.slice(0, 20)));

      // History audit
      LibraryStorage.logHistory({
        action: 'BATCH_IMPORT',
        description: `Imported ${createdBookIds.length} books from "${fileName}" (Batch ID: ${batchId}).`,
        barcode: 'BATCH-IMPORT',
        user: 'Librarian-Admin',
      });

      onProgress?.(100, 'Import completed successfully.');

      return {
        success: true,
        batchId,
        importedCount: createdBookIds.length,
        skippedCount: total - createdBookIds.length,
        warningsCount,
        message: `${createdBookIds.length.toLocaleString()} books added successfully (${warningsCount} warnings).`,
        bookIds: createdBookIds,
      };
    } catch (err: any) {
      // ROLLBACK on error
      LibraryStorage.saveBooks(JSON.parse(snapshotBooks));
      throw new Error(`Import failed during execution: ${err.message}. State rolled back.`);
    }
  }

  /**
   * Retrieves the most recent import batch record
   */
  static getLastImportBatch(): ImportBatchRecord | null {
    try {
      const data = localStorage.getItem('ulm_lms_import_batches_v1');
      if (!data) return null;
      const batches: ImportBatchRecord[] = JSON.parse(data);
      return batches.length > 0 ? batches[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Reverts the specified or last import batch
   */
  static async undoImport(batchId?: string): Promise<UndoImportResult> {
    return this.undoLastImport();
  }

  /**
   * Reverts the last import batch:
   * Removes books associated with that batch unless they have active/past circulation history.
   */
  static async undoLastImport(): Promise<UndoImportResult> {
    const lastBatch = this.getLastImportBatch();
    if (!lastBatch) {
      return {
        success: false,
        batchId: '',
        removedCount: 0,
        retainedCount: 0,
        retainedBooksWithHistory: [],
        message: 'No previous import batch found to undo.',
      };
    }

    // Safety backup first
    await UsbBackupService.createPreRestoreSafetyBackup();

    const books = LibraryStorage.getBooks();
    const transactions = LibraryStorage.getTransactions();

    const retainedBooksWithHistory: string[] = [];
    let removedCount = 0;

    const remainingBooks = books.filter(book => {
      if (book.import_batch_id !== lastBatch.id) {
        return true;
      }

      // Check if book has circulation history
      const hasHistory = transactions.some(
        t => t.book_id === book.id || (t.barcode && t.barcode === book.barcode)
      );

      if (hasHistory) {
        retainedBooksWithHistory.push(`"${book.book_name}" (Accession #${book.accession_no || book.barcode})`);
        return true; // Keep book
      }

      removedCount++;
      return false; // Remove
    });

    LibraryStorage.saveBooks(remainingBooks);

    // Remove from batch registry
    try {
      const data = localStorage.getItem('ulm_lms_import_batches_v1');
      if (data) {
        const batches: ImportBatchRecord[] = JSON.parse(data);
        const updatedBatches = batches.filter(b => b.id !== lastBatch.id);
        localStorage.setItem('ulm_lms_import_batches_v1', JSON.stringify(updatedBatches));
      }
    } catch {
      // Ignore
    }

    LibraryStorage.logHistory({
      action: 'UNDO_IMPORT',
      description: `Undid import batch ${lastBatch.id}: removed ${removedCount} books (${retainedBooksWithHistory.length} retained due to loan history).`,
      barcode: 'UNDO-IMPORT',
      user: 'Librarian-Admin',
    });

    return {
      success: true,
      batchId: lastBatch.id,
      removedCount,
      retainedCount: retainedBooksWithHistory.length,
      retainedBooksWithHistory,
      message: `Successfully undid batch ${lastBatch.id}: removed ${removedCount} books.${
        retainedBooksWithHistory.length > 0 ? ` Retained ${retainedBooksWithHistory.length} books with loan history.` : ''
      }`,
    };
  }

  /**
   * Generates a pristine blank Book Entry Sheet template workbook conforming to official specification
   */
  static async generateBlankEntrySheet(): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'University of Lakki Marwat LMS';
    workbook.created = new Date();

    // 1. Data Sheet: "Books"
    const sheet = workbook.addWorksheet('Books', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Accession No', key: 'accession', width: 16 },
      { header: 'Author', key: 'author', width: 26 },
      { header: 'Title', key: 'title', width: 38 },
      { header: 'Edition', key: 'edition', width: 16 },
      { header: 'Place & Publisher', key: 'place_publisher', width: 30 },
      { header: 'Year', key: 'year', width: 12 },
      { header: 'Pages', key: 'pages', width: 12 },
      { header: 'Price (Rs/Ps)', key: 'price', width: 16 },
      { header: 'Binding', key: 'binding', width: 16 },
      { header: 'ISBN', key: 'isbn', width: 22 },
      { header: 'Source / Remarks', key: 'remarks', width: 28 },
      { header: 'Date Added', key: 'date_added', width: 16 },
      { header: 'Language', key: 'language', width: 14 },
    ];

    // Style Header Row
    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF541A72' }, // Royal Purple
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBC881B' } },
        bottom: { style: 'medium', color: { argb: 'FFBC881B' } },
      };
    });

    // Data Validations (Dropdowns) for rows 2 to 3000 (No data rows written - header row only)
    for (let r = 2; r <= 3000; r++) {
      const row = sheet.getRow(r);
      // Binding validation
      row.getCell('binding').dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Hardbound,Paperback,Spiral,Other"'],
      };
      // Language validation
      row.getCell('language').dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"English,Urdu,Arabic,Pashto,Other"'],
      };
    }

    // 2. Instructions Sheet
    const instSheet = workbook.addWorksheet('Instructions');
    instSheet.columns = [{ width: 85 }];
    instSheet.addRow(['UNIVERSITY OF LAKKI MARWAT - CENTRAL CAMPUS LIBRARY']).font = { bold: true, size: 14 };
    instSheet.addRow(['BOOK ENTRY SHEET INSTRUCTIONS & MAPPING RULES']).font = { bold: true, size: 12 };
    instSheet.addRow([]);
    instSheet.addRow(['1. Accession No and Title are REQUIRED for every book.']);
    instSheet.addRow(['2. Author is OPTIONAL. If left blank, it will be registered as Anonymous / Organization.']);
    instSheet.addRow(['3. Place & Publisher: use "City: Publisher" format (e.g. "City: Publisher").']);
    instSheet.addRow(['4. Barcodes are created automatically (e.g. ULM-00123). Do not enter barcodes manually.']);
    instSheet.addRow(['5. Binding options: Hardbound, Paperback, Spiral, Other.']);
    instSheet.addRow(['6. Language options: English, Urdu, Arabic, Pashto, Other.']);
    instSheet.addRow(['7. Save this file as standard .xlsx before importing into the LMS.']);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
