import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { Book, Borrower, Transaction, HistoryEntry, SystemSettings } from '../types/library';
import { INITIAL_BOOKS, INITIAL_BORROWERS, INITIAL_TRANSACTIONS, INITIAL_HISTORY, INITIAL_SETTINGS } from './initialData';
import { SQL_WASM_BASE64 } from './sqlWasmBase64';

let sqlPromise: Promise<SqlJsStatic> | null = null;

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
      if (isNode) {
        try {
          const path = await import('path');
          const wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
          return await initSqlJs({
            locateFile: () => wasmPath,
          });
        } catch {
          return await initSqlJs();
        }
      } else if (typeof window !== 'undefined') {
        try {
          // Provide direct wasmBinary buffer to avoid any MIME-type or network fetch issues in preview/dev server
          const wasmBytes = base64ToUint8Array(SQL_WASM_BASE64);
          return await initSqlJs({
            wasmBinary: wasmBytes.buffer as ArrayBuffer,
          });
        } catch (err) {
          console.warn('Direct wasmBinary instantiation fallback:', err);
          return await initSqlJs({
            locateFile: (file) => `/${file}`,
          });
        }
      } else {
        return await initSqlJs();
      }
    })();
  }
  return sqlPromise;
}

export interface SqliteQuickCheckResult {
  passed: boolean;
  message: string;
  journalMode: string;
  synchronous: string;
  foreignKeys: boolean;
}

export class SqliteDatabaseService {
  private db: Database | null = null;
  private currentJournalMode: string = 'DELETE';

  constructor(existingDb?: Database) {
    if (existingDb) {
      this.db = existingDb;
    }
  }

  /**
   * Initializes a brand-new SQLite database with real schema and constraints
   */
  async initializeNewDatabase(): Promise<void> {
    const SQL = await getSqlJs();
    this.db = new SQL.Database();

    // Enforce required PRAGMA specifications
    this.db.run('PRAGMA foreign_keys = ON;');
    this.db.run('PRAGMA synchronous = FULL;');
    this.db.run('PRAGMA journal_mode = DELETE;');

    const jModeRes = this.db.exec('PRAGMA journal_mode;');
    if (jModeRes.length > 0 && jModeRes[0].values.length > 0) {
      this.currentJournalMode = String(jModeRes[0].values[0][0]).toUpperCase();
    }

    // Create institutional tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        barcode TEXT NOT NULL,
        accession_no TEXT,
        isbn TEXT,
        book_name TEXT NOT NULL,
        author TEXT NOT NULL,
        publisher TEXT,
        category TEXT,
        edition TEXT,
        publication_year INTEGER,
        language TEXT,
        description TEXT,
        book_image_path TEXT,
        shelf TEXT,
        row TEXT,
        section TEXT,
        dewey_call_number TEXT,
        group_id TEXT,
        almari_id TEXT,
        shelf_no INTEGER,
        total_quantity INTEGER NOT NULL DEFAULT 1,
        available_quantity INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        title_sort TEXT,
        author_sort TEXT,
        search_text TEXT,
        place TEXT,
        binding TEXT,
        pages INTEGER,
        price REAL,
        source_remarks TEXT,
        import_batch_id TEXT,
        imported_at TEXT,
        date_added TEXT
      );

