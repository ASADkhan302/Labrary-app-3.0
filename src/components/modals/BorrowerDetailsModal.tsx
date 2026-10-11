import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  GraduationCap, 
  Phone, 
  Mail, 
  BookOpen, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Barcode as BarcodeIcon, 
  Printer, 
  Edit3, 
  Coins, 
  FileText, 
  Clock, 
  ShieldAlert, 
  PlusCircle,
  MapPin,
  Calendar
} from 'lucide-react';
import { Borrower, Transaction } from '../../types/library';

interface BorrowerDetailsModalProps {
  borrower: Borrower | null;
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  onReturnLoan: (transactionId: string) => void;
  onOpenBookDetails: (bookId: string) => void;
  onEditBorrower?: (borrower: Borrower) => void;
  onIssueBook?: (borrower: Borrower) => void;
  onPrintCard?: (borrower: Borrower) => void;
  onToggleStatus?: (borrower: Borrower) => void;
}

export const BorrowerDetailsModal: React.FC<BorrowerDetailsModalProps> = ({
  borrower,
  transactions,
  isOpen,
  onClose,
  onReturnLoan,
  onOpenBookDetails,
  onEditBorrower,
  onIssueBook,
  onPrintCard,
  onToggleStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'fines' | 'notes'>('current');

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

  if (!isOpen || !borrower) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const uid = borrower.university_id || borrower.student_id;
  const borrowerTxs = transactions.filter(t => t.borrower_id === borrower.id);
  const activeLoans = borrowerTxs.filter(t => t.status !== 'RETURNED');
  const pastLoans = borrowerTxs.filter(t => t.status === 'RETURNED');

  // Fine calculations: Rs 50 / day for overdue
  const fineRate = 50;
  let totalUnpaidFine = 0;
  const activeLoansWithFine = activeLoans.map(loan => {
    const isOverdue = loan.status === 'OVERDUE' || loan.due_date < todayStr;
    let daysOverdue = 0;
    let fineDue = 0;
    if (loan.due_date < todayStr) {
      const diffMs = new Date(todayStr).getTime() - new Date(loan.due_date).getTime();
      daysOverdue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      fineDue = daysOverdue * fineRate;
      totalUnpaidFine += fineDue;
    }
    return { ...loan, isOverdue, daysOverdue, fineDue };
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#0B1220] border border-[#334155] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#020617] border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <User className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F1F5F9] font-cinzel leading-tight">
                Institutional Member Detail Dossier
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                ULM Central Campus Library Ledger · Real-Time Account Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-[#F1F5F9] hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Member Profile Banner */}
        <div className="p-6 border-b border-[#1E293B] bg-[#020617]/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {borrower.photo_url || borrower.photo_path ? (
              <img
                src={borrower.photo_url || borrower.photo_path}
                alt={borrower.name}
                className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500/50 shadow-md shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 font-cinzel font-black text-2xl shrink-0">
                {borrower.name.charAt(0)}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#F1F5F9] font-header truncate">
                  {borrower.name}
                </h2>
                {borrower.name_urdu && (
                  <span
                    dir="rtl"
                    className="font-urdu text-amber-400 font-bold text-base mr-1 leading-none"
                    style={{ fontFamily: 'var(--font-urdu)' }}
                  >
                    {borrower.name_urdu}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  borrower.role === 'Faculty'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : borrower.role === 'Staff'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {borrower.role}
                </span>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                  borrower.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : borrower.status === 'suspended'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : 'bg-slate-700/40 text-slate-400 border-slate-600'
                }`}>
                  {borrower.status}
                </span>

                {borrower.blood_group && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/15 text-red-300 font-mono">
                    Blood: {borrower.blood_group}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs font-mono text-amber-400 font-semibold tracking-wide">
                  {uid}
                </span>
                {borrower.roll_number && (
                  <span className="text-[11px] font-mono text-slate-300 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700">
                    Roll: {borrower.roll_number}
                  </span>
                )}
                {borrower.employee_no && (
                  <span className="text-[11px] font-mono text-slate-300 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700">
                    Emp: {borrower.employee_no}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{borrower.department}</span>
                </span>
                <span>•</span>
                <span>
                  {borrower.role === 'Student' 
                    ? `${borrower.degree_level ? borrower.degree_level + ' ' : ''}${borrower.program || 'Student'} (${borrower.session || 'Class'}${borrower.study_mode ? ` · ${borrower.study_mode}` : ''}) · Sem ${borrower.semester || 1}` 
                    : (borrower.designation || borrower.role)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-right">
            <div className="p-2.5 rounded-lg bg-[#0B1220] border border-[#334155]">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Quota Limit</span>
              <span className="text-xs font-mono font-bold text-[#F1F5F9]">
                {activeLoans.length} / {borrower.borrow_limit} Books
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0B1220] border border-[#334155]">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Unpaid Fines</span>
              <span className={`text-xs font-mono font-bold ${totalUnpaidFine > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                Rs {totalUnpaidFine}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Strip */}
        <div className="px-6 py-2.5 bg-[#020617] border-b border-[#1E293B] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-mono text-slate-300">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{borrower.phone}</span>
            </span>
            {borrower.email && (
              <span className="flex items-center gap-1.5 text-slate-300">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{borrower.email}</span>
              </span>
            )}
            {borrower.address && (
              <span className="flex items-center gap-1.5 text-slate-400 truncate max-w-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{borrower.address}</span>
              </span>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
            <span>Joined: {borrower.joined_date}</span>
            {borrower.valid_until && <span>· Valid: {borrower.valid_until}</span>}
          </div>
        </div>

        {/* Segmented Tabs Navigation */}
        <div className="px-6 pt-3 bg-[#0B1220] border-b border-[#334155] flex items-center gap-2">
          {[
            { id: 'current', label: `Current Loans (${activeLoans.length})`, icon: BookOpen },
            { id: 'history', label: `Loan History (${pastLoans.length})`, icon: Clock },
            { id: 'fines', label: `Fines & Ledger`, icon: Coins },
            { id: 'notes', label: `Notes & Details`, icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3 rounded-t-lg text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: CURRENT LOANS */}
          {activeTab === 'current' && (
            <div className="space-y-3">
              {activeLoansWithFine.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#020617] border border-[#334155] text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-[#F1F5F9]">No Active Borrowed Books</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Borrower account is in good standing with full circulation quota available.
                  </p>
                </div>
              ) : (
                activeLoansWithFine.map((loan) => (
                  <div
                    key={loan.id}
                    className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${
                      loan.isOverdue
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : 'bg-[#020617] border-[#334155]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => onOpenBookDetails(loan.book_id)}
                        className="font-bold text-sm text-[#F1F5F9] hover:text-amber-400 text-left block truncate transition-colors cursor-pointer"
                      >
                        {loan.book_name}
                      </button>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                        <BarcodeIcon className="w-3 h-3 text-slate-500" />
                        <span>{loan.barcode}</span>
                        <span>·</span>
                        <span>Issued: {loan.issue_date}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono text-slate-400 block">Due Date</span>
                        <span className={`font-mono font-bold ${loan.isOverdue ? 'text-rose-400' : 'text-slate-200'}`}>
                          {loan.due_date}
                        </span>
                        {loan.isOverdue && (
                          <span className="text-[10px] font-mono text-rose-400 block font-semibold">
                            {loan.daysOverdue} days overdue · Fine Rs {loan.fineDue}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onReturnLoan(loan.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Return Copy</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {pastLoans.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-6 rounded-xl bg-[#020617] border border-[#334155] text-center">
                  No historical loan transactions recorded for this member yet.
                </p>
              ) : (
                pastLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-3 rounded-lg bg-[#020617] border border-[#334155] flex items-center justify-between text-xs text-slate-300 font-mono"
                  >
                    <div className="truncate mr-3">
                      <span className="text-[#F1F5F9] font-medium block truncate">{loan.book_name}</span>
                      <span className="text-[10px] text-slate-500">{loan.barcode} · Issued {loan.issue_date}</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 shrink-0 font-semibold">
                      Returned {loan.return_date || '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: FINES & LEDGER */}
          {activeTab === 'fines' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#020617] border border-[#334155] space-y-1">
                  <span className="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                    Current Outstanding Fine
                  </span>
                  <p className={`text-xl font-mono font-bold ${totalUnpaidFine > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    Rs {totalUnpaidFine}
                  </p>
                  <p className="text-[10.5px] text-slate-500 font-mono">
                    Rate: Rs 50 / day per overdue book
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#020617] border border-[#334155] space-y-1">
                  <span className="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                    Account Clearance Status
                  </span>
                  <p className={`text-xl font-bold ${totalUnpaidFine > 500 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {totalUnpaidFine > 500 ? 'Blocked (> Rs 500)' : 'Clear (Within Limits)'}
                  </p>
                  <p className="text-[10.5px] text-slate-500 font-mono">
                    Max threshold before blocking: Rs 500
                  </p>
                </div>
              </div>

              {totalUnpaidFine > 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Overdue Fines Payable at Desk</span>
                  </div>
                  <p className="text-[11px] text-amber-300/80">
                    Fines are calculated automatically and receipted when books are checked in at the circulation desk.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>No outstanding fines. Borrower ledger is completely clear.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: NOTES & DETAILS */}
          {activeTab === 'notes' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-[#020617] border border-[#334155] space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold block">
                  Institutional Record Remarks
                </span>
                <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {borrower.notes || 'No custom administrative remarks logged for this member.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono text-slate-400">
                <div className="p-3 rounded-lg bg-[#020617] border border-[#334155]">
                  <span className="block text-[10px] text-slate-500 uppercase">Created Timestamp</span>
                  <span className="text-slate-200">{borrower.created_at}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#020617] border border-[#334155]">
                  <span className="block text-[10px] text-slate-500 uppercase">Last Updated</span>
                  <span className="text-slate-200">{borrower.updated_at}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer with Buttons: Edit, Issue book, Print member card */}
        <div className="px-6 py-4 bg-[#020617] border-t border-[#334155] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onToggleStatus && (
              <button
                type="button"
                onClick={() => onToggleStatus(borrower)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-[#334155] text-xs font-semibold transition-colors cursor-pointer"
              >
                {borrower.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {onPrintCard && (
              <button
                type="button"
                onClick={() => onPrintCard(borrower)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Member Card</span>
              </button>
            )}

            {onIssueBook && (
              <button
                type="button"
                onClick={() => onIssueBook(borrower)}
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] active:bg-[#1D4ED8] text-[#F1F5F9] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Issue Book</span>
              </button>
            )}

            {onEditBorrower && (
              <button
                type="button"
                onClick={() => onEditBorrower(borrower)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BorrowerDetailsModal;
