import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  Archive, 
  AlertOctagon, 
  MapPin, 
  Barcode as BarcodeIcon, 
  User, 
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { Book, Transaction } from '../../types/library';

interface DeleteBookConfirmModalProps {
  book: Book | null;
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (bookId: string, permanent: boolean) => void;
}

export const DeleteBookConfirmModal: React.FC<DeleteBookConfirmModalProps> = ({
  book,
  transactions,
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  const [isPermanent, setIsPermanent] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setIsPermanent(false);
      setConfirmInput('');
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  // Active loans check
  const activeLoans = transactions.filter(t => t.book_id === book.id && t.status !== 'RETURNED');
  const hasActiveLoans = activeLoans.length > 0;

  const handleDelete = () => {
    if (hasActiveLoans) return;
    onConfirmDelete(book.id, isPermanent);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 dark:bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#0F172A] border border-rose-200 dark:border-rose-900/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150 animate-delete-shake"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400 font-semibold">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="font-header text-sm sm:text-base font-bold text-[#F1F5F9]">
                Delete Book from Library
              </h3>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono-code font-normal">
                ACTION: CATALOG DE-REGISTRATION
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Book Summary Card */}
          <div className="flex gap-4 p-3.5 bg-slate-50 dark:bg-[#020617] rounded-xl border border-slate-200 dark:border-[#1E293B]">
            {/* Book Cover Thumbnail */}
            <div 
              data-preserve-dark="true"
              className="w-16 h-22 shrink-0 rounded-md overflow-hidden bg-slate-800 border border-slate-700 shadow-sm relative flex flex-col justify-between p-1.5"
            >
              {book.book_image_path ? (
                <img
                  src={book.book_image_path}
                  alt={book.book_name}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 z-10" />
              <div className="relative z-0 h-full flex flex-col justify-between text-[7px] leading-tight select-none">
                <span className="font-mono-code text-[6.5px] text-amber-300 font-bold uppercase tracking-wider pl-1">
                  ULM PRESS
                </span>
                <span data-preserve-white="true" className="font-header text-[7.5px] font-bold text-[#F1F5F9] line-clamp-3 pl-1">
                  {book.book_name}
                </span>
                <span className="text-[6.5px] font-mono-code text-slate-300 pl-1">
                  {book.dewey_call_number}
                </span>
              </div>
            </div>

            {/* Book Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {book.category}
                </span>
                <h4 className="font-header text-sm font-bold text-[#F1F5F9] mt-1 line-clamp-2 leading-snug">
                  {book.book_name}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  by <span className="text-slate-800 dark:text-slate-300 font-medium">{book.author}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono-code mt-1.5">
                <span>Barcode: <strong className="text-slate-800 dark:text-slate-200">{book.barcode}</strong></span>
                <span>•</span>
                <span>{book.total_quantity} Total Copies</span>
              </div>
            </div>
          </div>

          {/* Active Loans Alert (Blocking) */}
          {hasActiveLoans ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                <AlertOctagon className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold uppercase tracking-wider">
                    Cannot Delete: Active Copies Checked Out
                  </h5>
                  <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                    There are <strong>{activeLoans.length} copies</strong> of this title currently issued to borrowers. In accordance with university library policy, you must return all copies at the Circulation Desk before removing this book from the catalog.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pl-7">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Current Borrowers:</p>
                {activeLoans.map(loan => (
                  <div key={loan.id} className="flex items-center justify-between text-xs bg-slate-900/60 dark:bg-black/40 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{loan.borrower_name} ({loan.student_id})</span>
                    <span className="font-mono-code text-[11px] text-amber-700 dark:text-amber-400">Due: {loan.due_date}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Deletion Mode Selector */
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Choose the desired deletion policy for this book record:
              </p>

              <div className="space-y-2.5">
                {/* Option 1: Soft Delete (Archive) */}
                <label 
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    !isPermanent 
                      ? 'bg-amber-500/10 border-amber-500/40 text-[#F1F5F9] shadow-2xs' 
                      : 'bg-slate-50 dark:bg-[#020617] border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={!isPermanent}
                    onChange={() => setIsPermanent(false)}
                    className="mt-0.5 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="space-y-0.5 flex-1 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-[#F1F5F9]">
                      <Archive className="w-3.5 h-3.5 text-amber-500" />
                      <span>Archive & Remove from Catalog (Recommended)</span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-normal">
                      Removes title from catalog search and active circulation, but safely preserves past checkout logs and audit history in SQLite.
                    </p>
                  </div>
                </label>

                {/* Option 2: Permanent Purge */}
                <label 
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isPermanent 
                      ? 'bg-rose-500/10 border-rose-500/50 text-[#F1F5F9] shadow-2xs' 
                      : 'bg-slate-50 dark:bg-[#020617] border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={isPermanent}
                    onChange={() => setIsPermanent(true)}
                    className="mt-0.5 text-rose-500 focus:ring-rose-500"
                  />
                  <div className="space-y-0.5 flex-1 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Permanent Database Purge</span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-normal">
                      Permanently wipes the book and its uploaded cover data from SQLite. This operation cannot be undone.
                    </p>
                  </div>
                </label>
              </div>

              {/* Extra confirmation safeguard for permanent deletion */}
              {isPermanent && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Permanent Purge Safeguard</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    To confirm permanent deletion, type <code className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950 font-mono-code font-bold text-rose-800 dark:text-rose-300 rounded">DELETE</code> below:
                  </p>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="w-full bg-[#020617] border border-rose-300 dark:border-rose-900 rounded-lg px-3 py-1.5 text-xs font-mono-code text-[#F1F5F9] placeholder:text-slate-400 focus:outline-hidden focus:border-rose-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#020617] border-t border-slate-200 dark:border-[#1E293B] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={hasActiveLoans || (isPermanent && confirmInput.trim().toUpperCase() !== 'DELETE')}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 tracking-wide transition-all cursor-pointer shadow-md ${
              hasActiveLoans || (isPermanent && confirmInput.trim().toUpperCase() !== 'DELETE')
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-[#F1F5F9] shadow-rose-600/30'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{isPermanent ? 'Purge Book Record' : 'Confirm Delete Book'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
