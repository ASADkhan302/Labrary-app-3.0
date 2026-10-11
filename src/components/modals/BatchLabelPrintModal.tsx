import React, { useEffect, useState } from 'react';
import { X, Printer, Bookmark } from 'lucide-react';
import { Book } from '../../types/library';
import { LibraryStorage } from '../../services/storage';

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

  useEffect(() => {
    if (!isOpen) return;

    if (passedBooks && passedBooks.length > 0) {
      setBooksToPrint(passedBooks);
    } else if (bookIds && bookIds.length > 0) {
      const all = LibraryStorage.getBooks();
      const idSet = new Set(bookIds);
      const matched = all.filter(b => idSet.has(b.id));
      setBooksToPrint(matched);
    } else {
      setBooksToPrint([]);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, bookIds, passedBooks, onClose]);

  if (!isOpen) return null;

  const renderBarcodeVector = (code: string) => {
    return (
      <div 
        className="barcode-container flex items-center justify-center gap-[2px] h-12 w-full px-2 py-1 bg-white select-none"
        data-barcode-container="true"
      >
        {code.split('').map((char, idx) => {
          const num = parseInt(char, 10) || 4;
          const w = (num % 3) + 1.6;
          return (
            <div
              key={idx}
              className="barcode-bar h-full"
              style={{ width: `${w}px`, backgroundColor: '#000000', minWidth: '1.2px' }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[90vh] bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/10 rounded-[16px] shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450]">
              <Printer className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Batch Thermal Barcode Label Generator ({booksToPrint.length} Volumes)
              </h2>
              <p className="text-xs text-[#B3AABD] mt-0.5">
                Standard Code-128 barcode labels ready for direct thermal printing or Avery sticker sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-[8px] bg-gradient-to-b from-[#BC881B] to-[#9E7216] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print All Labels</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Labels Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#141214]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {booksToPrint.map((b, idx) => (
              <div 
                key={b.id || idx}
                className="bg-white text-black p-3.5 rounded-[8px] border-2 border-dashed border-gray-400 flex flex-col justify-between space-y-2 shadow-sm"
                style={{ minHeight: '180px' }}
              >
                <div className="text-center border-b border-gray-300 pb-1.5">
                  <p className="text-[10px] font-bold tracking-wider uppercase text-gray-800">
                    UNIVERSITY OF LAKKI MARWAT
                  </p>
                  <p className="text-[9px] text-gray-600 font-semibold">
                    CENTRAL CAMPUS LIBRARY
                  </p>
                </div>

                <div className="space-y-0.5 text-center">
                  <p className="text-xs font-bold leading-tight line-clamp-2">
                    {b.book_name}
                  </p>
                  <p className="text-[11px] text-gray-700 italic truncate">
                    {b.author}
                  </p>
                  <p className="text-[10px] font-mono text-gray-600">
                    Call: {b.dewey_call_number || '000 ULM'}
                  </p>
                </div>

                {renderBarcodeVector(b.barcode)}

                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-gray-800 pt-1 border-t border-gray-200">
                  <span>ACC: {b.accession_no || b.barcode.replace(/^[A-Z]+-/, '')}</span>
                  <span>{b.barcode}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
