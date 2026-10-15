import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  HardDrive, 
  Volume2, 
  CheckCircle2, 
  Building2, 
  Download,
  FolderOpen,
  Check,
  Sparkles,
  Loader2,
  Copy,
  ArrowRightLeft,
  ShieldCheck,
  Folder,
  Trash2,
  Barcode,
  FileSpreadsheet,
  Archive,
  RefreshCw,
  AlertCircle,
  Info,
  Package,
  ShieldAlert,
  Layers,
  Library,
  FileCode
} from 'lucide-react';
import { CoreSystemDocService } from '../services/coreSystemDocService';
import { SystemSettings, LinkedSheetInfo } from '../types/library';
import { LibraryStorage } from '../services/storage';
import { BarcodeService } from '../services/barcodeService';
import { LibraryDataFilesService } from '../services/libraryDataFilesService';
import { UsbBackupService } from '../services/usbBackupService';
import { BookSheetService } from '../services/bookSheetService';
import { LibraryFolderService } from '../services/libraryFolderService';
import { RealStorageService, StorageStatus } from '../services/realStorageService';
import { ResetToZeroService, UndoResetMeta } from '../services/resetToZeroService';
import { ResetToZeroModal } from './modals/ResetToZeroModal';
import { ULM_CREST_SRC } from '../assets/brand/crestData';
import { ButtonAuditPanel } from './ui/ButtonAuditPanel';
import { GroupsSettingsTab } from './settings/GroupsSettingsTab';
import { AlmarisSettingsTab } from './settings/AlmarisSettingsTab';

