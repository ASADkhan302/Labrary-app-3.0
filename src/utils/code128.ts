/**
 * ISO/IEC 15417 Standard Code-128 Barcode Pattern Encoder
 * Provides 100% compliant Code 128B module widths for crisp vector rendering in PDF, SVG, and Canvas.
 */

// 107 Code-128 pattern definitions (indices 0 to 106)
export const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export interface Code128Module {
  isBar: boolean;
  widthModules: number;
}

export interface EncodedBarcode {
  text: string;
  totalModules: number;
  modules: Code128Module[];
  patternString: string;
}

/**
 * Encodes an alphanumeric string into Code-128B module sequences.
 */
export function encodeCode128B(rawText: string): EncodedBarcode {
  const text = (rawText || '').trim().replace(/[^\x20-\x7E]/g, '');
  const symbols: number[] = [104]; // Code 128B start symbol
  let checksum = 104;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      symbols.push(code);
      checksum += code * (i + 1);
    }
  }

  symbols.push(checksum % 103);
  symbols.push(106); // Stop symbol

  const patternChunks = symbols.map(s => CODE128_PATTERNS[s] || '211214');
  const patternString = patternChunks.join('');

  const modules: Code128Module[] = [];
  let isBar = true;
  let totalModules = 0;

  for (const digit of patternString) {
    const width = parseInt(digit, 10);
    modules.push({ isBar, widthModules: width });
    totalModules += width;
    isBar = !isBar;
  }

  return {
    text,
    totalModules,
    modules,
    patternString,
  };
}

/**
 * Checks scan safety: returns the physical module width in mm for a given available width.
 * Standard requirement: >= 0.17 mm for reliable optical scanning.
 */
export function evaluateScanSafety(totalModules: number, availableWidthMm: number): {
  moduleWidthMm: number;
  isSafe: boolean;
  warning?: string;
} {
  const quietZones = 20; // 10 modules on each side
  const moduleWidthMm = availableWidthMm / (totalModules + quietZones);
  const isSafe = moduleWidthMm >= 0.17;
  return {
    moduleWidthMm,
    isSafe,
    warning: !isSafe 
      ? `Barcode module width (${moduleWidthMm.toFixed(2)} mm) is below 0.17 mm optical threshold. May not scan reliably with budget handheld scanners.`
      : undefined,
  };
}
