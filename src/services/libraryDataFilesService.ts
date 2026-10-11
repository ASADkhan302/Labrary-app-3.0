import ExcelJS from 'exceljs';
import { Book, Borrower, Transaction } from '../types/library';
import { LibraryStorage } from './storage';
import { BarcodeService } from './barcodeService';
import { UsbBackupService } from './usbBackupService';
import { isArabicOrUrduScript } from '../utils/urduUtils';

export interface DataFileHashes {
  xlsxHash?: string;
  booksCsvHash?: string;
  membersCsvHash?: string;
  transactionsCsvHash?: string;
  lastUpdated: string;
}

export interface TableDiff<T> {
  newRows: T[];
  changedRows: { id: string; oldData: T; newData: T; changedFields: string[] }[];
  missingRows: T[];
}

export interface ExternalChangesSummary {
  hasChanges: boolean;
  isConflict: boolean; // xlsx and csv both changed differently
  booksDiff: TableDiff<Partial<Book>>;
  membersCount: number;
  transactionsCount: number;
  message: string;
}

export class LibraryDataFilesService {
  private static syncTimer: any = null;
  private static isSyncing = false;
  private static HASH_STORAGE_KEY = 'ulm_lms_data_files_hashes_v1';

  /**
   * Schedules debounced write to data files within 30 seconds of any mutation
   */
  static scheduleSync(delayMs: number = 30000): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.writeLibraryDataFiles().catch(err => {
        console.warn('Background data files auto-sync notice:', err.message);
      });
    }, delayMs);
  }

  /**
   * Cancels any pending background sync timer
   */
  static cancelScheduledSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Generates LibraryData.xlsx workbook with Books, Members, Transactions, and About sheets
   */
  static async generateLibraryDataWorkbook(
    books: Book[],
    borrowers: Borrower[],
    transactions: Transaction[]
  ): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'University of Lakki Marwat LMS';
    workbook.created = new Date();

    // ------------------------------------------------------------------------
    // SHEET 1: BOOKS
    // ------------------------------------------------------------------------
    const booksSheet = workbook.addWorksheet('Books', {
      views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
    });

    booksSheet.columns = [
      { header: 'Record ID', key: 'record_id', width: 22 },
      { header: 'Accession No', key: 'accession_no', width: 16 },
      { header: 'Barcode', key: 'barcode', width: 18 },
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
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Dewey Call Number', key: 'call_number', width: 18 },
      { header: 'Shelf', key: 'shelf', width: 16 },
      { header: 'Status', key: 'status', width: 16 },
    ];

    // Style Header Row
    const bHeader = booksSheet.getRow(1);
    bHeader.height = 26;
    bHeader.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      if (colNumber === 1) {
        // Grey header for Record ID
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
        cell.note = 'Record ID: Managed automatically by LMS database. Do NOT edit.';
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF541A72' } };
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBC881B' } },
        bottom: { style: 'medium', color: { argb: 'FFBC881B' } },
      };
    });

    const activeBooks = books.filter(b => b.is_active);
    for (const b of activeBooks) {
      const placePub = b.place && b.publisher
        ? `${b.place}: ${b.publisher}`
        : (b.publisher || b.place || 'ULM Press');

      const status = b.available_quantity <= 0
        ? 'Issued'
        : b.available_quantity <= 2
        ? 'Low Stock'
        : 'Available';

      const row = booksSheet.addRow({
        record_id: b.id,
        accession_no: b.accession_no || b.barcode.replace(/^[A-Z]+-/, ''),
        barcode: b.barcode,
        author: b.author,
        title: b.book_name,
        edition: b.edition || '1st Edition',
        place_publisher: placePub,
        year: b.publication_year || 2024,
        pages: b.pages || 350,
        price: b.price || 0,
        binding: b.binding || 'HB',
        isbn: b.isbn,
        remarks: b.source_remarks || b.description || '',
        date_added: b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '2024-01-01'),
        language: b.language || 'English',
        category: b.category,
        call_number: b.dewey_call_number,
        shelf: b.shelf,
        status,
      });

      row.height = 20;

      // Text format for ISBN, Barcode, Accession
      row.getCell('accession_no').numFmt = '@';
      row.getCell('barcode').numFmt = '@';
      row.getCell('isbn').numFmt = '@';

      // Grey out Record ID column to visually discourage editing
      const recCell = row.getCell('record_id');
      recCell.font = { color: { argb: 'FF94A3B8' }, size: 9 };
      recCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      // RTL for Urdu text
      if (b.language?.toLowerCase() === 'urdu' || isArabicOrUrduScript(b.book_name)) {
        row.getCell('title').alignment = { horizontal: 'right', readingOrder: 'rtl' };
        row.getCell('author').alignment = { horizontal: 'right', readingOrder: 'rtl' };
      }
    }

    // Set Data Validation dropdowns for rows 2 to max
    const maxRow = Math.max(activeBooks.length + 50, 100);
    for (let r = 2; r <= maxRow; r++) {
      const row = booksSheet.getRow(r);
      row.getCell('language').dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"English,Urdu,Arabic,Pashto,Other"'],
      };
      row.getCell('binding').dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Hardbound,Paperback,Spiral,Other"'],
      };
      row.getCell('status').dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Available,Issued,Low Stock"'],
      };
    }

    // ------------------------------------------------------------------------
    // SHEET 2: MEMBERS
    // ------------------------------------------------------------------------
    const memSheet = workbook.addWorksheet('Members', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    memSheet.columns = [
      { header: 'Record ID', key: 'id', width: 22 },
      { header: 'University ID / Barcode', key: 'uni_id', width: 22 },
      { header: 'Role', key: 'role', width: 14 },
      { header: 'Full Name', key: 'name', width: 26 },
      { header: 'Department', key: 'department', width: 24 },
      { header: 'Program / Designation', key: 'program', width: 22 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Joined Date', key: 'joined', width: 16 },
      { header: 'Borrow Limit', key: 'limit', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
    ];

    const mHeader = memSheet.getRow(1);
    mHeader.height = 26;
    mHeader.eachCell((cell, colNum) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNum === 1 ? 'FF475569' : 'FF29658E' }, // Slate Blue
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    for (const m of borrowers.filter(b => b.is_active)) {
      const row = memSheet.addRow({
        id: m.id,
        uni_id: m.university_id || m.student_id,
        role: m.role || 'Student',
        name: m.name,
        department: m.department,
        program: m.program || m.designation || '',
        phone: m.phone,
        email: m.email || '',
        joined: m.joined_date || m.created_at.split(' ')[0],
        limit: m.borrow_limit || 3,
        status: m.status || 'active',
      });
      row.getCell('uni_id').numFmt = '@';
    }

    // ------------------------------------------------------------------------
    // SHEET 3: TRANSACTIONS
    // ------------------------------------------------------------------------
    const txSheet = workbook.addWorksheet('Transactions', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    txSheet.columns = [
      { header: 'Transaction ID', key: 'id', width: 22 },
      { header: 'Book Barcode', key: 'barcode', width: 18 },
      { header: 'Book Title', key: 'title', width: 34 },
      { header: 'Member ID', key: 'member_id', width: 18 },
      { header: 'Member Name', key: 'member_name', width: 24 },
      { header: 'Action', key: 'action', width: 14 },
      { header: 'Issue Date', key: 'issue_date', width: 16 },
      { header: 'Due Date', key: 'due_date', width: 16 },
      { header: 'Return Date', key: 'return_date', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
    ];

    const tHeader = txSheet.getRow(1);
    tHeader.height = 26;
    tHeader.eachCell((cell, colNum) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNum === 1 ? 'FF475569' : 'FF541A72' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    for (const t of transactions) {
      txSheet.addRow({
        id: t.id,
        barcode: t.barcode || '',
        title: t.book_name || '',
        member_id: t.student_id || '',
        member_name: t.borrower_name || '',
        action: t.action,
        issue_date: t.issue_date,
        due_date: t.due_date,
        return_date: t.return_date || 'N/A',
        status: t.status,
      });
    }

    // ------------------------------------------------------------------------
    // SHEET 4: ABOUT & EDITING RULES
    // ------------------------------------------------------------------------
    const aboutSheet = workbook.addWorksheet('About');
    aboutSheet.columns = [{ width: 85 }];
    aboutSheet.addRow(['UNIVERSITY OF LAKKI MARWAT - CENTRAL LIBRARY']).font = { bold: true, size: 14, color: { argb: 'FF541A72' } };
    aboutSheet.addRow(['LIBRARY DATA REPOSITORY SPECIFICATION & TWO-WAY SYNC RULES']).font = { bold: true, size: 11 };
    aboutSheet.addRow([]);
    aboutSheet.addRow(['1. The SQLite Database remains the engine and ultimate source of truth.']);
    aboutSheet.addRow(['2. This workbook is regenerated automatically when changes occur in the application.']);
    aboutSheet.addRow(['3. You may edit titles, authors, shelves, and add new rows in Excel while the app is closed.']);
    aboutSheet.addRow(['4. DO NOT EDIT the "Record ID" column: it is required for matching existing records.']);
    aboutSheet.addRow(['5. DO NOT EDIT barcodes manually: barcodes are immutable once generated.']);
    aboutSheet.addRow(['6. When you launch the LMS, any external modifications are detected and a confirmation dialog is presented.']);

    return workbook;
  }

  /**
   * Generates sanitized RFC-4180 CSV with UTF-8 BOM and formula injection neutralization
   */
  static generateBooksCsv(books: Book[]): string {
    const headers = [
      'Record ID',
      'Accession No',
      'Barcode',
      'Author',
      'Title',
      'Edition',
      'Place & Publisher',
      'Year',
      'Pages',
      'Price (Rs/Ps)',
      'Binding',
      'ISBN',
      'Source / Remarks',
      'Date Added',
      'Language',
      'Category',
      'Dewey Call Number',
      'Shelf',
      'Status',
    ];

    const lines: string[] = [headers.join(',')];

    for (const b of books.filter(b => b.is_active)) {
      const placePub = b.place && b.publisher
        ? `${b.place}: ${b.publisher}`
        : (b.publisher || b.place || 'ULM Press');

      const status = b.available_quantity <= 0
        ? 'Issued'
        : b.available_quantity <= 2
        ? 'Low Stock'
        : 'Available';

      const fields = [
        b.id,
        b.accession_no || b.barcode.replace(/^[A-Z]+-/, ''),
        b.barcode,
        b.author,
        b.book_name,
        b.edition || '1st Edition',
        placePub,
        String(b.publication_year || 2024),
        String(b.pages || 350),
        String(b.price || 0),
        b.binding || 'HB',
        b.isbn,
        b.source_remarks || b.description || '',
        b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '2024-01-01'),
        b.language || 'English',
        b.category,
        b.dewey_call_number,
        b.shelf,
        status,
      ];

      const escaped = fields.map(val => {
        let text = String(val ?? '').replace(/"/g, '""');
        // Neutralize CSV formula injection
        if (/^[=+\-@]/.test(text)) {
          text = `'${text}`;
        }
        return `"${text}"`;
      });

      lines.push(escaped.join(','));
    }

    return '\uFEFF' + lines.join('\r\n');
  }

  /**
   * Generates members.csv
   */
  static generateMembersCsv(borrowers: Borrower[]): string {
    const headers = ['Record ID', 'University ID', 'Role', 'Name', 'Department', 'Program', 'Phone', 'Email', 'Joined Date', 'Status'];
    const lines = [headers.join(',')];

    for (const m of borrowers.filter(b => b.is_active)) {
      const fields = [
        m.id,
        m.university_id || m.student_id,
        m.role || 'Student',
        m.name,
        m.department,
        m.program || m.designation || '',
        m.phone,
        m.email || '',
        m.joined_date || m.created_at.split(' ')[0],
        m.status || 'active',
      ];
      const escaped = fields.map(f => {
        let text = String(f ?? '').replace(/"/g, '""');
        if (/^[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text}"`;
      });
      lines.push(escaped.join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  /**
   * Generates transactions.csv
   */
  static generateTransactionsCsv(transactions: Transaction[]): string {
    const headers = ['Transaction ID', 'Barcode', 'Book Title', 'Member ID', 'Member Name', 'Action', 'Issue Date', 'Due Date', 'Return Date', 'Status'];
    const lines = [headers.join(',')];

    for (const t of transactions) {
      const fields = [
        t.id,
        t.barcode || '',
        t.book_name || '',
        t.student_id || '',
        t.borrower_name || '',
        t.action,
        t.issue_date,
        t.due_date,
        t.return_date || 'N/A',
        t.status,
      ];
      const escaped = fields.map(f => {
        let text = String(f ?? '').replace(/"/g, '""');
        if (/^[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text}"`;
      });
      lines.push(escaped.join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  /**
   * Writes the data files to the active library folder handle if available,
   * otherwise stores snapshots and checksums in storage.
   */
  static async writeLibraryDataFiles(): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) return { success: true, message: 'Sync already in flight' };
    this.isSyncing = true;

    try {
      const books = LibraryStorage.getBooks();
      const borrowers = LibraryStorage.getBorrowers();
      const transactions = LibraryStorage.getTransactions();

      const workbook = await this.generateLibraryDataWorkbook(books, borrowers, transactions);
      const xlsxBuffer = await workbook.xlsx.writeBuffer();
      const booksCsv = this.generateBooksCsv(books);
      const membersCsv = this.generateMembersCsv(borrowers);
      const txCsv = this.generateTransactionsCsv(transactions);

      // Compute SHA-256 for integrity and change tracking
      const sha256 = async (data: string | ArrayBuffer) => {
        const buf = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const [xlsxHash, booksCsvHash, membersCsvHash, txCsvHash] = await Promise.all([
        sha256(xlsxBuffer),
        sha256(booksCsv),
        sha256(membersCsv),
        sha256(txCsv),
      ]);

      const hashes: DataFileHashes = {
        xlsxHash,
        booksCsvHash,
        membersCsvHash,
        transactionsCsvHash: txCsvHash,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.HASH_STORAGE_KEY, JSON.stringify(hashes));

      // If Directory Handle is open (File System Access API), write files to disk
      const dirHandle = LibraryStorage.getDirectoryHandle();
      if (dirHandle) {
        try {
          // Write LibraryData.xlsx
          const xlsxHandle = await dirHandle.getFileHandle('LibraryData.xlsx', { create: true });
          const xlsxWritable = await xlsxHandle.createWritable();
          await xlsxWritable.write(xlsxBuffer);
          await xlsxWritable.close();

          // Write books.csv
          const bHandle = await dirHandle.getFileHandle('books.csv', { create: true });
          const bWritable = await bHandle.createWritable();
          await bWritable.write(booksCsv);
          await bWritable.close();

          // Write members.csv
          const mHandle = await dirHandle.getFileHandle('members.csv', { create: true });
          const mWritable = await mHandle.createWritable();
          await mWritable.write(membersCsv);
          await mWritable.close();

          // Write transactions.csv
          const tHandle = await dirHandle.getFileHandle('transactions.csv', { create: true });
          const tWritable = await tHandle.createWritable();
          await tWritable.write(txCsv);
          await tWritable.close();
        } catch (diskErr: any) {
          if (diskErr?.message?.includes('EBUSY') || diskErr?.name === 'NoModificationAllowedError') {
            return {
              success: false,
              message: 'Close Excel to refresh the data files.',
            };
          }
        }
      }

      return {
        success: true,
        message: `Library data files in sync (${books.filter(b => b.is_active).length} books, ${borrowers.length} members).`,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Retrieves last recorded file sync timestamp
   */
  static getLastSyncInfo(): { lastUpdated: string; inSync: boolean } {
    try {
      const data = localStorage.getItem(this.HASH_STORAGE_KEY);
      if (!data) return { lastUpdated: 'Never', inSync: false };
      const parsed: DataFileHashes = JSON.parse(data);
      return {
        lastUpdated: new Date(parsed.lastUpdated).toLocaleTimeString(),
        inSync: true,
      };
    } catch {
      return { lastUpdated: 'Never', inSync: false };
    }
  }

  /**
   * Triggers download of LibraryData.xlsx
   */
  static async downloadLibraryDataXlsx(): Promise<void> {
    const books = LibraryStorage.getBooks();
    const borrowers = LibraryStorage.getBorrowers();
    const transactions = LibraryStorage.getTransactions();

    const wb = await this.generateLibraryDataWorkbook(books, borrowers, transactions);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LibraryData_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
