import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Database,
  ArrowDownToLine,
  HardDrive,
  RefreshCw,
  FileCheck,
  Layers,
  Users,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  Laptop
} from 'lucide-react';
import { Book, Borrower, Transaction, HistoryEntry } from '../types/library';
import { LibraryStorage } from '../services/storage';
import { ImporterEngine } from '../services/importerEngine';
import { LibraryDataFilesService } from '../services/libraryDataFilesService';
import { UsbBackupService } from '../services/usbBackupService';
import { SharedCsvWriter } from '../utils/csvWriter';
import { PageHeaderCard } from './shared/PageHeaderCard';
import { TabCards, TabCardItem } from './shared/TabCards';
import { PanelCard } from './shared/SharedCards';
import { StatusPill } from './shared/StatusPill';

export type MigrationTabId = 'import' | 'move' | 'export';

interface ExcelCenterProps {
  books: Book[];
  borrowers: Borrower[];
  transactions: Transaction[];
  history: HistoryEntry[];
  onRefreshData: () => void;
  onOpenImportEntrySheet?: () => void;
  onOpenTransferZipModal?: () => void;
}

export const ExcelCenterView: React.FC<ExcelCenterProps> = ({
  books,
  borrowers,
  transactions,
  history,
  onRefreshData,
  onOpenImportEntrySheet,
  onOpenTransferZipModal,
}) => {
  const [activeTab, setActiveTab] = useState<MigrationTabId>('import');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [migrationStats, setMigrationStats] = useState<{ books: number; borrowers: number; transactions: number } | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccessMorph, setIsSuccessMorph] = useState(false);

  // Collapsed sections in Tab 2
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const todayStr = new Date().toISOString().split('T')[0];

  // TAB 1: Blank Entry Sheet
  const handleDownloadBlankEntrySheet = async () => {
    try {
      const blob = await ImporterEngine.generateBlankEntrySheet();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ULM_Book_Entry_Sheet.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setImportError(`Failed to generate entry sheet: ${e.message}`);
    }
  };

  // TAB 3: Comprehensive LibraryData.xlsx
  const handleDownloadLibraryData = async () => {
    try {
      await LibraryDataFilesService.downloadLibraryDataXlsx();
      setImportStatus('Generated and downloaded comprehensive LibraryData.xlsx workbook.');
    } catch (e: any) {
      setImportError(`Failed to download LibraryData.xlsx: ${e.message}`);
    }
  };

  // TAB 2: Transfer ZIP
  const handleExportZipArchive = async () => {
    setIsProcessing(true);
    try {
      const res = await UsbBackupService.exportToUsb((pct, stage) => {
        setImportStatus(`Creating ZIP Transfer Archive (${pct}%): ${stage}`);
      });
      if (res.success) {
        setImportStatus(`ZIP Transfer Archive saved successfully (${res.filename}).`);
        setIsSuccessMorph(true);
        setTimeout(() => setIsSuccessMorph(false), 1200);
      } else {
        setImportError(res.message);
      }
    } catch (e: any) {
      setImportError(`ZIP transfer export failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // TAB 2: Master PC-to-PC Migration Exports
  const handleExportMasterCsv = () => {
    LibraryStorage.exportMasterMigrationCsv();
    setImportStatus('Generated Master Migration CSV package. Transfer this file to your other PC via USB or network.');
  };

  const handleExportMasterJson = () => {
    LibraryStorage.exportMasterMigrationJson();
    setImportStatus('Generated complete SQLite JSON database clone. Transfer this file to your other PC for setup.');
  };

  // TAB 3: Dedicated Departmental Sheet Exports using SharedCsvWriter
  const handleExportBooks = () => {
    const data = books.filter(b => b.is_active).map(b => ({
      Barcode: b.barcode,
      AccessionNo: b.accession_no || '',
      ISBN: b.isbn,
      BookTitle: b.book_name,
      Author: b.author,
      Category: b.category,
      Language: b.language || 'English',
      TitleRoman: b.title_roman || '',
      AuthorRoman: b.author_roman || '',
      Publisher: b.publisher,
      TotalCopies: b.total_quantity,
      AvailableCopies: b.available_quantity,
      IssuedCopies: Math.max(0, b.total_quantity - b.available_quantity),
      Shelf: b.shelf,
      Row: b.row,
      CallNumber: b.dewey_call_number,
      DateAdded: b.date_added || (b.created_at ? b.created_at.split(' ')[0] : todayStr),
    }));
    SharedCsvWriter.downloadCsv(data, `ULM_Books_Catalog_${todayStr}.csv`);
  };

  const handleExportBorrowers = () => {
    const data = borrowers.filter(b => b.is_active).map(b => ({
      UniversityID: b.university_id || b.student_id,
      FullName: b.name,
      Role: b.role,
      Department: b.department,
      Program: b.program || '',
      Phone: b.phone,
      Email: b.email,
      Status: b.status,
    }));
    SharedCsvWriter.downloadCsv(data, `ULM_Borrowers_Register_${todayStr}.csv`);
  };

  const handleExportTransactions = () => {
    const data = transactions.map(t => ({
      TransactionID: t.id,
      Barcode: t.barcode,
      BookTitle: t.book_name,
      BorrowerName: t.borrower_name,
      UniversityID: t.student_id,
      Action: t.action,
      IssueDate: t.issue_date,
      DueDate: t.due_date,
      ReturnDate: t.return_date || 'N/A',
      Status: t.status,
    }));
    SharedCsvWriter.downloadCsv(data, `ULM_Circulation_Ledger_${todayStr}.csv`);
  };

  const handleExportHistory = () => {
    const data = history.map(h => ({
      ID: h.id,
      Action: h.action,
      Description: h.description,
      Barcode: h.barcode,
      User: h.user,
      Timestamp: h.created_at,
    }));
    SharedCsvWriter.downloadCsv(data, `ULM_Audit_Log_${todayStr}.csv`);
  };

  // Master Ingestion from uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportStatus(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setImportError('File is empty or could not be read.');
        setIsProcessing(false);
        return;
      }
      setCsvText(content);
      executeMigration(content);
    };
    reader.onerror = () => {
      setImportError('Failed to read migration file.');
      setIsProcessing(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Ingestion Execution
  const executeMigration = (rawText: string) => {
    setIsProcessing(true);
    setImportStatus(null);
    setImportError(null);

    try {
      const res = LibraryStorage.importMasterMigrationFile(rawText, importMode);
      if (res.success) {
        setImportStatus(res.message);
        setMigrationStats(res.stats);
        setIsSuccessMorph(true);
        setTimeout(() => setIsSuccessMorph(false), 1200);
        onRefreshData();
      } else {
        setImportError(res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(`Migration process failed: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadSampleMigrationFile = () => {
    const sample = `# ====================================================================
# UNIVERSITY OF LAKKI MARWAT - LIBRARY MANAGEMENT SYSTEM (LMS)
# MASTER PC-TO-PC DATA MIGRATION PACKAGE (SAMPLE TEST FILE)
# ====================================================================

# === SECTION: SETTINGS ===
StationID,LibraryName,UniversityName,CampusAddress,Phone,Email,ScannerSound,ErrorSound,WalMode
"LMS-WIN-02","Central Campus Library","University of Lakki Marwat","Lakki Marwat, KPK","+92-969-510015","library@ulm.edu.pk",true,true,true

# === SECTION: BOOKS ===
Barcode,ISBN,BookTitle,Author,Category,TotalCopies,AvailableCopies,Shelf,Row,DeweyCallNumber,Publisher,Edition,Year,Language,IsActive
"9780262033848","978-0262033848","Introduction to Algorithms","Thomas H. Cormen","Computer Science",8,7,"CS-Rack-05","2","518.1 COR","MIT Press","4th Edition",2022,"English",1
"9789694151014","978-9694151014","بانگِ درا","علامہ محمد اقبال","Urdu Literature",6,5,"URDU-Rack-01","1","891.4391 IQB","اقبال اکادمی پاکستان","1st Edition",2021,"Urdu",1
"9780134685991","978-0134685991","Effective Java","Joshua Bloch","Computer Science",5,5,"CS-Rack-06","1","005.133 BLO","Addison-Wesley","3rd Edition",2018,"English",1
"9780199535569","978-0199535569","Principles of Islamic Jurisprudence","Mohammad Hashim Kamali","Islamic Studies",7,6,"IS-Rack-01","1","297.14 KAM","Islamic Texts","3rd Edition",2021,"English",1

# === SECTION: BORROWERS ===
StudentID,FullName,Department,Program,ClassName,Phone,Email,IsActive
"ULM-2023-CS-0101","Muhammad Tariq Khan","Computer Science","BS Computer Science","BS-CS-7A","0345-9876543","tariq.khan@ulm.edu.pk",1
"ULM-2023-ENG-0202","Ayesha Bibi","Electrical Engineering","BS Electrical","BSEE-5B","0333-1234567","ayesha.bibi@ulm.edu.pk",1
"ULM-2022-ISL-0303","Hafiz Bilal Ahmad","Islamic Studies","MPhil Islamic Studies","MPHIL-1","0300-5551234","bilal.ahmad@ulm.edu.pk",1

# === SECTION: TRANSACTIONS ===
TransactionID,Barcode,BookTitle,BorrowerName,StudentID,Action,IssueDate,DueDate,ReturnDate,Quantity,Status
"tx-sample-001","9780262033848","Introduction to Algorithms","Muhammad Tariq Khan","ULM-2023-CS-0101","ISSUE","${todayStr}","2026-10-10","N/A",1,"ACTIVE"`;
    setCsvText(sample);
  };

  const tabs: TabCardItem<MigrationTabId>[] = [
    { id: 'import', label: 'Import Books', icon: FileSpreadsheet },
    { id: 'move', label: 'Move to Another PC', icon: Laptop },
    { id: 'export', label: 'Export Spreadsheets', icon: Download },
  ];

  return (
    <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-y-auto space-y-6">
      <div className="max-w-[1920px] mx-auto space-y-5">

        {/* Page Header Card (Part 5) */}
        <PageHeaderCard
          title="Excel & PC Migration"
          subtitle="Import books, move the library to another PC, and export spreadsheets."
          icon={FileSpreadsheet}
        />

        {/* Three LABEL Tabs (Part 5) */}
        <TabCards
          variant="label"
          items={tabs}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id)}
        />

        {/* Status / Error Banner */}
        {importStatus && (
          <div className="p-4 rounded-[12px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{importStatus}</span>
            </div>
            {migrationStats && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20 text-center font-mono">
                <div className="p-2 rounded bg-emerald-950/40">
                  <span className="block text-[10px] text-emerald-400">Books Loaded</span>
                  <span className="text-base font-bold text-white">{migrationStats.books}</span>
                </div>
                <div className="p-2 rounded bg-emerald-950/40">
                  <span className="block text-[10px] text-emerald-400">Members Loaded</span>
                  <span className="text-base font-bold text-white">{migrationStats.borrowers}</span>
                </div>
                <div className="p-2 rounded bg-emerald-950/40">
                  <span className="block text-[10px] text-emerald-400">Loans Restored</span>
                  <span className="text-base font-bold text-white">{migrationStats.transactions}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {importError && (
          <div className="p-3.5 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{importError}</span>
          </div>
        )}

        {/* TAB 1: IMPORT BOOKS */}
        {activeTab === 'import' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <PanelCard
              title={
                <div className="flex items-center gap-2">
                  <StatusPill label="Entry sheet" variant="gold" />
                  <span className="text-base font-bold text-white">Book Entry Sheet Import</span>
                </div>
              }
              hairlineColor="#BC881B"
            >
              <div className="space-y-4 pt-1">
                <p className="text-[13px] text-[#E7E2EC] leading-relaxed">
                  The official <strong>ULM_Book_Entry_Sheet.xlsx</strong> spreadsheet contains 3,000 pre-formatted rows for entering library acquisitions with dropdown validations.
                  Physical barcodes and accession identifiers are assigned automatically upon import.
                </p>

                {/* Buttons in one row: Import (Gold Primary) and Blank (Secondary) */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {onOpenImportEntrySheet ? (
                    <button
                      type="button"
                      onClick={onOpenImportEntrySheet}
                      className="h-10 px-5 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-[13px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all duration-150 inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      <span>Import Book Entry Sheet (.xlsx)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-10 px-5 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-[13px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all duration-150 inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      <span>Import Book Entry Sheet (.xlsx)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadBlankEntrySheet}
                    className="h-10 px-4 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-[13px] border border-[#A66BC9]/30 transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
                  >
                    <Download className="w-4 h-4 text-[#C084FC]" />
                    <span>Blank Entry Sheet (.xlsx)</span>
                  </button>
                </div>
              </div>
            </PanelCard>
          </div>
        )}

        {/* TAB 2: MOVE TO ANOTHER PC */}
        {activeTab === 'move' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Horizontal 3-Step Stepper with connecting line and numbered badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
              {/* Step 1 */}
              <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-5 flex flex-col justify-between space-y-4 relative overflow-hidden shadow-md">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#BC881B]/20 border border-[#BC881B]/40 text-[#E0B450] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <h4 className="text-[14px] font-bold text-white uppercase tracking-wider font-cinzel">
                      Step 1: Export from this PC
                    </h4>
                  </div>
                  <p className="text-[12px] text-[#B3AABD] leading-relaxed">
                    Packages all local library records, active borrower accounts, book barcodes, and SQLite database tables into a single Transfer ZIP archive.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportZipArchive}
                  disabled={isProcessing}
                  className="w-full h-10 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] text-[#1A1A1A] font-bold text-[13px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] border border-[#E0B450]/40 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Export Transfer ZIP</span>
                </button>
              </div>

              {/* Step 2 */}
              <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-5 flex flex-col justify-between space-y-4 relative overflow-hidden shadow-md">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#29658E]/20 border border-[#29658E]/40 text-[#6FA8D2] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <h4 className="text-[14px] font-bold text-white uppercase tracking-wider font-cinzel">
                      Step 2: Install app on new PC
                    </h4>
                  </div>
                  <p className="text-[12px] text-[#B3AABD] leading-relaxed">
                    Copy the Transfer ZIP to a USB flash drive. Launch the LMS application on the destination computer and open this Migration screen.
                  </p>
                </div>

                <div className="p-2.5 rounded-[8px] bg-white/[0.04] text-[11px] font-mono text-[#B3AABD] text-center border border-white/[0.06]">
                  Ready on Destination Workstation
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-5 flex flex-col justify-between space-y-4 relative overflow-hidden shadow-md">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#541A72]/30 border border-[#A66BC9]/40 text-[#C084FC] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <h4 className="text-[14px] font-bold text-white uppercase tracking-wider font-cinzel">
                      Step 3: Restore on new PC
                    </h4>
                  </div>
                  <p className="text-[12px] text-[#B3AABD] leading-relaxed">
                    Select the Transfer ZIP archive from your USB drive to restore library data, active circulation loans, and user configuration.
                  </p>
                </div>

                {onOpenTransferZipModal ? (
                  <button
                    type="button"
                    onClick={onOpenTransferZipModal}
                    className="w-full h-10 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-[13px] border border-[#A66BC9]/30 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-4 h-4 text-[#C084FC]" />
                    <span>Restore Transfer ZIP</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-[13px] border border-[#A66BC9]/30 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-4 h-4 text-[#C084FC]" />
                    <span>Restore Transfer ZIP</span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsed Card 1: Advanced: Master Migration files (CSV / JSON) */}
            <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {isAdvancedOpen ? (
                    <ChevronDown className="w-4 h-4 text-[#E0B450]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#B3AABD]" />
                  )}
                  <span className="text-[14px] font-bold text-white tracking-wide">
                    Advanced: Master Migration files (CSV / JSON)
                  </span>
                </div>
                <span className="text-[12px] font-mono text-[#B3AABD]">
                  {isAdvancedOpen ? 'Collapse' : 'Expand Options'}
                </span>
              </button>

              {isAdvancedOpen && (
                <div className="p-5 border-t border-[#2E2A33] space-y-5 animate-in fade-in">
                  {/* Master Export Buttons */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleExportMasterCsv}
                      className="h-10 px-4 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] text-white font-semibold text-[12px] border border-[#A66BC9]/30 transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Download className="w-4 h-4 text-[#C084FC]" />
                      <span>Export Master Migration Excel/CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportMasterJson}
                      className="h-10 px-4 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold text-[12px] border border-white/[0.1] transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Database className="w-4 h-4 text-[#E0B450]" />
                      <span>Export System Database Clone (.JSON)</span>
                    </button>
                  </div>

                  {/* Mode Selector Toggle: Safe Merge vs Full Clone & Overwrite */}
                  <div className="p-4 rounded-[12px] bg-[#141214] border border-[#2E2A33] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-[13px] font-bold text-white">
                          Ingest / Restore Master Package on this PC
                        </h4>
                        <p className="text-[11px] text-[#B3AABD]">
                          Select your migration package from USB or external disk.
                        </p>
                      </div>

                      {/* Segmented Mode Toggle */}
                      <div className="h-9 flex items-center bg-[#1A1A1A] p-1 rounded-[8px] border border-[#2E2A33] gap-1">
                        <button
                          type="button"
                          onClick={() => setImportMode('merge')}
                          className={`px-3 h-7 rounded-[6px] text-[11px] font-bold transition-all cursor-pointer ${
                            importMode === 'merge'
                              ? 'bg-[#BC881B] text-[#1A1A1A] shadow-xs'
                              : 'text-[#B3AABD] hover:text-white'
                          }`}
                        >
                          Safe Merge
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportMode('overwrite')}
                          className={`px-3 h-7 rounded-[6px] text-[11px] font-bold transition-all cursor-pointer ${
                            importMode === 'overwrite'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'text-[#B3AABD] hover:text-white'
                          }`}
                        >
                          Full Clone & Overwrite
                        </button>
                      </div>
                    </div>

                    {/* Visible line under toggle for Overwrite per Part 5 */}
                    {importMode === 'overwrite' && (
                      <p className="text-[11px] text-rose-400 font-semibold animate-in fade-in flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Replaces ALL data on this PC.</span>
                      </p>
                    )}

                    {/* Dashed Drop Zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            if (text) {
                              setCsvText(text);
                              executeMigration(text);
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="border-[1.5px] border-dashed border-[#A66BC9]/40 hover:border-[#A66BC9]/80 bg-[#1A1A1A] hover:bg-white/[0.02] rounded-[12px] p-6 text-center cursor-pointer transition-all select-none space-y-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#541A72]/20 border border-[#A66BC9]/30 text-[#C084FC] flex items-center justify-center mx-auto">
                        <HardDrive className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <p className="text-[14px] font-bold text-white">
                        Click to browse Master Migration file from USB or Computer
                      </p>
                      <p className="text-[11px] text-[#B3AABD] font-mono">
                        Supports ULM_LMS_Master_Migration_Package_*.csv and ULM_LMS_System_Database_Clone_*.json
                      </p>
                    </div>

                    {/* Toolbar Actions: Choose Migration File, Clear Buffer, Incorporate Data */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-9 px-3.5 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] text-white text-[12px] font-semibold border border-white/[0.1] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#E0B450]" />
                          <span>Choose Migration File</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCsvText('');
                            setImportStatus(null);
                            setImportError(null);
                          }}
                          className="h-9 px-3 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] text-[#B3AABD] text-[12px] font-medium transition-colors cursor-pointer"
                        >
                          Clear Buffer
                        </button>
                      </div>

                      {/* Incorporate Data button follows mode color */}
                      <button
                        type="button"
                        onClick={() => {
                          if (csvText.trim()) {
                            executeMigration(csvText);
                          } else {
                            fileInputRef.current?.click();
                          }
                        }}
                        disabled={isProcessing}
                        className={`h-10 px-5 rounded-[8px] text-[12px] font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-md ${
                          importMode === 'overwrite'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A]'
                        }`}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Incorporate Data...</span>
                          </>
                        ) : isSuccessMorph ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Incorporate Data (Success)</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownToLine className="w-4 h-4" />
                            <span>Incorporate Data</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Collapsed Block 2: Developer Tools */}
                  <div className="rounded-[10px] bg-[#141214] border border-[#2E2A33] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.02] text-xs font-mono text-[#B3AABD]"
                    >
                      <span>Developer tools (Buffer inspection & synthetic test files)</span>
                      <span>{isDevToolsOpen ? 'Hide' : 'Show'}</span>
                    </button>

                    {isDevToolsOpen && (
                      <div className="p-4 border-t border-[#2E2A33] space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between text-[11px] font-mono text-[#B3AABD]">
                          <span>Direct Migration Data Buffer</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={loadSampleMigrationFile}
                              className="text-[#E0B450] hover:underline cursor-pointer"
                            >
                              Load Sample Transfer File
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => {
                                loadSampleMigrationFile();
                                const sample = `# ====================================================================
# UNIVERSITY OF LAKKI MARWAT - LIBRARY MANAGEMENT SYSTEM (LMS)
# MASTER PC-TO-PC DATA MIGRATION PACKAGE (SAMPLE TEST FILE)
# ====================================================================

# === SECTION: SETTINGS ===
StationID,LibraryName,UniversityName,CampusAddress,Phone,Email,ScannerSound,ErrorSound,WalMode
"LMS-WIN-02","Central Campus Library","University of Lakki Marwat","Lakki Marwat, KPK","+92-969-510015","library@ulm.edu.pk",true,true,true

# === SECTION: BOOKS ===
Barcode,ISBN,BookTitle,Author,Category,TotalCopies,AvailableCopies,Shelf,Row,DeweyCallNumber,Publisher,Edition,Year,Language,IsActive
"9780262033848","978-0262033848","Introduction to Algorithms","Thomas H. Cormen","Computer Science",8,7,"CS-Rack-05","2","518.1 COR","MIT Press","4th Edition",2022,"English",1

# === SECTION: BORROWERS ===
StudentID,FullName,Department,Program,ClassName,Phone,Email,IsActive
"ULM-2023-CS-0101","Muhammad Tariq Khan","Computer Science","BS Computer Science","BS-CS-7A","0345-9876543","tariq.khan@ulm.edu.pk",1

# === SECTION: TRANSACTIONS ===
TransactionID,Barcode,BookTitle,BorrowerName,StudentID,Action,IssueDate,DueDate,ReturnDate,Quantity,Status
"tx-sample-001","9780262033848","Introduction to Algorithms","Muhammad Tariq Khan","ULM-2023-CS-0101","ISSUE","${todayStr}","2026-10-10","N/A",1,"ACTIVE"`;
                                executeMigration(sample);
                              }}
                              className="text-emerald-400 hover:underline font-bold cursor-pointer"
                            >
                              Test Sample Migration
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={csvText}
                          onChange={(e) => setCsvText(e.target.value)}
                          rows={4}
                          placeholder="Raw migration CSV or JSON contents..."
                          className="w-full bg-[#1A1A1A] border border-[#2E2A33] rounded-[8px] p-2.5 text-[11px] font-mono text-[#E7E2EC] focus:outline-none focus:border-[#BC881B]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: EXPORT SPREADSHEETS */}
        {activeTab === 'export' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Card grid (auto-fill minmax(260px, 1fr), gap 16): All same height */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* 1. Master LibraryData.xlsx */}
              <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-4 flex flex-col justify-between space-y-3.5 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 text-[#E0B450] flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <StatusPill label="XLSX" variant="gold" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-white leading-tight">
                    LibraryData.xlsx
                  </h4>
                  <p className="text-[13px] text-[#B3AABD] line-clamp-2 leading-snug">
                    Comprehensive multi-sheet workbook containing catalog, members, circulation, and audit logs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadLibraryData}
                  className="w-full h-9 rounded-[8px] bg-[#541A72] hover:bg-[#6A2290] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#A66BC9]/30"
                >
                  <Download className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Download LibraryData.xlsx</span>
                </button>
              </div>

              {/* 2. Books & Copies CSV */}
              <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-4 flex flex-col justify-between space-y-3.5 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-[10px] bg-[#29658E]/15 border border-[#29658E]/30 text-[#6FA8D2] flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <StatusPill label="CSV" variant="blue" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-white leading-tight">
                    Books & Copies
                  </h4>
                  <p className="text-[13px] text-[#B3AABD] line-clamp-2 leading-snug">
                    Barcodes, accession numbers, Dewey call numbers, shelf locations, and availability stock.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportBooks}
                  className="w-full h-9 rounded-[8px] bg-[#541A72] hover:bg-[#6A2290] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#A66BC9]/30"
                >
                  <Download className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Download Books CSV</span>
                </button>
              </div>

              {/* 3. Campus Members CSV */}
              <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-4 flex flex-col justify-between space-y-3.5 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-[10px] bg-[#541A72]/25 border border-[#A66BC9]/30 text-[#C084FC] flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <StatusPill label="CSV" variant="purple" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-white leading-tight">
                    Campus Members
                  </h4>
                  <p className="text-[13px] text-[#B3AABD] line-clamp-2 leading-snug">
                    Student IDs, department affiliations, academic degree programs, and contact profiles.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportBorrowers}
                  className="w-full h-9 rounded-[8px] bg-[#541A72] hover:bg-[#6A2290] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#A66BC9]/30"
                >
                  <Download className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Download Members CSV</span>
                </button>
              </div>

              {/* 4. Circulation Ledger CSV */}
              <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-4 flex flex-col justify-between space-y-3.5 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <StatusPill label="CSV" variant="green" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-white leading-tight">
                    Circulation Ledger
                  </h4>
                  <p className="text-[13px] text-[#B3AABD] line-clamp-2 leading-snug">
                    Complete loan transaction history, checkout dates, return dates, and overdue records.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportTransactions}
                  className="w-full h-9 rounded-[8px] bg-[#541A72] hover:bg-[#6A2290] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#A66BC9]/30"
                >
                  <Download className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Download Circulation CSV</span>
                </button>
              </div>

              {/* 5. System Audit Trail CSV */}
              <div className="rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-4 flex flex-col justify-between space-y-3.5 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <StatusPill label="CSV" variant="amber" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-white leading-tight">
                    System Audit Trail
                  </h4>
                  <p className="text-[13px] text-[#B3AABD] line-clamp-2 leading-snug">
                    Chronological activity ledger, staff logins, record updates, and administrative modifications.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportHistory}
                  className="w-full h-9 rounded-[8px] bg-[#541A72] hover:bg-[#6A2290] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#A66BC9]/30"
                >
                  <Download className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Download Audit Log CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Hidden File Input for Master Migration file picker */}
      <input
        id="master-migration-file-input"
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,.json,.txt,.xlsx"
        className="sr-only"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default ExcelCenterView;
