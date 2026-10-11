import { computeSortKey, normalizeUrduText, matchesUrduSearch, convertUrduDigitsToAscii } from '../src/utils/urduUtils';

console.log('--- Testing Urdu Sort Order ---');

// 1. Exact Urdu Alphabetical list from prompt:
// ا آ ب پ ت ٹ ث ج چ ح خ د ڈ ذ ر ڑ ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ہ ھ ء ی ے
const testUrduLetters = [
  'ا', 'آ', 'ب', 'پ', 'ت', 'ٹ', 'ث', 'ج', 'چ', 'ح', 'خ', 
  'د', 'ڈ', 'ذ', 'ر', 'ڑ', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض', 
  'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن', 
  'و', 'ہ', 'ھ', 'ء', 'ی', 'ے'
];

// Create titles starting with each letter
const testTitles = testUrduLetters.map((letter, i) => `${letter} کتاب نمبر ${i + 1}`);

// Shuffle
const shuffled = [...testTitles].sort(() => Math.random() - 0.5);

// Sort using computeSortKey
const sortedAsc = [...shuffled].sort((a, b) => {
  const keyA = computeSortKey(a, false);
  const keyB = computeSortKey(b, false);
  return keyA.localeCompare(keyB);
});

// Check if sortedAsc matches testTitles exactly
let orderMatches = true;
for (let i = 0; i < testTitles.length; i++) {
  if (sortedAsc[i] !== testTitles[i]) {
    console.error(`Mismatch at ${i}: expected "${testTitles[i]}", got "${sortedAsc[i]}"`);
    orderMatches = false;
  }
}

if (orderMatches) {
  console.log('✅ PASS: All 39 Urdu letters sort in exact canonical sequence!');
} else {
  console.error('❌ FAIL: Urdu alphabetical order mismatch');
  process.exit(1);
}

// 2. Reverse sort (Z-A)
const sortedDesc = [...shuffled].sort((a, b) => {
  const keyA = computeSortKey(a, false);
  const keyB = computeSortKey(b, false);
  return keyB.localeCompare(keyA);
});

let reverseMatches = true;
const reversedOriginal = [...testTitles].reverse();
for (let i = 0; i < reversedOriginal.length; i++) {
  if (sortedDesc[i] !== reversedOriginal[i]) {
    console.error(`Reverse mismatch at ${i}: expected "${reversedOriginal[i]}", got "${sortedDesc[i]}"`);
    reverseMatches = false;
  }
}

if (reverseMatches) {
  console.log('✅ PASS: Urdu Z-A is the exact reverse of A-Z!');
} else {
  console.error('❌ FAIL: Reverse Urdu sorting failed');
  process.exit(1);
}

// 3. Variant check: ي/ی, ك/ک, ه/ہ, and diacritics
console.log('--- Testing Variant Unification & Diacritics ---');

const variantTitle1 = 'كتابِ تاريخ'; // with Arabic kaf, yeh with dots, kasra diacritic
const variantTitle2 = 'کتاب تاریخ';   // with Urdu kaf, choti-ye, no diacritic

const norm1 = normalizeUrduText(variantTitle1);
const norm2 = normalizeUrduText(variantTitle2);

if (norm1 === norm2) {
  console.log(`✅ PASS: Variants match after normalization! ("${norm1}" === "${norm2}")`);
} else {
  console.error(`❌ FAIL: Normalization mismatch: "${norm1}" !== "${norm2}"`);
  process.exit(1);
}

// Search test with variants
const query = 'کتاب';
if (matchesUrduSearch(query, norm1) && matchesUrduSearch(query, norm2)) {
  console.log('✅ PASS: Search query "کتاب" matches both variant titles!');
} else {
  console.error('❌ FAIL: Search with variants failed');
  process.exit(1);
}

// 4. Digits conversion test
const urduNum = '۵۸۰';
const converted = convertUrduDigitsToAscii(urduNum);
if (converted === '580') {
  console.log(`✅ PASS: Urdu digits ${urduNum} converted to ${converted}`);
} else {
  console.error(`❌ FAIL: Digits conversion failed: ${converted}`);
  process.exit(1);
}

console.log('ALL URDU UNIT TESTS PASSED SUCCESSFULLY! 🎉');
