import React, { useState, useMemo } from 'react';
import { 
  ArrowRightLeft, 
  RotateCcw, 
  User, 
  BookOpen, 
  Barcode as BarcodeIcon, 
  Plus, 
  Clock, 
  Calendar, 
  X, 
  Loader2, 
  Check,
  AlertCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Transaction, Book, Borrower } from '../types/library';
import CustomSelect from './ui/CustomSelect';
import { PageHeaderCard } from './shared/PageHeaderCard';
import { SearchFilterBar } from './shared/SearchFilterBar';
import { TabCards, TabCardItem } from './shared/TabCards';
import { ItemCard } from './shared/SharedCards';
import { CirculationKpiCard } from './circulation/CirculationKpiCard';
import { StatusPill } from './shared/StatusPill';
import { DataTable, ColumnDef } from './shared/DataTable';
import { SharedCountService } from '../services/sharedCountService';

interface CirculationDeskProps {
  transactions: Transaction[];
  books: Book[];
  borrowers: Borrower[];
  onIssueBook: (bookId: string, borrowerId: string, days: number) => { success: boolean; message: string } | void;
  onOpenIssueDialog?: () => void;
  onReturnBook: (transactionId: string) => void;
  onOpenBookDetails: (bookId: string) => void;
  onOpenBorrowerDetails: (borrowerId: string) => void;
}

