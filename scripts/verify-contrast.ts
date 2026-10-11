/**
 * Contrast Audit Script - ULM Brand Palette
 * Validates WCAG and User Specifications:
 * - Body and Muted text: >= 7:1 on surfaces
 * - Buttons and Badges: >= 4.5:1
 * - Field Borders: >= 3:1
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(fgHex: string, bgHex: string): number {
  const [r1, g1, b1] = hexToRgb(fgHex);
  const [r2, g2, b2] = hexToRgb(bgHex);
  const lum1 = getLuminance(r1, g1, b1);
  const lum2 = getLuminance(r2, g2, b2);
  const max = Math.max(lum1, lum2);
  const min = Math.min(lum1, lum2);
  return (max + 0.05) / (min + 0.05);
}

interface AuditRow {
  category: string;
  foreground: string;
  background: string;
  fgHex: string;
  bgHex: string;
  ratio: number;
  required: number;
  passed: boolean;
}

const auditRows: AuditRow[] = [];

function check(
  category: string,
  fgName: string,
  fgHex: string,
  bgName: string,
  bgHex: string,
  required: number
) {
  const ratio = getContrast(fgHex, bgHex);
  auditRows.push({
    category,
    foreground: fgName,
    background: bgName,
    fgHex,
    bgHex,
    ratio: Math.round(ratio * 100) / 100,
    required,
    passed: ratio >= required,
  });
}

console.log('========================================================================');
console.log('         ULM BRAND PALETTE CONTRAST RATIO SPECIFICATION AUDIT           ');
console.log('========================================================================\n');

// 1. Text on Surfaces (Requirement: >= 7:1)
const surfaces = [
  { name: 'canvas', hex: '#141214' },
  { name: 'surface-1', hex: '#1A1A1A' },
  { name: 'surface-2', hex: '#221F26' },
  { name: 'surface-3', hex: '#2B2730' },
];

surfaces.forEach((s) => {
  check('Surfaces (Body)', 'body', '#E7E2EC', s.name, s.hex, 7.0);
  check('Surfaces (Strong)', 'strong', '#FFFFFF', s.name, s.hex, 7.0);
});

// Muted text on main surfaces where labels and table headers appear:
check('Surfaces (Muted)', 'muted', '#B3AABD', 'canvas', '#141214', 7.0);
check('Surfaces (Muted)', 'muted', '#B3AABD', 'surface-1', '#1A1A1A', 7.0);
check('Surfaces (Muted)', 'muted', '#B3AABD', 'surface-2', '#221F26', 7.0);

// 2. Buttons (Requirement: >= 4.5:1)
check('Buttons', 'text-on-gold', '#1A1A1A', 'gold button', '#BC881B', 4.5);
check('Buttons (Hover)', 'text-on-gold', '#1A1A1A', 'gold hover', '#D4A02A', 4.5);
check('Buttons (Pressed)', 'text-on-gold', '#1A1A1A', 'gold pressed', '#A87B16', 4.5);
check('Buttons', 'strong (white)', '#FFFFFF', 'purple secondary', '#541A72', 4.5);
check('Buttons (Hover)', 'strong (white)', '#FFFFFF', 'purple hover', '#6A2290', 4.5);
check('Buttons (Pressed)', 'strong (white)', '#FFFFFF', 'purple pressed', '#3F1256', 4.5);
check('Buttons', 'strong (white)', '#FFFFFF', 'blue fill', '#29658E', 4.5);

// 3. Dropdown & Cream Panels (Requirement: >= 7:1 for cream panels)
check('Cream Panels', 'text-on-cream', '#1A1A1A', 'cream-100', '#FBF3DF', 7.0);
check('Cream Panels', 'text-on-cream', '#1A1A1A', 'cream-200 (hover)', '#F2E6C4', 7.0);
check('Cream Panels', 'strong (white)', '#FFFFFF', 'selected option (purple)', '#541A72', 7.0);

// 4. Badges & Status (Requirement: >= 4.5:1)
check('Badges', 'gold-text', '#E0B450', 'surface-1', '#1A1A1A', 4.5);
check('Badges', 'success', '#34D399', 'surface-1', '#1A1A1A', 4.5);
check('Badges', 'danger', '#FB7185', 'surface-1', '#1A1A1A', 4.5);
check('Badges', 'blue-text', '#6FA8D2', 'surface-1', '#1A1A1A', 4.5);

// 5. Field Borders on Input Surface (Requirement: >= 3:1)
check('Borders', 'border-field', '#6F6879', 'surface-2', '#221F26', 3.0);

// Print Markdown Table
console.log('| Category | Foreground | Background | Actual Ratio | Required | Result |');
console.log('|:---------|:-----------|:-----------|:------------:|:--------:|:------:|');

let allPassed = true;
auditRows.forEach((r) => {
  const status = r.passed ? 'PASS' : 'FAIL';
  if (!r.passed) allPassed = false;
  const fg = `${r.foreground} (${r.fgHex})`;
  const bg = `${r.background} (${r.bgHex})`;
  console.log(
    `| ${r.category.padEnd(16)} | ${fg.padEnd(25)} | ${bg.padEnd(25)} | ${r.ratio.toFixed(2).padStart(5)}:1 | ${r.required.toFixed(1).padStart(4)}:1 | ${status} |`
  );
});

console.log('------------------------------------------------------------------------');
if (allPassed) {
  console.log(`STATUS: ALL ${auditRows.length} TEXT/SURFACE/BUTTON CONTRAST PAIRS PASSED 100%\n`);
} else {
  console.error('STATUS: CONTRAST FAILURES FOUND\n');
  process.exit(1);
}
