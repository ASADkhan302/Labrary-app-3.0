import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, IdCard, Layers } from 'lucide-react';
import { Borrower } from '../../types/library';
import { MemberCard } from '../cards/MemberCard';

interface MemberCardPrintModalProps {
  borrower: Borrower | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MemberCardPrintModal: React.FC<MemberCardPrintModalProps> = ({
  borrower,
  isOpen,
  onClose,
}) => {
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [printMode, setPrintMode] = useState<'current' | 'both'>('both');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !borrower) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 print:p-0 print:bg-white print:fixed print:inset-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0B1220] border border-[#334155] rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all text-slate-200 print:border-none print:shadow-none print:w-auto print:max-w-none print:bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Hidden on Print) */}
        <div className="px-5 py-3.5 bg-[#020617] border-b border-[#334155] flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <IdCard className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-cinzel leading-tight">
                Official CR80 Member Identification Card
              </h3>
              <p className="text-[10.5px] font-mono text-slate-400">
                CR80 Spec: 85.6 mm × 54.0 mm · Standard Thermal / PVC Card
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar Controls (Hidden on Print) */}
        <div className="px-5 py-2.5 bg-[#080d19] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          {/* Side Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSide('front')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeSide === 'front'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Front Side
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('back')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeSide === 'back'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Back Side
            </button>
          </div>

          {/* Print Layout Option */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Print:
            </span>
            <select
              value={printMode}
              onChange={(e) => setPrintMode(e.target.value as 'current' | 'both')}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1 outline-hidden focus:border-amber-500 cursor-pointer"
            >
              <option value="both">Both Sides (Dual CR80)</option>
              <option value="current">Current Side Only</option>
            </select>
          </div>
        </div>

        {/* Interactive Preview Container (Screen View) */}
        <div className="p-6 flex flex-col items-center justify-center bg-[#020617]/50 space-y-4 print:hidden">
          <div className="transition-transform duration-200 hover:scale-[1.01]">
            <MemberCard member={borrower} side={activeSide} />
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span>Dimensions: 398 × 227 px (7:4 Ratio)</span>
            <span>·</span>
            <span>PVC Plastic Standard</span>
          </div>
        </div>

        {/* PRINT ONLY SECTION: Exact High-Resolution Print Output */}
        <div className="hidden print:block print:p-0">
          <div className="flex flex-col items-center justify-center gap-8 py-4">
            {(printMode === 'both' || activeSide === 'front') && (
              <div className="print-card-wrapper page-break-after">
                <MemberCard member={borrower} side="front" />
              </div>
            )}
            {(printMode === 'both' || activeSide === 'back') && (
              <div className="print-card-wrapper">
                <MemberCard member={borrower} side="back" />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions (Hidden on Print) */}
        <div className="px-5 py-3.5 bg-[#020617] border-t border-[#334155] flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-400 font-mono">
            Status: <span className="text-emerald-400 font-bold">{borrower.status.toUpperCase()}</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Member Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberCardPrintModal;
