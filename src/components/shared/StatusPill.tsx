import React from 'react';

export type PillVariant = 
  | 'gold' 
  | 'purple' 
  | 'blue' 
  | 'green' 
  | 'danger' 
  | 'amber' 
  | 'muted';

export interface StatusPillProps {
  label: string;
  variant?: PillVariant;
  dot?: boolean;
  dotColor?: string;
  className?: string;
}

const VARIANT_STYLES: Record<PillVariant, { bg: string; text: string; border: string; dot: string }> = {
  gold: {
    bg: 'bg-[rgba(188,136,27,0.14)]',
    text: 'text-[#E0B450]',
    border: 'border-[#BC881B]/40',
    dot: 'bg-[#E0B450]',
  },
  purple: {
    bg: 'bg-[rgba(166,107,201,0.14)]',
    text: 'text-[#C084FC]',
    border: 'border-[#A66BC9]/40',
    dot: 'bg-[#C084FC]',
  },
  blue: {
    bg: 'bg-[rgba(111,168,210,0.12)]',
    text: 'text-[#6FA8D2]',
    border: 'border-[#29658E]/50',
    dot: 'bg-[#6FA8D2]',
  },
  green: {
    bg: 'bg-[rgba(52,211,153,0.12)]',
    text: 'text-[#34D399]',
    border: 'border-[#34D399]/40',
    dot: 'bg-[#34D399]',
  },
  danger: {
    bg: 'bg-[rgba(251,113,133,0.12)]',
    text: 'text-[#FB7185]',
    border: 'border-[#FB7185]/40',
    dot: 'bg-[#FB7185]',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/35',
    dot: 'bg-amber-400',
  },
  muted: {
    bg: 'bg-[rgba(179,170,189,0.10)]',
    text: 'text-[#B3AABD]',
    border: 'border-white/[0.12]',
    dot: 'bg-[#B3AABD]',
  },
};

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  variant = 'muted',
  dot = false,
  dotColor,
  className = '',
}) => {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.muted;

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.06em] font-semibold font-mono border inline-flex items-center gap-1.5 shrink-0 select-none ${styles.bg} ${styles.text} ${styles.border} ${className}`}
    >
      {dot && (
        <span 
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor || styles.dot}`} 
        />
      )}
      <span>{label}</span>
    </span>
  );
};
