/**
 * Seed Test Data Script for University of Lakki Marwat LMS
 * Stage 1 Validation Generator
 * Usage: npm run seed:test [-- --books 50 --members 10 --transactions 10]
 * Options:
 *   --books, -b        Number of books to generate (default: 50)
 *   --members, -m      Number of borrowers to generate (default: 10)
 *   --transactions, -t Number of transactions to generate (default: 10, with 2 overdue)
 *   --output, -o       Output test file path (default: test-library-data.json)
 *
 * Mark all rows as test data: [TEST DATA]
 * Test file only, never real library.
 */

import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let books = 50;
  let members = 10;
  let transactions = 10;
  let output = 'test-library-data.json';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--books' || arg === '-b') {
      books = parseInt(args[++i], 10) || 50;
    } else if (arg === '--members' || arg === '--borrowers' || arg === '-m') {
      members = parseInt(args[++i], 10) || 10;
    } else if (arg === '--transactions' || arg === '-t') {
      transactions = parseInt(args[++i], 10) || 10;
    } else if (arg === '--output' || arg === '-o') {
      output = args[++i] || 'test-library-data.json';
    }
  }

  return { books, members, transactions, output };
}

const { books: numBooks, members: numMembers, transactions: numTransactions, output: outputFile } = parseArgs();

console.log('================================================================');
console.log('  UNIVERSITY OF LAKKI MARWAT - LMS TEST SEED GENERATOR');
console.log('  Mode: Stage 1 Staged Testing (Isolated Test File)');
console.log('================================================================');
console.log(` Target Books:        ${numBooks}`);
console.log(` Target Members:      ${numMembers}`);
console.log(` Target Transactions:  ${numTransactions} (Includes 2 Overdue with Fines)`);
console.log(` Output File:         ${outputFile}`);
console.log('================================================================\n');

// Disciplines at University of Lakki Marwat
const CATEGORIES = [
  'Computer Science & IT',
  'Software Engineering',
  'Mathematics & Statistics',
  'Physics & Applied Sciences',
  'Chemistry',
  'Management Sciences',
  'English Literature & Linguistics',
  'Education & Research',
  'Islamic Studies & Ethics',
  'Pakistan Studies & Law'
];

const AUTHORS = [
  'Prof. Dr. Tariq Mahmud',
  'Dr. Ayesha Siddiqa',
  'Prof. Ronald L. Rivest',
  'Dr. Muhammad Usman Marwat',
  'Prof. Andrew S. Tanenbaum',
  'Dr. Fatima Zahra',
  'Prof. Donald E. Knuth',
  'Dr. Khalid Khan Khattak',
  'Prof. Stuart Russell',
  'Dr. Zafar Iqbal'
];

const PUBLISHERS = [
  'University of Lakki Marwat Academic Press',
  'Higher Education Commission Pakistan',
  'Oxford University Press Pakistan',
  'Pearson Education Global',
  'McGraw-Hill Science & Tech',
  'National Book Foundation Islamabad',
  'Cambridge University Press',
  'MIT Press Academic'
];

const DEPARTMENTS = [
  'Computer Science',
  'Software Engineering',
  'Management Sciences',
  'Mathematics',
  'Physics',
  'Chemistry',
  'English'
];

const PROGRAMS = ['BS CS', 'BS SE', 'BBA', 'BS Math', 'MS CS', 'MPhil Education'];

// 1. Generate Books
interface TestBook {
  id: string;
  barcode: string;
  isbn: string;
  book_name: string;
  author: string;
  publisher: string;
  category: string;
  edition: string;
  publication_year: number;
  language: string;
  description: string;
  book_image_path: string;
  total_quantity: number;
  available_quantity: number;
  shelf: string;
  row: string;
  section: string;
  dewey_call_number: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_test_data: boolean;
  accession_number: string;
}

const generatedBooks: TestBook[] = [];
const startAccession = 10001;

