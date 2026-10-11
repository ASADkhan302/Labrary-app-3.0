/**
 * Date Utility for University of Lakki Marwat Library Management System
 * Handles date_added normalization, formatting, and validation.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats YYYY-MM-DD to DD-MMM-YYYY (e.g. 2026-10-02 -> 02-Oct-2026)
 */
export function formatDisplayDate(ymd?: string | null): string {
  if (!ymd) return '';
  const clean = ymd.trim().split(' ')[0].split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-');
    const mIdx = parseInt(m, 10) - 1;
    const monthStr = MONTH_NAMES[mIdx] || m;
    return `${d.padStart(2, '0')}-${monthStr}-${y}`;
  }
  return ymd;
}

export interface DateValidationResult {
  valid: boolean;
  date?: string; // YYYY-MM-DD
  error?: string;
}

/**
 * Normalizes input date into YYYY-MM-DD format.
 * Accepts:
 * - Blank / empty -> defaults to today
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - DD-MMM-YYYY (e.g. 02-Oct-2026)
 * Validates:
 * - Real calendar date
 * - Not before 1900
 * - Not in the future
 */
export function normalizeDateAdded(raw?: string | null): DateValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: true, date: getTodayIso() };
  }

  const clean = raw.trim();
  const today = getTodayIso();

  let y = 0, m = 0, d = 0;

  // 1. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const parts = clean.split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    d = parseInt(parts[2], 10);
  }
  // 2. DD/MM/YYYY
  else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const parts = clean.split('/');
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    y = parseInt(parts[2], 10);
  }
  // 3. DD-MM-YYYY
  else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(clean)) {
    const parts = clean.split('-');
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    y = parseInt(parts[2], 10);
  }
  // 4. DD-MMM-YYYY (e.g. 02-Oct-2026, 2-oct-2026)
  else if (/^\d{1,2}-[a-zA-Z]{3}-\d{4}$/.test(clean)) {
    const parts = clean.split('-');
    d = parseInt(parts[0], 10);
    const mStr = parts[1].toLowerCase();
    y = parseInt(parts[2], 10);
    m = MONTH_MAP[mStr] || 0;
    if (m === 0) {
      return { valid: false, error: `Invalid month name in "${clean}". Use Jan, Feb, Mar, etc.` };
    }
  } else {
    return {
      valid: false,
      error: `Invalid date format: "${clean}". Expected YYYY-MM-DD, DD/MM/YYYY, or DD-MMM-YYYY.`,
    };
  }

  // Check Year bounds
  if (y < 1900) {
    return { valid: false, error: `Date Added cannot be before the year 1900: "${clean}".` };
  }

  // Check Month bounds
  if (m < 1 || m > 12) {
    return { valid: false, error: `Invalid calendar month (${m}) in "${clean}".` };
  }

  // Check Day bounds for specific month & leap year
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d < 1 || d > daysInMonth) {
    return { valid: false, error: `Invalid day (${d}) for month (${m}) in "${clean}".` };
  }

  const normalized = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // Check future date
  if (normalized > today) {
    return {
      valid: false,
      error: `Date Added cannot be in the future (${formatDisplayDate(normalized)}). Please choose today or an earlier date.`,
    };
  }

  return { valid: true, date: normalized };
}
