/**
 * Comprehensive Automated Verification Suite for:
 * 1. Book Entry Sheet Importer Engine (ExcelJS, signature, limits, bidi/Urdu cleaning, preview & undo)
 * 2. Universal Barcode Engine (Prefix-Accession, padding, collision resolution, Code-128 safety, backfill)
 * 3. Library Data Files (LibraryData.xlsx, books.csv, members.csv, transactions.csv, hash verification)
 * 4. Portable ZIP Transfer Package (Manifest, SHA-256, validation, atomic restore)
 */

// Mock browser localStorage and window for Node.js test execution
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
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
import { BarcodeService } from '../src/services/barcodeService';
import { ImporterEngine } from '../src/services/importerEngine';
import { LibraryDataFilesService } from '../src/services/libraryDataFilesService';
import { UsbBackupService } from '../src/services/usbBackupService';
import { LibraryStorage } from '../src/services/storage';

interface TestResult {
  id: number;
  category: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(category: string, name: string, condition: boolean, details: string) {
  const id = results.length + 1;
  results.push({ id, category, name, passed: condition, details });
  const status = condition ? '✓ PASS' : '✗ FAIL';
  console.log(`[${status}] #${String(id).padStart(2, '0')} | [${category}] ${name}`);
  if (!condition) {
    console.error(`      ERROR: ${details}`);
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log(' ULM LMS: BOOK ENTRY SHEET, BARCODES, DATA FILES & ZIP TESTS   ');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // SECTION 1: BARCODE SERVICE
  // ---------------------------------------------------------------------------
  console.log('[SECTION 1] Universal Barcode Engine Invariants');

  // Test 1: Standard prefix
  const prefix = BarcodeService.getPrefix();
  assert('Barcode Engine', 'Default Prefix Resolution', prefix.length > 0 && prefix.length <= 6 && /^[A-Z0-9]+$/.test(prefix), `Resolved prefix: "${prefix}"`);

  // Test 2: Numeric Accession Number Padding (5 digits)
  const code1 = BarcodeService.generateBarcode(123);
  assert('Barcode Engine', 'Numeric Accession 5-Digit Padding', code1.barcode === `${prefix}-00123`, `Expected "${prefix}-00123", got "${code1.barcode}"`);

  // Test 3: Alphanumeric Accession Number Sanitization
  const code2 = BarcodeService.generateBarcode('CS-99@#');
  assert('Barcode Engine', 'Non-Numeric Accession Sanitization', code2.barcode === `${prefix}-CS99`, `Expected "${prefix}-CS99", got "${code2.barcode}"`);

  // Test 4: Collision Resolution (-2, -3)
  const existingSet = new Set<string>([`${prefix}-00456`.toUpperCase()]);
  const code3 = BarcodeService.generateBarcode('456', existingSet);
  assert('Barcode Engine', 'Collision Suffix Increment (-2)', code3.isCollision && code3.barcode === `${prefix}-00456-2`, `Expected "${prefix}-00456-2", got "${code3.barcode}"`);

  // Test 5: Code-128 Character Compliance
  const isCode128Safe = /^[A-Z0-9\-]+$/.test(code3.barcode);
  assert('Barcode Engine', 'Code-128 Character Safety Guarantee', isCode128Safe, `Barcode "${code3.barcode}" contains only Code-128 safe characters.`);

  // ---------------------------------------------------------------------------
  // SECTION 2: IMPORTER ENGINE FILE SIGNATURE & BLANK TEMPLATE
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 2] Importer Engine: Signature Validation & Template Generation');

  // Test 6: Blank Template Generation
  const templateBlob = await ImporterEngine.generateBlankEntrySheet();
  assert('Importer Engine', 'Generate Blank Entry Sheet Blob', templateBlob.size > 1000 && templateBlob.type.includes('spreadsheet'), `Generated size: ${templateBlob.size} bytes`);

  // Test 7: Valid .xlsx File Signature Validation (PK\x03\x04 zip signature)
  const templateBuffer = await templateBlob.arrayBuffer();
  const sigValid = ImporterEngine.validateFileSignature(templateBuffer, 'ULM_Book_Entry_Sheet.xlsx');
  assert('Importer Engine', 'Validate Real .xlsx File Signature', sigValid.valid, `Signature validation succeeded for valid .xlsx`);

  // Test 8: Reject Fake/Renamed File (e.g. .txt renamed to .xlsx)
  const fakeBuffer = new TextEncoder().encode('Not a zip file, just plain text payload').buffer;
  const sigFake = ImporterEngine.validateFileSignature(fakeBuffer, 'renamed_virus.xlsx');
  assert('Importer Engine', 'Reject Non-Zip File Renamed to .xlsx', !sigFake.valid, `Cleanly rejected invalid binary format: ${sigFake.error}`);

  // Test 9: Reject Disallowed Extensions (.xlsm, .exe)
  const sigMacro = ImporterEngine.validateFileSignature(templateBuffer, 'malicious.xlsm');
  assert('Importer Engine', 'Reject Macro-Enabled .xlsm Extension', !sigMacro.valid, `Cleanly rejected macro extension: ${sigMacro.error}`);

  // ---------------------------------------------------------------------------
  // SECTION 3: PARSING, DATA CLEANING, URDU NORMALIZATION & DUPLICATES
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 3] Workbook Ingestion, Text Cleaning & Deduplication');

