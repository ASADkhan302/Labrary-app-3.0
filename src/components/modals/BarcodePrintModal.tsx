import React, { useEffect, useState } from 'react';
import { X, Printer, Bookmark, FileDown, Loader2, AlertTriangle } from 'lucide-react';
import { Book } from '../../types/library';
import { PdfGeneratorService } from '../../services/pdfGeneratorService';

interface BarcodePrintModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  book,
  isOpen,
  onClose,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setBlockedMessage(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const handleSaveAsPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const res = await PdfGeneratorService.generateLabelsPdf([book], {
        sizePreset: 'standard',
        sheetLayout: 'thermal_roll',
      });
      PdfGeneratorService.downloadPdf(res.doc, `ULM_Spine_Label_${book.barcode || 'book'}.pdf`);
    } catch (e: any) {
      console.error('Failed to export PDF:', e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = async () => {
    setIsGeneratingPdf(true);
    setBlockedMessage(null);
    try {
      const res = await PdfGeneratorService.generateLabelsPdf([book], {
        sizePreset: 'standard',
        sheetLayout: 'thermal_roll',
      });
      const blob = res.doc.output('blob');
      const printRes = await PdfGeneratorService.printPdfBlob(blob);
      if (!printRes.success && printRes.blocked) {
        setBlockedMessage('Printing is blocked in this preview frame. Please click "Save as PDF" to download your label, or open the app in a new browser tab.');
      }
    } catch {
      setBlockedMessage('Printing is blocked here. Use Save as PDF, or open the app in its own tab.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderBarcodeVector = (code: string) => {
    return (
      <div 
        className="barcode-container flex items-center justify-center gap-[2.5px] h-14 w-full px-4 py-1 bg-white select-none"
        data-barcode-container="true"
      >
        {code.split('').map((char, idx) => {
          const num = parseInt(char, 10) || 4;
          const w = (num % 3) + 1.8;
          return (
            <div
              key={idx}
              className="barcode-bar h-full"
              style={{ width: `${w}px`, backgroundColor: '#000000', minWidth: '1.5px' }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#18151D] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#121014] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-[#E0B450] font-semibold uppercase tracking-wider">
            <Printer className="w-4 h-4" />
            <span>BARCODE LABEL THERMAL GENERATOR</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {blockedMessage && (
          <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-600/30 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{blockedMessage}</span>
          </div>
        )}

        {/* Printable Label Preview Area */}
        <div className="p-6 bg-[#0E0D10] flex flex-col items-center justify-center space-y-3">
          <span className="text-xs font-mono text-[#B3AABD]">Standard 63.5 × 38.1 mm Adhesive Spine Label:</span>

          {/* Printable Sticker Container */}
          <div 
            id="printable-barcode-label"
            className="w-72 bg-white text-slate-950 p-4 rounded-lg shadow-md border-2 border-slate-300 space-y-2 text-center select-none"
          >
            {/* Header */}
            <div className="border-b border-slate-300 pb-1.5 flex items-center justify-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
              <span className="font-cinzel text-[11px] font-bold tracking-wider uppercase text-slate-900">
                UNIVERSITY OF LAKKI MARWAT
              </span>
            </div>

            {/* Book Name */}
            <div>
              <p className="font-semibold text-xs text-slate-950 line-clamp-1">
                {book.book_name}
              </p>
              <p className="text-xs text-slate-700 font-mono font-medium mt-0.5">
                Call: {book.dewey_call_number || '000 ULM'} · Shelf: {book.shelf || 'Main'}
              </p>
            </div>

            {/* Barcode vector graphic */}
            <div className="py-1">
              {renderBarcodeVector(book.barcode)}
              <p className="font-mono text-xs font-bold tracking-[0.2em] text-slate-950 mt-1">
                {book.barcode}
              </p>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-300 pt-1 text-[10px] font-mono font-bold text-slate-700 uppercase tracking-wider">
              CENTRAL CAMPUS LIBRARY • PROPERTY OF ULM
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 bg-[#121014] border-t border-white/[0.08] flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              disabled={isGeneratingPdf}
              onClick={handleSaveAsPdf}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span>Save as PDF</span>
            </button>

            <button
              disabled={isGeneratingPdf}
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default BarcodePrintModal;
