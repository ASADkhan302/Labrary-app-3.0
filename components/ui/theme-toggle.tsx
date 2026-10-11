"use client"

import { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

export type ThemeToggleVariant = 'default' | 'amber' | 'emerald' | 'colorful'

export interface ThemeToggleProps {
  className?: string
  isDark?: boolean
  onToggle?: (isDark: boolean) => void
  variant?: ThemeToggleVariant
}

export function ThemeToggle({ 
  className, 
  isDark: propIsDark, 
  onToggle,
  variant = 'default' 
}: ThemeToggleProps) {
  // Internal state for standalone usage
  const [internalIsDark, setInternalIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             localStorage.getItem('ulm_lms_theme') !== 'light';
    }
    return true;
  });

  const isDark = propIsDark !== undefined ? propIsDark : internalIsDark;

  // Sync with document.documentElement mutations if running uncontrolled in app
  useEffect(() => {
    if (propIsDark !== undefined) return;
    const observer = new MutationObserver(() => {
      const currentDark = document.documentElement.classList.contains('dark');
      setInternalIsDark(currentDark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [propIsDark]);

  const handleClick = () => {
    const nextDark = !isDark;
    if (propIsDark === undefined) {
      setInternalIsDark(nextDark);
      if (nextDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.body.classList.add('dark');
        document.body.classList.remove('light');
        localStorage.setItem('ulm_lms_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.body.classList.remove('dark');
        document.body.classList.add('light');
        localStorage.setItem('ulm_lms_theme', 'light');
      }
    }
    onToggle?.(nextDark);
  };

  // Variant color palettes (matching other buttons in the app)
  const getContainerStyles = () => {
    switch (variant) {
      case 'amber':
        // Matches the "+ Add Book" button palette (amber-gold glow)
        return isDark
          ? "bg-[#0F172A] border border-[#F59E0B]/50 hover:border-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.2)]"
          : "bg-amber-50/90 border border-amber-300 hover:border-amber-400 shadow-sm";
      case 'emerald':
        // Matches the "Export Excel" button palette (emerald/teal glow)
        return isDark
          ? "bg-[#0F172A] border border-[#334155] hover:border-[#34D399]/70 shadow-[0_0_12px_rgba(52,211,153,0.2)]"
          : "bg-emerald-50/90 border border-emerald-300 hover:border-emerald-400 shadow-sm";
      case 'colorful':
        // Matches ButtonColorful (indigo/purple/pink gradient glow)
        return isDark
          ? "bg-zinc-950 border border-purple-500/50 hover:border-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.3)]"
          : "bg-white border border-purple-300 hover:border-purple-400 shadow-sm";
      case 'default':
      default:
        return isDark
          ? "bg-zinc-950 border border-zinc-800"
          : "bg-white border border-zinc-200";
    }
  };

  const getThumbStyles = () => {
    switch (variant) {
      case 'amber':
        return isDark
          ? "transform translate-x-0 bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm text-slate-950"
          : "transform translate-x-8 bg-amber-500 text-white shadow-sm";
      case 'emerald':
        return isDark
          ? "transform translate-x-0 bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm text-slate-950"
          : "transform translate-x-8 bg-emerald-600 text-white shadow-sm";
      case 'colorful':
        return isDark
          ? "transform translate-x-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-sm text-white"
          : "transform translate-x-8 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-sm text-white";
      case 'default':
      default:
        return isDark
          ? "transform translate-x-0 bg-zinc-800"
          : "transform translate-x-8 bg-gray-200";
    }
  };

  const getActiveIcon = () => {
    if (isDark) {
      return (
        <Moon 
          className={cn(
            "w-4 h-4 transition-colors", 
            variant === 'amber' ? "text-slate-950" : variant === 'emerald' ? "text-slate-950" : "text-white"
          )} 
          strokeWidth={1.75}
        />
      );
    }
    return (
      <Sun 
        className={cn(
          "w-4 h-4 transition-colors",
          variant === 'amber' ? "text-white" : variant === 'emerald' ? "text-white" : variant === 'colorful' ? "text-white" : "text-gray-700"
        )} 
        strokeWidth={1.75}
      />
    );
  };

  const getInactiveIcon = () => {
    if (isDark) {
      return (
        <Sun 
          className={cn(
            "w-4 h-4 transition-colors",
            variant === 'amber' ? "text-amber-500/70" : variant === 'emerald' ? "text-emerald-400/60" : "text-gray-500"
          )} 
          strokeWidth={1.5}
        />
      );
    }
    return (
      <Moon 
        className={cn(
          "w-4 h-4 transition-colors",
          variant === 'amber' ? "text-amber-700" : variant === 'emerald' ? "text-emerald-700" : "text-black"
        )} 
        strokeWidth={1.5}
      />
    );
  };

  return (
    <div
      className={cn(
        "flex w-16 h-8 p-1 rounded-full cursor-pointer transition-all duration-300 relative select-none",
        getContainerStyles(),
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex justify-between items-center w-full">
        {/* Animated Moving Thumb */}
        <div
          className={cn(
            "flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300 shrink-0",
            getThumbStyles()
          )}
        >
          {getActiveIcon()}
        </div>

        {/* Stationary Inactive Icon Slot */}
        <div
          className={cn(
            "flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300 shrink-0",
            isDark 
              ? "bg-transparent" 
              : "transform -translate-x-8"
          )}
        >
          {getInactiveIcon()}
        </div>
      </div>
    </div>
  )
}
export default ThemeToggle
