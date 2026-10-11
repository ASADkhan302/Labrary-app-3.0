import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { CountUp } from '../ui/count-up';

/**
 * 1. ITEM CARD (Loans, Members)
 * surface-1 (#1A1A1A), radius 14, 1px border-subtle (#2E2A33), padding 16.
 * Hover: border purple-light at 45% (#A66BC9), lift 2px (180ms, transform & shadow only).
 */
export interface ItemCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  children,
  className = '',
  onClick,
  style,
}) => {
  return (
    <div
      onClick={onClick}
      style={style}
      className={`relative rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-4 flex flex-col justify-between transition-all duration-[180ms] ease-out hover:border-[#A66BC9]/45 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)] overflow-hidden ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * 2. PANEL CARD (Reports, Migration)
 * surface-1 (#1A1A1A), radius 14, 1px border-subtle (#2E2A33), padding 20.
 * Top decorative hairline, optional hover lift if clickable.
 */
export interface PanelCardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  hairlineColor?: string; // e.g. '#BC881B' or '#A66BC9'
  className?: string;
  onClick?: () => void;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  hairlineColor,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-[14px] bg-[#1A1A1A] border border-[#2E2A33] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden flex flex-col ${
        onClick
          ? 'cursor-pointer transition-all duration-[180ms] ease-out hover:border-[#A66BC9]/45 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)]'
          : ''
      } ${className}`}
    >
      {hairlineColor && (
        <div 
          className="absolute top-0 left-0 right-0 h-[2px]" 
          style={{ backgroundColor: hairlineColor }} 
        />
      )}

      {(title || headerAction) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[#2E2A33]">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-[15px] font-bold text-white tracking-tight leading-snug">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-[12px] text-[#B3AABD] mt-0.5 font-sans">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && (
            <div className="flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

/**
 * 3. KPI CARD (Reports Overview)
 * label, value, short sub-label, optional slim bar, optional real trend badge.
 */
export interface KpiCardProps {
  label: string;
  value: number;
  subLabel?: React.ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  accentBarColor?: string;
  accentColor?: string; // Hex color for top right soft glow
  note?: string; // Short note on same baseline as big number (e.g., "Distinct records", "Physical items")
  fractionTooltip?: string; // Tooltip for fraction bar
  percentBar?: {
    value: number;
    max: number;
    color?: string;
  };
  trend?: {
    percentage: number;
    direction: 'up' | 'down';
    label: string;
  };
  isDanger?: boolean;
  isGoldNumber?: boolean; // Gold when active loans > 0
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subLabel,
  icon: Icon,
  iconColor = '#E0B450',
  accentBarColor,
  accentColor = '#BC881B',
  note,
  fractionTooltip,
  percentBar,
  trend,
  isDanger = false,
  isGoldNumber = false,
  className = '',
}) => {
  const fractionText = fractionTooltip || (percentBar ? `${percentBar.value.toLocaleString()} / ${percentBar.max.toLocaleString()}` : '');

  return (
    <div
      className={`relative rounded-[14px] bg-[var(--surface-1)] border border-[var(--border-subtle)] p-[18px_20px] flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.35)] overflow-hidden transition-all duration-200 hover:border-[#6F6879] group ${
        isDanger ? 'border-rose-500/40 bg-rose-950/10' : ''
      } ${className}`}
      style={{
        // Soft glow in the card's accent color at the top right (radial gradient, 8-10% alpha)
        backgroundImage: `radial-gradient(circle at top right, ${isDanger ? 'rgba(251, 113, 133, 0.10)' : accentColor ? `${accentColor}18` : 'rgba(188, 136, 27, 0.10)'} 0%, transparent 65%)`,
      }}
    >
      {accentBarColor && (
        <div 
          className="absolute top-0 left-0 right-0 h-[2px]" 
          style={{ backgroundColor: accentBarColor }} 
        />
      )}

      {/* Row 1: Label on the left (12px uppercase, .06em tracking, muted-light); on right an icon (18px) in 32px rounded square */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-[#B3AABD] uppercase tracking-[0.06em] truncate">
          {label}
        </span>
        {Icon && (
          <div 
            className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: isDanger ? 'rgba(251, 113, 133, 0.15)' : accentColor ? `${accentColor}18` : 'rgba(188, 136, 27, 0.15)',
              borderColor: isDanger ? 'rgba(251, 113, 133, 0.35)' : accentColor ? `${accentColor}40` : 'rgba(188, 136, 27, 0.35)',
              color: isDanger ? '#FB7185' : iconColor,
            }}
          >
            <Icon className="w-[18px] h-[18px] stroke-[2]" />
          </div>
        )}
      </div>

      {/* Row 2: BIG NUMBER in display serif, followed on the SAME baseline by a short note (12-13px, 10px space) */}
      <div className="mt-2 mb-3 flex items-baseline gap-[10px] flex-wrap">
        <div 
          className={`font-semibold tracking-tight tabular-nums leading-[1.05] ${
            isDanger ? 'text-rose-400' : isGoldNumber ? 'text-[#E0B450]' : 'text-white'
          }`}
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontVariantNumeric: 'lining-nums tabular-nums',
            fontSize: 'clamp(34px, 2.8vw, 46px)',
          }}
        >
          {value.toLocaleString()}
        </div>

        {note && (
          <span className="text-[12px] sm:text-[13px] text-[#B3AABD] font-normal leading-normal select-none">
            {note}
          </span>
        )}

        {trend && (
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ml-auto ${
              trend.direction === 'up'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{trend.direction === 'up' ? '+' : '-'}{Math.abs(trend.percentage)}%</span>
          </div>
        )}
      </div>

      {/* Row 3: 4px rounded bar (surface-3 track, gradient fill in accent color) with tooltip stating the fraction */}
      {percentBar && (
        <div className="space-y-1" title={fractionText}>
          <div className="w-full bg-[var(--surface-3)] h-1 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, percentBar.max > 0 ? (percentBar.value / percentBar.max) * 100 : 0))}%`,
                background: isDanger
                  ? 'linear-gradient(90deg, #F43F5E, #FB7185)'
                  : percentBar.color
                  ? percentBar.color
                  : `linear-gradient(90deg, ${accentColor || '#BC881B'}, #E0B450)`,
              }}
            />
          </div>
          {fractionText && (
            <div className="flex justify-between items-center text-[11px] text-[var(--text-muted)] pt-0.5 font-mono">
              <span className="truncate">{fractionText}</span>
              <span>{Math.round(percentBar.max > 0 ? (percentBar.value / percentBar.max) * 100 : 0)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Subtitle / Sub-label fallback */}
      {!percentBar && subLabel && (
        <div className="text-[12px] text-[#B3AABD] leading-snug font-sans pt-1">
          {subLabel}
        </div>
      )}
    </div>
  );
};
