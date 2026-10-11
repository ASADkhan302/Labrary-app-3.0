import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Search, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  ArrowRightLeft, 
  RotateCcw, 
  Printer, 
  PlusCircle, 
  Barcode as BarcodeIcon,
  MapPin,
  Eye
} from 'lucide-react';
import { Book, Transaction } from '../types/library';
import { playSuccessBarcodeBeep, playErrorBeep } from '../services/audio';

interface BarcodeScannerViewProps {
  books: Book[];
  transactions: Transaction[];
  onOpenBookDetails: (bookId: string) => void;
  onQuickLoan: (book: Book) => void;
  onQuickReturn: (transactionId: string) => void;
  onPrintBarcode: (book: Book) => void;
  onOpenAddBookWithBarcode: (barcode: string) => void;
}

export const BarcodeScannerView: React.FC<BarcodeScannerViewProps> = ({
  books,
  transactions,
  onOpenBookDetails,
  onQuickLoan,
  onQuickReturn,
  onPrintBarcode,
  onOpenAddBookWithBarcode,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [searchedBarcode, setSearchedBarcode] = useState<string | null>(null);
  const [foundBook, setFoundBook] = useState<Book | null>(null);
  const [scanState, setScanState] = useState<'IDLE' | 'FOUND' | 'NOT_FOUND'>('IDLE');
  const [isScanSuccessFlash, setIsScanSuccessFlash] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on mount and whenever returning to idle
  useEffect(() => {
    inputRef.current?.focus();
  }, [scanState]);

  const handleSearch = (codeToSearch: string) => {
    const cleanCode = codeToSearch.trim();
    if (!cleanCode) return;

    setSearchedBarcode(cleanCode);

    const book = books.find(b => b.barcode.trim() === cleanCode && b.is_active);

    if (book) {
      setFoundBook(book);
      setScanState('FOUND');
      setIsScanSuccessFlash(true);
      setTimeout(() => setIsScanSuccessFlash(false), 300);
      if (soundEnabled) {
        playSuccessBarcodeBeep();
      }
    } else {
      setFoundBook(null);
      setScanState('NOT_FOUND');
      if (soundEnabled) {
        playErrorBeep();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(barcodeInput);
  };

  const handleTestScan = (testBarcode: string) => {
    setBarcodeInput(testBarcode);
    handleSearch(testBarcode);
  };

  const resetScanner = () => {
    setBarcodeInput('');
    setSearchedBarcode(null);
    setFoundBook(null);
    setScanState('IDLE');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const activeLoans = foundBook 
    ? transactions.filter(t => t.book_id === foundBook.id && t.status !== 'RETURNED')
    : [];

  return (
    <div className="flex-1 w-full bg-fluent-matrix px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-y-auto space-y-6">
      <div className="max-w-[1280px] mx-auto space-y-6">

        {/* Top Header Card */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-xl p-4 sm:p-5 shadow-2xs transition-colors">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#F1F5F9] flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-500" />
              <span>Barcode Scanner & Hardware Station</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports standard USB HID barcode guns (Code 128, EAN-13, ISBN) and manual entry.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                soundEnabled 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300' 
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Chirp: {soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setAutoSubmit(!autoSubmit)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                autoSubmit 
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300' 
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              <span>Auto-Enter: {autoSubmit ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Scanner Laser Input Centerpiece */}
        <div className={`bg-[#0F172A] border-2 border-slate-200 dark:border-[#1E293B] focus-within:border-amber-500 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden transition-all ${
          isScanSuccessFlash ? 'scan-flash-success' : ''
        }`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                POINT USB SCANNER OR TYPE BARCODE
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hardware listener active for 13-digit EAN/ISBN scan termination.
              </p>
            </div>

            <div className="max-w-xl mx-auto flex items-center bg-[#020617] border-2 border-[#334155] focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-xl p-1.5 transition-all shadow-md barcode-scan-wrapper">
              <BarcodeIcon className="w-5 h-5 text-amber-500/80 ml-3 shrink-0 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => {
                  setBarcodeInput(e.target.value);
                  if (autoSubmit && e.target.value.length >= 13) {
                    handleSearch(e.target.value);
                  }
                }}
                placeholder="[ Scan barcode or enter 13-digit number ]"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  outline: 'none',
                }}
                className="flex-1 h-11 bg-transparent border-0 text-center text-base sm:text-lg font-mono font-bold text-[#F1F5F9] placeholder:text-slate-500 tracking-wider focus:outline-none focus:ring-0 px-3"
              />
              <button
                type="submit"
                className="h-10 px-5 rounded-lg bg-amber-500 hover:bg-[#FBBF24] active:bg-[#D97706] text-[#020617] font-bold text-xs flex items-center gap-2 shadow-sm tracking-wide transition-all cursor-pointer shrink-0"
              >
                <Search className="w-3.5 h-3.5 text-[#020617] stroke-[2.5]" />
                <span className="text-[#020617] font-bold text-xs">Search</span>
              </button>
            </div>
          </form>

          {/* Quick Test Barcodes */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#1E293B] flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">Quick Test Scans:</span>
            {books.slice(0, 4).map(b => (
              <button
                key={b.id}
                onClick={() => handleTestScan(b.barcode)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#020617] dark:hover:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#334155] tracking-wide transition-colors cursor-pointer"
              >
                {b.barcode} ({b.book_name.slice(0, 14)}...)
              </button>
            ))}
            <button
              onClick={() => handleTestScan('9999999999999')}
              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-[11px] font-mono text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 tracking-wide transition-colors cursor-pointer"
            >
              Test Unregistered Barcode
            </button>
          </div>
        </div>

        {/* Scan Results: Found */}
        {scanState === 'FOUND' && foundBook && (
          <div className="bg-[#0F172A] border border-emerald-500/40 rounded-xl p-5 sm:p-6 shadow-2xs space-y-4 animate-in fade-in duration-150 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E293B] pb-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm sm:text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Barcode Verified in Database</span>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Code: {searchedBarcode}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Cover thumbnail */}
              <div className="w-32 h-44 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs relative overflow-hidden flex flex-col justify-between p-2.5 shrink-0 mx-auto md:mx-0">
                {foundBook.book_image_path ? (
                  <img
                    src={foundBook.book_image_path}
                    alt={foundBook.book_name}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/80 z-10" />
                <div className="relative z-0 text-[10px] space-y-1">
                  <span className="text-[8px] font-mono text-amber-600 dark:text-amber-400 font-bold">ULM PRESS</span>
                  <p className="font-cinzel font-bold text-slate-800 dark:text-[#F1F5F9] line-clamp-3">{foundBook.book_name}</p>
                </div>
                <span className="relative z-0 text-[8.5px] font-mono text-slate-500 dark:text-slate-400">{foundBook.dewey_call_number}</span>
              </div>

              {/* Book Info */}
              <div className="md:col-span-3 space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">{foundBook.category}</span>
                    <span>·</span>
                    <span className="font-mono">Dewey {foundBook.dewey_call_number}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#F1F5F9] mt-1">
                    {foundBook.book_name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    by <span className="font-medium text-slate-800 dark:text-slate-200">{foundBook.author}</span> · {foundBook.edition} ({foundBook.publication_year})
                  </p>
                </div>

                {/* Copies Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-[#020617] p-3 rounded-lg border border-slate-200 dark:border-[#1E293B]">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">Total Volumes</span>
                    <p className="text-sm font-bold font-mono text-[#F1F5F9] mt-0.5">{foundBook.total_quantity}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">Available</span>
                    <p className={`text-sm font-bold font-mono mt-0.5 ${foundBook.available_quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {foundBook.available_quantity} on shelf
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">Stack Shelf</span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-500" />
                      <span>{foundBook.shelf}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">Row Location</span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      Row {foundBook.row}
                    </p>
                  </div>
                </div>

                {/* Active Loans */}
                {activeLoans.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Currently Loaned Copies ({activeLoans.length}):
                    </span>
                    <div className="space-y-1">
                      {activeLoans.map(loan => (
                        <div key={loan.id} className="flex items-center justify-between text-xs bg-[#020617] px-3 py-1.5 rounded border border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-[#F1F5F9]">{loan.borrower_name}</span>
                            <span className="text-slate-500 ml-2 font-mono">({loan.student_id})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 font-mono">Due: {loan.due_date}</span>
                            <button
                              onClick={() => onQuickReturn(loan.id)}
                              className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Return</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => onQuickLoan(foundBook)}
                    disabled={foundBook.available_quantity <= 0}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 transition-all ${
                      foundBook.available_quantity > 0
                        ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 cursor-pointer shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Issue Loan</span>
                  </button>

                  <button
                    onClick={() => onOpenBookDetails(foundBook.id)}
                    className="px-4.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Record</span>
                  </button>

                  <button
                    onClick={() => onPrintBarcode(foundBook)}
                    className="px-4.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-500" />
                    <span>Print Label</span>
                  </button>

                  <button
                    onClick={resetScanner}
                    className="px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium tracking-wide ml-auto transition-colors cursor-pointer"
                  >
                    Scan Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scan Results: Not Found */}
        {scanState === 'NOT_FOUND' && (
          <div className="bg-[#0F172A] border border-rose-300 dark:border-rose-500/40 rounded-xl p-6 shadow-2xs space-y-3 text-center animate-in fade-in duration-150 transition-colors">
            <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <XCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#F1F5F9]">Barcode Not Found in Catalog</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                No active book matches barcode <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{searchedBarcode}</span>. You can register this accession immediately.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => onOpenAddBookWithBarcode(searchedBarcode || '')}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Register Book with this Barcode</span>
              </button>

              <button
                onClick={resetScanner}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Scan Again
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
export default BarcodeScannerView;
