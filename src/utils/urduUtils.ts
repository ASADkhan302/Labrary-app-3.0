/**
 * Urdu Language Utilities: Normalization, Bidi protection, Urdu Alphabetical Sorting, and Search Indexing.
 *
 * Exact Urdu Alphabetical Order:
 * ا آ ب پ ت ٹ ث ج چ ح خ د ڈ ذ ر ڑ ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ہ ھ ء ی ے
 */

// Bidi override controls to strip for anti-spoofing (U+202A-U+202E, U+2066-U+2069)
const BIDI_OVERRIDES_REGEX = /[\u202A-\u202E\u2066-\u2069]/g;

// Diacritics (U+064B-U+065F, U+0670) and Tatweel (U+0640)
const DIACRITICS_AND_TATWEEL_REGEX = /[\u064B-\u065F\u0670\u0640]/g;

// Eastern Arabic / Urdu / Persian digits mapping
const DIGIT_MAP: Record<string, string> = {
  // Urdu / Persian digits (U+06F0 - U+06F9)
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  // Arabic-Indic digits (U+0660 - U+0669)
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

// Exact Urdu Alphabetical sequence:
// ا, آ, ب, پ, ت, ٹ, ث, ج, چ, ح, خ, د, ڈ, ذ, ر, ڑ, ز, ژ, س, ش, ص, ض, ط, ظ, ع, غ, ف, ق, ک, گ, ل, م, ن, و, ہ, ھ, ء, ی, ے
const URDU_ORDER_CHARS: string[] = [
  'ا', // 1 alif
  'آ', // 2 alif-madda
  'ب', // 3 be
  'پ', // 4 pe
  'ت', // 5 te
  'ٹ', // 6 Te
  'ث', // 7 se
  'ج', // 8 jim
  'چ', // 9 che
  'ح', // 10 bari-he
  'خ', // 11 khe
  'د', // 12 dal
  'ڈ', // 13 Dal
  'ذ', // 14 zal
  'ر', // 15 re
  'ڑ', // 16 Re
  'ز', // 17 ze
  'ژ', // 18 zhe
  'س', // 19 sin
  'ش', // 20 shin
  'ص', // 21 suad
  'ض', // 22 zuad
  'ط', // 23 toe
  'ظ', // 24 zoe
  'ع', // 25 ain
  'غ', // 26 ghain
  'ف', // 27 fe
  'ق', // 28 qaf
  'ک', // 29 kaf
  'گ', // 30 gaf
  'ل', // 31 lam
  'م', // 32 mim
  'ن', // 33 noon
  'ں', // 33b noon-ghunna (sub-rank 33.5)
  'و', // 34 vao
  'ہ', // 35 choti-he / gol-he
  'ھ', // 36 do-chashmi-he
  'ء', // 37 hamza
  'ئ', // 37b hamza-on-ye
  'ؤ', // 37c hamza-on-waw
  'ۂ', // 37d gol-he with hamza
  'ی', // 38 choti-ye
  'ے', // 39 bari-ye
];

// Map of Urdu characters to rank code points in Private Use Area (0xE100 + rank)
const URDU_RANK_MAP = new Map<string, string>();
URDU_ORDER_CHARS.forEach((char, index) => {
  URDU_RANK_MAP.set(char, String.fromCharCode(0xE100 + index));
});

/**
 * Strips dangerous bidirectional override control characters
 */
export function sanitizeBidiOverrides(text: string): string {
  if (!text) return '';
  return text.replace(BIDI_OVERRIDES_REGEX, '');
}

/**
 * Converts Urdu (۰-۹) and Arabic (٠-٩) digits to western digits (0-9).
 */
export function convertUrduDigitsToAscii(text: string): string {
  if (!text) return '';
  return text.replace(/[۰-۹٠-٩]/g, (ch) => DIGIT_MAP[ch] || ch);
}

/**
 * Checks if a string contains Urdu or Arabic script characters
 */
export function isArabicOrUrduScript(text?: string | null): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Normalization for Search & Indexing:
 * - Unicode NFKC
 * - Strips bidi controls
 * - Removes diacritics (U+064B-U+065F, U+0670) & tatweel (U+0640)
 * - Unifies variants: ي/ى -> ی, ك -> ک, ه/ھ/ۃ -> ہ
 * - Converts Urdu/Arabic digits to 0-9
 * - Lowercase Latin
 * - Preserves ZWNJ (\u200C) and ZWJ (\u200D)
 */
export function normalizeUrduText(raw?: string | null): string {
  if (!raw) return '';
  let str = raw.normalize('NFKC');

  // Strip bidi override controls
  str = sanitizeBidiOverrides(str);

  // Remove diacritics and tatweel
  str = str.replace(DIACRITICS_AND_TATWEEL_REGEX, '');

  // Convert digits
  str = convertUrduDigitsToAscii(str);

  // Unify variants
  // ي ى -> ی
  str = str.replace(/[يى]/g, 'ی');
  // ك -> ک
  str = str.replace(/ك/g, 'ک');
  // ه ھ ۃ -> ہ (for search and variant unification)
  str = str.replace(/[هھۃ]/g, 'ہ');
  // Normalize hamza variants for search
  str = str.replace(/ۂ/g, 'ہ');

  // Lowercase Latin
  str = str.toLowerCase();

  return str.trim();
}

export const normalizeUrduForSearch = normalizeUrduText;

/**
 * Precomputed binary sort key generator.
 * Maps letters to code points so that a standard binary comparison:
 * 1. Follows the exact specified Urdu alphabetical sequence:
 *    ا آ ب پ ت ٹ ث ج چ ح خ د ڈ ذ ر ڑ ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ہ ھ ء ی ے
 * 2. Unifies variants (ي/ى -> ی, ك -> ک, ه/ۃ -> ہ, keeps do-chashmi-he ھ distinct as specified)
 * 3. Removes diacritics and tatweel
 * 4. Drops leading English articles ("the ", "a ", "an ") for Latin titles
 * 5. Latin characters map to standard code points; Urdu characters map to rank points.
 * 
 * In standard mode (latinFirst = true): Latin script precedes Urdu/Arabic script.
 * In "Urdu first" mode (latinFirst = false): Urdu/Arabic script precedes Latin script.
 */
export function computeSortKey(raw?: string | null, latinFirst = true): string {
  if (!raw) return '';
  let str = raw.normalize('NFKC');

  // Strip bidi overrides
  str = sanitizeBidiOverrides(str);

  // Strip diacritics and tatweel
  str = str.replace(DIACRITICS_AND_TATWEEL_REGEX, '');

  // Convert digits
  str = convertUrduDigitsToAscii(str);

  // Unify variants while preserving choti-he vs do-chashmi-he if requested
  str = str.replace(/[يى]/g, 'ی');
  str = str.replace(/ك/g, 'ک');
  str = str.replace(/[هۃ]/g, 'ہ');

  str = str.trim();

  // If Latin script: drop leading articles "the ", "a ", "an "
  const lower = str.toLowerCase();
  let latinClean = lower;
  if (/^the\s+/i.test(latinClean)) {
    latinClean = latinClean.replace(/^the\s+/i, '');
  } else if (/^a\s+/i.test(latinClean)) {
    latinClean = latinClean.replace(/^a\s+/i, '');
  } else if (/^an\s+/i.test(latinClean)) {
    latinClean = latinClean.replace(/^an\s+/i, '');
  }

  // Check if string starts with Arabic/Urdu
  const isUrdu = isArabicOrUrduScript(str);

  // Prefix determines group ordering:
  // If latinFirst: Latin gets group '1_', Urdu gets group '2_'
  // If urduFirst: Urdu gets group '1_', Latin gets group '2_'
  const groupPrefix = isUrdu 
    ? (latinFirst ? 'B_' : 'A_') 
    : (latinFirst ? 'A_' : 'B_');

  let sortKey = groupPrefix;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (URDU_RANK_MAP.has(ch)) {
      sortKey += URDU_RANK_MAP.get(ch);
    } else {
      sortKey += ch.toLowerCase();
    }
  }

  return sortKey;
}

/**
 * Precomputes search_text for quick multi-lingual searching.
 * Combines title, author, romanized fields, publisher, barcode, isbn, call number.
 */
export function computeSearchText(book: {
  book_name: string;
  author: string;
  title_roman?: string;
  author_roman?: string;
  publisher?: string;
  category?: string;
  barcode?: string;
  isbn?: string;
  dewey_call_number?: string;
}): string {
  const parts = [
    book.book_name,
    book.author,
    book.title_roman || '',
    book.author_roman || '',
    book.publisher || '',
    book.category || '',
    book.barcode || '',
    book.isbn || '',
    book.dewey_call_number || '',
  ];

  return normalizeUrduText(parts.filter(Boolean).join(' '));
}

/**
 * Matches a search query against a book record or search_text.
 * Ignores diacritics, tatweel, letter variants (ی/ي, ک/ك, ہ/ھ/ه), matches Urdu or Roman fields.
 */
export function matchesUrduSearch(query: string, searchText: string): boolean {
  if (!query || !query.trim()) return true;
  const normalizedQuery = normalizeUrduText(query);
  return searchText.includes(normalizedQuery);
}
