import React, { useState, useRef } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  Printer, 
  Layers, 
  ShieldCheck, 
  FileText,
  Loader2,
  Check,
  Ban
} from 'lucide-react';
import { ImporterEngine, ImportPreviewReport, CleanedBookRow, RowProblem } from '../../services/importerEngine';
import { StagedImportEngine, StagedImportProgressUpdate } from '../../services/stagedImportEngine';
import { AlmariService } from '../../services/almariService';
import { ImportJob } from '../../types/library';
import { LibraryStorage } from '../../services/storage';

interface BookImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (batchId: string, importedCount: number, bookIds: string[]) => void;
  onOpenLabelBatchPrint?: (bookIds: string[]) => void;
}

export const BookImportModal: React.FC<BookImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  onOpenLabelBatchPrint,
}) => {
  const [stage, setStage] = useState<'upload' | 'parsing' | 'preview' | 'importing' | 'complete'>('upload');
  const [progressPct, setProgressPct] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [previewReport, setPreviewReport] = useState<ImportPreviewReport | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ERRORS' | 'DUPLICATES' | 'WARNINGS'>('ALL');
  const [lastBatchResult, setLastBatchResult] = useState<{ batchId: string; count: number; bookIds: string[] } | null>(null);

  const [activeJob, setActiveJob] = useState<ImportJob | null>(() => StagedImportEngine.getActiveJob());
  const [stagedProgress, setStagedProgress] = useState<StagedImportProgressUpdate | null>(null);
  const [autoArrangeNew, setAutoArrangeNew] = useState(true);
  const [undoStatusMsg, setUndoStatusMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shouldCancelRef = useRef<{ current: boolean }>({ current: false });

  if (!isOpen) return null;

  const handleReset = () => {
    setStage('upload');
    setProgressPct(0);
    setProgressMsg('');
    setErrorMsg(null);
    setPreviewReport(null);
    setSelectedFilter('ALL');
    shouldCancelRef.current.current = false;
  };

  const handleFileSelected = async (file: File) => {
    setErrorMsg(null);
    setStage('parsing');
    setProgressPct(10);
    setProgressMsg('Reading file buffer...');

    try {
      const buffer = await file.arrayBuffer();
      const report = await ImporterEngine.parseEntrySheet(
        buffer,
        file.name,
        (pct, msg) => {
          setProgressPct(pct);
          setProgressMsg(msg);
        }
      );
      if (!report || report.readyRows.length === 0) {
        setErrorMsg('0 books found: the sheet is empty. Enter books in the sheet and import again.');
        setStage('upload');
        return;
      }
      setPreviewReport(report);
      setStage('preview');
    } catch (err: any) {
      setErrorMsg(err.message || '0 books found: the sheet is empty. Enter books in the sheet and import again.');
      setStage('upload');
    }
  };

  const handleDownloadBlankTemplate = async () => {
    try {
      const blob = await ImporterEngine.generateBlankEntrySheet();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ULM_Book_Entry_Sheet.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(`Failed to generate template: ${err.message}`);
    }
  };

  const handleDownloadProblemReport = () => {
    if (!previewReport) return;
    const blob = ImporterEngine.generateProblemReportCsv(previewReport);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ULM_Import_Problem_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async () => {
    if (!previewReport || previewReport.readyRows.length === 0) return;

    setStage('importing');
    setProgressPct(0);
    setProgressMsg('Initializing staged atomic import (1,000 volumes per round)...');
    shouldCancelRef.current.current = false;

    try {
      const fileHash = `${previewReport.fileName}_${previewReport.fileSizeBytes || previewReport.totalRowsRead}`;
      const job = await StagedImportEngine.initJob(
        fileHash,
        previewReport.fileName,
        previewReport.readyRows,
        1000,
        autoArrangeNew
      );
      setActiveJob(job);

      const result = await StagedImportEngine.runJob(
        job,
        previewReport.readyRows,
        (update) => {
          setStagedProgress(update);
          setProgressPct(update.percent);
          setProgressMsg(update.currentStage);
        }
      );

      if (result.success && result.job) {
        setLastBatchResult({
          batchId: result.job.id,
          count: result.job.total_rows,
          bookIds: result.job.all_imported_book_ids,
        });
        setActiveJob(null);
        setStage('complete');
        onImportComplete(result.job.id, result.job.total_rows, result.job.all_imported_book_ids);
      } else {
        setActiveJob(result.job);
        if (result.job.status === 'paused') {
          setProgressMsg('Import job paused cleanly. All completed rounds preserved.');
        } else {
          setErrorMsg(result.message);
          setStage('preview');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Import execution failed');
      setStage('preview');
    }
  };

  const handleCancelImport = () => {
    StagedImportEngine.cancel();
    setProgressMsg('Stopping import after current round... Completed rounds will be preserved.');
  };

  const handleResumeJob = async () => {
    if (!activeJob) return;
    const stored = StagedImportEngine.getStoredRows(activeJob.file_hash);
    if (!stored || stored.length === 0) {
      setErrorMsg('Cached file rows for this job expired. Please re-upload the spreadsheet.');
      return;
    }
    setStage('importing');
    setProgressPct(Math.round((activeJob.next_row / activeJob.total_rows) * 100));
    setProgressMsg(`Resuming import from row ${activeJob.next_row + 1}...`);
    try {
      const result = await StagedImportEngine.runJob(activeJob, stored, (update) => {
        setStagedProgress(update);
        setProgressPct(update.percent);
        setProgressMsg(update.currentStage);
      });
      if (result.success && result.job) {
        setLastBatchResult({
          batchId: result.job.id,
          count: result.job.total_rows,
          bookIds: result.job.all_imported_book_ids,
        });
        setActiveJob(null);
        setStage('complete');
        onImportComplete(result.job.id, result.job.total_rows, result.job.all_imported_book_ids);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resume import');
    }
  };

  const handleDiscardJob = () => {
    if (!activeJob) return;
    StagedImportEngine.undoWholeJob(activeJob.id);
    setActiveJob(null);
    handleReset();
  };

  const handleUndoImport = () => {
    if (!lastBatchResult) return;
    const res = StagedImportEngine.undoWholeJob(lastBatchResult.batchId);
    setUndoStatusMsg(res.message);
  };

  const handleDownloadShelvingList = () => {
    if (!lastBatchResult) return;
    const all = LibraryStorage.getBooks();
    const mockJob: ImportJob = {
      id: lastBatchResult.batchId,
      file_hash: '',
      file_name: previewReport?.fileName || 'Import',
      total_rows: lastBatchResult.count,
      next_row: lastBatchResult.count,
      rounds_done: 1,
      total_rounds: 1,
      round_size: 1000,
      status: 'completed',
      auto_arrange: true,
      pause_after_round: false,
      created_at: '',
      updated_at: '',
      round_history: [],
      all_imported_book_ids: lastBatchResult.bookIds,
      created_almari_ids: [],
    };
    const shelving = StagedImportEngine.generateShelvingList(mockJob, all);
    const headers = ['Almari Name', 'Almari Code', 'Shelf No', 'Accession Range', 'Book Count', 'Sample Titles'];
    const rows = shelving.map(s => [
      `"${s.almariName.replace(/"/g, '""')}"`,
      s.code,
      s.shelfNo,
      `"${s.rangeStr}"`,
      s.count,
      `"${s.titles.join('; ').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ULM_Shelving_List_${lastBatchResult.batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter problems table
  const filteredProblems = (previewReport?.problems || []).filter(p => {
    if (selectedFilter === 'ERRORS') return p.type === 'ERROR';
    if (selectedFilter === 'DUPLICATES') return p.type === 'DUPLICATE';
    if (selectedFilter === 'WARNINGS') return p.type === 'WARNING';
    return true;
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[90vh] bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/10 rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#1A1A1A]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#541A72]/30 border border-[#A66BC9]/30 flex items-center justify-center text-[#C084FC]">
              <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Book Entry Sheet Excel Import Engine</span>
                <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-mono uppercase tracking-wider bg-[#BC881B]/15 text-[#E0B450] border border-[#BC881B]/30">
                  Offline &amp; Verified
                </span>
              </h2>
              <p className="text-xs text-[#B3AABD] mt-0.5">
                Import volumes from ULM_Book_Entry_Sheet.xlsx with automatic barcode creation and atomic rollback.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadBlankTemplate}
              className="px-3 h-8 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] text-[#E0D8E6] border border-white/10 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              title="Download standard blank ULM_Book_Entry_Sheet.xlsx template"
            >
              <Download className="w-3.5 h-3.5 text-[#BC881B]" />
              <span className="hidden sm:inline">Blank Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1 font-medium">{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs text-rose-300 hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STAGE: UPLOAD */}
          {stage === 'upload' && (
            <div className="space-y-6">
              {/* Unfinished Import Job Banner */}
              {activeJob && (activeJob.status === 'paused' || activeJob.status === 'pending') && (
                <div className="p-4 rounded-[12px] bg-[#BC881B]/15 border border-[#BC881B]/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="space-y-0.5 text-left">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#E0B450]" />
                      Unfinished Import Job Detected
                    </h4>
                    <p className="text-xs text-[#E0D8E6]">
                      Paused at row {activeJob.next_row.toLocaleString()} of {activeJob.total_rows.toLocaleString()} (Round {activeJob.rounds_done + 1} of {activeJob.total_rounds}).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleResumeJob}
                      className="px-3.5 py-1.5 bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A] font-bold text-xs rounded-lg shadow cursor-pointer transition-colors"
                    >
                      Resume from row {activeJob.next_row + 1}
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardJob}
                      className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs rounded-lg cursor-pointer transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}

              {/* Drop Zone */}
              <div 
                className="border-2 border-dashed border-white/15 hover:border-[#BC881B]/50 rounded-[14px] p-8 sm:p-12 text-center bg-[#141214] hover:bg-[#141214]/80 transition-all cursor-pointer group flex flex-col items-center justify-center space-y-3"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileSelected(file);
                }}
              >
                <div className="w-16 h-16 rounded-[14px] bg-[#541A72]/20 border border-[#A66BC9]/30 flex items-center justify-center text-[#C084FC] group-hover:scale-105 transition-transform shadow-md">
                  <UploadCloud className="w-8 h-8 stroke-[1.8]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white tracking-wide">
                    Choose Excel Book Entry Sheet (.xlsx) or drag &amp; drop
                  </p>
                  <p className="text-xs text-[#B3AABD] mt-1">
                    Accepts standard macro-free .xlsx files (up to 50 MB, 100,000 rows).
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                />
              </div>

              {/* Specification checklist cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-[10px] bg-white/[0.03] border border-white/[0.06] space-y-1">
                  <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#BC881B]" />
                    <span>Required Columns</span>
                  </p>
                  <p className="text-xs text-[#B3AABD]">
                    Accession No and Title must be present on every row. Author is optional.
                  </p>
                </div>

                <div className="p-3.5 rounded-[10px] bg-white/[0.03] border border-white/[0.06] space-y-1">
                  <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C084FC]" />
                    <span>Automatic Barcodes</span>
                  </p>
                  <p className="text-xs text-[#B3AABD]">
                    Every volume automatically receives a permanent barcode (e.g. ULM-00123).
                  </p>
                </div>

                <div className="p-3.5 rounded-[10px] bg-white/[0.03] border border-white/[0.06] space-y-1">
                  <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Urdu &amp; Script Support</span>
                  </p>
                  <p className="text-xs text-[#B3AABD]">
                    Preserves Nastaliq typography, normalizes variants for search, and auto-detects language.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STAGE: PARSING */}
          {stage === 'parsing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <Loader2 className="w-10 h-10 text-[#BC881B] animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">{progressMsg}</p>
                <p className="text-xs text-[#B3AABD]">Validating headers, cleaning text, and detecting duplicates...</p>
              </div>
              <div className="w-72 bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-[#BC881B] to-[#C084FC] h-full transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* STAGE: PREVIEW */}
          {stage === 'preview' && previewReport && (
            <div className="space-y-5">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-[10px] bg-[#141214] border border-white/[0.08] text-center">
                  <p className="text-[11px] font-semibold uppercase text-[#B3AABD]">Rows Read</p>
                  <p className="text-lg font-bold text-white mt-0.5">{previewReport.totalRowsRead.toLocaleString()}</p>
                </div>

                <div className="p-3 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <p className="text-[11px] font-semibold uppercase text-emerald-300">Ready to Add</p>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">{previewReport.readyToImportCount.toLocaleString()}</p>
                </div>

                <div className="p-3 rounded-[10px] bg-amber-500/10 border border-amber-500/30 text-center">
                  <p className="text-[11px] font-semibold uppercase text-amber-300">File Duplicates</p>
                  <p className="text-lg font-bold text-amber-400 mt-0.5">{previewReport.duplicatesInFileCount}</p>
                </div>

                <div className="p-3 rounded-[10px] bg-purple-500/10 border border-purple-500/30 text-center">
                  <p className="text-[11px] font-semibold uppercase text-purple-300">In Catalog</p>
                  <p className="text-lg font-bold text-purple-400 mt-0.5">{previewReport.alreadyInLibraryCount}</p>
                </div>

                <div className="p-3 rounded-[10px] bg-rose-500/10 border border-rose-500/30 text-center">
                  <p className="text-[11px] font-semibold uppercase text-rose-300">Errors (Skipped)</p>
                  <p className="text-lg font-bold text-rose-400 mt-0.5">{previewReport.errorsCount}</p>
                </div>

                <div className="p-3 rounded-[10px] bg-sky-500/10 border border-sky-500/30 text-center">
                  <p className="text-[11px] font-semibold uppercase text-sky-300">Warnings</p>
                  <p className="text-lg font-bold text-sky-400 mt-0.5">{previewReport.warningsCount}</p>
                </div>
              </div>

              {/* Informational Alerts */}
              {previewReport.leadingZerosCount > 0 && (
                <div className="p-3 rounded-[10px] bg-[#BC881B]/10 border border-[#BC881B]/30 text-xs text-[#E0B450] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Notice: <strong>{previewReport.leadingZerosCount}</strong> accession numbers had leading zeros. They will appear and sort without leading zeros in the numerical accession ledger.
                  </span>
                </div>
              )}

              {previewReport.blankAuthorCount > 0 && (
                <div className="p-3 rounded-[10px] bg-white/[0.04] border border-white/10 text-xs text-[#B3AABD] flex items-center gap-2">
                  <FileText className="w-4 h-4 shrink-0 text-[#C084FC]" />
                  <span>
                    Info: <strong>{previewReport.blankAuthorCount}</strong> rows have no author and will be registered as <em>Anonymous / Organization</em>.
                  </span>
                </div>
              )}

              {previewReport.unknownHeaders.length > 0 && (
                <div className="p-3 rounded-[10px] bg-white/[0.04] border border-white/10 text-xs text-[#B3AABD] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Ignored unrecognized columns: {previewReport.unknownHeaders.map(h => `"${h}"`).join(', ')}.
                  </span>
                </div>
              )}

              {/* Staged Execution & Auto-Arrange Settings */}
              <div className="p-4 rounded-[12px] bg-[#141214] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Staged Import Pipeline (1,000 Volumes per Round)
                  </span>
                  <p className="text-[11px] text-[#B3AABD]">
                    {previewReport.readyToImportCount <= 1000
                      ? `Single atomic batch of ${previewReport.readyToImportCount.toLocaleString()} volumes.`
                      : `Will execute in ${Math.ceil(previewReport.readyToImportCount / 1000)} atomic rounds. Can be paused, resumed, or rolled back.`}
                  </p>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--gold)] cursor-pointer bg-white/[0.04] px-3 py-2 rounded-lg border border-white/10 hover:border-[var(--gold)]/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoArrangeNew}
                    onChange={(e) => setAutoArrangeNew(e.target.checked)}
                    className="accent-[var(--gold)]"
                  />
                  <span>Auto-arrange books into Almaris upon import</span>
                </label>
              </div>

              {/* Filter Tabs & Problem Report Table */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 p-1 rounded-[10px] bg-[#141214] border border-white/10">
                    <button
                      onClick={() => setSelectedFilter('ALL')}
                      className={`px-3 py-1 rounded-[8px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        selectedFilter === 'ALL' ? 'bg-[#BC881B] text-white' : 'text-[#B3AABD] hover:text-white'
                      }`}
                    >
                      All Issues ({previewReport.problems.length})
                    </button>
                    <button
                      onClick={() => setSelectedFilter('ERRORS')}
                      className={`px-3 py-1 rounded-[8px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        selectedFilter === 'ERRORS' ? 'bg-rose-600 text-white' : 'text-[#B3AABD] hover:text-white'
                      }`}
                    >
                      Errors ({previewReport.errorsCount})
                    </button>
                    <button
                      onClick={() => setSelectedFilter('DUPLICATES')}
                      className={`px-3 py-1 rounded-[8px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        selectedFilter === 'DUPLICATES' ? 'bg-amber-600 text-white' : 'text-[#B3AABD] hover:text-white'
                      }`}
                    >
                      Duplicates ({previewReport.duplicatesInFileCount + previewReport.alreadyInLibraryCount})
                    </button>
                    <button
                      onClick={() => setSelectedFilter('WARNINGS')}
                      className={`px-3 py-1 rounded-[8px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        selectedFilter === 'WARNINGS' ? 'bg-sky-600 text-white' : 'text-[#B3AABD] hover:text-white'
                      }`}
                    >
                      Warnings ({previewReport.warningsCount})
                    </button>
                  </div>

                  {previewReport.problems.length > 0 && (
                    <button
                      onClick={handleDownloadProblemReport}
                      className="px-3.5 h-8 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] text-[#E0D8E6] border border-white/10 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#BC881B]" />
                      <span>Download Problem Report CSV</span>
                    </button>
                  )}
                </div>

                {/* Table */}
                <div className="border border-white/10 rounded-[10px] overflow-hidden bg-[#141214] max-h-56 overflow-y-auto">
                  {filteredProblems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#B3AABD]">
                      No issues found in this category. All rows in this view are clean.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1A1A1A] border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-[#D6CFE0] sticky top-0">
                        <tr>
                          <th className="px-3.5 py-2.5 w-24">Excel Row</th>
                          <th className="px-3.5 py-2.5 w-32">Accession #</th>
                          <th className="px-3.5 py-2.5 w-28">Type</th>
                          <th className="px-3.5 py-2.5">Problem Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredProblems.map((prob, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="px-3.5 py-2 font-mono text-[#B3AABD]">Row {prob.excelRowNumber}</td>
                            <td className="px-3.5 py-2 font-mono text-white">{prob.accessionNo}</td>
                            <td className="px-3.5 py-2">
                              <span className={`px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold ${
                                prob.type === 'ERROR'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : prob.type === 'DUPLICATE'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              }`}>
                                {prob.type}
                              </span>
                            </td>
                            <td className="px-3.5 py-2 text-[#E0D8E6]">{prob.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STAGE: IMPORTING */}
          {stage === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <Loader2 className="w-10 h-10 text-[#BC881B] animate-spin" />
              <div className="space-y-1 max-w-md">
                <p className="text-sm font-bold text-white">{progressMsg}</p>
                <div className="flex items-center justify-center gap-3 text-xs text-[#B3AABD] pt-1 font-mono">
                  <span>Round {stagedProgress?.roundNo || 1} of {stagedProgress?.totalRounds || 1}</span>
                  <span>•</span>
                  <span>{progressPct}% Completed</span>
                  {stagedProgress?.memoryMb && (
                    <>
                      <span>•</span>
                      <span>Memory: {stagedProgress.memoryMb} MB</span>
                    </>
                  )}
                </div>
                {stagedProgress?.placedSummaryText && (
                  <p className="text-xs text-amber-300 font-mono mt-1">{stagedProgress.placedSummaryText}</p>
                )}
              </div>
              <div className="w-80 bg-white/10 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-[#BC881B] to-emerald-400 h-full transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleCancelImport}
                  className="px-4 py-2 rounded-[8px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Stop After Current Round</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE: COMPLETE */}
          {stage === 'complete' && lastBatchResult && (
            <div className="py-8 flex flex-col items-center justify-center space-y-5 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-bold text-white">Import Successfully Committed!</h3>
                <p className="text-xs text-[#B3AABD]">
                  Added <strong>{lastBatchResult.count.toLocaleString()}</strong> books to SQLite catalog with automatic barcodes and updated search collations.
                </p>
                <p className="text-[11px] font-mono text-[#BC881B] pt-1">
                  Batch ID: {lastBatchResult.batchId}
                </p>
                {undoStatusMsg && (
                  <p className="text-xs text-rose-300 bg-rose-500/10 p-2 rounded border border-rose-500/30 mt-2">
                    {undoStatusMsg}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadShelvingList}
                  className="px-4 py-2.5 rounded-[10px] bg-[#541A72] hover:bg-[#6D2394] text-white text-xs font-semibold uppercase tracking-wider border border-[#A66BC9]/40 flex items-center gap-2 shadow cursor-pointer transition-colors"
                >
                  <Layers className="w-4 h-4 text-[#C084FC]" />
                  <span>Download Shelving List</span>
                </button>

                {previewReport && previewReport.problems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadProblemReport}
                    className="px-4 py-2.5 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.12] text-amber-300 text-xs font-semibold uppercase tracking-wider border border-amber-500/30 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Problem Report</span>
                  </button>
                )}

                {onOpenLabelBatchPrint && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLabelBatchPrint(lastBatchResult.bookIds);
                    }}
                    className="px-5 py-2.5 rounded-[10px] bg-gradient-to-b from-[#BC881B] to-[#9E7216] text-white font-semibold text-xs uppercase tracking-wider shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Labels for {lastBatchResult.count} Books</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleUndoImport}
                  className="px-4 py-2.5 rounded-[10px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Undo This Import
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-[10px] bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Close &amp; Return to Catalog
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {stage === 'preview' && previewReport && (
          <div className="px-6 py-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[#1A1A1A]/80">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] text-[#B3AABD] hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Choose Different File
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[8px] bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={previewReport.readyToImportCount === 0}
                className={`px-5 py-2.5 rounded-[10px] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  previewReport.readyToImportCount > 0
                    ? 'bg-gradient-to-b from-[#BC881B] to-[#9E7216] hover:from-[#CD9520] hover:to-[#B07F19] text-white shadow-md hover:-translate-y-0.5 active:scale-[0.98]'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Import {previewReport.readyToImportCount.toLocaleString()} Books</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
