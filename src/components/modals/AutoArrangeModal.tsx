import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  X, 
  Check, 
  Building2, 
  Layers, 
  AlertCircle, 
  RotateCcw,
  Sliders,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Book, Almari, AlmariGroup } from '../../types/library';
import { AlmariService, AutoArrangeResult } from '../../services/almariService';
import { LibraryStorage } from '../../services/storage';

interface AutoArrangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  allBooks: Book[];
  onComplete: (updatedBooks: Book[], message: string, batchId: string) => void;
}

export const AutoArrangeModal: React.FC<AutoArrangeModalProps> = ({
  isOpen,
  onClose,
  allBooks,
  onComplete,
}) => {
  const [scope, setScope] = useState<'unassigned' | 'except_manual' | 'everything'>('unassigned');
  const [freeSpacePercent, setFreeSpacePercent] = useState<number>(20);
  const [order, setOrder] = useState<'barcode_series' | 'call_number'>('barcode_series');

  // Compute live preview
  const previewResult: AutoArrangeResult = useMemo(() => {
    if (!isOpen) {
      return {
        batchId: '',
        booksToUpdate: [],
        almarisCreated: [],
        linksCreated: [],
        preview: {
          totalBooksProcessed: 0,
          totalBooksPlaced: 0,
          totalBooksSkipped: 0,
          almarisSummary: [],
        },
      };
    }

    return AlmariService.autoArrangeBooks(allBooks, {
      scope,
      freeSpacePercent,
      order,
      previewOnly: true,
    });
  }, [isOpen, allBooks, scope, freeSpacePercent, order]);

  if (!isOpen) return null;

  const handleApply = () => {
    const res = AlmariService.autoArrangeBooks(allBooks, {
      scope,
      freeSpacePercent,
      order,
      previewOnly: false,
    });

    // Update books in storage
    const updateMap = new Map(res.booksToUpdate.map(b => [b.id, b]));
    const updatedFull = allBooks.map(b => updateMap.get(b.id) || b);
    LibraryStorage.saveBooks(updatedFull);

    onComplete(
      updatedFull,
      `Auto-arranged ${res.booksToUpdate.length} book(s) across ${res.preview.almarisSummary.length} cupboard(s). Created ${res.almarisCreated.length} new Almari(s).`,
      res.batchId
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#1A1A1A] border border-[#BC881B]/40 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#E7E2EC]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#221F26]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#541A72]/40 border border-[#A66BC9]/30 flex items-center justify-center text-[#E0B450]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Auto-Arrange Collection (خودکار ترتیب الماریاں)
              </h2>
              <p className="text-xs text-[#B3AABD]">Organize volumes into canonical plan Almaris with shelf capacity & free space reserve</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#221F26] p-4 rounded-xl border border-white/[0.08]">
            <div>
              <label className="block text-xs font-semibold text-[#E0B450] mb-1.5">Scope</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value as any)}
                className="w-full bg-[#1A1A1A] border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-white focus:border-[#BC881B] focus:outline-none"
              >
                <option value="unassigned">Only books without an Almari (Default)</option>
                <option value="except_manual">All except my manual placements</option>
                <option value="everything">Everything (Rebalance entire library)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E0B450] mb-1.5">Free Space Buffer</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="5"
                  value={freeSpacePercent}
                  onChange={e => setFreeSpacePercent(Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)))}
                  className="w-20 bg-[#1A1A1A] border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-center font-bold text-white"
                />
                <span className="text-xs text-[#B3AABD]">% space kept for new books</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E0B450] mb-1.5">Fill Order</label>
              <select
                value={order}
                onChange={e => setOrder(e.target.value as any)}
                className="w-full bg-[#1A1A1A] border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-white focus:border-[#BC881B] focus:outline-none"
              >
                <option value="barcode_series">Barcode Series (ULM-00001 onward)</option>
                <option value="call_number">Call Number (Dewey)</option>
              </select>
            </div>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#221F26] border border-white/[0.08] p-3 rounded-xl text-center">
              <span className="text-[11px] text-[#B3AABD] block">Books Processed</span>
              <span className="text-xl font-bold text-white">{previewResult.preview.totalBooksProcessed}</span>
            </div>
            <div className="bg-[#221F26] border border-[#BC881B]/30 p-3 rounded-xl text-center">
              <span className="text-[11px] text-[#E0B450] block">To Be Placed</span>
              <span className="text-xl font-bold text-[#E0B450]">{previewResult.preview.totalBooksPlaced}</span>
            </div>
            <div className="bg-[#221F26] border border-white/[0.08] p-3 rounded-xl text-center">
              <span className="text-[11px] text-[#B3AABD] block">New Almaris Created</span>
              <span className="text-xl font-bold text-[#34D399]">{previewResult.almarisCreated.length}</span>
            </div>
          </div>

          {/* Almari Preview Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#E0B450] flex items-center justify-between">
              <span>Preview of Almaris & Shelves to be Populated</span>
              <span className="text-[#B3AABD] font-normal">{previewResult.preview.almarisSummary.length} cupboard(s) involved</span>
            </h3>

            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {previewResult.preview.almarisSummary.map(alm => (
                <div key={alm.almariId} className="bg-[#221F26] border border-white/[0.08] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#E0B450] bg-[#BC881B]/15 px-2 py-0.5 rounded border border-[#BC881B]/30">
                        {alm.code}
                      </span>
                      <span className="font-semibold text-white text-sm">{alm.name_en}</span>
                      <span className="text-xs text-[#B3AABD] font-urdu" dir="auto">{alm.name_ur}</span>
                      {alm.isNew && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#B3AABD]">
                      {alm.booksAssignedCount} / {alm.totalCapacity} books ({alm.totalShelves} shelves)
                    </span>
                  </div>

                  {/* Shelves list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 border-t border-white/[0.04]">
                    {alm.shelves.map(s => (
                      <div key={s.shelf_no} className="bg-[#1A1A1A] p-2 rounded-lg border border-white/[0.04] text-xs flex items-center justify-between">
                        <span className="text-white font-medium">Shelf {s.shelf_no}</span>
                        <span className="font-mono text-[#E0B450] text-[11px] truncate max-w-[120px]">{s.rangeStr}</span>
                        <span className="text-[#B3AABD] text-[11px]">{s.bookCount}/{s.capacity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {previewResult.preview.totalBooksSkipped > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                {previewResult.preview.totalBooksSkipped} book(s) have no recognizable subject category and will remain in unassigned stacks.
              </span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#221F26]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={previewResult.preview.totalBooksPlaced === 0}
            className="px-6 py-2 rounded-lg text-xs font-bold bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A] transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Apply Auto-Arrange ({previewResult.preview.totalBooksPlaced} books)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
