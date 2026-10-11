import React, { useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  MapPin, 
  Barcode as BarcodeIcon, 
  Clock, 
  Edit3, 
  Printer, 
  ArrowRightLeft, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  Trash2,
  Calendar
} from 'lucide-react';
import { Book, Transaction } from '../../types/library';
import { formatDisplayDate } from '../../utils/dateUtils';
import { isArabicOrUrduScript } from '../../utils/urduUtils';

interface BookDetailsModalProps {
  book: Book | null;
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onLoan: (book: Book) => void;
  onPrintBarcode: (book: Book) => void;
  onReturnLoan: (transactionId: string) => void;
  onDelete?: (book: Book) => void;
}

export const BookDetailsModal: React.FC<BookDetailsModalProps> = ({
  book,
  transactions,
  isOpen,
  onClose,
  onEdit,
  onLoan,
  onPrintBarcode,
  onReturnLoan,
  onDelete,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const isAvailable = book.available_quantity > 0;
  const issuedCount = book.total_quantity - book.available_quantity;
  const activeLoans = transactions.filter(t => t.book_id === book.id && t.status !== 'RETURNED');

  const renderBarcodeStrip = (code: string) => {
    return (
      <div 
        className="barcode-container flex items-center gap-[2px] h-10 px-3 py-1 bg-[#0F172A] rounded border border-slate-300 select-none shadow-xs"
        data-barcode-container="true"
      >
        {code.split('').map((char, idx) => {
          const num = parseInt(char, 10) || 3;
          const w = (num % 3) + 1.5;
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
        className="w-full max-w-2xl bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>CAMPUS CATALOG SPECIFICATION</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-[#F1F5F9] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Cover image or fallback */}
            <div 
              data-preserve-dark="true"
              className="w-36 h-52 rounded-xl bg-slate-800 border border-slate-700 shadow-xl relative overflow-hidden flex flex-col justify-between p-3 shrink-0 mx-auto sm:mx-0"
            >
              {book.book_image_path ? (
                <img
                  src={book.book_image_path}
                  alt={book.book_name}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}
              <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-amber-700/80 via-amber-400 to-amber-700/40 z-10 shadow" />
              <div className="relative z-0 text-[10px] space-y-1">
                <span className="text-[9px] font-mono-code text-amber-300 font-bold uppercase">ULM PRESS</span>
                <p data-preserve-white="true" className="font-header font-bold text-[#F1F5F9] text-xs leading-snug line-clamp-4">{book.book_name}</p>
              </div>
              <span className="relative z-0 text-[9px] font-mono-code text-slate-300">{book.dewey_call_number}</span>
            </div>

            {/* Main Meta Details */}
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {book.category}
                </span>
                {(book.language === 'Urdu' || isArabicOrUrduScript(book.book_name)) ? (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800">
                    اردو · Nastaliq
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-mono-code text-slate-400 bg-slate-800 border border-slate-700">
                    {book.language || 'English'}
                  </span>
                )}
                <span className="text-xs font-mono-code text-slate-400">
                  {book.edition} · {book.publication_year}
                </span>
              </div>

              <h2 
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
                className={`font-bold font-header text-[#F1F5F9] leading-snug ${
                  isArabicOrUrduScript(book.book_name) ? 'font-urdu text-2xl leading-[2.1] py-1' : 'text-xl'
                }`}
              >
                {book.book_name}
              </h2>
              {book.title_roman && (
                <p className="text-xs font-mono text-amber-400">
                  Roman Urdu: {book.title_roman}
                </p>
              )}

              <p 
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
                className={`text-xs text-slate-400 ${
                  isArabicOrUrduScript(book.author) ? 'font-urdu text-base leading-[2]' : ''
                }`}
              >
                Author: <span className="font-semibold text-[#F1F5F9]">{book.author}</span>
                {book.author_roman && (
                  <span className="text-xs text-slate-400 font-mono ml-1.5">({book.author_roman})</span>
                )}
              </p>

              {book.publisher && (
                <p 
                  dir="auto"
                  style={{ unicodeBidi: 'plaintext' }}
                  className={`text-xs text-slate-500 dark:text-slate-400 ${
                    isArabicOrUrduScript(book.publisher) ? 'font-urdu leading-[2]' : ''
                  }`}
                >
                  Publisher: {book.publisher}
                </p>
              )}

              {/* Physical location */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-[#1E293B] text-xs">
                <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Stack Location:</span>
                <span className="text-[#F1F5F9] font-mono-code font-semibold">{book.shelf} · Row {book.row} ({book.section})</span>
              </div>

              {/* Dewey Call Number, ISBN & Date Added */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-[#1E293B]">
                  <span className="text-[10px] uppercase font-mono-code text-slate-500 block">Dewey Class</span>
                  <span className="font-mono-code font-bold text-amber-700 dark:text-amber-400 truncate block">{book.dewey_call_number}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-[#1E293B]">
                  <span className="text-[10px] uppercase font-mono-code text-slate-500 block">ISBN-13</span>
                  <span className="font-mono-code text-slate-700 dark:text-slate-300 truncate block">{book.isbn}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-[#1E293B]">
                  <span className="text-[10px] uppercase font-mono-code text-slate-500 block">Date Added</span>
                  <span className="font-mono-code text-amber-600 dark:text-amber-300 font-semibold truncate block flex items-center gap-1">
                    <Calendar className="w-3 h-3 shrink-0" />
                    {formatDisplayDate(book.date_added || book.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Barcode & Availability Bar */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono-code text-slate-500 block">Scannable Barcode Identifier</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono-code font-bold text-[#F1F5F9] tracking-widest">{book.barcode}</span>
                {renderBarcodeStrip(book.barcode)}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono-code text-slate-500 block">Total Stacks</span>
                <span className="text-base font-mono-code font-bold text-[#F1F5F9] tabular-nums">{book.total_quantity}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono-code text-slate-500 block">Available</span>
                <span className={`text-base font-mono-code font-bold tabular-nums ${isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {book.available_quantity}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Catalog Abstract & Course Notes</span>
              <p 
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
                className={`text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-[#020617] p-4 rounded-xl border border-slate-200 dark:border-[#1E293B] ${
                  isArabicOrUrduScript(book.description) ? 'font-urdu leading-[2.1]' : ''
                }`}
              >
                {book.description}
              </p>
            </div>
          )}

          {/* Active Loans */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Active Circulation Checkouts ({activeLoans.length} of {book.total_quantity} copies)
              </span>
            </div>

            {activeLoans.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-50 dark:bg-[#020617] p-3 rounded-lg border border-slate-200 dark:border-[#1E293B]">
                All {book.total_quantity} copies are currently on shelves and available for loan.
              </p>
            ) : (
              <div className="space-y-1.5">
                {activeLoans.map(loan => (
                  <div key={loan.id} className="flex items-center justify-between bg-[#020617] p-2.5 rounded-lg border border-slate-200 dark:border-[#1E293B] text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-[#F1F5F9]">{loan.borrower_name}</span>
                      <span className="font-mono-code text-slate-500 dark:text-slate-400">({loan.student_id})</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-code text-slate-500 dark:text-slate-400">Due: {loan.due_date}</span>
                      <button
                        onClick={() => onReturnLoan(loan.id)}
                        className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-300 dark:border-emerald-500/30 transition-colors cursor-pointer"
                      >
                        Return Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-[#020617] border-t border-slate-200 dark:border-[#1E293B] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(book)}
              className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-200 dark:border-[#334155] transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Title</span>
            </button>
            <button
              onClick={() => onPrintBarcode(book)}
              className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-[#334155] text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-1.5 border border-slate-200 dark:border-[#334155] transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Barcode</span>
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(book)}
                className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium flex items-center gap-1.5 border border-slate-200 dark:border-[#334155] hover:border-rose-300 dark:hover:border-rose-900 transition-colors cursor-pointer"
                title="Delete or archive this book"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Book</span>
              </button>
            )}
          </div>

          <button
            onClick={() => onLoan(book)}
            disabled={!isAvailable}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer ${
              isAvailable
                ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Issue Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
};
