import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  X, 
  FileSpreadsheet, 
  ShieldAlert, 
  BookOpen, 
  Users, 
  CalendarClock, 
  Camera,
  ArrowRight,
  Loader2,
  Check
} from 'lucide-react';
import { ResetToZeroService, DeletionSummary, ResetToZeroResult } from '../../services/resetToZeroService';

interface ResetToZeroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete: (result: ResetToZeroResult) => void;
  onGoToStartScreen: () => void;
}

export const ResetToZeroModal: React.FC<ResetToZeroModalProps> = ({
  isOpen,
  onClose,
  onResetComplete,
  onGoToStartScreen,
}) => {
  const [summary, setSummary] = useState<DeletionSummary | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [resetSettings, setResetSettings] = useState(false);
  const [sheetAction, setSheetAction] = useState<'fresh_sheet' | 'keep_and_reimport'>('fresh_sheet');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [resetResult, setResetResult] = useState<ResetToZeroResult | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoStatus, setUndoStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSummary(ResetToZeroService.getDeletionSummary());
      setConfirmText('');
      setResetSettings(false);
      setSheetAction('fresh_sheet');
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage('');
      setResetResult(null);
      setIsUndoing(false);
      setUndoStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmValid = confirmText === 'RESET';

  const handleExecuteReset = async () => {
    if (!isConfirmValid || isProcessing) return;

    setIsProcessing(true);
    setProgressPct(5);
    setProgressStage('Starting reset sequence...');

    try {
      const res = await ResetToZeroService.executeResetToZero({
        confirmText,
        resetSettings,
        sheetAction,
        onProgress: (pct, stage) => {
          setProgressPct(pct);
          setProgressStage(stage);
        },
      });

      setResetResult(res);
      setIsProcessing(false);

      if (res.success) {
        onResetComplete(res);
      }
    } catch (e: any) {
      setIsProcessing(false);
      setResetResult({
        success: false,
        message: e.message || 'Unexpected failure during reset',
        undoAvailable: false,
        selfCheck: {
          books: -1,
          borrowers: -1,
          transactions: -1,
          activeLoans: -1,
          withdrawnCount: -1,
          queueCount: -1,
          nextAccession: '',
          nextBarcode: '',
          passed: false,
        },
      });
    }
  };

  const handleUndo = async () => {
    setIsUndoing(true);
    setUndoStatus('Restoring previous catalog snapshot...');
    try {
      const res = await ResetToZeroService.undoReset((pct, stage) => {
        setUndoStatus(`${stage} (${pct}%)`);
      });
      if (res.success) {
        setUndoStatus('Reset successfully reverted. Refreshing catalog...');
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1200);
      } else {
        setUndoStatus(`Undo failed: ${res.message}`);
        setIsUndoing(false);
      }
    } catch (err: any) {
      setUndoStatus(`Undo failed: ${err.message}`);
      setIsUndoing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#141118] border border-rose-500/30 rounded-[18px] shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden relative flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top 2.5px danger hairline */}
        <div className="h-[2.5px] bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 shrink-0" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.01] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {resetResult?.success ? 'Reset Complete & Verified' : 'Reset Library Database to Zero'}
              </h2>
              <p className="text-xs text-[#B3AABD] mt-0.5">
                {resetResult?.success 
                  ? 'All library tables and data files have been purged. Self-check verified.' 
                  : 'Permanently purge all books, members, loans, and caches with automatic verified backup.'}
              </p>
            </div>
          </div>
          {!isProcessing && !isUndoing && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] bg-white/[0.05] hover:bg-white/[0.1] text-[#B3AABD] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {resetResult?.success ? (
            /* RESET COMPLETE VIEW */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-[12px] bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Database Successfully Reset to Zero</h4>
                  <p className="text-xs text-emerald-200/80 leading-relaxed">
                    {resetResult.message}
                  </p>
                  <p className="text-xs text-[#B3AABD] font-mono pt-1">
                    Pre-reset backup created: <span className="text-amber-400">{resetResult.backupFilename}</span>
                  </p>
                </div>
              </div>

              {/* Automatic Self-Check Results Card */}
              <div className="bg-[#1C1822] border border-white/[0.08] rounded-[14px] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Automated Post-Reset Self-Check
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-[6px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>PASSED (100%)</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-[8px] bg-black/30 border border-white/[0.04]">
                    <span className="text-[#B3AABD] block text-[11px]">Books in Database</span>
                    <span className="text-white font-mono font-bold text-sm">{resetResult.selfCheck.books}</span>
                  </div>
                  <div className="p-2.5 rounded-[8px] bg-black/30 border border-white/[0.04]">
                    <span className="text-[#B3AABD] block text-[11px]">Borrower Members</span>
                    <span className="text-white font-mono font-bold text-sm">{resetResult.selfCheck.borrowers}</span>
                  </div>
                  <div className="p-2.5 rounded-[8px] bg-black/30 border border-white/[0.04]">
                    <span className="text-[#B3AABD] block text-[11px]">Active Loans</span>
                    <span className="text-white font-mono font-bold text-sm">{resetResult.selfCheck.transactions}</span>
                  </div>
                  <div className="p-2.5 rounded-[8px] bg-black/30 border border-white/[0.04]">
                    <span className="text-[#B3AABD] block text-[11px]">Next Accession</span>
                    <span className="text-emerald-400 font-mono font-bold text-sm">
                      {resetResult.selfCheck.nextAccession} ({resetResult.selfCheck.nextBarcode})
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#B3AABD] pt-1">
                  Verified: Data files refreshed with clean headers, search index cleared, and test volume confirmed to receive accession 1 with barcode ULM-00001.
                </p>
              </div>

              {/* Undo panel */}
              {resetResult.undoAvailable && (
                <div className="p-4 rounded-[12px] bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-amber-300">Need to revert this reset?</span>
                    <p className="text-xs text-[#B3AABD]">
                      Restores all books, members, loans, and settings from the verified pre-reset snapshot.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={isUndoing}
                    className="px-3.5 py-2 rounded-[8px] bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isUndoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>{isUndoing ? 'Undoing Reset...' : 'Undo Reset'}</span>
                  </button>
                </div>
              )}

              {undoStatus && (
                <div className="p-3 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-amber-200">
                  {undoStatus}
                </div>
              )}
            </div>
          ) : (
            /* PRE-RESET CONFIGURATION & CONFIRMATION VIEW */
            <div className="space-y-5">
              {/* Warning Callout */}
              <div className="p-4 rounded-[12px] bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                    High Risk: Complete Library Data Wipe
                  </h4>
                  <p className="text-xs text-rose-100/80 leading-relaxed">
                    This will delete all books, barcodes, members, photos, circulation loans, fines, import batches, and search caches. The next accession counter will reset to 1 (ULM-00001).
                  </p>
                </div>
              </div>

              {/* What Will Be Deleted - Real Counts */}
              {summary && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    Records To Be Purged
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[8px] bg-purple-500/15 text-[#C084FC] flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-white font-mono leading-none block">
                          {summary.booksCount}
                        </span>
                        <span className="text-[11px] text-[#B3AABD] block mt-0.5">
                          {summary.copiesCount} Copies
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[8px] bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-white font-mono leading-none block">
                          {summary.borrowersCount}
                        </span>
                        <span className="text-[11px] text-[#B3AABD] block mt-0.5">
                          Members
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[8px] bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                        <CalendarClock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-white font-mono leading-none block">
                          {summary.transactionsCount}
                        </span>
                        <span className="text-[11px] text-[#B3AABD] block mt-0.5">
                          Loans
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[8px] bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-white font-mono leading-none block">
                          {summary.photosCount}
                        </span>
                        <span className="text-[11px] text-[#B3AABD] block mt-0.5">
                          Photos
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Excel Sheet Options (If Sheet is Connected) */}
              {summary?.isSheetLinked && (
                <div className="p-4 rounded-[12px] bg-[#1C1822] border border-white/[0.08] space-y-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      Linked Book Sheet: <span className="font-mono text-emerald-300">{summary.sheetName}</span>
                    </span>
                  </div>
                  <p className="text-xs text-[#B3AABD]">
                    Choose what to do with the linked Excel book sheet so books are not automatically re-imported on next startup:
                  </p>

                  <div className="space-y-2 pt-1">
                    <label 
                      onClick={() => setSheetAction('fresh_sheet')}
                      className={`flex items-start gap-3 p-3 rounded-[10px] border cursor-pointer transition-all ${
                        sheetAction === 'fresh_sheet' 
                          ? 'bg-rose-500/10 border-rose-500/40 text-white' 
                          : 'bg-white/[0.02] border-white/[0.06] text-[#B3AABD] hover:bg-white/[0.04]'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="sheet_action" 
                        checked={sheetAction === 'fresh_sheet'} 
                        onChange={() => setSheetAction('fresh_sheet')}
                        className="mt-0.5 accent-rose-500" 
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold block text-white">
                          Start with a fresh blank sheet (Default & Recommended)
                        </span>
                        <span className="text-[11px] text-[#B3AABD] block leading-relaxed">
                          The current sheet will be archived into <span className="font-mono text-slate-300">Backups\</span> folder (never deleted). App unlinks so no old rows re-import.
                        </span>
                      </div>
                    </label>

                    <label 
                      onClick={() => setSheetAction('keep_and_reimport')}
                      className={`flex items-start gap-3 p-3 rounded-[10px] border cursor-pointer transition-all ${
                        sheetAction === 'keep_and_reimport' 
                          ? 'bg-amber-500/10 border-amber-500/40 text-white' 
                          : 'bg-white/[0.02] border-white/[0.06] text-[#B3AABD] hover:bg-white/[0.04]'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="sheet_action" 
                        checked={sheetAction === 'keep_and_reimport'} 
                        onChange={() => setSheetAction('keep_and_reimport')}
                        className="mt-0.5 accent-amber-500" 
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold block text-white">
                          Keep using this sheet and re-import its books now
                        </span>
                        <span className="text-[11px] text-[#B3AABD] block leading-relaxed">
                          Retains the existing sheet connection and rescans its catalog entries after resetting loans and members.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Settings Checkbox */}
              <div className="flex items-center gap-2.5 p-3 rounded-[10px] bg-white/[0.02] border border-white/[0.06]">
                <input
                  type="checkbox"
                  id="reset-settings-checkbox"
                  checked={resetSettings}
                  onChange={e => setResetSettings(e.target.checked)}
                  className="rounded border-white/20 text-rose-600 focus:ring-0 cursor-pointer w-4 h-4"
                />
                <label htmlFor="reset-settings-checkbox" className="text-xs text-[#B3AABD] cursor-pointer">
                  Also reset institutional settings (fine rates, loan durations, and barcode prefix).
                  <span className="block text-[11px] text-slate-400">By default, your custom settings are kept safely.</span>
                </label>
              </div>

              {/* Progress Bar (During Execution) */}
              {isProcessing && (
                <div className="space-y-2 p-4 rounded-[12px] bg-black/40 border border-white/[0.08] animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-semibold flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                      <span>{progressStage}</span>
                    </span>
                    <span className="text-rose-400 font-mono font-bold">{progressPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Callout if any */}
              {resetResult && !resetResult.success && (
                <div className="p-3.5 rounded-[10px] bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  <strong>Reset Aborted:</strong> {resetResult.message}
                </div>
              )}

              {/* Type RESET Confirmation Input */}
              {!isProcessing && (
                <div className="space-y-2 pt-1">
                  <label htmlFor="reset-confirm-input" className="text-xs font-semibold text-slate-300 block">
                    Type <span className="font-mono text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">RESET</span> to confirm:
                  </label>
                  <input
                    id="reset-confirm-input"
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="Type RESET"
                    className="w-full h-11 px-3.5 rounded-[10px] bg-black/40 border border-white/15 focus:border-rose-500/70 focus:outline-none text-white font-mono text-sm tracking-wider"
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.01] flex items-center justify-between shrink-0">
          {resetResult?.success ? (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-[#B3AABD]">
                Catalog is ready for fresh institutional setup.
              </span>
              <button
                type="button"
                onClick={onGoToStartScreen}
                className="px-5 h-10 rounded-[10px] bg-[#BC881B] hover:bg-[#A67515] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#BC881B]/20"
              >
                <span>Go to Start Screen</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 h-10 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={!isConfirmValid || isProcessing}
                className={`px-5 h-10 rounded-[10px] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  isConfirmValid && !isProcessing
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                    : 'bg-rose-900/30 border border-rose-500/20 text-rose-400/40 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Purging Library Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Reset to Zero</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
