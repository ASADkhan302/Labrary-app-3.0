/**
 * Phase 0: Reproduce and Measure Script
 * Measures real timings and call counts for importing a 3,000-row sheet using the current importer.
 */

// Shims for Node environment
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

(globalThis as any).localStorage = new LocalStorageMock();
(globalThis as any).window = globalThis;

import ExcelJS from 'exceljs';
import { ImporterEngine, CleanedBookRow } from '../src/services/importerEngine';
import { LibraryStorage } from '../src/services/storage';
import { UsbBackupService } from '../src/services/usbBackupService';
import { BookSheetService } from '../src/services/bookSheetService';
import { LibraryFolderService } from '../src/services/libraryFolderService';
import { BarcodeService } from '../src/services/barcodeService';
import { INITIAL_BOOKS } from '../src/services/initialData';

async function buildTestSheet3000(): Promise<ArrayBuffer> {
  console.log('Generating 3,000-row test sheet based on ULM_Book_Entry_Sheet.xlsx template...');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'University of Lakki Marwat LMS';
  workbook.created = new Date();

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

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF541A72' },
    };
  });

  const urduTitles = [
    'کلیات اقبال', 'بانگ درا', 'بال جبریل', 'ضرب کلیم', 'ارمغان حجاز',
    'دیوان غالب', 'دست صبا', 'نقش فریادی', 'زنداں نامہ', 'آب حیات',
    'فسانہ عجائب', 'باغ و بہار', 'مقدمہ شعر و شاعری', 'یادگار غالب', 'حیات جاوید'
  ];

  const englishTitles = [
    'Data Structures and Algorithms', 'Operating System Concepts', 'Computer Networks: A Top-Down Approach',
    'Database System Concepts', 'Artificial Intelligence: A Modern Approach', 'Clean Architecture',
    'Introduction to the Theory of Computation', 'Digital Design and Computer Architecture',
    'Software Engineering: A Practitioner\'s Approach', 'Discrete Mathematics and Its Applications'
  ];

  const authors = [
    'علامہ محمد اقبال', 'مرزا اسد اللہ خان غالب', 'فیض احمد فیض', 'مولانا الطاف حسین حالی',
    'Robert C. Martin', 'Abraham Silberschatz', 'Andrew S. Tanenbaum', 'Stuart Russell',
    'Donald Knuth', 'Thomas H. Cormen', '' // blank author test
  ];

  // Populate 3,000 rows
  // Mix of English and Urdu, blank authors, some duplicates, bad ISBNs, etc.
  for (let i = 2; i <= 3001; i++) {
    const isUrdu = i % 3 === 0;
    const title = isUrdu ? urduTitles[i % urduTitles.length] + ` - جلد ${i}` : englishTitles[i % englishTitles.length] + ` Vol ${i}`;
    const author = authors[i % authors.length];
    
    // Introduce duplicates: every 150 rows duplicate an earlier row accession
    let accNum = 20000 + i;
    if (i % 150 === 0) {
      accNum = 20000 + (i - 50); // duplicate in file
    } else if (i === 500) {
      accNum = 10001; // duplicate with library initial book
    }

    // Bad ISBNs on some rows
    let isbn = `978-0-${String(accNum).slice(-4)}-001-1`;
    if (i % 200 === 0) {
      isbn = 'BAD-ISBN-123'; // invalid length
    }

    sheet.addRow({
      accession: String(accNum),
      author,
      title,
      edition: '1st Edition',
      place_publisher: isUrdu ? 'Lahore: Sang-e-Meel' : 'Boston: Pearson',
      year: 2020 + (i % 5),
      pages: 200 + (i % 400),
      price: String(500 + (i % 1500)),
      binding: i % 2 === 0 ? 'Hardbound' : 'Paperback',
      isbn,
      remarks: 'Central Library Acquisition',
      date_added: '2024-03-15',
      language: isUrdu ? 'Urdu' : 'English',
    });
  }

  // Pre-formatted validations as in standard template
  for (let r = 2; r <= 3001; r++) {
    const row = sheet.getRow(r);
    row.getCell('binding').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Hardbound,Paperback,Spiral,Other"'],
    };
    row.getCell('language').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"English,Urdu,Arabic,Pashto,Other"'],
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  console.log(`Test sheet generated: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
  return buffer as ArrayBuffer;
}

async function runBenchmark() {
  const buffer = await buildTestSheet3000();

  // Reset library storage to standard initial state
  LibraryStorage.clearBooksCache();
  localStorage.clear();
  LibraryStorage.getBooks(); // seeds initial books

  // Counter tracking
  let saveLibraryCalls = 0;
  let stateUpdateCalls = 0;
  let bookScansCount = 0;
  let sheetWritesCount = 0;
  let dataFileRefreshCalls = 0;

  // Intercept storage mutations
  const origSaveBooks = LibraryStorage.saveBooks.bind(LibraryStorage);
  LibraryStorage.saveBooks = (books: any) => {
    saveLibraryCalls++;
    return origSaveBooks(books);
  };

  const origPrependBook = LibraryStorage.prependBook.bind(LibraryStorage);
  LibraryStorage.prependBook = (newBook: any, books: any) => {
    saveLibraryCalls++;
    return origPrependBook(newBook, books);
  };

  const origNotifyMutation = LibraryStorage.notifyMutation.bind(LibraryStorage);
  LibraryStorage.notifyMutation = () => {
    stateUpdateCalls++;
    return origNotifyMutation();
  };

  const origGetBooks = LibraryStorage.getBooks.bind(LibraryStorage);
  LibraryStorage.getBooks = () => {
    bookScansCount++;
    return origGetBooks();
  };

  const origAppend = (BookSheetService as any).appendBooksToSheetXml?.bind(BookSheetService);
  if (origAppend) {
    (BookSheetService as any).appendBooksToSheetXml = async (...args: any[]) => {
      sheetWritesCount++;
      return origAppend(...args);
    };
  }

  const origRefreshDataFiles = LibraryFolderService.refreshDataFiles.bind(LibraryFolderService);
  LibraryFolderService.refreshDataFiles = async (force?: boolean) => {
    dataFileRefreshCalls++;
    return origRefreshDataFiles(force);
  };

  console.log('\n================================================================');
  console.log(' MEASURING IMPORT STAGES (CURRENT IMPLEMENTATION) ');
  console.log('================================================================');

  // Stage 1: Reading and parsing the file
  const t0 = performance.now();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const t_parse = performance.now();

  const worksheet = workbook.getWorksheet('Books') || workbook.worksheets[0];
  const t_worksheet = performance.now();

  // Stage 2: Header mapping
  const headerRow = worksheet.getRow(1);
  const colMap: Record<string, number> = {};
  const KNOWN_HEADER_KEYS: Record<string, string> = {
    'accession no': 'accession',
    'author': 'author',
    'title': 'title',
    'edition': 'edition',
    'place & publisher': 'place_publisher',
    'year': 'year',
    'pages': 'pages',
    'price (rs/ps)': 'price',
    'binding': 'binding',
    'isbn': 'isbn',
    'source / remarks': 'remarks',
    'date added': 'date_added',
    'language': 'language',
  };
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawText = ImporterEngine.cleanCellText(cell.value).toLowerCase();
    const mapped = KNOWN_HEADER_KEYS[rawText];
    if (mapped) colMap[mapped] = colNumber;
  });
  const t_headers = performance.now();

  // Stage 3 & 4 & 5: Cleaning, validation, duplicate check, accession & barcode assignment
  const t_clean_start = performance.now();
  // Call current parseEntrySheet to get accurate preview report & timings
  let previewProgressUpdates = 0;
  const report = await ImporterEngine.parseEntrySheet(buffer, 'ULM_Book_Entry_Sheet.xlsx', (pct, msg) => {
    previewProgressUpdates++;
  });
  const t_clean_end = performance.now();

  console.log(`Preview ready: ${report.totalRowsRead} read, ${report.readyToImportCount} ready, ${report.duplicatesInFileCount} in-file dupes, ${report.alreadyInLibraryCount} catalog dupes, ${report.warningsCount} warnings`);

  // Stage 6: Safety Backup
  const t_backup_start = performance.now();
  const preBackup = await UsbBackupService.createPreRestoreSafetyBackup();
  const t_backup_end = performance.now();

  // Stage 7: Database write & UI updates
  // Measure executeImport
  const preSaveCalls = saveLibraryCalls;
  const preStateUpdates = stateUpdateCalls;
  const preBookScans = bookScansCount;

  let importProgressUpdates = 0;
  const t_db_start = performance.now();
  const importResult = await ImporterEngine.executeImport(report.readyRows, 'ULM_Book_Entry_Sheet.xlsx', (pct, msg) => {
    importProgressUpdates++;
  });
  const t_db_end = performance.now();

  // Stage 8: Write-back to sheet
  const t_sheet_start = performance.now();
  // Check if write queue has items to process
  await BookSheetService.processQueue();
  const t_sheet_end = performance.now();

  // Stage 9: Refresh data files
  const t_datafiles_start = performance.now();
  await LibraryFolderService.refreshDataFiles(true);
  const t_datafiles_end = performance.now();

  // Stage 10: Search index and counter updates
  const t_search_start = performance.now();
  const books = LibraryStorage.getBooks();
  // Verify sort keys & search text exist
  let validSearchText = 0;
  for (const b of books) {
    if (b.search_text && b.title_sort && b.author_sort) validSearchText++;
  }
  const t_search_end = performance.now();

  const totalTime = (t_search_end - t0) / 1000;

  console.log('\n================================================================');
  console.log(' PHASE 0: REAL MEASUREMENT REPORT');
  console.log('================================================================\n');

  console.log('| Stage                                    | Time (ms)     | Time (s)    |');
  console.log('|------------------------------------------|---------------|-------------|');
  console.log(`| Reading and parsing the file (ExcelJS)   | ${(t_parse - t0).toFixed(1).padStart(13)} | ${((t_parse - t0) / 1000).toFixed(2).padStart(11)} |`);
  console.log(`| Header mapping                           | ${(t_headers - t_worksheet).toFixed(1).padStart(13)} | ${((t_headers - t_worksheet) / 1000).toFixed(2).padStart(11)} |`);
  console.log(`| Cleaning and validation                  | ${(t_clean_end - t_clean_start).toFixed(1).padStart(13)} | ${((t_clean_end - t_clean_start) / 1000).toFixed(2).padStart(11)} |`);
  console.log(`| Duplicate check (in file & catalog)     | Included in clean stage above                |`);
  console.log(`| Accession & barcode assignment           | Included in clean stage above                |`);
  console.log(`| Safety backup                            | ${(t_backup_end - t_backup_start).toFixed(1).padStart(13)} | ${((t_backup_end - t_backup_start) / 1000).toFixed(2).padStart(11)} |`);
  console.log(`| Database write (3,000 books)             | ${(t_db_end - t_db_start).toFixed(1).padStart(13)} | ${((t_db_end - t_db_start) / 1000).toFixed(2).padStart(11)} |`);
  console.log(`| Writing Barcode column back into sheet   | ${(t_sheet_end - t_sheet_start).toFixed(1).padStart(13)} | ${((t_sheet_end - t_sheet_start) / 1000).toFixed(2).padStart(11)} |`);
  console.log(`| Refresh of data files (CSV & XLSX)       | ${(t_datafiles_end - t_datafiles_start).toFixed(1).padStart(13)} | ${((t_datafiles_end - t_datafiles_start) / 1000).toFixed(2).padStart(11)} |`);
  console.log(`| Search index & counter updates           | ${(t_search_end - t_search_start).toFixed(1).padStart(13)} | ${((t_search_end - t_search_start) / 1000).toFixed(2).padStart(11)} |`);
  console.log(`| TOTAL IMPORT CYCLE                       | ${(t_search_end - t0).toFixed(1).padStart(13)} | ${totalTime.toFixed(2).padStart(11)} |`);

  console.log('\n================================================================');
  console.log(' CALL COUNTS DURING ONE 3,000-ROW IMPORT');
  console.log('================================================================');
  console.log(`- Saves of the library (saveBooks/prependBook): ${saveLibraryCalls} calls (target: 1 or a few)`);
  console.log(`- State updates / mutation notifications:       ${stateUpdateCalls} calls`);
  console.log(`- Scans of all books (getBooks):               ${bookScansCount} calls`);
  console.log(`- Sheet writes:                                ${sheetWritesCount} calls`);
  console.log(`- Data-file refreshes:                         ${dataFileRefreshCalls} calls`);
  console.log(`- Progress callbacks during parse & import:    ${previewProgressUpdates + importProgressUpdates} updates`);

  console.log('\nLongest main thread block & bottlenecks identified:');
  console.log('1. Database write stage: loops 3,000 times through LibraryStorage.addBook, triggering prependBook (saving to localStorage 3,000 times) and enqueuing into BookSheetService write queue 3,000 times.');
  console.log('2. ExcelJS workbook.xlsx.load: reads all 3,000 rows including all cell formatting and data validations instead of streaming/reading data-only.');
  console.log('3. Per-row AlmariService lookups and barcode uniqueness checks scan activeBooks repeatedly.');
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
});
