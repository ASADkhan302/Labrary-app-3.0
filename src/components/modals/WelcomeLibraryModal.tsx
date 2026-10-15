import React, { useState, useRef } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  FilePlus2, 
  Package, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  FolderSearch,
  ExternalLink,
  ShieldAlert,
  Info
} from 'lucide-react';
import { BookSheetService } from '../../services/bookSheetService';
import { LibraryFolderService } from '../../services/libraryFolderService';
import { UsbBackupService } from '../../services/usbBackupService';
import { LibraryStorage } from '../../services/storage';
import { ULM_CREST_SRC } from '../../assets/brand/crestData';

interface WelcomeLibraryModalProps {
  isOpen: boolean;
  isMissingPath?: boolean;
  missingPath?: string;
  onClose: () => void;
  onComplete: (message: string) => void;
  onOpenStorageModal?: (option?: 'create_new' | 'open_existing') => void;
}

export const WelcomeLibraryModal: React.FC<WelcomeLibraryModalProps> = ({
  isOpen,
  isMissingPath = false,
  missingPath = '',
  onClose,
  onComplete,
  onOpenStorageModal,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [beginnerSuccess, setBeginnerSuccess] = useState<{ folderPath: string; sheetBlob?: Blob } | null>(null);

  const packageInputRef = useRef<HTMLInputElement>(null);
  const existingSheetInputRef = useRef<HTMLInputElement>(null);
  const locateFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Action 1: [Open library package (.ulmpack)]
  const handleOpenPackageFile = async (file: File) => {
    setErrorMsg(null);
    setLoadingAction('package');
    setStatusMessage('Validating package manifest, SHA-256 signatures, and database snapshot...');

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const val = await UsbBackupService.validateBackupZip(bytes);
      if (!val.valid) {
        setErrorMsg(val.errors.join(' | '));
        setLoadingAction(null);
        return;
      }

      setStatusMessage(`Restoring ${val.manifest?.recordCounts.books || 0} books and ${val.manifest?.recordCounts.members || 0} members from package...`);
      const restoreRes = await UsbBackupService.importFromUsb(bytes, 'REPLACE', (pct, stage) => {
        setStatusMessage(`${stage} (${pct}%)`);
      });

      if (restoreRes.success) {
        // Save database file and refresh data files
        await LibraryFolderService.saveDatabaseFile();
        await LibraryFolderService.refreshDataFiles(true);
        onComplete(restoreRes.message);
        onClose();
      } else {
        setErrorMsg(restoreRes.message);
        setLoadingAction(null);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to open package: ${err.message}`);
      setLoadingAction(null);
    }
  };

  // Action 2: [Start as a new library]
  const handleStartAsBeginner = async () => {
    setErrorMsg(null);
    setLoadingAction('beginner');
    setStatusMessage('Setting up library folder, empty book sheet, and data files...');

    try {
      LibraryStorage.saveBooks([]);
      LibraryStorage.saveTransactions([]);
      const s = LibraryStorage.getSettings();
      LibraryStorage.saveSettings({ ...s, first_accession_number: 1 });

      const res = await LibraryFolderService.startAsBeginner(undefined, 'Documents\\ULM Library');
      if (res.success) {
        setBeginnerSuccess({ folderPath: res.folderPath });
        setStatusMessage('Library folder, empty book sheet, and data files successfully created.');
        setLoadingAction(null);
      } else {
        setErrorMsg(res.message);
        setLoadingAction(null);
      }
    } catch (err: any) {
      setErrorMsg(`Beginner setup error: ${err.message}`);
      setLoadingAction(null);
    }
  };

  // Action 3: [Start as a beginner and use my existing Excel sheet]
  const handleStartWithExistingSheet = async (file: File) => {
    setErrorMsg(null);
    setLoadingAction('existing_sheet');
    setStatusMessage('Setting up library folder and scanning your existing Excel sheet...');

    try {
      // 1. Create library folder first
      const folderRes = await LibraryFolderService.startAsBeginner(undefined, 'Documents\\ULM Library');
      if (!folderRes.success && !folderRes.message.includes('already contains')) {
        setErrorMsg(folderRes.message);
        setLoadingAction(null);
        return;
      }

      // 2. Connect and scan the existing sheet
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const res = await BookSheetService.chooseAndConnectSheet(bytes, file.name);

      if (res.success) {
        // 3. Save database file & refresh data files
        await LibraryFolderService.saveDatabaseFile();
        await LibraryFolderService.refreshDataFiles(true);
        if (res.importedCount === 0) {
          onComplete(`0 books found: the sheet is empty. Enter books in the sheet and import again.`);
        } else {
          onComplete(`${folderRes.message} ${res.message}`);
        }
        onClose();
      } else {
        setErrorMsg(res.message);
        setLoadingAction(null);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to import existing sheet: ${err.message}`);
      setLoadingAction(null);
    }
  };

  // Locate missing library file (.ulmlib or folder)
  const handleLocateMissing = async (file: File) => {
    setErrorMsg(null);
    setLoadingAction('locate');
    setStatusMessage('Reading and verifying library database file...');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.format !== 'ULM_LIBRARY_DATABASE' && data.schema_version !== 3 && !data.books) {
        setErrorMsg('The selected file is not a valid ULM Library database (Library.ulmlib).');
        setLoadingAction(null);
        return;
      }

      onComplete(`Library database mounted from ${file.name}.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Failed to locate library: ${err.message}`);
      setLoadingAction(null);
    }
  };

  // Open the newly created book sheet in Excel
  const handleOpenBookSheetInExcel = () => {
    const cached = BookSheetService.getCachedBytes();
    if (cached) {
      const blob = new Blob([cached as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ULM_Book_Entry_Sheet.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    onComplete('Library setup complete. Book sheet downloaded for editing in Microsoft Excel.');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/10 rounded-[16px] shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />

        {/* Hidden inputs */}
        <input
          ref={packageInputRef}
          type="file"
          accept=".ulmpack,.zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleOpenPackageFile(f);
          }}
        />
        <input
          ref={existingSheetInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleStartWithExistingSheet(f);
          }}
        />
        <input
          ref={locateFileInputRef}
          type="file"
          accept=".ulmlib,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleLocateMissing(f);
          }}
        />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 flex items-center justify-center p-0.5 rounded-full bg-gradient-to-br from-[#BC881B]/25 via-transparent to-[#BC881B]/15 border border-[#BC881B]/40 shadow-[0_0_8px_rgba(188,136,27,0.25)]">
              <img 
                src={ULM_CREST_SRC} 
                alt="University of Lakki Marwat crest" 
                width={38} 
                height={38} 
                className="w-10 h-10 object-contain drop-shadow-sm select-none" 
                style={{ imageRendering: '-webkit-optimize-contrast' }} 
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isMissingPath ? 'Library File Not Found' : 'Welcome to ULM Library Management System'}
              </h2>
              <p className="text-xs text-[#B3AABD] mt-0.5">
                {isMissingPath 
                  ? 'The configured library database file could not be located.' 
                  : 'University of Lakki Marwat — Central Campus Workstation Setup'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missing File Notice */}
        {isMissingPath && (
          <div className="mx-6 mt-4 p-3.5 rounded-[10px] bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-rose-200">Library file not found at:</span>
              <span className="font-mono text-[11px] block text-rose-300 break-all">{missingPath || 'Documents\\ULM Library\\Library.ulmlib'}</span>
              <span className="block mt-1 text-[11px] text-rose-400">Please choose one of the options below to locate your database, restore from a package, or start fresh.</span>
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1 font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-5">
          {loadingAction ? (
            <div className="py-12 text-center space-y-4 animate-in fade-in">
              <Loader2 className="w-9 h-9 text-[#BC881B] animate-spin mx-auto" />
              <div>
                <p className="text-sm font-bold text-white">Configuring Library Workstation...</p>
                <p className="text-xs text-[#B3AABD] mt-1">{statusMessage}</p>
              </div>
            </div>
          ) : beginnerSuccess ? (
            <div className="py-8 text-center space-y-5 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Library Initialized Successfully</h3>
                <p className="text-xs text-[#B3AABD]">
                  Your library folder is ready at <span className="font-mono text-white">{beginnerSuccess.folderPath}</span>.
                </p>
                <p className="text-xs text-[#B3AABD]">
                  The official Book Entry Sheet (2,999 pre-formatted rows) and Data Files have been generated.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenBookSheetInExcel}
                  className="px-5 h-10 rounded-[8px] bg-[#BC881B] hover:bg-[#A67516] text-[#1A1A1A] font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Open book sheet in Excel</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onComplete('Started as a beginner. Library ready for catalog entries.');
                    onClose();
                  }}
                  className="px-4 h-10 rounded-[8px] bg-[#541A72] hover:bg-[#68248c] text-white font-semibold text-xs cursor-pointer transition-all"
                >
                  Continue to Catalog
                </button>
              </div>
            </div>
          ) : isMissingPath ? (
            /* Missing Path: [Locate it], [Open library package], [Start as a beginner] */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Option 1: Locate it */}
              <div 
                onClick={() => {
                  if (onOpenStorageModal) {
                    onOpenStorageModal('open_existing');
                  } else {
                    locateFileInputRef.current?.click();
                  }
                }}
                className="p-5 rounded-[14px] bg-[#141214] border border-white/10 hover:border-[#BC881B]/50 hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-[12px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450] group-hover:scale-105 transition-transform">
                    <FolderSearch className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Locate it
                    </h3>
                    <p className="text-xs text-[#B3AABD] mt-1 leading-relaxed">
                      Select your existing Library.ulmlib file or the folder where your database was moved.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#E0B450] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform pt-2">
                  <span>Browse File</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Option 2: Open library package */}
              <div 
                onClick={() => packageInputRef.current?.click()}
                className="p-5 rounded-[14px] bg-[#141214] border border-white/10 hover:border-[#541A72]/60 hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-[12px] bg-[#541A72]/25 border border-[#A66BC9]/30 flex items-center justify-center text-[#C084FC] group-hover:scale-105 transition-transform">
                    <Package className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Open library package (.ulmpack)
                    </h3>
                    <p className="text-xs text-[#B3AABD] mt-1 leading-relaxed">
                      Restore catalog from a transfer package from USB or another workstation.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#C084FC] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform pt-2">
                  <span>Choose Package</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Option 3: Start as a beginner */}
              <div 
                onClick={() => {
                  if (onOpenStorageModal) {
                    onOpenStorageModal('create_new');
                  } else {
                    handleStartAsBeginner();
                  }
                }}
                className="p-5 rounded-[14px] bg-[#141214] border border-white/10 hover:border-white/25 hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-[12px] bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[#B3AABD] group-hover:scale-105 transition-transform">
                    <FilePlus2 className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Start as a beginner
                    </h3>
                    <p className="text-xs text-[#B3AABD] mt-1 leading-relaxed">
                      Initialize a fresh library folder, template sheet, and clean database.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#B3AABD] group-hover:text-white flex items-center gap-1 group-hover:translate-x-0.5 transition-transform pt-2">
                  <span>Start Fresh</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ) : (
            /* First Run: Central 180px Crest & Options */
            <div className="space-y-5">
              <div className="flex flex-col items-center justify-center pt-1 pb-2">
                <div className="relative shrink-0 flex items-center justify-center p-2 rounded-full bg-gradient-to-br from-[#BC881B]/25 via-transparent to-[#BC881B]/15 border border-[#BC881B]/40 shadow-[0_0_24px_rgba(188,136,27,0.3)]">
                  <img 
                    src={ULM_CREST_SRC} 
                    alt="University of Lakki Marwat crest" 
                    width={160} 
                    height={160} 
                    className="w-[160px] h-[160px] object-contain drop-shadow-2xl select-none" 
                    style={{ imageRendering: '-webkit-optimize-contrast' }} 
                    title="University of Lakki Marwat Official Crest"
                  />
                </div>
                <p className="text-[13px] font-bold text-white uppercase tracking-wider font-cinzel mt-3">
                  University of Lakki Marwat
                </p>
                <p className="text-[11px] text-[#B3AABD]">
                  Central Campus Library · System Setup & Onboarding
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Option 1: Open library package (.ulmpack) */}
              <div 
                onClick={() => packageInputRef.current?.click()}
                className="p-5 rounded-[14px] bg-[#141214] border border-white/10 hover:border-[#541A72]/60 hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-[12px] bg-[#541A72]/25 border border-[#A66BC9]/30 flex items-center justify-center text-[#C084FC] group-hover:scale-105 transition-transform">
                    <Package className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Open library package (.ulmpack)
                    </h3>
                    <p className="text-xs text-[#B3AABD] mt-1 leading-relaxed">
                      Transfer package (.ulmpack) from another computer. Restores all books, members, loans, and settings.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#C084FC] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform pt-2">
                  <span>Restore Package</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Option 2: Start as a new library */}
              <div 
                onClick={() => {
                  if (onOpenStorageModal) {
                    onOpenStorageModal('create_new');
                  } else {
                    handleStartAsBeginner();
                  }
                }}
                className="p-5 rounded-[14px] bg-[#141214] border border-white/10 hover:border-[#BC881B]/50 hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-[12px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450] group-hover:scale-105 transition-transform">
                    <FilePlus2 className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Start as a new library
                    </h3>
                    <p className="text-xs text-[#B3AABD] mt-1 leading-relaxed">
                      Pick a folder; creates the library folder, empty book sheet with only headers, and data files with no books.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#E0B450] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform pt-2">
                  <span>Start New Library</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Option 3: Start as a beginner and use my existing Excel sheet */}
              <div 
                onClick={() => existingSheetInputRef.current?.click()}
                className="p-5 rounded-[14px] bg-[#141214] border border-white/10 hover:border-white/25 hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-[12px] bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[#B3AABD] group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Start as a beginner and use my existing Excel sheet
                    </h3>
                    <p className="text-xs text-[#B3AABD] mt-1 leading-relaxed">
                      Choose your existing .xlsx book sheet. Links it, scans all books, and imports them automatically.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#B3AABD] group-hover:text-white flex items-center gap-1 group-hover:translate-x-0.5 transition-transform pt-2">
                  <span>Import Sheet</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="p-3.5 rounded-[10px] bg-[#141214] border border-white/[0.06] flex items-center gap-2.5 text-xs text-[#B3AABD]">
            <Info className="w-4 h-4 text-[#BC881B] shrink-0" />
            <span>
              Your library data is saved locally on this machine inside <span className="font-mono text-slate-300">Documents\ULM Library</span>. Never overwrites an existing catalog.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
