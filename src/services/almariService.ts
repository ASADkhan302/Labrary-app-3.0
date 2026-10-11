import { Book, BookGroup, Almari, AlmariGroup, AlmariShelf, AlmariPlanEntry, BookLocationHistory } from '../types/library';
import { INITIAL_BOOK_GROUPS, INITIAL_ALMARIS, INITIAL_ALMARI_GROUPS, DEFAULT_ALMARI_PLAN, toUrduDigits } from './initialAlmariData';
import { LibraryStorage } from './storage';

const STORAGE_KEYS = {
  GROUPS: 'ulm_lms_book_groups_v1',
  ALMARIS: 'ulm_lms_almaris_v1',
  ALMARI_GROUPS: 'ulm_lms_almari_groups_v1',
  ALMARI_SHELVES: 'ulm_lms_almari_shelves_v1',
  ALMARI_PLAN: 'ulm_lms_almari_plan_v1',
  LOCATION_HISTORY: 'ulm_lms_location_history_v1',
};

export interface AutoArrangeOptions {
  scope?: 'unassigned' | 'except_manual' | 'everything';
  freeSpacePercent?: number; // default 20
  order?: 'barcode_series' | 'call_number' | 'title' | 'author';
  mode?: 'full' | 'incremental';
  batchId?: string;
  roundNo?: number;
  previewOnly?: boolean;
}

export interface AutoArrangePreviewAlmari {
  almariId: string;
  code: string;
  name_en: string;
  name_ur: string;
  isNew: boolean;
  totalShelves: number;
  totalCapacity: number;
  booksAssignedCount: number;
  shelves: {
    shelf_no: number;
    capacity: number;
    bookCount: number;
    rangeStr: string;
    fromBarcode?: string;
    toBarcode?: string;
  }[];
}

export interface AutoArrangeResult {
  batchId: string;
  booksToUpdate: Book[];
  almarisCreated: Almari[];
  linksCreated: AlmariGroup[];
  preview: {
    totalBooksProcessed: number;
    totalBooksPlaced: number;
    totalBooksSkipped: number;
    almarisSummary: AutoArrangePreviewAlmari[];
  };
}

export class AlmariService {
  private static groupsCache: BookGroup[] | null = null;
  private static almarisCache: Almari[] | null = null;
  private static almariGroupsCache: AlmariGroup[] | null = null;
  private static almariShelvesCache: AlmariShelf[] | null = null;
  private static almariPlanCache: AlmariPlanEntry[] | null = null;
  private static historyCache: BookLocationHistory[] | null = null;