interface SettingsViewProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: SystemSettings) => void;
  onResetDemoData: () => void;
  onClearDemoData?: () => void;
  onResetToZeroComplete?: () => void;
  onPlayBootAnimation?: () => void;
  onOpenStorageModal?: () => void;
  onOpenWelcomeModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetDemoData,
  onClearDemoData,
  onResetToZeroComplete,
  onPlayBootAnimation,
  onOpenStorageModal,
  onOpenWelcomeModal,
}) => {
  const [formData, setFormData] = useState<SystemSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [institutionalSaved, setInstitutionalSaved] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [moveNotice, setMoveNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'system' | 'groups' | 'almaris'>('system');

  // Barcode & Transfer Actions State
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [showButtonAudit, setShowButtonAudit] = useState(false);

  // Book Sheet & Live Excel Sync State (Section 5)
  const [linkedSheet, setLinkedSheet] = useState<LinkedSheetInfo | null>(() => BookSheetService.getLinkedSheet());
  const [booksNotInSheetCount, setBooksNotInSheetCount] = useState<number>(() => BookSheetService.getBooksNotInSheet().length);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetNotice, setSheetNotice] = useState<string | null>(null);
  const fileInputSheetRef = React.useRef<HTMLInputElement | null>(null);

  const refreshSheetState = () => {
    setLinkedSheet(BookSheetService.getLinkedSheet());
    setBooksNotInSheetCount(BookSheetService.getBooksNotInSheet().length);
  };

  const storageConfig = LibraryStorage.getStorageLocation();
  const currentDbPath = storageConfig.folderPath 
    ? `${storageConfig.folderPath}\\Library.ulmlib`
    : (formData.db_path || 'Documents\\ULM Library\\Library.ulmlib');

  const [realStorageStatus, setRealStorageStatus] = useState<StorageStatus | null>(null);
  const [isCheckingLibraryFile, setIsCheckingLibraryFile] = useState<boolean>(false);
  const [quickCheckInfo, setQuickCheckInfo] = useState<{
    open: boolean;
    passed: boolean;
    message: string;
    journalMode: string;
    synchronous: string;
    foreignKeys: boolean;
    fileSizeBytes: number;
    lastSaved: string | null;
    booksCount: number;
    borrowersCount: number;
    loansCount: number;
  } | null>(null);
  const [isChangingLocation, setIsChangingLocation] = useState<boolean>(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const refreshRealStorageStatus = async () => {
    try {
      const st = await RealStorageService.getStatus();
      setRealStorageStatus(st);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshRealStorageStatus();
  }, []);

  const handleChangeLocation = async () => {
    if (onOpenStorageModal) {
      onOpenStorageModal();
      return;
    }
    setIsChangingLocation(true);
    setLocationNotice('Selecting destination folder...');
    try {
      const pickRes = await RealStorageService.pickDirectory();
      if (pickRes.success) {
        const candidate = pickRes.handle || pickRes.path;
        setLocationNotice('Copying SQLite database bytes & verifying integrity...');
        const changeRes = await RealStorageService.changeLocation(candidate);
        if (changeRes.success) {
          setLocationNotice(changeRes.message);
          await refreshRealStorageStatus();
        } else {
          setLocationNotice(`Relocation canceled: ${changeRes.message}`);
        }
      } else {
        setLocationNotice(pickRes.error || 'Folder selection was not completed');
      }
    } catch (err: any) {
      setLocationNotice(`Relocation error: ${err.message}`);
    } finally {
      setIsChangingLocation(false);
      setTimeout(() => setLocationNotice(null), 5000);
    }
  };

  const handleCheckLibraryFile = async () => {
    setIsCheckingLibraryFile(true);
    try {
      const st = await RealStorageService.getStatus();
      setRealStorageStatus(st);
      const bCount = LibraryStorage.getBooks().length;
      const mCount = LibraryStorage.getBorrowers().length;
      const lCount = LibraryStorage.getTransactions().length;
      setQuickCheckInfo({
        open: true,
        passed: st.quickCheckOk,
        message: st.quickCheckMessage,
        journalMode: st.journalMode,
        synchronous: 'FULL',
        foreignKeys: true,
        fileSizeBytes: st.fileSizeBytes,
        lastSaved: st.lastSavedIso,
        booksCount: bCount,
        borrowersCount: mCount,
        loansCount: lCount,
      });
    } catch (err: any) {
      setQuickCheckInfo({
        open: true,
        passed: false,
        message: `Quick check error: ${err.message}`,
        journalMode: 'UNKNOWN',
        synchronous: 'UNKNOWN',
        foreignKeys: false,
        fileSizeBytes: 0,
        lastSaved: null,
        booksCount: 0,
        borrowersCount: 0,
        loansCount: 0,
      });
    } finally {
      setIsCheckingLibraryFile(false);
    }
  };

  const [isExportingPackage, setIsExportingPackage] = useState(false);
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [isRefreshingDataFiles, setIsRefreshingDataFiles] = useState(false);
  const [packageNotice, setPackageNotice] = useState<string | null>(null);
  const packageInputRef = React.useRef<HTMLInputElement>(null);

  // Reset to Zero & Undo State
  const [isResetToZeroModalOpen, setIsResetToZeroModalOpen] = useState(false);
  const [undoAvailability, setUndoAvailability] = useState(() => ResetToZeroService.getUndoAvailability());
  const [isUndoingReset, setIsUndoingReset] = useState(false);
  const [undoNotice, setUndoNotice] = useState<string | null>(null);

  const refreshUndoState = () => {
    setUndoAvailability(ResetToZeroService.getUndoAvailability());
  };

  const handleUndoResetFromSettings = async () => {
    setIsUndoingReset(true);
    setUndoNotice('Restoring previous catalog snapshot...');
    try {
      const res = await ResetToZeroService.undoReset((pct, stage) => {
        setUndoNotice(`${stage} (${pct}%)`);
      });
      if (res.success) {
        setUndoNotice(res.message);
        refreshUndoState();
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setUndoNotice(`Undo failed: ${res.message}`);
      }
    } catch (err: any) {
      setUndoNotice(`Undo failed: ${err.message}`);
    } finally {
      setIsUndoingReset(false);
    }
  };

  const folderStatus = LibraryFolderService.getFolderStatus();

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const [copiedCoreDoc, setCopiedCoreDoc] = useState(false);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentDbPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyCoreDoc = async () => {
    const ok = await CoreSystemDocService.copyToClipboard();
    if (ok) {
      setCopiedCoreDoc(true);
      setTimeout(() => setCopiedCoreDoc(false), 2500);
    }
  };

  const handleDownloadCoreDoc = () => {
    CoreSystemDocService.downloadMarkdownFile();
  };

  const handleOpenFolder = () => {
    setMoveNotice(`Library Folder: "${storageConfig.folderPath || 'Documents\\ULM Library'}" (contains Library.ulmlib, Book Sheet, Data Files, Backups)`);
    setTimeout(() => setMoveNotice(null), 4000);
  };

  const handleExportLibraryPackage = async () => {
    setIsExportingPackage(true);
    setPackageNotice('Building transfer package (.ulmpack) with database, book sheet, data files, and images...');
    try {
      const res = await UsbBackupService.exportLibraryPackage((pct, stage) => {
        setPackageNotice(`Exporting Package (${pct}%): ${stage}`);
      });
      if (res.success) {
        setPackageNotice(`Package exported successfully: ${res.filename}`);
      } else {
        setPackageNotice(`Export notice: ${res.message}`);
      }
    } catch (e: any) {
      setPackageNotice(`Export failed: ${e.message}`);
    } finally {
      setIsExportingPackage(false);
      setTimeout(() => setPackageNotice(null), 4000);
    }
  };

  const handleOpenLibraryPackage = async (file: File) => {
    setPackageNotice('Validating package manifest and SHA-256 signatures...');
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const val = await UsbBackupService.validateBackupZip(bytes);
      if (!val.valid) {
        setPackageNotice(`Invalid package: ${val.errors.join(' | ')}`);
        return;
      }
      const res = await UsbBackupService.importFromUsb(bytes, 'REPLACE', (pct, stage) => {
        setPackageNotice(`${stage} (${pct}%)`);
      });
      if (res.success) {
        await LibraryFolderService.saveDatabaseFile();
        await LibraryFolderService.refreshDataFiles(true);
        setPackageNotice(res.message);
      } else {
        setPackageNotice(res.message);
      }
    } catch (e: any) {
      setPackageNotice(`Package restore failed: ${e.message}`);
    } finally {
      setTimeout(() => setPackageNotice(null), 5000);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUpNow(true);
    try {
      await LibraryFolderService.createAutoBackup();
      setPackageNotice('Saved safety backup to Backups\\ subfolder (maintaining up to 14 rolling backups).');
    } catch (e: any) {
      setPackageNotice(`Backup notice: ${e.message}`);
    } finally {
      setIsBackingUpNow(false);
      setTimeout(() => setPackageNotice(null), 4000);
    }
  };

  const handleRefreshDataFilesNow = async () => {
    setIsRefreshingDataFiles(true);
    try {
      const res = await LibraryFolderService.refreshDataFiles(true);
      setPackageNotice(res.message);
    } catch (e: any) {
      setPackageNotice(`Data files refresh error: ${e.message}`);
    } finally {
      setIsRefreshingDataFiles(false);
      setTimeout(() => setPackageNotice(null), 4000);
    }
  };

  const handleMoveData = () => {
    if (onOpenStorageModal) {
      onOpenStorageModal();
    }
  };

  const handleSwitchDatabase = () => {
    if (onOpenStorageModal) {
      onOpenStorageModal();
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      const updated: SystemSettings = { ...formData };
      LibraryStorage.saveSettings(updated);
      onUpdateSettings(updated);
      setIsSaving(false);
      setIsSaved(true);
      setSaveSuccess(true);
      setInstitutionalSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setSaveSuccess(false);
        setInstitutionalSaved(false);
      }, 1200);
    }, 200);
  };

  const handleBackupDatabase = () => {
    const backupObj = {
      timestamp: new Date().toISOString(),
      station: formData.station_id,
      books: LibraryStorage.getBooks(),
      borrowers: LibraryStorage.getBorrowers(),
      transactions: LibraryStorage.getTransactions(),
      history: LibraryStorage.getHistory(),
      settings: formData,
    };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ULM_LMS_Database_Snapshot_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBackfillBarcodes = async () => {
    setIsBackfilling(true);
    setBackfillMessage('Starting automatic barcode backfill...');
    try {
      const res = await BarcodeService.backfillMissingBarcodes((pct, stage) => {
        setBackfillMessage(`${stage} (${pct}%)`);
      });
      if (res.success) {
        setBackfillMessage(`Backfill complete: ${res.backfilledCount} volumes assigned institutional barcodes.`);
      } else {
        setBackfillMessage(`Notice: ${res.message}`);
      }
    } catch (e: any) {
      setBackfillMessage(`Error: ${e.message}`);
    } finally {
      setIsBackfilling(false);
      setTimeout(() => setBackfillMessage(null), 5000);
    }
  };

  const handleDownloadLibraryData = async () => {
    try {
      await LibraryDataFilesService.downloadLibraryDataXlsx();
      setMoveNotice('Downloaded comprehensive LibraryData.xlsx workbook.');
      setTimeout(() => setMoveNotice(null), 3500);
    } catch (e: any) {
      setMoveNotice(`Failed to export LibraryData.xlsx: ${e.message}`);
      setTimeout(() => setMoveNotice(null), 3500);
    }
  };

  const handleExportZipArchive = async () => {
    setIsExportingZip(true);
    try {
      const res = await UsbBackupService.exportToUsb((pct, stage) => {
        setMoveNotice(`Packaging Transfer ZIP (${pct}%)...`);
      });
      if (res.success) {
        setMoveNotice(`ZIP Transfer Archive saved successfully (${res.filename}).`);
      } else {
        setMoveNotice(res.message);
      }
    } catch (e: any) {
      setMoveNotice(`Failed: ${e.message}`);
    } finally {
      setIsExportingZip(false);
      setTimeout(() => setMoveNotice(null), 4000);
    }
  };

  const handleSyncSheetNow = async () => {
    setIsSyncingSheet(true);
    setSheetNotice(null);
    try {
      const res = await BookSheetService.syncFromSheet();
      refreshSheetState();
      setSheetNotice(res.message);
    } catch (e: any) {
      setSheetNotice(`Sync notice: ${e.message}`);
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSheetNotice(null), 6000);
    }
  };

  const handleOpenInExcel = () => {
    const bytes = BookSheetService.getCachedBytes();
    if (bytes) {
      const blob = new Blob([bytes as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = linkedSheet?.sheetName || 'ULM_Book_Entry_Sheet.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      setSheetNotice(`Exported ${linkedSheet?.sheetName || 'sheet'} for Excel.`);
    } else {
      setSheetNotice('No sheet bytes available to open.');
    }
    setTimeout(() => setSheetNotice(null), 4000);
  };

  const handleConnectSheetFile = async (file: File) => {
    setIsSyncingSheet(true);
    setSheetNotice('Connecting sheet and reading existing records...');
    try {
      const buf = await file.arrayBuffer();
      const res = await BookSheetService.chooseAndConnectSheet(new Uint8Array(buf), file.name);
      refreshSheetState();
      setSheetNotice(res.message);
    } catch (e: any) {
      setSheetNotice(`Failed to connect sheet: ${e.message}`);
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSheetNotice(null), 6000);
    }
  };

  const handleCreateNewSheet = async () => {
    setIsSyncingSheet(true);
    setSheetNotice('Generating fresh official sheet template...');
    try {
      const res = await BookSheetService.startNewAndCreateSheet();
      if (res.blob) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ULM_Book_Entry_Sheet.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      }
      refreshSheetState();
      setSheetNotice(res.message);
    } catch (e: any) {
      setSheetNotice(`Failed: ${e.message}`);
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSheetNotice(null), 6000);
    }
  };

  const handleDisconnectSheet = () => {
    BookSheetService.disconnectSheet();
    refreshSheetState();
    setSheetNotice('Book sheet disconnected. Application is now working in standalone mode.');
    setTimeout(() => setSheetNotice(null), 4000);
  };

  const handleAddExistingBooksToSheet = async () => {
    setIsSyncingSheet(true);
    setSheetNotice('Appending existing library books to sheet in accession order...');
    try {
      const res = await BookSheetService.addExistingBooksToSheet();
      refreshSheetState();
      setSheetNotice(res.message);
    } catch (e: any) {
      setSheetNotice(`Failed to add books: ${e.message}`);
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSheetNotice(null), 6000);
    }
  };

  return (
    <div className="flex-1 w-full bg-fluent-matrix px-4 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-y-auto space-y-6">
      <div className="max-w-[1280px] mx-auto space-y-6">

        {/* Top Header */}
        <div className="bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] rounded-[16px] p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden flex flex-wrap items-center justify-between gap-4">
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450] shrink-0 shadow-2xs">
              <Settings className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Campus System Preferences & Hardware Configuration</span>
              </h2>
              <p className="text-xs text-[#B3AABD] mt-1">
                Configure institutional credentials, workstation peripheral hooks, appearance, and local SQLite data.
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`min-w-[160px] h-11 px-5 rounded-[10px] text-xs font-semibold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#29658E]/60 ${
              isSaved
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'bg-gradient-to-b from-[#BC881B] to-[#9E7216] hover:from-[#CD9520] hover:to-[#B07F19] text-white shadow-[0_2px_12px_rgba(188,136,27,0.3)] border border-[#D4A338]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]'
            } ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : isSaved ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-300 font-bold animate-in zoom-in-75 duration-200">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Saved</span>
              </span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>

        {/* Settings Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('system')}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'system'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Settings className="w-4 h-4" />
            System & Storage Preferences
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('groups')}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'groups'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Layers className="w-4 h-4" />
            Book Groups (گروپس)
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('almaris')}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'almaris'
                ? 'bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Almaris & Shelves (الماریاں)
          </button>
        </div>

        {activeSettingsTab === 'groups' && (
          <GroupsSettingsTab />
        )}

        {activeSettingsTab === 'almaris' && (
          <AlmarisSettingsTab />
        )}

        {activeSettingsTab === 'system' && (
        <>

        {saveSuccess && (
          <div className="p-3.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Settings successfully committed to local SQLite database.</span>
          </div>
        )}

        {/* Workstation Diagnostics & Boot Animation Ceremony */}
        {onPlayBootAnimation && (
          <div className="bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] rounded-[16px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#541A72]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#541A72]/25 border border-[#A66BC9]/30 flex items-center justify-center text-[#C084FC] shrink-0 shadow-2xs">
                <Sparkles className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <span>App Opening Animation Ceremony</span>
                </h3>
                <p className="text-xs text-[#B3AABD] mt-0.5">
                  Play the university workstation boot sequence and diagnostic seal animation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onPlayBootAnimation}
              className="px-4 h-10 rounded-[10px] bg-[#541A72]/25 hover:bg-[#541A72]/45 text-[#E9D5FF] border border-[#541A72]/50 hover:border-[#A66BC9]/70 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
            >
              <span>⚡ Play Boot Intro</span>
            </button>
          </div>
        )}

        {/* Settings > About Application & Institutional Crest */}
        <div className="bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] rounded-[16px] p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#541A72]" />
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
            {/* Crest 96px with Refined Institutional Gold Styling */}
            <div className="relative shrink-0 flex items-center justify-center p-1.5 rounded-full bg-gradient-to-br from-[#BC881B]/25 via-transparent to-[#BC881B]/15 border border-[#BC881B]/40 shadow-[0_0_20px_rgba(188,136,27,0.25)]">
              <img
                src={ULM_CREST_SRC}
                alt="University of Lakki Marwat crest"
                width={96}
                height={96}
                className="w-24 h-24 object-contain drop-shadow-md select-none"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-white font-cinzel tracking-wide">
                  University of Lakki Marwat LMS
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/40">
                  Version 2.4.0
                </span>
              </div>
              <p className="text-xs text-[#E7E2EC] leading-relaxed">
                Enterprise Library Management System with offline SQLite transaction engine, C++20 Win32 native performance architecture, multi-user file synchronization, and Code-128 barcode circulation desk.
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-[11px] font-mono text-[#B3AABD]">
                <span>Build: 2026.1 Enterprise</span>
                <span>•</span>
                <span>Lakki Marwat, KPK, Pakistan</span>
                <span>•</span>
                <span>Copyright © 2026 University of Lakki Marwat</span>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowButtonAudit(!showButtonAudit)}
                  className="px-3 py-1.5 rounded-[8px] bg-[#BC881B]/20 hover:bg-[#BC881B]/35 border border-[#BC881B]/40 text-[#E0B450] text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{showButtonAudit ? 'Hide UI Audit' : '🔍 UI System Audit'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCoreDoc}
                  className="px-3 py-1.5 rounded-[8px] bg-[#541A72]/25 hover:bg-[#541A72]/40 border border-[#A66BC9]/30 text-[#D8B4FE] text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Download docs/ULM_LMS_CORE_SYSTEM.md"
                >
                  <FileCode className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Download Core System Spec (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyCoreDoc}
                  className="px-3 py-1.5 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[#E0D8E6] text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Copy full non-UI system specification & LLM prompt to clipboard"
                >
                  {copiedCoreDoc ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                      <span className="text-emerald-400 font-bold">Prompt Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#B3AABD]" />
                      <span>Copy Core System Prompt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Developer & QA Button Audit Panel */}
        {showButtonAudit && (
          <ButtonAuditPanel onClose={() => setShowButtonAudit(false)} />
        )}

        {/* Section: Book Sheets & Live Excel Integration (Section 5) */}
        <div className="bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] rounded-[16px] p-5 sm:p-6 space-y-5 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />
          
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450] shrink-0 shadow-2xs">
                <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Book Sheets &amp; Live Excel Synchronization</span>
                  {linkedSheet?.isConnected ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Connected &amp; Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      No Sheet Linked (Standalone)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[#B3AABD] mt-0.5">
                  Bidirectional Excel workbook coordination, automatic accession number numbering, and safe non-destructive XML row appending.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncSheetNow}
                disabled={isSyncingSheet || !linkedSheet?.isConnected}
                className="px-3.5 h-9 rounded-[8px] bg-[#BC881B] hover:bg-[#CD9520] disabled:bg-[#382C10] disabled:text-[#8F7635] text-[#1A1A1A] font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                <span>{isSyncingSheet ? 'Syncing...' : 'Sync now'}</span>
              </button>
            </div>
          </div>

          {/* Cloud Synced Folder Warning */}
          {linkedSheet?.isCloudFolder && (
            <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Warning:</strong> This sheet is located in a cloud-synced folder ({linkedSheet.cloudProviderName || 'Cloud Drive'}). Background sync can lock or duplicate the file while writing.
              </span>
            </div>
          )}

          {/* Sync notification */}
          {sheetNotice && (
            <div className="p-3.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{sheetNotice}</span>
            </div>
          )}

          {/* Missing books in sheet banner */}
          {linkedSheet?.isConnected && booksNotInSheetCount > 0 && (
            <div className="p-4 rounded-[12px] bg-[#541A72]/20 border border-[#A66BC9]/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <Archive className="w-5 h-5 text-[#C084FC] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">
                    {booksNotInSheetCount} existing catalog book(s) are not present in the linked Excel sheet.
                  </p>
                  <p className="text-[11px] text-[#D8B4FE] mt-0.5">
                    Append them cleanly in accession order without changing any existing typed rows.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddExistingBooksToSheet}
                disabled={isSyncingSheet}
                className="px-3.5 py-1.5 rounded-[8px] bg-[#BC881B] hover:bg-[#CD9520] text-[#1A1A1A] font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span>Add them to the sheet</span>
              </button>
            </div>
          )}

          {/* Sheet Details Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
            <div className="p-3 bg-[#141214] rounded-[10px] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#B3AABD]">Workbook Name</span>
              <p className="font-semibold text-white font-mono truncate" title={linkedSheet?.sheetName || 'None'}>
                {linkedSheet?.sheetName || 'No sheet linked'}
              </p>
            </div>

            <div className="p-3 bg-[#141214] rounded-[10px] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#B3AABD]">File Storage Path</span>
              <p className="font-mono text-[11px] text-[#A66BC9] truncate" title={linkedSheet?.sheetPath || 'None'}>
                {linkedSheet?.sheetPath || 'Local application storage'}
              </p>
            </div>

            <div className="p-3 bg-[#141214] rounded-[10px] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#B3AABD]">Last Synced Timestamp</span>
              <p className="font-semibold text-[#E0B450] font-mono">
                {linkedSheet?.lastSynced || 'Never'}
              </p>
            </div>

            <div className="p-3 bg-[#141214] rounded-[10px] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#B3AABD]">Total Rows Read</span>
              <p className="font-semibold text-white font-mono">
                {linkedSheet?.rowsRead || 0} rows
              </p>
            </div>

            <div className="p-3 bg-[#141214] rounded-[10px] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#B3AABD]">Books Appended to Sheet</span>
              <p className="font-semibold text-emerald-400 font-mono">
                {linkedSheet?.booksAdded || 0} books
              </p>
            </div>

            <div className="p-3 bg-[#141214] rounded-[10px] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#B3AABD]">Books Waiting in Queue</span>
              <div className="flex items-center gap-2">
                <span className={`font-semibold font-mono ${linkedSheet && linkedSheet.booksWaiting > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {linkedSheet?.booksWaiting || 0} books waiting
                </span>
                {linkedSheet && linkedSheet.booksWaiting > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    close Excel
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#141214] rounded-[10px] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#B3AABD]">Last Write Result</span>
            <p className="font-mono text-xs text-slate-200">
              {linkedSheet?.lastWriteResult || 'Ready for catalog writes'}
            </p>
          </div>

          {/* Hard Rule Notice per specification */}
          <div className="p-3.5 rounded-[10px] bg-white/[0.02] border border-white/[0.06] text-xs text-[#B3AABD] flex items-center gap-2.5">
            <Info className="w-4 h-4 text-[#BC881B] shrink-0" />
            <span>
              <strong className="text-white">Notice:</strong> Edits and deletions made later in the app are NOT written to the sheet (it records each book as first entered).
            </span>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSyncSheetNow}
              disabled={isSyncingSheet || !linkedSheet?.isConnected}
              className="px-3.5 h-9 rounded-[8px] bg-[#BC881B] hover:bg-[#CD9520] disabled:bg-[#382C10] disabled:text-[#8F7635] text-[#1A1A1A] font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>Sync now</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInExcel}
              disabled={!linkedSheet?.isConnected}
              className="px-3.5 h-9 rounded-[8px] bg-[#541A72] hover:bg-[#6A2290] disabled:bg-[#271433] disabled:text-[#8B719B] text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border border-white/10"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Open in Excel</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputSheetRef.current?.click()}
              className="px-3.5 h-9 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#58A6DF]" />
              <span>Connect another sheet</span>
            </button>

            <button
              type="button"
              onClick={handleCreateNewSheet}
              className="px-3.5 h-9 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#E0B450]" />
              <span>Create new sheet</span>
            </button>

            {linkedSheet?.isConnected && (
              <button
                type="button"
                onClick={handleDisconnectSheet}
                className="px-3.5 h-9 rounded-[8px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer border border-rose-500/30 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )}

            <input
              ref={fileInputSheetRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleConnectSheetFile(f);
              }}
            />
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Institutional Information */}
          <div className="bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] rounded-[16px] p-5 sm:p-6 space-y-5 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450] shrink-0 shadow-2xs">
                  <Building2 className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-tight tracking-tight">
                    Institutional Identity & Campus Header Details
                  </h3>
                  <p className="text-xs text-[#B3AABD] mt-0.5">
                    Modifies university name, library sub-header, and contact credentials live across the application.
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-[8px] text-[11px] font-mono font-semibold uppercase tracking-wider bg-[#541A72]/30 text-[#D8B4FE] border border-[#A66BC9]/30 shadow-2xs">
                Live System Header Branding
              </span>
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  University / Institution Name <span className="text-[#BC881B]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.university_name}
                  onChange={(e) => setFormData({ ...formData, university_name: e.target.value })}
                  placeholder="e.g. University of Lakki Marwat"
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#141214] border border-white/10 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#B3AABD]/50 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]/40 shadow-inner transition-colors duration-150"
                />
                <p className="text-xs text-[#B3AABD] mt-1.5">
                  Displayed in native Windows title bar, top navigation header, and member ID cards.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  Library Facility / Department Name <span className="text-[#BC881B]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.library_name}
                  onChange={(e) => setFormData({ ...formData, library_name: e.target.value })}
                  placeholder="e.g. Central Campus Library"
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#141214] border border-white/10 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#B3AABD]/50 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]/40 shadow-inner transition-colors duration-150"
                />
                <p className="text-xs text-[#B3AABD] mt-1.5">
                  Displayed as primary library header, sidebar campus title, and circulation receipts.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  Campus Physical Address
                </label>
                <input
                  type="text"
                  value={formData.campus_address}
                  onChange={(e) => setFormData({ ...formData, campus_address: e.target.value })}
                  placeholder="e.g. Main Campus, Bannu-Mianwali Road, Lakki Marwat, KPK, Pakistan"
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#141214] border border-white/10 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#B3AABD]/50 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]/40 shadow-inner transition-colors duration-150"
                />
                <p className="text-xs text-[#B3AABD] mt-1.5">
                  Printed on institutional circulation vouchers, export manifests, and overdue notices.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  Official Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +92-969-510015"
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#141214] border border-white/10 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#B3AABD]/50 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]/40 shadow-inner transition-colors duration-150"
                />
                <p className="text-xs text-[#B3AABD] mt-1.5">
                  Circulation desk helpline for book renewals and student queries.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  Official Circulation Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. library@ulm.edu.pk"
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#141214] border border-white/10 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#B3AABD]/50 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]/40 shadow-inner transition-colors duration-150"
                />
                <p className="text-xs text-[#B3AABD] mt-1.5">
                  Institutional contact address for inter-library loan requests.
                </p>
              </div>
            </div>

            {/* Live Header Branding Preview */}
            <div className="p-4 rounded-[12px] border border-[#BC881B]/25 bg-gradient-to-r from-[#BC881B]/[0.08] via-[#541A72]/[0.08] to-[#141214] space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#E0B450] font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Live Title Bar &amp; Header Preview</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-mono text-white truncate py-0.5">
                <span className="font-bold text-white font-cinzel text-sm sm:text-base tracking-wide">
                  {formData.university_name.trim() || 'University of Lakki Marwat'}
                </span>
                <span className="text-[#BC881B] font-sans">|</span>
                <span className="text-[#E0B450] font-cinzel text-xs sm:text-sm">
                  {formData.library_name.trim() || 'Central Campus Library'}
                </span>
              </div>
            </div>

            {/* Dedicated Apply Action Footer */}
            <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#B3AABD] max-w-md">
                Click <strong className="text-white">Apply Details to App</strong> to instantly synchronize headers, title bars, and commit changes to local SQLite storage.
              </p>

              <div className="flex items-center gap-3">
                {institutionalSaved && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3.5 py-2 rounded-[8px] border border-emerald-500/30 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Applied to App!</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-gradient-to-b from-[#BC881B] to-[#9E7216] hover:from-[#CD9520] hover:to-[#B07F19] text-white font-semibold text-xs uppercase tracking-wider transition-all duration-150 shadow-[0_2px_12px_rgba(188,136,27,0.3)] border border-[#D4A338]/40 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#29658E]/60"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Apply Details to App</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hardware & Peripheral Scanner Settings */}
          <div className="bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] rounded-[16px] p-5 sm:p-6 space-y-5 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#29658E]" />
            <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
              <div className="w-10 h-10 rounded-[10px] bg-[#29658E]/20 border border-[#29658E]/40 flex items-center justify-center text-[#58A6DF] shrink-0 shadow-2xs">
                <Volume2 className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Barcode Scanner & Peripherals</h3>
                <p className="text-xs text-[#B3AABD] mt-0.5">Configure hardware audio triggers, auto-submission, and workstation node tagging.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-[10px] border border-white/[0.08] bg-[#141214] hover:border-white/[0.16] transition-colors">
                <div>
                  <p className="text-xs font-semibold text-white">Hardware Audio Feedback</p>
                  <p className="text-xs text-[#B3AABD] mt-0.5">Play pleasant frequency chirp on barcode detection</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.scanner_sound}
                  onChange={(e) => setFormData({ ...formData, scanner_sound: e.target.checked })}
                  className="w-4 h-4 rounded text-[#BC881B] focus:ring-0 focus:outline-none accent-[#BC881B] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-[10px] border border-white/[0.08] bg-[#141214] hover:border-white/[0.16] transition-colors">
                <div>
                  <p className="text-xs font-semibold text-white">Auto-Submit Scan</p>
                  <p className="text-xs text-[#B3AABD] mt-0.5">Execute search immediately upon receiving 13-digit EAN</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.auto_submit_scan}
                  onChange={(e) => setFormData({ ...formData, auto_submit_scan: e.target.checked })}
                  className="w-4 h-4 rounded text-[#BC881B] focus:ring-0 focus:outline-none accent-[#BC881B] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  Workstation Node ID
                </label>
                <input
                  type="text"
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#141214] border border-white/10 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-[#B3AABD]/50 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]/40 shadow-inner transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  Windows Title Bar Badge
                </label>
                <div className="p-3 rounded-[10px] border border-white/10 text-xs font-mono bg-[#141214] text-[#B3AABD] flex items-center justify-between h-[42px]">
                  <span>Visible in native top bar:</span>
                  <span className="text-[#E0B450] font-bold font-mono px-2 py-0.5 rounded bg-[#BC881B]/15 border border-[#BC881B]/30">{formData.station_id}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  Institutional Barcode Prefix (Max 6 Chars)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.barcode_prefix || 'ULM'}
                  onChange={(e) => {
                    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                    setFormData({ ...formData, barcode_prefix: clean });
                  }}
                  placeholder="ULM"
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#141214] border border-white/10 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm font-mono text-[#E0B450] font-bold placeholder-[#B3AABD]/50 focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]/40 shadow-inner transition-colors uppercase"
                />
                <p className="text-[11px] text-[#B3AABD] mt-1">
                  Format: <span className="text-white font-mono">{formData.barcode_prefix || 'ULM'}-00123</span> (Code-128 standard).
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  First Accession Number (Default 1)
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.first_accession_number || 1}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10);
                    setFormData({ ...formData, first_accession_number: isNaN(num) || num < 1 ? 1 : num });
                  }}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#141214] border border-white/10 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm font-mono text-[#E0B450] font-bold focus:outline-none focus:border-[#BC881B] focus:ring-1 focus:ring-[#BC881B]/40 shadow-inner transition-colors"
                />
                <p className="text-[11px] text-[#B3AABD] mt-1">
                  Initial accession sequence number when starting a new catalog with no existing books.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] mb-2">
                  Catalog Barcodes Auto-Backfill
                </label>
                <button
                  type="button"
                  onClick={handleBackfillBarcodes}
                  disabled={isBackfilling}
                  className="w-full h-[42px] px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                  title="Generate institutional barcodes for any volumes missing a barcode"
                >
                  {isBackfilling ? <Loader2 className="w-4 h-4 animate-spin text-[#E0B450]" /> : <Barcode className="w-4 h-4 text-[#E0B450]" />}
                  <span>{isBackfilling ? 'Assigning Barcodes...' : 'Auto-Backfill Barcodes'}</span>
                </button>
                {backfillMessage && (
                  <p className="text-[11px] text-emerald-400 mt-1 font-mono truncate">{backfillMessage}</p>
                )}
              </div>
            </div>
          </div>

          {/* Settings > Library Section (Section 7) */}
          <div className="bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] rounded-[16px] p-5 sm:p-6 space-y-5 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/35 flex items-center justify-center text-[#E0B450] shrink-0 shadow-2xs">
                  <HardDrive className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Library Folder & Data Storage</h3>
                  <p className="text-xs text-[#B3AABD] mt-0.5">Primary database file (Library.ulmlib), linked Excel book entry sheet, and data files.</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-[8px] text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-2xs">
                OFFLINE SECURE · DATABASE MOUNTED
              </span>
            </div>

            {/* Folder path & Live Disk Status: Location, Size, Last Saved */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-[12px] bg-[#141214] border border-white/[0.08] space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#B3AABD] block">Current Location</span>
                  <span className="text-xs font-mono font-semibold text-[#85C4F0] truncate block" title={realStorageStatus?.folderPath || currentDbPath}>
                    {realStorageStatus?.folderPath || currentDbPath}
                  </span>
                </div>
                <div className="p-3.5 rounded-[12px] bg-[#141214] border border-white/[0.08] space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#B3AABD] block">File Size (On Disk)</span>
                  <span className="text-xs font-mono font-bold text-white block">
                    {realStorageStatus && realStorageStatus.fileSizeBytes > 0
                      ? `${(realStorageStatus.fileSizeBytes / 1024).toFixed(1)} KB (${realStorageStatus.fileSizeBytes.toLocaleString()} B)`
                      : 'Verified SQLite File'}
                  </span>
                </div>
                <div className="p-3.5 rounded-[12px] bg-[#141214] border border-white/[0.08] space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#B3AABD] block">Last Saved</span>
                  <span className="text-xs font-mono font-semibold text-emerald-400 block">
                    {realStorageStatus?.lastSavedIso
                      ? new Date(realStorageStatus.lastSavedIso).toLocaleDateString() + ' ' + new Date(realStorageStatus.lastSavedIso).toLocaleTimeString()
                      : 'Active Session'}
                  </span>
                </div>
              </div>

              {/* Action Buttons Row: [Open folder], [Change location], [Check library file], [Copy Path] */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="px-3.5 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-[#29658E]/40 bg-[#29658E]/15 hover:bg-[#29658E]/30 text-[#D1E6F5] transition-all cursor-pointer flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.98] shrink-0"
                  title="Open library folder on this computer"
                >
                  <Folder className="w-4 h-4 text-[#58A6DF]" />
                  <span>Open folder</span>
                </button>

                <button
                  type="button"
                  onClick={handleChangeLocation}
                  disabled={isChangingLocation}
                  className="px-3.5 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition-all cursor-pointer flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.98] shrink-0 disabled:opacity-50"
                  title="Copies with SQLite backup API, verifies counts, switches location, preserves old copy"
                >
                  {isChangingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Change location</span>
                </button>

                <button
                  type="button"
                  onClick={handleCheckLibraryFile}
                  disabled={isCheckingLibraryFile}
                  className="px-3.5 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition-all cursor-pointer flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.98] shrink-0 disabled:opacity-50"
                  title="Runs PRAGMA quick_check and verifies SQLite database integrity"
                >
                  {isCheckingLibraryFile ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Check library file</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="px-3.5 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[#E0D8E6] transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Copy full database file path to clipboard"
                >
                  {copiedPath ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                      <span className="text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#B3AABD]" />
                      <span>Copy Path</span>
                    </>
                  )}
                </button>
              </div>

              {/* Location Notification Banner */}
              {locationNotice && (
                <div className="p-3 rounded-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{locationNotice}</span>
                </div>
              )}

              {/* Real Quick Check Inspection Result Card */}
              {quickCheckInfo?.open && (
                <div className="p-4 rounded-[14px] bg-[#100D14] border border-emerald-500/40 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs font-bold text-white tracking-wide uppercase">
                        SQLite File Quick Check Result (PRAGMA)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickCheckInfo(null)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/[0.06] cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px] font-mono">
                    <div className="p-2.5 rounded-[8px] bg-black/40 border border-white/[0.06]">
                      <span className="text-[#B3AABD] block text-[10px]">Integrity Check</span>
                      <span className="text-emerald-400 font-bold block">
                        {quickCheckInfo.passed ? 'quick_check == ok' : 'integrity error'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-[8px] bg-black/40 border border-white/[0.06]">
                      <span className="text-[#B3AABD] block text-[10px]">Journal Mode</span>
                      <span className="text-white font-bold block">{quickCheckInfo.journalMode} (Single file)</span>
                    </div>
                    <div className="p-2.5 rounded-[8px] bg-black/40 border border-white/[0.06]">
                      <span className="text-[#B3AABD] block text-[10px]">Synchronous / FK</span>
                      <span className="text-white font-bold block">{quickCheckInfo.synchronous} · FK ON</span>
                    </div>
                    <div className="p-2.5 rounded-[8px] bg-black/40 border border-white/[0.06]">
                      <span className="text-[#B3AABD] block text-[10px]">Verified Records</span>
                      <span className="text-amber-300 font-bold block">
                        {quickCheckInfo.booksCount} books · {quickCheckInfo.borrowersCount} mbr
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#B3AABD] italic">
                    Verified directly on disk from Library.ulmlib. Single-instance database file is consistent and healthy.
                  </p>
                </div>
              )}
            </div>

            {/* Sheet status: (name, last synced, books waiting) with [Sync now] and [Open in Excel] */}
            <div className="p-4 rounded-[12px] bg-[#141214] border border-white/[0.08] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Book Sheet: {folderStatus.sheetStatus.name}</span>
                  </h4>
                  <p className="text-[11px] text-[#B3AABD] mt-1">
                    Last synced: <span className="text-white font-medium">{folderStatus.sheetStatus.lastSynced || 'Never'}</span>
                    {' · '}
                    Books waiting: <span className={`font-mono font-bold ${folderStatus.sheetStatus.booksWaiting > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {folderStatus.sheetStatus.booksWaiting} books waiting
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncSheetNow}
                    disabled={isSyncingSheet}
                    className="px-3.5 h-9 rounded-[8px] text-xs font-semibold border border-[#BC881B]/40 bg-[#BC881B]/15 hover:bg-[#BC881B]/25 text-[#E0B450] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                    <span>Sync now</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInExcel}
                    className="px-3.5 h-9 rounded-[8px] text-xs font-semibold border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Open in Excel</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Data files: "Data files updated <time>" with [Refresh now] */}
            <div className="p-4 rounded-[12px] bg-[#141214] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white">Data Files (books.csv, members.csv, loans.csv, LibraryData.xlsx)</h4>
                <p className="text-[11px] text-[#B3AABD] mt-1">
                  Data files updated: <span className="text-white font-medium">{folderStatus.dataFilesStatus.lastUpdated || 'Initial sync'}</span>
                  {folderStatus.dataFilesStatus.isLockedByExcel && (
                    <span className="text-amber-400 ml-2 font-medium">· Close Excel to refresh the data files</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefreshDataFilesNow}
                disabled={isRefreshingDataFiles}
                className="px-3.5 h-9 rounded-[8px] text-xs font-semibold border border-[#29658E]/40 bg-[#29658E]/15 hover:bg-[#29658E]/25 text-[#85C4F0] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDataFiles ? 'animate-spin' : ''}`} />
                <span>Refresh now</span>
              </button>
            </div>

            {/* Package & Backup Buttons: [Export Library Package], [Open library package], [Backup now] */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportLibraryPackage}
                  disabled={isExportingPackage}
                  className="flex items-center gap-2 px-4 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-[#BC881B]/40 bg-[#BC881B]/15 hover:bg-[#BC881B]/25 text-[#E0B450] transition-all cursor-pointer disabled:opacity-60"
                  title="Creates ULM_Library_Package_YYYY-MM-DD_HH-mm.ulmpack for USB transfer"
                >
                  {isExportingPackage ? <Loader2 className="w-4 h-4 animate-spin text-[#E0B450]" /> : <Package className="w-4 h-4 text-[#BC881B]" />}
                  <span>Export Library Package</span>
                </button>

                <button
                  type="button"
                  onClick={() => packageInputRef.current?.click()}
                  className="flex items-center gap-2 px-3.5 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-[#541A72]/50 bg-[#541A72]/20 hover:bg-[#541A72]/35 text-[#E2D5EA] transition-all cursor-pointer"
                  title="Restore catalog from a transfer package (.ulmpack)"
                >
                  <FolderOpen className="w-4 h-4 text-[#C084FC]" />
                  <span>Open library package</span>
                </button>

                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={isBackingUpNow}
                  className="flex items-center gap-2 px-3.5 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[#E0D8E6] transition-all cursor-pointer"
                  title="Save snapshot into Backups\ folder (retaining last 14 backups)"
                >
                  <Archive className="w-4 h-4 text-slate-300" />
                  <span>Backup now</span>
                </button>

                {undoAvailability.available && (
                  <button
                    type="button"
                    onClick={handleUndoResetFromSettings}
                    disabled={isUndoingReset}
                    className="flex items-center gap-2 px-3.5 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition-all cursor-pointer disabled:opacity-50"
                    title={`Restores pre-reset snapshot: ${undoAvailability.meta?.filename}`}
                  >
                    {isUndoingReset ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <RotateCcw className="w-4 h-4 text-amber-400" />
                    )}
                    <span>Undo reset</span>
                  </button>
                )}
              </div>

              {onOpenWelcomeModal && (
                <button
                  type="button"
                  onClick={onOpenWelcomeModal}
                  className="flex items-center gap-2 px-3.5 h-10 rounded-[10px] text-xs font-semibold uppercase tracking-wider border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[#E0D8E6] transition-all cursor-pointer"
                  title="Launch Guided Startup Screen"
                >
                  <RefreshCw className="w-4 h-4 text-[#85C4F0]" />
                  <span>Setup Screen</span>
                </button>
              )}

              {/* Hidden file input for Open library package */}
              <input
                ref={packageInputRef}
                type="file"
                accept=".ulmpack,.zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleOpenLibraryPackage(f);
                }}
              />
            </div>

            {undoNotice && (
              <div className="p-3 rounded-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono animate-in fade-in">
                {undoNotice}
              </div>
            )}

            {packageNotice && (
              <div className="p-3 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 text-[#E0B450] text-xs font-medium animate-in fade-in">
                {packageNotice}
              </div>
            )}

            {moveNotice && (
              <div className="p-3 rounded-[10px] bg-[#29658E]/15 border border-[#29658E]/30 text-[#85C4F0] text-xs font-mono">
                {moveNotice}
              </div>
            )}
          </div>

          {/* TWO ACTIONS IN SETTINGS > DATA */}
          <div className="bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/[0.08] rounded-[16px] p-5 sm:p-6 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-rose-500/60" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Data Maintenance & Reset Control</h3>
                <p className="text-xs text-[#B3AABD] mt-0.5">
                  Clear sample demonstration records or perform a complete, verified reset to zero with safe rollback backup.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Action 1: [Clear demo data] */}
              <div className="p-4 rounded-[12px] bg-white/[0.02] border border-[#BC881B]/25 hover:border-[#BC881B]/40 transition-colors flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-[#E0B450]" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Action 1: Clear Demo Data</h4>
                  </div>
                  <p className="text-xs text-[#B3AABD] leading-relaxed">
                    Removes <strong>ONLY</strong> rows marked as demo/sample (sample catalog books, demo student & faculty members, and their loans). All real user records and configuration stay completely untouched.
                  </p>
                </div>

                <div className="pt-2">
                  {confirmClearDemo ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#E0B450] font-semibold">Remove demo records?</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onClearDemoData) onClearDemoData();
                          else {
                            LibraryStorage.clearDemoData();
                          }
                          setConfirmClearDemo(false);
                        }}
                        className="px-3.5 py-1.5 rounded-[8px] bg-gradient-to-b from-[#BC881B] to-[#9E7216] text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Confirm Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearDemo(false)}
                        className="px-3 py-1.5 rounded-[8px] bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearDemo(true)}
                      className="flex items-center gap-1.5 px-4 h-10 rounded-[10px] border border-[#BC881B]/40 bg-[#BC881B]/15 hover:bg-[#BC881B]/25 text-[#E0B450] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]"
                      title="Removes only rows marked as demo/sample"
                    >
                      <Trash2 className="w-4 h-4 text-[#BC881B]" />
                      <span>Clear Demo Data</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Action 2: [Reset to zero] */}
              <div className="p-4 rounded-[12px] bg-rose-500/[0.03] border border-rose-500/25 hover:border-rose-500/40 transition-colors flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Action 2: Reset to Zero</h4>
                  </div>
                  <p className="text-xs text-[#B3AABD] leading-relaxed">
                    Deletes <strong>ALL</strong> library data: books and copies, barcodes, members, photos, loans, fines, import batches, search caches, and write queues. Next accession resets to 1 (ULM-00001). Generates a verified pre-reset backup first.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetToZeroModalOpen(true)}
                    className="flex items-center gap-2 px-4 h-10 rounded-[10px] border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]"
                    title="Safely wipe database with pre-reset backup"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>Reset to Zero</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
        </>
        )}

        {/* Reset to Zero Danger Modal */}
        {isResetToZeroModalOpen && (
          <ResetToZeroModal
            isOpen={isResetToZeroModalOpen}
            onClose={() => {
              setIsResetToZeroModalOpen(false);
              refreshUndoState();
            }}
            onResetComplete={() => {
              refreshUndoState();
              if (onResetToZeroComplete) {
                onResetToZeroComplete();
              }
            }}
            onGoToStartScreen={() => {
              setIsResetToZeroModalOpen(false);
              if (onOpenWelcomeModal) {
                onOpenWelcomeModal();
              } else {
                window.location.reload();
              }
            }}
          />
        )}

      </div>
    </div>
  );
};
export default SettingsView;
