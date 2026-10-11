import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Plus, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: (SelectOption | string | number)[];
  placeholder?: string;
  label?: string;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  disabled?: boolean;
  searchable?: boolean;
  allowAdd?: boolean;
  onAddNew?: (newValue: string) => void;
  addNewPlaceholder?: string;
  id?: string;
  name?: string;
  compact?: boolean;
  variant?: 'dark' | 'cream';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  label,
  className = '',
  triggerClassName = '',
  panelClassName = '',
  disabled = false,
  searchable,
  allowAdd = false,
  onAddNew,
  addNewPlaceholder = 'Add new...',
  id,
  name,
  compact = false,
  variant = 'dark',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [newInputValue, setNewInputValue] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 200,
    placement: 'bottom',
    maxHeight: 320,
  });

  const generatedId = useId();
  const selectId = id || generatedId;

  // Normalize options to SelectOption[]
  const normalizedOptions: SelectOption[] = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: opt, label: String(opt) };
      }
      return opt;
    });
  }, [options]);

  // Filtered options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  // Determine currently selected option
  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  const isSearchable = searchable ?? normalizedOptions.length > 7;

  // Calculate coordinates and flip orientation
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;

    const flipTop = spaceBelow < 220 && spaceAbove > spaceBelow;
    const availableSpace = flipTop ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(320, Math.max(140, availableSpace));

    const panelWidth = Math.max(rect.width, 210);
    let left = rect.left;
    if (left + panelWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - panelWidth - 12);
    }

    setCoords({
      top: flipTop ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      left: Math.max(8, left),
      width: panelWidth,
      placement: flipTop ? 'top' : 'bottom',
      maxHeight,
    });
  }, []);

  // Update coordinates on open, resize, or scroll
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
    };
  }, [isOpen, updateCoords]);

  // Close on outside click (accounts for portal)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
        setIsAddingNew(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen) {
      // Find index of current selected option in filtered list
      const idx = filteredOptions.findIndex((opt) => String(opt.value) === String(value));
      setActiveIndex(idx >= 0 ? idx : 0);

      if (isSearchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    } else {
      setSearchQuery('');
      setIsAddingNew(false);
    }
  }, [isOpen, value, filteredOptions, isSearchable]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => {
          let next = prev + 1;
          while (next < filteredOptions.length && filteredOptions[next].disabled) {
            next++;
          }
          return next < filteredOptions.length ? next : prev;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && filteredOptions[next].disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
        break;

      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setActiveIndex(filteredOptions.length - 1);
        break;

      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          const item = filteredOptions[activeIndex];
          if (!item.disabled) {
            onChange(item.value);
            setIsOpen(false);
            triggerRef.current?.focus();
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;

      default:
        break;
    }
  };

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newInputValue.trim();
    if (!trimmed) return;
    if (onAddNew) {
      onAddNew(trimmed);
    } else {
      onChange(trimmed);
    }
    setNewInputValue('');
    setIsAddingNew(false);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative select-none text-left ${className}`} onKeyDown={handleKeyDown}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-slate-300 mb-1 leading-normal"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        name={name}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-[10px] border text-left transition-colors cursor-pointer ${
          compact ? 'h-10 px-3 py-2 text-[13px]' : 'h-10 px-3.5 py-2 text-[13px]'
        } ${
          disabled
            ? 'bg-[#1A1A1A] border-white/[0.06] text-[#B3AABD] cursor-not-allowed pointer-events-none'
            : isOpen
            ? 'bg-[#141214] border-[#BC881B] ring-2 ring-[#BC881B]/25 text-white'
            : variant === 'dark'
            ? 'bg-[#141214] hover:bg-[#1E1B22] border-white/[0.08] hover:border-white/[0.2] text-[#E7E2EC] hover:text-white'
            : 'bg-[#0B1220] hover:bg-[#0F172A] border-[#334155] hover:border-slate-500 text-slate-200'
        } ${triggerClassName}`}
      >
        <span className="truncate block font-medium">
          {selectedOption ? (
            <span className="flex items-center gap-2">
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#BC881B]/20 text-[#E0B450] font-mono border border-[#BC881B]/30 shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </span>
          ) : (
            <span className="text-[#B3AABD]">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#B3AABD] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#E0B450]' : ''
          }`}
        />
      </button>

      {/* Styled Popup Panel rendered via Portal at document.body */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          id={`${selectId}-listbox`}
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`,
            zIndex: 1000, // Z-index token: dropdown 1000
            backgroundColor: variant === 'dark' ? '#1A1A1A' : 'var(--cream-100, #FBF3DF)',
            color: variant === 'dark' ? '#FFFFFF' : 'var(--on-cream, #1C1917)',
            borderColor: variant === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'var(--cream-300, #E6D3A3)',
          }}
          className={`rounded-[12px] border shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-100 ${panelClassName}`}
        >
          {/* Optional Search Input */}
          {isSearchable && (
            <div
              style={
                variant === 'dark'
                  ? {
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      backgroundColor: '#141214',
                    }
                  : {
                      borderColor: 'var(--cream-300, #E6D3A3)',
                      backgroundColor: 'var(--cream-100, #FBF3DF)',
                    }
              }
              className="p-2 border-b flex items-center gap-1.5"
            >
              <Search
                style={{ color: variant === 'dark' ? '#B3AABD' : 'var(--on-cream, #1C1917)' }}
                className="w-3.5 h-3.5 opacity-70 shrink-0"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search..."
                style={
                  variant === 'dark'
                    ? {
                        backgroundColor: '#1A1A1A',
                        color: '#FFFFFF',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                      }
                    : {
                        backgroundColor: 'var(--cream-200, #F2E6C4)',
                        color: 'var(--on-cream, #1C1917)',
                        borderColor: 'var(--cream-300, #E6D3A3)',
                      }
                }
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none placeholder:text-[#B3AABD] focus:ring-1 focus:ring-[#BC881B] focus:border-[#BC881B]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ color: variant === 'dark' ? '#B3AABD' : 'var(--on-cream, #1C1917)' }}
                  className="p-0.5 hover:opacity-100 opacity-60 text-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* List Options */}
          <ul
            ref={listboxRef}
            className="max-h-60 overflow-y-auto p-1.5 space-y-0.5"
            style={{
              scrollbarColor: variant === 'dark' ? 'rgba(255, 255, 255, 0.2) #1A1A1A' : 'var(--cream-300, #E6D3A3) var(--cream-100, #FBF3DF)',
            }}
          >
            {filteredOptions.length === 0 ? (
              <li
                style={{ color: variant === 'dark' ? '#B3AABD' : 'var(--on-cream, #1C1917)' }}
                className="px-3 py-3 text-xs text-center opacity-70 italic"
              >
                No matching options found
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isActive = idx === activeIndex;

                const itemBg = isSelected
                  ? '#BC881B'
                  : isActive
                  ? variant === 'dark'
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'var(--cream-200, #F2E6C4)'
                  : 'transparent';

                const itemColor = isSelected
                  ? '#1A1A1A'
                  : variant === 'dark'
                  ? '#FFFFFF'
                  : 'var(--on-cream, #1C1917)';

                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => !opt.disabled && setActiveIndex(idx)}
                    style={{
                      backgroundColor: itemBg,
                      color: itemColor,
                    }}
                    className={`relative flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] text-[13px] font-semibold cursor-pointer transition-colors ${
                      opt.disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex flex-col truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className={`text-[11px] truncate font-normal ${isSelected ? 'opacity-90' : 'opacity-65'}`}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          style={{
                            backgroundColor: isSelected
                              ? 'rgba(26, 26, 26, 0.2)'
                              : variant === 'dark'
                              ? 'rgba(188, 136, 27, 0.2)'
                              : 'var(--cream-300, #E6D3A3)',
                            color: isSelected ? '#1A1A1A' : variant === 'dark' ? '#E0B450' : '#1C1917',
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#1A1A1A] stroke-[3]" />
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Optional "Add New" footer */}
          {allowAdd && (
            <div
              style={
                variant === 'dark'
                  ? {
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      backgroundColor: '#141214',
                    }
                  : {
                      borderColor: 'var(--cream-300, #E6D3A3)',
                      backgroundColor: 'var(--cream-200, #F2E6C4)',
                    }
              }
              className="p-2 border-t"
            >
              {!isAddingNew ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(true);
                    setTimeout(() => addInputRef.current?.focus(), 50);
                  }}
                  style={{ color: variant === 'dark' ? '#E0B450' : 'var(--on-cream, #1C1917)' }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.05] text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add custom entry...</span>
                </button>
              ) : (
                <form onSubmit={handleCreateNew} className="flex items-center gap-1.5">
                  <input
                    ref={addInputRef}
                    type="text"
                    value={newInputValue}
                    onChange={(e) => setNewInputValue(e.target.value)}
                    placeholder={addNewPlaceholder}
                    style={
                      variant === 'dark'
                        ? {
                            backgroundColor: '#1A1A1A',
                            color: '#FFFFFF',
                            borderColor: 'rgba(255, 255, 255, 0.12)',
                          }
                        : {
                            backgroundColor: 'var(--cream-100, #FBF3DF)',
                            color: 'var(--on-cream, #1C1917)',
                            borderColor: 'var(--cream-300, #E6D3A3)',
                          }
                    }
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border outline-none placeholder:text-[#B3AABD] focus:ring-1 focus:ring-[#BC881B]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#BC881B] to-[#D4A02A] text-[#1A1A1A] font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewInputValue('');
                    }}
                    className="p-1 text-[#B3AABD] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSelect;