  // --- GROUPS ---
  static getGroups(): BookGroup[] {
    if (this.groupsCache) return this.groupsCache;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GROUPS);
      if (raw) {
        this.groupsCache = JSON.parse(raw);
        return this.groupsCache!;
      }
    } catch {}
    this.groupsCache = [...INITIAL_BOOK_GROUPS];
    this.saveGroups(this.groupsCache);
    return this.groupsCache;
  }

  static saveGroups(groups: BookGroup[]): void {
    this.groupsCache = groups;
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  }

  static addGroup(group: Omit<BookGroup, 'id'>): BookGroup {
    const groups = this.getGroups();
    const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newGroup: BookGroup = { ...group, id };
    groups.push(newGroup);
    this.saveGroups(groups);
    return newGroup;
  }

  static updateGroup(id: string, updates: Partial<BookGroup>): void {
    const groups = this.getGroups().map(g => (g.id === id ? { ...g, ...updates, updated_at: new Date().toISOString() } : g));
    this.saveGroups(groups);
  }

  static deleteGroup(id: string): void {
    const groups = this.getGroups().filter(g => g.id !== id);
    this.saveGroups(groups);
    // Remove links in almari_groups
    const links = this.getAlmariGroups().filter(l => l.group_id !== id);
    this.saveAlmariGroups(links);
  }

  // --- ALMARIS ---
  static getAlmaris(): Almari[] {
    if (this.almarisCache) return this.almarisCache;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ALMARIS);
      if (raw) {
        const parsed: Almari[] = JSON.parse(raw);
        // Ensure every almari has its shelves initialized
        this.almarisCache = parsed.map(a => this.ensureAlmariShelves(a));
        return this.almarisCache;
      }
    } catch {}
    this.almarisCache = INITIAL_ALMARIS.map(a => this.ensureAlmariShelves(a));
    this.saveAlmaris(this.almarisCache);
    return this.almarisCache;
  }

  static saveAlmaris(almaris: Almari[]): void {
    this.almarisCache = almaris;
    localStorage.setItem(STORAGE_KEYS.ALMARIS, JSON.stringify(almaris));
  }

  static addAlmari(almari: Omit<Almari, 'id'>, groupIds: string[] = []): Almari {
    const almaris = this.getAlmaris();
    const id = `alm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newAlmari: Almari = this.ensureAlmariShelves({ ...almari, id });
    almaris.push(newAlmari);
    this.saveAlmaris(almaris);

    if (groupIds.length > 0) {
      const links = this.getAlmariGroups();
      groupIds.forEach(gid => {
        links.push({
          id: `ag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          almari_id: id,
          group_id: gid,
        });
      });
      this.saveAlmariGroups(links);
    }
    return newAlmari;
  }

  static updateAlmari(id: string, updates: Partial<Almari>, groupIds?: string[]): void {
    const almaris = this.getAlmaris().map(a => {
      if (a.id !== id) return a;
      // If user is editing the name directly, lock the name
      const nameLocked = updates.name_en !== undefined && updates.name_en !== a.name_en ? true : a.name_locked;
      const updated = { ...a, ...updates, name_locked: nameLocked, updated_at: new Date().toISOString() };
      return this.ensureAlmariShelves(updated);
    });
    this.saveAlmaris(almaris);

    if (groupIds !== undefined) {
      const otherLinks = this.getAlmariGroups().filter(l => l.almari_id !== id);
      const newLinks = groupIds.map(gid => ({
        id: `ag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        almari_id: id,
        group_id: gid,
      }));
      this.saveAlmariGroups([...otherLinks, ...newLinks]);
    }
  }

  static deleteAlmari(id: string): void {
    const almaris = this.getAlmaris().map(a => a.id === id ? { ...a, is_active: false, updated_at: new Date().toISOString() } : a);
    this.saveAlmaris(almaris);
    const links = this.getAlmariGroups().filter(l => l.almari_id !== id);
    this.saveAlmariGroups(links);
  }

  /**
   * Soft delete an Almari in one transaction:
   * 1. Marks the almari inactive (is_active: false)
   * 2. Removes capacity (almaris filtering ignores inactive)
   * 3. Either moves its books to targetAlmariId or unassigns them (almari_id: null, shelf_no: null)
   * 4. Logs BookLocationHistory for each moved book under batchId
   * 5. Writes LibraryStorage history entry with batch_id
   */
  static softDeleteAlmari(
    almariId: string,
    action: 'move' | 'unassign',
    targetAlmariId?: string,
    allBooks: Book[] = LibraryStorage.getBooks()
  ): {
    success: boolean;
    batchId: string;
    deletedAlmari: Almari;
    affectedBooksCount: number;
    updatedBooks: Book[];
    message: string;
  } {
    const almaris = this.getAlmaris();
    const targetAlmari = almaris.find(a => a.id === almariId);
    if (!targetAlmari) {
      return {
        success: false,
        batchId: '',
        deletedAlmari: {} as Almari,
        affectedBooksCount: 0,
        updatedBooks: allBooks,
        message: 'Almari not found.',
      };
    }

    const batchId = `alm-del-${almariId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();

    // 1. Soft delete almari (mark inactive)
    const updatedAlmaris = almaris.map(a =>
      a.id === almariId ? { ...a, is_active: false, updated_at: nowIso } : a
    );
    this.saveAlmaris(updatedAlmaris);

    // 2. Prepare destination details if moving
    const destAlm = targetAlmariId ? almaris.find(a => a.id === targetAlmariId && a.is_active) : null;
    const destCode = destAlm ? destAlm.code : '';

    // 3. Update books and record location history
    let affectedCount = 0;
    const historyEntries: BookLocationHistory[] = [];
    const fromLocationStr = `${targetAlmari.code}, Cupboard Stacks`;

    const updatedBooks = allBooks.map(b => {
      if (b.almari_id === almariId) {
        affectedCount++;
        const prevLocation = b.shelf_no ? `${targetAlmari.code}, Shelf ${b.shelf_no}` : fromLocationStr;
        
        let newAlmariId: string | null = null;
        let newShelfNo: number | null = null;
        let toLocation = 'Unassigned (No almari)';

        if (action === 'move' && destAlm) {
          newAlmariId = destAlm.id;
          newShelfNo = 1;
          toLocation = `${destCode}, Shelf 1`;
        }

        historyEntries.push({
          id: `lh-${Date.now()}-${affectedCount}-${Math.random().toString(36).slice(2, 6)}`,
          book_id: b.id,
          from: prevLocation,
          to: toLocation,
          moved_at: nowIso,
          reason: `Almari ${targetAlmari.code} deleted (${action === 'move' ? `moved to ${destCode}` : 'unassigned'})`,
          batch_id: batchId,
        });

        return {
          ...b,
          almari_id: newAlmariId,
          shelf_no: newShelfNo,
          updated_at: nowIso,
        };
      }
      return b;
    });

    // 4. Save location history
    if (historyEntries.length > 0) {
      const existingHistory = this.getLocationHistory();
      this.historyCache = [...historyEntries, ...existingHistory].slice(0, 5000);
      localStorage.setItem(STORAGE_KEYS.LOCATION_HISTORY, JSON.stringify(this.historyCache));
    }

    // 5. Save updated books
    LibraryStorage.saveBooks(updatedBooks);

    // 6. Log system history in LibraryStorage
    LibraryStorage.logHistory({
      action: 'ALMARI_DELETED',
      description: `Deleted almari "${targetAlmari.name_en}" (${targetAlmari.code}) - ${affectedCount} books ${action === 'move' && destAlm ? `moved to ${destCode}` : 'left unassigned'}. Batch: ${batchId}`,
      barcode: targetAlmari.code,
      book_id: batchId,
      user: 'Librarian-Admin',
    });

    const msg = action === 'move' && destAlm
      ? `Almari "${targetAlmari.code}" deleted. ${affectedCount} books moved to ${destAlm.code}.`
      : `Almari "${targetAlmari.code}" deleted. ${affectedCount} books left unassigned.`;

    return {
      success: true,
      batchId,
      deletedAlmari: targetAlmari,
      affectedBooksCount: affectedCount,
      updatedBooks,
      message: msg,
    };
  }

  /**
   * Undo an Almari deletion batch:
   * Restores the almari (is_active: true), restores every affected book's previous almari_id and shelf_no,
   * cleans the batch history, and logs the restoration.
   */
  static undoAlmariDeletion(
    batchId: string,
    allBooks: Book[] = LibraryStorage.getBooks()
  ): {
    success: boolean;
    restoredAlmari: Almari | null;
    restoredBooksCount: number;
    updatedBooks: Book[];
    message: string;
  } {
    const history = this.getLocationHistory();
    const batchHistory = history.filter(h => h.batch_id === batchId);

    // Extract target almari id from batchId if present
    const idMatch = batchId.match(/^alm-del-(.+?)-\d+-[a-z0-9]+$/);
    const targetAlmariId = idMatch ? idMatch[1] : null;

    // Find the deleted almari code from history or system logs
    const sysLogs = LibraryStorage.getHistory();
    const sysLog = sysLogs.find((l: any) => l.book_id === batchId || l.description?.includes(batchId));

    // Try finding the almari by id, code or previous location
    const almaris = this.getAlmaris();
    let targetAlmariCode: string | null = sysLog?.barcode || null;

    if (!targetAlmariCode && batchHistory.length > 0) {
      const match = batchHistory[0].from.match(/A-\d+/i);
      if (match) targetAlmariCode = match[0].toUpperCase();
    }

    const foundAlmari = almaris.find(a =>
      (targetAlmariId && a.id === targetAlmariId) ||
      (targetAlmariCode && a.code.toUpperCase() === targetAlmariCode.toUpperCase())
    );

    // Restore the almari if found
    let restoredAlm: Almari | null = null;
    if (foundAlmari) {
      restoredAlm = { ...foundAlmari, is_active: true, updated_at: new Date().toISOString() };
      const updatedAlmaris = almaris.map(a => (a.id === foundAlmari.id ? restoredAlm! : a));
      this.saveAlmaris(updatedAlmaris);
    }

    // Restore books' previous placement
    const updatedBooks = [...allBooks];
    let restoredCount = 0;

    for (const h of batchHistory) {
      const idx = updatedBooks.findIndex(b => b.id === h.book_id);
      if (idx !== -1) {
        if (h.from === 'Unassigned (No almari)' || h.from === 'Unassigned') {
          updatedBooks[idx] = { ...updatedBooks[idx], almari_id: null, shelf_no: null };
        } else {
          const codeMatch = h.from.match(/A-\d+/i);
          const shelfMatch = h.from.match(/Shelf\s+(\d+)/i);
          const matchedAlm = restoredAlm || (codeMatch
            ? this.getAlmaris().find(a => a.code.toUpperCase() === codeMatch[0].toUpperCase())
            : null);

          updatedBooks[idx] = {
            ...updatedBooks[idx],
            almari_id: matchedAlm ? matchedAlm.id : null,
            shelf_no: shelfMatch ? parseInt(shelfMatch[1], 10) : 1,
          };
        }
        restoredCount++;
      }
    }

    // Save restored books
    LibraryStorage.saveBooks(updatedBooks);

    // Remove undone entries from location history
    const remainingHistory = history.filter(h => h.batch_id !== batchId);
    this.historyCache = remainingHistory;
    localStorage.setItem(STORAGE_KEYS.LOCATION_HISTORY, JSON.stringify(remainingHistory));

    // Log undo action
    LibraryStorage.logHistory({
      action: 'ALMARI_RESTORED',
      description: `Undid deletion for Almari "${restoredAlm?.name_en || targetAlmariCode || ''}" (${targetAlmariCode || restoredAlm?.code || ''}). Restored ${restoredCount} books to previous locations.`,
      barcode: targetAlmariCode || restoredAlm?.code || 'N/A',
      book_id: batchId,
      user: 'Librarian-Admin',
    });

    const almLabel = restoredAlm ? `${restoredAlm.name_en} (${restoredAlm.code})` : (targetAlmariCode || 'Almari');
    return {
      success: true,
      restoredAlmari: restoredAlm,
      restoredBooksCount: restoredCount,
      updatedBooks,
      message: `Restored ${almLabel} and reverted ${restoredCount} book placements.`,
    };
  }

  // --- ALMARI SHELVES & CAPACITY ---
  static ensureAlmariShelves(almari: Almari): Almari {
    const count = almari.shelf_count || 5;
    const defaultCap = almari.books_per_shelf || 30;
    let existingShelves = almari.shelves || [];

    if (existingShelves.length !== count) {
      const newShelves: AlmariShelf[] = [];
      for (let s = 1; s <= count; s++) {
        const prev = existingShelves.find(sh => sh.shelf_no === s);
        newShelves.push({
          almari_id: almari.id,
          shelf_no: s,
          capacity: prev?.capacity || defaultCap,
        });
      }
      existingShelves = newShelves;
    }
    return { ...almari, shelves: existingShelves };
  }

  static getShelvesForAlmari(almariId: string): AlmariShelf[] {
    const almari = this.getAlmaris().find(a => a.id === almariId);
    if (!almari) return [];
    return this.ensureAlmariShelves(almari).shelves || [];
  }

  static setAlmariCapacity(almariId: string, totalCapacity: number, shelfCount?: number): AlmariShelf[] {
    const almaris = this.getAlmaris();
    const almari = almaris.find(a => a.id === almariId);
    if (!almari) return [];

    const numShelves = shelfCount || almari.shelf_count || 5;
    const baseCap = Math.floor(totalCapacity / numShelves);
    let remainder = totalCapacity % numShelves;

    const newShelves: AlmariShelf[] = [];
    for (let s = 1; s <= numShelves; s++) {
      const cap = baseCap + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      newShelves.push({
        almari_id: almariId,
        shelf_no: s,
        capacity: cap,
      });
    }

    almari.shelf_count = numShelves;
    almari.books_per_shelf = baseCap;
    almari.shelves = newShelves;
    this.saveAlmaris(almaris);
    return newShelves;
  }

  static getAlmariTotalCapacity(almari: Almari): number {
    const ensured = this.ensureAlmariShelves(almari);
    if (ensured.shelves && ensured.shelves.length > 0) {
      return ensured.shelves.reduce((acc, s) => acc + (s.capacity || 0), 0);
    }
    return (almari.shelf_count || 5) * (almari.books_per_shelf || 30);
  }

  // --- ALMARI PLAN MANAGEMENT ---
  static getAlmariPlan(): AlmariPlanEntry[] {
    if (this.almariPlanCache) return this.almariPlanCache;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ALMARI_PLAN);
      if (raw) {
        this.almariPlanCache = JSON.parse(raw);
        return this.almariPlanCache!;
      }
    } catch {}
    this.almariPlanCache = [...DEFAULT_ALMARI_PLAN];
    this.saveAlmariPlan(this.almariPlanCache);
    return this.almariPlanCache;
  }

  static saveAlmariPlan(plan: AlmariPlanEntry[]): void {
    this.almariPlanCache = plan;
    localStorage.setItem(STORAGE_KEYS.ALMARI_PLAN, JSON.stringify(plan));
  }

  static resetAlmariPlanToDefault(): AlmariPlanEntry[] {
    this.almariPlanCache = [...DEFAULT_ALMARI_PLAN];
    this.saveAlmariPlan(this.almariPlanCache);
    return this.almariPlanCache;
  }

  // --- RANGE UTILITIES ---
  /**
   * Extracts integer accession number inside barcode (e.g. ULM-00020 -> 20, ACC-00150 -> 150)
   */
  static extractAccessionNumber(barcodeOrAccession: string | null | undefined): number | null {
    if (!barcodeOrAccession) return null;
    const str = String(barcodeOrAccession).trim();
    // If it's a 10 or 13-digit standard ISBN barcode starting with 978 or 979,
    // it's an ISBN barcode, not an accession sequence number (which are typically 1 to 999999)
    const digitsOnly = str.replace(/[-\s]/g, '');
    if (/^(978|979)\d{9,10}$/.test(digitsOnly) || digitsOnly.length > 9) {
      return null;
    }
    const match = str.match(/\d+/);
    if (!match) return null;
    const num = parseInt(match[0], 10);
    if (isNaN(num) || num > 9999999 || num < 0) return null;
    return num;
  }

  static formatBarcodeWithPrefix(num: number, prefix = 'ULM'): string {
    return `${prefix}-${String(num).padStart(5, '0')}`;
  }

  /**
   * Computes continuous range, min/max numbers, and gap numbers for a set of books
   */
  static computeShelfRange(books: Book[], capacity = 30): {
    rangeStr: string;
    fromBarcode: string;
    toBarcode: string;
    minNum: number | null;
    maxNum: number | null;
    count: number;
    capacity: number;
    gaps: number[];
    isContinuous: boolean;
  } {
    const count = books.length;
    if (count === 0) {
      return {
        rangeStr: 'Empty',
        fromBarcode: '',
        toBarcode: '',
        minNum: null,
        maxNum: null,
        count: 0,
        capacity,
        gaps: [],
        isContinuous: true,
      };
    }

    const numsWithBook: { num: number; barcode: string }[] = [];
    for (const b of books) {
      const num = this.extractAccessionNumber(b.barcode) ?? this.extractAccessionNumber(b.accession_no);
      if (num !== null) {
        numsWithBook.push({ num, barcode: b.barcode || this.formatBarcodeWithPrefix(num) });
      }
    }

    if (numsWithBook.length === 0) {
      const fromBarcode = books[0]?.barcode || '';
      const toBarcode = books[books.length - 1]?.barcode || fromBarcode;
      const rangeStr = fromBarcode
        ? (fromBarcode === toBarcode ? fromBarcode : `${fromBarcode} - ${toBarcode}`)
        : `${count} books (unindexed)`;
      return {
        rangeStr,
        fromBarcode,
        toBarcode,
        minNum: null,
        maxNum: null,
        count,
        capacity,
        gaps: [],
        isContinuous: true,
      };
    }

    numsWithBook.sort((a, b) => a.num - b.num);
    const minNum = numsWithBook[0].num;
    const maxNum = numsWithBook[numsWithBook.length - 1].num;
    const fromBarcode = numsWithBook[0].barcode;
    const toBarcode = numsWithBook[numsWithBook.length - 1].barcode;

    const span = maxNum - minNum;
    const gaps: number[] = [];
    let isContinuous = false;

    // Safety check: only calculate specific gap numbers if the span is reasonable (<= 500)
    // to prevent RangeError: Invalid array length and browser freeze when accession numbers
    // are disparate or large numbers.
    const MAX_GAP_SPAN = 500;
    const MAX_GAPS_COLLECTED = 50;

    if (span >= 0 && span <= MAX_GAP_SPAN) {
      const numSet = new Set(numsWithBook.map(n => n.num));
      for (let i = minNum; i <= maxNum; i++) {
        if (!numSet.has(i)) {
          gaps.push(i);
          if (gaps.length >= MAX_GAPS_COLLECTED) {
            break;
          }
        }
      }
      isContinuous = (gaps.length === 0 && span === numsWithBook.length - 1);
    } else {
      isContinuous = false;
    }

    const rangeStr = fromBarcode === toBarcode ? fromBarcode : `${fromBarcode} - ${toBarcode}`;
    return {
      rangeStr,
      fromBarcode,
      toBarcode,
      minNum,
      maxNum,
      count,
      capacity,
      gaps,
      isContinuous,
    };
  }

  /**
   * Finds where missing gap numbers are located in the library
   */
  static findGapsInfo(
    gaps: number[],
    allBooks: Book[],
    almarisMap: Map<string, Almari>
  ): { gapNum: number; barcode: string; locationText: string }[] {
    const results: { gapNum: number; barcode: string; locationText: string }[] = [];
    const prefix = 'ULM';

    // Map all books by their accession number
    const bookByNum = new Map<number, Book>();
    for (const b of allBooks) {
      const n = this.extractAccessionNumber(b.barcode) ?? this.extractAccessionNumber(b.accession_no);
      if (n !== null) bookByNum.set(n, b);
    }

    for (const g of gaps) {
      const bc = this.formatBarcodeWithPrefix(g, prefix);
      const found = bookByNum.get(g);
      let loc = 'Not cataloged';
      if (found) {
        if (found.almari_id) {
          const alm = almarisMap.get(found.almari_id);
          const almName = alm ? `${alm.name_en} (${alm.code})` : found.almari_id;
          loc = `In ${almName}, Shelf ${found.shelf_no || 1}`;
        } else {
          loc = 'Cataloged (Unassigned to Almari)';
        }
      }
      results.push({ gapNum: g, barcode: bc, locationText: loc });
    }
    return results;
  }

  /**
   * Live Range Preview for Add/Edit Almari
   */
  static previewRangeAssignment(
    allBooks: Book[],
    fromBarcode: string,
    toBarcode: string,
    targetAlmariId?: string,
    targetGroupIds?: string[]
  ): {
    foundBooks: Book[];
    missingNumbers: number[];
    booksAlreadyInOtherAlmari: Book[];
    booksInAnotherGroup: Book[];
    minNum: number;
    maxNum: number;
    totalExpected: number;
  } {
    const minNum = this.extractAccessionNumber(fromBarcode) || 1;
    const maxNum = this.extractAccessionNumber(toBarcode) || minNum;
    const actualMin = Math.min(minNum, maxNum);
    const actualMax = Math.max(minNum, maxNum);
    const totalExpected = actualMax - actualMin + 1;

    // Index all books by parsed number
    const bookByNum = new Map<number, Book>();
    for (const b of allBooks) {
      if (!b.is_active) continue;
      const n = this.extractAccessionNumber(b.barcode) ?? this.extractAccessionNumber(b.accession_no);
      if (n !== null) bookByNum.set(n, b);
    }

    const foundBooks: Book[] = [];
    const missingNumbers: number[] = [];
    const booksAlreadyInOtherAlmari: Book[] = [];
    const booksInAnotherGroup: Book[] = [];
    const targetGroupSet = new Set(targetGroupIds || []);

    const span = actualMax - actualMin;
    if (span >= 0 && span <= 2000) {
      for (let i = actualMin; i <= actualMax; i++) {
        const b = bookByNum.get(i);
        if (b) {
          foundBooks.push(b);
          if (b.almari_id && b.almari_id !== targetAlmariId) {
            booksAlreadyInOtherAlmari.push(b);
          }
          if (targetGroupSet.size > 0 && b.group_id && !targetGroupSet.has(b.group_id)) {
            booksInAnotherGroup.push(b);
          }
        } else {
          if (missingNumbers.length < 100) {
            missingNumbers.push(i);
          }
        }
      }
    } else {
      for (const [n, b] of bookByNum.entries()) {
        if (n >= actualMin && n <= actualMax) {
          foundBooks.push(b);
          if (b.almari_id && b.almari_id !== targetAlmariId) {
            booksAlreadyInOtherAlmari.push(b);
          }
          if (targetGroupSet.size > 0 && b.group_id && !targetGroupSet.has(b.group_id)) {
            booksInAnotherGroup.push(b);
          }
        }
      }
      foundBooks.sort((a, b) => {
        const na = AlmariService.extractAccessionNumber(a.barcode) ?? 0;
        const nb = AlmariService.extractAccessionNumber(b.barcode) ?? 0;
        return na - nb;
      });
    }

    return {
      foundBooks,
      missingNumbers,
      booksAlreadyInOtherAlmari,
      booksInAnotherGroup,
      minNum: actualMin,
      maxNum: actualMax,
      totalExpected,
    };
  }

  /**
   * Distributes books across shelves based on each shelf's capacity
   */
  static fillShelvesByCapacity(
    booksToPlace: Book[],
    almari: Almari,
    shelves: AlmariShelf[],
    orderBy: 'barcode_series' | 'call_number' | 'title' | 'author' = 'barcode_series'
  ): {
    updatedBooks: Book[];
    shelfDistribution: {
      shelf_no: number;
      capacity: number;
      books: Book[];
      rangeStr: string;
    }[];
    overCapacityCount: number;
  } {
    // Sort books according to requested order
    const sorted = [...booksToPlace].sort((a, b) => {
      if (orderBy === 'barcode_series') {
        const numA = AlmariService.extractAccessionNumber(a.barcode) || 0;
        const numB = AlmariService.extractAccessionNumber(b.barcode) || 0;
        return numA - numB;
      }
      if (orderBy === 'call_number') {
        return (a.dewey_call_number || '').localeCompare(b.dewey_call_number || '');
      }
      if (orderBy === 'author') {
        return (a.author || '').localeCompare(b.author || '');
      }
      return (a.book_name || '').localeCompare(b.book_name || '');
    });

    const activeShelves = [...shelves].sort((a, b) => a.shelf_no - b.shelf_no);
    const shelfDistribution: {
      shelf_no: number;
      capacity: number;
      books: Book[];
      rangeStr: string;
    }[] = [];

    const updatedBooks: Book[] = [];
    let bookIndex = 0;

    for (const sh of activeShelves) {
      const cap = sh.capacity || 30;
      const slice = sorted.slice(bookIndex, bookIndex + cap);
      bookIndex += slice.length;

      const shelfBooks = slice.map(b => ({
        ...b,
        almari_id: almari.id,
        shelf_no: sh.shelf_no,
      }));
      updatedBooks.push(...shelfBooks);

      const range = this.computeShelfRange(shelfBooks, cap);
      shelfDistribution.push({
        shelf_no: sh.shelf_no,
        capacity: cap,
        books: shelfBooks,
        rangeStr: range.rangeStr,
      });
    }

    const overCapacityCount = Math.max(0, sorted.length - bookIndex);

    // If over capacity, remaining books can be assigned to last shelf or left unassigned
    if (overCapacityCount > 0 && activeShelves.length > 0) {
      const lastShelf = activeShelves[activeShelves.length - 1];
      const overflowSlice = sorted.slice(bookIndex).map(b => ({
        ...b,
        almari_id: almari.id,
        shelf_no: lastShelf.shelf_no,
      }));
      updatedBooks.push(...overflowSlice);
    }

    return { updatedBooks, shelfDistribution, overCapacityCount };
  }

  // --- UNIFIED AUTO-ARRANGE ENGINE ---
  /**
   * ONE universal auto-arrange function used by Almari view button, new book placement,
   * and the staged Excel import pipeline.
   */
  static autoArrangeBooks(
    allBooks: Book[],
    options: AutoArrangeOptions = {}
  ): AutoArrangeResult {
    const scope = options.scope || 'unassigned';
    const freeSpace = (options.freeSpacePercent ?? 20) / 100;
    const order = options.order || 'barcode_series';
    const mode = options.mode || 'full';
    const batchId = options.batchId || `auto-arr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const roundNo = options.roundNo || 1;

    const almaris = [...this.getAlmaris()];
    const groups = [...this.getGroups()];
    const plan = [...this.getAlmariPlan()];
    const almariGroups = [...this.getAlmariGroups()];

    // Build plan lookup by group name
    const planByGroupName = new Map<string, AlmariPlanEntry>();
    for (const p of plan) {
      for (const gn of p.group_names_en) {
        planByGroupName.set(gn.toLowerCase(), p);
      }
    }

    // Determine target books according to scope
    let targetBooks: Book[] = [];
    if (scope === 'unassigned') {
      targetBooks = allBooks.filter(b => b.is_active && (!b.almari_id || !b.shelf_no));
    } else if (scope === 'except_manual') {
      targetBooks = allBooks.filter(b => b.is_active && (!b.almari_id || b.shelf === 'auto' || !b.shelf));
    } else {
      targetBooks = allBooks.filter(b => b.is_active);
    }

    // Group target books by Plan Entry
    const booksByPlanKey = new Map<string, Book[]>();
    const unmappedBooks: Book[] = [];

    for (const b of targetBooks) {
      let grp: BookGroup | null = null;
      if (b.group_id) {
        grp = groups.find(g => g.id === b.group_id) || null;
      }
      if (!grp) {
        grp = this.suggestGroup(b);
      }

      if (grp) {
        const planEntry = planByGroupName.get(grp.name_en.toLowerCase()) || plan.find(p => p.key === 'other');
        const key = planEntry ? planEntry.key : 'other';
        if (!booksByPlanKey.has(key)) booksByPlanKey.set(key, []);
        booksByPlanKey.get(key)!.push({ ...b, group_id: grp.id });
      } else {
        unmappedBooks.push(b);
      }
    }

    const booksToUpdate: Book[] = [];
    const almarisCreated: Almari[] = [];
    const linksCreated: AlmariGroup[] = [];
    const almarisSummary: AutoArrangePreviewAlmari[] = [];

    // Current max code index
    let nextCodeIndex = almaris.length + 1;

    for (const p of plan) {
      const planBooks = booksByPlanKey.get(p.key) || [];
      if (planBooks.length === 0) continue;

      // Sort plan books
      planBooks.sort((a, b) => {
        if (order === 'barcode_series') {
          const numA = this.extractAccessionNumber(a.barcode) || 0;
          const numB = this.extractAccessionNumber(b.barcode) || 0;
          return numA - numB;
        }
        if (order === 'call_number') {
          return (a.dewey_call_number || '').localeCompare(b.dewey_call_number || '');
        }
        return (a.book_name || '').localeCompare(b.book_name || '');
      });

      // Find existing active almaris associated with this plan
      let existingPlanAlmaris = almaris.filter(a => a.is_active && a.plan_key === p.key);
      if (existingPlanAlmaris.length === 0) {
        // Fallback: match by name prefix
        existingPlanAlmaris = almaris.filter(a => a.is_active && a.name_en.startsWith(p.name_en));
      }

      // Calculate effective capacity per shelf with free space buffer
      const defaultShelves = p.default_shelves || 6;
      const defaultCapPerShelf = p.default_capacity_per_shelf || 30;
      // e.g. 30 * (1 - 0.2) = 24 books per shelf target
      const targetPerShelf = Math.max(1, Math.floor(defaultCapPerShelf * (1 - freeSpace)));

      let bookCursor = 0;
      let almariSeq = existingPlanAlmaris.length;

      // Fill existing almaris first
      for (const existingAlm of existingPlanAlmaris) {
        if (bookCursor >= planBooks.length) break;
        const ensured = this.ensureAlmariShelves(existingAlm);
        const shelves = ensured.shelves || [];
        const shelfSummaries = [];

        for (const sh of shelves) {
          if (bookCursor >= planBooks.length) break;
          const shelfEffectiveCap = Math.max(1, Math.floor((sh.capacity || defaultCapPerShelf) * (1 - freeSpace)));

          // Count already placed books on this shelf if mode is incremental
          const alreadyOnShelf = mode === 'incremental'
            ? allBooks.filter(b => b.almari_id === existingAlm.id && b.shelf_no === sh.shelf_no && !targetBooks.some(tb => tb.id === b.id)).length
            : 0;

          const availableSlots = Math.max(0, shelfEffectiveCap - alreadyOnShelf);
          if (availableSlots <= 0) continue;

          const toTake = planBooks.slice(bookCursor, bookCursor + availableSlots);
          bookCursor += toTake.length;

          for (const b of toTake) {
            booksToUpdate.push({
              ...b,
              almari_id: existingAlm.id,
              shelf_no: sh.shelf_no,
            });
          }

          const shelfRange = this.computeShelfRange(toTake, sh.capacity);
          shelfSummaries.push({
            shelf_no: sh.shelf_no,
            capacity: sh.capacity,
            bookCount: toTake.length + alreadyOnShelf,
            rangeStr: shelfRange.rangeStr,
            fromBarcode: shelfRange.fromBarcode,
            toBarcode: shelfRange.toBarcode,
          });
        }

        almarisSummary.push({
          almariId: existingAlm.id,
          code: existingAlm.code,
          name_en: existingAlm.name_en,
          name_ur: existingAlm.name_ur,
          isNew: false,
          totalShelves: existingAlm.shelf_count,
          totalCapacity: this.getAlmariTotalCapacity(existingAlm),
          booksAssignedCount: shelfSummaries.reduce((acc, s) => acc + s.bookCount, 0),
          shelves: shelfSummaries,
        });
      }

      // If more books remain, CREATE new numbered almaris
      while (bookCursor < planBooks.length) {
        almariSeq++;
        const almNumber = almariSeq;
        const code = `A-${String(nextCodeIndex).padStart(2, '0')}`;
        nextCodeIndex++;

        // English name: "Computer Books 1", "Computer Books 2" (or "Computer Books" if only 1)
        const name_en = almNumber === 1 && planBooks.length <= defaultShelves * targetPerShelf
          ? `${p.name_en}`
          : `${p.name_en} ${almNumber}`;

        // Urdu name: "کمپیوٹر کی کتب ۱"
        const name_ur = almNumber === 1 && planBooks.length <= defaultShelves * targetPerShelf
          ? `${p.name_ur}`
          : `${p.name_ur} ${toUrduDigits(almNumber)}`;

        const newAlmId = `alm-auto-${Date.now()}-${nextCodeIndex}`;
        const newShelves: AlmariShelf[] = [];
        for (let s = 1; s <= defaultShelves; s++) {
          newShelves.push({
            almari_id: newAlmId,
            shelf_no: s,
            capacity: defaultCapPerShelf,
          });
        }

        const newAlmari: Almari = {
          id: newAlmId,
          code,
          name_en,
          name_ur,
          shelf_count: defaultShelves,
          books_per_shelf: defaultCapPerShelf,
          notes: `Auto-arranged collection for ${p.name_en}`,
          is_active: true,
          auto_created: true,
          plan_key: p.key,
          shelves: newShelves,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        almarisCreated.push(newAlmari);
        almaris.push(newAlmari);

        // Link with plan's groups
        for (const gn of p.group_names_en) {
          const matchedGrp = groups.find(g => g.name_en.toLowerCase() === gn.toLowerCase());
          if (matchedGrp) {
            linksCreated.push({
              id: `ag-auto-${Date.now()}-${linksCreated.length}`,
              almari_id: newAlmId,
              group_id: matchedGrp.id,
            });
          }
        }

        const shelfSummaries = [];
        for (const sh of newShelves) {
          if (bookCursor >= planBooks.length) break;
          const toTake = planBooks.slice(bookCursor, bookCursor + targetPerShelf);
          bookCursor += toTake.length;

          for (const b of toTake) {
            booksToUpdate.push({
              ...b,
              almari_id: newAlmId,
              shelf_no: sh.shelf_no,
            });
          }

          const shelfRange = this.computeShelfRange(toTake, sh.capacity);
          shelfSummaries.push({
            shelf_no: sh.shelf_no,
            capacity: sh.capacity,
            bookCount: toTake.length,
            rangeStr: shelfRange.rangeStr,
            fromBarcode: shelfRange.fromBarcode,
            toBarcode: shelfRange.toBarcode,
          });
        }

        almarisSummary.push({
          almariId: newAlmId,
          code,
          name_en,
          name_ur,
          isNew: true,
          totalShelves: defaultShelves,
          totalCapacity: defaultShelves * defaultCapPerShelf,
          booksAssignedCount: shelfSummaries.reduce((acc, s) => acc + s.bookCount, 0),
          shelves: shelfSummaries,
        });
      }
    }

    // If preview only, return without mutating storage
    if (options.previewOnly) {
      return {
        batchId,
        booksToUpdate,
        almarisCreated,
        linksCreated,
        preview: {
          totalBooksProcessed: targetBooks.length,
          totalBooksPlaced: booksToUpdate.length,
          totalBooksSkipped: unmappedBooks.length,
          almarisSummary,
        },
      };
    }

    // Persist new almaris and links if created
    if (almarisCreated.length > 0) {
      this.saveAlmaris([...this.getAlmaris(), ...almarisCreated]);
    }
    if (linksCreated.length > 0) {
      this.saveAlmariGroups([...this.getAlmariGroups(), ...linksCreated]);
    }

    // Record movement history with batch_id and round_no
    const historyEntries: BookLocationHistory[] = [];
    const now = new Date().toISOString();
    for (const b of booksToUpdate) {
      const prevBook = allBooks.find(ob => ob.id === b.id);
      const fromText = prevBook && prevBook.almari_id
        ? `${almaris.find(a => a.id === prevBook.almari_id)?.code || prevBook.almari_id}, Shelf ${prevBook.shelf_no || 1}`
        : 'Unassigned';
      const toAlm = almaris.find(a => a.id === b.almari_id);
      const toText = `${toAlm?.code || b.almari_id}, Shelf ${b.shelf_no || 1}`;

      historyEntries.push({
        id: `lh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        book_id: b.id,
        from: fromText,
        to: toText,
        moved_at: now,
        reason: 'Auto-arrange books',
        batch_id: batchId,
        round_no: roundNo,
      });
    }

    if (historyEntries.length > 0) {
      const curHistory = this.getLocationHistory();
      const mergedHistory = [...historyEntries, ...curHistory].slice(0, 5000);
      this.historyCache = mergedHistory;
      localStorage.setItem(STORAGE_KEYS.LOCATION_HISTORY, JSON.stringify(mergedHistory));
    }

    return {
      batchId,
      booksToUpdate,
      almarisCreated,
      linksCreated,
      preview: {
        totalBooksProcessed: targetBooks.length,
        totalBooksPlaced: booksToUpdate.length,
        totalBooksSkipped: unmappedBooks.length,
        almarisSummary,
      },
    };
  }

  /**
   * Undoes all location changes performed under a batchId
   */
  static undoLocationBatch(batchId: string, allBooks: Book[]): { updatedBooks: Book[]; undoneCount: number; message: string } {
    const history = this.getLocationHistory();
    const batchHistory = history.filter(h => h.batch_id === batchId);
    if (batchHistory.length === 0) {
      return { updatedBooks: allBooks, undoneCount: 0, message: 'No location moves found for this batch.' };
    }

    const almaris = this.getAlmaris();
    const updatedBooks = [...allBooks];
    let undoneCount = 0;

    for (const h of batchHistory) {
      const idx = updatedBooks.findIndex(b => b.id === h.book_id);
      if (idx !== -1) {
        if (h.from === 'Unassigned') {
          updatedBooks[idx] = { ...updatedBooks[idx], almari_id: null, shelf_no: null };
        } else {
          // Parse "A-01, Shelf 2"
          const codeMatch = h.from.match(/A-\d+/i);
          const shelfMatch = h.from.match(/Shelf\s+(\d+)/i);
          const matchedAlm = codeMatch ? almaris.find(a => a.code.toUpperCase() === codeMatch[0].toUpperCase()) : null;
          updatedBooks[idx] = {
            ...updatedBooks[idx],
            almari_id: matchedAlm ? matchedAlm.id : null,
            shelf_no: shelfMatch ? parseInt(shelfMatch[1], 10) : 1,
          };
        }
        undoneCount++;
      }
    }

    // Clean batch from history
    const remainingHistory = history.filter(h => h.batch_id !== batchId);
    this.historyCache = remainingHistory;
    localStorage.setItem(STORAGE_KEYS.LOCATION_HISTORY, JSON.stringify(remainingHistory));

    return { updatedBooks, undoneCount, message: `Reverted ${undoneCount} book placements.` };
  }

  /**
   * Automatic placement for a newly added book
   */
  static autoPlaceNewBook(
    book: Book,
    allBooks: Book[]
  ): { placedBook: Book; message: string; needsRebalance: boolean } {
    const grp = book.group_id ? this.getGroups().find(g => g.id === book.group_id) : this.suggestGroup(book);
    const groupId = grp ? grp.id : null;

    if (!groupId) {
      return { placedBook: book, message: 'No matching group found. Book placed in unassigned stacks.', needsRebalance: false };
    }

    const suggestion = this.suggestAlmariAndShelf(groupId, allBooks);
    if (!suggestion) {
      // Run auto-arrange in incremental mode to create the almari
      const autoRes = this.autoArrangeBooks([{ ...book, group_id: groupId }], { mode: 'incremental', scope: 'unassigned' });
      if (autoRes.booksToUpdate.length > 0) {
        const placed = autoRes.booksToUpdate[0];
        const alm = this.getAlmaris().find(a => a.id === placed.almari_id);
        return {
          placedBook: placed,
          message: `Placed in ${alm?.name_en || 'Stacks'} - ${alm?.code || 'A-01'}, Shelf ${placed.shelf_no || 1}`,
          needsRebalance: false,
        };
      }
      return { placedBook: { ...book, group_id: groupId }, message: `Assigned group ${grp?.name_en}, waiting for almari space.`, needsRebalance: true };
    }

    const placedBook: Book = {
      ...book,
      group_id: groupId,
      almari_id: suggestion.almari.id,
      shelf_no: suggestion.shelf_no,
    };

    // Check if shelf is full
    const booksOnShelf = allBooks.filter(b => b.almari_id === suggestion.almari.id && b.shelf_no === suggestion.shelf_no).length;
    const shelfCap = suggestion.almari.books_per_shelf || 30;
    const needsRebalance = booksOnShelf >= shelfCap;

    return {
      placedBook,
      message: `Placed in ${suggestion.almari.name_en} - ${suggestion.almari.code}, Shelf ${suggestion.shelf_no}`,
      needsRebalance,
    };
  }

  // --- ALMARI_GROUPS (Many-to-Many) ---
  static getAlmariGroups(): AlmariGroup[] {
    if (this.almariGroupsCache) return this.almariGroupsCache;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ALMARI_GROUPS);
      if (raw) {
        this.almariGroupsCache = JSON.parse(raw);
        return this.almariGroupsCache!;
      }
    } catch {}
    this.almariGroupsCache = [...INITIAL_ALMARI_GROUPS];
    this.saveAlmariGroups(this.almariGroupsCache);
    return this.almariGroupsCache;
  }

  static saveAlmariGroups(links: AlmariGroup[]): void {
    this.almariGroupsCache = links;
    localStorage.setItem(STORAGE_KEYS.ALMARI_GROUPS, JSON.stringify(links));
  }

  static getGroupsForAlmari(almariId: string): BookGroup[] {
    const links = this.getAlmariGroups().filter(l => l.almari_id === almariId);
    const groupIds = new Set(links.map(l => l.group_id));
    return this.getGroups().filter(g => groupIds.has(g.id));
  }

  static getAlmarisForGroup(groupId: string): Almari[] {
    const links = this.getAlmariGroups().filter(l => l.group_id === groupId);
    const almariIds = new Set(links.map(l => l.almari_id));
    return this.getAlmaris().filter(a => almariIds.has(a.id));
  }

  // --- LOCATION HISTORY ---
  static getLocationHistory(): BookLocationHistory[] {
    if (this.historyCache) return this.historyCache;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOCATION_HISTORY);
      if (raw) {
        this.historyCache = JSON.parse(raw);
        return this.historyCache!;
      }
    } catch {}
    this.historyCache = [];
    return this.historyCache;
  }

  static recordMove(entry: Omit<BookLocationHistory, 'id' | 'moved_at'>): void {
    const list = this.getLocationHistory();
    const newEntry: BookLocationHistory = {
      ...entry,
      id: `lh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      moved_at: new Date().toISOString(),
    };
    list.unshift(newEntry);
    this.historyCache = list.slice(0, 3000);
    localStorage.setItem(STORAGE_KEYS.LOCATION_HISTORY, JSON.stringify(this.historyCache));
  }

  static getHistoryForBook(bookId: string): BookLocationHistory[] {
    return this.getLocationHistory().filter(h => h.book_id === bookId);
  }

  // --- AUTO-SUGGESTION ENGINE ---
  static suggestGroup(book: { category?: string; language?: string; book_name?: string }): BookGroup | null {
    const groups = this.getGroups().filter(g => g.is_active).sort((a, b) => a.sort_order - b.sort_order);
    const lang = (book.language || '').trim().toLowerCase();
    const cat = (book.category || '').trim().toLowerCase();

    for (const grp of groups) {
      if (grp.match_language && grp.match_language.trim().toLowerCase() === lang) {
        return grp;
      }
      if (grp.match_category && grp.match_category.trim().toLowerCase() === cat) {
        return grp;
      }
    }

    for (const grp of groups) {
      if (grp.match_language) {
        const ml = grp.match_language.toLowerCase();
        if (lang.includes(ml) || cat.includes(ml)) return grp;
      }
    }

    for (const grp of groups) {
      if (grp.match_category) {
        const mc = grp.match_category.toLowerCase();
        if (cat.includes(mc)) return grp;
      }
    }

    const other = groups.find(g => g.name_en === 'Other') || groups.find(g => g.name_en === 'General Reference');
    return other || groups[0] || null;
  }

  static suggestAlmariAndShelf(groupId: string, allBooks: Book[]): { almari: Almari; shelf_no: number } | null {
    const candidateAlmaris = this.getAlmarisForGroup(groupId).filter(a => a.is_active);
    if (candidateAlmaris.length === 0) return null;

    const shelfCounts: Record<string, number> = {};
    for (const b of allBooks) {
      if (b.almari_id && b.shelf_no) {
        const key = `${b.almari_id}:${b.shelf_no}`;
        shelfCounts[key] = (shelfCounts[key] || 0) + 1;
      }
    }

    for (const alm of candidateAlmaris) {
      const ensured = this.ensureAlmariShelves(alm);
      const shelves = ensured.shelves || [];
      for (const sh of shelves) {
        const cap = sh.capacity || 30;
        const key = `${alm.id}:${sh.shelf_no}`;
        const count = shelfCounts[key] || 0;
        if (count < cap) {
          return { almari: alm, shelf_no: sh.shelf_no };
        }
      }
    }

    const firstAlm = candidateAlmaris[0];
    return { almari: firstAlm, shelf_no: 1 };
  }

  static createAlmarisFromGroups(): Almari[] {
    const res = this.autoArrangeBooks([], { mode: 'full', scope: 'unassigned' });
    return this.getAlmaris();
  }

  // --- SAFE MIGRATION HELPER ---
  static migrateBooksWithGroupsAndAlmaris(books: Book[]): { migrated: Book[]; changesCount: number } {
    const groups = this.getGroups();
    const almaris = this.getAlmaris();
    let changesCount = 0;

    const migrated = books.map(book => {
      let changed = false;
      let group_id = book.group_id;
      let almari_id = book.almari_id;
      let shelf_no = book.shelf_no;

      if (!group_id) {
        const suggested = this.suggestGroup(book);
        if (suggested) {
          group_id = suggested.id;
          changed = true;
        }
      }

      if (!almari_id && book.shelf) {
        const shelfStr = book.shelf.toUpperCase();
        const matchedAlm = almaris.find(a => shelfStr.includes(a.code.toUpperCase()));
        if (matchedAlm) {
          almari_id = matchedAlm.id;
          shelf_no = 1;
          changed = true;
        }
      }

      if (changed) {
        changesCount++;
        return {
          ...book,
          group_id: group_id || null,
          almari_id: almari_id || null,
          shelf_no: shelf_no || null,
        };
      }
      return book;
    });

    return { migrated, changesCount };
  }
}
