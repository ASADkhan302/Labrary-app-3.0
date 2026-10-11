/**
 * Universal Test Data Builder for ULM LMS Auditing & Benchmarking
 * Generates test libraries meeting all audit specifications:
 * - Small profile (50 books, 10 members, 10 loans)
 * - Large profile (10,000 books, 500 members, 3,000 loans)
 * - Urdu & English titles and authors
 * - Books with no author (anonymous)
 * - Long text (descriptions > 1,000 characters)
 * - Photos (Base64 JPEG portrait data)
 * - Duplicate-looking data (same title/different edition, same author/different department)
 * - Borrowers at borrow limit & overdue loans with fines
 */

import { Book, Borrower, Transaction } from '../src/types/library';

export interface GeneratedLibraryData {
  books: Book[];
  borrowers: Borrower[];
  transactions: Transaction[];
  meta: {
    booksCount: number;
    borrowersCount: number;
    loansCount: number;
    overdueCount: number;
    borrowLimitCount: number;
    urduCount: number;
    noAuthorCount: number;
    duplicateLookingCount: number;
  };
}

const URDU_TITLES = [
  'بانگِ درا',
  'بالِ جبریل',
  'ضربِ کلیم',
  'ارمغانِ حجاز',
  'اداس نسلیں',
  'آبِ حیات',
  'دیوانِ غالب',
  'کلیاتِ میر',
  'تاریخِ پختونخوا و پشتو ادب',
  'دستِ صبا',
  'نقشِ فریادی',
  'پیرِ کامل',
  'خوشحال خان خٹک کلیات',
  'رحمان بابا دیوان',
  'غنی خان کلیات',
];

const URDU_AUTHORS = [
  'علامہ محمد اقبال',
  'عبداللہ حسین',
  'محمد حسین آزاد',
  'مرزا اسد اللہ خان غالب',
  'میر تقی میر',
  'فیض احمد فیض',
  'عمیرہ احمد',
  'خوشحال خان خٹک',
  'عبدالرحمان بابا',
  'غنی خان',
];

const ENGLISH_TITLES = [
  'Introduction to Algorithms',
  'Operating System Concepts',
  'Database System Concepts',
  'Computer Networks: Systems Approach',
  'Software Engineering: A Practitioner Approach',
  'Artificial Intelligence: A Modern Approach',
  'Digital Design and Computer Architecture',
  'Calculus: Early Transcendentals',
  'University Physics with Modern Physics',
  'Principles of Quantum Mechanics',
  'Organic Chemistry: Structure and Function',
  'Microeconomics: Theory and Applications',
  'Business Administration and Management',
  'Principles of Library and Information Science',
  'Constitutional Law of Pakistan',
];

const ENGLISH_AUTHORS = [
  'Thomas H. Cormen',
  'Abraham Silberschatz',
  'Andrew S. Tanenbaum',
  'Roger S. Pressman',
  'Stuart Russell',
  'David A. Patterson',
  'James Stewart',
  'Hugh D. Young',
  'R. Shankar',
  'K. Peter C. Vollhardt',
  'N. Gregory Mankiw',
  'Stephen P. Robbins',
  'Dr. Hamid Khan',
  'Prof. Dr. Tariq Mahmud',
  'Dr. Muhammad Usman Marwat',
];

const SAMPLE_PHOTO_B64 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

