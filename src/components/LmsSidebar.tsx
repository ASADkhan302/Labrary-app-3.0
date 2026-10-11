import React, { useState, useEffect } from 'react';
import { 
  Search, 
  BookOpen, 
  ArrowRightLeft, 
  Users, 
  BarChart3, 
  QrCode, 
  FileSpreadsheet, 
  Settings, 
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  X,
  Menu,
  GraduationCap,
  Library
} from 'lucide-react';
import { NavigationTab, Book } from '../types/library';
import { ULM_CREST_SRC } from '../assets/brand/crestData';

export type LmsNavItemData = {
  id: NavigationTab | 'search';
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  shortcut?: string;
  children?: LmsNavItemData[];
};

export type LmsNavGroupData = {
  heading?: string;
  items: LmsNavItemData[];
};

interface LmsSidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  totalBooksCount: number;
  activeLoansCount: number;
  totalBorrowersCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: (open: boolean) => void;
  catalogBooks?: Book[];
  onSelectBook?: (book: Book) => void;
  universityName?: string;
  libraryName?: string;
}

export function LmsSidebar({
  activeTab,
  onTabChange,
  totalBooksCount,
  activeLoansCount,
  totalBorrowersCount,
  isCollapsed,
  onToggleCollapse,
  isSearchOpen: externalIsSearchOpen,
  onToggleSearch,
  catalogBooks = [],
  onSelectBook,
  universityName = 'University of Lakki Marwat',
  libraryName = 'Central Campus Library',
}: LmsSidebarProps) {
  const [selectedCampus, setSelectedCampus] = useState('Central Campus LMS');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [internalIsSearchOpen, setInternalIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [windowDimensions, setWindowDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowDimensions.width < 768;
  const isShortScreen = windowDimensions.height < 800;

  // 72px / 4.5rem icon rail when collapsed or below 1100px (slide-in drawer below 768px)
  const isRail = !isMobile && (isCollapsed || windowDimensions.width < 1100);

  const isSearchOpen = externalIsSearchOpen !== undefined ? externalIsSearchOpen : internalIsSearchOpen;
  const setIsSearchOpen = (open: boolean) => {
    if (onToggleSearch) {
      onToggleSearch(open);
    } else {
      setInternalIsSearchOpen(open);
    }
  };

  // Keyboard shortcut listener for Command+K / Ctrl+K and ⌘1-⌘6, ⌘,, ⌘B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
        return;
      }

      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !isInputFocused) {
        e.preventDefault();
        onToggleCollapse();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !isInputFocused) {
        if (e.key === '1') { e.preventDefault(); onTabChange('catalog'); }
        else if (e.key === '2') { e.preventDefault(); onTabChange('scanner'); }
        else if (e.key === '3') { e.preventDefault(); onTabChange('circulation'); }
        else if (e.key === '4') { e.preventDefault(); onTabChange('borrowers'); }
        else if (e.key === '5') { e.preventDefault(); onTabChange('reports'); }
        else if (e.key === '6') { e.preventDefault(); onTabChange('excel'); }
        else if (e.key === ',') { e.preventDefault(); onTabChange('settings'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, onTabChange, onToggleCollapse]);

  const navGroups: LmsNavGroupData[] = [
    {
      items: [
        { id: 'search', title: 'Quick Search', icon: Search, shortcut: '⌘K' },
        { 
          id: 'catalog', 
          title: 'Books Catalog', 
          icon: BookOpen, 
          badge: totalBooksCount,
          shortcut: '⌘1'
        },
        { 
          id: 'almaris', 
          title: 'Almaris & Shelves', 
          icon: Library,
          shortcut: '⌘A'
        },
        { 
          id: 'scanner', 
          title: 'Barcode Station', 
          icon: QrCode,
          shortcut: '⌘2'
        },
      ]
    },
    {
      heading: 'CIRCULATION & DESK',
      items: [
        { 
          id: 'circulation', 
          title: 'Circulation Desk', 
          icon: ArrowRightLeft, 
          badge: activeLoansCount > 0 ? activeLoansCount : undefined,
          shortcut: '⌘3'
        },
        { 
          id: 'borrowers', 
          title: 'Borrowers & Faculty', 
          icon: Users, 
          badge: totalBorrowersCount,
          shortcut: '⌘4'
        },
      ]
    },
    {
      heading: 'ANALYTICS & DATA',
      items: [
        { id: 'reports', title: 'Reports & Audits', icon: BarChart3, shortcut: '⌘5' },
        { id: 'excel', title: 'Excel & PC Migration', icon: FileSpreadsheet, shortcut: '⌘6' },
      ]
    }
  ];

  const bottomItems: LmsNavItemData[] = [
    { id: 'settings', title: 'System Settings', icon: Settings, shortcut: '⌘,' },
  ];

  const handleItemClick = (id: NavigationTab | 'search') => {
    if (id === 'search') {
      setIsSearchOpen(true);
      if (isMobile) onToggleCollapse();
      return;
    }
    onTabChange(id as NavigationTab);
    if (isMobile) {
      onToggleCollapse();
    }
  };

  const campuses = [
    'Central Campus LMS',
    'Main Library (Block A)',
    'Engineering & Tech Wing',
    'Postgraduate Research Unit'
  ];

  // Responsive sidebar width: 232px at >=1440px, 216px from 1200 to 1439px, 72px rail below 1100px or when collapsed
  const getSidebarWidthClass = () => {
    if (isRail) {
      return 'w-[72px] min-w-[72px] max-w-[72px]';
    }
    if (windowDimensions.width >= 1440) {
      return 'w-[232px] min-w-[232px] max-w-[232px]';
    }
    return 'w-[216px] min-w-[216px] max-w-[216px]';
  };

  const itemHeightClass = isShortScreen ? 'h-[36px]' : 'h-[40px]';

  return (
    <>
      {/* Mobile Drawer Backdrop below 768px */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-200"
          onClick={onToggleCollapse}
          aria-hidden="true"
        />
      )}

      <aside 
        className={`h-full flex flex-col shrink-0 select-none border-r border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] transition-all duration-200 ease-out ${getSidebarWidthClass()} ${
          isMobile
            ? `fixed inset-y-0 left-0 z-50 shadow-2xl ${
                !isCollapsed ? 'translate-x-0' : '-translate-x-full pointer-events-none'
              }`
            : 'relative z-30'
        }`}
      >
        {/* Top Header Block (crest 36px, library name 15px) */}
        <div className={`border-b border-[var(--border)] shrink-0 relative ${isShortScreen ? 'p-2.5' : 'p-3'}`}>
          <div 
            onClick={() => !isRail && setIsWorkspaceOpen(!isWorkspaceOpen)}
            className={`flex items-center justify-between p-1.5 rounded-[10px] cursor-pointer transition-colors duration-150 hover:bg-[#2B2730] ${isRail ? 'justify-center p-1' : ''}`}
            title={selectedCampus}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div 
                className="w-[36px] h-[36px] min-w-[36px] min-h-[36px] rounded-full bg-[#141214] border border-[#BC881B]/40 flex items-center justify-center shrink-0 overflow-hidden shadow-sm p-0.5" 
                title="University of Lakki Marwat Official Crest"
              >
                <img 
                  src={ULM_CREST_SRC} 
                  alt="University of Lakki Marwat crest" 
                  width={30} 
                  height={30} 
                  className="w-[30px] h-[30px] object-contain"
                  style={{ imageRendering: 'auto' }}
                />
              </div>
              {!isRail && (
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold leading-tight truncate text-[var(--text-primary)]">
                    {libraryName || selectedCampus}
                  </span>
                  <span className="text-[11px] text-[var(--text-accent)] font-mono leading-none mt-1 uppercase font-semibold truncate">
                    {universityName || 'Univ. Lakki Marwat'}
                  </span>
                </div>
              )}
            </div>

            {!isRail && (
              <div className="flex items-center gap-1">
                {isMobile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCollapse();
                    }}
                    className="p-1 text-[var(--text-muted)] hover:text-white rounded-[6px] transition-colors"
                    title="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {!isMobile && (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] transition-colors shrink-0 ml-1.5" />
                )}
              </div>
            )}
          </div>

          {/* Workspace dropdown */}
          {isWorkspaceOpen && !isRail && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsWorkspaceOpen(false)} />
              <div className="absolute top-[60px] left-3 right-3 rounded-[12px] shadow-lg z-50 p-2 flex flex-col gap-1 border border-[var(--border)] bg-[var(--card)]">
                <div className="px-3 py-1 text-[12px] uppercase font-semibold text-[var(--text-muted)]">
                  Select Campus Unit
                </div>
                {campuses.map(campus => (
                  <button
                    key={campus}
                    onClick={() => {
                      setSelectedCampus(campus);
                      setIsWorkspaceOpen(false);
                    }}
                    className={`h-9 px-3 text-left text-[14px] rounded-[8px] transition-colors duration-150 ${
                      selectedCampus === campus
                        ? 'bg-[#2A1338] text-[var(--text-accent)] font-semibold border border-[#BC881B]/40'
                        : 'text-[var(--text-primary)] hover:bg-[#2B2730]'
                    }`}
                  >
                    {campus}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation Items List: Pinned header/footer, only list scrolls */}
        <div className={`flex-1 overflow-y-auto min-h-0 px-2.5 sm:px-3 flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#2B2730] [&::-webkit-scrollbar-thumb]:rounded-full ${
          isShortScreen ? 'py-2 gap-1' : 'py-3 gap-1.5'
        }`}>
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-1">
              {group.heading && !isRail && (
                <span className={`px-3 mb-1 text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--text-muted)] select-none ${
                  isShortScreen ? 'mt-3' : 'mt-4'
                }`}>
                  {group.heading}
                </span>
              )}
              {isRail && group.heading && (
                <div className={`h-[1px] mx-3 bg-[var(--border)] ${isShortScreen ? 'my-1.5' : 'my-2'}`} />
              )}
              {group.items.map(item => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    title={item.title}
                    className={`group relative flex items-center justify-between ${
                      isRail ? 'px-0 justify-center' : 'px-3 gap-3'
                    } ${itemHeightClass} rounded-[10px] cursor-pointer transition-all duration-150 text-left w-full border text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC881B] focus-visible:ring-offset-1 focus-visible:ring-offset-[#141214] ${
                      isActive
                        ? 'bg-[#2A1338] text-white border-transparent'
                        : 'text-[var(--text-secondary)] hover:bg-[#2B2730] hover:text-[var(--text-primary)] border-transparent'
                    }`}
                  >
                    {/* 3px gold left bar for active item */}
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#BC881B] rounded-l-[10px]" />
                    )}

                    <div className="relative flex items-center gap-3 min-w-0">
                      {/* Icon (20px, 1.75 stroke, with badge pill on top in rail mode) */}
                      <div className="relative flex items-center justify-center shrink-0">
                        <Icon 
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive 
                              ? 'text-[#E0B450]' 
                              : 'text-[var(--text-muted)] group-hover:text-white'
                          }`} 
                          strokeWidth={1.75} 
                        />
                        {/* Small number badge directly on the icon when in 72px rail mode */}
                        {isRail && item.badge !== undefined && (
                          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-[#BC881B] text-black flex items-center justify-center leading-none shadow-xs pointer-events-none">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {/* Label with ellipsis plus tooltip */}
                      {!isRail && (
                        <span 
                          className="truncate text-[14px] font-medium leading-none" 
                          title={item.title}
                        >
                          {item.title}
                        </span>
                      )}
                    </div>

                    {/* Right side shortcut and badge (pill 20px high, 12px bold text) */}
                    {!isRail && (
                      <div className="relative flex items-center gap-2 ml-auto shrink-0">
                        {item.shortcut && (
                          <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[11px] font-mono rounded border border-[var(--border)] text-[var(--text-muted)] bg-black/20">
                            {item.shortcut}
                          </kbd>
                        )}
                        {item.badge !== undefined && (
                          <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[12px] font-bold leading-none ${
                            isActive
                              ? 'bg-[#BC881B] text-black'
                              : 'bg-[#2B2730] text-[var(--text-body)] border border-[var(--border)]'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Pinned Bottom Items & Collapse Control (40px high, shrinks to 36px on short screens) */}
        <div className={`border-t border-[var(--border)] shrink-0 flex flex-col gap-1.5 ${
          isShortScreen ? 'p-2' : 'p-3'
        }`}>
          {bottomItems.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                title={item.title}
                className={`group relative flex items-center justify-between ${
                  isRail ? 'px-0 justify-center' : 'px-3 gap-3'
                } ${itemHeightClass} rounded-[10px] cursor-pointer transition-all duration-150 w-full border text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC881B] focus-visible:ring-offset-1 focus-visible:ring-offset-[#141214] ${
                  isActive
                    ? 'bg-[#2A1338] text-white border-transparent' 
                    : 'text-[var(--text-secondary)] hover:bg-[#2B2730] hover:text-[var(--text-primary)] border-transparent'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#BC881B] rounded-l-[10px]" />
                )}
                <div className="relative flex items-center gap-3">
                  <Icon 
                    className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#E0B450]' : 'text-[var(--text-muted)] group-hover:text-white'}`} 
                    strokeWidth={1.75}
                  />
                  {!isRail && (
                    <span className="truncate text-[14px] font-medium leading-none" title={item.title}>
                      {item.title}
                    </span>
                  )}
                </div>
                {!isRail && item.shortcut && (
                  <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[11px] font-mono rounded border border-[var(--border)] text-[var(--text-muted)] bg-black/20 ml-auto shrink-0">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}

          {/* Collapse/Expand Sidebar Toggle (40px high, shrinks to 36px on short screens) */}
          <button
            onClick={onToggleCollapse}
            title={isRail ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`group relative flex items-center ${
              isRail ? 'justify-center px-0' : 'justify-between px-3 gap-3'
            } ${itemHeightClass} rounded-[10px] transition-all duration-150 w-full border border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[#2B2730] text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC881B] focus-visible:ring-offset-1 focus-visible:ring-offset-[#141214]`}
          >
            {isRail ? (
              <PanelLeftOpen className="w-5 h-5 text-[var(--text-accent)]" strokeWidth={1.75} />
            ) : (
              <div className="flex items-center justify-between w-full text-[14px] font-medium">
                <span>Collapse Sidebar</span>
                <PanelLeftClose className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white" strokeWidth={1.75} />
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Global Quick Search Modal (Command+K) */}
      {isSearchOpen && (
        <div className="modal-backdrop">
          <div className="fixed inset-0" onClick={() => setIsSearchOpen(false)} />
          <div className="relative w-full max-w-xl rounded-[16px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-modal)] overflow-hidden z-50">
            <div className="flex items-center px-4 h-12 border-b border-[var(--border)]">
              <Search className="w-4 h-4 text-[var(--text-accent)] mr-3 shrink-0" strokeWidth={2} />
              <input 
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none! shadow-none! p-0! h-auto! outline-none text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                placeholder="Type to search catalog books, borrowers, or commands..."
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mr-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[12px]"
                >
                  Clear
                </button>
              )}
              <kbd 
                onClick={() => setIsSearchOpen(false)}
                className="inline-flex items-center justify-center h-5 px-1.5 text-[12px] font-mono rounded cursor-pointer border border-[var(--border)] text-[var(--text-muted)] bg-black/5 dark:bg-[#1E293B]"
              >
                ESC
              </kbd>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="ml-3 btn-icon text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions List in Search */}
            <div className="p-3 max-h-[60vh] overflow-y-auto flex flex-col gap-1">
              {(() => {
                const q = searchQuery.toLowerCase().trim();
                const allNav = navGroups.flatMap(g => g.items).filter(item => item.id !== 'search');
                const matchingNav = !q ? allNav : allNav.filter(item => item.title.toLowerCase().includes(q));
                const matchingBooks = !q ? [] : catalogBooks.filter(b => 
                  b.book_name.toLowerCase().includes(q) || 
                  b.barcode.toLowerCase().includes(q) ||
                  b.author.toLowerCase().includes(q) ||
                  b.category.toLowerCase().includes(q)
                ).slice(0, 6);

                return (
                  <>
                    <div className="text-[12px] uppercase font-semibold px-2 py-1 text-[var(--text-muted)]">
                      Quick Navigation
                    </div>
                    {matchingNav.map(item => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            onTabChange(item.id as NavigationTab);
                            setIsSearchOpen(false);
                          }}
                          className="flex items-center justify-between p-2 rounded-[8px] cursor-pointer transition-colors text-[14px] text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-[#1E293B]"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-[var(--text-accent)]" />
                            <span>{item.title}</span>
                          </div>
                          {item.shortcut && (
                            <kbd className="text-[12px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] bg-black/5 dark:bg-[#1E293B]">
                              {item.shortcut}
                            </kbd>
                          )}
                        </div>
                      );
                    })}

                    {matchingBooks.length > 0 && (
                      <div className="flex flex-col gap-1 pt-2 border-t border-[var(--border)]">
                        <div className="text-[12px] uppercase font-semibold text-[var(--text-accent)] px-2 py-0.5">
                          Catalog Books ({matchingBooks.length})
                        </div>
                        {matchingBooks.map(book => (
                          <div
                            key={book.id}
                            onClick={() => {
                              if (onSelectBook) {
                                onSelectBook(book);
                              } else {
                                onTabChange('catalog');
                              }
                              setIsSearchOpen(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-[8px] cursor-pointer transition-all border border-transparent hover:border-blue-500/30 text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-[#1E293B]"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-[14px] font-semibold truncate">
                                {book.book_name}
                              </div>
                              <div className="text-[12px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                                <span>{book.author}</span>
                                <span>•</span>
                                <span className="font-mono text-[12px] text-[var(--text-accent)] font-semibold">{book.barcode}</span>
                                <span>•</span>
                                <span className="text-[12px]">{book.category}</span>
                              </div>
                            </div>
                            <span className="shrink-0 text-[12px] font-mono px-2 py-0.5 rounded-[8px] border border-[var(--border)] bg-black/5 dark:bg-[#1E293B] text-[var(--text-primary)]">
                              {book.available_quantity}/{book.total_quantity} Avail
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {matchingNav.length === 0 && matchingBooks.length === 0 && (
                      <div className="py-8 text-center text-[var(--text-muted)] text-[14px]">
                        No matches found for <span className="text-[var(--text-accent)] font-mono">"{searchQuery}"</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="px-4 h-10 border-t border-[var(--border)] flex items-center justify-between text-[12px] text-[var(--text-muted)] bg-black/5 dark:bg-[#0B1220]">
              <div className="flex items-center gap-2">
                <Command className="w-3.5 h-3.5 text-[var(--text-accent)]" />
                <span>Tip: Press <strong>⌘1</strong> - <strong>⌘6</strong> for instant tab switches</span>
              </div>
              <span className="font-mono text-[12px]">ULM LMS</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
