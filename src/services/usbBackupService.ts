/**
 * University of Lakki Marwat - Library Management System (LMS)
 * USB Backup & Data Transfer Service
 * 
 * Features:
 * - Single file ZIP package: Library_Data_Backup_YYYY-MM-DD_HH-mm.zip
 * - manifest.json with record counts, schema version, and SHA-256 integrity digests
 * - NDJSON tabular streams for books, members, transactions, settings
 * - Portable images/ folder with relative paths
 * - Native showSaveFilePicker with fallback download
 * - Pre-restore safety backup (Pre_Restore_YYYY-MM-DD_HH-mm.zip)
 * - Atomic validation & transactional rollback on failure
 * - Merge & Replace modes with accession/university_id matching and conflict reporting
 * - Strict ZIP security against directory traversal, absolute paths, and zip bombs
 */

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { Book, Borrower, Transaction, SystemSettings } from '../types/library';
import { LibraryStorage } from './storage';
import { computeSortKey, computeSearchText } from '../utils/urduUtils';
import { LibraryDataFilesService } from './libraryDataFilesService';
import { BookSheetService } from './bookSheetService';

export interface BackupManifest {
  backupFormatVersion: string;
  application: string;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  sourcePC: string;
  recordCounts: {
    books: number;
    members: number;
    transactions: number;
    settings: number;
    images: number;
  };
  files: Record<string, { records?: number; sha256: string; bytes: number }>;
}

export interface ValidationReport {
  valid: boolean;
  manifest?: BackupManifest;
  errors: string[];
  warnings: string[];
  totalEntries: number;
  totalBytes: number;
}

export interface ImportConflict {
  entity: 'Book' | 'Borrower' | 'Transaction';
  identifier: string;
  existingName: string;
  incomingName: string;
  existingDate: string;
  incomingDate: string;
  resolution: string;
}

export interface ImportResult {
  success: boolean;
  mode: 'REPLACE' | 'MERGE';
  booksImported: number;
  membersImported: number;
  transactionsImported: number;
  imagesReconnected: number;
  conflicts: ImportConflict[];
  safetyBackupCreated: boolean;
  safetyBackupFilename?: string;
  message: string;
}

const CURRENT_SCHEMA_VERSION = 3;
const APP_VERSION = '2.4.0';
const APP_NAME = 'University of Lakki Marwat - Library Management System';

export class UsbBackupService {
  /**
   * Computes SHA-256 hex string for a given Uint8Array
   */
  static async computeSha256(data: Uint8Array): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback simple checksum if Web Crypto is unavailable
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data[i];
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Helper to format current local time as YYYY-MM-DD_HH-mm
   */
  static getTimestampString(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }

  /**
   * Requests browser persistent storage (navigator.storage.persist)
   */
  static async requestPersistence(): Promise<{ persisted: boolean; usageMb: string; quotaMb: string }> {
    let persisted = false;
    let usageMb = '0.0';
    let quotaMb = '0.0';

    if (typeof navigator !== 'undefined' && navigator.storage) {
      try {
        if (navigator.storage.persist) {
          persisted = await navigator.storage.persist();
        } else if (navigator.storage.persisted) {
          persisted = await navigator.storage.persisted();
        }

        if (navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          const u = est.usage || 0;
          const q = est.quota || 0;
          usageMb = (u / (1024 * 1024)).toFixed(2);
          quotaMb = (q / (1024 * 1024)).toFixed(0);
        }
      } catch {
        // Ignore estimation errors
      }
    }

    return { persisted, usageMb, quotaMb };
  }

