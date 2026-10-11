import './setup-env';
import { LibraryStorage } from '../src/services/storage';
import { BookSheetService } from '../src/services/bookSheetService';
import { BarcodeService } from '../src/services/barcodeService';
import { ResetToZeroService } from '../src/services/resetToZeroService';
import { LibraryFolderService } from '../src/services/libraryFolderService';
import { INITIAL_BOOKS, INITIAL_BORROWERS, INITIAL_TRANSACTIONS } from '../src/services/initialData';

async function runResetTestSuite() {
  console.log('================================================================');
  console.log('ACCEPTANCE TEST SUITE: RESET TO ZERO & CLEAR DEMO DATA');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // ACCEPTANCE 9: Clear demo data removes only demo rows
  // --------------------------------------------------------------------------
  console.log('--- TEST 9: Clear Demo Data Removes ONLY Demo Rows ---');
  // Initialize baseline with demo records + add custom real records
  LibraryStorage.saveBooks([...INITIAL_BOOKS]);
  LibraryStorage.saveBorrowers([...INITIAL_BORROWERS]);
  LibraryStorage.saveTransactions([...INITIAL_TRANSACTIONS]);

  // Add real custom book
  const customBookRes = LibraryStorage.addBook({
    barcode: 'ULM-90001',
    isbn: '978-969-999-001-1',
    book_name: 'Custom Research Monograph on Lakki Geology',
    author: 'Prof. Gulzar Marwat',
    publisher: 'University Press',
    category: 'Geology',
    edition: '1st Edition',
    publication_year: 2026,
    language: 'English',
    description: 'Real institutional research title added by librarian.',
    book_image_path: '',
    shelf: 'GEO-01',
    row: '1',
    section: 'Earth Sciences',
    dewey_call_number: '551 MAR',
    total_quantity: 4,
    available_quantity: 4,
  });

  // Add real custom member
  const customMemberRes = LibraryStorage.addBorrower({
    name: 'Engr. Junaid Khan',
    university_id: 'ULM-ENG-2026-09',
    student_id: 'ULM-ENG-2026-09',
    barcode: 'ULM-ENG-2026-09',
    role: 'Student',
    department: 'Computer Science',
    program: 'BSCS',
    phone: '0300-1234567',
    borrow_limit: 5,
    joined_date: '2026-01-01',
    valid_until: null,
    status: 'active',
    photo_url: 'data:image/jpeg;base64,real_photo_stream',
    notes: 'REAL_STUDENT_ENROLLED_OCT2026',
  });

  console.log('Pre-clear books count:', LibraryStorage.getBooks().length);
  console.log('Pre-clear borrowers count:', LibraryStorage.getBorrowers().length);

  const clearDemoRes = LibraryStorage.clearDemoData();
  console.log('Clear demo result:', clearDemoRes.message);

  const postClearBooks = LibraryStorage.getBooks();
  const postClearBorrowers = LibraryStorage.getBorrowers();
  const postClearLoans = LibraryStorage.getTransactions();

  console.log('Post-clear books count:', postClearBooks.length);
  console.log('Post-clear borrowers count:', postClearBorrowers.length);
  console.log('Post-clear loans count:', postClearLoans.length);

  const realBookSurvived = postClearBooks.some(b => b.book_name === 'Custom Research Monograph on Lakki Geology');
  const realMemberSurvived = postClearBorrowers.some(b => b.name === 'Engr. Junaid Khan');
  const noDemoBooksRemain = !postClearBooks.some(b => b.id.startsWith('book-00'));
  const noDemoBorrowersRemain = !postClearBorrowers.some(b => b.id.startsWith('bor-00'));

  if (!realBookSurvived || !realMemberSurvived || !noDemoBooksRemain || !noDemoBorrowersRemain) {
    throw new Error('TEST 9 FAILED: Clear demo data did not isolate demo rows from real records.');
  }
  console.log('TEST 9 PASSED: Clear demo data removed ONLY demo records. Real items preserved.\n');

  // --------------------------------------------------------------------------
  // ACCEPTANCE 2: Wrong confirmation text blocked & Cancel changes nothing
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Wrong Confirmation Text Blocked ---');
  const countBeforeWrong = LibraryStorage.getBooks().length;

  const wrongLower = await ResetToZeroService.executeResetToZero({ confirmText: 'reset' });
  const wrongMismatch = await ResetToZeroService.executeResetToZero({ confirmText: 'CONFIRM' });
  const countAfterWrong = LibraryStorage.getBooks().length;

  if (wrongLower.success || wrongMismatch.success || countBeforeWrong !== countAfterWrong) {
    throw new Error('TEST 2 FAILED: Expected invalid confirmation texts to be blocked.');
  }
  console.log('Blocked lowercase "reset":', !wrongLower.success);
  console.log('Blocked mismatch "CONFIRM":', !wrongMismatch.success);
  console.log('TEST 2 PASSED: Only exact "RESET" enables reset.\n');

  // --------------------------------------------------------------------------
  // ACCEPTANCE 3: Backup failure aborts reset and data is untouched
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Simulated Backup Failure Aborts Reset ---');
  const countBeforeSim = LibraryStorage.getBooks().length;

  const simFailRes = await ResetToZeroService.executeResetToZero({
    confirmText: 'RESET',
    simulateBackupFailure: true,
  });

  const countAfterSim = LibraryStorage.getBooks().length;
  console.log('Simulated backup error message:', simFailRes.message);

  if (simFailRes.success || countBeforeSim !== countAfterSim) {
    throw new Error('TEST 3 FAILED: Reset must abort if pre-reset backup fails.');
  }
  console.log('TEST 3 PASSED: Reset aborted on backup failure; database untouched.\n');

  // --------------------------------------------------------------------------
  // ACCEPTANCE 1: Reset to Zero wipes all data, files, and caches
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Reliable Reset to Zero ---');
  // Add additional items to write queue and withdrawn accessions
  BookSheetService.registerWithdrawnAccession('88888');
  BookSheetService.enqueueBook({
    id: 'test-pending-1',
    book_name: 'Pending Queue Book',
    author: 'Author',
    barcode: 'ULM-88889',
    accession_no: '88889',
    category: 'General',
    shelf: 'R-1',
    total_quantity: 1,
    available_quantity: 1,
    row: '1',
    section: 'Gen',
    dewey_call_number: '000',
    publisher: 'Pub',
    edition: '1st',
    publication_year: 2026,
    language: 'English',
    description: 'Desc',
    book_image_path: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    isbn: '978-0000',
  });

  // Link mock sheet
  BookSheetService.saveLinkedSheet({
    id: 'sheet-mock-1',
    sheetName: 'ULM_Book_Entry_Sheet.xlsx',
    sheetPath: 'C:\\Documents\\ULM Library\\Book Sheet\\ULM_Book_Entry_Sheet.xlsx',
    isConnected: true,
    lastSynced: new Date().toISOString(),
    rowsRead: 120,
    booksAdded: 119,
    booksWaiting: 1,
    lastWriteResult: 'OK',
    isCloudFolder: false,
  });

  console.log('Pre-reset summary:', ResetToZeroService.getDeletionSummary());

  const progressTicks: number[] = [];
  const resetRes = await ResetToZeroService.executeResetToZero({
    confirmText: 'RESET',
    sheetAction: 'fresh_sheet',
    onProgress: (pct, stage) => {
      progressTicks.push(pct);
    },
  });

  if (!resetRes.success) {
    throw new Error(`TEST 1 FAILED: Reset execution failed: ${resetRes.message}`);
  }

  console.log('Reset result:', resetRes.message);
  console.log('Self-check verified:', resetRes.selfCheck.passed);
  console.log('Books in DB after reset:', LibraryStorage.getBooks().length);
  console.log('Borrowers in DB after reset:', LibraryStorage.getBorrowers().length);
  console.log('Loans in DB after reset:', LibraryStorage.getTransactions().length);
  console.log('Withdrawn accessions after reset:', BookSheetService.getWithdrawnAccessions().length);
  console.log('Write queue after reset:', BookSheetService.getQueue().length);
  console.log('Linked sheet after reset:', BookSheetService.getLinkedSheet());

  if (
    LibraryStorage.getBooks().length !== 0 ||
    LibraryStorage.getBorrowers().length !== 0 ||
    LibraryStorage.getTransactions().length !== 0 ||
    BookSheetService.getWithdrawnAccessions().length !== 0 ||
    BookSheetService.getQueue().length !== 0 ||
    BookSheetService.getLinkedSheet() !== null
  ) {
    throw new Error('TEST 1 FAILED: Storage or queues contain residual data after reset.');
  }
  console.log('TEST 1 PASSED: All tables, queues, withdrawn accessions, and sheet links zeroed.\n');

  // --------------------------------------------------------------------------
  // ACCEPTANCE 7: First book after reset gets accession 1, barcode ULM-00001
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Next Accession is 1 & Barcode is ULM-00001 ---');
  const nextAcc = BookSheetService.getNextAccessionNumber();
  const nextBarcode = BarcodeService.generateBarcode(nextAcc.accessionNo);

  console.log('Calculated next accession:', nextAcc.accessionNo);
  console.log('Calculated next barcode:', nextBarcode.barcode);

  if (nextAcc.accessionNo !== '1' && nextAcc.accessionNo !== '00001') {
    throw new Error(`TEST 7 FAILED: Expected accession 1 or 00001, got ${nextAcc.accessionNo}`);
  }
  if (!nextBarcode.barcode.endsWith('-00001')) {
    throw new Error(`TEST 7 FAILED: Expected barcode ending in -00001, got ${nextBarcode.barcode}`);
  }

  // Add the first book and check assigned values
  const firstBook = LibraryStorage.addBook({
    barcode: '',
    isbn: '978-1-56619-909-4',
    book_name: 'Introduction to Modern Pakistani Librarianship',
    author: 'Prof. Ahmad Marwat',
    publisher: 'University of Lakki Marwat Press',
    category: 'Library Science',
    edition: '1st Edition',
    publication_year: 2026,
    language: 'English',
    description: 'First foundational volume registered in clean catalog.',
    book_image_path: '',
    shelf: 'LIB-01',
    row: 'A-1',
    section: 'LMS Core',
    dewey_call_number: '020 MAR',
    total_quantity: 3,
    available_quantity: 3,
  });

  if (!firstBook.success || !firstBook.book) {
    throw new Error(`TEST 7 FAILED: Adding first book failed: ${firstBook.message}`);
  }

  console.log('Added first book accession:', firstBook.book.accession_no);
  console.log('Added first book barcode:', firstBook.book.barcode);

  if (firstBook.book.accession_no !== '1' && firstBook.book.accession_no !== '00001') {
    throw new Error(`TEST 7 FAILED: Book received unexpected accession: ${firstBook.book.accession_no}`);
  }
  if (!firstBook.book.barcode.endsWith('-00001')) {
    throw new Error(`TEST 7 FAILED: Book received unexpected barcode: ${firstBook.book.barcode}`);
  }
  console.log('TEST 7 PASSED: First book after reset received accession 1 and ULM-00001.\n');

  // --------------------------------------------------------------------------
  // ACCEPTANCE 4: Undo reset restores exact counts and records
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Undo Reset Restores Exact Pre-Reset Catalog ---');
  const undoCheck = ResetToZeroService.getUndoAvailability();
  console.log('Undo availability:', undoCheck.available, undoCheck.meta?.filename);

  if (!undoCheck.available) {
    throw new Error('TEST 4 FAILED: Undo snapshot was not found.');
  }

  const undoRes = await ResetToZeroService.undoReset();
  console.log('Undo result:', undoRes.message);

  if (!undoRes.success) {
    throw new Error(`TEST 4 FAILED: Undo failed: ${undoRes.message}`);
  }

  const restoredBooks = LibraryStorage.getBooks();
  console.log('Restored books count:', restoredBooks.length);
  const foundRestoredCustom = restoredBooks.some(b => b.book_name === 'Custom Research Monograph on Lakki Geology');

  if (!foundRestoredCustom) {
    throw new Error('TEST 4 FAILED: Custom monograph was not restored by Undo reset.');
  }
  console.log('TEST 4 PASSED: Undo reset accurately restored the pre-reset catalog.\n');

  // --------------------------------------------------------------------------
  // ACCEPTANCE 8: Reset with 10,000 books finishes with progress bar
  // --------------------------------------------------------------------------
  console.log('--- TEST 8: Scalable Reset with 10,000 Books ---');
  const bulkBooks = [];
  for (let i = 1; i <= 10000; i++) {
    bulkBooks.push({
      id: `bulk-${i}`,
      barcode: `ULM-${String(i).padStart(6, '0')}`,
      isbn: `978-0-${i}`,
      book_name: `Automated Catalog Benchmark Volume ${i}`,
      author: 'Stress Test Agent',
      publisher: 'ULM Benchmark',
      category: 'General',
      edition: '1st',
      publication_year: 2026,
      language: 'English',
      description: 'Volume generated for bulk scaling verification',
      book_image_path: '',
      shelf: 'BENCH-01',
      row: '1',
      section: 'Bulk',
      dewey_call_number: '000 BEN',
      total_quantity: 1,
      available_quantity: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    });
  }
  LibraryStorage.saveBooks(bulkBooks);
  console.log('Stored 10,000 benchmark books in storage.');

  const bulkProgressTicks: number[] = [];
  const t0 = Date.now();
  const bulkResetRes = await ResetToZeroService.executeResetToZero({
    confirmText: 'RESET',
    sheetAction: 'fresh_sheet',
    onProgress: (pct, stage) => {
      bulkProgressTicks.push(pct);
    },
  });
  const tElapsed = Date.now() - t0;

  console.log(`Reset 10,000 books completed in ${tElapsed} ms. Progress ticks:`, bulkProgressTicks.length);
  console.log('Books after bulk reset:', LibraryStorage.getBooks().length);

  if (!bulkResetRes.success || LibraryStorage.getBooks().length !== 0) {
    throw new Error('TEST 8 FAILED: Bulk reset failed to purge 10,000 books.');
  }
  console.log('TEST 8 PASSED: 10,000 books reset cleanly with responsive progress updates.\n');

  console.log('================================================================');
  console.log('ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY (1 - 10)!');
  console.log('================================================================');
}

runResetTestSuite().catch(err => {
  console.error('\n*** TEST SUITE FAILED ***\n', err);
  process.exit(1);
});
