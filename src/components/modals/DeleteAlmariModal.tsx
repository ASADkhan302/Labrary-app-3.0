import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Trash2, 
  AlertTriangle, 
  X, 
  Check, 
  ArrowRight,
  BookOpen,
  Clock,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { Almari, Book } from '../../types/library';
import { AlmariService } from '../../services/almariService';

export interface DeleteAlmariModalProps {
  almari: Almari;
  allBooks: Book[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (almariId: string, action: 'move' | 'unassign', targetAlmariId?: string) => void;
}

export const DeleteAlmariModal: React.FC<DeleteAlmariModalProps> = ({
  almari,
  allBooks,
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  const [action, setAction] = useState<'move' | 'unassign'>('unassign');
  const [targetAlmariId, setTargetAlmariId] = useState<string>('');
  const [hasConfirmedCheckbox, setHasConfirmedCheckbox] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  // Compute books placed in this almari
  const placedBooks = useMemo(() => {
    return allBooks.filter(b => b.is_active && b.almari_id === almari.id);
  }, [allBooks, almari.id]);

  // Compute on loan books
  const booksOnLoan = useMemo(() => {
    return placedBooks.filter(b => {
      const avail = b.available_quantity !== undefined ? b.available_quantity : b.total_quantity;
      return (b.total_quantity - avail) > 0;
    });
  }, [placedBooks]);

  const totalCopies = useMemo(() => {
    return placedBooks.reduce((sum, b) => sum + (b.total_quantity || 1), 0);
  }, [placedBooks]);

  // Available destination almaris with capacity left
  const availableAlmaris = useMemo(() => {
    const list = AlmariService.getAlmaris().filter(a => a.is_active && a.id !== almari.id);
    return list.map(a => {
      const bks = allBooks.filter(b => b.is_active && b.almari_id === a.id);
      const totalPlaced = bks.reduce((sum, b) => sum + (b.total_quantity || 1), 0);
      const cap = AlmariService.getAlmariTotalCapacity(a);
      const capacityLeft = Math.max(0, cap - totalPlaced);
      return {
        ...a,
        totalPlaced,
        totalCapacity: cap,
        capacityLeft,
      };
    });
  }, [allBooks, almari.id]);

  useEffect(() => {
    if (action === 'move' && !targetAlmariId && availableAlmaris.length > 0) {
      setTargetAlmariId(availableAlmaris[0].id);
    }
  }, [action, targetAlmariId, availableAlmaris]);

  if (!isOpen) return null;

  const hasBooks = placedBooks.length > 0;
  const canDelete = !hasBooks || (hasConfirmedCheckbox && (action !== 'move' || Boolean(targetAlmariId)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasBooks) {
      if (action === 'move' && (!targetAlmariId || availableAlmaris.length === 0)) {
        setBlockedMessage('Delete blocked: Please select a valid destination almari to receive the books.');
        return;
      }
      if (!hasConfirmedCheckbox) {
        setBlockedMessage(`Delete blocked: Please confirm the checkbox acknowledging that ${placedBooks.length} book(s) will be ${action === 'move' ? 'moved' : 'unassigned'}.`);
        return;
      }
    }
    setBlockedMessage(null);
    onConfirmDelete(almari.id, action, action === 'move' ? targetAlmariId : undefined);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-almari-title"
    >
      <div 
        className="w-full max-w-[560px] bg-[#1A1A1A] border border-rose-500/40 rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2E2A33] bg-[#221F26]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-rose-950/40 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-almari-title" className="text-[16px] font-bold text-white leading-snug">
                Delete {almari.name_en} - {almari.code}?
              </h3>
              <p className="text-[12px] text-[#B3AABD] font-urdu" dir="auto">
                {almari.name_ur}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[6px] text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 text-[13px]">
          {/* Reassurance Banner: Books are NEVER deleted */}
          <div className="p-3.5 rounded-[12px] bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-amber-300 font-semibold block mb-0.5">Books are NEVER deleted:</strong>
              Deleting this cupboard only removes the physical cupboard structure and shelves. All {placedBooks.length} titles and {totalCopies} copies remain safely in the catalog registry.
            </div>
          </div>

          {/* Impact Summary Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-[10px] bg-[#221F26] border border-[#2E2A33] text-center">
              <span className="text-[11px] text-[#B3AABD] uppercase tracking-wider block">Shelves</span>
              <span className="text-lg font-mono font-bold text-white">{almari.shelf_count}</span>
            </div>
            <div className="p-3 rounded-[10px] bg-[#221F26] border border-[#2E2A33] text-center">
              <span className="text-[11px] text-[#B3AABD] uppercase tracking-wider block">Placed Books</span>
              <span className={`text-lg font-mono font-bold ${hasBooks ? 'text-[#E0B450]' : 'text-white'}`}>
                {placedBooks.length} <span className="text-xs text-[#B3AABD]">({totalCopies} cps)</span>
              </span>
            </div>
            <div className="p-3 rounded-[10px] bg-[#221F26] border border-[#2E2A33] text-center">
              <span className="text-[11px] text-[#B3AABD] uppercase tracking-wider block">On Loan</span>
              <span className={`text-lg font-mono font-bold ${booksOnLoan.length > 0 ? 'text-[#FB7185]' : 'text-white'}`}>
                {booksOnLoan.length}
              </span>
            </div>
          </div>

          {/* Placement Choice (if books exist) */}
          {hasBooks ? (
            <div className="space-y-3 pt-1">
              <label className="block text-xs font-semibold text-[#E7E2EC] tracking-wide">
                Where should the {placedBooks.length} placed books go?
              </label>

              <div className="space-y-2.5">
                {/* Option A: Move to another Almari */}
                <label 
                  className={`p-3.5 rounded-[12px] border transition-all cursor-pointer flex items-start gap-3 ${
                    action === 'move'
                      ? 'bg-[rgba(166,107,201,0.14)] border-[#E0B450]'
                      : 'bg-[#221F26] border-[#2E2A33] hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="delete-action"
                    checked={action === 'move'}
                    onChange={() => {
                      setAction('move');
                      if (!targetAlmariId && availableAlmaris.length > 0) {
                        setTargetAlmariId(availableAlmaris[0].id);
                      }
                    }}
                    className="accent-[#E0B450] mt-1 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-white block">Move the books to another almari</span>
                    <span className="text-[12px] text-[#B3AABD] block mt-0.5">
                      Transfers the books' placement into another active cupboard.
                    </span>

                    {action === 'move' && (
                      <div className="mt-3">
                        <select
                          value={targetAlmariId}
                          onChange={e => setTargetAlmariId(e.target.value)}
                          className="w-full h-9 px-3 bg-[#1A1A1A] border border-[#BC881B]/50 rounded-[8px] text-[12px] font-mono text-white focus:outline-none focus:border-[#E0B450] cursor-pointer"
                        >
                          {availableAlmaris.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name_en} ({a.capacityLeft} slots available of {a.totalCapacity})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </label>

                {/* Option B: Leave Unassigned */}
                <label 
                  className={`p-3.5 rounded-[12px] border transition-all cursor-pointer flex items-start gap-3 ${
                    action === 'unassign'
                      ? 'bg-[rgba(166,107,201,0.14)] border-[#E0B450]'
                      : 'bg-[#221F26] border-[#2E2A33] hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="delete-action"
                    checked={action === 'unassign'}
                    onChange={() => setAction('unassign')}
                    className="accent-[#E0B450] mt-1 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-white block">Leave them unassigned (No almari)</span>
                    <span className="text-[12px] text-[#B3AABD] block mt-0.5">
                      Books remain in the catalog and will appear under the "No almari" card for future assignment.
                    </span>
                  </div>
                </label>
              </div>

              {/* Confirmation Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-[10px] bg-rose-950/20 border border-rose-500/30 text-rose-200 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={hasConfirmedCheckbox}
                    onChange={e => {
                      setHasConfirmedCheckbox(e.target.checked);
                      if (blockedMessage) setBlockedMessage(null);
                    }}
                    className="accent-rose-500 w-4 h-4 cursor-pointer rounded"
                  />
                  <span>I understand the books will be {action === 'move' ? 'moved' : 'unassigned'} and this cupboard will be removed</span>
                </label>
              </div>
            </div>
          ) : (
            <p className="text-[#B3AABD] text-xs">
              This cupboard is currently empty (0 books). Deleting it will mark it inactive and update campus capacity counters immediately.
            </p>
          )}

          {/* Blocked message notice */}
          {blockedMessage && (
            <div className="p-3 rounded-[10px] bg-rose-950/70 border border-rose-500 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{blockedMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2E2A33]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-10 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] text-[#B3AABD] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 h-10 rounded-[8px] text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
                canDelete
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_2px_12px_rgba(225,29,72,0.4)]'
                  : 'bg-rose-900/60 hover:bg-rose-900/80 text-rose-200 border border-rose-700/60'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Almari</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