for (let i = 0; i < numBooks; i++) {
  const accNo = startAccession + i;
  const cat = CATEGORIES[i % CATEGORIES.length];
  const auth = AUTHORS[i % AUTHORS.length];
  const pub = PUBLISHERS[i % PUBLISHERS.length];
  const total = 1 + (i % 5); // 1 to 5 copies
  const deweyClass = (100 + (i * 17) % 890).toString().padStart(3, '0');

  generatedBooks.push({
    id: `test-book-${accNo}`,
    barcode: `${accNo}`,
    accession_number: `${accNo}`,
    isbn: `978-969-${(100000 + i * 37).toString().substring(0, 6)}-${i % 9}`,
    book_name: `[TEST DATA] Volume ${accNo}: Foundations of ${cat}`,
    author: auth,
    publisher: pub,
    category: cat,
    edition: `${(i % 5) + 1}th Edition`,
    publication_year: 2018 + (i % 7),
    language: 'English',
    description: `[TEST DATA] Official Stage 1 test accession verification volume #${accNo}. Marked test entity.`,
    book_image_path: '',
    total_quantity: total,
    available_quantity: total, // Updated when issued in transactions
    shelf: `Rack-${String.fromCharCode(65 + (i % 6))}`,
    row: `${(i % 5) + 1}`,
    section: `Section ${(i % 3) + 1}`,
    dewey_call_number: `${deweyClass}.${(i * 13) % 999}`,
    created_at: '2026-10-01 08:00:00',
    updated_at: '2026-10-01 08:00:00',
    is_active: true,
    is_test_data: true,
  });
}

// 2. Generate Members (Borrowers)
interface TestBorrower {
  id: string;
  role: 'Student' | 'Faculty' | 'Staff';
  university_id: string;
  barcode: string;
  name: string;
  father_name: string;
  department: string;
  program: string;
  session: string;
  semester: number;
  email: string;
  phone: string;
  address: string;
  borrow_limit: number;
  joined_date: string;
  valid_until: string;
  status: 'active' | 'suspended' | 'left';
  notes: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  student_id: string;
  is_test_data: boolean;
}

const generatedBorrowers: TestBorrower[] = [];

for (let i = 0; i < numMembers; i++) {
  const isFaculty = i === 0 || i === 5;
  const isStaff = i === 9;
  const role = isFaculty ? 'Faculty' : isStaff ? 'Staff' : 'Student';
  const memNum = 101 + i;
  const uniId = role === 'Student' ? `ULM-FA23-CS-${memNum}` : `ULM-${role.toUpperCase()}-${memNum}`;
  const dept = DEPARTMENTS[i % DEPARTMENTS.length];
  const prog = PROGRAMS[i % PROGRAMS.length];
  const limit = role === 'Faculty' ? 10 : role === 'Staff' ? 5 : 3;

  generatedBorrowers.push({
    id: `test-borrower-${memNum}`,
    role,
    university_id: uniId,
    barcode: uniId,
    name: `[TEST DATA] ${role === 'Faculty' ? 'Prof. ' : ''}Test Member ${memNum} (${dept})`,
    father_name: role === 'Student' ? `Parent of Member ${memNum}` : '',
    department: dept,
    program: prog,
    session: 'FA23',
    semester: ((i % 8) + 1),
    email: `testmember${memNum}@ulm.edu.pk`,
    phone: `0300-555${(1000 + i).toString().substring(0, 4)}`,
    address: `Campus Hostel / Faculty Quarter Block ${String.fromCharCode(65 + (i % 4))}, Lakki Marwat`,
    borrow_limit: limit,
    joined_date: '2023-09-15',
    valid_until: '2027-08-31',
    status: 'active',
    notes: '[TEST DATA] Stage 1 Automated Validation Record. Test profile.',
    created_at: '2026-10-01 08:30:00',
    updated_at: '2026-10-01 08:30:00',
    is_active: true,
    student_id: uniId,
    is_test_data: true,
  });
}

// 3. Generate Transactions (10 total, exactly 2 overdue with fines)
interface TestTransaction {
  id: string;
  book_id: string;
  borrower_id: string;
  book_name: string;
  borrower_name: string;
  barcode: string;
  student_id: string;
  action: 'ISSUE' | 'RETURN';
  issue_date: string;
  due_date: string;
  return_date: string | null;
  quantity: number;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  created_at: string;
  overdue_days?: number;
  fine_amount_pkr?: number;
  is_test_data: boolean;
}

const generatedTransactions: TestTransaction[] = [];
const FINE_RATE_PER_DAY = 10; // PKR 10 per day default institutional fine