      CREATE TABLE IF NOT EXISTS borrowers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        university_id TEXT NOT NULL,
        student_id TEXT,
        barcode TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT,
        program TEXT,
        phone TEXT,
        borrow_limit INTEGER NOT NULL DEFAULT 3,
        photo_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        joined_date TEXT,
        valid_until TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        borrower_id TEXT NOT NULL,
        barcode TEXT NOT NULL,
        book_name TEXT NOT NULL,
        borrower_name TEXT NOT NULL,
        borrower_uid TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        return_date TEXT,
        status TEXT NOT NULL,
        fine_amount REAL NOT NULL DEFAULT 0,
        fine_paid INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        barcode TEXT,
        book_id TEXT,
        borrower_id TEXT,
        user TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_ur TEXT NOT NULL,
        color TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        match_category TEXT,
        match_language TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS almaris (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name_en TEXT NOT NULL,
        name_ur TEXT NOT NULL,
        shelf_count INTEGER NOT NULL DEFAULT 5,
        books_per_shelf INTEGER NOT NULL DEFAULT 30,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS almari_groups (
        id TEXT PRIMARY KEY,
        almari_id TEXT NOT NULL,
        group_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS location_history (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        from_location TEXT NOT NULL,
        to_location TEXT NOT NULL,
        moved_at TEXT NOT NULL,
        reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_books_barcode ON books(barcode);
      CREATE INDEX IF NOT EXISTS idx_books_accession ON books(accession_no);
      CREATE INDEX IF NOT EXISTS idx_books_almari_shelf ON books(almari_id, shelf_no, title_sort);
      CREATE INDEX IF NOT EXISTS idx_borrowers_uid ON borrowers(university_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_book_id ON transactions(book_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_borrower_id ON transactions(borrower_id);
    `);

    // Metadata entries
    const metaStmt = this.db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?);');
    metaStmt.run(['app_name', 'University of Lakki Marwat Library Management System']);
    metaStmt.run(['schema_version', '3']);
    metaStmt.run(['format', 'ULM_SQLITE_BINARY']);
    metaStmt.run(['created_at', new Date().toISOString()]);
    metaStmt.free();
  }

  /**
   * Loads an existing SQLite binary database from raw bytes (Uint8Array)
   */
  async loadFromBytes(bytes: Uint8Array): Promise<void> {
    const SQL = await getSqlJs();
    this.db = new SQL.Database(bytes);

    // Verify header and integrity
    this.db.run('PRAGMA foreign_keys = ON;');
    const jModeRes = this.db.exec('PRAGMA journal_mode;');
    if (jModeRes.length > 0 && jModeRes[0].values.length > 0) {
      this.currentJournalMode = String(jModeRes[0].values[0][0]).toUpperCase();
    }
  }

  /**
   * Executes real PRAGMA quick_check to verify byte-level SQLite database integrity
   */
  quickCheck(): SqliteQuickCheckResult {
    if (!this.db) {
      return {
        passed: false,
        message: 'No active SQLite database instance',
        journalMode: 'NONE',
        synchronous: 'OFF',
        foreignKeys: false,
      };
    }

    try {
      const qcRes = this.db.exec('PRAGMA quick_check;');
      const qcVal = qcRes[0]?.values[0]?.[0];
      const isOk = qcVal === 'ok';

      const jmRes = this.db.exec('PRAGMA journal_mode;');
      const jmVal = String(jmRes[0]?.values[0]?.[0] || this.currentJournalMode).toUpperCase();

      const syncRes = this.db.exec('PRAGMA synchronous;');
      const syncValNum = syncRes[0]?.values[0]?.[0];
      const syncVal = syncValNum === 2 ? 'FULL' : syncValNum === 1 ? 'NORMAL' : 'OFF';

      const fkRes = this.db.exec('PRAGMA foreign_keys;');
      const fkVal = Boolean(fkRes[0]?.values[0]?.[0]);

      return {
        passed: isOk,
        message: isOk ? 'Database integrity verified: PRAGMA quick_check returned ok' : `Corruption detected: ${qcVal}`,
        journalMode: jmVal,
        synchronous: syncVal,
        foreignKeys: fkVal,
      };
    } catch (e: any) {
      return {
        passed: false,
        message: `PRAGMA check failed: ${e.message}`,
        journalMode: this.currentJournalMode,
        synchronous: 'UNKNOWN',
        foreignKeys: false,
      };
    }
  }

  /**
   * Writes a test probe record and reads it back to verify real write & read transactions
   */
  probeWriteAndRead(): { success: boolean; message: string; elapsedMs: number } {
    if (!this.db) return { success: false, message: 'Database not loaded', elapsedMs: 0 };
    const t0 = performance.now();
    const probeKey = `probe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const probeValue = `ULM_PROBE_VAL_${new Date().toISOString()}`;

    try {
      this.db.run('BEGIN TRANSACTION;');
      this.db.run('INSERT INTO metadata (key, value) VALUES (?, ?);', [probeKey, probeValue]);
      this.db.run('COMMIT;');

      const readRes = this.db.exec('SELECT value FROM metadata WHERE key = ?;', [probeKey]);
      const readVal = readRes[0]?.values[0]?.[0];

      if (readVal !== probeValue) {
        throw new Error(`Write probe verification mismatch: expected ${probeValue}, read back ${readVal}`);
      }

      // Clean up probe record
      this.db.run('DELETE FROM metadata WHERE key = ?;', [probeKey]);

      const elapsed = performance.now() - t0;
      return {
        success: true,
        message: `Verified ACID transaction: write and read back succeeded in ${elapsed.toFixed(1)}ms`,
        elapsedMs: elapsed,
      };
    } catch (e: any) {
      try {
        this.db.run('ROLLBACK;');
      } catch {}
      return {
        success: false,
        message: `ACID write probe failed: ${e.message}`,
        elapsedMs: performance.now() - t0,
      };
    }
  }

  /**
   * Ingests all tables from memory / existing repository into SQLite
   */
  ingestData(data: {
    books: Book[];
    borrowers: Borrower[];
    transactions: Transaction[];
    history: HistoryEntry[];
    settings: SystemSettings;
  }): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('BEGIN TRANSACTION;');
    try {
      // Books
      const bookStmt = this.db.prepare(`
        INSERT OR REPLACE INTO books (
          id, barcode, accession_no, isbn, book_name, author, publisher, category,
          edition, publication_year, language, description, book_image_path, shelf,
          row, section, dewey_call_number, total_quantity, available_quantity,
          created_at, updated_at, is_active, title_sort, author_sort, search_text,
          place, binding, pages, price, source_remarks, import_batch_id, imported_at, date_added,
          group_id, almari_id, shelf_no
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);

      for (const b of data.books) {
        bookStmt.run([
          b.id, b.barcode, b.accession_no || null, b.isbn || null, b.book_name, b.author,
          b.publisher || null, b.category, b.edition || null, b.publication_year,
          b.language || null, b.description || null, b.book_image_path || null,
          b.shelf || null, b.row || null, b.section || null, b.dewey_call_number || null,
          b.total_quantity, b.available_quantity, b.created_at, b.updated_at,
          b.is_active ? 1 : 0, b.title_sort || null, b.author_sort || null, b.search_text || null,
          b.place || null, b.binding || null, b.pages || null, b.price || null,
          b.source_remarks || null, b.import_batch_id || null, b.imported_at || null, b.date_added || null,
          b.group_id || null, b.almari_id || null, b.shelf_no || null
        ]);
      }
      bookStmt.free();

      // Borrowers
      const borStmt = this.db.prepare(`
        INSERT OR REPLACE INTO borrowers (
          id, name, university_id, student_id, barcode, role, department, program,
          phone, borrow_limit, photo_url, status, notes, joined_date, valid_until,
          created_at, updated_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);

      for (const m of data.borrowers) {
        borStmt.run([
          m.id, m.name, m.university_id, m.student_id || m.university_id, m.barcode,
          m.role, m.department || null, m.program || null, m.phone || null,
          m.borrow_limit, m.photo_url || null, m.status, m.notes || null,
          m.joined_date || null, m.valid_until || null, m.created_at, m.updated_at,
          m.is_active ? 1 : 0
        ]);
      }
      borStmt.free();

      // Transactions
      const txStmt = this.db.prepare(`
        INSERT OR REPLACE INTO transactions (
          id, book_id, borrower_id, barcode, book_name, borrower_name, borrower_uid,
          issue_date, due_date, return_date, status, fine_amount, fine_paid,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);

      for (const t of data.transactions) {
        const anyTx = t as any;
        txStmt.run([
          t.id,
          t.book_id,
          t.borrower_id,
          t.barcode || '',
          t.book_name || '',
          t.borrower_name || '',
          anyTx.borrower_uid || anyTx.student_id || t.borrower_id,
          t.issue_date,
          t.due_date,
          t.return_date || null,
          t.status,
          anyTx.fine_amount || 0,
          anyTx.fine_paid ? 1 : 0,
          t.created_at,
          anyTx.updated_at || t.created_at
        ]);
      }
      txStmt.free();

      // History
      const histStmt = this.db.prepare(`
        INSERT OR REPLACE INTO history (
          id, action, description, barcode, book_id, borrower_id, user, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `);

      for (const h of data.history) {
        histStmt.run([
          h.id, h.action, h.description, h.barcode || null, h.book_id || null,
          h.borrower_id || null, h.user, h.created_at
        ]);
      }
      histStmt.free();

      // Settings
      this.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['system_settings', JSON.stringify(data.settings)]);

      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Extracts all tables from SQLite into typed application arrays
   */
  extractAllData(): {
    books: Book[];
    borrowers: Borrower[];
    transactions: Transaction[];
    history: HistoryEntry[];
    settings: SystemSettings;
  } {
    if (!this.db) throw new Error('Database not loaded');

    // Books
    const booksRes = this.db.exec('SELECT * FROM books ORDER BY created_at DESC;');
    const books: Book[] = [];
    if (booksRes.length > 0) {
      const cols = booksRes[0].columns;
      for (const row of booksRes[0].values) {
        const obj: any = {};
        cols.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        obj.is_active = Boolean(obj.is_active);
        books.push(obj as Book);
      }
    }

    // Borrowers
    const borRes = this.db.exec('SELECT * FROM borrowers ORDER BY created_at DESC;');
    const borrowers: Borrower[] = [];
    if (borRes.length > 0) {
      const cols = borRes[0].columns;
      for (const row of borRes[0].values) {
        const obj: any = {};
        cols.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        obj.is_active = Boolean(obj.is_active);
        borrowers.push(obj as Borrower);
      }
    }

    // Transactions
    const txRes = this.db.exec('SELECT * FROM transactions ORDER BY created_at DESC;');
    const transactions: Transaction[] = [];
    if (txRes.length > 0) {
      const cols = txRes[0].columns;
      for (const row of txRes[0].values) {
        const obj: any = {};
        cols.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        obj.fine_paid = Boolean(obj.fine_paid);
        transactions.push(obj as Transaction);
      }
    }

    // History
    const histRes = this.db.exec('SELECT * FROM history ORDER BY created_at DESC LIMIT 500;');
    const history: HistoryEntry[] = [];
    if (histRes.length > 0) {
      const cols = histRes[0].columns;
      for (const row of histRes[0].values) {
        const obj: any = {};
        cols.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        history.push(obj as HistoryEntry);
      }
    }

    // Settings
    let settings = INITIAL_SETTINGS;
    try {
      const setRes = this.db.exec('SELECT value FROM settings WHERE key = ?;', ['system_settings']);
      if (setRes.length > 0 && setRes[0].values.length > 0) {
        settings = JSON.parse(String(setRes[0].values[0][0]));
      }
    } catch {}

    return { books, borrowers, transactions, history, settings };
  }

  /**
   * Returns binary export of the SQLite database (format 3)
   */
  exportBinary(): Uint8Array {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.export();
  }

  /**
   * Closes database and releases memory
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
