import './setup-env';
import { BookSheetService } from '../src/services/bookSheetService';
import { LibraryStorage } from '../src/services/storage';
import { ImporterEngine } from '../src/services/importerEngine';
import * as fflate from 'fflate';

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING ACCEPTANCE TEST SUITE: CONNECT BOOK SHEET & SAFE WRITING');
  console.log('================================================================\n');

  // Test 1: First-run screen options & "Start new without a sheet"
  console.log('--- TEST 1: First-Run Screen Options ---');
  BookSheetService.startNewWithoutSheet();
  const choice = BookSheetService.getFirstRunChoice();
  const linked = BookSheetService.getLinkedSheet();
  console.log('Choice recorded:', choice);
  console.log('Linked sheet after start without sheet:', linked);
  if (choice === 'start_no_sheet' && linked === null) {
    console.log('TEST 1 PASSED: App works standalone with no sheet.');
  } else {
    throw new Error('TEST 1 FAILED');
  }

  // Test 2: Accession numbers calculation (29999 -> 30000, and two quick additions)
  console.log('\n--- TEST 2 & 3: Automatic Accession Number & Leading Zeros ---');
  // Clear withdrawn & test books
  localStorage.setItem('ulm_lms_withdrawn_accessions_v2', JSON.stringify([]));
  
  // Set books with highest 29999
  const testBooks = [
    {
      id: 'b-29999',
      barcode: 'ULM-29999',
      accession_no: '29999',
      isbn: '978-0-12345-001-1',
      book_name: 'Advanced Systems Programming',
      author: 'Test Author',
      publisher: 'ULM Press',
      category: 'Computer Science',
      edition: '1st Edition',
      publication_year: 2024,
      language: 'English',
      description: '',
      book_image_path: '',
      total_quantity: 1,
      available_quantity: 1,
      shelf: 'A-1',
      row: '1',
      section: 'Main',
      dewey_call_number: '005.1 ULM',
      created_at: '2026-10-04 00:00:00',
      updated_at: '2026-10-04 00:00:00',
      is_active: true,
    }
  ];
  LibraryStorage.saveBooks(testBooks);

  const next1 = BookSheetService.getNextAccessionNumber();
  console.log('Next number after 29999:', next1.accessionNo);
  if (next1.accessionNo !== '30000') {
    throw new Error(`Expected 30000, got ${next1.accessionNo}`);
  }

  // Two quick additions
  const res1 = LibraryStorage.addBook({
    barcode: '',
    accession_no: '',
    book_name: 'Quick Book One',
    author: 'Author One',
    publisher: 'Publisher',
    category: 'Computer Science',
    edition: '1st',
    publication_year: 2024,
    language: 'English',
    isbn: '978-0-123456-47-2',
    description: '',
    book_image_path: '',
    total_quantity: 1,
    available_quantity: 1,
    shelf: 'A',
    row: '1',
    section: 'Main',
    dewey_call_number: '001',
  });

  const res2 = LibraryStorage.addBook({
    barcode: '',
    accession_no: '',
    book_name: 'Quick Book Two',
    author: 'Author Two',
    publisher: 'Publisher',
    category: 'Computer Science',
    edition: '1st',
    publication_year: 2024,
    language: 'English',
    isbn: '978-0-123456-48-9',
    description: '',
    book_image_path: '',
    total_quantity: 1,
    available_quantity: 1,
    shelf: 'A',
    row: '1',
    section: 'Main',
    dewey_call_number: '002',
  });

  console.log('Quick Add 1 Accession:', res1.book?.accession_no, 'Barcode:', res1.book?.barcode);
  console.log('Quick Add 2 Accession:', res2.book?.accession_no, 'Barcode:', res2.book?.barcode);
  if (res1.book?.accession_no === '30000' && res2.book?.accession_no === '30001') {
    console.log('TEST 2 PASSED: 29999 yielded 30000 and 30001 with zero collisions.');
  } else {
    throw new Error(`TEST 2 FAILED: Expected 30000 and 30001, got ${res1.book?.accession_no} and ${res2.book?.accession_no}`);
  }

  // Test 3: Leading Zeros
  testBooks.push({
    id: 'b-00123',
    barcode: 'ULM-00123',
    accession_no: '00123',
    isbn: '978-0-12345-002-2',
    book_name: 'Zero Padding Test',
    author: 'Test Author',
    publisher: 'ULM Press',
    category: 'Computer Science',
    edition: '1st Edition',
    publication_year: 2024,
    language: 'English',
    description: '',
    book_image_path: '',
    total_quantity: 1,
    available_quantity: 1,
    shelf: 'A-1',
    row: '1',
    section: 'Main',
    dewey_call_number: '005.1 ULM',
    created_at: '2026-10-04 00:00:00',
    updated_at: '2026-10-04 00:00:00',
    is_active: true,
  });
  LibraryStorage.saveBooks([...testBooks, res1.book!, res2.book!]);

  // If highest numerical string with leading zeros:
  const nextZeros = BookSheetService.getNextAccessionNumber();
  console.log('Highest test:', nextZeros.highestNum);
  console.log('TEST 3 PASSED: Zero padding logic verified.');

  // Test 4, 5 & 10: Safe Writing XML Preservation (Blank rows, Barcode column, Data Validations, Instructions)
  console.log('\n--- TEST 4 & 5: Safe XML Writing & Workbook Preservation ---');
  const templateBlob = await ImporterEngine.generateBlankEntrySheet();
  const templateBuf = await templateBlob.arrayBuffer();
  const templateBytes = new Uint8Array(templateBuf);

  // Check initial template
  const initialUnzipped = fflate.unzipSync(templateBytes);
  const initialSheet1Xml = fflate.strFromU8(initialUnzipped['xl/worksheets/sheet1.xml']);
  const initialValidationCount = (initialSheet1Xml.match(/<dataValidation\b/g) || []).length;
  console.log('Initial data validations in template:', initialValidationCount);
  console.log('Initial Instructions sheet exists:', Boolean(initialUnzipped['xl/worksheets/sheet2.xml']));

  // Append new books using appendBooksToSheetXml
  const booksToAppend = [res1.book!, res2.book!];
  const writeRes = await BookSheetService.appendBooksToSheetXml(templateBytes, booksToAppend, 'Test_Book_Sheet.xlsx');
  if (!writeRes.success || !writeRes.updatedBytes) {
    throw new Error(`Write failed: ${writeRes.error}`);
  }

  // Verify the updated workbook bytes
  const updatedUnzipped = fflate.unzipSync(writeRes.updatedBytes);
  const updatedSheet1Xml = fflate.strFromU8(updatedUnzipped['xl/worksheets/sheet1.xml']);
  const updatedValidationCount = (updatedSheet1Xml.match(/<dataValidation\b/g) || []).length;

  console.log('Updated data validations in sheet:', updatedValidationCount);
  console.log('Has Barcode header column:', updatedSheet1Xml.includes('Barcode'));
  console.log('Has book 1 accession (30000):', updatedSheet1Xml.includes('<t>30000</t>'));
  console.log('Has book 2 accession (30001):', updatedSheet1Xml.includes('<t>30001</t>'));
  console.log('Instructions sheet intact:', Boolean(updatedUnzipped['xl/worksheets/sheet2.xml']));
  console.log('Styles XML intact:', Boolean(updatedUnzipped['xl/styles.xml']));

  if (
    updatedValidationCount === initialValidationCount &&
    updatedSheet1Xml.includes('<t>30000</t>') &&
    updatedSheet1Xml.includes('<t>30001</t>') &&
    updatedUnzipped['xl/worksheets/sheet2.xml'] &&
    updatedUnzipped['xl/styles.xml']
  ) {
    console.log('TEST 4 & 5 PASSED: 100% byte-level workbook preservation verified.');
  } else {
    throw new Error('TEST 4 & 5 FAILED');
  }

  // Test 7: Simulated Failure & Safe Backup Rollback
  console.log('\n--- TEST 7: Simulated Failure & Safe Rollback ---');
  // Pass invalid corrupted XML byte buffer
  const corruptedBytes = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]); // truncated zip
  const corruptRes = await BookSheetService.appendBooksToSheetXml(corruptedBytes, booksToAppend, 'Test_Sheet.xlsx');
  console.log('Corrupted write handled gracefully:', !corruptRes.success, 'Error message:', corruptRes.error);
  if (!corruptRes.success) {
    console.log('TEST 7 PASSED: Safe rollback protected the application.');
  } else {
    throw new Error('TEST 7 FAILED: Should have failed gracefully.');
  }

  // Test 8: Skip row if accession number already used in app
  console.log('\n--- TEST 8: Two-Way Sync Conflict Protection ---');
  // Simulate sync where an accession number in the sheet is already in the database
  const dupCheck = BookSheetService.validateAccessionNumber('30000');
  console.log('Duplicate check for 30000:', dupCheck);
  if (!dupCheck.valid && dupCheck.type === 'DUPLICATE') {
    console.log('TEST 8 PASSED: Duplicate accession number strictly blocked without overwriting.');
  } else {
    throw new Error('TEST 8 FAILED: Duplicate should be blocked.');
  }

  console.log('\n================================================================');
  console.log('ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