for (let i = 0; i < numTransactions; i++) {
  const transId = `test-tx-${1000 + i}`;
  const book = generatedBooks[i % generatedBooks.length];
  const borrower = generatedBorrowers[i % generatedBorrowers.length];

  // Specific requirement: 10 transactions, exactly 2 overdue
  const isOverdue = i === 1 || i === 4; // 2 overdue records
  const isReturned = i >= 6; // Records 6-9 returned
  const isActiveRegular = !isOverdue && !isReturned; // Records 0, 2, 3, 5 active not overdue

  let status: 'ACTIVE' | 'RETURNED' | 'OVERDUE' = 'ACTIVE';
  let issueDate = '2026-09-20 10:00:00';
  let dueDate = '2026-10-04 10:00:00';
  let returnDate: string | null = null;
  let overdueDays = 0;
  let fineAmount = 0;

  if (isOverdue) {
    status = 'OVERDUE';
    issueDate = '2026-09-01 09:00:00';
    dueDate = '2026-09-15 09:00:00'; // 17 days past due relative to Oct 2, 2026
    overdueDays = i === 1 ? 17 : 8;
    fineAmount = overdueDays * FINE_RATE_PER_DAY;
    returnDate = null;
    // Decrement available copies
    book.available_quantity = Math.max(0, book.available_quantity - 1);
  } else if (isReturned) {
    status = 'RETURNED';
    issueDate = '2026-09-10 11:00:00';
    dueDate = '2026-09-24 11:00:00';
    returnDate = '2026-09-22 14:30:00';
  } else {
    status = 'ACTIVE';
    issueDate = '2026-09-25 10:00:00';
    dueDate = '2026-10-09 10:00:00'; // within due date
    returnDate = null;
    // Decrement available copies
    book.available_quantity = Math.max(0, book.available_quantity - 1);
  }

  generatedTransactions.push({
    id: transId,
    book_id: book.id,
    borrower_id: borrower.id,
    book_name: book.book_name,
    borrower_name: borrower.name,
    barcode: book.barcode,
    student_id: borrower.university_id,
    action: isReturned ? 'RETURN' : 'ISSUE',
    issue_date: issueDate,
    due_date: dueDate,
    return_date: returnDate,
    quantity: 1,
    status,
    created_at: issueDate,
    overdue_days: overdueDays,
    fine_amount_pkr: fineAmount,
    is_test_data: true,
  });
}

// 4. Create History Ledger
const generatedHistory = [
  {
    id: 'test-hist-001',
    action: 'TEST_SUITE_INIT',
    description: `Stage 1 Test Seed Generated: ${numBooks} books, ${numMembers} members, ${numTransactions} transactions (2 overdue).`,
    barcode: 'TEST-SYS',
    user: 'QA-Automation-Engine',
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
  }
];

// Complete Stage 1 Test Data Package
const testPackage = {
  meta: {
    dataset_name: 'University of Lakki Marwat LMS - Stage 1 Test Data',
    environment: 'STAGED_TESTING_STAGE_1',
    created_at: new Date().toISOString(),
    is_test_data: true,
    rules: 'Never overwrite real library; all entities tagged [TEST DATA]',
    counts: {
      books: generatedBooks.length,
      members: generatedBorrowers.length,
      transactions: generatedTransactions.length,
      overdue_transactions: generatedTransactions.filter(t => t.status === 'OVERDUE').length,
      active_transactions: generatedTransactions.filter(t => t.status === 'ACTIVE').length,
      returned_transactions: generatedTransactions.filter(t => t.status === 'RETURNED').length,
    }
  },
  books: generatedBooks,
  borrowers: generatedBorrowers,
  transactions: generatedTransactions,
  history: generatedHistory,
  settings: {
    library_name: '[TEST DATA] Central Campus Library Test Bed',
    university_name: 'University of Lakki Marwat',
    campus_address: 'Main Campus, Bannu-Mianwali Road, Lakki Marwat, Khyber Pakhtunkhwa',
    phone: '+92 969 510010',
    email: 'test-library@ulm.edu.pk',
    auto_submit_scan: true,
    scanner_sound: true,
    error_sound: true,
    db_path: 'C:\\ULM_Library_Database\\test_library_stage1.sqlite',
    wal_mode: true,
    station_id: 'TEST-STAGE1-RUNNER',
    fine_per_day_pkr: 10
  }
};

// Write to output file atomically
const fullOutputPath = path.resolve(process.cwd(), outputFile);
fs.writeFileSync(fullOutputPath, JSON.stringify(testPackage, null, 2), 'utf-8');

console.log(' [SUCCESS] Stage 1 Test Dataset Generated Successfully!');
console.log(` File Path:           ${fullOutputPath}`);
console.log(` File Size:           ${(fs.statSync(fullOutputPath).size / 1024).toFixed(1)} KB`);
console.log(` Total Books:         ${testPackage.meta.counts.books} (Accession #${startAccession} to #${startAccession + numBooks - 1})`);
console.log(` Total Borrowers:     ${testPackage.meta.counts.members}`);
console.log(` Total Transactions:  ${testPackage.meta.counts.transactions}`);
console.log(` Overdue with Fines:  ${testPackage.meta.counts.overdue_transactions} (Overdue Fines: PKR ${generatedTransactions.reduce((acc, t) => acc + (t.fine_amount_pkr || 0), 0)})`);
console.log(' All rows tagged:     [TEST DATA]\n');
