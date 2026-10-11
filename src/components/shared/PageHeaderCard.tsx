import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface PageHeaderCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  badgeContent?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeaderCard: React.FC<PageHeaderCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  badgeContent,
  actions,
  className = '',
}) => {
  return (
    <div 
      className={`relative overflow-hidden rounded-[14px] bg-gradient-to-b from-[#221F26] to-[#1A1A1A] border border-[#2E2A33] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
    >
      {/* 2px Gold Hairline on top edge */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#BC881B]" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Title & Icon Block */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-[10px] bg-[#BC881B]/15 border border-[#BC881B]/30 flex items-center justify-center text-[#E0B450] shrink-0 shadow-2xs">
            <Icon className="w-5 h-5 stroke-[2]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 
                className="font-cinzel text-white font-bold tracking-tight text-[clamp(22px,2vw,28px)] leading-tight"
                dir="auto"
              >
                {title}
              </h1>
              {badgeContent}
            </div>
            <p className="text-[13px] text-[#B3AABD] mt-1 leading-normal font-sans" dir="auto">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Header Actions Toolbar (Wrapped on narrow screens, min-height 40px, never truncated) */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 ml-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
