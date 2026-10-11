// Dev-only Contrast Checker
// Scans rendered text, compares computed text color against composite background color,
// and logs any contrast issues below 4.5:1 (normal text) or 3:1 (large text) in the console.

function parseColor(colorStr: string): { r: number; g: number; b: number; a: number } | null {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit') return null;

  // comma-separated: rgba(r, g, b, a) or rgb(r, g, b)
  const commaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (commaMatch) {
    return {
      r: parseInt(commaMatch[1], 10),
      g: parseInt(commaMatch[2], 10),
      b: parseInt(commaMatch[3], 10),
      a: commaMatch[4] !== undefined ? parseFloat(commaMatch[4]) : 1,
    };
  }

  // space-separated (CSS Color Level 4): rgb(r g b) or rgb(r g b / a)
  const spaceMatch = colorStr.match(/rgba?\((\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+%?))?\)/);
  if (spaceMatch) {
    let alpha = 1;
    if (spaceMatch[4] !== undefined) {
      alpha = spaceMatch[4].endsWith('%') ? parseFloat(spaceMatch[4]) / 100 : parseFloat(spaceMatch[4]);
    }
    return {
      r: parseInt(spaceMatch[1], 10),
      g: parseInt(spaceMatch[2], 10),
      b: parseInt(spaceMatch[3], 10),
      a: alpha,
    };
  }

  // #hex
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 4) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: parseInt(hex.substring(6, 8), 16) / 255,
      };
    }
  }

  return null;
}

function compositeColors(
  fg: { r: number; g: number; b: number; a: number },
  bg: { r: number; g: number; b: number; a: number }
): { r: number; g: number; b: number; a: number } {
  const alpha = fg.a + bg.a * (1 - fg.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / alpha),
    g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / alpha),
    b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / alpha),
    a: alpha,
  };
}

function getEffectiveBackgroundColor(el: HTMLElement, defaultBg: { r: number; g: number; b: number; a: number }): { r: number; g: number; b: number; a: number } {
  let curr: HTMLElement | null = el;
  const layers: { r: number; g: number; b: number; a: number }[] = [];

  while (curr && curr !== document.documentElement) {
    const style = window.getComputedStyle(curr);
    const bgParsed = parseColor(style.backgroundColor);
    if (bgParsed && bgParsed.a > 0) {
      layers.unshift(bgParsed);
      if (bgParsed.a >= 0.99) break;
    }
    curr = curr.parentElement;
  }

  let finalBg = defaultBg;
  for (const layer of layers) {
    finalBg = compositeColors(layer, finalBg);
  }
  return finalBg;
}

function getLuminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return srgb[0] * 0.2126 + srgb[1] * 0.7152 + srgb[2] * 0.0722;
}

function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Plain serializable interface - NO DOM elements, NO React fibers, NO circular references
export interface ContrastViolation {
  tag: string;
  selector: string;
  text: string;
  fgColor: string;
  bgColor: string;
  ratio: number;
  requiredRatio: number;
  fontSize: string;
  fontWeight: string;
}

export function runContrastCheck(): ContrastViolation[] {
  if (typeof window === 'undefined') return [];

  const bodyBgParsed = parseColor(window.getComputedStyle(document.body).backgroundColor);
  const defaultBg = bodyBgParsed && bodyBgParsed.a >= 0.99 
    ? bodyBgParsed 
    : { r: 2, g: 6, b: 23, a: 1 }; // #020617 fixed dark canvas

  const violations: ContrastViolation[] = [];
  const elements = document.querySelectorAll<HTMLElement>('body *');

  elements.forEach((el) => {
    // Skip invisible, empty, or printable barcode labels
    if (!el.offsetParent && el.tagName !== 'BODY') return;
    if (el.closest('#printable-barcode-label') || el.closest('[data-barcode-container="true"]')) return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return;

    // Check direct text or placeholder
    let text = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        text += node.textContent.trim() + ' ';
      }
    }
    text = text.trim();

    // Check input placeholder
    const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    const hasPlaceholder = isInput && (el as HTMLInputElement).placeholder;

    if (!text && !hasPlaceholder) return;

    const fgColorParsed = parseColor(style.color);
    if (!fgColorParsed) return;

    const effectiveBg = getEffectiveBackgroundColor(el, defaultBg);
    const fgLum = getLuminance(fgColorParsed.r, fgColorParsed.g, fgColorParsed.b);
    const bgLum = getLuminance(effectiveBg.r, effectiveBg.g, effectiveBg.b);
    const ratio = getContrastRatio(fgLum, bgLum);

    const fontSizePx = parseFloat(style.fontSize) || 14;
    const fontWeightNum = parseInt(style.fontWeight, 10) || 400;
    const isLargeText = fontSizePx >= 18 || (fontSizePx >= 14 && fontWeightNum >= 700);
    const requiredRatio = isLargeText ? 3.0 : 4.5;

    const tag = el.tagName.toLowerCase();
    const idStr = el.id ? `#${el.id}` : '';
    const classStr = el.className && typeof el.className === 'string'
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    const selector = `${tag}${idStr}${classStr}`;

    if (ratio < requiredRatio) {
      violations.push({
        tag,
        selector,
        text: (text || (el as HTMLInputElement).placeholder || '').slice(0, 40),
        fgColor: `rgb(${fgColorParsed.r}, ${fgColorParsed.g}, ${fgColorParsed.b})`,
        bgColor: `rgb(${effectiveBg.r}, ${effectiveBg.g}, ${effectiveBg.b})`,
        ratio: Math.round(ratio * 100) / 100,
        requiredRatio,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      });
    }

    // Check disabled text opacity
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
      const op = parseFloat(style.opacity);
      if (op < 0.6) {
        violations.push({
          tag,
          selector,
          text: `[Disabled opacity < 0.6: ${op}] ${text}`,
          fgColor: style.color,
          bgColor: `rgb(${effectiveBg.r}, ${effectiveBg.g}, ${effectiveBg.b})`,
          ratio: op,
          requiredRatio: 0.6,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
        });
      }
    }
  });

  if (violations.length === 0) {
    console.log(
      '%c[Contrast Checker] PASS: All scanned text elements meet WCAG AAA/AA standards (Dark Theme).',
      'color: #10B981; font-weight: bold;'
    );
  } else {
    console.warn(
      `%c[Contrast Checker] Found ${violations.length} contrast warnings (Dark Theme):`,
      'color: #F59E0B; font-weight: bold;',
      JSON.parse(JSON.stringify(violations))
    );
  }

  return violations;
}

// Attach to window for dev inspection
if (typeof window !== 'undefined') {
  (window as unknown as { runContrastCheck: typeof runContrastCheck }).runContrastCheck = runContrastCheck;
}
