import { Book } from '../types/library';
import { LibraryStorage } from './storage';
import { UsbBackupService } from './usbBackupService';

/**
 * Universal Automatic Barcode Engine for ULM LMS
 * Standard format: PREFIX-ACCESSION (e.g. ULM-00123)
 * Code-128 safe characters only (A-Z, 0-9, '-')
 * Never reused, never mutated once created.
 */
export class BarcodeService {
  /**
   * Retrieves sanitized barcode prefix from Settings (default 'ULM', max 6 alphanumeric uppercase chars)
   */
  static getPrefix(): string {
    try {
      const settings = LibraryStorage.getSettings();
      const raw = settings.barcode_prefix || 'ULM';
      const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      return clean || 'ULM';
    } catch {
      return 'ULM';
    }
  }

  /**
   * Formats an accession number into the institutional barcode standard:
   * - Numeric accession numbers padded to at least 5 digits (e.g. 123 -> "00123" -> "ULM-00123")
   * - Non-numeric accession numbers retain only [A-Z0-9]
   * - Uniqueness: if candidate collides with existing barcodes, appends -2, -3, etc.
   */
  static generateBarcode(
    accessionInput: string | number,
    existingBarcodesSet?: Set<string>
  ): { barcode: string; isCollision: boolean; collisionSuffix?: string; cleanAccession: string } {
    const prefix = this.getPrefix();
    const rawStr = String(accessionInput ?? '').trim();

    // Check if numeric
    const isPureDigits = /^\d+$/.test(rawStr);
    let cleanAccession: string;

    if (isPureDigits) {
      // Numeric accession: pad to at least 5 digits
      cleanAccession = rawStr.padStart(5, '0');
    } else {
      // Non-numeric accession: keep only Code-128 safe alphanumeric
      const sanitized = rawStr.toUpperCase().replace(/[^A-Z0-9]/g, '');
      cleanAccession = sanitized || '00001';
    }

    const baseBarcode = `${prefix}-${cleanAccession}`;

    const registered = existingBarcodesSet;
    let candidate = baseBarcode;
    let isCollision = false;
    let collisionSuffix: string | undefined;

    const hasBarcode = (bc: string): boolean => {
      if (registered) return registered.has(bc.toUpperCase());
      const books = LibraryStorage.getBooks();
      const target = bc.trim().toUpperCase();
      for (let i = 0; i < books.length; i++) {
        const b = books[i];
        if (b.is_active && b.barcode && b.barcode.trim().toUpperCase() === target) {
          return true;
        }
      }
      return false;
    };

    if (hasBarcode(candidate)) {
      isCollision = true;
      let counter = 2;
      while (hasBarcode(`${baseBarcode}-${counter}`)) {
        counter++;
      }
      collisionSuffix = `-${counter}`;
      candidate = `${baseBarcode}-${counter}`;
    }

    if (registered) {
      registered.add(candidate.toUpperCase());
    }

    return {
      barcode: candidate,
      isCollision,
      collisionSuffix,
      cleanAccession,
    };
  }

  /**
   * One-time automatic backfill for any books currently lacking a barcode
   * Creates a safety backup first, runs in batches, and guarantees idempotency.
   */
  static async backfillMissingBarcodes(
    onProgress?: (pct: number, stage: string) => void
  ): Promise<{ success: boolean; backfilledCount: number; collisions: string[]; message: string }> {
    onProgress?.(5, 'Creating safety snapshot before barcode backfill...');
    await UsbBackupService.createPreRestoreSafetyBackup();

    const books = LibraryStorage.getBooks();
    const existingSet = new Set(
      books
        .filter(b => b.is_active && b.barcode && b.barcode.trim())
        .map(b => b.barcode.trim().toUpperCase())
    );

    const collisions: string[] = [];
    let backfilledCount = 0;

    onProgress?.(30, 'Scanning catalog for missing volume barcodes...');

    const updated = books.map((book, idx) => {
      if (!book.is_active) return book;

      const hasBarcode = book.barcode && book.barcode.trim().length > 0;
      if (hasBarcode) {
        return book;
      }

      // Generate accession candidate from existing fields or index
      const numMatch = book.dewey_call_number?.match(/\d+/) || [String(10001 + idx)];
      const accessionCandidate = book.accession_no || numMatch[0];

      const gen = this.generateBarcode(accessionCandidate, existingSet);
      if (gen.isCollision) {
        collisions.push(`${gen.barcode} (Collision from accession #${accessionCandidate})`);
      }

      backfilledCount++;
      return {
        ...book,
        barcode: gen.barcode,
        accession_no: book.accession_no || gen.cleanAccession,
      };
    });

    onProgress?.(80, 'Committing updated barcodes to SQLite database...');

    if (backfilledCount > 0) {
      LibraryStorage.saveBooks(updated);
      LibraryStorage.logHistory({
        action: 'BARCODE_BACKFILL',
        description: `Executed automatic barcode backfill: generated ${backfilledCount} unique barcodes (${collisions.length} collisions handled).`,
        barcode: 'BARCODE-ENGINE',
        user: 'Automated-System',
      });
    }

    onProgress?.(100, 'Barcode backfill complete.');

    return {
      success: true,
      backfilledCount,
      collisions,
      message: backfilledCount > 0
        ? `Successfully generated ${backfilledCount} barcodes (${collisions.length} collisions resolved with suffix).`
        : 'All catalog volumes already have valid barcodes. Zero modifications needed.',
    };
  }
}
