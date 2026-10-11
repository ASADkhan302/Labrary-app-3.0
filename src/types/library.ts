export interface Book {
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
  // Book Groups & Almaris
  group_id?: string | null;
  almari_id?: string | null;
  shelf_no?: number | null;
  date_added?: string; // YYYY-MM-DD local date
  title_roman?: string;
  author_roman?: string;
  title_sort?: string;
  author_sort?: string;
  search_text?: string;
  accession_no?: string;
  place?: string;
  pages?: number;
  price?: number;
  binding?: string;
  source_remarks?: string;
  import_batch_id?: string;
  imported_at?: string;
  sheet_write_state?: 'waiting' | 'written' | 'failed';
  sheet_write_error?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export type BorrowerRole = 'Student' | 'Faculty' | 'Staff';
export type BorrowerStatus = 'active' | 'suspended' | 'left';

export interface Borrower {
  id: string;
  role: BorrowerRole;
  university_id: string;
  barcode: string; // same as university_id
  name: string;
  name_urdu?: string;
  father_name?: string; // Student only
  department: string;
  program: string; // e.g. BCS
  degree_level?: string; // BS, MS, MPhil, PhD, ADP, Other
  study_mode?: string; // Regular, Self-Finance, Evening
  session?: string; // e.g. FA23
  semester?: number | null; // 1-8
  roll_number?: string; // Student roll no
  designation?: string; // Faculty/Staff only
  employee_no?: string; // Faculty/Staff employee no
  blood_group?: string; // A+, A-, B+, B-, AB+, AB-, O+, O-, Unknown
  email?: string;
  phone: string; // Pakistani format normalized 03XX-XXXXXXX
  address?: string;
  photo_path?: string;
  photo_url?: string;
  borrow_limit: number; // Student 3, Faculty 10, Staff 5
  joined_date: string;
  valid_until?: string | null;
  status: BorrowerStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;

  // Backward compatibility fields
  student_id: string;
  class_name?: string;
}

export interface Transaction {
  id: string;
  book_id: string;
  borrower_id: string;
  book_name?: string;
  borrower_name?: string;
  barcode?: string;
  student_id?: string;
  action: 'ISSUE' | 'RETURN' | 'ADD' | 'REMOVE' | 'ADJUST';
  issue_date: string;
  due_date: string;
  return_date: string | null;
  quantity: number;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  action: string;
  description: string;
  barcode: string;
  book_id?: string;
  borrower_id?: string;
  user: string;
  created_at: string;
}

export interface SystemSettings {
  library_name: string;
  university_name: string;
  campus_address: string;
  phone: string;
  email: string;
  auto_submit_scan: boolean;
  scanner_sound: boolean;
  error_sound: boolean;
  db_path: string;
  wal_mode: boolean;
  station_id: string;
  fine_per_day_pkr?: number;
  barcode_prefix?: string; // Default 'ULM', max 6 alphanumeric characters
  first_accession_number?: number; // Default 1
}

export interface LinkedSheetInfo {
  id: string;
  sheetName: string;
  sheetPath: string;
  isConnected: boolean;
  lastSynced: string | null;
  rowsRead: number;
  booksAdded: number;
  booksWaiting: number;
  lastWriteResult: string | null;
  isCloudFolder?: boolean;
  cloudProviderName?: string;
  storageKey?: string;
}

export interface ImportBatchRecord {
  id: string;
  filename: string;
  imported_at: string;
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  warnings_count: number;
  book_ids: string[];
}

export type StorageMode = 'LOCAL_DISK' | 'USB_REMOVABLE' | 'NETWORK_SHARE' | 'BROWSER_SANDBOX';

export interface StorageLocationConfig {
  mode: StorageMode;
  folderPath: string;
  folderName: string;
  fileName: string;
  autoSaveToDisk: boolean;
  askOnStartup: boolean;
  isConfigured: boolean;
  lastSyncTimestamp?: string;
}

export type NavigationTab = 
  | 'catalog'
  | 'circulation'
  | 'borrowers'
  | 'reports'
  | 'scanner'
  | 'excel'
  | 'settings'
  | 'almaris';

// ============================================================================
// PART A: BOOK GROUPS & ALMARIS (الماری) TYPES
// ============================================================================

export interface BookGroup {
  id: string;
  name_en: string;
  name_ur: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  match_category?: string; // Optional suggestion rule: category name to match
  match_language?: string; // Optional suggestion rule: language to match
  created_at?: string;
  updated_at?: string;
}

export interface AlmariShelf {
  almari_id: string;
  shelf_no: number;
  capacity: number;
}

export interface Almari {
  id: string;
  code: string; // A-01, A-02...
  name_en: string;
  name_ur: string;
  shelf_count: number;
  books_per_shelf: number; // Guidance capacity
  notes?: string;
  is_active: boolean;
  name_locked?: boolean;
  auto_created?: boolean;
  plan_key?: string;
  shelves?: AlmariShelf[];
  created_at?: string;
  updated_at?: string;
}

export interface AlmariGroup {
  id: string;
  almari_id: string;
  group_id: string;
}

export interface BookLocationHistory {
  id: string;
  book_id: string;
  from: string; // e.g. "Unassigned" or "A-01, Shelf 2"
  to: string; // e.g. "A-06, Shelf 3"
  moved_at: string;
  reason?: string;
  batch_id?: string;
  round_no?: number;
}

export interface AlmariPlanEntry {
  key: string;
  name_en: string;
  name_ur: string;
  group_names_en: string[]; // matching group names
  default_shelves?: number;
  default_capacity_per_shelf?: number;
}

export interface ImportJobRoundRecord {
  round_no: number;
  rows_in_round: number;
  books_imported: number;
  books_arranged: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: 'done' | 'running' | 'failed' | 'rolled_back';
  placed_summary?: Record<string, number>; // almari_id -> count
}

export interface ImportJob {
  id: string;
  file_hash: string;
  file_name: string;
  total_rows: number;
  next_row: number;
  rounds_done: number;
  total_rounds: number;
  round_size: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  auto_arrange: boolean;
  pause_after_round: boolean;
  created_at: string;
  updated_at: string;
  round_history: ImportJobRoundRecord[];
  all_imported_book_ids: string[];
  created_almari_ids: string[];
  error_message?: string;
}

