import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Search, 
  LayoutGrid, 
  List, 
  Plus, 
  ArrowRightLeft, 
  Edit3, 
  Printer, 
  Barcode as BarcodeIcon,
  MapPin,
  ExternalLink,
  BookMarked,
  Trash2,
  BarChart3,
  X,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileSpreadsheet,
  Building2,
  Sparkles,
  CheckSquare,
  Check,
  Library
} from 'lucide-react';
import { Book, Transaction } from '../types/library';
import { CatalogChartsView } from './catalog/CatalogChartsView';
import { AlmariView } from './catalog/AlmariView';
import { AlmariErrorBoundary } from './catalog/AlmariErrorBoundary';
import { BulkAssignModal } from './modals/BulkAssignModal';
import { KpiCard } from './shared/SharedCards';
import { AlmariService } from '../services/almariService';
import { sortBooksCatalog } from '../utils/almariSortUtils';
import { CountUp } from '@/components/ui/count-up';
import { CardSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import CustomSelect from './ui/CustomSelect';
import { EmptyStateBooksDeco } from './decorative/EmptyStateBooksDeco';
import { formatDisplayDate } from '../utils/dateUtils';
import { isArabicOrUrduScript, matchesUrduSearch } from '../utils/urduUtils';

interface BooksCatalogViewProps {
  books: Book[];
  transactions: Transaction[];
  initialViewMode?: 'grid' | 'list' | 'chart' | 'almari';
  onOpenAddBook: () => void;
  onSelectBook: (book: Book) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (book: Book) => void;
  onQuickLoan: (book: Book) => void;
  onPrintBarcode: (book: Book) => void;
  onOpenImportBookEntrySheet?: () => void;
  onOpenBatchLabelPrint?: () => void;
  onBooksUpdated?: (updatedBooks: Book[], message: string, batchId?: string) => void;
}

export const BooksCatalogView: React.FC<BooksCatalogViewProps> = ({
  books,
  transactions,
  initialViewMode,
  onOpenAddBook,
  onSelectBook,
  onEditBook,
  onDeleteBook,
  onQuickLoan,
  onPrintBarcode,
  onOpenImportBookEntrySheet,
  onOpenBatchLabelPrint,
  onBooksUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState('ALL');
  const [sortBy, setSortBy] = useState<string>(() => {
    return localStorage.getItem('ulm_lms_catalog_sort') || 'newest_added';
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [selectedAlmariFilter, setSelectedAlmariFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'chart' | 'almari'>(initialViewMode || 'grid');

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Bulk selection state
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [bulkModalMode, setBulkModalMode] = useState<'assign_group' | 'assign_almari' | 'suggest_all_unassigned' | null>(null);

  const toggleSelectBook = (bookId: string) => {
    setSelectedBookIds(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const next = new Set<string>();
    filteredBooks.forEach(b => next.add(b.id));
    setSelectedBookIds(next);
  };

  const handleClearSelection = () => {
    setSelectedBookIds(new Set());
  };

  const selectedBooksList = useMemo(() => {
    if (selectedBookIds.size === 0) return [];
    return books.filter(b => selectedBookIds.has(b.id));
  }, [books, selectedBookIds]);

  // Quick keyboard shortcut: Pressing "/" or Ctrl+F focuses the catalog search input
  useEffect(() => {
    const handleGlobalSearchKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (!isInput && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f'))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalSearchKey);
    return () => window.removeEventListener('keydown', handleGlobalSearchKey);
  }, []);

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    try {
      localStorage.setItem('ulm_lms_catalog_sort', newSort);
    } catch {
      // Ignore storage errors
    }
  };

  const handleToggleDateSort = () => {
    const next = sortBy === 'newest_added' ? 'oldest_added' : 'newest_added';
    handleSortChange(next);
  };

  const handleDownloadBookCsvTemplate = () => {
    const templateCsv = 'Barcode,ISBN,BookTitle,Author,Category,TotalCopies,Shelf,DeweyCallNumber,Publisher,Edition,Year,Language,DateAdded\r\n';
    const blob = new Blob([templateCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ULM_Books_Catalog_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute metrics from actual database
  const activeBooks = useMemo(() => books.filter(b => b.is_active), [books]);
  const totalTitles = activeBooks.length;
  const totalCopies = activeBooks.reduce((sum, b) => sum + b.total_quantity, 0);
  const totalAvailable = activeBooks.reduce((sum, b) => sum + b.available_quantity, 0);
  const activeBorrowed = totalCopies - totalAvailable;
  const availPercent = totalCopies > 0 ? Math.round((totalAvailable / totalCopies) * 100) : 100;

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return transactions.filter(t => t.status === 'OVERDUE' || (t.status === 'ACTIVE' && t.due_date < today)).length;
  }, [transactions]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(activeBooks.map(b => b.category));
    return Array.from(set);
  }, [activeBooks]);

  // Filtered & sorted books
  const filteredBooks = useMemo(() => {
    const filtered = activeBooks
      .filter(book => {
        const query = searchQuery.trim();
        const matchesQuery = !query || 
          matchesUrduSearch(query, book.search_text || `${book.book_name} ${book.author} ${book.barcode} ${book.accession_no || ''} ${book.isbn} ${book.dewey_call_number}`) ||
          (book.accession_no && book.accession_no.toLowerCase().includes(query.toLowerCase())) ||
          (book.shelf && book.shelf.toLowerCase().includes(query.toLowerCase())) ||
          (book.publisher && book.publisher.toLowerCase().includes(query.toLowerCase())) ||
          (book.title_roman && book.title_roman.toLowerCase().includes(query.toLowerCase())) ||
          (book.author_roman && book.author_roman.toLowerCase().includes(query.toLowerCase())) ||
          book.barcode.toLowerCase().includes(query.toLowerCase()) ||
          book.isbn.toLowerCase().includes(query.toLowerCase()) ||
          book.dewey_call_number.toLowerCase().includes(query.toLowerCase());

        const matchesCategory = selectedCategory === 'ALL' || book.category === selectedCategory;
        const matchesStatus = 
          selectedStatus === 'ALL' ||
          (selectedStatus === 'AVAILABLE' && book.available_quantity > 0) ||
          (selectedStatus === 'LOANED' && book.available_quantity === 0);

        const matchesLanguage = selectedLanguage === 'ALL' ||
          (selectedLanguage === 'Urdu' && (book.language === 'Urdu' || isArabicOrUrduScript(book.book_name))) ||
          (selectedLanguage === 'English' && (!book.language || book.language === 'English') && !isArabicOrUrduScript(book.book_name)) ||
          ((book.language || '').toLowerCase() === selectedLanguage.toLowerCase());

        const bookDate = book.date_added || (book.created_at ? book.created_at.split(' ')[0] : '');
        const matchesDateFrom = !dateFrom || (bookDate && bookDate >= dateFrom);
        const matchesDateTo = !dateTo || (bookDate && bookDate <= dateTo);

        // Group filter
        const matchesGroup = 
          selectedGroupFilter === 'ALL' ||
          (selectedGroupFilter === 'NO_GROUP' && !book.group_id) ||
          book.group_id === selectedGroupFilter;

        // Almari filter
        const matchesAlmari = 
          selectedAlmariFilter === 'ALL' ||
          (selectedAlmariFilter === 'NO_ALMARI' && !book.almari_id) ||
          book.almari_id === selectedAlmariFilter;

        return matchesQuery && matchesCategory && matchesStatus && matchesLanguage && matchesDateFrom && matchesDateTo && matchesGroup && matchesAlmari;
      });

    // Check if using the high-performance Almari/Dewey sort modes
    if (['almari_order', 'group_then_almari', 'dewey_decimal', 'shelf_location'].includes(sortBy)) {
      const groupsMap = new Map(AlmariService.getGroups().map(g => [g.id, g]));
      const almarisMap = new Map(AlmariService.getAlmaris().map(a => [a.id, a]));
      return sortBooksCatalog(filtered, sortBy, groupsMap, almarisMap);
    }

    return [...filtered].sort((a: Book, b: Book) => {
        if (sortBy === 'newest_added') {
          const dateA = a.date_added || (a.created_at ? a.created_at.split(' ')[0] : '1970-01-01');
          const dateB = b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '1970-01-01');
          if (dateA !== dateB) return dateB.localeCompare(dateA);

          // Tie 1: created_at
          const timeA = a.created_at || '';
          const timeB = b.created_at || '';
          if (timeA !== timeB) return timeB.localeCompare(timeA);

          // Tie 2: accession no. (numeric if possible, then string)
          const numA = parseInt((a.barcode.match(/\d+/) || ['0'])[0], 10);
          const numB = parseInt((b.barcode.match(/\d+/) || ['0'])[0], 10);
          if (numA !== numB) return numB - numA;
          return b.barcode.localeCompare(a.barcode);
        }

        if (sortBy === 'oldest_added') {
          const dateA = a.date_added || (a.created_at ? a.created_at.split(' ')[0] : '1970-01-01');
          const dateB = b.date_added || (b.created_at ? b.created_at.split(' ')[0] : '1970-01-01');
          if (dateA !== dateB) return dateA.localeCompare(dateB);

          // Tie 1: created_at
          const timeA = a.created_at || '';
          const timeB = b.created_at || '';
          if (timeA !== timeB) return timeA.localeCompare(timeB);

          // Tie 2: accession no. (numeric if possible, then string)
          const numA = parseInt((a.barcode.match(/\d+/) || ['0'])[0], 10);
          const numB = parseInt((b.barcode.match(/\d+/) || ['0'])[0], 10);
          if (numA !== numB) return numA - numB;
          return a.barcode.localeCompare(b.barcode);
        }

        if (sortBy === 'accession') {
          const numA = parseInt((a.barcode.match(/\d+/) || ['0'])[0], 10);
          const numB = parseInt((b.barcode.match(/\d+/) || ['0'])[0], 10);
          if (numA !== numB) return numA - numB;
          return a.barcode.localeCompare(b.barcode);
        }

        if (sortBy === 'accession_desc') {
          const numA = parseInt((a.barcode.match(/\d+/) || ['0'])[0], 10);
          const numB = parseInt((b.barcode.match(/\d+/) || ['0'])[0], 10);
          if (numA !== numB) return numB - numA;
          return b.barcode.localeCompare(a.barcode);
        }

        if (sortBy === 'title') {
          const keyA = a.title_sort || a.book_name;
          const keyB = b.title_sort || b.book_name;
          return keyA.localeCompare(keyB);
        }

        if (sortBy === 'title_desc') {
          const keyA = a.title_sort || a.book_name;
          const keyB = b.title_sort || b.book_name;
          return keyB.localeCompare(keyA);
        }

        if (sortBy === 'author') {
          const keyA = a.author_sort || a.author;
          const keyB = b.author_sort || b.author;
          return keyA.localeCompare(keyB);
        }

        if (sortBy === 'author_desc') {
          const keyA = a.author_sort || a.author;
          const keyB = b.author_sort || b.author;
          return keyB.localeCompare(keyA);
        }

        if (sortBy === 'copies') return b.total_quantity - a.total_quantity;
        if (sortBy === 'year') return b.publication_year - a.publication_year;
        return 0;
      });
  }, [activeBooks, searchQuery, selectedCategory, selectedStatus, selectedLanguage, selectedGroupFilter, selectedAlmariFilter, sortBy, dateFrom, dateTo]);

  // Generate SVG-like barcode bars based on barcode string (always high contrast in light & dark)
  const renderBarcodeStrip = (code: string) => {
    return (
      <div 
        className="barcode-container flex items-center gap-[1.5px] h-6 px-1.5 py-0.5 bg-white rounded-[4px] border border-white/20 select-none shadow-xs" 
        title={`Barcode: ${code}`}
        data-barcode-container="true"
      >
        {code.split('').map((char, idx) => {
          const num = parseInt(char, 10) || 3;
          const w = (num % 3) + 1;
          return (
            <div
              key={idx}
              className="barcode-bar h-full"
              style={{ width: `${w}px`, backgroundColor: '#000000', minWidth: '1px' }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 w-full bg-fluent-matrix px-6 sm:px-8 py-7 overflow-y-auto space-y-7">
      <div className="max-w-[1920px] mx-auto space-y-7">
        
        {/* Operational Collection Metrics (Restyled Shared KPI Cards with Playfair Display) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Cataloged Titles */}
          <KpiCard
            label="Cataloged Titles"
            value={totalTitles}
            note="Distinct records"
            icon={BookOpen}
            iconColor="#E0B450"
            accentColor="#BC881B"
            accentBarColor="#BC881B"
            subLabel={`Across ${categories.length} academic disciplines`}
          />

          {/* Card 2: Physical Volumes */}
          <KpiCard
            label="Physical Volumes"
            value={totalCopies}
            note="Physical items"
            icon={Layers}
            iconColor="#A66BC9"
            accentColor="#541A72"
            accentBarColor="#A66BC9"
            percentBar={{
              value: totalCopies,
              max: totalCopies,
              color: 'linear-gradient(90deg, #541A72, #A66BC9)',
            }}
            fractionTooltip={`${totalCopies.toLocaleString()} total physical inventory items`}
          />

          {/* Card 3: Shelf Availability */}
          <KpiCard
            label="Shelf Availability"
            value={totalAvailable}
            note="Available now"
            icon={CheckCircle2}
            iconColor="#34D399"
            accentColor="#10B981"
            accentBarColor="#34D399"
            percentBar={{
              value: totalAvailable,
              max: totalCopies,
              color: 'linear-gradient(90deg, #059669, #34D399)',
            }}
            fractionTooltip={`${totalAvailable.toLocaleString()} / ${totalCopies.toLocaleString()} volumes on shelf`}
          />

          {/* Card 4: Active Loans */}
          <KpiCard
            label="Active Loans"
            value={activeBorrowed}
            note={overdueCount > 0 ? `${overdueCount} overdue` : 'On loan'}
            icon={Clock}
            iconColor={activeBorrowed > 0 ? '#E0B450' : '#A66BC9'}
            accentColor="#BC881B"
            accentBarColor="#541A72"
            isGoldNumber={activeBorrowed > 0}
            isDanger={overdueCount > 0}
            percentBar={{
              value: activeBorrowed,
              max: totalCopies > 0 ? totalCopies : 1,
              color: overdueCount > 0 ? 'linear-gradient(90deg, #F43F5E, #FB7185)' : 'linear-gradient(90deg, #BC881B, #E0B450)',
            }}
            fractionTooltip={`${activeBorrowed.toLocaleString()} of ${totalCopies.toLocaleString()} volumes currently checked out`}
          />
        </div>

        {/* Filter & Search Action Bar */}
        <div className="bg-[#1E1B22]/90 backdrop-blur-md border border-white/[0.08] rounded-[16px] p-3 sm:p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-wrap items-center justify-between gap-3">
          {/* Left: Wide search input field with keyboard shortcut and clear action */}
          <div className="relative flex-1 min-w-[260px] sm:min-w-[320px]">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-150 ${
              isSearchFocused ? 'text-[#BC881B]' : 'text-[#B3AABD]'
            }`} />
            <input
              ref={searchInputRef}
              id="catalog-search-input"
              name="catalogSearch"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  e.stopPropagation();
                  setSearchQuery('');
                }
              }}
              placeholder="Search title, author, barcode, accession, ISBN..."
              aria-label="Search catalog books"
              autoComplete="off"
              spellCheck={false}
              className={`w-full h-10 bg-[#141214] hover:bg-[#1A181C] focus:bg-[#141214] border rounded-[10px] pl-10 pr-10 py-2 text-[13px] text-white placeholder:text-[#8E8698] transition-all duration-150 shadow-[0_1px_3px_rgba(0,0,0,0.3)] ${
                isSearchFocused
                  ? 'border-[#BC881B] ring-2 ring-[#BC881B]/25 outline-none'
                  : 'border-white/[0.08] hover:border-white/[0.18]'
              }`}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="w-6 h-6 flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 text-[#B3AABD] hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer rounded-[5px]"
                title="Clear search (Esc)"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : !isSearchFocused ? (
              <div
                className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-[#8E8698] pointer-events-none select-none"
              >
                <span>/</span>
              </div>
            ) : null}
          </div>

          {/* Center: Dropdown selects */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Category select */}
            <div className="w-48 min-w-[170px]">
              <CustomSelect
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
                options={[
                  { value: 'ALL', label: 'All Disciplines' },
                  ...categories.map(c => ({ value: c, label: c }))
                ]}
                searchable
                variant="dark"
              />
            </div>

            {/* Status select */}
            <div className="w-40 min-w-[145px]">
              <CustomSelect
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                options={[
                  { value: 'ALL', label: 'All Copies' },
                  { value: 'AVAILABLE', label: 'Available Now', badge: 'Ready' },
                  { value: 'LOANED', label: 'Fully Loaned', badge: 'Out' }
                ]}
                variant="dark"
              />
            </div>

            {/* Language filter select */}
            <div className="w-40 min-w-[145px]">
              <CustomSelect
                value={selectedLanguage}
                onChange={(val) => setSelectedLanguage(val)}
                options={[
                  { value: 'ALL', label: 'All Languages' },
                  { value: 'English', label: 'English' },
                  { value: 'Urdu', label: 'Urdu (اردو)', badge: 'Nastaliq' },
                  { value: 'Arabic', label: 'Arabic' },
                  { value: 'Pashto', label: 'Pashto' },
                ]}
                variant="dark"
              />
            </div>

            {/* Group filter select */}
            <div className="w-44 min-w-[150px]">
              <CustomSelect
                value={selectedGroupFilter}
                onChange={(val) => setSelectedGroupFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Groups' },
                  { value: 'NO_GROUP', label: 'No group (Unassigned)' },
                  ...AlmariService.getGroups().map(g => ({ value: g.id, label: g.name_en }))
                ]}
                searchable
                variant="dark"
              />
            </div>

            {/* Almari filter select */}
            <div className="w-44 min-w-[150px]">
              <CustomSelect
                value={selectedAlmariFilter}
                onChange={(val) => setSelectedAlmariFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Almaris' },
                  { value: 'NO_ALMARI', label: 'No almari' },
                  ...AlmariService.getAlmaris().map(a => ({ value: a.id, label: `${a.code} - ${a.name_en}` }))
                ]}
                searchable
                variant="dark"
              />
            </div>

            {/* Sort select */}
            <div className="w-56 min-w-[210px]">
              <CustomSelect
                value={sortBy}
                onChange={(val) => handleSortChange(val)}
                options={[
                  { value: 'newest_added', label: 'Sort: Newest Added' },
                  { value: 'oldest_added', label: 'Sort: Oldest Added' },
                  { value: 'almari_order', label: 'Sort: Almari order' },
                  { value: 'group_then_almari', label: 'Sort: Group, then Almari' },
                  { value: 'dewey_decimal', label: 'Sort: Call number (Dewey)' },
                  { value: 'shelf_location', label: 'Sort: Shelf location' },
                  { value: 'accession', label: 'Sort: Accession (Asc)' },
                  { value: 'accession_desc', label: 'Sort: Accession (Desc)' },
                  { value: 'title', label: 'Sort: Title (A-Z / الف تا ے)' },
                  { value: 'title_desc', label: 'Sort: Title (Z-A / ے تا الف)' },
                  { value: 'author', label: 'Sort: Author (A-Z)' },
                  { value: 'author_desc', label: 'Sort: Author (Z-A)' },
                  { value: 'copies', label: 'Sort: Total Copies' },
                  { value: 'year', label: 'Sort: Publication Year' }
                ]}
                variant="dark"
              />
            </div>

            {/* Date Added Filter Range */}
            <div className="h-10 flex items-center gap-2 bg-[#141214] border border-white/[0.08] rounded-[10px] px-3 text-[12px]">
              <Calendar className="w-4 h-4 text-[#BC881B] shrink-0" />
              <span className="text-[12px] text-[#B3AABD] font-mono">Added:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Date Added From"
                className="[color-scheme:dark] bg-transparent text-[12px] font-mono text-white focus:outline-none cursor-pointer"
              />
              <span className="text-[12px] text-[#B3AABD] font-mono px-0.5">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Date Added To"
                className="[color-scheme:dark] bg-transparent text-[12px] font-mono text-white focus:outline-none cursor-pointer"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center text-[#B3AABD] hover:text-white cursor-pointer ml-0.5 rounded-[6px]"
                  title="Clear date range"
                  aria-label="Clear date range"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Grid/List toggle + CSV Template + Add Book */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="h-10 flex items-center bg-[#141214] border border-white/[0.08] rounded-[10px] p-1 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                className={`btn-segmented flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-semibold transition-all duration-150 cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'btn-selected bg-[#BC881B] text-[#1A1A1A] font-bold shadow-[0_2px_8px_rgba(188,136,27,0.35)]' 
                    : 'text-[#B3AABD] hover:text-white hover:bg-white/[0.05]'
                }`}
                title="Switch to Card Grid View"
                aria-label="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="btn-label">Grid View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={`btn-segmented flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-semibold transition-all duration-150 cursor-pointer ${
                  viewMode === 'list' 
                    ? 'btn-selected bg-[#BC881B] text-[#1A1A1A] font-bold shadow-[0_2px_8px_rgba(188,136,27,0.35)]' 
                    : 'text-[#B3AABD] hover:text-white hover:bg-white/[0.05]'
                }`}
                title="Switch to Table List View"
                aria-label="List View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="btn-label">List View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                aria-pressed={viewMode === 'chart'}
                className={`btn-segmented flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-semibold transition-all duration-150 cursor-pointer ${
                  viewMode === 'chart' 
                    ? 'btn-selected bg-[#BC881B] text-[#1A1A1A] font-bold shadow-[0_2px_8px_rgba(188,136,27,0.35)]' 
                    : 'text-[#B3AABD] hover:text-white hover:bg-white/[0.05]'
                }`}
                title="Switch to Interactive Chart Analytics View"
                aria-label="Chart View"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="btn-label">Chart View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('almari')}
                aria-pressed={viewMode === 'almari'}
                className={`btn-segmented flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-semibold transition-all duration-150 cursor-pointer ${
                  viewMode === 'almari' 
                    ? 'btn-selected bg-[#BC881B] text-[#1A1A1A] font-bold shadow-[0_2px_8px_rgba(188,136,27,0.35)]' 
                    : 'text-[#B3AABD] hover:text-white hover:bg-white/[0.05]'
                }`}
                title="Switch to Almari & Shelves Visual View"
                aria-label="Almari View"
              >
                <Library className="w-3.5 h-3.5" />
                <span className="btn-label">Almari View</span>
              </button>
            </div>

            {/* Batch Barcode Labels Generator */}
            {onOpenBatchLabelPrint && (
              <button
                type="button"
                onClick={onOpenBatchLabelPrint}
                className="btn-secondary h-10 px-3.5 rounded-[10px] font-semibold text-[13px] inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs bg-[#BC881B]/15 hover:bg-[#BC881B]/25 text-[#E0B450] hover:text-white border border-[#BC881B]/40 hover:border-[#BC881B]/70 shadow-[0_2px_8px_rgba(188,136,27,0.12)] active:scale-[0.98]"
                title="Print batch thermal barcode labels for cataloged volumes"
              >
                <Printer className="w-4 h-4 text-[#E0B450] shrink-0" />
                <span className="btn-label hidden sm:inline">Batch Labels</span>
              </button>
            )}

            {/* Book Entry Sheet Importer */}
            {onOpenImportBookEntrySheet && (
              <button
                type="button"
                onClick={onOpenImportBookEntrySheet}
                className="btn-secondary h-10 px-3.5 rounded-[10px] font-semibold text-[13px] inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_2px_8px_rgba(16,185,129,0.12)] active:scale-[0.98]"
                title="Import catalog from ULM_Book_Entry_Sheet.xlsx"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="btn-label hidden sm:inline">Import Sheet</span>
              </button>
            )}

            {/* CSV Template Download */}
            <button
              type="button"
              onClick={handleDownloadBookCsvTemplate}
              className="btn-ghost h-10 px-3.5 rounded-[10px] font-semibold text-[13px] inline-flex items-center gap-2 transition-all border border-white/[0.12] cursor-pointer shadow-xs"
              title="Download official catalog CSV template with DateAdded column"
            >
              <Download className="w-4 h-4 text-[#BC881B] shrink-0" />
              <span className="btn-label hidden md:inline">CSV Template</span>
            </button>

            {/* Add Book Button matching header primary */}
            <button
              type="button"
              onClick={onOpenAddBook}
              className="btn-primary h-10 px-4 rounded-[10px] text-[13px] font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
              title="Catalog a new reference volume"
            >
              <Plus className="w-4 h-4 stroke-[3] shrink-0" />
              <span className="btn-label">+ Add Book</span>
            </button>
          </div>
        </div>

        {/* Floating/Sticky Selection Bar for Catalog Placement */}
        {selectedBookIds.size > 0 && (
          <div className="bg-[#221F26] border border-[#BC881B] rounded-[14px] p-3 sm:p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#BC881B] text-[#1A1A1A] font-extrabold flex items-center justify-center font-mono text-sm">
                {selectedBookIds.size}
              </div>
              <div>
                <span className="text-white font-bold text-sm">
                  {selectedBookIds.size} book{selectedBookIds.size !== 1 ? 's' : ''} selected
                </span>
                <span className="text-xs text-[#B3AABD] ml-2">
                  ({filteredBooks.length} match current filters)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedBookIds.size < filteredBooks.length && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-[#E0D8E6] rounded-lg text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                >
                  Select all {filteredBooks.length} matching filter
                </button>
              )}
              <button
                type="button"
                onClick={() => setBulkModalMode('assign_almari')}
                className="px-3.5 py-1.5 bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A] font-bold text-xs rounded-lg flex items-center gap-1.5 shadow transition-colors cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Place in Almari...</span>
              </button>
              <button
                type="button"
                onClick={() => setBulkModalMode('assign_group')}
                className="px-3 py-1.5 bg-[#541A72] hover:bg-[#6D2394] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 border border-[#A66BC9]/40 shadow transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Assign Group...</span>
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#B3AABD] hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Catalog Display: Almari View, Chart View, Grid View or List View */}
        {viewMode === 'almari' ? (
          <AlmariErrorBoundary fallbackTitle="Error loading Almari View" onReset={() => setViewMode('almari')}>
            <AlmariView
              books={books}
              onOpenBook={onSelectBook}
              onEditBook={onEditBook}
              onOpenSuggestModal={() => setBulkModalMode('suggest_all_unassigned')}
              selectedCatalogBookIds={selectedBookIds}
              onClearCatalogSelection={handleClearSelection}
              onCatalogBooksUpdated={(updated, msg, batchId) => {
                if (onBooksUpdated) onBooksUpdated(updated, msg, batchId);
              }}
            />
          </AlmariErrorBoundary>
        ) : viewMode === 'chart' ? (
          <CatalogChartsView
            books={books}
            transactions={transactions}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setViewMode('grid');
            }}
            onSwitchView={(mode) => setViewMode(mode)}
          />
        ) : filteredBooks.length === 0 ? (
          <div className="bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 space-y-3 shadow-2xs">
            <div className="flex items-center justify-center gap-3">
              <BookMarked className="w-12 h-12 text-slate-400 dark:text-slate-600" />
              <EmptyStateBooksDeco />
            </div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-200">No matching books found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              No titles match your active filter criteria. Try clearing your search keyword or switching category filters.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); setSelectedStatus('ALL'); }}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#1E293B] dark:hover:bg-[#334155] text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Reset Search Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* 4-column responsive grid of high-fidelity book cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredBooks.map((book, idx) => {
              const isAvailable = book.available_quantity > 0;
              const isLowStock = isAvailable && book.available_quantity <= 2;
              const issuedCount = book.total_quantity - book.available_quantity;
              const capacityPercent = book.total_quantity > 0 
                ? Math.min(100, Math.round((issuedCount / book.total_quantity) * 100)) 
                : 0;

              return (
                <div
                  key={book.id}
                  style={{ animationDelay: `${Math.min((idx % 12) * 35, 300)}ms` }}
                  className="book-card-enter rounded-[14px] bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden flex flex-col justify-between group transition-all duration-200 relative hover:-translate-y-[3px] hover:border-[#BC881B]/50 hover:shadow-[0_10px_28px_rgba(0,0,0,0.5),0_0_16px_rgba(188,136,27,0.2)] h-full"
                >
                  {/* Selection Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectBook(book.id);
                    }}
                    className={`absolute top-2.5 right-2.5 z-20 w-6 h-6 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                      selectedBookIds.has(book.id)
                        ? 'bg-[#BC881B] border-[#BC881B] text-[#1A1A1A] shadow-sm'
                        : 'bg-[#141214]/80 border-white/20 text-transparent hover:border-[#BC881B] hover:text-white/40'
                    }`}
                    title={selectedBookIds.has(book.id) ? 'Deselect book' : 'Select book for Almari placement'}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </button>

                  {/* Card Body */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    {/* Top Section: Thumbnail + Flexible Meta Info Header */}
                    <div className="flex gap-3.5 items-start">
                      {/* Book Cover Thumbnail with realistic spine (gold stripe) & ULM PRESS mark only */}
                      <div 
                        onClick={() => onSelectBook(book)}
                        className="w-[88px] min-h-[124px] shrink-0 rounded-[10px] overflow-hidden bg-[#141214] border border-white/[0.1] shadow-md relative group/cover cursor-pointer flex flex-col justify-between transition-transform duration-200 group-hover:scale-[1.02]"
                        title={book.book_name}
                      >
                        {/* Elegant Spine with Gold Stripe & ULM PRESS mark only on the spine */}
                        <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-[#8C600D] via-[#E0B450] to-[#BC881B] z-10 shadow-sm flex items-center justify-center">
                          <span className="font-mono text-[7px] text-[#1A1A1A] font-extrabold uppercase tracking-widest -rotate-90 select-none whitespace-nowrap">
                            ULM PRESS
                          </span>
                        </div>

                        {book.book_image_path ? (
                          <img
                            src={book.book_image_path}
                            alt={book.book_name}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover pl-3"
                            onError={(e) => {
                              // Zero-broken-image fallback to styled cover
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}

                        {/* Geometric styling fallback behind image - clean book pattern, NO title or call number printed over it */}
                        <div className="relative z-0 h-full w-full pl-3 min-h-[124px] flex items-center justify-center bg-gradient-to-br from-[#2B2730] to-[#1A1A1A]">
                          <BookOpen className="w-6 h-6 text-[#BC881B]/40 stroke-[1.5]" />
                        </div>
                      </div>

                      {/* Header Meta Info (flexible layout without fixed height clipping) */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between space-y-1.5">
                        <div className="space-y-1">
                          {/* Badges row with wrap support */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center text-[11px] font-semibold text-[#6FA8D2] bg-[#29658E]/20 border border-[#29658E]/40 px-2 py-0.5 rounded-[6px] shrink-0">
                              {book.category}
                            </span>
                            {(book.language === 'Urdu' || isArabicOrUrduScript(book.book_name)) ? (
                              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-700/60 px-2 py-0.5 rounded-[6px] shrink-0">
                                اردو · Nastaliq
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-mono text-[#B3AABD] shrink-0">
                                {book.language || 'English'}
                              </span>
                            )}
                            <span className="inline-flex items-center text-[11px] font-mono font-semibold text-[#E0B450] bg-[#BC881B]/15 border border-[#BC881B]/30 px-2 py-0.5 rounded-[6px] shrink-0">
                              {book.edition}
                            </span>
                          </div>

                          {/* Clamped 2-line title with tooltip and unclipped Urdu script support */}
                          <h4 
                            onClick={() => onSelectBook(book)}
                            dir="auto"
                            style={{ unicodeBidi: 'plaintext' }}
                            className={`font-bold text-white hover:text-[#E0B450] transition-colors mt-1 line-clamp-2 cursor-pointer min-h-[38px] ${
                              isArabicOrUrduScript(book.book_name) ? 'font-urdu text-[15px] leading-[2.1]' : 'text-[14px] leading-snug'
                            }`}
                            title={book.book_name}
                          >
                            {book.book_name}
                          </h4>
                          {book.title_roman && (
                            <p className="text-[11px] text-[#E0B450]/80 font-mono truncate" title={book.title_roman}>
                              ({book.title_roman})
                            </p>
                          )}

                          {/* Single-line author with ellipsis and tooltip */}
                          <p 
                            dir="auto"
                            style={{ unicodeBidi: 'plaintext' }}
                            className={`text-[12px] text-[#B3AABD] truncate ${
                              isArabicOrUrduScript(book.author) ? 'font-urdu leading-[2]' : ''
                            }`}
                            title={book.author}
                          >
                            by <span className="text-white font-medium">{book.author}</span>
                            {book.author_roman && (
                              <span className="text-[11px] text-[#B3AABD] font-mono ml-1">· {book.author_roman}</span>
                            )}
                          </p>
                        </div>

                        {/* Call number & Shelf location with pin icon (never hidden behind Added row) */}
                        <div 
                          className="text-[12px] text-[#B3AABD] flex items-center gap-1.5 pt-1"
                          title={`${book.shelf} · Row ${book.row}`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#29658E] shrink-0" />
                          <span className="truncate">{book.shelf} · Row {book.row}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Bottom Rows Container (pinned at bottom, equal row heights) */}
                    <div className="space-y-2 mt-auto pt-1">
                      {/* Metadata Row: Date Added & Dewey call number */}
                      <div className="flex items-center justify-between text-[12px] bg-[#141214]/80 rounded-[8px] px-3 py-1.5 border border-white/[0.06] h-[36px]">
                        <div className="truncate flex items-center gap-1.5 text-[#B3AABD] font-mono">
                          <Calendar className="w-3.5 h-3.5 text-[#BC881B] shrink-0" />
                          <span>Added:</span>
                          <span className="text-white font-medium">{formatDisplayDate(book.date_added || book.created_at)}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-[#E0B450] font-mono text-[11px] font-semibold bg-[#BC881B]/15 px-2 py-0.5 rounded-[6px] border border-[#BC881B]/25">
                            {book.dewey_call_number}
                          </span>
                        </div>
                      </div>

                      {/* Barcode Visual Strip & Monospace String */}
                      <div className="flex items-center justify-between gap-2 bg-[#141214]/80 rounded-[8px] px-3 py-1.5 border border-white/[0.06] h-[36px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <BarcodeIcon className="w-4 h-4 text-[#B3AABD] shrink-0" />
                          <span className="font-mono text-[12px] text-white font-semibold tracking-wider truncate">
                            {book.barcode}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {renderBarcodeStrip(book.barcode)}
                        </div>
                      </div>
                    </div>

                    {/* Availability Status & Capacity Bar (equal height) */}
                    <div className="flex items-center justify-between h-[36px] pt-0.5">
                      {!isAvailable ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[12px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          <span>Unavailable (0 copies)</span>
                        </div>
                      ) : isLowStock ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[12px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span>Low Stock ({book.available_quantity} copies)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[12px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Available ({book.available_quantity} copies)</span>
                        </div>
                      )}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[12px] text-[#B3AABD] font-mono tabular-nums">
                          {issuedCount} issued / {book.total_quantity} total
                        </span>
                        <div className="w-20 bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#BC881B] rounded-full transition-all duration-300" 
                            style={{ width: `${capacityPercent}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-3.5 py-2.5 bg-[#141214]/60 border-t border-white/[0.06] flex items-center justify-between gap-2 h-[52px]">
                    {/* Quick Loan Button */}
                    <button
                      onClick={() => onQuickLoan(book)}
                      disabled={!isAvailable}
                      className={`flex-1 h-9 min-h-[36px] flex items-center justify-center gap-2 py-1.5 px-3 rounded-[10px] text-[12px] font-bold transition-all duration-150 border cursor-pointer ${
                        isAvailable
                          ? 'border-[#BC881B] bg-[#BC881B]/15 text-[#E0B450] hover:bg-[#BC881B] hover:text-[#1A1A1A] hover:shadow-[0_2px_12px_rgba(188,136,27,0.35)] active:scale-95'
                          : 'border-transparent bg-[#2B1538] text-[#8B719B] cursor-not-allowed pointer-events-none'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0B450]`}
                      title={isAvailable ? 'Quickly issue a copy of this book' : 'No available copies left on shelf'}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                      <span className="btn-label">Quick Loan</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => onEditBook(book)}
                      className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-[#141214] border border-white/[0.08] text-[#B3AABD] hover:text-[#E0B450] hover:border-[#BC881B]/40 hover:bg-[#BC881B]/10 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] cursor-pointer"
                      title="Edit book details & inventory quantities"
                      aria-label="Edit book details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Barcode Print Button */}
                    <button
                      onClick={() => onPrintBarcode(book)}
                      className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-[#141214] border border-white/[0.08] text-[#B3AABD] hover:text-[#E0B450] hover:border-[#BC881B]/40 hover:bg-[#BC881B]/10 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] cursor-pointer"
                      title="Print official barcode sticker with campus insignia"
                      aria-label="Print official barcode sticker"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Book Button (turns red on hover) */}
                    <button
                      onClick={() => onDeleteBook(book)}
                      className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-[#141214] border border-white/[0.08] text-[#B3AABD] hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] cursor-pointer"
                      title="Delete or archive book"
                      aria-label="Delete book"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Details modal trigger */}
                    <button
                      onClick={() => onSelectBook(book)}
                      className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-[#141214] border border-white/[0.08] text-[#B3AABD] hover:text-[#6FA8D2] hover:border-[#29658E]/40 hover:bg-[#29658E]/10 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] cursor-pointer"
                      title="Full book specification & history"
                      aria-label="Full book specification & history"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View: Wide table on desktop, automatically switches to compact cards on narrow / restored screens (< 1024px) */
          <>
            <div className="hidden lg:block bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-[#020617] text-slate-600 dark:text-slate-400 uppercase font-mono-code text-[11px] border-b border-slate-200 dark:border-[#1E293B]">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={filteredBooks.length > 0 && selectedBookIds.size === filteredBooks.length}
                        onChange={(e) => {
                          if (e.target.checked) handleSelectAllFiltered();
                          else handleClearSelection();
                        }}
                        className="accent-[var(--gold)] cursor-pointer"
                        title="Select / Deselect all filtered books"
                      />
                    </th>
                    <th className="py-3 px-4">Book Title & Author</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Language</th>
                    <th className="py-3 px-4">Barcode / Call No</th>
                    <th 
                      onClick={handleToggleDateSort}
                      className="py-3 px-4 cursor-pointer hover:text-amber-300 transition-colors select-none"
                      title="Click to toggle sorting by Date Added"
                    >
                      <div className="flex items-center gap-1">
                        <span>Date Added</span>
                        {sortBy === 'newest_added' ? (
                          <ArrowDown className="w-3 h-3 text-amber-400" />
                        ) : sortBy === 'oldest_added' ? (
                          <ArrowUp className="w-3 h-3 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Total</th>
                    <th className="py-3 px-4 text-center">Available</th>
                    <th className="py-3 px-4 text-center">Issued</th>
                    <th className="py-3 px-4">Shelf / Row</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1E293B]">
                  {filteredBooks.map((book) => {
                    const isAvailable = book.available_quantity > 0;
                    const issued = book.total_quantity - book.available_quantity;
                    const isUrduBook = book.language === 'Urdu' || isArabicOrUrduScript(book.book_name);

                    return (
                      <tr key={book.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors min-h-[48px] h-[52px]">
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedBookIds.has(book.id)}
                            onChange={() => toggleSelectBook(book.id)}
                            className="accent-[var(--gold)] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-9 rounded bg-slate-800 border border-slate-700 shrink-0 overflow-hidden flex items-center justify-center font-cinzel text-[8px] text-amber-300 font-bold">
                              {book.book_name.slice(0, 3)}
                            </div>
                            <div className="min-w-0">
                              <p 
                                onClick={() => onSelectBook(book)}
                                dir="auto"
                                style={{ unicodeBidi: 'plaintext' }}
                                className={`font-semibold text-[#F1F5F9] hover:text-amber-600 dark:hover:text-amber-300 cursor-pointer truncate max-w-xs md:max-w-md ${
                                  isArabicOrUrduScript(book.book_name) ? 'font-urdu text-[15px] leading-[2.1]' : ''
                                }`}
                                title={book.book_name}
                              >
                                {book.book_name}
                                {book.title_roman && (
                                  <span className="text-[10px] text-amber-400/90 font-mono ml-2 font-normal">
                                    ({book.title_roman})
                                  </span>
                                )}
                              </p>
                              <p 
                                dir="auto"
                                style={{ unicodeBidi: 'plaintext' }}
                                className={`text-[11px] text-slate-400 mt-0.5 truncate ${
                                  isArabicOrUrduScript(book.author) ? 'font-urdu leading-[2]' : ''
                                }`}
                              >
                                {book.author}
                                {book.author_roman && (
                                  <span className="text-[10px] text-slate-500 font-mono ml-1.5">
                                    · {book.author_roman}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {book.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isUrduBook ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800">
                              اردو · Nastaliq
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {book.language || 'English'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-code">
                          <p className="text-[#F1F5F9] font-medium">{book.barcode}</p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{book.dewey_call_number}</p>
                        </td>
                        <td className="py-3 px-4 font-mono-code text-[11px] text-slate-300 whitespace-nowrap">
                          {formatDisplayDate(book.date_added || book.created_at)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono-code tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                          {book.total_quantity}
                        </td>
                        <td className="py-3 px-4 text-center font-mono-code tabular-nums font-bold">
                          <span className={isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {book.available_quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono-code tabular-nums text-slate-500 dark:text-slate-400">
                          {issued}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {book.shelf} · Row {book.row}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onQuickLoan(book)}
                              disabled={!isAvailable}
                              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                isAvailable
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                                  : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Loan</span>
                            </button>
                            <button
                              onClick={() => onEditBook(book)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-[#F1F5F9] border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              title="Edit"
                              aria-label="Edit title record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onPrintBarcode(book)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              title="Print Barcode"
                              aria-label="Print Barcode"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteBook(book)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-900 transition-colors cursor-pointer"
                              title="Delete Book"
                              aria-label="Delete Book"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* List View on Narrow / Restored Screens (< 1024px): Responsive Compact Card View */}
          <div className="lg:hidden flex flex-col gap-3">
            {filteredBooks.map((book) => {
              const isAvailable = book.available_quantity > 0;
              const issued = book.total_quantity - book.available_quantity;
              const isUrduBook = book.language === 'Urdu' || isArabicOrUrduScript(book.book_name);

              return (
                <div 
                  key={book.id} 
                  className="rounded-[12px] bg-[#1E1B22] border border-white/[0.08] p-3.5 flex flex-col gap-2.5 shadow-sm hover:border-[#BC881B]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedBookIds.has(book.id)}
                        onChange={() => toggleSelectBook(book.id)}
                        className="accent-[var(--gold)] cursor-pointer mt-1"
                        aria-label={`Select ${book.book_name}`}
                      />
                      <div className="min-w-0">
                        <h4 
                          onClick={() => onSelectBook(book)}
                          dir="auto"
                          style={{ unicodeBidi: 'plaintext' }}
                          className={`font-semibold text-[#F1F5F9] hover:text-[#E0B450] cursor-pointer truncate ${
                            isUrduBook ? 'font-urdu text-[15px] leading-relaxed' : 'text-[14px]'
                          }`}
                          title={book.book_name}
                        >
                          {book.book_name}
                          {book.title_roman && (
                            <span className="text-[11px] text-amber-400/90 font-mono ml-1.5 font-normal">
                              ({book.title_roman})
                            </span>
                          )}
                        </h4>
                        <p 
                          dir="auto"
                          style={{ unicodeBidi: 'plaintext' }}
                          className="text-[12px] text-slate-400 truncate mt-0.5"
                        >
                          {book.author}
                          {book.author_roman && (
                            <span className="text-[11px] text-slate-500 font-mono ml-1">· {book.author_roman}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isAvailable ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                      }`}>
                        {book.available_quantity}/{book.total_quantity} Avail
                      </span>
                    </div>
                  </div>

                  {/* Metadata Chips Row */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                      {book.category}
                    </span>
                    <span className="font-mono text-[#E0B450] bg-[#BC881B]/15 px-2 py-0.5 rounded border border-[#BC881B]/30">
                      {book.barcode}
                    </span>
                    <span className="font-mono text-slate-400">
                      {book.dewey_call_number}
                    </span>
                    <span className="text-slate-400">
                      📍 {book.shelf} · Row {book.row}
                    </span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
                    <span className="text-[11px] font-mono text-slate-400">
                      Added {formatDisplayDate(book.date_added || book.created_at)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onQuickLoan(book)}
                        disabled={!isAvailable}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isAvailable
                            ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                            : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Loan</span>
                      </button>
                      <button
                        onClick={() => onEditBook(book)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Edit"
                        aria-label="Edit title record"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onPrintBarcode(book)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Print Barcode"
                        aria-label="Print Barcode"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteBook(book)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                        title="Delete Book"
                        aria-label="Delete Book"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
        )}

        {/* Bulk Placement & Suggestion Modal */}
        {bulkModalMode && (
          <BulkAssignModal
            isOpen={!!bulkModalMode}
            onClose={() => setBulkModalMode(null)}
            selectedBooks={bulkModalMode === 'suggest_all_unassigned' ? books.filter(b => !b.almari_id && b.is_active) : selectedBooksList}
            allBooks={books}
            mode={bulkModalMode}
            onComplete={(updatedBooks, msg, batchId) => {
              setBulkModalMode(null);
              setSelectedBookIds(new Set());
              if (onBooksUpdated) onBooksUpdated(updatedBooks, msg, batchId);
            }}
          />
        )}
      </div>
    </div>
  );
};
