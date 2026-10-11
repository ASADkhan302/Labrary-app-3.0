import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  BookOpen,
  User,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Barcode,
  Layers,
  UserPlus,
  RefreshCw,
  Library,
  MapPin,
  CalendarDays,
  ShieldCheck,
  Check,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { Book, Borrower, Transaction, BorrowerRole } from '../../types/library';
import { LibraryStorage } from '../../services/storage';
import { playClickSound, playSuccessBarcodeBeep, playErrorBeep } from '../../services/audio';

export interface IssueBookFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Starting pre-selections
  initialBook?: Book | null;
  initialBorrower?: Borrower | null;
  // App data
  books: Book[];
  borrowers: Borrower[];
  transactions: Transaction[];
  // Issue executor
  onIssueBook: (bookId: string, borrowerId: string, daysOrDueDate: number | string) => { success: boolean; message: string; transaction?: Transaction } | void;
  // Fallback to open Add Borrower Modal inside flow
  onOpenAddBorrower?: () => void;
  // Newly registered borrower hook
  newlyRegisteredBorrower?: Borrower | null;
}

type FlowStep = 'person' | 'book' | 'time' | 'confirm';

export const IssueBookFlowModal: React.FC<IssueBookFlowModalProps> = ({
  isOpen,
  onClose,
  initialBook,
  initialBorrower,
  books,
  borrowers,
  transactions,
  onIssueBook,
  onOpenAddBorrower,
  newlyRegisteredBorrower,
}) => {
  // Pre-selected state
  const [selectedBook, setSelectedBook] = useState<Book | null>(initialBook || null);
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(initialBorrower || null);
  const [selectedCopyBarcode, setSelectedCopyBarcode] = useState<string>('');

  // Flow determination
  // If book is chosen, flow is: person -> time -> confirm
  // If borrower is chosen, flow is: book -> time -> confirm
  // If neither, flow is: book -> person -> time -> confirm (or person -> book)
  const initialMode = useMemo<'book-first' | 'person-first' | 'neither'>(() => {
    if (initialBook && !initialBorrower) return 'book-first';
    if (initialBorrower && !initialBook) return 'person-first';
    return 'neither';
  }, [initialBook, initialBorrower]);

  const [currentStep, setCurrentStep] = useState<FlowStep>('book');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Search queries
  const [personSearch, setPersonSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');

  // Time step state
  const [presetDays, setPresetDays] = useState<number>(14);
  const [customDueDate, setCustomDueDate] = useState<string>('');
  const [isCustomDate, setIsCustomDate] = useState(false);

  // Input refs for barcode scanning
  const personSearchInputRef = useRef<HTMLInputElement>(null);
  const bookSearchInputRef = useRef<HTMLInputElement>(null);

  // Today ISO
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Sync props when modal opens or initialBook/initialBorrower changes
  useEffect(() => {
    if (isOpen) {
      const initB = initialBook || null;
      const initP = initialBorrower || null;
      setSelectedBook(initB);
      setSelectedBorrower(initP);
      setSelectedCopyBarcode(initB?.barcode || '');
      setActionError(null);
      setIsSubmitting(false);

      if (initB && !initP) {
        // Book already chosen -> select person
        setCurrentStep('person');
      } else if (initP && !initB) {
        // Person already chosen -> select book
        setCurrentStep('book');
      } else if (initB && initP) {
        // Both chosen -> go to time
        setCurrentStep('time');
      } else {
        // Neither chosen -> start with person or book. Catalog-first feels natural
        setCurrentStep('book');
      }

      // Default presets based on borrower role if known
      if (initP?.role === 'Faculty') {
        setPresetDays(30);
      } else {
        setPresetDays(14);
      }
      setIsCustomDate(false);
      setCustomDueDate('');
      setPersonSearch('');
      setBookSearch('');
    }
  }, [isOpen, initialBook, initialBorrower]);

  // If a newly registered borrower was passed in
  useEffect(() => {
    if (newlyRegisteredBorrower && isOpen) {
      setSelectedBorrower(newlyRegisteredBorrower);
      // If book is also chosen, advance to time
      if (selectedBook) {
        setCurrentStep('time');
      } else {
        setCurrentStep('book');
      }
    }
  }, [newlyRegisteredBorrower, isOpen]);

  // Auto-focus search input on step switch
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (currentStep === 'person') {
        personSearchInputRef.current?.focus();
      } else if (currentStep === 'book') {
        bookSearchInputRef.current?.focus();
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [currentStep, isOpen]);

  // When selected borrower changes, update preset days default
  useEffect(() => {
    if (selectedBorrower) {
      if (selectedBorrower.role === 'Faculty') {
        setPresetDays(30);
      } else if (selectedBorrower.role === 'Staff') {
        setPresetDays(21);
      } else {
        setPresetDays(14);
      }
    }
  }, [selectedBorrower]);

  // Compute calculated due date
  const calculatedDueDate = useMemo(() => {
    if (isCustomDate && customDueDate) {
      return customDueDate;
    }
    const d = new Date();
    d.setDate(d.getDate() + presetDays);
    return d.toISOString().split('T')[0];
  }, [presetDays, isCustomDate, customDueDate]);

  // Format readable date
  const formatReadableDate = (iso: string) => {
    try {
      const parts = iso.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return iso;
    } catch {
      return iso;
    }
  };

  // Helper: check borrower eligibility
  const checkBorrowerEligibility = (borrower: Borrower): {
    eligible: boolean;
    reason: string | null;
    activeLoansCount?: number;
    limit?: number;
    overdueCount?: number;
    unpaidFineTotal?: number;
  } => {
    // 1. Status
    if (borrower.status !== 'active') {
      return { eligible: false, reason: `Status: ${borrower.status.toUpperCase()} (Suspended/Inactive)` };
    }
    // 2. Expired valid_until
    if (borrower.valid_until && borrower.valid_until < todayStr) {
      return { eligible: false, reason: `Expired card (Valid until: ${borrower.valid_until})` };
    }
    // 3. Borrow limit
    const activeLoans = transactions.filter(t => t.borrower_id === borrower.id && t.status !== 'RETURNED');
    const limit = borrower.borrow_limit || (borrower.role === 'Faculty' ? 10 : borrower.role === 'Staff' ? 5 : 3);
    if (activeLoans.length >= limit) {
      return { eligible: false, reason: `Borrow limit reached (${activeLoans.length}/${limit} books)` };
    }
    // 4. Overdue and fines
    const fineRate = 50;
    const maxUnpaidFine = 500;
    let unpaidFineTotal = 0;
    let overdueCount = 0;
    activeLoans.forEach(loan => {
      if (loan.due_date < todayStr) {
        overdueCount++;
        const diffMs = new Date(todayStr).getTime() - new Date(loan.due_date).getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (days > 0) unpaidFineTotal += days * fineRate;
      }
    });

    if (unpaidFineTotal > maxUnpaidFine) {
      return { eligible: false, reason: `Unpaid fines Rs ${unpaidFineTotal} exceed limit (Rs ${maxUnpaidFine})` };
    }

    return {
      eligible: true,
      activeLoansCount: activeLoans.length,
      limit,
      overdueCount,
      unpaidFineTotal,
      reason: null
    };
  };

  // Filtered borrowers list
  const filteredBorrowers = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return borrowers.slice(0, 30);
    return borrowers.filter(b => {
      const matchName = b.name.toLowerCase().includes(q);
      const matchId = (b.university_id || b.student_id || '').toLowerCase().includes(q);
      const matchBarcode = (b.barcode || '').toLowerCase().includes(q);
      const matchPhone = (b.phone || '').toLowerCase().includes(q);
      const matchEmail = (b.email || '').toLowerCase().includes(q);
      const matchRoll = (b.roll_number || '').toLowerCase().includes(q);
      const matchUrdu = (b.name_urdu || '').includes(personSearch.trim());
      return matchName || matchId || matchBarcode || matchPhone || matchEmail || matchRoll || matchUrdu;
    }).slice(0, 40);
  }, [borrowers, personSearch]);

  // Filtered books list
  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    if (!q) return books.slice(0, 30);
    return books.filter(b => {
      const matchTitle = b.book_name.toLowerCase().includes(q);
      const matchAuthor = (b.author || '').toLowerCase().includes(q);
      const matchBarcode = (b.barcode || '').toLowerCase().includes(q);
      const matchIsbn = (b.isbn || '').toLowerCase().includes(q);
      const matchAcc = (b.accession_no || '').toLowerCase().includes(q);
      return matchTitle || matchAuthor || matchBarcode || matchIsbn || matchAcc;
    }).slice(0, 40);
  }, [books, bookSearch]);

  // Find due back date for out-of-stock books
  const getBookNextDueBack = (bookId: string) => {
    const active = transactions.filter(t => t.book_id === bookId && t.status !== 'RETURNED');
    if (!active.length) return null;
    const sorted = [...active].sort((a, b) => a.due_date.localeCompare(b.due_date));
    return sorted[0].due_date;
  };

  // Barcode scan Enter handler in Person Search
  const handlePersonSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = personSearch.trim().toLowerCase();
      if (!q) return;
      // Exact match first
      const exact = borrowers.find(b => 
        (b.barcode && b.barcode.toLowerCase() === q) || 
        (b.university_id && b.university_id.toLowerCase() === q) ||
        (b.student_id && b.student_id.toLowerCase() === q)
      );
      if (exact) {
        const check = checkBorrowerEligibility(exact);
        if (check.eligible) {
          playSuccessBarcodeBeep();
          setSelectedBorrower(exact);
          if (selectedBook) {
            setCurrentStep('time');
          } else {
            setCurrentStep('book');
          }
        } else {
          playErrorBeep();
          setActionError(`Member ${exact.name} cannot borrow: ${check.reason}`);
        }
      }
    }
  };

  // Barcode scan Enter handler in Book Search
  const handleBookSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = bookSearch.trim().toLowerCase();
      if (!q) return;
      const exact = books.find(b => 
        (b.barcode && b.barcode.toLowerCase() === q) || 
        (b.isbn && b.isbn.toLowerCase() === q) ||
        (b.accession_no && b.accession_no.toLowerCase() === q)
      );
      if (exact) {
        if (exact.available_quantity > 0) {
          playSuccessBarcodeBeep();
          setSelectedBook(exact);
          setSelectedCopyBarcode(exact.barcode);
          if (selectedBorrower) {
            setCurrentStep('time');
          } else {
            setCurrentStep('person');
          }
        } else {
          playErrorBeep();
          const dueBack = getBookNextDueBack(exact.id);
          setActionError(`All copies of "${exact.book_name}" are issued${dueBack ? ` (due back ${formatReadableDate(dueBack)})` : ''}.`);
        }
      }
    }
  };

  // Execute issue transaction
  const handleConfirmIssue = async () => {
    if (isSubmitting) return;
    if (!selectedBook) {
      setActionError('Please select a book to issue.');
      setCurrentStep('book');
      return;
    }
    if (!selectedBorrower) {
      setActionError('Please select a member to issue the book to.');
      setCurrentStep('person');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const dueParam = isCustomDate && customDueDate ? customDueDate : presetDays;
      const result = onIssueBook(selectedBook.id, selectedBorrower.id, dueParam);

      if (result && typeof result === 'object' && result.success === false) {
        playErrorBeep();
        setActionError(result.message || 'Issue operation failed.');
        setIsSubmitting(false);
        return;
      }

      playSuccessBarcodeBeep();
      onClose();
    } catch (err: any) {
      playErrorBeep();
      setActionError(err.message || 'Unexpected error while processing loan.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#141214] border border-[#BC881B]/40 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh] select-none text-[#E7E2EC]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gold Hairline */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#BC881B] to-transparent shrink-0" />

        {/* 1. Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#1A1A1A] border-b border-[#2E2A33] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#BC881B]/15 border border-[#BC881B]/40 flex items-center justify-center text-[#E0B450] shrink-0 shadow-inner">
              <BookOpen className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-wide text-white font-cinzel">
                  Issue Book to Member
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#BC881B]/15 text-[#E0B450] border border-[#BC881B]/30 font-semibold">
                  CIRCULATION
                </span>
              </div>
              <p className="text-[12px] text-[#B3AABD] mt-0.5">
                Central Campus Library · Universal Loan Dispatch Flow
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Close dialog"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Step Navigator Tabs */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#171517] border-b border-[#2E2A33] flex items-center justify-between gap-2 overflow-x-auto">
          {/* Step 1: Book */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setCurrentStep('book');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 'book'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : selectedBook
                ? 'text-[#34D399] hover:bg-white/[0.05]'
                : 'text-[#8B719B] hover:text-[#B3AABD]'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
              selectedBook ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40' : 'bg-white/10 text-white'
            }`}>
              {selectedBook ? '✓' : '1'}
            </span>
            <span>Book</span>
            {selectedBook && (
              <span className="text-[10px] text-white/50 max-w-[120px] truncate hidden sm:inline">
                ({selectedBook.book_name})
              </span>
            )}
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />

          {/* Step 2: Member */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setCurrentStep('person');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 'person'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : selectedBorrower
                ? 'text-[#34D399] hover:bg-white/[0.05]'
                : 'text-[#8B719B] hover:text-[#B3AABD]'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
              selectedBorrower ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40' : 'bg-white/10 text-white'
            }`}>
              {selectedBorrower ? '✓' : '2'}
            </span>
            <span>Member</span>
            {selectedBorrower && (
              <span className="text-[10px] text-white/50 max-w-[120px] truncate hidden sm:inline">
                ({selectedBorrower.name})
              </span>
            )}
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />

          {/* Step 3: Time / Duration */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setCurrentStep('time');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 'time'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : 'text-[#8B719B] hover:text-[#B3AABD]'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold bg-white/10 text-white">
              3
            </span>
            <span>Duration</span>
            <span className="text-[10px] text-[#E0B450] hidden sm:inline font-mono">
              ({isCustomDate ? customDueDate || 'Custom' : `${presetDays}d`})
            </span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />

          {/* Step 4: Confirm */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setCurrentStep('confirm');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 'confirm'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : 'text-[#8B719B] hover:text-[#B3AABD]'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold bg-white/10 text-white">
              4
            </span>
            <span>Review & Issue</span>
          </button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-rose-300 hover:text-white text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 3. Main Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* ================= STEP: BOOK ================= */}
          {currentStep === 'book' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#E0B450]" />
                    <span>Select Book Title</span>
                  </h3>
                  <p className="text-xs text-[#B3AABD] mt-0.5">
                    Scan book barcode or search by title, author, ISBN or accession number.
                  </p>
                </div>

                {selectedBook && (
                  <div className="flex items-center gap-2 bg-[#BC881B]/15 px-3 py-1 rounded-lg border border-[#BC881B]/30 text-xs">
                    <span className="text-[#B3AABD]">Selected:</span>
                    <span className="text-[#E0B450] font-bold truncate max-w-[200px]">
                      {selectedBook.book_name}
                    </span>
                  </div>
                )}
              </div>

              {/* Search / Scan Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#8B719B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={bookSearchInputRef}
                  type="text"
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  onKeyDown={handleBookSearchKeyDown}
                  placeholder="Scan book barcode (e.g. ULM-0001) or search title / author / ISBN..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#2E2A33] focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] rounded-xl text-xs sm:text-sm text-white placeholder-[#8B719B] transition-all outline-none"
                />
              </div>

              {/* Books Live List */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredBooks.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#8B719B] bg-[#1A1A1A]/40 rounded-xl border border-dashed border-[#2E2A33]">
                    No matching books found in catalog. Try another title or barcode.
                  </div>
                ) : (
                  filteredBooks.map((b) => {
                    const isAvail = b.available_quantity > 0;
                    const isSelected = selectedBook?.id === b.id;
                    const dueBack = !isAvail ? getBookNextDueBack(b.id) : null;

                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          if (!isAvail) return;
                          playClickSound();
                          setSelectedBook(b);
                          setSelectedCopyBarcode(b.barcode);
                          setActionError(null);
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#BC881B]/15 border-[#BC881B] shadow-[0_2px_12px_rgba(188,136,27,0.25)]'
                            : isAvail
                            ? 'bg-[#1A1A1A] border-[#2E2A33] hover:border-[#BC881B]/50 hover:bg-[#201D22] cursor-pointer'
                            : 'bg-[#171517] border-[#252229] opacity-60 cursor-not-allowed'
                        }`}
                      >
                        {/* Book Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          {b.book_image_path ? (
                            <img
                              src={b.book_image_path}
                              alt=""
                              className="w-10 h-14 object-cover rounded-md border border-white/10 shrink-0 bg-black/40"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-md bg-[#2B1538] border border-[#A66BC9]/30 flex items-center justify-center text-[#E0B450] font-bold text-xs shrink-0">
                              {b.book_name.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                                {b.book_name}
                              </h4>
                              {b.accession_no && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-[#B3AABD] border border-white/10">
                                  #{b.accession_no}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#B3AABD] truncate mt-0.5">
                              {b.author} · <span className="font-mono">{b.barcode}</span>
                            </p>
                            <p className="text-[10px] text-[#8B719B] mt-0.5 flex items-center gap-2">
                              <span>Almari: {b.almari_id || 'Main'}</span>
                              <span>·</span>
                              <span>Shelf: {b.shelf || '1'}</span>
                            </p>
                          </div>
                        </div>

                        {/* Availability Pill / Status */}
                        <div className="text-right shrink-0">
                          {isAvail ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                                Available ({b.available_quantity} {b.available_quantity === 1 ? 'copy' : 'copies'})
                              </span>
                              {isSelected && (
                                <span className="text-[10px] font-semibold text-[#E0B450] flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Selected
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                                All copies issued
                              </span>
                              {dueBack && (
                                <span className="text-[10px] text-[#8B719B] font-mono">
                                  Due back: {formatReadableDate(dueBack)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Specific copy selector if title has copies */}
              {selectedBook && selectedBook.available_quantity > 1 && (
                <div className="p-3 bg-[#1A1A1A] border border-[#2E2A33] rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-[#E0B450]" />
                    <span className="text-[#B3AABD]">Selected Copy Barcode:</span>
                    <span className="font-mono font-bold text-white">{selectedCopyBarcode || selectedBook.barcode}</span>
                  </div>
                  <div className="text-[11px] text-[#8B719B]">
                    Primary shelf copy assigned
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP: PERSON ================= */}
          {currentStep === 'person' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-[#E0B450]" />
                    <span>Select Registered Member</span>
                  </h3>
                  <p className="text-xs text-[#B3AABD] mt-0.5">
                    Scan member barcode or search by name, University ID, phone or email.
                  </p>
                </div>

                {onOpenAddBorrower && (
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      onOpenAddBorrower();
                    }}
                    className="h-8 px-3 rounded-lg bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-xs border border-[#A66BC9]/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Register new student or staff"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#C084FC]" />
                    <span>Register New Person</span>
                  </button>
                )}
              </div>

              {/* Search / Scan Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#8B719B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={personSearchInputRef}
                  type="text"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  onKeyDown={handlePersonSearchKeyDown}
                  placeholder="Scan member card barcode or search student ID, name, phone, roll #..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#2E2A33] focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B] rounded-xl text-xs sm:text-sm text-white placeholder-[#8B719B] transition-all outline-none"
                />
              </div>

              {/* Borrowers Live List */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredBorrowers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#8B719B] bg-[#1A1A1A]/40 rounded-xl border border-dashed border-[#2E2A33]">
                    No members found. Use [Register New Person] to add an account.
                  </div>
                ) : (
                  filteredBorrowers.map((b) => {
                    const eligibility = checkBorrowerEligibility(b);
                    const isSelected = selectedBorrower?.id === b.id;

                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          if (!eligibility.eligible) {
                            playErrorBeep();
                            setActionError(`Member cannot borrow: ${eligibility.reason}`);
                            return;
                          }
                          playClickSound();
                          setSelectedBorrower(b);
                          setActionError(null);
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#BC881B]/15 border-[#BC881B] shadow-[0_2px_12px_rgba(188,136,27,0.25)]'
                            : eligibility.eligible
                            ? 'bg-[#1A1A1A] border-[#2E2A33] hover:border-[#BC881B]/50 hover:bg-[#201D22] cursor-pointer'
                            : 'bg-[#171517] border-[#252229] opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {/* Member Portrait + Identity */}
                        <div className="flex items-center gap-3 min-w-0">
                          {b.photo_url || b.photo_path ? (
                            <img
                              src={b.photo_url || b.photo_path}
                              alt=""
                              className="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0 bg-black/40"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-[#541A72] border border-[#A66BC9]/30 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {b.name.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                                {b.name}
                              </h4>
                              {b.name_urdu && (
                                <span className="font-urdu text-xs text-[#E0B450] hidden sm:inline" dir="rtl">
                                  {b.name_urdu}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/[0.08] text-[#B3AABD]">
                                {b.role}
                              </span>
                            </div>

                            <p className="text-[11px] text-[#B3AABD] truncate mt-0.5">
                              <span className="font-mono text-white">{b.university_id || b.student_id}</span>
                              {b.roll_number && <span> · Roll: {b.roll_number}</span>}
                              <span> · {b.department}</span>
                            </p>

                            <p className="text-[10px] text-[#8B719B] mt-0.5">
                              Phone: {b.phone} · Valid: {b.valid_until || 'Indefinite'}
                            </p>
                          </div>
                        </div>

                        {/* Loan Stats / Reason */}
                        <div className="text-right shrink-0">
                          {eligibility.eligible ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[11px] font-mono text-[#34D399] font-bold">
                                Books on loan: {eligibility.activeLoansCount} / {eligibility.limit}
                              </span>
                              {(eligibility.overdueCount ?? 0) > 0 ? (
                                <span className="text-[10px] text-amber-400 font-semibold">
                                  {eligibility.overdueCount} overdue item
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#8B719B]">
                                  Good standing
                                </span>
                              )}
                              {isSelected && (
                                <span className="text-[10px] font-semibold text-[#E0B450] flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Selected
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <AlertTriangle className="w-3 h-3" /> Blocked
                              </span>
                              <span className="text-[10px] text-rose-300 max-w-[170px] truncate" title={eligibility.reason || ''}>
                                {eligibility.reason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= STEP: TIME ================= */}
          {currentStep === 'time' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#E0B450]" />
                  <span>Loan Period & Due Date Calculation</span>
                </h3>
                <p className="text-xs text-[#B3AABD] mt-0.5">
                  Select predefined circulation duration or choose a specific calendar due date.
                </p>
              </div>

              {/* Today Info Card */}
              <div className="p-4 bg-[#1A1A1A] border border-[#2E2A33] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#E0B450]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#B3AABD] uppercase tracking-wider font-semibold">
                      Issue Date (Today)
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      {formatReadableDate(todayStr)}
                    </h4>
                  </div>
                </div>

                <div className="sm:text-right border-t sm:border-t-0 border-[#2E2A33] pt-2 sm:pt-0">
                  <span className="text-[11px] text-[#B3AABD] uppercase tracking-wider font-semibold">
                    Target Due Date
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-[#E0B450] font-mono">
                    {formatReadableDate(calculatedDueDate)}
                  </h4>
                </div>
              </div>

              {/* Preset Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#E7E2EC] block">
                  Quick Duration Presets
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 7 Days */}
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setIsCustomDate(false);
                      setPresetDays(7);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      !isCustomDate && presetDays === 7
                        ? 'bg-[#BC881B]/20 border-[#BC881B] shadow-[0_2px_12px_rgba(188,136,27,0.3)]'
                        : 'bg-[#1A1A1A] border-[#2E2A33] hover:border-[#BC881B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">7 Days</span>
                      {!isCustomDate && presetDays === 7 && (
                        <Check className="w-4 h-4 text-[#E0B450]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#B3AABD] mt-1">
                      Course reserve / Exam fast return
                    </p>
                  </button>

                  {/* 14 Days */}
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setIsCustomDate(false);
                      setPresetDays(14);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      !isCustomDate && presetDays === 14
                        ? 'bg-[#BC881B]/20 border-[#BC881B] shadow-[0_2px_12px_rgba(188,136,27,0.3)]'
                        : 'bg-[#1A1A1A] border-[#2E2A33] hover:border-[#BC881B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">14 Days</span>
                      {!isCustomDate && presetDays === 14 && (
                        <Check className="w-4 h-4 text-[#E0B450]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#B3AABD] mt-1">
                      Standard undergraduate borrowing
                    </p>
                  </button>

                  {/* 30 Days */}
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setIsCustomDate(false);
                      setPresetDays(30);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      !isCustomDate && presetDays === 30
                        ? 'bg-[#BC881B]/20 border-[#BC881B] shadow-[0_2px_12px_rgba(188,136,27,0.3)]'
                        : 'bg-[#1A1A1A] border-[#2E2A33] hover:border-[#BC881B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">30 Days</span>
                      {!isCustomDate && presetDays === 30 && (
                        <Check className="w-4 h-4 text-[#E0B450]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#B3AABD] mt-1">
                      Faculty & postgraduate research
                    </p>
                  </button>
                </div>
              </div>

              {/* Custom Date Picker */}
              <div className="p-4 bg-[#1A1A1A] border border-[#2E2A33] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#E0B450]" />
                    <span>Or Pick a Custom Due Date</span>
                  </label>
                  {isCustomDate && (
                    <button
                      type="button"
                      onClick={() => setIsCustomDate(false)}
                      className="text-[11px] text-[#BC881B] hover:underline cursor-pointer"
                    >
                      Revert to preset
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="date"
                    min={todayStr}
                    value={customDueDate || calculatedDueDate}
                    onChange={(e) => {
                      setCustomDueDate(e.target.value);
                      setIsCustomDate(true);
                    }}
                    className="w-full sm:w-auto flex-1 px-4 py-2.5 bg-[#141214] border border-[#2E2A33] focus:border-[#BC881B] rounded-xl text-xs sm:text-sm text-white outline-none cursor-pointer"
                  />
                  <div className="text-xs text-[#B3AABD] self-start sm:self-center">
                    Must be later than today ({formatReadableDate(todayStr)})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP: CONFIRM ================= */}
          {currentStep === 'confirm' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#E0B450]" />
                  <span>Review Loan Transaction Summary</span>
                </h3>
                <p className="text-xs text-[#B3AABD] mt-0.5">
                  Verify book, borrower and due date before writing the official transaction to the ledger.
                </p>
              </div>

              {/* Summary Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Book Summary Card */}
                <div className="p-4 bg-[#1A1A1A] border border-[#2E2A33] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#E0B450] uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Book Volume
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('book')}
                      className="text-[11px] text-[#B3AABD] hover:text-[#E0B450] underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {selectedBook ? (
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-white leading-tight">
                        {selectedBook.book_name}
                      </h4>
                      <p className="text-xs text-[#B3AABD]">
                        Author: {selectedBook.author}
                      </p>
                      <div className="pt-2 border-t border-[#2E2A33] flex items-center justify-between text-[11px]">
                        <span className="text-[#8B719B]">Barcode:</span>
                        <span className="font-mono text-white font-semibold">
                          {selectedCopyBarcode || selectedBook.barcode}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#8B719B]">Shelf Placement:</span>
                        <span className="text-[#B3AABD]">
                          Almari {selectedBook.almari_id || 'Main'} · Shelf {selectedBook.shelf || '1'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#8B719B]">Inventory Impact:</span>
                        <span className="text-[#34D399] font-mono font-semibold">
                          {selectedBook.available_quantity} → {selectedBook.available_quantity - 1} available
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-300 py-3">
                      No book chosen. Please go back to Step 1.
                    </div>
                  )}
                </div>

                {/* Borrower Summary Card */}
                <div className="p-4 bg-[#1A1A1A] border border-[#2E2A33] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#E0B450] uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Member Account
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('person')}
                      className="text-[11px] text-[#B3AABD] hover:text-[#E0B450] underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {selectedBorrower ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white leading-tight">
                          {selectedBorrower.name}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/[0.08] text-[#B3AABD]">
                          {selectedBorrower.role}
                        </span>
                      </div>
                      {selectedBorrower.name_urdu && (
                        <p className="font-urdu text-xs text-[#E0B450]" dir="rtl">
                          {selectedBorrower.name_urdu}
                        </p>
                      )}
                      <div className="pt-2 border-t border-[#2E2A33] flex items-center justify-between text-[11px]">
                        <span className="text-[#8B719B]">University ID:</span>
                        <span className="font-mono text-white font-semibold">
                          {selectedBorrower.university_id || selectedBorrower.student_id}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#8B719B]">Department:</span>
                        <span className="text-[#B3AABD]">
                          {selectedBorrower.department}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#8B719B]">Phone Contact:</span>
                        <span className="text-[#B3AABD] font-mono">
                          {selectedBorrower.phone}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-300 py-3">
                      No member chosen. Please go back to Step 2.
                    </div>
                  )}
                </div>
              </div>

              {/* Time Schedule Banner */}
              <div className="p-4 bg-[#1A1A1A] border border-[#BC881B]/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#BC881B]/20 border border-[#BC881B]/40 flex items-center justify-center text-[#E0B450]">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#B3AABD] uppercase tracking-wider font-semibold">
                      Loan Due Date Schedule
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-[#E0B450] font-mono">
                      Due on {formatReadableDate(calculatedDueDate)} ({isCustomDate ? 'Custom Date' : `${presetDays} days`})
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep('time')}
                  className="text-xs text-[#B3AABD] hover:text-[#E0B450] underline cursor-pointer self-start sm:self-center"
                >
                  Adjust time
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Footer Actions */}
        <div className="px-5 sm:px-6 py-4 bg-[#1A1A1A] border-t border-[#2E2A33] flex items-center justify-between gap-3 shrink-0">
          <div>
            {currentStep !== 'book' && (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  if (currentStep === 'confirm') setCurrentStep('time');
                  else if (currentStep === 'time') setCurrentStep(selectedBorrower ? 'person' : 'book');
                  else if (currentStep === 'person') setCurrentStep('book');
                }}
                className="h-10 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#E7E2EC] font-semibold text-xs border border-white/[0.1] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-transparent hover:bg-white/[0.06] text-[#B3AABD] hover:text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {currentStep !== 'confirm' ? (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  if (currentStep === 'book') {
                    if (!selectedBook) {
                      setActionError('Please select a book from the list first.');
                      return;
                    }
                    setCurrentStep('person');
                  } else if (currentStep === 'person') {
                    if (!selectedBorrower) {
                      setActionError('Please select a member first.');
                      return;
                    }
                    setCurrentStep('time');
                  } else if (currentStep === 'time') {
                    setCurrentStep('confirm');
                  }
                }}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-xs shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmIssue}
                disabled={isSubmitting || !selectedBook || !selectedBorrower}
                className="h-10 px-6 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-xs shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Transaction...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Issue Book</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
