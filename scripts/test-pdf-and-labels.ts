import { encodeCode128B, evaluateScanSafety } from '../src/utils/code128';
import { PdfGeneratorService, LABEL_SIZES, SHEET_TEMPLATES } from '../src/services/pdfGeneratorService';
import { Book, Borrower } from '../src/types/library';

async function runVerification() {
  console.log('--- 1. Testing Code-128 ISO/IEC 15417 Module Encoding ---');
  const sampleCodes = ['ULM-00001', 'ULM-FA23-BCS-043', '12345'];
  for (const code of sampleCodes) {
    const enc = encodeCode128B(code);
    console.log(`[PASS] Code: ${code} => ${enc.modules.length} bars/spaces, totalModules: ${enc.totalModules}`);
    if (enc.modules.length === 0 || enc.totalModules === 0) {
      throw new Error(`Failed to encode barcode: ${code}`);
    }
  }

  console.log('\n--- 2. Testing Scan Safety Thresholds (>= 0.17 mm) ---');
  const safetyStandard = evaluateScanSafety(134, 63.5 - 6);
  console.log(`Standard 63.5mm: module=${safetyStandard.moduleWidthMm.toFixed(3)}mm, isSafe=${safetyStandard.isSafe}`);
  if (!safetyStandard.isSafe) throw new Error('Standard size should be optical safe');

  const safetyThin = evaluateScanSafety(134, 38.0 - 6);
  console.log(`Thin spine rotated (38.0mm axis): module=${safetyThin.moduleWidthMm.toFixed(3)}mm, isSafe=${safetyThin.isSafe}`);
  if (!safetyThin.isSafe) throw new Error('Rotated thin spine should be safe on 38mm axis');

  console.log('\n--- 3. Testing Label PDF Generator (Avery L7160, L7651, Thin, Thermal) ---');
  const mockBooks: Book[] = Array.from({ length: 50 }, (_, i) => ({
    id: `book-${i + 1}`,
    book_name: `System Design & Distributed Architecture Vol ${i + 1}`,
    author: 'Prof. Dr. A. K. Marwat',
    barcode: `ULM-${String(i + 1).padStart(5, '0')}`,
    accession_no: String(i + 1).padStart(5, '0'),
    dewey_call_number: '004.22 ULM',
    shelf: 'A-1',
    pages: i < 5 ? 64 : 320, // First 5 are thin books (<80 pages)
    status: 'available',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })) as unknown as Book[];

  // Avery L7160: 21 per sheet => 50 labels should produce 3 pages
  const l7160Result = await PdfGeneratorService.generateLabelsPdf(mockBooks, {
    sizePreset: 'standard',
    sheetLayout: 'avery_l7160',
    startPosition: 1,
    showCutLines: true,
  });
  console.log(`[PASS] Avery L7160: 50 labels => ${l7160Result.pageCount} pages (Expected 3 pages). File: ${l7160Result.filename}`);
  if (l7160Result.pageCount !== 3) throw new Error(`Expected 3 pages for L7160, got ${l7160Result.pageCount}`);

  // Avery L7651: 65 per sheet => 50 labels should fit on 1 page
  const l7651Result = await PdfGeneratorService.generateLabelsPdf(mockBooks, {
    sizePreset: 'small',
    sheetLayout: 'avery_l7651',
    startPosition: 1,
  });
  console.log(`[PASS] Avery L7651: 50 labels => ${l7651Result.pageCount} page (Expected 1 page).`);
  if (l7651Result.pageCount !== 1) throw new Error(`Expected 1 page for L7651, got ${l7651Result.pageCount}`);

  // Start at position 10 on Avery L7160: 10 + 50 = 60 slots => 3 pages
  const shiftedResult = await PdfGeneratorService.generateLabelsPdf(mockBooks, {
    sizePreset: 'standard',
    sheetLayout: 'avery_l7160',
    startPosition: 10,
  });
  console.log(`[PASS] Shifted Avery L7160 (start pos 10): ${shiftedResult.pageCount} pages.`);

  console.log('\n--- 4. Testing Member Cards PDF Generator ---');
  const mockBorrowers: Borrower[] = Array.from({ length: 12 }, (_, i) => ({
    id: `borrower-${i + 1}`,
    name: `Student Member ${i + 1}`,
    role: 'Student',
    department: 'Computer Science',
    university_id: `ULM-FA23-BCS-${String(i + 1).padStart(3, '0')}`,
    status: 'active',
    borrow_limit: 3,
    valid_until: '2027-06-30',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })) as unknown as Borrower[];

  // (a) Exact CR80: 12 members => 24 pages (front + back)
  const cr80Res = await PdfGeneratorService.generateMemberCardsPdf(mockBorrowers, {
    layout: 'cr80_single',
  });
  console.log(`[PASS] CR80 Single: 12 cards => ${cr80Res.pageCount} pages (Expected 24 pages).`);
  if (cr80Res.pageCount !== 24) throw new Error(`Expected 24 pages for CR80 single, got ${cr80Res.pageCount}`);

  // (b) A4 10-Card Sheet: 12 members => 2 pages (10 cards on p1, 2 cards on p2)
  const a4Res = await PdfGeneratorService.generateMemberCardsPdf(mockBorrowers, {
    layout: 'a4_sheet_10',
  });
  console.log(`[PASS] A4 10-up: 12 cards => ${a4Res.pageCount} pages (Expected 2 pages).`);
  if (a4Res.pageCount !== 2) throw new Error(`Expected 2 pages for A4 10-up, got ${a4Res.pageCount}`);

  // (c) A4 Duplex: 12 members => 4 pages (p1 fronts, p2 backs, p3 fronts, p4 backs)
  const duplexRes = await PdfGeneratorService.generateMemberCardsPdf(mockBorrowers, {
    layout: 'a4_duplex',
  });
  console.log(`[PASS] A4 Duplex: 12 cards => ${duplexRes.pageCount} pages (Expected 4 pages).`);
  if (duplexRes.pageCount !== 4) throw new Error(`Expected 4 pages for A4 duplex, got ${duplexRes.pageCount}`);

  console.log('\nALL PDF & PRINT CHECKS PASSED SUCCESSFULLY!');
}

runVerification().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
