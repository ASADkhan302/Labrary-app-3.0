import React, { useEffect } from 'react';
import { X, Printer, Bookmark } from 'lucide-react';
import { Book } from '../../types/library';

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
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const handlePrint = () => {
    window.print();
  };

  const renderBarcodeVector = (code: string) => {
    // Generate barcode line heights and widths (always pure black in light and dark)
    return (
      <div 
        className="barcode-container flex items-center justify-center gap-[2.5px] h-16 w-full px-4 py-1 bg-white select-none"
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
            <Printer className="w-4 h-4" />
            <span>BARCODE LABEL THERMAL GENERATOR</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Label Preview Area */}
        <div className="p-6 bg-slate-100 dark:bg-[#020617] flex flex-col items-center justify-center space-y-4">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Standard 2.5" x 1.5" Adhesive Spine Label:</span>

          {/* Printable Sticker Container (high-contrast thermal sticker) */}
          <div 
            id="printable-barcode-label"
            className="w-80 bg-white text-slate-950 p-4 rounded-lg shadow-sm border-2 border-slate-300 space-y-2 text-center select-none"
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
                Call: {book.dewey_call_number} · Shelf: {book.shelf}
              </p>
            </div>

            {/* Barcode vector graphic */}
            <div className="py-1">
              {renderBarcodeVector(book.barcode)}
              <p className="font-mono text-xs font-bold tracking-[0.25em] text-slate-950 mt-1">
                {book.barcode}
              </p>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-300 pt-1 text-[11px] font-mono font-bold text-slate-700 uppercase tracking-wider">
              CENTRAL CAMPUS LIBRARY • PROPERTY OF ULM
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#020617] border-t border-slate-200 dark:border-[#1E293B] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-xs shadow-md flex items-center gap-2 tracking-wide transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Label [Ctrl+P]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default BarcodePrintModal;