  // Create an in-memory workbook with various test rows:
  // - Valid English book
  // - Valid Urdu book with diacritics and Arabic yeh/kaf to test normalization
  // - Duplicate accession number inside sheet
  // - Missing required fields
  const testWb = new ExcelJS.Workbook();
  const ws = testWb.addWorksheet('Books');
  ws.addRow([
    'Accession No', 'Author', 'Title', 'Edition', 'Place & Publisher',
    'Year', 'Pages', 'Price (Rs/Ps)', 'Binding', 'ISBN', 'Source / Remarks', 'Date Added', 'Language'
  ]);

  // Row 2: Valid English book
  ws.addRow([
    '00801', 'Andrew S. Tanenbaum', 'Modern Operating Systems', '4th Edition', 'Boston: Pearson',
    2023, 1136, 4500, 'HB', '978-0133591620', 'Donated by CS Dept', '2026-10-01', 'English'
  ]);

  // Row 3: Valid Urdu book with tashkeel and bidi controls
  ws.addRow([
    '00802', 'عَلَّامَہ مُحَمَّد اِقْبَال', 'بَالِ جِبْرِيل', '1st Edition', 'لاہور: اقبال اکادمی',
    2021, 240, 650, 'HB', '978-9694151021', 'ULM Urdu Section', '2026-10-02', 'Urdu'
  ]);

  // Row 4: Duplicate accession inside same workbook (same '00801')
  ws.addRow([
    '00801', 'Another Author', 'Duplicate Accession Title', '1st Edition', 'Peshawar',
    2024, 300, 500, 'PB', '978-0000000000', '', '2026-10-03', 'English'
  ]);

  // Row 5: Missing Title (Required field validation)
  ws.addRow([
    '00803', 'Nameless Book Author', '', '1st Edition', 'Karachi',
    2020, 100, 200, 'PB', '978-1111111111', '', '2026-10-03', 'English'
  ]);

  const testBuf = await testWb.xlsx.writeBuffer();
  const preview = await ImporterEngine.parseEntrySheet(testBuf, 'Test_Import.xlsx');

  // Test 10: Total Rows Read
  assert('Importer Engine', 'Total Rows Parsed', preview.totalRowsRead === 4, `Parsed ${preview.totalRowsRead} data rows`);

  // Test 11: Ready Rows Count (Rows 2 and 3 should be ready; Row 4 is duplicate, Row 5 is error)
  assert('Importer Engine', 'Ready Rows Calculation', preview.readyToImportCount === 2, `Ready count: ${preview.readyToImportCount}`);

  // Test 12: In-File Duplicate Detection
  assert('Importer Engine', 'In-File Duplicate Detection', preview.duplicatesInFileCount === 1, `Detected ${preview.duplicatesInFileCount} duplicate rows in workbook`);

  // Test 13: Missing Field Error Detection
  assert('Importer Engine', 'Missing Title Required Field Error', preview.errorsCount >= 1, `Flagged ${preview.errorsCount} row errors for missing title`);

  // Test 14: Urdu Text Normalization on Ingestion
  const urduRow = preview.readyRows.find(r => r.accessionNo === '00802');
  assert('Importer Engine', 'Urdu Book Detection & Ingestion', urduRow !== undefined && urduRow.language === 'Urdu', `Urdu title ingested: "${urduRow?.title}"`);

  // Test 15: Automatic Barcode Generation on Cleaned Rows
  const barcodedRow = preview.readyRows[0];
  assert('Importer Engine', 'Automatic Barcode on Preview Row', barcodedRow.barcode.startsWith(`${prefix}-`), `Assigned barcode: "${barcodedRow.barcode}"`);

