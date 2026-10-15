import React, { useEffect, useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  FileDown, 
  AlertTriangle, 
  Check, 
  Loader2, 
  Layers, 
  Sliders, 
  ChevronLeft, 
  ChevronRight,
  Info
} from 'lucide-react';
import { Book } from '../../types/library';
import { LibraryStorage } from '../../services/storage';
import { 
  PdfGeneratorService, 
  LABEL_SIZES, 
  SHEET_TEMPLATES, 
  LabelSizePreset, 
  LabelSheetLayout 
} from '../../services/pdfGeneratorService';
import { encodeCode128B, evaluateScanSafety } from '../../utils/code128';

interface BatchLabelPrintModalProps {
  isOpen: boolean;
  bookIds?: string[];
  books?: Book[];
  onClose: () => void;
}

export const BatchLabelPrintModal: React.FC<BatchLabelPrintModalProps> = ({
  isOpen,
  bookIds,
  books: passedBooks,
  onClose,
}) => {
  const [booksToPrint, setBooksToPrint] = useState<Book[]>([]);
  const [sizePreset, setSizePreset] = useState<LabelSizePreset>('standard');
  const [sheetLayout, setSheetLayout] = useState<LabelSheetLayout>('avery_l7160');
  const [startPosition, setStartPosition] = useState<number>(1);
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [autoThinSpine, setAutoThinSpine] = useState<boolean>(true);
  const [thinPageThreshold, setThinPageThreshold] = useState<number>(80);
  const [customWidth, setCustomWidth] = useState<number>(60);
  const [customHeight, setCustomHeight] = useState<number>(35);

  const [printScope, setPrintScope] = useState<'recent' | 'all'>('recent');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number; page: number } | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ type: 'info' | 'success' | 'warn'; message: string } | null>(null);
  const cancelGenerationRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const allBooks = LibraryStorage.getBooks().filter(b => b.is_active);
    const hasRecentBatch = Boolean(bookIds && bookIds.length > 0);

    if (hasRecentBatch && printScope === 'recent') {
      const idSet = new Set(bookIds);
      const matched = allBooks.filter(b => idSet.has(b.id));
      setBooksToPrint(matched.length > 0 ? matched : allBooks);
    } else if (passedBooks && passedBooks.length > 0) {
      setBooksToPrint(passedBooks);
    } else {
      setBooksToPrint(allBooks);
    }

    setPreviewPage(1);
    setStatusNotification(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, bookIds, passedBooks, printScope, onClose]);

  // Adjust sheet template recommendation based on size preset
  const handleSizeChange = (preset: LabelSizePreset) => {
    setSizePreset(preset);
    if (preset === 'small') {
      setSheetLayout('avery_l7651');
    } else if (preset === 'thin') {
      setSheetLayout('plain_a4_grid');
    } else if (preset === 'standard') {
      setSheetLayout('avery_l7160');
    }
  };

  if (!isOpen) return null;

  const currentTemplate = SHEET_TEMPLATES[sheetLayout];
  const currentSize = LABEL_SIZES[sizePreset];
  const targetW = sizePreset === 'custom' ? customWidth : currentSize.widthMm;
  const targetH = sizePreset === 'custom' ? customHeight : currentSize.heightMm;

  // Calculate scan safety for the current size
  const sampleScanSafety = evaluateScanSafety(134, targetW - 6);

  // Pagination calculation for preview
  const labelsPerPage = currentTemplate.labelsPerPage;
  const totalPreviewPages = Math.max(1, Math.ceil((booksToPrint.length + (startPosition - 1)) / labelsPerPage));
  const startIndex = Math.max(0, (previewPage - 1) * labelsPerPage - (previewPage === 1 ? startPosition - 1 : 0));
  const pageBooks = booksToPrint.slice(startIndex, startIndex + labelsPerPage);

  // Handle Save as PDF
  const handleSaveAsPdf = async () => {
    if (booksToPrint.length === 0) return;
    setIsGeneratingPdf(true);
    cancelGenerationRef.current = false;
    setPdfProgress({ current: 0, total: booksToPrint.length, page: 1 });
    setStatusNotification({ type: 'info', message: 'Generating exact physical PDF...' });

    try {
      const result = await PdfGeneratorService.generateLabelsPdf(booksToPrint, {
        sizePreset,
        customWidthMm: customWidth,
        customHeightMm: customHeight,
        sheetLayout,
        startPosition,
        showCutLines,
        autoThinSpineThreshold: autoThinSpine ? thinPageThreshold : undefined,
        onProgress: (current, total, page) => {
          setPdfProgress({ current, total, page });
        },
        shouldCancel: () => cancelGenerationRef.current,
      });

      if (!cancelGenerationRef.current) {
        PdfGeneratorService.downloadPdf(result.doc, result.filename);
        setStatusNotification({
          type: 'success',
          message: `Saved ${result.labelCount} labels across ${result.pageCount} page(s) to ${result.filename}`,
        });
      } else {
        setStatusNotification({ type: 'warn', message: 'PDF export was cancelled.' });
      }
    } catch (err: any) {
      setStatusNotification({ type: 'warn', message: `Export error: ${err.message || 'Failed to generate PDF'}` });
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // Handle Print via isolated PDF print
  const handlePrint = async () => {
    if (booksToPrint.length === 0) return;
    setIsGeneratingPdf(true);
    setStatusNotification({ type: 'info', message: 'Preparing print document...' });

    try {
      const result = await PdfGeneratorService.generateLabelsPdf(booksToPrint, {
        sizePreset,
        customWidthMm: customWidth,
        customHeightMm: customHeight,
        sheetLayout,
        startPosition,
        showCutLines,
        autoThinSpineThreshold: autoThinSpine ? thinPageThreshold : undefined,
      });

      const blob = result.doc.output('blob');
      const printRes = await PdfGeneratorService.printPdfBlob(blob);

      if (!printRes.success && printRes.blocked) {
        setStatusNotification({
          type: 'warn',
          message: 'Printing is blocked in this preview frame. Please click "Save as PDF" to download and print, or open the app in a dedicated browser tab.',
        });
      } else {
        setStatusNotification({ type: 'success', message: 'Print dialog dispatched.' });
      }
    } catch {
      setStatusNotification({
        type: 'warn',
        message: 'Printing is blocked here. Use Save as PDF, or open the app in its own tab.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl max-h-[92vh] bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/10 rounded-[16px] shadow-2xl overflow-hidden flex flex-col relative text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450]">
              <Printer className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Barcode & Spine Label Studio</span>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40">
                  {booksToPrint.length} Volumes
                </span>
              </h2>
              <p className="text-xs text-[#B3AABD] mt-0.5">
                Exact physical millimetre dimensions, Avery die-cut sticker sheets, thermal roll, and vector Code-128 barcodes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {bookIds && bookIds.length > 0 && (
              <div className="flex items-center gap-1 bg-white/[0.08] p-1 rounded-[8px] border border-white/10 text-xs mr-1">
                <button
                  type="button"
                  onClick={() => setPrintScope('recent')}
                  className={`px-2.5 py-1 rounded-[6px] font-semibold transition-colors cursor-pointer ${
                    printScope === 'recent'
                      ? 'bg-[#BC881B] text-[#1A1A1A] font-bold shadow'
                      : 'text-[#B3AABD] hover:text-white'
                  }`}
                  title="Print labels for recently imported batch"
                >
                  Recent Batch ({bookIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintScope('all')}
                  className={`px-2.5 py-1 rounded-[6px] font-semibold transition-colors cursor-pointer ${
                    printScope === 'all'
                      ? 'bg-[#BC881B] text-[#1A1A1A] font-bold shadow'
                      : 'text-[#B3AABD] hover:text-white'
                  }`}
                  title="Print labels for all active catalog volumes"
                >
                  All Catalog
                </button>
              </div>
            )}
            {isGeneratingPdf ? (
              <button
                type="button"
                onClick={() => { cancelGenerationRef.current = true; }}
                className="px-3 py-1.5 rounded-[8px] bg-rose-600/20 border border-rose-500/40 text-rose-300 font-bold text-xs hover:bg-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            ) : (
              <>
                {/* Save as PDF Button */}
                <button
                  type="button"
                  onClick={handleSaveAsPdf}
                  className="px-4 py-2 rounded-[8px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-xs uppercase tracking-wider shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Generate high-resolution 300 DPI vector PDF download"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Save as PDF</span>
                </button>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 rounded-[8px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  title="Send to physical printer"
                >
                  <Printer className="w-4 h-4 text-slate-300" />
                  <span>Print</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Notification Bar */}
        {pdfProgress && (
          <div className="px-6 py-2.5 bg-[#BC881B]/15 border-b border-[#BC881B]/30 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-[#E0B450] font-medium">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Generating labels: {pdfProgress.current} / {pdfProgress.total} (Page {pdfProgress.page})...</span>
            </div>
            <div className="w-48 bg-black/40 h-2 rounded-full overflow-hidden border border-[#BC881B]/30">
              <div 
                className="bg-[#E0B450] h-full transition-all duration-150" 
                style={{ width: `${Math.round((pdfProgress.current / pdfProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {statusNotification && !pdfProgress && (
          <div className={`px-6 py-2 border-b flex items-center justify-between text-xs ${
            statusNotification.type === 'warn'
              ? 'bg-amber-950/40 border-amber-600/30 text-amber-200'
              : statusNotification.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-600/30 text-emerald-200'
              : 'bg-blue-950/40 border-blue-600/30 text-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {statusNotification.type === 'warn' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Info className="w-4 h-4" />}
              <span>{statusNotification.message}</span>
            </div>
            <button 
              onClick={() => setStatusNotification(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Configuration Controls Bar */}
        <div className="px-6 py-3 bg-[#17151A] border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Sizing & Layout Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Label Size */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Size:</span>
              <select
                value={sizePreset}
                onChange={(e) => handleSizeChange(e.target.value as LabelSizePreset)}
                className="bg-[#242129] border border-white/10 rounded-[6px] px-2.5 py-1 text-xs text-white outline-hidden focus:border-[#BC881B] cursor-pointer"
              >
                {Object.values(LABEL_SIZES).map((sz) => (
                  <option key={sz.id} value={sz.id}>{sz.name}</option>
                ))}
              </select>
            </div>

            {/* Sheet Template */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Layout:</span>
              <select
                value={sheetLayout}
                onChange={(e) => setSheetLayout(e.target.value as LabelSheetLayout)}
                className="bg-[#242129] border border-white/10 rounded-[6px] px-2.5 py-1 text-xs text-white outline-hidden focus:border-[#BC881B] cursor-pointer"
              >
                {Object.values(SHEET_TEMPLATES).map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                ))}
              </select>
            </div>

            {/* Start at Position N */}
            {sheetLayout !== 'thermal_roll' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Start at #:</span>
                <input
                  type="number"
                  min={1}
                  max={currentTemplate.labelsPerPage}
                  value={startPosition}
                  onChange={(e) => setStartPosition(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 bg-[#242129] border border-white/10 rounded-[6px] px-2 py-1 text-xs text-center text-white outline-hidden focus:border-[#BC881B]"
                  title="Skip used sticker slots on partially used sheets"
                />
              </div>
            )}

            {/* Cut Lines toggle */}
            {sheetLayout !== 'thermal_roll' && (
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCutLines}
                  onChange={(e) => setShowCutLines(e.target.checked)}
                  className="rounded border-slate-700 text-[#BC881B] focus:ring-0"
                />
                <span>Cut Guidelines</span>
              </label>
            )}

            {/* Auto thin spine for books < 80 pages */}
            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoThinSpine}
                onChange={(e) => setAutoThinSpine(e.target.checked)}
                className="rounded border-slate-700 text-[#BC881B] focus:ring-0"
              />
              <span>Thin spine for &lt; {thinPageThreshold} pp</span>
            </label>
          </div>

          {/* Scannability Indicator */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            {!sampleScanSafety.isSafe ? (
              <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Barcode width: {sampleScanSafety.moduleWidthMm.toFixed(2)}mm (may not scan)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                <Check className="w-3.5 h-3.5" />
                <span>Module: {sampleScanSafety.moduleWidthMm.toFixed(2)}mm (100% Scan Safe)</span>
              </span>
            )}
          </div>
        </div>

        {/* Labels Scroll Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#121014]">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Previewing Page {previewPage} of {totalPreviewPages} ({pageBooks.length} labels on this sheet)</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={previewPage <= 1}
                  onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                  className="p-1 rounded bg-[#242129] border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2B2730] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2">{previewPage} / {totalPreviewPages}</span>
                <button
                  type="button"
                  disabled={previewPage >= totalPreviewPages}
                  onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                  className="p-1 rounded bg-[#242129] border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2B2730] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Labels Grid */}
            <div 
              className={`grid gap-3.5 p-4 rounded-xl bg-[#0A090D] border border-white/5 shadow-inner ${
                sizePreset === 'thin'
                  ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6'
                  : sizePreset === 'small'
                  ? 'grid-cols-1 sm:grid-cols-3 md:grid-cols-4'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {pageBooks.map((b, idx) => {
                const isThin = (autoThinSpine && b.pages && b.pages < thinPageThreshold) || sizePreset === 'thin';
                const barcode = b.barcode || 'ULM-00001';
                const acc = b.accession_no || barcode.replace(/^[A-Z]+-/, '');

                if (isThin) {
                  return (
                    <div
                      key={b.id || idx}
                      className="bg-white text-black p-2 rounded-[6px] border border-dashed border-gray-400 flex flex-col justify-between items-center text-center shadow-xs"
                      style={{ width: '100%', minHeight: '130px' }}
                    >
                      <div className="font-bold text-[8px] truncate max-w-full font-mono text-slate-800">
                        {b.dewey_call_number || '000 ULM'}
                      </div>

                      {/* Rotated Barcode representation */}
                      <div className="my-1.5 flex flex-col items-center justify-center">
                        <div className="w-16 h-4 bg-slate-100 flex items-center justify-center p-0.5 border border-slate-300 transform rotate-90 my-3">
                          <div className="w-full h-full bg-black flex items-center justify-between px-0.5">
                            <span className="text-[5px] text-white font-mono">|||||||||</span>
                          </div>
                        </div>
                      </div>

                      <div className="font-mono text-[7.5px] font-bold text-slate-800 pt-1 border-t border-slate-200 w-full truncate">
                        {barcode}
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={b.id || idx}
                    className="bg-white text-black p-3 rounded-[8px] border border-dashed border-gray-400 flex flex-col justify-between space-y-1.5 shadow-sm"
                    style={{ minHeight: targetH < 26 ? '90px' : '140px' }}
                  >
                    {targetH >= 26 && (
                      <div className="text-center border-b border-gray-300 pb-1">
                        <p className="text-[9px] font-bold tracking-wider uppercase text-gray-800 leading-tight">
                          UNIVERSITY OF LAKKI MARWAT
                        </p>
                        <p className="text-[8px] text-gray-600 font-semibold leading-tight">
                          CENTRAL CAMPUS LIBRARY
                        </p>
                      </div>
                    )}

                    <div className="space-y-0.5 text-center">
                      <p className="text-[11px] font-bold leading-tight line-clamp-1">
                        {b.book_name}
                      </p>
                      {targetH >= 26 && (
                        <p className="text-[9.5px] text-gray-700 italic truncate">
                          {b.author || 'Author Unknown'}
                        </p>
                      )}
                      <p className="text-[9px] font-mono font-bold text-blue-900">
                        Call: {b.dewey_call_number || '000 ULM'}
                      </p>
                    </div>

                    {/* Vector Barcode rendering */}
                    <div className="barcode-box bg-white px-1 py-0.5 flex flex-col items-center justify-center">
                      <div className="h-7 w-full flex items-center justify-center">
                        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
                          <rect x="0" y="0" width="100" height="24" fill="#ffffff" />
                          <rect x="5" y="0" width="2" height="24" fill="#000000" />
                          <rect x="9" y="0" width="1.5" height="24" fill="#000000" />
                          <rect x="13" y="0" width="3" height="24" fill="#000000" />
                          <rect x="18" y="0" width="1.5" height="24" fill="#000000" />
                          <rect x="22" y="0" width="2" height="24" fill="#000000" />
                          <rect x="26" y="0" width="4" height="24" fill="#000000" />
                          <rect x="33" y="0" width="1.5" height="24" fill="#000000" />
                          <rect x="37" y="0" width="2.5" height="24" fill="#000000" />
                          <rect x="42" y="0" width="2" height="24" fill="#000000" />
                          <rect x="47" y="0" width="3" height="24" fill="#000000" />
                          <rect x="53" y="0" width="1.5" height="24" fill="#000000" />
                          <rect x="57" y="0" width="4" height="24" fill="#000000" />
                          <rect x="64" y="0" width="2" height="24" fill="#000000" />
                          <rect x="68" y="0" width="1.5" height="24" fill="#000000" />
                          <rect x="72" y="0" width="3" height="24" fill="#000000" />
                          <rect x="78" y="0" width="2" height="24" fill="#000000" />
                          <rect x="83" y="0" width="2.5" height="24" fill="#000000" />
                          <rect x="88" y="0" width="1.5" height="24" fill="#000000" />
                          <rect x="92" y="0" width="3" height="24" fill="#000000" />
                        </svg>
                      </div>
                      <span className="text-[7.5px] font-mono text-gray-700 tracking-wider">
                        {barcode}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[8.5px] font-mono font-bold text-gray-800 pt-0.5 border-t border-gray-200">
                      <span>ACC: {acc}</span>
                      <span className="text-[8px] text-gray-500 font-normal">A4 L7160</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-[#1A1A1A] border-t border-white/[0.08] flex items-center justify-between text-xs text-[#B3AABD]">
          <span className="font-mono">
            Sheet Spec: {currentTemplate.name} • {targetW} × {targetH} mm
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleSaveAsPdf}
              className="px-4 py-1.5 rounded-[8px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Save as PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchLabelPrintModal;
