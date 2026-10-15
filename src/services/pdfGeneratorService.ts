import { jsPDF } from 'jspdf';
import { Book, Borrower } from '../types/library';
import { encodeCode128B, evaluateScanSafety } from '../utils/code128';
import { ULM_CREST_SRC, ULM_CREST_WATERMARK_SRC } from '../assets/ulmCrest';

export type LabelSizePreset = 'standard' | 'medium' | 'small' | 'thin' | 'custom';
export type LabelSheetLayout = 'avery_l7160' | 'avery_l7651' | 'plain_a4_grid' | 'thermal_roll';

export interface LabelSizeConfig {
  id: LabelSizePreset;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

export const LABEL_SIZES: Record<LabelSizePreset, LabelSizeConfig> = {
  standard: {
    id: 'standard',
    name: 'Standard (63.5 × 38.1 mm)',
    widthMm: 63.5,
    heightMm: 38.1,
    description: 'Full details: University, library, title, author, call no, barcode, ACC & ULM ID',
  },
  medium: {
    id: 'medium',
    name: 'Medium (50.0 × 25.0 mm)',
    widthMm: 50.0,
    heightMm: 25.0,
    description: 'Compact: Short title, call number, barcode & ULM ID',
  },
  small: {
    id: 'small',
    name: 'Small (38.1 × 21.2 mm)',
    widthMm: 38.1,
    heightMm: 21.2,
    description: 'Miniature: Barcode, ULM number & call number (Avery L7651 size)',
  },
  thin: {
    id: 'thin',
    name: 'Thin Spine (15.0 × 38.0 mm)',
    widthMm: 15.0,
    heightMm: 38.0,
    description: 'Rotated: Barcode runs 90° along narrow spine with ULM ID & call no',
  },
  custom: {
    id: 'custom',
    name: 'Custom Size',
    widthMm: 60.0,
    heightMm: 35.0,
    description: 'Custom millimetre width and height specification',
  },
};

export interface SheetTemplateConfig {
  id: LabelSheetLayout;
  name: string;
  labelsPerPage: number;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  topMarginMm: number;
  leftMarginMm: number;
  colGapMm: number;
  rowGapMm: number;
  description: string;
}

export const SHEET_TEMPLATES: Record<LabelSheetLayout, SheetTemplateConfig> = {
  avery_l7160: {
    id: 'avery_l7160',
    name: 'Avery L7160 / J8160 (21 per sheet)',
    labelsPerPage: 21,
    columns: 3,
    rows: 7,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    topMarginMm: 15.1,
    leftMarginMm: 7.2,
    colGapMm: 2.5,
    rowGapMm: 0,
    description: 'Official A4 3×7 die-cut label sheet. Standard European/Asian library format.',
  },
  avery_l7651: {
    id: 'avery_l7651',
    name: 'Avery L7651 (65 per sheet)',
    labelsPerPage: 65,
    columns: 5,
    rows: 13,
    labelWidthMm: 38.1,
    labelHeightMm: 21.2,
    topMarginMm: 10.7,
    leftMarginMm: 4.7,
    colGapMm: 2.5,
    rowGapMm: 0,
    description: 'High-density A4 5×13 die-cut label sheet for compact spine labels.',
  },
  plain_a4_grid: {
    id: 'plain_a4_grid',
    name: 'Plain A4 Paper Grid (Auto layout)',
    labelsPerPage: 24,
    columns: 3,
    rows: 7,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    topMarginMm: 8.0,
    leftMarginMm: 8.0,
    colGapMm: 2.0,
    rowGapMm: 2.0,
    description: 'Standard copier paper with auto-calculated rows, columns, and cutting lines.',
  },
  thermal_roll: {
    id: 'thermal_roll',
    name: 'Continuous Thermal Roll (1 label / page)',
    labelsPerPage: 1,
    columns: 1,
    rows: 1,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    topMarginMm: 0,
    leftMarginMm: 0,
    colGapMm: 0,
    rowGapMm: 0,
    description: 'Direct thermal roll printer (Zebra, TSC, Brother, Xprinter). Continuous feed.',
  },
};

export interface LabelJobOptions {
  sizePreset: LabelSizePreset;
  customWidthMm?: number;
  customHeightMm?: number;
  sheetLayout: LabelSheetLayout;
  startPosition?: number; // 1-based index on first sheet (1 to labelsPerPage)
  showCutLines?: boolean;
  autoThinSpineThreshold?: number; // Auto switch to thin spine if pages < threshold (e.g. 80)
  onProgress?: (current: number, total: number, page: number) => void;
  shouldCancel?: () => boolean;
}

export type CardPdfLayout = 'cr80_single' | 'a4_sheet_10' | 'a4_duplex';

export interface CardPdfOptions {
  layout: CardPdfLayout;
  onProgress?: (current: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export class PdfGeneratorService {
  /**
   * Generates a high-precision Code-128 barcode directly using vector rectangles in jsPDF.
   */
  static drawVectorCode128(
    doc: jsPDF,
    barcodeText: string,
    xMm: number,
    yMm: number,
    availableWidthMm: number,
    heightMm: number,
    options: {
      showText?: boolean;
      fontSizePt?: number;
      textColor?: [number, number, number];
      rotate90?: boolean;
    } = {}
  ): { moduleWidthMm: number; isSafe: boolean; warning?: string } {
    const encoded = encodeCode128B(barcodeText);
    const quietZoneModules = 20; // 10 modules on each side
    const totalModulesWithQuiet = encoded.totalModules + quietZoneModules;

    const moduleWidthMm = availableWidthMm / totalModulesWithQuiet;
    const safety = evaluateScanSafety(encoded.totalModules, availableWidthMm);

    doc.saveGraphicsState();

    if (options.rotate90) {
      // Rotate 90 degrees around (xMm, yMm)
      doc.setCurrentTransformationMatrix(doc.Matrix(0, 1, -1, 0, xMm, yMm));
      xMm = 0;
      yMm = 0;
    }

    // Draw background quiet zone box (white)
    doc.setFillColor(255, 255, 255);
    doc.rect(xMm, yMm, availableWidthMm, heightMm, 'F');

    // Draw bars
    let currentX = xMm + (10 * moduleWidthMm); // 10 modules left quiet zone
    doc.setFillColor(0, 0, 0);

    for (const mod of encoded.modules) {
      const barWidth = mod.widthModules * moduleWidthMm;
      if (mod.isBar) {
        doc.rect(currentX, yMm, barWidth, heightMm, 'F');
      }
      currentX += barWidth;
    }

    // Human readable text underneath barcode
    if (options.showText) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(options.fontSizePt || 7);
      if (options.textColor) {
        doc.setTextColor(options.textColor[0], options.textColor[1], options.textColor[2]);
      } else {
        doc.setTextColor(20, 20, 20);
      }
      const textX = xMm + (availableWidthMm / 2);
      const textY = yMm + heightMm + 2.5;
      doc.text(encoded.text, textX, textY, { align: 'center' });
    }

    doc.restoreGraphicsState();
    return safety;
  }

  /**
   * Generates a batch barcode labels PDF document.
   */
  static async generateLabelsPdf(
    books: Book[],
    options: LabelJobOptions
  ): Promise<{ doc: jsPDF; filename: string; pageCount: number; labelCount: number }> {
    const sizeConfig = LABEL_SIZES[options.sizePreset];
    const targetWidth = options.sizePreset === 'custom' && options.customWidthMm ? options.customWidthMm : sizeConfig.widthMm;
    const targetHeight = options.sizePreset === 'custom' && options.customHeightMm ? options.customHeightMm : sizeConfig.heightMm;

    let template = { ...SHEET_TEMPLATES[options.sheetLayout] };

    // If Plain A4 Grid, calculate dynamic columns and rows for the specified label size
    if (options.sheetLayout === 'plain_a4_grid') {
      const pageW = 210;
      const pageH = 297;
      const margin = 8;
      const gap = 2;
      const availW = pageW - (margin * 2);
      const availH = pageH - (margin * 2);
      const cols = Math.max(1, Math.floor((availW + gap) / (targetWidth + gap)));
      const rows = Math.max(1, Math.floor((availH + gap) / (targetHeight + gap)));
      template = {
        ...template,
        columns: cols,
        rows: rows,
        labelsPerPage: cols * rows,
        labelWidthMm: targetWidth,
        labelHeightMm: targetHeight,
        leftMarginMm: margin,
        topMarginMm: margin,
        colGapMm: gap,
        rowGapMm: gap,
      };
    } else if (options.sheetLayout === 'thermal_roll') {
      template = {
        ...template,
        labelWidthMm: targetWidth,
        labelHeightMm: targetHeight,
      };
    }

    // Initialize jsPDF
    const isThermal = options.sheetLayout === 'thermal_roll';
    const doc = new jsPDF({
      orientation: isThermal ? (targetWidth > targetHeight ? 'landscape' : 'portrait') : 'portrait',
      unit: 'mm',
      format: isThermal ? [targetWidth, targetHeight] : 'a4',
      compress: true,
    });

    const startPos = Math.max(1, Math.min(template.labelsPerPage, options.startPosition || 1)) - 1;
    let currentSheetSlot = startPos;
    let pageCount = 1;
    let labelIndex = 0;

    const totalLabels = books.length;
    const chunkSize = 25; // Process in chunks to prevent UI freezes

    for (let i = 0; i < totalLabels; i++) {
      if (options.shouldCancel && options.shouldCancel()) {
        break;
      }

      const book = books[i];
      const isThinBook = options.autoThinSpineThreshold && book.pages && book.pages < options.autoThinSpineThreshold;
      const isThin = isThinBook || options.sizePreset === 'thin';

      // Check if we need a new page
      if (isThermal) {
        if (i > 0) {
          doc.addPage([targetWidth, targetHeight], targetWidth > targetHeight ? 'landscape' : 'portrait');
          pageCount++;
        }
      } else {
        if (currentSheetSlot >= template.labelsPerPage) {
          doc.addPage('a4', 'portrait');
          pageCount++;
          currentSheetSlot = 0;
        }
      }

      // Compute slot coordinates
      let xMm = 0;
      let yMm = 0;

      if (isThermal) {
        xMm = 0;
        yMm = 0;
      } else {
        const colIdx = currentSheetSlot % template.columns;
        const rowIdx = Math.floor(currentSheetSlot / template.columns);
        xMm = template.leftMarginMm + (colIdx * (template.labelWidthMm + template.colGapMm));
        yMm = template.topMarginMm + (rowIdx * (template.labelHeightMm + template.rowGapMm));
      }

      // Draw cut lines if requested on plain paper
      if (options.showCutLines && !isThermal) {
        doc.setDrawColor(210, 210, 215);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.rect(xMm, yMm, template.labelWidthMm, template.labelHeightMm, 'S');
        doc.setLineDashPattern([], 0);
      }

      // Render Label Content
      this.renderSingleLabelContent(doc, book, xMm, yMm, template.labelWidthMm, template.labelHeightMm, isThin);

      currentSheetSlot++;
      labelIndex++;

      // Yield event loop every chunk
      if (i % chunkSize === 0) {
        if (options.onProgress) {
          options.onProgress(i + 1, totalLabels, pageCount);
        }
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (options.onProgress) {
      options.onProgress(totalLabels, totalLabels, pageCount);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `ULM_Barcode_Labels_${options.sizePreset}_${options.sheetLayout}_${dateStr}.pdf`;

    return {
      doc,
      filename,
      pageCount,
      labelCount: labelIndex,
    };
  }

  /**
   * Draws a single label with scaled typography and vector barcode.
   */
  private static renderSingleLabelContent(
    doc: jsPDF,
    book: Book,
    x: number,
    y: number,
    w: number,
    h: number,
    isThin: boolean
  ) {
    const pad = 1.8;
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = w - (pad * 2);
    const innerH = h - (pad * 2);

    const barcode = book.barcode || 'ULM-00001';
    const accNo = book.accession_no || barcode.replace(/^[A-Z]+-/, '');
    const callNo = book.dewey_call_number || '000 ULM';

    if (isThin) {
      // ================= THIN SPINE (15 × 38 mm rotated) =================
      // Border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(innerX, innerY, innerW, innerH, 'S');

      // Top: ULM Call Number
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(20, 20, 20);
      doc.text(callNo.slice(0, 14), innerX + (innerW / 2), innerY + 3.2, { align: 'center' });

      // Middle: Rotated Barcode along the spine (vertical)
      const barcodeH = 7.5;
      const barcodeW = innerH - 12; // length along spine
      const bcX = innerX + 3.2;
      const bcY = innerY + 5.5;

      this.drawVectorCode128(doc, barcode, bcX, bcY, barcodeW, barcodeH, {
        showText: false,
        rotate90: true,
      });

      // Bottom: Barcode digits
      doc.setFont('courier', 'bold');
      doc.setFontSize(5);
      doc.text(barcode, innerX + (innerW / 2), innerY + innerH - 1.2, { align: 'center' });
      return;
    }

    // Border
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.15);
    doc.rect(innerX, innerY, innerW, innerH, 'S');

    if (h < 26) {
      // ================= SMALL / MEDIUM COMPACT (e.g. Avery L7651: 38.1 × 21.2) =================
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(40, 40, 40);
      doc.text(callNo, innerX + 1, innerY + 2.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`ACC: ${accNo}`, innerX + innerW - 1, innerY + 2.5, { align: 'right' });

      // Barcode
      const bcH = Math.max(6, innerH - 8);
      const bcW = innerW - 2;
      this.drawVectorCode128(doc, barcode, innerX + 1, innerY + 4, bcW, bcH, {
        showText: true,
        fontSizePt: 5.5,
      });
      return;
    }

    // ================= STANDARD FULL (e.g. Avery L7160: 63.5 × 38.1 mm) =================
    // Header Row: Institutional Branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(40, 20, 60);
    doc.text('UNIVERSITY OF LAKKI MARWAT', innerX + (innerW / 2), innerY + 3.0, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(100, 100, 100);
    doc.text('CENTRAL CAMPUS LIBRARY', innerX + (innerW / 2), innerY + 5.5, { align: 'center' });

    // Hairline divider
    doc.setDrawColor(200, 200, 205);
    doc.line(innerX + 1, innerY + 6.8, innerX + innerW - 1, innerY + 6.8);

    // Book Title (max 2 lines)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 15, 15);
    const titleLines = doc.splitTextToSize(book.book_name || 'Untitled Book', innerW - 2);
    doc.text(titleLines.slice(0, 2), innerX + 1, innerY + 9.5);

    // Author
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(70, 70, 70);
    const authorStr = (book.author || 'Author Unknown').slice(0, 36);
    doc.text(authorStr, innerX + 1, innerY + 16.5);

    // Call number
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 70, 120);
    doc.text(`Call: ${callNo}`, innerX + 1, innerY + 20.2);

    // Barcode Vector (exact module widths)
    const bcHeight = 8.5;
    const bcWidth = innerW - 2;
    this.drawVectorCode128(doc, barcode, innerX + 1, innerY + 21.8, bcWidth, bcHeight, {
      showText: false,
    });

    // Footer: ACC and Barcode
    doc.setFont('courier', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(30, 30, 30);
    doc.text(`ACC: ${accNo}`, innerX + 1, innerY + innerH - 0.8);
    doc.text(barcode, innerX + innerW - 1, innerY + innerH - 0.8, { align: 'right' });
  }

  /**
   * Generates Member Cards PDF.
   * Options:
   * (a) exact CR80 pages (85.6 × 54.0 mm)
   * (b) A4 sheet with 10 cards (2 × 5) and crop marks
   * (c) Double-sided A4 mirrored for long-edge flipping
   */
  static async generateMemberCardsPdf(
    members: Borrower[],
    options: CardPdfOptions
  ): Promise<{ doc: jsPDF; filename: string; pageCount: number; cardCount: number }> {
    const cardW = 85.6;
    const cardH = 54.0;
    const totalMembers = members.length;

    let doc: jsPDF;
    let pageCount = 1;

    if (options.layout === 'cr80_single') {
      // Single CR80 pages: Page 1 Front, Page 2 Back, Page 3 Front...
      doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [cardW, cardH],
        compress: true,
      });

      for (let i = 0; i < totalMembers; i++) {
        if (options.shouldCancel && options.shouldCancel()) break;
        const m = members[i];

        if (i > 0) {
          doc.addPage([cardW, cardH], 'landscape');
          pageCount++;
        }
        this.renderSingleCardPdf(doc, m, 0, 0, cardW, cardH, 'front');

        // Back page
        doc.addPage([cardW, cardH], 'landscape');
        pageCount++;
        this.renderSingleCardPdf(doc, m, 0, 0, cardW, cardH, 'back');

        if (options.onProgress) {
          options.onProgress(i + 1, totalMembers);
        }
        await new Promise(r => setTimeout(r, 0));
      }
    } else {
      // A4 Layout (10 cards: 2 columns × 5 rows)
      doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const a4W = 210;
      const a4H = 297;
      const cols = 2;
      const rows = 5;
      const cardsPerPage = cols * rows;

      // Margins to center 2×5 cards (total width: 2*85.6 = 171.2mm, total height: 5*54 = 270mm)
      const leftMargin = (a4W - (cols * cardW)) / 2; // ~19.4 mm
      const topMargin = (a4H - (rows * cardH)) / 2; // ~13.5 mm

      const totalPages = Math.ceil(totalMembers / cardsPerPage);

      for (let p = 0; p < totalPages; p++) {
        if (options.shouldCancel && options.shouldCancel()) break;

        const pageMembers = members.slice(p * cardsPerPage, (p + 1) * cardsPerPage);

        if (p > 0) {
          doc.addPage('a4', 'portrait');
          pageCount++;
        }

        // Draw Fronts on this page
        for (let idx = 0; idx < pageMembers.length; idx++) {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const x = leftMargin + (col * cardW);
          const y = topMargin + (row * cardH);

          this.renderSingleCardPdf(doc, pageMembers[idx], x, y, cardW, cardH, 'front');
          this.drawCardCropMarks(doc, x, y, cardW, cardH);
        }

        // If duplex, add mirrored Backs on next page
        if (options.layout === 'a4_duplex') {
          doc.addPage('a4', 'portrait');
          pageCount++;

          for (let idx = 0; idx < pageMembers.length; idx++) {
            const col = idx % cols;
            // Mirrored column for flip-on-long-edge: col 0 becomes col 1, col 1 becomes col 0!
            const mirroredCol = (cols - 1) - col;
            const row = Math.floor(idx / cols);
            const x = leftMargin + (mirroredCol * cardW);
            const y = topMargin + (row * cardH);

            this.renderSingleCardPdf(doc, pageMembers[idx], x, y, cardW, cardH, 'back');
            this.drawCardCropMarks(doc, x, y, cardW, cardH);
          }
        }

        if (options.onProgress) {
          options.onProgress(Math.min((p + 1) * cardsPerPage, totalMembers), totalMembers);
        }
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `ULM_Member_Cards_${options.layout}_${dateStr}.pdf`;

    return {
      doc,
      filename,
      pageCount,
      cardCount: totalMembers,
    };
  }

  /**
   * Draws crop marks around a card on an A4 sheet.
   */
  private static drawCardCropMarks(doc: jsPDF, x: number, y: number, w: number, h: number) {
    const markLen = 3;
    const gap = 1;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.1);

    // Top-left
    doc.line(x - gap - markLen, y, x - gap, y);
    doc.line(x, y - gap - markLen, x, y - gap);

    // Top-right
    doc.line(x + w + gap, y, x + w + gap + markLen, y);
    doc.line(x + w, y - gap - markLen, x + w, y - gap);

    // Bottom-left
    doc.line(x - gap - markLen, y + h, x - gap, y + h);
    doc.line(x, y + h + gap, x, y + h + gap + markLen);

    // Bottom-right
    doc.line(x + w + gap, y + h, x + w + gap + markLen, y + h);
    doc.line(x + w, y + h + gap, x + w, y + h + gap + markLen);
  }

  /**
   * Draws a single card (front or back) at exact physical dimensions with real crest, official colors, and barcode.
   */
  private static renderSingleCardPdf(
    doc: jsPDF,
    m: Borrower,
    x: number,
    y: number,
    w: number,
    h: number,
    side: 'front' | 'back'
  ) {
    const uid = m.university_id || m.student_id || 'ULM-00001';
    const role = m.role || 'Student';
    const name = m.name || 'Member Name';
    const department = m.department || 'Computer Science';
    const validUntil = m.valid_until || '2027-06-30';

    // 1. Outer Gold Border
    doc.setFillColor(217, 158, 50); // Gold
    doc.roundedRect(x, y, w, h, 3.18, 3.18, 'F');

    // 2. Card Background: Dark navy #0d101a
    const inset = 0.6;
    doc.setFillColor(13, 16, 26);
    doc.roundedRect(x + inset, y + inset, w - (inset * 2), h - (inset * 2), 2.8, 2.8, 'F');

    // 3. Faint Purple and Gold gradient accents
    doc.setFillColor(84, 26, 114); // Royal purple accent
    doc.roundedRect(x + inset, y + inset, w - (inset * 2), 12, 2.8, 2.8, 'F');

    // 4. Real ULM Crest Watermark in Color (6% opacity in alpha channel, centered behind content)
    try {
      const wmSize = 36;
      const wmX = x + (w - wmSize) / 2;
      const wmY = y + (h - wmSize) / 2;
      doc.addImage(ULM_CREST_WATERMARK_SRC, 'PNG', wmX, wmY, wmSize, wmSize);
    } catch {
      // Fallback
    }

    if (side === 'front') {
      // ================= CARD FRONT =================
      // Header Crest (9.5mm height in crisp color)
      try {
        doc.addImage(ULM_CREST_SRC, 'PNG', x + 4, y + 2.5, 9.5, 9.5);
      } catch {
        // Fallback
      }

      // Header: University Title & Library
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text('UNIVERSITY OF LAKKI MARWAT', x + 16, y + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(246, 184, 74); // Gold text
      doc.text('CENTRAL CAMPUS LIBRARY • SMART ID', x + 16, y + 8.8);

      // Header Chip: RFID / Role
      doc.setFillColor(217, 158, 50);
      doc.roundedRect(x + w - 18, y + 3.2, 14, 4.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(10, 10, 15);
      doc.text(role.toUpperCase(), x + w - 11, y + 6.3, { align: 'center' });

      // Member Photo Placeholder / Gold Box
      const photoX = x + 4;
      const photoY = y + 14.5;
      const photoW = 19;
      const photoH = 24;

      doc.setFillColor(5, 7, 13);
      doc.setDrawColor(217, 158, 50);
      doc.setLineWidth(0.4);
      doc.rect(photoX, photoY, photoW, photoH, 'FD');

      // Photo Initials
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(246, 184, 74);
      doc.text((name.charAt(0) || 'U').toUpperCase(), photoX + (photoW / 2), photoY + (photoH / 2) + 4, { align: 'center' });

      // Member Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(name.slice(0, 24), x + 26, y + 17.5);

      // Member Details Grid
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(160, 160, 175);
      doc.text('ID NO:', x + 26, y + 22);
      doc.text('DEPT:', x + 26, y + 26.5);
      doc.text('VALID TILL:', x + 26, y + 31);

      doc.setFont('courier', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(246, 184, 74);
      doc.text(uid, x + 38, y + 22);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(230, 230, 240);
      doc.text(department.slice(0, 22), x + 38, y + 26.5);
      doc.text(validUntil, x + 38, y + 31);

      // Blood group badge
      if (m.blood_group) {
        doc.setFillColor(180, 40, 40);
        doc.roundedRect(x + w - 15, y + 28, 11, 4.5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.text(m.blood_group, x + w - 9.5, y + 31.2, { align: 'center' });
      }

      // Barcode at Footer
      const bcX = x + 4;
      const bcY = y + 40;
      const bcW = w - 8;
      const bcH = 8.5;

      // White barcode back plate
      doc.setFillColor(255, 255, 255);
      doc.rect(bcX, bcY, bcW, bcH, 'F');

      this.drawVectorCode128(doc, uid, bcX + 1, bcY + 0.5, bcW - 2, bcH - 1, {
        showText: false,
      });

      // Human readable UID below barcode
      doc.setFont('courier', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(180, 180, 190);
      doc.text(uid, x + (w / 2), y + h - 1.5, { align: 'center' });
    } else {
      // ================= CARD BACK =================
      // Header Crest (7.5mm height in crisp color)
      try {
        doc.addImage(ULM_CREST_SRC, 'PNG', x + 4, y + 2.5, 7.5, 7.5);
      } catch {}

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('UNIVERSITY OF LAKKI MARWAT', x + 13.5, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(246, 184, 74);
      doc.text('CENTRAL CAMPUS LIBRARY • TERMS OF USE', x + 13.5, y + 9.5);

      // Terms
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(210, 210, 220);

      const terms = [
        '1. This card is non-transferable and remains the property of ULM Central Campus Library.',
        '2. The cardholder is responsible for all library items borrowed under this credential.',
        '3. Immediate notice must be given to the circulation desk in case of loss or damage.',
        '4. If found, please return to: Central Campus Library, University of Lakki Marwat, KPK.',
      ];

      let termY = y + 14;
      for (const t of terms) {
        doc.text(t, x + 6, termY);
        termY += 4.2;
      }

      // Signature & Authority
      doc.setDrawColor(120, 120, 130);
      doc.setLineWidth(0.2);
      doc.line(x + 8, y + 36, x + 38, y + 36);
      doc.line(x + 48, y + 36, x + 78, y + 36);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.8);
      doc.setTextColor(160, 160, 170);
      doc.text('Cardholder Signature', x + 23, y + 38.5, { align: 'center' });
      doc.text('Librarian / Issuing Authority', x + 63, y + 38.5, { align: 'center' });

      // Contact footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.8);
      doc.setTextColor(180, 180, 190);
      doc.text('Tel: +92 969 511819  •  Email: library@ulm.edu.pk  •  Web: www.ulm.edu.pk', x + (w / 2), y + h - 2.5, { align: 'center' });
    }
  }

  /**
   * Safe isolated printing via Blob and hidden iframe.
   * Gracefully handles blocked iframes by alerting the user.
   */
  static printPdfBlob(blob: Blob): Promise<{ success: boolean; blocked?: boolean }> {
    return new Promise((resolve) => {
      try {
        const blobUrl = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = blobUrl;

        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            resolve({ success: true });
          } catch {
            // Window print blocked in iframe
            resolve({ success: false, blocked: true });
          } finally {
            setTimeout(() => {
              try {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(blobUrl);
              } catch {}
            }, 5000);
          }
        };

        iframe.onerror = () => {
          resolve({ success: false, blocked: true });
        };

        document.body.appendChild(iframe);
      } catch {
        resolve({ success: false, blocked: true });
      }
    });
  }

  /**
   * Triggers download of generated jsPDF instance.
   */
  static downloadPdf(doc: jsPDF, filename: string): void {
    doc.save(filename);
  }
}
