import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  BookOpen, 
  PanelLeftClose, 
  PanelLeftOpen, 
  QrCode, 
  RotateCw, 
  HardDrive,
  AlertCircle,
  Menu
} from 'lucide-react';
import { NavigationTab } from '../types/library';
import { ULM_CREST_SRC } from '../assets/brand/crestData';

interface PrimaryHeaderProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onOpenAddBook: () => void;
  onQuickExport: () => void;
  onReloadData?: () => void;
  onOpenStorageConfig?: () => void;
  storageLocationPath?: string;
  totalBooksCount?: number;
  activeLoansCount?: number;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
  universityName?: string;
  libraryName?: string;
  waitingBooksCount?: number;
  onRetrySheetSync?: () => void;
}

export const PrimaryHeader: React.FC<PrimaryHeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenAddBook,
  onQuickExport,
  onReloadData,
  onOpenStorageConfig,
  storageLocationPath,
  isSidebarCollapsed = false,
  onToggleSidebar,
  universityName = 'University of Lakki Marwat',
  libraryName = 'Campus Catalog & Circulation',
  waitingBooksCount = 0,
  onRetrySheetSync,
}) => {
  const [isRotating, setIsRotating] = useState(false);

  const handleRefreshClick = () => {
    setIsRotating(true);
    if (onReloadData) onReloadData();
    setTimeout(() => setIsRotating(false), 600);
  };

  return (
    <header className="w-full transition-colors duration-150 border-b shrink-0 z-40 select-none border-[var(--border)] bg-[var(--background)]">
      {/* Main Top Header Bar */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Sidebar Toggle + Institutional Insignia + Breadcrumb */}
        <div className="flex items-center gap-3.5 min-w-0">
          {onToggleSidebar && (
            <>
              {/* Mobile Menu button below 768px */}
              <button
                onClick={onToggleSidebar}
                title={isSidebarCollapsed ? "Open Menu" : "Close Menu"}
                className="btn-icon md:hidden inline-flex items-center justify-center p-2 rounded-[8px] text-[var(--gold-text)] hover:bg-[#2B2730] transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                {isSidebarCollapsed ? (
                  <Menu className="w-5 h-5 text-[var(--text-accent)]" />
                ) : (
                  <PanelLeftClose className="w-5 h-5 text-[var(--text-muted)]" />
                )}
              </button>
              {/* Desktop Collapse / Expand button */}
              <button
                onClick={onToggleSidebar}
                title={isSidebarCollapsed ? "Expand Sidebar (⌘B)" : "Collapse Sidebar (⌘B)"}
                className="btn-icon hidden md:inline-flex"
                aria-label="Toggle Sidebar"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-[var(--text-accent)]" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>
            </>
          )}

          {/* Insignia Crest Badge (Round dark badge #141214 with 1px gold border) */}
          <div 
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#141214] border border-[#BC881B]/40 flex items-center justify-center shrink-0 overflow-hidden shadow-md p-1 hover:border-[#BC881B] transition-colors"
            title="University of Lakki Marwat Official Crest"
          >
            <img 
              src={ULM_CREST_SRC} 
              alt="University of Lakki Marwat crest" 
              width={40} 
              height={40} 
              className="w-full h-full object-contain"
              style={{ imageRendering: 'auto' }}
            />
          </div>

          <div className="flex flex-col justify-center min-w-0">
            <span className="font-cinzel font-bold text-[19px] sm:text-[22px] md:text-[23px] tracking-[0.05em] uppercase truncate leading-none text-white drop-shadow-xs">
              {universityName}
            </span>
            <span className="text-[13px] sm:text-[14px] font-semibold text-blue-400 dark:text-blue-300 tracking-[0.08em] uppercase font-sans truncate leading-none mt-1">
              {libraryName}
            </span>
          </div>
        </div>

        {/* Right Section: Core Utility Actions */}
        <div className="flex items-center justify-end gap-2.5 shrink-0">
          {/* Quick Barcode Station Launcher */}
          {activeTab !== 'scanner' && activeTab !== 'catalog' && (
            <button
              onClick={() => onTabChange('scanner')}
              className="h-9 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] hidden lg:inline-flex items-center justify-center gap-2 cursor-pointer"
              title="Barcode Scanner Station (⌘2)"
            >
              <QrCode className="w-4 h-4 text-[#E0B450] shrink-0" />
              <span>Barcode Station</span>
            </button>
          )}

          {/* Database Storage Location Configuration */}
          {onOpenStorageConfig && (
            <button
              onClick={onOpenStorageConfig}
              className="h-9 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] inline-flex items-center justify-center gap-2 max-w-[180px] sm:max-w-[220px] cursor-pointer"
              title={`Database Storage Directory: ${storageLocationPath || 'C:\\ULM_Library_Database'}. Click to configure storage location.`}
            >
              <HardDrive className="w-4 h-4 text-[#E0B450] shrink-0" />
              <span className="hidden md:inline font-mono text-[12px] truncate">
                {storageLocationPath ? (storageLocationPath.split(/[\\/]/).pop() || storageLocationPath) : 'Storage'}
              </span>
            </button>
          )}

          {/* Synchronize / Refresh Database Store */}
          {onReloadData && (
            <button
              onClick={handleRefreshClick}
              className="h-9 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] inline-flex items-center justify-center gap-2 cursor-pointer"
              title="Synchronize UI with Database / Reload"
            >
              <RotateCw className={`w-4 h-4 text-[#E0B450] shrink-0 ${isRotating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>
          )}

          {/* Export Center Trigger */}
          <button
            onClick={onQuickExport}
            className="h-9 px-3.5 rounded-[10px] bg-[#541A72] hover:bg-[#6A2290] active:bg-[#3F1256] text-white border border-[#A66BC9]/30 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] inline-flex items-center justify-center gap-2 cursor-pointer"
            title="Export Catalog & Transactions to CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Sheet Write Waiting Indicator (Excel Lock) */}
          {waitingBooksCount !== undefined && waitingBooksCount > 0 && (
            <button
              type="button"
              onClick={onRetrySheetSync}
              className="h-9 px-3 rounded-[8px] bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
              title="Excel file lock detected. Close Excel and click here to synchronize."
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{waitingBooksCount} {waitingBooksCount === 1 ? 'book' : 'books'} waiting for the sheet - close Excel</span>
            </button>
          )}

          {/* Primary Action: Add Book */}
          <button
            onClick={onOpenAddBook}
            className="h-9 px-4 rounded-[10px] bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:from-[#D4A02A] hover:to-[#E0B450] active:scale-95 text-[#1A1A1A] font-bold text-[12px] shadow-[0_2px_12px_rgba(188,136,27,0.35)] hover:shadow-[0_4px_16px_rgba(188,136,27,0.5)] border border-[#E0B450]/40 transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29658E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] inline-flex items-center justify-center gap-2 cursor-pointer"
            title="Add New Book Title to Catalog"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Add Book</span>
          </button>
        </div>
      </div>
    </header>
  );
};