export const CirculationDeskView: React.FC<CirculationDeskProps> = ({
  transactions,
  books,
  borrowers,
  onIssueBook,
  onOpenIssueDialog,
  onReturnBook,
  onOpenBookDetails,
  onOpenBorrowerDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'RETURNED'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Issue modal/form inline controls
  const [isIssuing, setIsIssuing] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [loanPeriodDays, setLoanPeriodDays] = useState(14);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueButtonState, setIssueButtonState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [returningTxState, setReturningTxState] = useState<Record<string, 'loading' | 'success' | 'idle'>>({});

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Shared aggregates calculation (Part 1.8)
  const sharedCounts = useMemo(() => {
    return SharedCountService.computeCounts(books, borrowers, transactions, todayStr);
  }, [books, borrowers, transactions, todayStr]);

  // Active available books for issue
  const availableBooks = useMemo(() => {
    return books.filter(b => b.is_active && b.available_quantity > 0);
  }, [books]);

  // Active borrowers
  const activeBorrowers = useMemo(() => {
    return borrowers.filter(b => b.is_active);
  }, [borrowers]);

  // Filtered transactions
  const filteredTxs = useMemo(() => {
    return transactions.filter(t => {
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery = !query ||
        (t.book_name && t.book_name.toLowerCase().includes(query)) ||
        (t.borrower_name && t.borrower_name.toLowerCase().includes(query)) ||
        (t.barcode && t.barcode.toLowerCase().includes(query)) ||
        (t.student_id && t.student_id.toLowerCase().includes(query));

      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
      const isOverdue = !isReturned && (t.status === 'OVERDUE' || (t.due_date && t.due_date < todayStr));
      const isActive = !isReturned && !isOverdue;

      if (statusFilter === 'ALL') return matchesQuery;
      if (statusFilter === 'OVERDUE') return matchesQuery && isOverdue;
      if (statusFilter === 'ACTIVE') return matchesQuery && isActive;
      if (statusFilter === 'RETURNED') return matchesQuery && isReturned;
      return matchesQuery;
    });
  }, [transactions, searchQuery, statusFilter, todayStr]);

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId) {
      setIssueError('Please select a book title with available shelf copies.');
      return;
    }
    if (!selectedBorrowerId) {
      setIssueError('Please select a registered library member.');
      return;
    }

    setIssueButtonState('loading');
    setTimeout(() => {
      const res = onIssueBook(selectedBookId, selectedBorrowerId, loanPeriodDays);
      if (res && !res.success) {
        setIssueError(res.message);
        setIssueButtonState('idle');
        return;
      }

      setIssueButtonState('success');
      setTimeout(() => {
        setSelectedBookId('');
        setSelectedBorrowerId('');
        setIsIssuing(false);
        setIssueError(null);
        setIssueButtonState('idle');
      }, 1200);
    }, 200);
  };

  const handleReturnAction = (transactionId: string) => {
    setReturningTxState(prev => ({ ...prev, [transactionId]: 'loading' }));
    setTimeout(() => {
      setReturningTxState(prev => ({ ...prev, [transactionId]: 'success' }));
      setTimeout(() => {
        onReturnBook(transactionId);
        setReturningTxState(prev => {
          const next = { ...prev };
          delete next[transactionId];
          return next;
        });
      }, 1200);
    }, 200);
  };

  // Helper to calculate days overdue
  const getDaysOverdue = (dueDateStr: string): number => {
    if (!dueDateStr) return 0;
    const dueTime = new Date(dueDateStr).getTime();
    const todayTime = new Date(todayStr).getTime();
    const diff = Math.floor((todayTime - dueTime) / (1000 * 3600 * 24));
    return Math.max(0, diff);
  };

  // Helper for initials
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Four COUNT values and fractions for restyled Circulation Filter Cards
  const allLoansCount = transactions.length;
  // Shared count definition: active loans excluding overdue loans (not yet due)
  const activeLoansCount = Math.max(0, sharedCounts.activeLoans - sharedCounts.overdueLoans);
  const overdueLoansCount = sharedCounts.overdueLoans;
  const returnedLoansCount = sharedCounts.totalReturned;

  // Fraction calculations with zero-division safety (never NaN or Infinity)
  const activeFraction = allLoansCount > 0 ? activeLoansCount / allLoansCount : 0;
  const overdueFraction = allLoansCount > 0 ? overdueLoansCount / allLoansCount : 0;
  const returnedFraction = allLoansCount > 0 ? returnedLoansCount / allLoansCount : 0;

  // Stacked segments for All Loans card: active in green, overdue in danger, returned in muted blue
  const allLoansSegments = [
    { fraction: activeFraction, color: '#34D399', label: 'Active' },
    { fraction: overdueFraction, color: '#FB7185', label: 'Overdue' },
    { fraction: returnedFraction, color: '#6FA8D2', label: 'Returned' },
  ];

  // Preserved filterTabItems definition for reference and compatibility
  const filterTabItems: TabCardItem<'ALL' | 'ACTIVE' | 'OVERDUE' | 'RETURNED'>[] = [
    {
      id: 'ALL',
      label: 'All Loans',
      count: allLoansCount,
      accentColor: '#A66BC9', // purple
    },
    {
      id: 'ACTIVE',
      label: 'Active Loans',
      count: activeLoansCount,
      accentColor: '#34D399', // green
    },
    {
      id: 'OVERDUE',
      label: 'Overdue',
      count: overdueLoansCount,
      accentColor: '#FB7185', // danger
    },
    {
      id: 'RETURNED',
      label: 'Returned',
      count: returnedLoansCount,
      accentColor: '#6FA8D2', // muted-blue
    },
  ];

  // List View Columns
  const listColumns: ColumnDef<Transaction>[] = [
    {
      header: 'ID',
      width: '100px',
      cell: (tx) => (
        <span className="font-mono text-[12px] text-[#B3AABD] font-semibold">
          {tx.id}
        </span>
      ),
    },
    {
      header: 'Status',
      width: '130px',
      cell: (tx) => {
        const isReturned = tx.status === 'RETURNED' || Boolean(tx.return_date);
        const isOverdue = !isReturned && (tx.status === 'OVERDUE' || (tx.due_date && tx.due_date < todayStr));
        if (isReturned) return <StatusPill label="Returned" variant="muted" dot />;
        if (isOverdue) return <StatusPill label="Overdue" variant="danger" dot />;
        return <StatusPill label="Active Loan" variant="green" dot />;
      },
    },
    {
      header: 'Book Title',
      cell: (tx) => (
        <div className="min-w-[180px]">
          <button
            type="button"
            onClick={() => onOpenBookDetails(tx.book_id)}
            className="text-[13px] font-semibold text-white hover:text-[#E0B450] text-left transition-colors cursor-pointer truncate max-w-[280px] block"
            title={tx.book_name}
            dir="auto"
          >
            {tx.book_name}
          </button>
          <span className="font-mono text-[11px] text-[#B3AABD] flex items-center gap-1 mt-0.5">
            <BarcodeIcon className="w-3 h-3 text-[#BC881B]" />
            <span>{tx.barcode}</span>
          </span>
        </div>
      ),
    },
    {
      header: 'Borrower',
      cell: (tx) => (
        <div className="flex items-center gap-2 min-w-[170px]">
          <div className="w-7 h-7 rounded-full bg-[#541A72]/30 border border-[#A66BC9]/30 text-[#C084FC] flex items-center justify-center font-bold text-[10px] shrink-0">
            {getInitials(tx.borrower_name || '')}
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onOpenBorrowerDetails(tx.borrower_id)}
              className="text-[13px] font-semibold text-white hover:text-[#E0B450] text-left transition-colors cursor-pointer truncate max-w-[150px] block"
              title={tx.borrower_name}
              dir="auto"
            >
              {tx.borrower_name}
            </button>
            <span className="font-mono text-[11px] font-bold text-[#E0B450]">
              {tx.student_id}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Issued Date',
      cell: (tx) => (
        <span className="font-mono text-[12px] text-[#B3AABD]">
          {tx.issue_date || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Due Date',
      cell: (tx) => {
        const isReturned = tx.status === 'RETURNED' || Boolean(tx.return_date);
        const isOverdue = !isReturned && (tx.status === 'OVERDUE' || (tx.due_date && tx.due_date < todayStr));
        const daysOverdue = isOverdue ? getDaysOverdue(tx.due_date) : 0;

        return (
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[13px] ${isOverdue ? 'text-rose-400 font-bold' : 'text-white'}`}>
              {tx.due_date || 'N/A'}
            </span>
            {isOverdue && daysOverdue > 0 && (
              <StatusPill label={`${daysOverdue}d overdue`} variant="danger" />
            )}
          </div>
        );
      },
    },
    {
      header: 'Action',
      align: 'right',
      width: '160px',
      cell: (tx) => {
        const isReturned = tx.status === 'RETURNED' || Boolean(tx.return_date);
        if (isReturned) {
          return (
            <span className="text-[12px] font-mono text-[#B3AABD] flex items-center justify-end gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Returned {tx.return_date || ''}</span>
            </span>
          );
        }

        const state = returningTxState[tx.id] || 'idle';

        return (
          <button
            type="button"
            onClick={() => handleReturnAction(tx.id)}
            disabled={state !== 'idle'}
            className="h-9 px-3.5 rounded-[8px] border border-[#34D399]/40 text-[#34D399] hover:bg-[rgba(52,211,153,0.12)] active:scale-95 text-[12px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
            title="Return checked out volume"
          >
            {state === 'loading' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Returning...</span>
              </>
            ) : state === 'success' ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Returned</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return Copy</span>
              </>
            )}
          </button>
        );
      },
    },
  ];

  return (
    <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-y-auto space-y-6">
      <div className="max-w-[1920px] mx-auto space-y-5">

        {/* 2.1 Header Card with swap-arrows icon & ONE gold primary button */}
        <PageHeaderCard
          title="Circulation Desk & Loan Registry"
          subtitle="Process campus checkouts, returns, loan renewals, and overdue records."
          icon={ArrowRightLeft}
          actions={
            <button
              type="button"
              onClick={() => {
                if (onOpenIssueDialog) {
                  onOpenIssueDialog();
                } else {
                  setIsIssuing(!isIssuing);
                  setIssueError(null);
                }
              }}
              className="h-10 px-4 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-[13px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
              title="Open Issue Book Flow"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{isIssuing ? 'Cancel Issue' : 'Issue Book to Member'}</span>
            </button>
          }
        />

        {/* Issue Drawer Form */}
        {isIssuing && (
          <form 
            onSubmit={handleCreateIssue}
            className="rounded-[14px] bg-[#1A1A1A] border border-[#BC881B]/50 p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] space-y-4 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between border-b border-[#2E2A33] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <BookOpen className="w-4 h-4 text-[#E0B450]" />
                <span>New Book Issue Transaction</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-[11px] font-mono text-[#B3AABD]">
                  Auto-updates catalog shelf availability
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsIssuing(false);
                    setIssueError(null);
                  }}
                  className="p-1 rounded-[6px] text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  title="Close Issue Form"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {issueError && (
              <div className="p-3 rounded-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{issueError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Select Book */}
              <div>
                <label className="block text-xs font-semibold text-[#E7E2EC] mb-2 tracking-wide">
                  Select Book Title (Available Stock) <span className="text-[#E0B450]">*</span>
                </label>
                <CustomSelect
                  value={selectedBookId}
                  onChange={(val) => setSelectedBookId(val)}
                  placeholder="-- Choose Book from Stacks --"
                  options={availableBooks.map(b => ({
                    value: b.id,
                    label: b.book_name,
                    sublabel: `${b.barcode} · ${b.author}`,
                    badge: `${b.available_quantity} Avail`
                  }))}
                  searchable
                  variant="dark"
                />
              </div>

              {/* Select Borrower */}
              <div>
                <label className="block text-xs font-semibold text-[#E7E2EC] mb-2 tracking-wide">
                  Select Borrower (Member) <span className="text-[#E0B450]">*</span>
                </label>
                <CustomSelect
                  value={selectedBorrowerId}
                  onChange={(val) => setSelectedBorrowerId(val)}
                  placeholder="-- Choose Member / University ID --"
                  options={activeBorrowers.map(b => ({
                    value: b.id,
                    label: b.name,
                    sublabel: `${b.university_id || b.student_id} · ${b.department}`,
                    badge: b.role || 'Member'
                  }))}
                  searchable
                  variant="dark"
                />
              </div>

              {/* Loan Period */}
              <div>
                <label className="block text-xs font-semibold text-[#E7E2EC] mb-2 tracking-wide">
                  Loan Period Duration
                </label>
                <CustomSelect
                  value={loanPeriodDays}
                  onChange={(val) => setLoanPeriodDays(Number(val))}
                  options={[
                    { value: 7, label: '7 Days (Course Reserve)' },
                    { value: 14, label: '14 Days (Standard Undergraduate Loan)' },
                    { value: 30, label: '30 Days (Faculty / Research Loan)' },
                    { value: 60, label: '60 Days (Semester Extended Grant)' }
                  ]}
                  variant="dark"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2E2A33]">
              <button
                type="button"
                onClick={() => {
                  setIsIssuing(false);
                  setIssueError(null);
                }}
                className="px-4 h-10 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] text-[#B3AABD] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={issueButtonState !== 'idle'}
                className="px-5 h-10 rounded-[8px] bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A] text-xs font-bold shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
              >
                {issueButtonState === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating & Issuing...</span>
                  </>
                ) : issueButtonState === 'success' ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Loan Issued!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Confirm & Issue Loan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* 2.2 Restyled Circulation Filter Cards (matching Catalog Stat Cards) */}
        <div 
          role="tablist"
          aria-label="Circulation desk loan status filters"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Card 1: ALL LOANS */}
          <CirculationKpiCard
            id="ALL"
            label="All Loans"
            count={allLoansCount}
            note={allLoansCount === 0 ? 'none' : 'total loans'}
            icon={ArrowRightLeft}
            accentColor="#A66BC9"
            isSelected={statusFilter === 'ALL'}
            onClick={() => setStatusFilter('ALL')}
            barTooltip={`Active ${activeLoansCount.toLocaleString()}, overdue ${overdueLoansCount.toLocaleString()}, returned ${returnedLoansCount.toLocaleString()} of ${allLoansCount.toLocaleString()}`}
            barFraction={1}
            isStackedBar={true}
            stackedSegments={allLoansSegments}
            staggerIndex={0}
          />

          {/* Card 2: ACTIVE LOANS */}
          <CirculationKpiCard
            id="ACTIVE"
            label="Active Loans"
            count={activeLoansCount}
            note={activeLoansCount === 0 ? 'none' : 'not yet due'}
            icon={CheckCircle2}
            accentColor="#34D399"
            isSelected={statusFilter === 'ACTIVE'}
            onClick={() => setStatusFilter('ACTIVE')}
            barTooltip={`${activeLoansCount.toLocaleString()} / ${allLoansCount.toLocaleString()} active loans (not yet due)`}
            barFraction={activeFraction}
            staggerIndex={1}
          />

          {/* Card 3: OVERDUE */}
          <CirculationKpiCard
            id="OVERDUE"
            label="Overdue"
            count={overdueLoansCount}
            note={overdueLoansCount > 0 ? 'need follow-up' : 'none overdue'}
            icon={AlertTriangle}
            accentColor="#FB7185"
            isSelected={statusFilter === 'OVERDUE'}
            onClick={() => setStatusFilter('OVERDUE')}
            barTooltip={`${overdueLoansCount.toLocaleString()} / ${allLoansCount.toLocaleString()} loans overdue`}
            barFraction={overdueFraction}
            isDangerNumber={overdueLoansCount > 0}
            staggerIndex={2}
          />

          {/* Card 4: RETURNED */}
          <CirculationKpiCard
            id="RETURNED"
            label="Returned"
            count={returnedLoansCount}
            note={returnedLoansCount === 0 ? 'none' : 'completed'}
            icon={RotateCcw}
            accentColor="#6FA8D2"
            isSelected={statusFilter === 'RETURNED'}
            onClick={() => setStatusFilter('RETURNED')}
            barTooltip={`${returnedLoansCount.toLocaleString()} / ${allLoansCount.toLocaleString()} loans completed`}
            barFraction={returnedFraction}
            staggerIndex={3}
          />
        </div>

        {/* 2.2 Search & Segmented View Toggle */}
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by student, University ID, book title, or barcode..."
          viewMode={viewMode}
          onViewModeChange={(mode) => setViewMode(mode as 'grid' | 'list')}
          viewModeLabels={{ grid: 'Grid View', list: 'List View' }}
        />

        {/* 2.3 & 2.4 Transactions Display (Grid or List View) */}
        {filteredTxs.length === 0 ? (
          <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-12 text-center text-[#B3AABD] space-y-3 shadow-md">
            <ArrowRightLeft className="w-12 h-12 mx-auto text-[#6F6879]" />
            <h4 className="text-base font-semibold text-white">No circulation records found</h4>
            <p className="text-xs text-[#B3AABD] max-w-md mx-auto">
              No active or past loans match your current search query and status filter.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold rounded-[8px] border border-[#2E2A33] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              Reset Circulation Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* 2.3 Loan Card (Grid View) - Minimum 320px with staggered entrance animation */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {filteredTxs.map((tx, idx) => {
              const isReturned = tx.status === 'RETURNED' || Boolean(tx.return_date);
              const isOverdue = !isReturned && (tx.status === 'OVERDUE' || (tx.due_date && tx.due_date < todayStr));
              const daysOverdue = isOverdue ? getDaysOverdue(tx.due_date) : 0;
              const returnState = returningTxState[tx.id] || 'idle';

              // 4px left status bar color
              const statusColor = isReturned ? '#6F6879' : isOverdue ? '#FB7185' : '#34D399';

              return (
                <ItemCard
                  key={tx.id}
                  className="relative flex flex-col justify-between pl-5 pr-4 py-4 space-y-3.5 min-h-[260px]"
                  style={
                    idx < 12
                      ? {
                          animation: `fadeUp 200ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 30}ms forwards`,
                        }
                      : undefined
                  }
                >
                  {/* 4px status bar on the left edge */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-[4px]" 
                    style={{ backgroundColor: statusColor }} 
                  />

                  {/* Row 1: Transaction ID + Status Pill */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold text-[#B3AABD]">
                      {tx.id}
                    </span>
                    {isReturned ? (
                      <StatusPill label="Returned" variant="muted" dot />
                    ) : isOverdue ? (
                      <StatusPill label="OVERDUE" variant="danger" dot />
                    ) : (
                      <StatusPill label="Active Loan" variant="green" dot />
                    )}
                  </div>

                  {/* Title & ISBN */}
                  <div className="space-y-1">
                    <h3
                      onClick={() => onOpenBookDetails(tx.book_id)}
                      className="text-[16px] font-semibold text-white hover:text-[#E0B450] cursor-pointer transition-colors line-clamp-2 leading-snug"
                      title={tx.book_name}
                      dir="auto"
                    >
                      {tx.book_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#B3AABD]">
                      <BarcodeIcon className="w-3.5 h-3.5 text-[#BC881B] shrink-0" />
                      <span>{tx.barcode}</span>
                    </div>
                  </div>

                  {/* Borrower Row: 38px avatar, name, and gold university ID chip */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2E2A33]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-[38px] h-[38px] rounded-full bg-[#541A72]/30 border border-[#A66BC9]/30 text-[#C084FC] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {getInitials(tx.borrower_name || '')}
                      </div>
                      <div className="min-w-0">
                        <span
                          onClick={() => onOpenBorrowerDetails(tx.borrower_id)}
                          className="text-[14px] font-semibold text-white hover:text-[#E0B450] cursor-pointer transition-colors block truncate max-w-[150px] sm:max-w-[180px]"
                          title={tx.borrower_name}
                          dir="auto"
                        >
                          {tx.borrower_name}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-mono font-bold bg-[rgba(188,136,27,0.14)] text-[#E0B450] border border-[#BC881B]/35 shrink-0">
                      {tx.student_id}
                    </span>
                  </div>

                  {/* Dates Row: 2 columns with calendar icons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2E2A33] text-xs">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#B3AABD] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#B3AABD]" />
                        <span>ISSUED</span>
                      </span>
                      <p className="font-mono text-[14px] text-white mt-0.5">
                        {tx.issue_date || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#B3AABD] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#B3AABD]" />
                        <span>DUE DATE</span>
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`font-mono text-[14px] ${isOverdue ? 'text-rose-400 font-bold' : 'text-white'}`}>
                          {tx.due_date || 'N/A'}
                        </span>
                        {isOverdue && daysOverdue > 0 && (
                          <StatusPill label={`${daysOverdue}d overdue`} variant="danger" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action: Return Copy (full width, 40px, green outline with return icon) */}
                  <div className="pt-2">
                    {isReturned ? (
                      <div className="flex items-center justify-center gap-2 py-2 text-[12px] font-mono text-[#B3AABD] border-t border-[#2E2A33]">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Returned on {tx.return_date || tx.issue_date}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReturnAction(tx.id)}
                        disabled={returnState !== 'idle'}
                        className="w-full h-10 rounded-[10px] border border-[#34D399]/40 text-[#34D399] hover:bg-[rgba(52,211,153,0.12)] active:scale-[0.98] font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                      >
                        {returnState === 'loading' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing Return...</span>
                          </>
                        ) : returnState === 'success' ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Volume Returned</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4" />
                            <span>Return Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </ItemCard>
              );
            })}
          </div>
        ) : (
          /* 2.4 List View (48px rows, status pills, due date and days overdue, 36px Return button) */
          <DataTable
            data={filteredTxs}
            columns={listColumns}
            keyExtractor={(tx) => tx.id}
            rowHeightClass="min-h-[48px]"
          />
        )}

      </div>
    </div>
  );
};

export default CirculationDeskView;