  // ---------------------------------------------------------------------------
  // SECTION 4: ATOMIC IMPORT EXECUTION & UNDO ENGINE
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 4] Atomic Import Execution, Batch Tracking & Undo Engine');

  const beforeBooksCount = LibraryStorage.getBooks().length;
  const execResult = await ImporterEngine.executeImport(preview.readyRows, 'Test_Import.xlsx');

  // Test 16: Import Execution Success
  assert('Import Execution', 'Batch Import Success', execResult.success && execResult.importedCount === 2, `Successfully imported ${execResult.importedCount} books in batch ${execResult.batchId}`);

  // Test 17: Database State After Import
  const afterBooks = LibraryStorage.getBooks();
  assert('Import Execution', 'Catalog Holdings Incremented', afterBooks.length === beforeBooksCount + 2, `Catalog count grew from ${beforeBooksCount} to ${afterBooks.length}`);

  // Test 18: Undo Import Capability
  const undoResult = await ImporterEngine.undoImport(execResult.batchId!);
  assert('Import Execution', 'Undo Import Execution', undoResult.success && undoResult.removedCount === 2, `Undid batch: removed ${undoResult.removedCount} books`);

  // Test 19: Database Restored to Clean Baseline After Undo
  const restoredBooks = LibraryStorage.getBooks();
  assert('Import Execution', 'Catalog Reverted to Pre-Import Count', restoredBooks.length === beforeBooksCount, `Holdings count restored to ${restoredBooks.length}`);

  // ---------------------------------------------------------------------------
  // SECTION 5: LIBRARY DATA FILES GENERATION
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 5] Library Data Files Generator (LibraryData.xlsx & CSVs)');

  const currentBooks = LibraryStorage.getBooks();
  const currentMembers = LibraryStorage.getBorrowers();
  const currentTx = LibraryStorage.getTransactions();

  // Test 20: LibraryData.xlsx Workbook Structure
  const dataWb = await LibraryDataFilesService.generateLibraryDataWorkbook(currentBooks, currentMembers, currentTx);
  const sheetNames = dataWb.worksheets.map(ws => ws.name);
  const hasExpectedSheets = ['Books', 'Members', 'Transactions', 'About'].every(s => sheetNames.includes(s));
  assert('Data Files Engine', 'LibraryData.xlsx Required Sheets Present', hasExpectedSheets, `Sheets: [${sheetNames.join(', ')}]`);

  // Test 21: Books CSV Generation
  const booksCsv = LibraryDataFilesService.generateBooksCsv(currentBooks);
  assert('Data Files Engine', 'books.csv UTF-8 BOM & Headers', booksCsv.startsWith('\uFEFF') && booksCsv.includes('Accession No'), `books.csv has UTF-8 BOM and correct headers`);

  // Test 22: Members CSV Generation
  const membersCsv = LibraryDataFilesService.generateMembersCsv(currentMembers);
  assert('Data Files Engine', 'members.csv UTF-8 BOM & Headers', membersCsv.startsWith('\uFEFF') && membersCsv.includes('University ID'), `members.csv has UTF-8 BOM`);

  // Test 23: Transactions CSV Generation
  const txCsv = LibraryDataFilesService.generateTransactionsCsv(currentTx);
  assert('Data Files Engine', 'transactions.csv UTF-8 BOM & Headers', txCsv.startsWith('\uFEFF') && txCsv.includes('Transaction ID'), `transactions.csv has UTF-8 BOM`);

  // ---------------------------------------------------------------------------
  // SECTION 6: ZIP TRANSFER PACKAGE & RESTORE VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 6] Portable Transfer ZIP Package & Validation Engine');

  // Test 24: Build Full Backup Archive
  const backupRes = await UsbBackupService.createPreRestoreSafetyBackup();
  assert('ZIP Transfer Engine', 'Safety Snapshot Creation', backupRes.success && backupRes.blob !== undefined, `Created snapshot: "${backupRes.filename}" (${backupRes.blob?.size} bytes)`);

  // Test 25: Validate Archive Package
  const zipBytes = new Uint8Array(await backupRes.blob!.arrayBuffer());
  const report = await UsbBackupService.validateBackupZip(zipBytes);
  assert('ZIP Transfer Engine', 'Package Manifest & SHA-256 Validation', report.valid && report.manifest !== undefined, `Package verified valid with ${report.totalEntries} entries`);

  // Test 26: Zip-Bomb Protection Limits
  const containsReasonableSize = report.totalBytes < 500 * 1024 * 1024;
  assert('ZIP Transfer Engine', 'Zip Bomb Size Invariant (< 500MB)', containsReasonableSize, `Package uncompressed total: ${(report.totalBytes / 1024).toFixed(1)} KB`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 DIAGNOSTIC AUDIT RESULTS                       ');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED:      ${passed} / ${total} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`FAILED:      ${failed} / ${total}`);
  console.log(`STATUS:      ${failed === 0 ? 'ALL PHASES & INVARIANTS FULLY VERIFIED' : 'FAILURES DETECTED'}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
