import React, { useState } from 'react';
import { 
  X, 
  FolderSync, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight, 
  FileSpreadsheet, 
  ShieldAlert, 
  Trash2,
  Edit3,
  PlusCircle
} from 'lucide-react';
import { ExternalChangesSummary } from '../../services/libraryDataFilesService';

interface DataFilesDiffModalProps {
  isOpen: boolean;
  summary: ExternalChangesSummary | null;
  onImportChanges: (applyDeletions: boolean, preferredSource: 'xlsx' | 'csv') => void;
  onIgnoreAndRewrite: () => void;
  onClose: () => void;
}

export const DataFilesDiffModal: React.FC<DataFilesDiffModalProps> = ({
  isOpen,
  summary,
  onImportChanges,
  onIgnoreAndRewrite,
  onClose,
}) => {
  const [applyDeletions, setApplyDeletions] = useState(false);
  const [preferredSource, setPreferredSource] = useState<'xlsx' | 'csv'>('xlsx');

  if (!isOpen || !summary || !summary.hasChanges) return null;

  const { booksDiff, isConflict } = summary;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl max-h-[90vh] bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-white/10 rounded-[16px] shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#BC881B]" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450]">
              <FolderSync className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>External Library Data File Changes Detected</span>
                {isConflict && (
                  <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    File Conflict
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#B3AABD] mt-0.5">
                The data files in your library folder were modified outside this workstation session.
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Conflict Notice */}
          {isConflict && (
            <div className="p-4 rounded-[12px] bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Conflict: Both LibraryData.xlsx and books.csv were modified with differing data</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Please select which file should be treated as authoritative for this synchronisation:
              </p>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="preferredSource"
                    checked={preferredSource === 'xlsx'}
                    onChange={() => setPreferredSource('xlsx')}
                    className="accent-[#BC881B]"
                  />
                  <span>Use LibraryData.xlsx (Recommended)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="preferredSource"
                    checked={preferredSource === 'csv'}
                    onChange={() => setPreferredSource('csv')}
                    className="accent-[#BC881B]"
                  />
                  <span>Use books.csv</span>
                </label>
              </div>
            </div>
          )}

          {/* Change Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-[12px] bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">New Titles</p>
                <p className="text-xl font-bold text-white mt-0.5">{booksDiff.newRows.length}</p>
                <p className="text-[11px] text-emerald-400/80">Will be assigned barcodes</p>
              </div>
            </div>

            <div className="p-4 rounded-[12px] bg-sky-500/10 border border-sky-500/25 flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-sky-300 uppercase tracking-wider">Modified Titles</p>
                <p className="text-xl font-bold text-white mt-0.5">{booksDiff.changedRows.length}</p>
                <p className="text-[11px] text-sky-400/80">Matched by Record ID</p>
              </div>
            </div>

            <div className="p-4 rounded-[12px] bg-rose-500/10 border border-rose-500/25 flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Missing in File</p>
                <p className="text-xl font-bold text-white mt-0.5">{booksDiff.missingRows.length}</p>
                <p className="text-[11px] text-rose-400/80">Kept safe in catalog</p>
              </div>
            </div>
          </div>

          {/* Safety Deletion Toggle */}
          {booksDiff.missingRows.length > 0 && (
            <div className="p-3.5 rounded-[10px] bg-[#141214] border border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white">Missing Record Preservation</p>
                <p className="text-[11px] text-[#B3AABD]">
                  By default, missing rows are preserved in catalog. Check this only if you intentionally deleted them.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#E0D8E6] font-semibold cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={applyDeletions}
                  onChange={(e) => setApplyDeletions(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#BC881B]"
                />
                <span>Also apply deletions</span>
              </label>
            </div>
          )}

          {/* Detailed Changes List */}
          {booksDiff.changedRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D6CFE0]">
                Sample Field Updates ({booksDiff.changedRows.length} titles)
              </p>
              <div className="border border-white/10 rounded-[10px] bg-[#141214] max-h-48 overflow-y-auto divide-y divide-white/5">
                {booksDiff.changedRows.slice(0, 10).map((change, idx) => (
                  <div key={idx} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{(change.newData as any).book_name || (change.oldData as any).book_name}</p>
                      <p className="text-[11px] text-[#B3AABD]">Changed fields: {change.changedFields.join(', ')}</p>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400">Record #{change.id.slice(-6)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[#1A1A1A]">
          <button
            onClick={onIgnoreAndRewrite}
            className="px-4 py-2 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] text-[#B3AABD] hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            title="Overwrites files with the current database state"
          >
            Ignore &amp; Rewrite Files from App
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[8px] bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onImportChanges(applyDeletions, preferredSource)}
              className="px-5 py-2.5 rounded-[10px] bg-gradient-to-b from-[#BC881B] to-[#9E7216] hover:from-[#CD9520] hover:to-[#B07F19] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Import Changes to Database</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
