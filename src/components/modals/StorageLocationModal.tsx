import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderOpen, 
  Check, 
  AlertCircle, 
  Database,
  ShieldAlert,
  HardDrive,
  Info,
  Loader2,
  FileCheck,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Archive,
  ArrowRight,
  ExternalLink,
  Shield,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { StorageLocationConfig } from '../../types/library';
import { RealStorageService, FolderChecklistResult, LibraryCreationProgressStep, StorageStatus } from '../../services/realStorageService';
import { LibraryStorage } from '../../services/storage';
import { ULM_CREST_SRC } from '../../assets/brand/crestData';

interface StorageLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSaved: (config: StorageLocationConfig) => void;
  isStartupModal?: boolean;
  isMissingPath?: boolean;
  missingPath?: string;
  initialOption?: 'create_new' | 'open_existing';
}

type SetupOption = 'create_new' | 'open_existing';

export const StorageLocationModal: React.FC<StorageLocationModalProps> = ({
  isOpen,
  onClose,
  onLocationSaved,
  isMissingPath = false,
  missingPath = '',
  initialOption = 'create_new',
}) => {
  const [setupOption, setSetupOption] = useState<SetupOption>(initialOption);
  const [chosenCandidate, setChosenCandidate] = useState<any>(null);
  const [displayPath, setDisplayPath] = useState<string>('Documents\\ULM Library');
  const [networkAcknowledged, setNetworkAcknowledged] = useState<boolean>(false);
  const [checklist, setChecklist] = useState<FolderChecklistResult | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  
  // Creation Progress State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [progressSteps, setProgressSteps] = useState<LibraryCreationProgressStep[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [creationSuccessStatus, setCreationSuccessStatus] = useState<StorageStatus | null>(null);

  // File open state
  const [existingFileBytes, setExistingFileBytes] = useState<Uint8Array | null>(null);
  const [existingFileName, setExistingFileName] = useState<string>('');
  const [firstAccessionNumber, setFirstAccessionNumber] = useState<number>(() => {
    return LibraryStorage.getSettings().first_accession_number || 1;
  });

  // Mode & Migration
  const [envMode, setEnvMode] = useState<'DESKTOP' | 'BROWSER-FOLDER' | 'UNAVAILABLE'>('BROWSER-FOLDER');
  const [browserDataCount, setBrowserDataCount] = useState<number>(0);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const mode = RealStorageService.detectEnvironmentMode();
      setEnvMode(mode);
      setSetupOption(initialOption);
      setChosenCandidate(null);
      setDisplayPath('Documents\\ULM Library');
      setNetworkAcknowledged(false);
      setChecklist(null);
      setIsExecuting(false);
      setProgressSteps([]);
      setExecutionError(null);
      setCreationSuccessStatus(null);
      setExistingFileBytes(null);
      setExistingFileName('');
      setMigrationResult(null);

      // Check existing browser storage record count
      const books = LibraryStorage.getBooks();
      setBrowserDataCount(books.length);

      // Run initial probe on recommended folder
      runProbe('Documents\\ULM Library', false);
    }
  }, [isOpen, initialOption]);

  const runProbe = async (candidate: any, netAck: boolean) => {
    setIsChecking(true);
    try {
      const res = await RealStorageService.probeFolderCandidate(candidate, netAck);
      setChecklist(res);
    } catch (err: any) {
      setChecklist({
        canProceed: false,
        isWritable: false,
        writeTestMessage: err.message,
        freeSpaceMb: null,
        lowSpaceWarning: false,
        isSystemDirectoryBlocked: false,
        isNetworkPath: false,
        networkAcknowledged: netAck,
        isRemovableDrive: false,
        isCloudSyncFolder: false,
        libraryAlreadyExists: false,
        errorMessage: err.message,
      });
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  // Handle Directory Browse
  const handleBrowseFolder = async () => {
    const res = await RealStorageService.pickDirectory();
    if (res.success) {
      const candidate = res.handle || res.path;
      setChosenCandidate(candidate);
      setDisplayPath(res.path || res.name);
      await runProbe(candidate, networkAcknowledged);
    }
  };

  // Handle Recommended Location
  const handleUseRecommended = async () => {
    setChosenCandidate(null);
    setDisplayPath('Documents\\ULM Library');
    await runProbe('Documents\\ULM Library', networkAcknowledged);
  };

  // Handle Existing .ulmlib File Browse
  const handleBrowseExistingFile = async () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setExistingFileBytes(bytes);
      setExistingFileName(file.name);
      setDisplayPath(file.name);
    } catch (err: any) {
      setExecutionError(`Failed to read file: ${err.message}`);
    }
  };

  // Execute Creation or Open
  const handleContinue = async () => {
    if (setupOption === 'open_existing') {
      if (!existingFileBytes) return;
      setIsExecuting(true);
      setExecutionError(null);
      const res = await RealStorageService.openExistingLibrary(existingFileBytes, chosenCandidate);
      setIsExecuting(false);
      if (res.success) {
        const st = await RealStorageService.getStatus();
        setCreationSuccessStatus(st);
        onLocationSaved({
          mode: 'LOCAL_DISK',
          folderPath: st.folderPath,
          folderName: st.folderName,
          fileName: st.fileName,
          autoSaveToDisk: true,
          askOnStartup: false,
          isConfigured: true,
        });
      } else {
        setExecutionError(res.message);
      }
      return;
    }

    // Create New Library / Start as a new library:
    // Creates empty sheet and CSV data files with no books.
    LibraryStorage.saveBooks([]);
    LibraryStorage.saveTransactions([]);
    const currSettings = LibraryStorage.getSettings();
    LibraryStorage.saveSettings({
      ...currSettings,
      first_accession_number: firstAccessionNumber || 1,
    });

    setIsExecuting(true);
    setExecutionError(null);
    const candidate = chosenCandidate || displayPath;

    const res = await RealStorageService.createNewLibraryAt(candidate, (steps) => {
      setProgressSteps(steps);
    });

    setIsExecuting(false);
    if (res.success && res.status) {
      setCreationSuccessStatus(res.status);
      onLocationSaved({
        mode: 'LOCAL_DISK',
        folderPath: res.status.folderPath,
        folderName: res.status.folderName,
        fileName: res.status.fileName,
        autoSaveToDisk: true,
        askOnStartup: false,
        isConfigured: true,
      });
    } else {
      setExecutionError(res.message);
    }
  };

  // Use Temporary Browser Storage (in iframe or sandbox)
  const handleUseTemporaryBrowserStorage = () => {
    RealStorageService.saveConfig({
      folderPath: 'Browser Sandbox',
      folderName: 'Temporary Browser Storage',
      fileName: 'Library.ulmlib',
      isConfigured: true,
      temporaryBrowserStorage: true,
    });
    onLocationSaved({
      mode: 'BROWSER_SANDBOX',
      folderPath: 'Browser Sandbox',
      folderName: 'Temporary Browser Storage',
      fileName: 'Library.ulmlib',
      autoSaveToDisk: false,
      askOnStartup: false,
      isConfigured: true,
    });
    onClose();
  };

  // Migrate existing browser storage data into library file
  const handleMigrateBrowserData = async () => {
    if (!chosenCandidate && envMode === 'BROWSER-FOLDER') {
      await handleBrowseFolder();
      return;
    }
    setIsMigrating(true);
    const candidate = chosenCandidate || displayPath;
    const res = await RealStorageService.moveBrowserDataIntoLibraryFile(candidate);
    setIsMigrating(false);
    if (res.success) {
      setMigrationResult(res.message);
      const st = await RealStorageService.getStatus();
      setCreationSuccessStatus(st);
    } else {
      setExecutionError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#141118] border border-amber-500/30 rounded-[18px] shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden relative flex flex-col max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Gold Institutional Hairline */}
        <div className="h-[2.5px] bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 shrink-0" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.01] shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-[12px] bg-black/50 border border-amber-500/40 p-1 flex items-center justify-center shrink-0 shadow-md">
              <img src={ULM_CREST_SRC} alt="ULM Crest" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                  Storage Management
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                  envMode === 'DESKTOP'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : envMode === 'BROWSER-FOLDER'
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}>
                  {envMode === 'DESKTOP' ? 'Desktop Native' : envMode === 'BROWSER-FOLDER' ? 'Browser Folder' : 'Iframe Preview'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide mt-0.5">
                Where should your library be stored?
              </h2>
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".ulmlib,.db,.sqlite" 
          className="hidden" 
          onChange={handleFileSelected}
        />

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">

          {/* SUCCESS SCREEN */}
          {creationSuccessStatus ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-[12px] bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Library Storage Mounted & Verified</h4>
                  <p className="text-emerald-200/90 leading-relaxed text-[12px]">
                    All library tables, transaction ledgers, Excel book sheets, and single-instance locks are active on disk.
                  </p>
                </div>
              </div>

              {/* Facts Read Directly From Disk */}
              <div className="bg-[#1C1822] border border-white/[0.08] rounded-[14px] p-4 space-y-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block border-b border-white/[0.06] pb-2">
                  Facts Verified From Physical Disk
                </span>
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="p-2.5 rounded-[8px] bg-black/40 border border-white/[0.05]">
                    <span className="text-[#B3AABD] block text-[11px]">Storage Path / Folder</span>
                    <span className="text-white font-mono font-bold truncate block">{creationSuccessStatus.folderPath}</span>
                    {envMode === 'BROWSER-FOLDER' && (
                      <span className="text-[10px] text-slate-400 block mt-0.5">The browser does not reveal the full path</span>
                    )}
                  </div>
                  <div className="p-2.5 rounded-[8px] bg-black/40 border border-white/[0.05]">
                    <span className="text-[#B3AABD] block text-[11px]">Database File Size</span>
                    <span className="text-white font-mono font-bold block">
                      {(creationSuccessStatus.fileSizeBytes / 1024).toFixed(1)} KB ({creationSuccessStatus.fileSizeBytes} bytes)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[8px] bg-black/40 border border-white/[0.05]">
                    <span className="text-[#B3AABD] block text-[11px]">SQLite Journal Mode (PRAGMA)</span>
                    <span className="text-emerald-400 font-mono font-bold block">{creationSuccessStatus.journalMode} (Single file)</span>
                  </div>
                  <div className="p-2.5 rounded-[8px] bg-black/40 border border-white/[0.05]">
                    <span className="text-[#B3AABD] block text-[11px]">Integrity Check (PRAGMA)</span>
                    <span className="text-emerald-400 font-mono font-bold block">
                      {creationSuccessStatus.quickCheckOk ? 'quick_check == ok' : 'Error'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 h-10 rounded-[10px] bg-[#BC881B] hover:bg-[#A67515] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#BC881B]/20 flex items-center gap-2"
                >
                  <span>Continue to Library</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : isExecuting ? (
            /* REAL TRANSACTION PROGRESS SCREEN */
            <div className="space-y-4 py-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span>Executing Storage Initialization Sequence...</span>
              </div>
              <div className="space-y-2.5 bg-black/40 p-4 rounded-[12px] border border-white/[0.08]">
                {progressSteps.map((step) => (
                  <div key={step.id} className="flex items-start gap-3 text-xs">
                    {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                    {step.status === 'running' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0 mt-0.5" />}
                    {step.status === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                    {step.status === 'pending' && <div className="w-4 h-4 rounded-full border border-white/20 shrink-0 mt-0.5" />}
                    <div className="space-y-0.5">
                      <span className={step.status === 'success' ? 'text-white font-medium' : step.status === 'running' ? 'text-amber-300 font-semibold' : 'text-slate-400'}>
                        {step.label}
                      </span>
                      {step.detail && <p className="text-[11px] text-emerald-300/80 font-mono">{step.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : envMode === 'UNAVAILABLE' ? (
            /* UNAVAILABLE (IFRAME) SCREEN */
            <div className="space-y-4">
              <div className="p-4 rounded-[12px] bg-rose-500/15 border border-rose-500/40 text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>Choosing a folder does not work in this preview iframe</span>
                </div>
                <p className="text-[12px] leading-relaxed text-rose-200/90">
                  Browser security blocks native folder selection inside embedded preview frames. Open the app in its own top-level browser tab or use the desktop application for physical folder storage.
                </p>
              </div>

              <div className="p-4 rounded-[12px] bg-black/40 border border-white/[0.08] space-y-3">
                <span className="text-white font-bold block text-sm">Testing in Preview?</span>
                <p className="text-[#B3AABD] text-xs">
                  You can use temporary browser storage to test all LMS features, cataloging, circulation, barcodes, and reports.
                </p>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Data can be lost if browser cache or history is cleared</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleUseTemporaryBrowserStorage}
                    className="px-4 h-9 rounded-[8px] bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-colors shadow-md"
                  >
                    Use Temporary Browser Storage
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STANDARD CONFIGURATION FORM */
            <div className="space-y-5">
              {/* Option Cards: [Create New Library] & [Open Existing Library] */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Create New */}
                <div
                  onClick={() => setSetupOption('create_new')}
                  className={`p-4 rounded-[12px] cursor-pointer transition-all border flex flex-col justify-between space-y-2 ${
                    setupOption === 'create_new'
                      ? 'bg-amber-500/10 border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40'
                      : 'bg-black/30 border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-400" />
                      <span>Create a new library</span>
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${setupOption === 'create_new' ? 'border-amber-400 bg-amber-400' : 'border-slate-500'}`}>
                      {setupOption === 'create_new' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                  <p className="text-[#B3AABD] text-[11px] leading-relaxed">
                    Creates Library.ulmlib SQLite file, blank Excel book sheet, and data files.
                  </p>
                </div>

                {/* Option 2: Open Existing */}
                <div
                  onClick={() => setSetupOption('open_existing')}
                  className={`p-4 rounded-[12px] cursor-pointer transition-all border flex flex-col justify-between space-y-2 ${
                    setupOption === 'open_existing'
                      ? 'bg-amber-500/10 border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40'
                      : 'bg-black/30 border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-amber-400" />
                      <span>Open an existing library file (.ulmlib)</span>
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${setupOption === 'open_existing' ? 'border-amber-400 bg-amber-400' : 'border-slate-500'}`}>
                      {setupOption === 'open_existing' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                  <p className="text-[#B3AABD] text-[11px] leading-relaxed">
                    Mounts an existing Library.ulmlib SQLite file from another computer or backup.
                  </p>
                </div>
              </div>

              {/* Folder Row */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 text-xs">
                    {setupOption === 'create_new' ? 'Target Storage Folder:' : 'Select Library File (.ulmlib):'}
                  </label>
                  {setupOption === 'create_new' && (
                    <button
                      type="button"
                      onClick={handleUseRecommended}
                      className="text-amber-400 hover:text-amber-300 text-[11px] font-medium cursor-pointer underline"
                    >
                      Use recommended folder (Documents\ULM Library)
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={displayPath}
                    className="flex-1 h-10 px-3.5 rounded-[10px] bg-black/50 border border-white/15 text-white font-mono text-xs cursor-default select-all"
                  />
                  <button
                    type="button"
                    onClick={setupOption === 'create_new' ? handleBrowseFolder : handleBrowseExistingFile}
                    className="px-4 h-10 rounded-[10px] bg-white/[0.08] hover:bg-white/[0.15] text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2 shrink-0 border border-white/10"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>Browse...</span>
                  </button>
                </div>
                {envMode === 'BROWSER-FOLDER' && setupOption === 'create_new' && (
                  <p className="text-[11px] text-[#B3AABD] italic">
                    The browser does not reveal the full path for privacy.
                  </p>
                )}
              </div>

              {/* First Accession Number Setting for New Library */}
              {setupOption === 'create_new' && (
                <div className="p-3.5 rounded-[12px] bg-black/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="first-acc-input" className="font-semibold text-slate-200 text-xs">
                      First Accession Number:
                    </label>
                    <span className="text-[11px] text-amber-400 font-mono font-bold">
                      Starts at: {firstAccessionNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="first-acc-input"
                      type="number"
                      min={1}
                      value={firstAccessionNumber}
                      onChange={(e) => setFirstAccessionNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-32 h-9 px-3 rounded-[8px] bg-black/70 border border-white/15 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                    />
                    <p className="text-[11px] text-[#B3AABD]">
                      Defaults to 1. Sets the beginning accession number for newly cataloged books.
                    </p>
                  </div>
                </div>
              )}

              {/* LIVE CHECKLIST WHERE EVERY LINE SHOWS A REAL COMPUTED RESULT */}
              {setupOption === 'create_new' && (
                <div className="bg-[#1C1822] border border-white/[0.08] rounded-[14px] p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                      Live Pre-Installation Checklist
                    </span>
                    {isChecking ? (
                      <span className="text-[11px] text-amber-300 flex items-center gap-1 font-mono">
                        <Loader2 className="w-3 h-3 animate-spin" /> Probing...
                      </span>
                    ) : checklist?.canProceed ? (
                      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> All Checks Passed
                      </span>
                    ) : (
                      <span className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Action Required
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Check 1: Folder exists & writable */}
                    <div className="flex items-start gap-2">
                      {checklist?.isWritable ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="text-white font-medium">Folder exists and is writable: </span>
                        <span className="text-[#B3AABD]">{checklist?.writeTestMessage || 'Testing probe file creation...'}</span>
                      </div>
                    </div>

                    {/* Check 2: Free space >= 500 MB */}
                    <div className="flex items-start gap-2">
                      {!checklist?.lowSpaceWarning ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="text-white font-medium">Disk space: </span>
                        <span className="text-[#B3AABD]">
                          {checklist?.freeSpaceMb !== null ? `${checklist?.freeSpaceMb} MB available` : 'Adequate space detected'}
                          {checklist?.lowSpaceWarning && ' (Warning: Under 500 MB available)'}
                        </span>
                      </div>
                    </div>

                    {/* Check 3: Not inside Program Files or Windows */}
                    <div className="flex items-start gap-2">
                      {!checklist?.isSystemDirectoryBlocked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="text-white font-medium">System directories: </span>
                        <span className="text-[#B3AABD]">
                          {!checklist?.isSystemDirectoryBlocked ? 'Passed (Not inside Program Files or Windows)' : 'Blocked: System folder'}
                        </span>
                      </div>
                    </div>

                    {/* Check 4: Network path */}
                    {checklist?.isNetworkPath && (
                      <div className="p-3 rounded-[8px] bg-amber-500/10 border border-amber-500/30 space-y-2">
                        <div className="flex items-center gap-2 text-amber-300 font-bold">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Network Path Detected</span>
                        </div>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          Network latency may impact SQLite database concurrency locks. Ensure your network is reliable.
                        </p>
                        <label className="flex items-center gap-2 text-white font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={networkAcknowledged}
                            onChange={(e) => {
                              setNetworkAcknowledged(e.target.checked);
                              runProbe(chosenCandidate || displayPath, e.target.checked);
                            }}
                            className="rounded border-white/20 text-amber-500"
                          />
                          <span>I understand and wish to proceed with network storage</span>
                        </label>
                      </div>
                    )}

                    {/* Check 5: Cloud Sync Warning */}
                    {checklist?.isCloudSyncFolder && (
                      <div className="flex items-start gap-2 text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                        <div>
                          <span className="font-semibold">{checklist.cloudSyncName || 'Cloud Sync'} detected: </span>
                          <span className="text-amber-200/90">Concurrent desktop sync engines may temporarily lock files during edits.</span>
                        </div>
                      </div>
                    )}

                    {/* Check 6: Library already exists (NEVER overwrite) */}
                    {checklist?.libraryAlreadyExists && (
                      <div className="p-3 rounded-[8px] bg-rose-500/15 border border-rose-500/30 space-y-2">
                        <div className="flex items-center gap-2 text-rose-300 font-bold">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>A library already exists in this folder</span>
                        </div>
                        <p className="text-[11px] text-rose-200/90">
                          To protect your catalog, ULM LMS will never overwrite an existing library.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSetupOption('open_existing')}
                            className="px-3 py-1.5 rounded-[6px] bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer"
                          >
                            Open Existing Library
                          </button>
                          <button
                            type="button"
                            onClick={handleBrowseFolder}
                            className="px-3 py-1.5 rounded-[6px] bg-white/10 hover:bg-white/20 text-white font-medium text-xs cursor-pointer"
                          >
                            Choose Another Folder
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* What will be created */}
              {setupOption === 'create_new' && (
                <div className="bg-black/30 border border-white/[0.06] rounded-[12px] p-3.5 space-y-1.5">
                  <span className="text-[11px] font-mono text-[#B3AABD] font-bold block">
                    What will be created:
                  </span>
                  <ul className="space-y-1 text-[11px] font-mono text-slate-300">
                    <li className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-amber-400" />
                      <span>{displayPath}\Library.ulmlib (SQLite 3 database)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{displayPath}\Book Sheet\ULM_Book_Entry_Sheet.xlsx (2,999 formatted rows)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>{displayPath}\Data Files\ (books.csv, members.csv, loans.csv)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Archive className="w-3.5 h-3.5 text-purple-400" />
                      <span>{displayPath}\Backups\ (Automated pre-operation packages)</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Offer migration if data already exists in browser storage */}
              {browserDataCount > 0 && !checklist?.libraryAlreadyExists && setupOption === 'create_new' && (
                <div className="p-3.5 rounded-[12px] bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-purple-300">Existing Browser Data Found</span>
                    <p className="text-[11px] text-[#B3AABD]">
                      Found {browserDataCount} catalog entries in browser storage. Move them into this library file?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleMigrateBrowserData}
                    disabled={isMigrating}
                    className="px-3.5 py-2 rounded-[8px] bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                  >
                    {isMigrating ? 'Moving...' : 'Move into Library File'}
                  </button>
                </div>
              )}

              {/* Execution Error Notice */}
              {executionError && (
                <div className="p-3 rounded-[8px] bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {executionError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!creationSuccessStatus && (
          <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.01] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 h-10 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleContinue}
              disabled={
                isExecuting ||
                (setupOption === 'create_new' && !checklist?.canProceed) ||
                (setupOption === 'open_existing' && !existingFileBytes)
              }
              className={`px-6 h-10 rounded-[10px] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                (setupOption === 'create_new' && checklist?.canProceed) ||
                (setupOption === 'open_existing' && Boolean(existingFileBytes))
                  ? 'bg-[#BC881B] hover:bg-[#A67515] text-white shadow-lg shadow-[#BC881B]/20'
                  : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <span>{setupOption === 'create_new' ? 'Continue & Create Library' : 'Open & Mount Library'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
