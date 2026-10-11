import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface CirculationKpiCardProps {
  id: string;
  label: string;
  count: number;
  note: string;
  icon: LucideIcon;
  accentColor: string; // e.g. '#A66BC9', '#34D399', '#FB7185', '#6FA8D2'
  isSelected: boolean;
  onClick: () => void;
  barTooltip: string;
  barFraction: number; // 0 to 1
  isStackedBar?: boolean;
  stackedSegments?: {
    fraction: number;
    color: string;
    label: string;
  }[];
  isDangerNumber?: boolean;
  staggerIndex?: number;
}

export const CirculationKpiCard: React.FC<CirculationKpiCardProps> = ({
  id,
  label,
  count,
  note,
  icon: Icon,
  accentColor,
  isSelected,
  onClick,
  barTooltip,
  barFraction,
  isStackedBar = false,
  stackedSegments = [],
  isDangerNumber = false,
  staggerIndex = 0,
}) => {
  const isZero = count === 0;

  // Key navigation handler (Enter & Space)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      type="button"
      id={`circulation-filter-${id.toLowerCase()}`}
      role="tab"
      aria-selected={isSelected}
      aria-pressed={isSelected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{
        animationDelay: `${staggerIndex * 40}ms`,
        backgroundImage: isSelected
          ? `radial-gradient(circle at top right, ${accentColor}24 0%, transparent 70%)`
          : `radial-gradient(circle at top right, ${accentColor}14 0%, transparent 65%)`,
      }}
      className={`group relative w-full text-left rounded-[14px] p-[16px_18px] transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden outline-none select-none
        circulation-filter-card-mount
        focus-visible:ring-2 focus-visible:ring-[#E0B450] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214]
        hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)]
        ${
          isSelected
            ? 'bg-[#2A1338] border border-[#E0B450] shadow-[0_6px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(224,180,80,0.15)]'
            : 'bg-[#1A1A1A] border border-[#2E2A33] hover:border-[#A66BC9]/45 hover:bg-[#1A1A1A]/90'
        }
      `}
    >
      {/* Selected Indicator Top Accent Hairline */}
      {isSelected && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ backgroundColor: accentColor }}
        />
      )}

      {/* Row 1: Label on left, 28px rounded icon with accent tint on right */}
      <div className="flex items-center justify-between gap-2.5 w-full">
        <span
          className={`text-[12px] font-semibold uppercase tracking-[0.06em] truncate leading-none ${
            isSelected ? 'text-[#E7E2EC]' : 'text-[#B3AABD]'
          }`}
        >
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 border transition-transform duration-150 group-hover:scale-105"
          style={{
            backgroundColor: isDangerNumber ? 'rgba(251, 113, 133, 0.15)' : `${accentColor}18`,
            borderColor: isDangerNumber ? 'rgba(251, 113, 133, 0.45)' : `${accentColor}40`,
            color: isDangerNumber ? '#FB7185' : accentColor,
          }}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4 stroke-[2]" />
        </div>
      </div>

      {/* Row 2: BIG NUMBER in Display Serif + Short note on same baseline */}
      <div className="mt-2.5 mb-3 flex items-baseline gap-2.5 flex-wrap min-w-0">
        <span
          className={`font-semibold tracking-tight tabular-nums leading-none ${
            isDangerNumber ? 'text-[#FB7185]' : 'text-white'
          }`}
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontVariantNumeric: 'lining-nums tabular-nums',
            fontSize: 'clamp(26px, 2.2vw, 32px)',
          }}
        >
          {count.toLocaleString()}
        </span>

        <span
          className={`text-[12px] sm:text-[13px] font-normal leading-normal truncate ${
            isZero ? 'text-[#B3AABD]' : 'text-[#E7E2EC]'
          }`}
        >
          {note}
        </span>
      </div>

      {/* Row 3: 4px Rounded Track Bar with Tooltip */}
      <div
        className="w-full mt-auto pt-1 cursor-help"
        title={barTooltip}
        aria-label={barTooltip}
      >
        <div className="w-full bg-[#2B2730] h-1 rounded-full overflow-hidden relative flex">
          {isStackedBar ? (
            // Stacked Bar Composition (All Loans)
            stackedSegments.map((seg, idx) => (
              <div
                key={idx}
                className="h-full first:rounded-l-full last:rounded-r-full circulation-bar-anim"
                style={{
                  width: `${Math.min(100, Math.max(0, seg.fraction * 100))}%`,
                  backgroundColor: seg.color,
                }}
              />
            ))
          ) : (
            // Single Accent Gradient Bar
            <div
              className="h-full rounded-full circulation-bar-anim"
              style={{
                width: `${Math.min(100, Math.max(0, barFraction * 100))}%`,
                background: isDangerNumber
                  ? 'linear-gradient(90deg, #F43F5E, #FB7185)'
                  : `linear-gradient(90deg, ${accentColor}CC, ${accentColor})`,
              }}
            />
          )}
        </div>
      </div>
    </button>
  );
};
