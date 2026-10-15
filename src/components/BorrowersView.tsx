import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  GraduationCap, 
  BookOpen, 
  AlertCircle,
  Building2,
  Trash2,
  Edit3,
  Printer,
  FileSpreadsheet,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Briefcase,
  ArrowRightLeft,
  FileDown,
  IdCard,
  CheckSquare,
  Square
} from 'lucide-react';
import { Borrower, Transaction, BorrowerRole, BorrowerStatus } from '../types/library';
import AddEditBorrowerModal from './modals/AddEditBorrowerModal';
import BorrowerDetailsModal from './modals/BorrowerDetailsModal';
import MemberCardPrintModal from './modals/MemberCardPrintModal';
import BorrowerCsvImportModal from './modals/BorrowerCsvImportModal';
import CustomSelect from './ui/CustomSelect';
import { PageHeaderCard } from './shared/PageHeaderCard';
import { SearchFilterBar } from './shared/SearchFilterBar';
import { ItemCard } from './shared/SharedCards';
import { StatusPill } from './shared/StatusPill';
import { DataTable, ColumnDef } from './shared/DataTable';
import { SharedCsvWriter } from '../utils/csvWriter';

interface BorrowersViewProps {
  borrowers: Borrower[];
  transactions: Transaction[];
  onAddBorrower: (borrower: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => { success: boolean; message: string; borrower?: Borrower; existingBorrowerId?: string };
  onUpdateBorrower?: (id: string, updates: Partial<Borrower>) => { success: boolean; message: string; borrower?: Borrower };
  onDeleteBorrower?: (borrower: Borrower) => void;
  onIssueBook?: (borrower: Borrower) => void;
  onOpenCirculationForBorrower?: (borrowerId: string) => void;
  onReturnLoan?: (transactionId: string) => void;
  onOpenBookDetails?: (bookId: string) => void;
  onBatchImportBorrowers?: (borrowers: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>[]) => { success: boolean; imported: number; errors: string[] };
  onReloadData?: () => void;
}

export const BorrowersView: React.FC<BorrowersViewProps> = ({
  borrowers,
  transactions,
  onAddBorrower,
  onUpdateBorrower,
  onDeleteBorrower,
  onIssueBook,
  onOpenCirculationForBorrower,
  onReturnLoan,
  onOpenBookDetails,
  onBatchImportBorrowers,
  onReloadData,
}) => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'All' | BorrowerRole>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | BorrowerStatus>('All');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);

  const [detailsBorrower, setDetailsBorrower] = useState<Borrower | null>(null);
  const [cardBorrower, setCardBorrower] = useState<Borrower | null>(null);
  const [batchCardMembers, setBatchCardMembers] = useState<Borrower[] | null>(null);
  const [selectedBorrowerIds, setSelectedBorrowerIds] = useState<Set<string>>(new Set());
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    borrowers.forEach(b => {
      if (b.department) set.add(b.department);
    });
    return Array.from(set).sort();
  }, [borrowers]);

  // Compute active & overdue loans per borrower
  const borrowerStats = useMemo(() => {
    const map = new Map<string, { active: number; overdue: number }>();
    borrowers.forEach(b => map.set(b.id, { active: 0, overdue: 0 }));

    transactions.forEach(t => {
      if (t.status !== 'RETURNED' && !t.return_date) {
        const stats = map.get(t.borrower_id) || { active: 0, overdue: 0 };
        stats.active += 1;
        if (t.status === 'OVERDUE' || (t.due_date && t.due_date < todayStr)) {
          stats.overdue += 1;
        }
        map.set(t.borrower_id, stats);
      }
    });

    return map;
  }, [borrowers, transactions, todayStr]);

  // Filtered list
  const filteredBorrowers = useMemo(() => {
    return borrowers.filter(b => {
      const q = searchQuery.toLowerCase().trim();
      const uid = (b.university_id || b.student_id || '').toLowerCase();
      const matchesQuery = !q ||
        b.name.toLowerCase().includes(q) ||
        uid.includes(q) ||
        (b.phone && b.phone.toLowerCase().includes(q)) ||
        (b.email && b.email.toLowerCase().includes(q)) ||
        (b.program && b.program.toLowerCase().includes(q));

      const matchesRole = selectedRole === 'All' || b.role === selectedRole;
      const matchesStatus = selectedStatus === 'All' || b.status === selectedStatus;
      const matchesDept = selectedDept === 'ALL' || b.department === selectedDept;

      return matchesQuery && matchesRole && matchesStatus && matchesDept;
    });
  }, [borrowers, searchQuery, selectedRole, selectedStatus, selectedDept]);

  // Actions
  const handleOpenAddModal = () => {
    setEditingBorrower(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (borrower: Borrower) => {
    setEditingBorrower(borrower);
    setIsAddEditModalOpen(true);
  };

  const handleOpenDetails = (borrowerId: string) => {
    const found = borrowers.find(b => b.id === borrowerId);
    if (found) {
      setDetailsBorrower(found);
    }
  };

  const handlePrintCard = (borrower: Borrower) => {
    setCardBorrower(borrower);
  };

  const handleDownloadCsvTemplate = () => {
    const sampleRows = [
      {
        University_ID: 'ULM-FA23-BCS-050',
        Name: 'Shahid Afridi',
        Role: 'Student',
        Department: 'Computer Science',
        Father_Name: 'Fazal Afridi',
        Program: 'BCS',
        Session: 'FA23',
        Semester: '4',
        Designation: '',
        Phone: '0300-1122334',
        Email: 'shahid.cs@ulm.edu.pk',
        Address: 'Lakki Marwat',
        Borrow_Limit: '3',
        Valid_Until: '2027-06-30',
        Status: 'active',
        Notes: 'Class FA23',
      },
      {
        University_ID: 'ULM-FAC-PHY-011',
        Name: 'Dr. Rehmat Ullah',
        Role: 'Faculty',
        Department: 'Physics',
        Father_Name: '',
        Program: '',
        Session: '',
        Semester: '',
        Designation: 'Assistant Professor',
        Phone: '0345-2233445',
        Email: 'rehmat.phy@ulm.edu.pk',
        Address: 'Bannu Road Campus',
        Borrow_Limit: '10',
        Valid_Until: '',
        Status: 'active',
        Notes: 'Faculty',
      },
      {
        University_ID: 'ULM-STF-ADM-004',
        Name: 'Muhammad Irfan',
        Role: 'Staff',
        Department: 'Management Sciences',
        Father_Name: '',
        Program: '',
        Session: '',
        Semester: '',
        Designation: 'Senior Clerk',
        Phone: '0312-5566778',
        Email: 'irfan.adm@ulm.edu.pk',
        Address: 'Admin Block ULM',
        Borrow_Limit: '5',
        Valid_Until: '',
        Status: 'active',
        Notes: 'Admin staff',
      },
    ];

    SharedCsvWriter.downloadCsv(sampleRows, 'ULM_Borrowers_Class_Import_Template.csv');
  };

  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Accent line by role (Part 3.3): Student gold, Faculty blue, Staff purple
  const getRoleAccentColor = (role?: BorrowerRole): string => {
    if (role === 'Faculty') return '#29658E';
    if (role === 'Staff') return '#541A72';
    return '#BC881B'; // Student (default)
  };

  const renderRolePill = (role?: BorrowerRole) => {
    if (role === 'Faculty') return <StatusPill label="Faculty" variant="blue" />;
    if (role === 'Staff') return <StatusPill label="Staff" variant="purple" />;
    return <StatusPill label="Student" variant="gold" />;
  };

  const renderStatusPill = (status?: BorrowerStatus) => {
    if (status === 'suspended') return <StatusPill label="Suspended" variant="amber" dot />;
    if (status === 'left') return <StatusPill label="Left" variant="muted" dot />;
    return <StatusPill label="Active" variant="green" dot />;
  };

  // Table Columns Definition (Part 3.4)
  const tableColumns: ColumnDef<Borrower>[] = [
    {
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={filteredBorrowers.length > 0 && selectedBorrowerIds.size === filteredBorrowers.length}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedBorrowerIds(new Set(filteredBorrowers.map(b => b.id)));
              } else {
                setSelectedBorrowerIds(new Set());
              }
            }}
            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-[#BC881B] focus:ring-0 cursor-pointer"
            title="Select all members on this page"
          />
        </div>
      ),
      width: '44px',
      cell: (b) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selectedBorrowerIds.has(b.id)}
            onChange={(e) => {
              e.stopPropagation();
              setSelectedBorrowerIds(prev => {
                const next = new Set(prev);
                if (next.has(b.id)) next.delete(b.id);
                else next.add(b.id);
                return next;
              });
            }}
            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-[#BC881B] focus:ring-0 cursor-pointer"
          />
        </div>
      ),
    },
    {
      header: 'Member',
      width: '260px',
      cell: (b) => {
        return (
          <div className="flex items-center gap-3 min-w-[200px]">
            {b.photo_url ? (
              <img
                src={b.photo_url}
                alt={b.name}
                className="w-10 h-10 rounded-full object-cover border border-[#A66BC9]/30 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#541A72]/25 border border-[#A66BC9]/30 text-[#C084FC] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                {getInitials(b.name)}
              </div>
            )}
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => handleOpenDetails(b.id)}
                className="text-[14px] font-semibold text-white hover:text-[#E0B450] text-left transition-colors cursor-pointer truncate max-w-[170px] block"
                title={b.name}
                dir="auto"
              >
                {b.name}
              </button>
              {b.father_name && (
                <span className="text-[11px] text-[#B3AABD] block truncate" dir="auto">
                  s/d of {b.father_name}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'University ID',
      width: '160px',
      cell: (b) => (
        <span className="px-2 py-0.5 rounded-[6px] text-[12px] font-mono font-bold bg-[rgba(188,136,27,0.14)] text-[#E0B450] border border-[#BC881B]/35">
          {b.university_id || b.student_id || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Role',
      width: '110px',
      cell: (b) => renderRolePill(b.role),
    },
    {
      header: 'Department & Program',
      cell: (b) => (
        <div className="min-w-[170px]">
          <span className="text-[13px] text-[#E7E2EC] block truncate" title={b.department}>
            {b.department || 'General'}
          </span>
          <span className="text-[11px] font-mono text-[#B3AABD] block truncate">
            {b.program || b.designation || 'Undergraduate'}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      width: '110px',
      cell: (b) => renderStatusPill(b.status),
    },
    {
      header: 'Books On Loan',
      width: '160px',
      cell: (b) => {
        const stats = borrowerStats.get(b.id) || { active: 0, overdue: 0 };
        const max = b.borrow_limit || 3;
        const pct = Math.min(100, Math.round((stats.active / max) * 100));
        const barColor = pct >= 100 ? '#FB7185' : pct >= 70 ? '#F59E0B' : '#34D399';

        return (
          <div className="space-y-1 min-w-[120px]">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white font-bold">{stats.active} / {max}</span>
              {stats.overdue > 0 && (
                <span className="text-rose-400 font-bold">{stats.overdue} overdue</span>
              )}
            </div>
            <div className="w-full bg-white/[0.08] h-1 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all" 
                style={{ width: `${pct}%`, backgroundColor: barColor }} 
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      width: '200px',
      cell: (b) => (
        <div className="flex items-center justify-end gap-2">
          {/* View */}
          <button
            type="button"
            onClick={() => handleOpenDetails(b.id)}
            className="h-9 px-3 rounded-[8px] bg-[#541A72] hover:bg-[#6A2290] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-[#A66BC9]/30"
            title="View member loan dossier"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">View</span>
          </button>

          {/* Issue Book */}
          {onIssueBook && (
            <button
              type="button"
              onClick={() => onIssueBook(b)}
              className="h-9 px-3 rounded-[8px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] text-[12px] font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-[#E0B450]/40"
              title="Issue book to this member"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Issue</span>
            </button>
          )}

          {/* Edit */}
          <button
            type="button"
            onClick={() => handleOpenEditModal(b)}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-[8px] border border-[#2E2A33] text-[#B3AABD] hover:text-[#6FA8D2] hover:border-[#29658E]/50 hover:bg-[rgba(111,168,210,0.12)] flex items-center justify-center transition-colors cursor-pointer"
            title="Edit member information"
            aria-label="Edit member"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          {/* Card */}
          <button
            type="button"
            onClick={() => handlePrintCard(b)}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-[8px] border border-[#2E2A33] text-[#B3AABD] hover:text-[#E0B450] hover:border-[#BC881B]/40 hover:bg-[rgba(188,136,27,0.14)] flex items-center justify-center transition-colors cursor-pointer"
            title="Print membership card badge"
            aria-label="Print library card"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          {onDeleteBorrower && (
            <button
              type="button"
              onClick={() => onDeleteBorrower(b)}
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-[8px] border border-[#2E2A33] text-[#B3AABD] hover:text-[#FB7185] hover:border-[#FB7185]/40 hover:bg-[rgba(251,113,133,0.12)] flex items-center justify-center transition-colors cursor-pointer"
              title="Delete member record"
              aria-label="Delete member"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-y-auto space-y-6">
      <div className="max-w-[1920px] mx-auto space-y-5">

        {/* 3.1 Header Card with people icon & ONE gold primary button */}
        <PageHeaderCard
          title="University Borrowers Directory"
          subtitle="Registered students, researchers, and campus faculty members with active library circulation privileges."
          icon={Users}
          actions={
            <>
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="h-10 px-3.5 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.12] text-[#E7E2EC] font-semibold text-[13px] border border-white/[0.1] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Download official student and faculty CSV template"
              >
                <Download className="w-4 h-4 text-[#BC881B]" />
                <span>CSV Template</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCsvModalOpen(true)}
                className="h-10 px-4 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-[13px] border border-[#A66BC9]/30 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                title="Bulk import entire class roster from CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#C084FC]" />
                <span>Import Class CSV...</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="h-10 px-4 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-[13px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all duration-150 inline-flex items-center gap-2 cursor-pointer"
                title="Register New Student or Faculty Member"
              >
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Add Person</span>
              </button>
            </>
          }
        />

        {/* 3.2 Search & Dropdown Filters Bar */}
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by student, University ID, phone, email, or degree program..."
          viewMode={viewMode}
          onViewModeChange={(mode) => setViewMode(mode as 'table' | 'grid')}
          viewModeLabels={{ grid: 'Grid View', list: 'Table View' }}
          filters={
            <>
              {/* Role filter */}
              <div className="w-36 min-w-[130px]">
                <CustomSelect
                  value={selectedRole}
                  onChange={(val) => setSelectedRole(val as any)}
                  options={[
                    { value: 'All', label: 'All Roles' },
                    { value: 'Student', label: 'Students' },
                    { value: 'Faculty', label: 'Faculty' },
                    { value: 'Staff', label: 'Staff' },
                  ]}
                  variant="dark"
                />
              </div>

              {/* Department filter */}
              <div className="w-48 min-w-[160px]">
                <CustomSelect
                  value={selectedDept}
                  onChange={(val) => setSelectedDept(val)}
                  options={[
                    { value: 'ALL', label: 'All Departments' },
                    ...departments.map(d => ({ value: d, label: d })),
                  ]}
                  searchable
                  variant="dark"
                />
              </div>

              {/* Status filter */}
              <div className="w-36 min-w-[130px]">
                <CustomSelect
                  value={selectedStatus}
                  onChange={(val) => setSelectedStatus(val as any)}
                  options={[
                    { value: 'All', label: 'All Statuses' },
                    { value: 'active', label: 'Active Status' },
                    { value: 'suspended', label: 'Suspended' },
                    { value: 'left', label: 'Left Campus' },
                  ]}
                  variant="dark"
                />
              </div>
            </>
          }
        />

        {/* 3.3 & 3.4 Members Display (Table View or Grid View) */}
        {filteredBorrowers.length === 0 ? (
          <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-12 text-center text-[#B3AABD] space-y-3 shadow-md">
            <Users className="w-12 h-12 mx-auto text-[#6F6879]" />
            <h4 className="text-base font-semibold text-white">No borrower records found</h4>
            <p className="text-xs text-[#B3AABD] max-w-md mx-auto">
              No campus members match your current search query and role/department filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedRole('All');
                setSelectedStatus('All');
                setSelectedDept('ALL');
              }}
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold rounded-[8px] border border-[#2E2A33] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              Reset Member Filters
            </button>
          </div>
        ) : (
          <>
            {/* Multi-Selection Batch Cards Export Toolbar */}
            {selectedBorrowerIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between p-3.5 rounded-[12px] bg-gradient-to-r from-[#2B2333] to-[#1E1B24] border border-[#BC881B]/50 shadow-xl text-xs gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#E0B450] animate-pulse" />
                  <span className="font-bold text-white tracking-wide">
                    {selectedBorrowerIds.size} of {filteredBorrowers.length} members selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBorrowerIds(new Set())}
                    className="text-[#B3AABD] hover:text-white underline ml-2 cursor-pointer font-medium"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBorrowerIds(new Set(filteredBorrowers.map(b => b.id)))}
                    className="text-[#E0B450] hover:text-white underline ml-1 cursor-pointer font-medium"
                  >
                    Select All ({filteredBorrowers.length})
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const selected = borrowers.filter(b => selectedBorrowerIds.has(b.id));
                      setBatchCardMembers(selected);
                    }}
                    className="px-4 py-2 rounded-[8px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-xs inline-flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Save & Print Member Cards PDF ({selectedBorrowerIds.size})</span>
                  </button>
                </div>
              </div>
            )}

            {viewMode === 'grid' ? (
          /* 3.3 Member Card (Grid View) - Minimum 300px with staggered animation */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {filteredBorrowers.map((b, idx) => {
              const stats = borrowerStats.get(b.id) || { active: 0, overdue: 0 };
              const max = b.borrow_limit || 3;
              const pct = Math.min(100, Math.round((stats.active / max) * 100));
              const barColor = pct >= 100 ? '#FB7185' : pct >= 70 ? '#F59E0B' : '#34D399';
              const roleAccent = getRoleAccentColor(b.role);

              return (
                <ItemCard
                  key={b.id}
                  className="relative flex flex-col justify-between p-4 space-y-3.5 min-h-[250px]"
                  style={
                    idx < 12
                      ? {
                          animation: `fadeUp 200ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 30}ms forwards`,
                        }
                      : undefined
                  }
                >
                  {/* 3px accent line on top by role: Student gold, Faculty blue, Staff purple */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ backgroundColor: roleAccent }}
                  />

                  {/* Top row: 44px Avatar, Name, University ID chip, and Role pill */}
                  <div className="flex items-start justify-between gap-3 pt-0.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {b.photo_url ? (
                        <img
                          src={b.photo_url}
                          alt={b.name}
                          className="w-11 h-11 rounded-full object-cover border border-[#A66BC9]/30 shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#541A72]/25 border border-[#A66BC9]/30 text-[#C084FC] flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                          {getInitials(b.name)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3
                          onClick={() => handleOpenDetails(b.id)}
                          className="text-[16px] font-semibold text-white hover:text-[#E0B450] cursor-pointer transition-colors truncate max-w-[150px] sm:max-w-[180px] leading-snug"
                          title={b.name}
                          dir="auto"
                        >
                          {b.name}
                        </h3>
                        <div className="mt-1">
                          <span className="px-2 py-0.5 rounded-[6px] text-[12px] font-mono font-bold bg-[rgba(188,136,27,0.14)] text-[#E0B450] border border-[#BC881B]/35 inline-block">
                            {b.university_id || b.student_id || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {renderRolePill(b.role)}
                    </div>
                  </div>

                  {/* Info block: 1px divider, department with icon (13px body color), program (mono 12px muted) */}
                  <div className="pt-2 border-t border-[#2E2A33] space-y-1">
                    <div className="flex items-center gap-1.5 text-[13px] text-[#E7E2EC] truncate">
                      <Building2 className="w-3.5 h-3.5 text-[#B3AABD] shrink-0" />
                      <span className="truncate">{b.department || 'General Campus'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#B3AABD] truncate">
                      <GraduationCap className="w-3.5 h-3.5 text-[#B3AABD] shrink-0" />
                      <span className="truncate">{b.program || b.designation || 'Undergraduate'}</span>
                    </div>
                  </div>

                  {/* Loan Capacity & Status Row */}
                  <div className="pt-2 border-t border-[#2E2A33] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#B3AABD]">Books on loan</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-mono text-white font-bold tabular-nums">
                          {stats.active} / {max}
                        </span>
                        {renderStatusPill(b.status)}
                      </div>
                    </div>

                    {/* 4px Progress Bar */}
                    <div className="w-full bg-white/[0.08] h-1 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>

                  {/* Actions Group (View, Issue Book, Edit, Card, Delete) */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#2E2A33]">
                    {/* View */}
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(b.id)}
                      className="h-9 px-3 rounded-[8px] bg-[#541A72] hover:bg-[#6A2290] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#A66BC9]/30"
                      title="View member loan record"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>

                    {/* Issue Book */}
                    {onIssueBook && (
                      <button
                        type="button"
                        onClick={() => onIssueBook(b)}
                        className="h-9 px-3 rounded-[8px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-[0_2px_10px_rgba(188,136,27,0.3)] cursor-pointer border border-[#E0B450]/40"
                        title="Open Issue Book flow for this member"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Issue</span>
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(b)}
                      className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-[8px] border border-[#2E2A33] text-[#B3AABD] hover:text-[#6FA8D2] hover:border-[#29658E]/50 hover:bg-[rgba(111,168,210,0.12)] flex items-center justify-center transition-colors cursor-pointer"
                      title="Edit member details"
                      aria-label="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Card */}
                    <button
                      type="button"
                      onClick={() => handlePrintCard(b)}
                      className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-[8px] border border-[#2E2A33] text-[#B3AABD] hover:text-[#E0B450] hover:border-[#BC881B]/40 hover:bg-[rgba(188,136,27,0.14)] flex items-center justify-center transition-colors cursor-pointer"
                      title="Print library borrower card"
                      aria-label="Card"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    {onDeleteBorrower && (
                      <button
                        type="button"
                        onClick={() => onDeleteBorrower(b)}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-[8px] border border-[#2E2A33] text-[#B3AABD] hover:text-[#FB7185] hover:border-[#FB7185]/40 hover:bg-[rgba(251,113,133,0.12)] flex items-center justify-center transition-colors cursor-pointer ml-auto"
                        title="Delete member"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </ItemCard>
              );
            })}
          </div>
        ) : (
          /* 3.4 Table View (52px rows) */
          <DataTable
            data={filteredBorrowers}
            columns={tableColumns}
            keyExtractor={(b) => b.id}
            rowHeightClass="min-h-[52px]"
          />
        )}
        </>
      )}

      </div>

      {/* Sub-modals */}
      {isAddEditModalOpen && (
        <AddEditBorrowerModal
          isOpen={isAddEditModalOpen}
          borrowerToEdit={editingBorrower}
          allBorrowers={borrowers}
          onClose={() => {
            setIsAddEditModalOpen(false);
            setEditingBorrower(null);
          }}
          onSave={(data) => {
            if (editingBorrower && onUpdateBorrower) {
              const res = onUpdateBorrower(editingBorrower.id, data);
              if (res.success) {
                setIsAddEditModalOpen(false);
                setEditingBorrower(null);
              }
              return res;
            } else {
              const res = onAddBorrower(data);
              if (res.success) {
                setIsAddEditModalOpen(false);
              }
              return res;
            }
          }}
        />
      )}

      {detailsBorrower && (
        <BorrowerDetailsModal
          isOpen={Boolean(detailsBorrower)}
          borrower={detailsBorrower}
          transactions={transactions}
          onClose={() => setDetailsBorrower(null)}
          onIssueBook={(b) => {
            if (onOpenCirculationForBorrower) {
              onOpenCirculationForBorrower(b.id);
            }
            setDetailsBorrower(null);
          }}
          onReturnLoan={(tId) => {
            if (onReturnLoan) onReturnLoan(tId);
          }}
          onOpenBookDetails={(bookId) => {
            if (onOpenBookDetails) onOpenBookDetails(bookId);
          }}
        />
      )}

      {(cardBorrower || batchCardMembers) && (
        <MemberCardPrintModal
          isOpen={Boolean(cardBorrower || batchCardMembers)}
          borrower={cardBorrower}
          members={batchCardMembers || undefined}
          onClose={() => {
            setCardBorrower(null);
            setBatchCardMembers(null);
          }}
        />
      )}

      {isCsvModalOpen && (
        <BorrowerCsvImportModal
          isOpen={isCsvModalOpen}
          onClose={() => setIsCsvModalOpen(false)}
          onImportComplete={() => {
            if (onReloadData) onReloadData();
          }}
          onBatchImport={(rows) => {
            if (onBatchImportBorrowers) {
              return onBatchImportBorrowers(rows);
            }
            return { success: false, imported: 0, errors: ['No import handler configured'] };
          }}
        />
      )}
    </div>
  );
};

export default BorrowersView;
