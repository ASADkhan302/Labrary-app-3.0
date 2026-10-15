import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  IdCard, 
  Layers, 
  FileDown, 
  Loader2, 
  Check, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { Borrower } from '../../types/library';
import { MemberCard } from '../cards/MemberCard';
import { PdfGeneratorService, CardPdfLayout } from '../../services/pdfGeneratorService';

interface MemberCardPrintModalProps {
  borrower: Borrower | null;
  members?: Borrower[];
  isOpen: boolean;
  onClose: () => void;
}

export const MemberCardPrintModal: React.FC<MemberCardPrintModalProps> = ({
  borrower,
  members: passedMembers,
  isOpen,
  onClose,
}) => {
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [cardLayout, setCardLayout] = useState<CardPdfLayout>('cr80_single');
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number>(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<{ type: 'info' | 'success' | 'warn'; message: string } | null>(null);

  // Combine passed members or single borrower
  const memberList: Borrower[] = React.useMemo(() => {
    if (passedMembers && passedMembers.length > 0) return passedMembers;
    if (borrower) return [borrower];
    return [];
  }, [passedMembers, borrower]);

  const currentMember = memberList[selectedMemberIndex] || memberList[0] || null;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMemberIndex(0);
    setStatusNotification(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || memberList.length === 0 || !currentMember) return null;

  // Handle Save as PDF
  const handleSaveAsPdf = async () => {
    setIsGeneratingPdf(true);
    setStatusNotification({ type: 'info', message: 'Generating exact physical PDF...' });

    try {
      const result = await PdfGeneratorService.generateMemberCardsPdf(memberList, {
        layout: cardLayout,
      });

      PdfGeneratorService.downloadPdf(result.doc, result.filename);
      setStatusNotification({
        type: 'success',
        message: `Saved ${result.cardCount} card(s) across ${result.pageCount} page(s) to ${result.filename}`,
      });
    } catch (err: any) {
      setStatusNotification({
        type: 'warn',
        message: `Failed to export PDF: ${err.message || 'Error occurred'}`,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle Print via isolated PDF print
  const handlePrint = async () => {
    setIsGeneratingPdf(true);
    setStatusNotification({ type: 'info', message: 'Preparing print document...' });

    try {
      const result = await PdfGeneratorService.generateMemberCardsPdf(memberList, {
        layout: cardLayout,
      });

      const blob = result.doc.output('blob');
      const printRes = await PdfGeneratorService.printPdfBlob(blob);

      if (!printRes.success && printRes.blocked) {
        setStatusNotification({
          type: 'warn',
          message: 'Printing is blocked in this preview frame. Please click "Save as PDF" to download your card, or open the app in a new browser tab.',
        });
      } else {
        setStatusNotification({ type: 'success', message: 'Print dialog dispatched.' });
      }
    } catch {
      setStatusNotification({
        type: 'warn',
        message: 'Printing is blocked here. Use Save as PDF, or open the app in its own tab.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 print:p-0 print:bg-white print:fixed print:inset-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0B1220] border border-[#334155] rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all text-slate-200 print:border-none print:shadow-none print:w-auto print:max-w-none print:bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#020617] border-b border-[#334155] flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <IdCard className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-cinzel leading-tight flex items-center gap-2">
                <span>Official CR80 Member Identification Card</span>
                {memberList.length > 1 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {memberList.length} Cards Selected
                  </span>
                )}
              </h3>
              <p className="text-[10.5px] font-mono text-slate-400">
                CR80 Spec: 85.6 mm × 54.0 mm · Standard Thermal / PVC Card • High DPI Vector
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

        {/* Status Notification */}
        {statusNotification && (
          <div className={`px-5 py-2 border-b flex items-center justify-between text-xs ${
            statusNotification.type === 'warn'
              ? 'bg-amber-950/40 border-amber-600/30 text-amber-200'
              : statusNotification.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-600/30 text-emerald-200'
              : 'bg-blue-950/40 border-blue-600/30 text-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {statusNotification.type === 'warn' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Info className="w-4 h-4" />}
              <span>{statusNotification.message}</span>
            </div>
            <button onClick={() => setStatusNotification(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar Controls */}
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

          {/* Print / PDF Layout Option */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Layout:
            </span>
            <select
              value={cardLayout}
              onChange={(e) => setCardLayout(e.target.value as CardPdfLayout)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-2.5 py-1 outline-hidden focus:border-amber-500 cursor-pointer"
            >
              <option value="cr80_single">Exact CR80 Pages (85.6 × 54 mm)</option>
              <option value="a4_sheet_10">A4 Sheet (10 Cards: 2 × 5 with Crop Marks)</option>
              <option value="a4_duplex">Double-Sided A4 (Fronts on p1, Mirrored Backs on p2)</option>
            </select>
          </div>

          {/* Member Navigator if multiple cards */}
          {memberList.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
              <button
                type="button"
                disabled={selectedMemberIndex <= 0}
                onClick={() => setSelectedMemberIndex(idx => Math.max(0, idx - 1))}
                className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>{selectedMemberIndex + 1} / {memberList.length}</span>
              <button
                type="button"
                disabled={selectedMemberIndex >= memberList.length - 1}
                onClick={() => setSelectedMemberIndex(idx => Math.min(memberList.length - 1, idx + 1))}
                className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Interactive Preview Container */}
        <div className="p-6 flex flex-col items-center justify-center bg-[#020617]/50 space-y-4 print:hidden">
          <div className="transition-transform duration-200 hover:scale-[1.01]">
            <MemberCard member={currentMember} side={activeSide} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400 font-mono">
            <span>Dimensions: 85.6 × 54.0 mm</span>
            <span>•</span>
            <span>PVC / Thermal Card Standard</span>
            <span>•</span>
            <span className="text-amber-400 font-bold">{currentMember.name} ({currentMember.university_id || currentMember.student_id})</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#020617] border-t border-[#334155] flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-400 font-mono">
            Status: <span className="text-emerald-400 font-bold">{currentMember.status.toUpperCase()}</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>

            {/* Save as PDF Button */}
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleSaveAsPdf}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              title="Save exact physical PDF with crop marks or CR80 dimensions"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span>Save as PDF</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberCardPrintModal;