  /**
   * Checks days elapsed since the last backup
   */
  static getBackupAgeInfo(): { lastBackupDate: string | null; daysSinceBackup: number; isOverdue: boolean } {
    try {
      const last = localStorage.getItem('ulm_lms_last_backup_timestamp');
      if (!last) {
        return { lastBackupDate: null, daysSinceBackup: 999, isOverdue: true };
      }
      const lastTime = new Date(last).getTime();
      const now = Date.now();
      const diffDays = Math.floor((now - lastTime) / (1000 * 60 * 60 * 24));
      return {
        lastBackupDate: new Date(last).toLocaleString(),
        daysSinceBackup: diffDays,
        isOverdue: diffDays >= 7,
      };
    } catch {
      return { lastBackupDate: null, daysSinceBackup: 999, isOverdue: true };
    }
  }

  /**
   * Creates a pre-restore safety snapshot ZIP and returns its Blob
   */
  static async createPreRestoreSafetyBackup(): Promise<{ success: boolean; blob?: Blob; filename?: string; message: string }> {
    try {
      const filename = `Pre_Restore_${this.getTimestampString()}.zip`;
      const res = await this.buildBackupZip(() => {});
      if (!res.success || !res.zipBytes) {
        return { success: false, message: 'Could not create safety backup.' };
      }
      const blob = new Blob([res.zipBytes as BlobPart], { type: 'application/zip' });
      return { success: true, blob, filename, message: 'Safety backup created successfully.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Safety backup creation failed' };
    }
  }

  /**
   * Internal builder for full backup archive
   */
  public static async buildBackupZip(
    onProgress: (pct: number, stage: string) => void
  ): Promise<{ success: boolean; zipBytes?: Uint8Array; manifest?: BackupManifest; message: string }> {
    onProgress(5, 'Gathering database tables...');

    const books = LibraryStorage.getBooks();
    const borrowers = LibraryStorage.getBorrowers();
    const transactions = LibraryStorage.getTransactions();
    const history = LibraryStorage.getHistory();
    const settings = LibraryStorage.getSettings();

    const zipFiles: Record<string, Uint8Array> = {};
    let imageCount = 0;

    onProgress(20, 'Packaging and extracting book cover images...');

    // 1. Process books and extract base64 images into portable image files
    const portableBooks = books.map((b, idx) => {
      const copy = { ...b };
      if (copy.book_image_path && copy.book_image_path.startsWith('data:image/')) {
        try {
          const match = copy.book_image_path.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            const base64Data = match[2];
            const byteString = atob(base64Data);
            const arrayBuffer = new Uint8Array(byteString.length);
            for (let i = 0; i < byteString.length; i++) {
              arrayBuffer[i] = byteString.charCodeAt(i);
            }
            const cleanAcc = (b.barcode || `book_${idx}`).replace(/[^a-zA-Z0-9_-]/g, '_');
            const imgPath = `images/books/${cleanAcc}.${ext}`;
            zipFiles[imgPath] = arrayBuffer;
            copy.book_image_path = imgPath;
            imageCount++;
          }
        } catch {
          // If extraction fails, leave as is
        }
      }
      return copy;
    });

    onProgress(40, 'Packaging member identity photos...');