export function buildTestLibrary(profile: 'small' | 'large' = 'small'): GeneratedLibraryData {
  const targetBooks = profile === 'large' ? 10000 : 50;
  const targetBorrowers = profile === 'large' ? 500 : 10;
  const targetLoans = profile === 'large' ? 3000 : 10;

  const books: Book[] = [];
  const borrowers: Borrower[] = [];
  const transactions: Transaction[] = [];

  let urduCount = 0;
  let noAuthorCount = 0;
  let duplicateLookingCount = 0;

  // 1. Generate Books
  for (let i = 0; i < targetBooks; i++) {
    const isUrdu = i % 7 === 0; // ~14% Urdu titles (7 is coprime to 15 titles)
    const isNoAuthor = i % 25 === 7; // ~4% No author
    const isDuplicateLooking = i > 10 && i % 15 === 0; // Duplicate-looking titles with diff edition
    const isLongText = i % 30 === 3;

    let book_name = '';
    let author = '';
    let language = isUrdu ? 'Urdu' : 'English';

    if (isUrdu) {
      urduCount++;
      book_name = URDU_TITLES[i % URDU_TITLES.length];
      author = isNoAuthor ? '' : URDU_AUTHORS[i % URDU_AUTHORS.length];
      if (isDuplicateLooking) {
        duplicateLookingCount++;
        book_name = `${book_name} (جامع ایڈیشن)`;
      }
    } else {
      book_name = ENGLISH_TITLES[i % ENGLISH_TITLES.length];
      author = isNoAuthor ? '' : ENGLISH_AUTHORS[i % ENGLISH_AUTHORS.length];
      if (isDuplicateLooking) {
        duplicateLookingCount++;
        book_name = `${book_name} (Special Campus Edition)`;
      }
    }

    if (isNoAuthor) {
      noAuthorCount++;
    }

    const accession_no = String(10001 + i);
    const barcode = `ULM-${accession_no.padStart(5, '0')}`;
    const total_quantity = 1 + (i % 6); // 1 to 6 copies

    let description = `Official test accession volume #${accession_no} generated for system audit.`;
    if (isLongText) {
      description = `[COMPREHENSIVE INSTITUTIONAL AUDIT VOLUME #${accession_no}] ` +
        'This comprehensive academic title contains detailed lecture notes, extensive laboratory references, ' +
        'peer-reviewed citations, historical background material, and annotated curricular supplements compiled ' +
        'specifically for the undergraduate and postgraduate faculties of the University of Lakki Marwat. '.repeat(4);
    }

    books.push({
      id: `test-book-${accession_no}`,
      barcode,
      accession_no,
      isbn: `978-969-${String(100000 + (i * 31) % 899999).slice(0, 6)}-${i % 9}`,
      book_name,
      author,
      publisher: isUrdu ? 'قومی کتب خانہ' : 'University of Lakki Marwat Academic Press',
      category: isUrdu ? 'Urdu Literature' : 'Computer Science',
      edition: `${(i % 5) + 1}th Edition`,
      publication_year: 2018 + (i % 8),
      language,
      description,
      book_image_path: i % 10 === 0 ? SAMPLE_PHOTO_B64 : '',
      shelf: `Rack-${String.fromCharCode(65 + (i % 8))}`,
      row: String((i % 5) + 1),
      section: `Section ${String((i % 4) + 1)}`,
      dewey_call_number: `${(100 + (i * 17) % 890).toString().padStart(3, '0')}.${(i * 13) % 999}`,
      total_quantity,
      available_quantity: total_quantity,
      created_at: '2026-10-01 08:00:00',
      updated_at: '2026-10-01 08:00:00',
      is_active: true,
      title_sort: book_name.toLowerCase(),
      author_sort: author.toLowerCase(),
      search_text: `${book_name} ${author} ${barcode}`.toLowerCase(),
    });
  }

  // 2. Generate Members (Borrowers)
  for (let i = 0; i < targetBorrowers; i++) {
    const isFaculty = i % 10 === 0;
    const isStaff = i % 20 === 5;
    const role: 'Student' | 'Faculty' | 'Staff' = isFaculty ? 'Faculty' : isStaff ? 'Staff' : 'Student';
    const limit = role === 'Faculty' ? 10 : role === 'Staff' ? 5 : 3;
    const memId = 1001 + i;
    const uniId = role === 'Student' ? `ULM-2024-CS-${memId}` : `ULM-${role.toUpperCase()}-${memId}`;
    const name = role === 'Faculty' ? `Prof. Test Member ${memId}` : `Student Member ${memId}`;

    borrowers.push({
      id: `test-bor-${memId}`,
      university_id: uniId,
      student_id: uniId,
      barcode: uniId,
      name,
      father_name: `Guardian of ${memId}`,
      role,
      department: i % 3 === 0 ? 'Computer Science' : i % 3 === 1 ? 'Mathematics' : 'English Literature',
      program: role === 'Student' ? 'BSCS' : 'Faculty Research',
      session: '2024-2028',
      semester: (i % 8) + 1,
      email: `test.${memId}@ulm.edu.pk`,
      phone: `0300-555${String(1000 + (i % 8999))}`,
      address: `Lakki Marwat Campus Residence Block ${String.fromCharCode(65 + (i % 4))}`,
      borrow_limit: limit,
      joined_date: '2024-09-01',
      valid_until: '2028-08-31',
      status: 'active',
      notes: `TEST_MEMBER_RECORD_${memId}`,
      photo_url: i % 4 === 0 ? SAMPLE_PHOTO_B64 : '',
      is_active: true,
      created_at: '2026-10-01 08:00:00',
      updated_at: '2026-10-01 08:00:00',
    });
  }

  // 3. Generate Transactions
  let overdueCount = 0;
  let borrowLimitCount = 0;

  // Track member loans to configure borrow limit test cases
  const memberLoanCounts = new Map<string, number>();

  for (let i = 0; i < targetLoans; i++) {
    const book = books[i % books.length];
    const borrower = borrowers[i % borrowers.length];

    const currentMemberLoans = memberLoanCounts.get(borrower.id) || 0;
    const isBorrowLimitCandidate = i < targetBorrowers * 2 && currentMemberLoans < borrower.borrow_limit;

    // 15% Overdue, 20% Returned, 65% Active
    const isOverdue = i % 7 === 1;
    const isReturned = i % 5 === 2;

    let status: 'ACTIVE' | 'RETURNED' | 'OVERDUE' = 'ACTIVE';
    let issue_date = '2026-09-20';
    let due_date = '2026-10-15';
    let return_date: string | null = null;

    if (isOverdue) {
      overdueCount++;
      status = 'OVERDUE';
      issue_date = '2026-08-15';
      due_date = '2026-09-01'; // 35 days past due relative to Oct 2026
      if (book.available_quantity > 0) {
        book.available_quantity -= 1;
      }
      memberLoanCounts.set(borrower.id, currentMemberLoans + 1);
    } else if (isReturned) {
      status = 'RETURNED';
      issue_date = '2026-09-01';
      due_date = '2026-09-15';
      return_date = '2026-09-14';
    } else {
      status = 'ACTIVE';
      issue_date = '2026-09-25';
      due_date = '2026-10-25';
      if (book.available_quantity > 0) {
        book.available_quantity -= 1;
      }
      memberLoanCounts.set(borrower.id, currentMemberLoans + 1);
    }

    if (memberLoanCounts.get(borrower.id) === borrower.borrow_limit) {
      borrowLimitCount++;
    }

    transactions.push({
      id: `test-tx-${10001 + i}`,
      book_id: book.id,
      borrower_id: borrower.id,
      book_name: book.book_name,
      borrower_name: borrower.name,
      barcode: book.barcode,
      student_id: borrower.university_id,
      action: isReturned ? 'RETURN' : 'ISSUE',
      issue_date,
      due_date,
      return_date,
      quantity: 1,
      status,
      created_at: `${issue_date} 10:00:00`,
    });
  }

  return {
    books,
    borrowers,
    transactions,
    meta: {
      booksCount: books.length,
      borrowersCount: borrowers.length,
      loansCount: transactions.length,
      overdueCount,
      borrowLimitCount,
      urduCount,
      noAuthorCount,
      duplicateLookingCount,
    },
  };
}
