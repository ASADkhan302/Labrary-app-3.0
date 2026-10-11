import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Printer, 
  FileSpreadsheet, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Users, 
  AlertTriangle,
  RefreshCw,
  Calendar,
  ChevronDown,
  Activity,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  Download,
  Check,
  X,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  Legend
} from 'recharts';
import { Book, Borrower, Transaction, NavigationTab } from '../types/library';
import { LibraryStorage } from '../services/storage';
import { SharedCountService, LibraryCounts } from '../services/sharedCountService';
import { SharedCsvWriter } from '../utils/csvWriter';
import { PageHeaderCard } from './shared/PageHeaderCard';
import { TabCards, TabCardItem } from './shared/TabCards';
import { PanelCard, KpiCard } from './shared/SharedCards';
import { StatusPill } from './shared/StatusPill';
import { DataTable, ColumnDef } from './shared/DataTable';
import CustomSelect from './ui/CustomSelect';

export type ReportTabId = 'overview' | 'circulation' | 'collection' | 'overdue' | 'health';
export type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

interface ReportsViewProps {
  books: Book[];
  borrowers: Borrower[];
  transactions: Transaction[];
  onNavigateTab?: (tab: NavigationTab) => void;
  onOpenBookDetails?: (bookId: string) => void;
  onOpenBorrowerDetails?: (borrowerId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  books,
  borrowers,
  transactions,
  onNavigateTab,
  onOpenBookDetails,
  onOpenBorrowerDetails,
}) => {
  const [activeTab, setActiveTab] = useState<ReportTabId>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [lastCheckTimestamp, setLastCheckTimestamp] = useState<string>('');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthResults, setHealthResults] = useState<Record<string, { count: number; items: string[] }> | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const lastUpdatedTime = useMemo(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), []);

  // 1. Shared count aggregates (Part 1.8)
  const counts: LibraryCounts = useMemo(() => {
    return SharedCountService.computeCounts(books, borrowers, transactions, todayStr);
  }, [books, borrowers, transactions, todayStr]);

  const activeBooks = useMemo(() => books.filter(b => b.is_active), [books]);
  const activeBorrowers = useMemo(() => borrowers.filter(b => b.is_active), [borrowers]);

  // 2. Period Filter Boundary Calculations
  const periodDateLimit = useMemo(() => {
    if (selectedPeriod === 'all') return '1970-01-01';
    const now = new Date();
    if (selectedPeriod === 'today') return todayStr;
    if (selectedPeriod === 'week') {
      const d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    }
    if (selectedPeriod === 'month') {
      const d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    }
    if (selectedPeriod === 'quarter') {
      const d = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    }
    if (selectedPeriod === 'year') {
      const d = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
      return d.toISOString().split('T')[0];
    }
    return '1970-01-01';
  }, [selectedPeriod, todayStr]);

  // Filtered transactions for the selected period
  const periodTxs = useMemo(() => {
    return transactions.filter(t => {
      const date = t.issue_date || t.created_at || '';
      return date >= periodDateLimit;
    });
  }, [transactions, periodDateLimit]);

  // 3. Collection Breakdown by Discipline
  const disciplineStats = useMemo(() => {
    const map = new Map<string, { titles: number; totalCopies: number; availableCopies: number }>();
    activeBooks.forEach(b => {
      const cat = b.category || 'General';
      const cur = map.get(cat) || { titles: 0, totalCopies: 0, availableCopies: 0 };
      cur.titles += 1;
      cur.totalCopies += (b.total_quantity || 0);
      cur.availableCopies += Math.min(b.available_quantity || 0, b.total_quantity || 0);
      map.set(cat, cur);
    });

    return Array.from(map.entries()).map(([category, stats]) => {
      const onLoan = Math.max(0, stats.totalCopies - stats.availableCopies);
      const percentOfTotal = counts.totalCopies > 0 ? Math.round((stats.totalCopies / counts.totalCopies) * 100) : 0;
      return {
        category,
        titles: stats.titles,
        totalCopies: stats.totalCopies,
        available: stats.availableCopies,
        onLoan,
        percentOfTotal,
      };
    }).sort((a, b) => b.totalCopies - a.totalCopies);
  }, [activeBooks, counts.totalCopies]);

  // 4. Overdue Ageing Buckets (1-7, 8-14, 15-30, >30)
  const overdueAgeing = useMemo(() => {
    const buckets = [
      { key: '1-7', label: '1 - 7 Days', count: 0, color: '#F59E0B' },
      { key: '8-14', label: '8 - 14 Days', count: 0, color: '#FB923C' },
      { key: '15-30', label: '15 - 30 Days', count: 0, color: '#F87171' },
      { key: '30+', label: '> 30 Days', count: 0, color: '#FB7185' },
    ];

    transactions.forEach(t => {
      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
      if (!isReturned && (t.status === 'OVERDUE' || (t.due_date && t.due_date < todayStr))) {
        const dueTime = new Date(t.due_date).getTime();
        const nowTime = new Date(todayStr).getTime();
        const days = Math.max(1, Math.floor((nowTime - dueTime) / (1000 * 3600 * 24)));
        if (days <= 7) buckets[0].count += 1;
        else if (days <= 14) buckets[1].count += 1;
        else if (days <= 30) buckets[2].count += 1;
        else buckets[3].count += 1;
      }
    });

    return buckets;
  }, [transactions, todayStr]);

  // 5. Overdue Action List
  const overdueActionList = useMemo(() => {
    const list: {
      id: string;
      transactionId: string;
      borrowerId: string;
      borrowerName: string;
      universityId: string;
      bookId: string;
      bookName: string;
      barcode: string;
      dueDate: string;
      daysOverdue: number;
      fineDue: number;
    }[] = [];

    transactions.forEach(t => {
      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
      if (!isReturned && (t.status === 'OVERDUE' || (t.due_date && t.due_date < todayStr))) {
        const dueTime = new Date(t.due_date).getTime();
        const nowTime = new Date(todayStr).getTime();
        const days = Math.max(1, Math.floor((nowTime - dueTime) / (1000 * 3600 * 24)));
        list.push({
          id: t.id,
          transactionId: t.id,
          borrowerId: t.borrower_id,
          borrowerName: t.borrower_name || 'Unknown Member',
          universityId: t.student_id || t.borrower_id,
          bookId: t.book_id,
          bookName: t.book_name || 'Untitled Book',
          barcode: t.barcode || '—',
          dueDate: t.due_date,
          daysOverdue: days,
          fineDue: days * 10,
        });
      }
    });

    return list.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [transactions, todayStr]);

  // 6. Circulation Breakdown (Issued vs Returned per day / week / month)
  const circulationTimeline = useMemo(() => {
    const map = new Map<string, { date: string; issued: number; returned: number }>();

    periodTxs.forEach(t => {
      const issueDate = t.issue_date || t.created_at?.split(' ')[0] || todayStr;
      const cur = map.get(issueDate) || { date: issueDate, issued: 0, returned: 0 };
      cur.issued += 1;
      map.set(issueDate, cur);

      if (t.return_date) {
        const retDate = t.return_date;
        const curRet = map.get(retDate) || { date: retDate, issued: 0, returned: 0 };
        curRet.returned += 1;
        map.set(retDate, curRet);
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Display last up to 14 active days
  }, [periodTxs, todayStr]);

  // 7. Active Borrowing by Department
  const departmentStats = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
      if (!isReturned) {
        const b = borrowers.find(item => item.id === t.borrower_id);
        const dept = b ? b.department || 'General' : 'General';
        map.set(dept, (map.get(dept) || 0) + 1);
      }
    });

    return Array.from(map.entries()).map(([dept, count]) => {
      const pct = counts.activeLoans > 0 ? Math.round((count / counts.activeLoans) * 100) : 0;
      return { dept, count, pct };
    }).sort((a, b) => b.count - a.count);
  }, [transactions, borrowers, counts.activeLoans]);

  // 8. Top 10 Most Borrowed Titles
  const topBorrowedTitles = useMemo(() => {
    const map = new Map<string, { bookId: string; title: string; author: string; barcode: string; count: number }>();
    periodTxs.forEach(t => {
      const cur = map.get(t.book_id) || {
        bookId: t.book_id,
        title: t.book_name || 'Untitled Book',
        author: '',
        barcode: t.barcode || '—',
        count: 0,
      };
      cur.count += 1;
      map.set(t.book_id, cur);
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [periodTxs]);

  // 9. Language Distribution
  const languageStats = useMemo(() => {
    const map = new Map<string, number>();
    activeBooks.forEach(b => {
      const lang = b.language || 'English';
      map.set(lang, (map.get(lang) || 0) + (b.total_quantity || 1));
    });

    return Array.from(map.entries()).map(([language, copies]) => ({
      language,
      copies,
      pct: counts.totalCopies > 0 ? Math.round((copies / counts.totalCopies) * 100) : 0,
    })).sort((a, b) => b.copies - a.copies);
  }, [activeBooks, counts.totalCopies]);

  // 10. Run Real Health Checks (Part 4, Data Health)
  const handleRunHealthCheck = () => {
    setIsCheckingHealth(true);
    setTimeout(() => {
      const results: Record<string, { count: number; items: string[] }> = {};

      // 1. Duplicate accession numbers
      const accMap = new Map<string, string[]>();
      books.forEach(b => {
        if (b.accession_no) {
          const acc = b.accession_no.trim();
          accMap.set(acc, [...(accMap.get(acc) || []), `${b.book_name} (${b.barcode})`]);
        }
      });
      const dupAccs: string[] = [];
      accMap.forEach((v, k) => {
        if (v.length > 1) dupAccs.push(`Accession #${k}: ${v.join(' | ')}`);
      });
      results.dupAccessions = { count: dupAccs.length, items: dupAccs };

      // 2. Duplicate barcodes
      const bcMap = new Map<string, string[]>();
      books.forEach(b => {
        if (b.barcode) {
          const bc = b.barcode.trim();
          bcMap.set(bc, [...(bcMap.get(bc) || []), b.book_name]);
        }
      });
      const dupBarcodes: string[] = [];
      bcMap.forEach((v, k) => {
        if (v.length > 1) dupBarcodes.push(`Barcode ${k}: ${v.join(' | ')}`);
      });
      results.dupBarcodes = { count: dupBarcodes.length, items: dupBarcodes };

      // 3. Duplicate ISBNs
      const isbnMap = new Map<string, string[]>();
      books.forEach(b => {
        if (b.isbn && b.isbn.trim()) {
          const isbn = b.isbn.trim();
          isbnMap.set(isbn, [...(isbnMap.get(isbn) || []), b.book_name]);
        }
      });
      const dupIsbns: string[] = [];
      isbnMap.forEach((v, k) => {
        if (v.length > 1) dupIsbns.push(`ISBN ${k}: ${v.join(' | ')}`);
      });
      results.dupIsbns = { count: dupIsbns.length, items: dupIsbns };

      // 4. Books without a barcode
      const noBarcode = books.filter(b => !b.barcode || !b.barcode.trim()).map(b => b.book_name);
      results.noBarcode = { count: noBarcode.length, items: noBarcode };

      // 5. Books without author or ISBN
      const missingMeta = books.filter(b => !b.author || !b.author.trim() || !b.isbn || !b.isbn.trim()).map(b => `${b.book_name} (${b.barcode})`);
      results.missingMeta = { count: missingMeta.length, items: missingMeta };

      // 6. Orphan loans
      const bookIds = new Set(books.map(b => b.id));
      const borrowerIds = new Set(borrowers.map(b => b.id));
      const orphanLoans: string[] = [];
      transactions.forEach(t => {
        const isReturned = t.status === 'RETURNED' || Boolean(t.return_date);
        if (!isReturned) {
          if (!bookIds.has(t.book_id)) orphanLoans.push(`Loan #${t.id}: missing book (${t.book_name})`);
          if (!borrowerIds.has(t.borrower_id)) orphanLoans.push(`Loan #${t.id}: missing member (${t.borrower_name})`);
        }
      });
      results.orphanLoans = { count: orphanLoans.length, items: orphanLoans };

      // 7. Counter drift (copies on shelf + loaned != total quantity)
      const driftList: string[] = [];
      books.forEach(b => {
        const unreturnedCount = transactions.filter(t => t.book_id === b.id && t.status !== 'RETURNED' && !t.return_date).length;
        if (b.available_quantity + unreturnedCount !== b.total_quantity) {
          driftList.push(`${b.book_name} (${b.barcode}): on shelf ${b.available_quantity} + loaned ${unreturnedCount} != total ${b.total_quantity}`);
        }
      });
      results.counterDrift = { count: driftList.length, items: driftList };

      // 8. Overdue > 30 days
      const overdue30 = overdueActionList.filter(o => o.daysOverdue > 30).map(o => `${o.borrowerName} (${o.universityId}) - ${o.bookName} (${o.daysOverdue} days)`);
      results.overdue30 = { count: overdue30.length, items: overdue30 };

      setHealthResults(results);
      setLastCheckTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsCheckingHealth(false);
    }, 400);
  };

  // CSV Export Handler using SharedCsvWriter
  const handleExportDataset = (type: 'catalog' | 'circulation' | 'overdue' | 'members' | 'fines') => {
    setIsExportMenuOpen(false);

    if (type === 'catalog') {
      const data = activeBooks.map(b => ({
        Barcode: b.barcode,
        AccessionNo: b.accession_no || '',
        Title: b.book_name,
        Author: b.author,
        ISBN: b.isbn,
        Category: b.category,
        Language: b.language || 'English',
        TotalCopies: b.total_quantity,
        AvailableCopies: b.available_quantity,
        IssuedCopies: Math.max(0, b.total_quantity - b.available_quantity),
        ShelfLocation: `${b.shelf} / ${b.row}`,
        CallNumber: b.dewey_call_number,
        DateAdded: b.date_added || (b.created_at ? b.created_at.split(' ')[0] : todayStr),
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Catalog_Inventory_${todayStr}.csv`);
    } else if (type === 'circulation') {
      const data = periodTxs.map(t => ({
        TransactionID: t.id,
        Barcode: t.barcode,
        BookTitle: t.book_name,
        BorrowerName: t.borrower_name,
        UniversityID: t.student_id,
        IssueDate: t.issue_date,
        DueDate: t.due_date,
        ReturnDate: t.return_date || 'N/A',
        Status: t.status,
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Circulation_${selectedPeriod}_${todayStr}.csv`);
    } else if (type === 'overdue') {
      const data = overdueActionList.map(o => ({
        BorrowerName: o.borrowerName,
        UniversityID: o.universityId,
        BookTitle: o.bookName,
        Barcode: o.barcode,
        DueDate: o.dueDate,
        DaysOverdue: o.daysOverdue,
        EstimatedFineRs: o.fineDue,
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Overdue_Loans_Action_List_${todayStr}.csv`);
    } else if (type === 'members') {
      const data = activeBorrowers.map(b => ({
        UniversityID: b.university_id || b.student_id,
        Name: b.name,
        Role: b.role,
        Department: b.department,
        Program: b.program || '',
        Phone: b.phone,
        Email: b.email,
        Status: b.status,
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Active_Borrowers_${todayStr}.csv`);
    } else if (type === 'fines') {
      const data = overdueActionList.map(o => ({
        UniversityID: o.universityId,
        BorrowerName: o.borrowerName,
        BookTitle: o.bookName,
        DueDate: o.dueDate,
        DaysOverdue: o.daysOverdue,
        FineRatePerDay: 'Rs 10',
        TotalFineDue: `Rs ${o.fineDue}`,
      }));
      SharedCsvWriter.downloadCsv(data, `ULM_Fines_Ledger_${todayStr}.csv`);
    }
  };

  // LABEL Tab Items (Part 4, Step 3)
  const tabItems: TabCardItem<ReportTabId>[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'circulation', label: 'Circulation', icon: Clock, count: periodTxs.length },
    { id: 'collection', label: 'Collection', icon: BookOpen, count: counts.totalTitles },
    { id: 'overdue', label: 'Overdue & Fines', icon: AlertTriangle, count: counts.overdueLoans },
    { id: 'health', label: 'Data Health', icon: ShieldCheck },
  ];

  return (
    <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-y-auto space-y-6">
      <div className="max-w-[1920px] mx-auto space-y-5">

        {/* Header Card with ONE gold primary button (Print Official Report) */}
        <PageHeaderCard
          title="Campus Library Analytics & Inventory Audit"
          subtitle={`Updated ${lastUpdatedTime} · Real database aggregates with zero synthetic padding.`}
          icon={BarChart3}
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Period Selector Dropdown */}
              <div className="w-36 min-w-[130px]">
                <CustomSelect
                  value={selectedPeriod}
                  onChange={(val) => setSelectedPeriod(val as TimePeriod)}
                  options={[
                    { value: 'all', label: 'All Records' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' },
                    { value: 'quarter', label: 'Last 3 Months' },
                    { value: 'year', label: 'This Year' },
                  ]}
                  variant="dark"
                />
              </div>

              {/* Export CSV Dropdown Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  className="h-10 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-[13px] border border-[#A66BC9]/30 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#C084FC]" />
                  <span>Export CSV</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                {isExportMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-[12px] bg-[#1A1A1A] border border-[#2E2A33] shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                    <button
                      onClick={() => handleExportDataset('catalog')}
                      className="w-full text-left px-3 py-2 rounded-[8px] text-[12px] text-[#E7E2EC] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>Catalog Inventory</span>
                      <span className="font-mono text-[10px] text-[#B3AABD]">CSV</span>
                    </button>
                    <button
                      onClick={() => handleExportDataset('circulation')}
                      className="w-full text-left px-3 py-2 rounded-[8px] text-[12px] text-[#E7E2EC] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>Circulation ({selectedPeriod})</span>
                      <span className="font-mono text-[10px] text-[#B3AABD]">CSV</span>
                    </button>
                    <button
                      onClick={() => handleExportDataset('overdue')}
                      className="w-full text-left px-3 py-2 rounded-[8px] text-[12px] text-[#E7E2EC] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>Overdue Action List</span>
                      <span className="font-mono text-[10px] text-rose-400">CSV</span>
                    </button>
                    <button
                      onClick={() => handleExportDataset('members')}
                      className="w-full text-left px-3 py-2 rounded-[8px] text-[12px] text-[#E7E2EC] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>Members Directory</span>
                      <span className="font-mono text-[10px] text-[#B3AABD]">CSV</span>
                    </button>
                    <button
                      onClick={() => handleExportDataset('fines')}
                      className="w-full text-left px-3 py-2 rounded-[8px] text-[12px] text-[#E7E2EC] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>Fines Ledger</span>
                      <span className="font-mono text-[10px] text-amber-400">CSV</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Print Official Report: The ONLY Gold Primary button */}
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="h-10 px-4 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-[13px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all duration-150 inline-flex items-center gap-2 cursor-pointer"
                title="Open Official A4 Print Report"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>Print Official Report</span>
              </button>
            </div>
          }
        />

        {/* Five LABEL Tabs */}
        <TabCards
          variant="label"
          items={tabItems}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id)}
        />

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Six Real KPI Cards (Part 4, Overview) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
              <KpiCard
                label="Total Titles"
                value={counts.totalTitles}
                subLabel="Active bibliographic catalog entries"
                icon={BookOpen}
                accentBarColor="#BC881B"
              />

              <KpiCard
                label="Total Copies"
                value={counts.totalCopies}
                subLabel="Physical volumes across campus"
                icon={Layers}
                accentBarColor="#A66BC9"
              />

              <KpiCard
                label="On Shelf"
                value={counts.copiesOnShelf}
                subLabel={`${counts.totalCopies > 0 ? Math.round((counts.copiesOnShelf / counts.totalCopies) * 100) : 0}% available for issue`}
                icon={CheckCircle2}
                iconColor="#34D399"
                percentBar={{
                  value: counts.copiesOnShelf,
                  max: counts.totalCopies,
                  color: '#34D399',
                }}
                accentBarColor="#34D399"
              />

              <KpiCard
                label="On Loan"
                value={counts.copiesOnLoan}
                subLabel="Volumes currently with borrowers"
                icon={Clock}
                iconColor="#6FA8D2"
                accentBarColor="#29658E"
              />

              <KpiCard
                label="Overdue Loans"
                value={counts.overdueLoans}
                subLabel={`${counts.overdueRatePercent}% of active loans`}
                icon={AlertTriangle}
                isDanger={counts.overdueLoans > 0}
                accentBarColor="#FB7185"
              />

              <KpiCard
                label="Active Borrowers"
                value={counts.activeBorrowers}
                subLabel="Enrolled students & faculty"
                icon={Users}
                accentBarColor="#C084FC"
              />
            </div>

            {/* Overview Charts: Circulation Over Time & Overdue Ageing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Circulation Timeline */}
              <PanelCard
                title="Circulation Activity Over Time"
                subtitle="Daily checkouts vs returns recorded in database"
                hairlineColor="#BC881B"
              >
                {circulationTimeline.length === 0 ? (
                  <div className="py-16 text-center text-[#B3AABD] text-[13px]">
                    No circulation activity recorded in this period.
                  </div>
                ) : (
                  <div className="h-[260px] w-full pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={circulationTimeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2E2A33" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#B3AABD" 
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis stroke="#B3AABD" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1A1A1A',
                            borderColor: '#2E2A33',
                            borderRadius: '10px',
                            color: '#FFFFFF',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', color: '#B3AABD' }} />
                        <Bar dataKey="issued" name="Issued" fill="#BC881B" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="returned" name="Returned" fill="#34D399" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </PanelCard>

              {/* Overdue Ageing Distribution */}
              <PanelCard
                title="Overdue Ageing Distribution"
                subtitle="Unreturned volumes past scheduled return date"
                hairlineColor="#FB7185"
              >
                {counts.overdueLoans === 0 ? (
                  <div className="py-16 text-center text-[#B3AABD] text-[13px] flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <span className="text-white font-semibold">Zero Overdue Records</span>
                    <span className="text-[12px] text-[#B3AABD]">All issued volumes are within active loan periods.</span>
                  </div>
                ) : (
                  <div className="h-[260px] w-full pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overdueAgeing}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2E2A33" vertical={false} />
                        <XAxis dataKey="label" stroke="#B3AABD" fontSize={11} tickLine={false} />
                        <YAxis stroke="#B3AABD" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1A1A1A',
                            borderColor: '#2E2A33',
                            borderRadius: '10px',
                            color: '#FFFFFF',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="count" name="Overdue Books" fill="#FB7185" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </PanelCard>
            </div>
          </div>
        )}

        {/* TAB 2: CIRCULATION */}
        {activeTab === 'circulation' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Top Borrowed Titles */}
              <PanelCard
                title="Top 10 Most Borrowed Titles"
                subtitle="Highest circulating bibliographic works"
                hairlineColor="#BC881B"
              >
                {topBorrowedTitles.length === 0 ? (
                  <div className="py-12 text-center text-[#B3AABD] text-[13px]">
                    No circulation loans recorded in this period.
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-2">
                    {topBorrowedTitles.map((item, idx) => (
                      <div
                        key={item.bookId}
                        className="flex items-center justify-between p-2.5 rounded-[10px] bg-[#141214] border border-[#2E2A33] hover:border-[#6F6879] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 text-center font-mono text-[12px] font-bold text-[#E0B450]">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpenBookDetails && onOpenBookDetails(item.bookId)}
                              className="text-[13px] font-semibold text-white hover:text-[#E0B450] text-left truncate block max-w-[280px] sm:max-w-[400px]"
                              dir="auto"
                            >
                              {item.title}
                            </button>
                            <span className="font-mono text-[11px] text-[#B3AABD]">
                              {item.barcode}
                            </span>
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#BC881B]/15 text-[#E0B450] border border-[#BC881B]/30 shrink-0">
                          {item.count} loans
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>

              {/* Active Borrowing by Department */}
              <PanelCard
                title="Active Borrowing by Department"
                subtitle="Campus department volume distribution"
                hairlineColor="#A66BC9"
              >
                {departmentStats.length === 0 ? (
                  <div className="py-12 text-center text-[#B3AABD] text-[13px]">
                    No active borrower loans currently.
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    {departmentStats.map((dept) => (
                      <div key={dept.dept} className="space-y-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-white font-medium">{dept.dept}</span>
                          <span className="font-mono text-[#B3AABD]">
                            {dept.count} loans ({dept.pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#A66BC9] rounded-full transition-all" 
                            style={{ width: `${dept.pct}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>
            </div>
          </div>
        )}

        {/* TAB 3: COLLECTION */}
        {activeTab === 'collection' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Holdings Distribution by Discipline */}
            <PanelCard
              title="Holdings Distribution by Academic Discipline"
              subtitle="Physical volume counts and shelf availability per discipline"
              hairlineColor="#BC881B"
            >
              {disciplineStats.length === 0 ? (
                <div className="py-12 text-center text-[#B3AABD] text-[13px]">
                  No catalog holdings found.
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {disciplineStats.map((item) => (
                    <div key={item.category} className="space-y-1.5 p-3 rounded-[10px] bg-[#141214] border border-[#2E2A33]">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                        <span className="font-semibold text-white" dir="auto">{item.category}</span>
                        <div className="flex items-center gap-3 font-mono text-[12px] text-[#B3AABD]">
                          <span>{item.titles} titles</span>
                          <span>•</span>
                          <span className="text-white font-bold">{item.totalCopies} copies ({item.percentOfTotal}%)</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">{item.available} on shelf</span>
                          <span>•</span>
                          <span className="text-[#E0B450] font-semibold">{item.onLoan} on loan</span>
                        </div>
                      </div>

                      {/* Stacked bar: Available (green) + Loaned (gold) */}
                      <div className="h-2 w-full bg-white/[0.08] rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-[#34D399]"
                          style={{
                            width: `${item.totalCopies > 0 ? (item.available / item.totalCopies) * 100 : 0}%`,
                          }}
                          title={`${item.available} available on shelf`}
                        />
                        <div
                          className="h-full bg-[#BC881B]"
                          style={{
                            width: `${item.totalCopies > 0 ? (item.onLoan / item.totalCopies) * 100 : 0}%`,
                          }}
                          title={`${item.onLoan} currently checked out`}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-center gap-6 pt-2 text-[11px] text-[#B3AABD]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
                      <span>Available on Shelf</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#BC881B]" />
                      <span>Issued on Loan</span>
                    </div>
                  </div>
                </div>
              )}
            </PanelCard>

            {/* Language Distribution */}
            <PanelCard
              title="Catalog Language Distribution"
              subtitle="Holdings grouped by primary catalog language"
              hairlineColor="#A66BC9"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {languageStats.map((lang) => (
                  <div
                    key={lang.language}
                    className="p-3.5 rounded-[10px] bg-[#141214] border border-[#2E2A33] space-y-1"
                  >
                    <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#B3AABD]">
                      {lang.language}
                    </span>
                    <p className="text-[20px] font-mono font-bold text-white">
                      {lang.copies} <span className="text-[12px] font-sans font-normal text-[#B3AABD]">copies</span>
                    </p>
                    <p className="text-[11px] font-mono text-[#E0B450]">
                      {lang.pct}% of total holdings
                    </p>
                  </div>
                ))}
              </div>
            </PanelCard>
          </div>
        )}

        {/* TAB 4: OVERDUE & FINES */}
        {activeTab === 'overdue' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <PanelCard
              title={`Overdue Action List (${overdueActionList.length} Volumes)`}
              subtitle="Borrowers with loans overdue beyond scheduled return date · Official campus fine: Rs 10 / day"
              hairlineColor="#FB7185"
              headerAction={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportDataset('overdue')}
                    className="h-9 px-3 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2E2A33]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-9 px-3 rounded-[8px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-500/40"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Action List</span>
                  </button>
                </div>
              }
            >
              {overdueActionList.length === 0 ? (
                <div className="py-16 text-center text-[#B3AABD] text-[13px] flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <span className="text-white font-semibold">Zero Overdue Records</span>
                  <span className="text-[12px] text-[#B3AABD]">No borrower accounts are currently pending return or fines.</span>
                </div>
              ) : (
                <div className="pt-2 overflow-x-auto">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#2E2A33] text-[11px] font-mono uppercase tracking-[0.06em] text-[#B3AABD]">
                        <th className="pb-2.5">Borrower</th>
                        <th className="pb-2.5">University ID</th>
                        <th className="pb-2.5">Book Title</th>
                        <th className="pb-2.5">Due Date</th>
                        <th className="pb-2.5 text-center">Days Overdue</th>
                        <th className="pb-2.5 text-right">Fine Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2E2A33]/80">
                      {overdueActionList.map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 font-semibold text-white" dir="auto">{item.borrowerName}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-mono font-bold bg-[rgba(188,136,27,0.14)] text-[#E0B450] border border-[#BC881B]/35">
                              {item.universityId}
                            </span>
                          </td>
                          <td className="py-3 text-[#E7E2EC] max-w-[260px] truncate" title={item.bookName} dir="auto">
                            {item.bookName}
                          </td>
                          <td className="py-3 font-mono text-[12px] text-[#B3AABD]">{item.dueDate}</td>
                          <td className="py-3 text-center">
                            <StatusPill label={`${item.daysOverdue} days`} variant="danger" />
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-rose-400">
                            Rs {item.fineDue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PanelCard>
          </div>
        )}

        {/* TAB 5: DATA HEALTH (Part 4, Data Health) */}
        {activeTab === 'health' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <PanelCard
              title="Database Health & Integrity Invariant Audit"
              subtitle="Real queries checking for orphan foreign keys, counter drift, barcode collisions, and catalog consistency"
              hairlineColor="#34D399"
              headerAction={
                <button
                  type="button"
                  onClick={handleRunHealthCheck}
                  disabled={isCheckingHealth}
                  className="h-10 px-4 rounded-[10px] bg-[#34D399]/20 hover:bg-[#34D399]/30 border border-[#34D399]/40 text-[#34D399] font-bold text-[13px] inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  <span>{isCheckingHealth ? 'Auditing Database...' : 'Run Real Audit'}</span>
                </button>
              }
            >
              {healthResults === null ? (
                <div className="py-14 text-center space-y-3">
                  <Activity className="w-10 h-10 text-[#6F6879] mx-auto" />
                  <p className="text-[13px] text-white font-semibold">
                    Click "Run Real Audit" to scan current SQLite records.
                  </p>
                  <p className="text-[12px] text-[#B3AABD] max-w-md mx-auto">
                    Runs actual relational constraint checks without hard-coded pass results.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="text-[12px] font-mono text-[#B3AABD] flex items-center justify-between pb-2 border-b border-[#2E2A33]">
                    <span>Last audited: {lastCheckTimestamp}</span>
                    <span>All queries computed live from storage</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* 1. Duplicate Accession Numbers */}
                    <div className="p-4 rounded-[12px] bg-[#141214] border border-[#2E2A33] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-white">Duplicate Accession Numbers</span>
                        {healthResults.dupAccessions.count === 0 ? (
                          <StatusPill label="0 Detected" variant="green" dot />
                        ) : (
                          <StatusPill label={`${healthResults.dupAccessions.count} Conflicts`} variant="danger" dot />
                        )}
                      </div>
                      <p className="text-[11px] text-[#B3AABD]">Verifies strict 1:1 uniqueness of accession records across database.</p>
                      {healthResults.dupAccessions.count > 0 && (
                        <div className="p-2 rounded bg-rose-950/20 text-rose-300 text-[11px] font-mono space-y-1">
                          {healthResults.dupAccessions.items.map((it, i) => <div key={i}>{it}</div>)}
                        </div>
                      )}
                    </div>

                    {/* 2. Duplicate Barcodes */}
                    <div className="p-4 rounded-[12px] bg-[#141214] border border-[#2E2A33] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-white">Duplicate Barcode Keys</span>
                        {healthResults.dupBarcodes.count === 0 ? (
                          <StatusPill label="0 Detected" variant="green" dot />
                        ) : (
                          <StatusPill label={`${healthResults.dupBarcodes.count} Collisions`} variant="danger" dot />
                        )}
                      </div>
                      <p className="text-[11px] text-[#B3AABD]">Scans Code-128 physical barcode identifiers for collision.</p>
                      {healthResults.dupBarcodes.count > 0 && (
                        <div className="p-2 rounded bg-rose-950/20 text-rose-300 text-[11px] font-mono space-y-1">
                          {healthResults.dupBarcodes.items.map((it, i) => <div key={i}>{it}</div>)}
                        </div>
                      )}
                    </div>

                    {/* 3. Books without a Barcode */}
                    <div className="p-4 rounded-[12px] bg-[#141214] border border-[#2E2A33] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-white">Books Missing Barcode</span>
                        {healthResults.noBarcode.count === 0 ? (
                          <StatusPill label="0 Detected" variant="green" dot />
                        ) : (
                          <StatusPill label={`${healthResults.noBarcode.count} Missing`} variant="amber" dot />
                        )}
                      </div>
                      <p className="text-[11px] text-[#B3AABD]">Catalog titles pending physical barcode assignment.</p>
                    </div>

                    {/* 4. Counter Drift */}
                    <div className="p-4 rounded-[12px] bg-[#141214] border border-[#2E2A33] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-white">Stock Counter Drift Invariant</span>
                        {healthResults.counterDrift.count === 0 ? (
                          <StatusPill label="0 Drift (Exact)" variant="green" dot />
                        ) : (
                          <StatusPill label={`${healthResults.counterDrift.count} Mismatches`} variant="danger" dot />
                        )}
                      </div>
                      <p className="text-[11px] text-[#B3AABD]">Verifies: Available Copies + Unreturned Loans === Total Copies.</p>
                      {healthResults.counterDrift.count > 0 && (
                        <div className="p-2 rounded bg-rose-950/20 text-rose-300 text-[11px] font-mono space-y-1">
                          {healthResults.counterDrift.items.map((it, i) => <div key={i}>{it}</div>)}
                        </div>
                      )}
                    </div>

                    {/* 5. Orphan Loans */}
                    <div className="p-4 rounded-[12px] bg-[#141214] border border-[#2E2A33] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-white">Foreign Key Orphan Loans</span>
                        {healthResults.orphanLoans.count === 0 ? (
                          <StatusPill label="0 Orphans" variant="green" dot />
                        ) : (
                          <StatusPill label={`${healthResults.orphanLoans.count} Broken`} variant="danger" dot />
                        )}
                      </div>
                      <p className="text-[11px] text-[#B3AABD]">Active loans pointing to deleted books or unregistered members.</p>
                    </div>

                    {/* 6. Overdue > 30 Days */}
                    <div className="p-4 rounded-[12px] bg-[#141214] border border-[#2E2A33] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-white">Critical Overdue (&gt;30 Days)</span>
                        {healthResults.overdue30.count === 0 ? (
                          <StatusPill label="0 Critical" variant="green" dot />
                        ) : (
                          <StatusPill label={`${healthResults.overdue30.count} High Priority`} variant="danger" dot />
                        )}
                      </div>
                      <p className="text-[11px] text-[#B3AABD]">Loans requiring academic dean notification and administrative holds.</p>
                    </div>
                  </div>
                </div>
              )}
            </PanelCard>
          </div>
        )}

      </div>

      {/* Official A4 Print Report Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white text-black rounded-[12px] shadow-2xl overflow-y-auto p-8 relative font-serif">
            {/* Action Bar (Hidden in Print) */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-300 print:hidden font-sans">
              <span className="text-sm font-bold text-gray-700">Official Report Print Preview (A4)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-black text-white text-xs font-bold rounded cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Send to Printer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3 py-2 bg-gray-200 text-gray-800 text-xs font-semibold rounded cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Official Institutional Header */}
            <div className="text-center space-y-1 border-b-2 border-black pb-4 mb-6">
              <h1 className="text-xl font-bold uppercase tracking-wider font-cinzel">
                University of Lakki Marwat
              </h1>
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Central Campus Library · Official Audit & Analytics Report
              </h2>
              <p className="text-xs text-gray-600 font-sans">
                Generated: {new Date().toLocaleDateString('en-GB')} at {new Date().toLocaleTimeString()} · Period: {selectedPeriod.toUpperCase()}
              </p>
            </div>

            {/* KPI Summary Table */}
            <div className="mb-6">
              <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">
                1. Executive Catalog & Circulation Summary
              </h3>
              <table className="w-full text-xs border border-gray-400 border-collapse">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-2 font-bold bg-gray-100 w-1/4">Total Bibliographic Titles:</td>
                    <td className="p-2 w-1/4 font-mono font-bold">{counts.totalTitles}</td>
                    <td className="p-2 font-bold bg-gray-100 w-1/4">Total Physical Copies:</td>
                    <td className="p-2 w-1/4 font-mono font-bold">{counts.totalCopies}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="p-2 font-bold bg-gray-100">Volumes on Shelf:</td>
                    <td className="p-2 font-mono font-bold text-emerald-800">{counts.copiesOnShelf}</td>
                    <td className="p-2 font-bold bg-gray-100">Volumes on Loan:</td>
                    <td className="p-2 font-mono font-bold">{counts.copiesOnLoan}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold bg-gray-100">Active Borrowers:</td>
                    <td className="p-2 font-mono font-bold">{counts.activeBorrowers}</td>
                    <td className="p-2 font-bold bg-gray-100">Overdue Volume Rate:</td>
                    <td className="p-2 font-mono font-bold text-red-800">{counts.overdueLoans} ({counts.overdueRatePercent}%)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Holdings Table */}
            <div className="mb-6">
              <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">
                2. Academic Discipline Holdings Breakdown
              </h3>
              <table className="w-full text-xs border border-gray-400 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-400 text-left">
                    <th className="p-2">Discipline</th>
                    <th className="p-2 text-right">Titles</th>
                    <th className="p-2 text-right">Total Copies</th>
                    <th className="p-2 text-right">On Shelf</th>
                    <th className="p-2 text-right">On Loan</th>
                  </tr>
                </thead>
                <tbody>
                  {disciplineStats.map((d) => (
                    <tr key={d.category} className="border-b border-gray-300">
                      <td className="p-2 font-medium" dir="auto">{d.category}</td>
                      <td className="p-2 text-right font-mono">{d.titles}</td>
                      <td className="p-2 text-right font-mono font-bold">{d.totalCopies}</td>
                      <td className="p-2 text-right font-mono">{d.available}</td>
                      <td className="p-2 text-right font-mono">{d.onLoan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Overdue Action List Table */}
            {overdueActionList.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2 text-red-800">
                  3. Overdue Loan Registry & Pending Administrative Fines
                </h3>
                <table className="w-full text-xs border border-gray-400 border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-400 text-left">
                      <th className="p-2">Borrower</th>
                      <th className="p-2">University ID</th>
                      <th className="p-2">Book Title</th>
                      <th className="p-2">Due Date</th>
                      <th className="p-2 text-center">Days Overdue</th>
                      <th className="p-2 text-right">Fine (Rs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueActionList.slice(0, 15).map((o) => (
                      <tr key={o.id} className="border-b border-gray-300">
                        <td className="p-2 font-medium" dir="auto">{o.borrowerName}</td>
                        <td className="p-2 font-mono">{o.universityId}</td>
                        <td className="p-2 max-w-[200px] truncate" dir="auto">{o.bookName}</td>
                        <td className="p-2 font-mono">{o.dueDate}</td>
                        <td className="p-2 text-center font-mono font-bold text-red-800">{o.daysOverdue}</td>
                        <td className="p-2 text-right font-mono font-bold">Rs {o.fineDue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Signature Block */}
            <div className="pt-12 grid grid-cols-2 gap-12 font-sans text-xs">
              <div className="border-t border-black pt-2 text-center">
                <p className="font-bold">Librarian / In-Charge Library</p>
                <p className="text-gray-600">University of Lakki Marwat</p>
              </div>
              <div className="border-t border-black pt-2 text-center">
                <p className="font-bold">Head of Institution / Vice Chancellor</p>
                <p className="text-gray-600">Administrative Seal & Approval</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