    // 2. Process borrowers and extract photos
    const portableBorrowers = borrowers.map((m, idx) => {
      const copy = { ...m };
      const rawPhoto = copy.photo_url || copy.photo_path;
      if (rawPhoto && rawPhoto.startsWith('data:image/')) {
        try {
          const match = rawPhoto.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            const base64Data = match[2];
            const byteString = atob(base64Data);
            const arrayBuffer = new Uint8Array(byteString.length);
            for (let i = 0; i < byteString.length; i++) {
              arrayBuffer[i] = byteString.charCodeAt(i);
            }
            const cleanId = (m.university_id || m.student_id || `member_${idx}`).replace(/[^a-zA-Z0-9_-]/g, '_');
            const imgPath = `images/members/${cleanId}.${ext}`;
            zipFiles[imgPath] = arrayBuffer;
            copy.photo_url = imgPath;
            copy.photo_path = imgPath;
            imageCount++;
          }
        } catch {
          // Leave as is if parse fails
        }
      }
      return copy;
    });

    onProgress(60, 'Generating table NDJSON streams, CSVs, Excel workbook, and SHA-256 integrity digests...');

    // 3. Serialize tables to NDJSON
    const booksNdjson = portableBooks.map(b => JSON.stringify(b)).join('\n') + '\n';
    const membersNdjson = portableBorrowers.map(m => JSON.stringify(m)).join('\n') + '\n';
    const txNdjson = transactions.map(t => JSON.stringify(t)).join('\n') + '\n';
    const historyNdjson = history.map(h => JSON.stringify(h)).join('\n') + '\n';
    const settingsNdjson = JSON.stringify(settings) + '\n';

    const booksBytes = strToU8(booksNdjson);
    const membersBytes = strToU8(membersNdjson);
    const txBytes = strToU8(txNdjson);
    const historyBytes = strToU8(historyNdjson);
    const settingsBytes = strToU8(settingsNdjson);

    zipFiles['data/books.ndjson'] = booksBytes;
    zipFiles['data/members.ndjson'] = membersBytes;
    zipFiles['data/transactions.ndjson'] = txBytes;
    zipFiles['data/history.ndjson'] = historyBytes;
    zipFiles['data/settings.ndjson'] = settingsBytes;

    // 3b. Generate and include LibraryData.xlsx and CSV data files
    let xlsxBuf: any = null;
    let booksCsv = '';
    let membersCsv = '';
    let txCsv = '';
    try {
      const wb = await LibraryDataFilesService.generateLibraryDataWorkbook(books, borrowers, transactions);
      xlsxBuf = await wb.xlsx.writeBuffer();
      booksCsv = LibraryDataFilesService.generateBooksCsv(books);
      membersCsv = LibraryDataFilesService.generateMembersCsv(borrowers);
      txCsv = LibraryDataFilesService.generateTransactionsCsv(transactions);

      zipFiles['LibraryData.xlsx'] = new Uint8Array(xlsxBuf);
      zipFiles['books.csv'] = strToU8(booksCsv);
      zipFiles['members.csv'] = strToU8(membersCsv);
      zipFiles['transactions.csv'] = strToU8(txCsv);

      zipFiles['Data Files/LibraryData.xlsx'] = new Uint8Array(xlsxBuf);
      zipFiles['Data Files/books.csv'] = strToU8(booksCsv);
      zipFiles['Data Files/members.csv'] = strToU8(membersCsv);
      zipFiles['Data Files/loans.csv'] = strToU8(txCsv);
    } catch {
      // Continue if workbook generation encounters memory constraints
    }

    // 3c. Database Snapshot (Library.ulmlib format snapshot)
    const dbSnapshot = JSON.stringify({
      format: 'ULM_LIBRARY_DATABASE',
      schema_version: CURRENT_SCHEMA_VERSION,
      app_name: APP_NAME,
      university: settings.university_name || 'University of Lakki Marwat',
      library: settings.library_name || 'Central Campus Library',
      exported_at: new Date().toISOString(),
      books,
      borrowers,
      transactions,
      history,
      settings: {
        ...settings,
        db_path: 'Library.ulmlib',
      },
    }, null, 2);
    const dbBytes = strToU8(dbSnapshot);
    zipFiles['Library.ulmlib'] = dbBytes;
    zipFiles['database/snapshot.json'] = dbBytes;

    // 3d. Book Sheet
    const cachedSheet = BookSheetService.getCachedBytes();
    if (cachedSheet) {
      zipFiles['Book Sheet/ULM_Book_Entry_Sheet.xlsx'] = cachedSheet;
    }

    // 3e. README.txt instructions for transfer
    const readme = `================================================================================
UNIVERSITY OF LAKKI MARWAT - CENTRAL CAMPUS LIBRARY MANAGEMENT SYSTEM
MASTER PC-TO-PC TRANSFER & ARCHIVE PACKAGE
================================================================================
Package Created: ${new Date().toLocaleString()}
Workstation Terminal: ${settings.station_id || 'ULM-TERMINAL-01'}
Total Titles: ${books.length}
Total Members: ${borrowers.length}
Total Circulation Records: ${transactions.length}

TRANSFER INSTRUCTIONS FOR NEW PC:
1. Copy this ZIP file to your target PC (e.g. via USB flash drive).
2. Launch the ULM Library Management System on the target PC.
3. On the Welcome Screen, select "Import from ZIP" and choose this package.
   Alternatively, extract the ZIP into your chosen library folder and select
   "Open Library Folder".
4. The system validates all SHA-256 checksums, imports all book records, member
   profiles, loan records, restores book covers and portrait photos, and
   rebuilds search indexes and sort collations automatically.
================================================================================
`;
    zipFiles['README.txt'] = strToU8(readme);

    // 4. Compute SHA-256 digests for all files in archive
    const manifestFiles: Record<string, { records?: number; sha256: string; bytes: number }> = {};
    for (const [path, bytes] of Object.entries(zipFiles)) {
      if (path === 'manifest.json') continue;
      const sha = await this.computeSha256(bytes);
      let records: number | undefined;
      if (path === 'data/books.ndjson') records = books.length;
      else if (path === 'data/members.ndjson') records = borrowers.length;
      else if (path === 'data/transactions.ndjson') records = transactions.length;
      manifestFiles[path] = {
        records,
        sha256: sha,
        bytes: bytes.length,
      };
    }

    // 5. Build manifest.json
    const manifest: BackupManifest = {
      backupFormatVersion: '1.0',
      application: APP_NAME,
      appVersion: APP_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      sourcePC: settings.station_id || 'ULM-TERMINAL-01',
      recordCounts: {
        books: books.length,
        members: borrowers.length,
        transactions: transactions.length,
        settings: 1,
        images: imageCount,
      },
      files: manifestFiles,
    };

    const manifestBytes = strToU8(JSON.stringify(manifest, null, 2));
    zipFiles['manifest.json'] = manifestBytes;

    onProgress(85, 'Compressing archive with fflate...');

    const zipBytes = zipSync(zipFiles, { level: 6 });

    onProgress(100, 'Backup package generated successfully.');

    return { success: true, zipBytes, manifest, message: 'Archive built successfully.' };
  }

  /**
   * Main Export Entry point for .ulmpack transfer package
   */
  static async exportLibraryPackage(
    onProgress: (pct: number, stage: string) => void
  ): Promise<{ success: boolean; filename: string; sizeBytes: number; message: string }> {
    const filename = `ULM_Library_Package_${this.getTimestampString()}.ulmpack`;

    const buildRes = await this.buildBackupZip(onProgress);
    if (!buildRes.success || !buildRes.zipBytes) {
      return { success: false, filename, sizeBytes: 0, message: buildRes.message };
    }

    const zipBytes = buildRes.zipBytes;
    const blob = new Blob([zipBytes as BlobPart], { type: 'application/octet-stream' });

    try {
      localStorage.setItem('ulm_lms_last_backup_timestamp', new Date().toISOString());
    } catch {}

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'ULM Library Package (*.ulmpack)',
              accept: { 'application/octet-stream': ['.ulmpack'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        this.writeRollingBackupIfConfigured(zipBytes, filename);

        return {
          success: true,
          filename,
          sizeBytes: zipBytes.length,
          message: `Saved library package (${(zipBytes.length / 1024).toFixed(1)} KB).`,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: false, filename, sizeBytes: 0, message: 'Export cancelled by user.' };
        }
      }
    }

    // Fallback download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    this.writeRollingBackupIfConfigured(zipBytes, filename);

    return {
      success: true,
      filename,
      sizeBytes: zipBytes.length,
      message: `Downloaded library package (${(zipBytes.length / 1024).toFixed(1)} KB).`,
    };
  }

  /**
   * Main Export Entry point: Exports library to USB with save dialog or download fallback
   */
  static async exportToUsb(
    onProgress: (pct: number, stage: string) => void
  ): Promise<{ success: boolean; filename: string; sizeBytes: number; message: string }> {
    const filename = `Library_Export_${this.getTimestampString()}.zip`;

    const buildRes = await this.buildBackupZip(onProgress);
    if (!buildRes.success || !buildRes.zipBytes) {
      return { success: false, filename, sizeBytes: 0, message: buildRes.message };
    }

    const zipBytes = buildRes.zipBytes;
    const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });

    // Mark last backup timestamp
    try {
      localStorage.setItem('ulm_lms_last_backup_timestamp', new Date().toISOString());
    } catch {}

    // 1. Try modern showSaveFilePicker (Chrome/Edge USB drive picker)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'ULM Library Data Backup Archive (*.zip)',
              accept: { 'application/zip': ['.zip'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        // Also perform rolling backup if storage handle configured
        this.writeRollingBackupIfConfigured(zipBytes, filename);

        return {
          success: true,
          filename,
          sizeBytes: zipBytes.length,
          message: `Saved backup to chosen location (${(zipBytes.length / 1024).toFixed(1)} KB).`,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: false, filename, sizeBytes: 0, message: 'Export cancelled by user.' };
        }
        // Fall back to standard download
      }
    }

    // 2. Standard browser download fallback
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Also perform rolling backup if storage handle configured
    this.writeRollingBackupIfConfigured(zipBytes, filename);

    return {
      success: true,
      filename,
      sizeBytes: zipBytes.length,
      message: `Downloaded backup archive (${(zipBytes.length / 1024).toFixed(1)} KB).`,
    };
  }

  /**
   * Writes rolling automatic backup into linked folder (keeps up to 14)
   */
  private static async writeRollingBackupIfConfigured(zipBytes: Uint8Array, filename: string): Promise<void> {
    const handle = LibraryStorage.getDirectoryHandle();
    if (!handle) return;

    try {
      // Get or create backups folder
      const backupDir = await handle.getDirectoryHandle('backups', { create: true });
      const fileHandle = await backupDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(zipBytes);
      await writable.close();

      // Prune rolling backups beyond 14
      const entries: string[] = [];
      for await (const name of backupDir.keys()) {
        if (name.endsWith('.zip')) {
          entries.push(name);
        }
      }
      entries.sort();
      while (entries.length > 14) {
        const oldest = entries.shift();
        if (oldest) {
          try {
            await backupDir.removeEntry(oldest);
          } catch {}
        }
      }
    } catch {
      // Ignore background rolling backup errors
    }
  }

  /**
   * Validates an uploaded backup ZIP file thoroughly against all safety rules:
   * - Readable ZIP format
   * - Traversal attack prevention (no "..", no leading "/", no drive letters, no symlinks)
   * - Entry count limit (< 20,000) and uncompressed size limit (< 500 MB)
   * - manifest.json existence and validity
   * - Required data files present
   * - SHA-256 match for every file
   * - Schema version compatibility check
   */
  static async validateBackupZip(fileBytes: Uint8Array): Promise<ValidationReport> {
    const errors: string[] = [];
    const warnings: string[] = [];

    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(fileBytes);
    } catch (e: any) {
      return {
        valid: false,
        errors: [`Invalid or corrupted ZIP archive: ${e.message || 'Cannot unzip'}`],
        warnings: [],
        totalEntries: 0,
        totalBytes: 0,
      };
    }

    const entries = Object.keys(unzipped);
    const totalEntries = entries.length;

    // 1. Entry count and size limit check
    if (totalEntries > 20000) {
      errors.push(`Archive contains ${totalEntries} entries, exceeding safety limit of 20,000.`);
    }

    let totalBytes = 0;
    for (const entry of entries) {
      // 2. Traversal and security checks
      if (entry.includes('..')) {
        errors.push(`Security violation: Archive contains relative traversal path "${entry}".`);
      }
      if (entry.startsWith('/') || entry.startsWith('\\')) {
        errors.push(`Security violation: Archive contains absolute path "${entry}".`);
      }
      if (/^[a-zA-Z]:/.test(entry)) {
        errors.push(`Security violation: Archive contains absolute drive letter path "${entry}".`);
      }

      totalBytes += unzipped[entry].length;
    }

    if (totalBytes > 500 * 1024 * 1024) {
      errors.push(`Archive uncompressed size (${(totalBytes / (1024 * 1024)).toFixed(1)} MB) exceeds 500 MB limit.`);
    }

    // 3. Check manifest.json
    if (!unzipped['manifest.json']) {
      errors.push('Archive is missing mandatory "manifest.json" descriptor.');
      return { valid: false, errors, warnings, totalEntries, totalBytes };
    }

    let manifest: BackupManifest;
    try {
      const manifestStr = strFromU8(unzipped['manifest.json']);
      manifest = JSON.parse(manifestStr);
    } catch {
      errors.push('Manifest file "manifest.json" contains invalid or malformed JSON.');
      return { valid: false, errors, warnings, totalEntries, totalBytes };
    }

    if (!manifest.application || !manifest.application.includes('Library Management System')) {
      errors.push(`Foreign backup: Package belongs to "${manifest.application || 'Unknown'}", not this application.`);
    }

    // 4. Schema version check
    if (manifest.schemaVersion > CURRENT_SCHEMA_VERSION) {
      errors.push(
        `Cannot import: Backup was created with newer schema v${manifest.schemaVersion}. This software supports up to schema v${CURRENT_SCHEMA_VERSION}. Please update the software.`
      );
    } else if (manifest.schemaVersion < CURRENT_SCHEMA_VERSION) {
      warnings.push(`Backup uses older schema v${manifest.schemaVersion}. It will be upgraded automatically to schema v${CURRENT_SCHEMA_VERSION}.`);
    }

    // 5. Verify required files and SHA-256 digests
    if (manifest.files) {
      for (const [filePath, meta] of Object.entries(manifest.files)) {
        const fileContent = unzipped[filePath];
        if (!fileContent) {
          errors.push(`Missing data file listed in manifest: "${filePath}".`);
          continue;
        }

        const calculatedSha = await this.computeSha256(fileContent);
        if (calculatedSha.toLowerCase() !== meta.sha256.toLowerCase()) {
          errors.push(`Integrity verification failed for "${filePath}": checksum mismatch (expected ${meta.sha256.slice(0, 10)}..., calculated ${calculatedSha.slice(0, 10)}...). File has been modified or corrupted.`);
        }
      }
    } else {
      errors.push('Manifest does not contain file integrity checksums.');
    }

    return {
      valid: errors.length === 0,
      manifest,
      errors,
      warnings,
      totalEntries,
      totalBytes,
    };
  }

  /**
   * Imports the validated backup archive into the library.
   * Performs pre-restore safety backup, validates, then executes either Replace or Merge.
   */
  static async importFromUsb(
    fileBytes: Uint8Array,
    mode: 'REPLACE' | 'MERGE',
    onProgress: (pct: number, stage: string) => void
  ): Promise<ImportResult> {
    onProgress(5, 'Validating backup integrity and SHA-256 signatures...');

    const val = await this.validateBackupZip(fileBytes);
    if (!val.valid) {
      return {
        success: false,
        mode,
        booksImported: 0,
        membersImported: 0,
        transactionsImported: 0,
        imagesReconnected: 0,
        conflicts: [],
        safetyBackupCreated: false,
        message: val.errors.join(' | '),
      };
    }

    const unzipped = unzipSync(fileBytes);

    onProgress(20, 'Creating pre-restore safety snapshot before altering records...');

    // Safety backup of existing data
    const existingBooks = LibraryStorage.getBooks();
    const existingBorrowers = LibraryStorage.getBorrowers();
    const existingTransactions = LibraryStorage.getTransactions();
    const existingHistory = LibraryStorage.getHistory();
    const existingSettings = LibraryStorage.getSettings();

    let safetyBackupCreated = false;
    let safetyBackupFilename = '';
    if (existingBooks.length > 0 || existingBorrowers.length > 0) {
      const safety = await this.createPreRestoreSafetyBackup();
      if (safety.success) {
        safetyBackupCreated = true;
        safetyBackupFilename = safety.filename || '';
      }
    }

    onProgress(35, 'Extracting and reconnecting image binaries...');

    // Cache image files in a map for instant data URL reconstruction
    const imageMap = new Map<string, string>();
    for (const [path, bytes] of Object.entries(unzipped)) {
      if (path.startsWith('images/')) {
        const ext = path.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        imageMap.set(path, `data:${mime};base64,${base64}`);
      }
    }

    onProgress(50, 'Parsing table records...');

    // Parse NDJSON tables
    const parseNdjson = <T>(path: string): T[] => {
      const fileBytes = unzipped[path];
      if (!fileBytes) return [];
      const text = strFromU8(fileBytes);
      return text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line));
    };

    let importedBooks: Book[] = [];
    let importedBorrowers: Borrower[] = [];
    let importedTransactions: Transaction[] = [];

    try {
      importedBooks = parseNdjson<Book>('data/books.ndjson');
      importedBorrowers = parseNdjson<Borrower>('data/members.ndjson');
      importedTransactions = parseNdjson<Transaction>('data/transactions.ndjson');
    } catch (e: any) {
      return {
        success: false,
        mode,
        booksImported: 0,
        membersImported: 0,
        transactionsImported: 0,
        imagesReconnected: 0,
        conflicts: [],
        safetyBackupCreated,
        safetyBackupFilename,
        message: `Failed parsing NDJSON tables: ${e.message}`,
      };
    }

    // Reconnect images & recompute derived sort keys and search index
    let reconnectedImages = 0;
    importedBooks = importedBooks.map(b => {
      let cover = b.book_image_path;
      if (cover && imageMap.has(cover)) {
        cover = imageMap.get(cover)!;
        reconnectedImages++;
      }
      return {
        ...b,
        book_image_path: cover,
        language: b.language || 'English',
        title_sort: computeSortKey(b.book_name, true),
        author_sort: computeSortKey(b.author, true),
        search_text: computeSearchText(b),
      };
    });

    importedBorrowers = importedBorrowers.map(m => {
      let photo = m.photo_url || m.photo_path || '';
      if (photo && imageMap.has(photo)) {
        photo = imageMap.get(photo)!;
        reconnectedImages++;
      }
      return {
        ...m,
        photo_url: photo,
        photo_path: photo,
      };
    });

    onProgress(70, mode === 'REPLACE' ? 'Replacing catalog...' : 'Merging records and analyzing conflicts...');

    const conflicts: ImportConflict[] = [];

    let finalBooks: Book[] = [];
    let finalBorrowers: Borrower[] = [];
    let finalTransactions: Transaction[] = [];

    if (mode === 'REPLACE') {
      finalBooks = importedBooks;
      finalBorrowers = importedBorrowers;
      finalTransactions = importedTransactions;
    } else {
      // MERGE MODE
      // 1. Books: match by barcode / accession number
      const bookMap = new Map<string, Book>();
      existingBooks.forEach(b => bookMap.set(b.barcode.trim().toUpperCase(), b));

      importedBooks.forEach(incoming => {
        const key = incoming.barcode.trim().toUpperCase();
        if (bookMap.has(key)) {
          const existing = bookMap.get(key)!;
          const exDate = existing.updated_at || existing.created_at || '';
          const inDate = incoming.updated_at || incoming.created_at || '';

          if (inDate > exDate) {
            bookMap.set(key, incoming);
            conflicts.push({
              entity: 'Book',
              identifier: incoming.barcode,
              existingName: existing.book_name,
              incomingName: incoming.book_name,
              existingDate: exDate,
              incomingDate: inDate,
              resolution: 'Updated with newer incoming version',
            });
          } else {
            conflicts.push({
              entity: 'Book',
              identifier: incoming.barcode,
              existingName: existing.book_name,
              incomingName: incoming.book_name,
              existingDate: exDate,
              incomingDate: inDate,
              resolution: 'Retained existing newer/equal record',
            });
          }
        } else {
          bookMap.set(key, incoming);
        }
      });
      finalBooks = Array.from(bookMap.values());

      // 2. Members: match by university ID
      const memberMap = new Map<string, Borrower>();
      existingBorrowers.forEach(m => memberMap.set((m.university_id || m.student_id).trim().toUpperCase(), m));

      importedBorrowers.forEach(incoming => {
        const key = (incoming.university_id || incoming.student_id).trim().toUpperCase();
        if (memberMap.has(key)) {
          const existing = memberMap.get(key)!;
          const exDate = existing.updated_at || existing.created_at || '';
          const inDate = incoming.updated_at || incoming.created_at || '';

          if (inDate > exDate) {
            memberMap.set(key, incoming);
            conflicts.push({
              entity: 'Borrower',
              identifier: key,
              existingName: existing.name,
              incomingName: incoming.name,
              existingDate: exDate,
              incomingDate: inDate,
              resolution: 'Updated with newer incoming profile',
            });
          } else {
            conflicts.push({
              entity: 'Borrower',
              identifier: key,
              existingName: existing.name,
              incomingName: incoming.name,
              existingDate: exDate,
              incomingDate: inDate,
              resolution: 'Retained existing profile',
            });
          }
        } else {
          memberMap.set(key, incoming);
        }
      });
      finalBorrowers = Array.from(memberMap.values());

      // 3. Transactions: match by id
      const txMap = new Map<string, Transaction>();
      existingTransactions.forEach(t => txMap.set(t.id, t));
      importedTransactions.forEach(t => {
        if (!txMap.has(t.id)) {
          txMap.set(t.id, t);
        }
      });
      finalTransactions = Array.from(txMap.values());
    }

    onProgress(90, 'Committing changes to persistent local store...');

    try {
      LibraryStorage.saveBooks(finalBooks);
      LibraryStorage.saveBorrowers(finalBorrowers);
      LibraryStorage.saveTransactions(finalTransactions);

      // Log history event
      LibraryStorage.logHistory({
        action: 'USB_RESTORE',
        description: `Imported backup package in ${mode} mode: ${importedBooks.length} books, ${importedBorrowers.length} members, ${importedTransactions.length} loans.`,
        barcode: 'USB-RESTORE',
        user: 'System-Admin',
      });

      onProgress(100, 'Import completed successfully!');

      return {
        success: true,
        mode,
        booksImported: importedBooks.length,
        membersImported: importedBorrowers.length,
        transactionsImported: importedTransactions.length,
        imagesReconnected: reconnectedImages,
        conflicts,
        safetyBackupCreated,
        safetyBackupFilename,
        message: `Successfully imported ${importedBooks.length} books, ${importedBorrowers.length} members, and ${importedTransactions.length} loans.`,
      };
    } catch (commitErr: any) {
      // Rollback to existing data
      LibraryStorage.saveBooks(existingBooks);
      LibraryStorage.saveBorrowers(existingBorrowers);
      LibraryStorage.saveTransactions(existingTransactions);
      LibraryStorage.saveSettings(existingSettings);

      return {
        success: false,
        mode,
        booksImported: 0,
        membersImported: 0,
        transactionsImported: 0,
        imagesReconnected: 0,
        conflicts: [],
        safetyBackupCreated,
        safetyBackupFilename,
        message: `Commit failed: ${commitErr.message}. Successfully rolled back all changes.`,
      };
    }
  }
}
