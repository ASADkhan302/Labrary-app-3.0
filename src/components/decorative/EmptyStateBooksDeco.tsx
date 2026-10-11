import React from 'react';

/**
 * 2D Decorative Component: Empty State Books Stack
 * - Stack of 3 books bobbing 4 px up and down (3 s loop)
 * - Strict compliance: aria-hidden="true", pointer-events: none, class "deco"
 * - ULM palette tokens only: gold, purple, blue
 */
export const EmptyStateBooksDeco: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`deco pointer-events-none inline-flex items-center justify-center select-none ${className}`}
      style={{
        animation: 'bookStackBob 3s ease-in-out infinite',
      }}
    >
      <svg
        className="deco w-12 h-12"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Bottom Book: Royal Purple */}
        <g>
          {/* Base shadow */}
          <ellipse cx="24" cy="42" rx="18" ry="2.5" fill="rgba(0, 0, 0, 0.45)" />
          {/* Book block */}
          <rect x="8" y="32" width="32" height="7" rx="2" fill="var(--purple)" stroke="var(--purple-hover)" strokeWidth="0.75" />
          {/* Paper pages edge */}
          <rect x="36" y="33.5" width="3" height="4" rx="0.5" fill="var(--cream-200)" />
          {/* Gold bookmark ribbon */}
          <path d="M 14 32 L 14 39 L 16 37 L 18 39 L 18 32 Z" fill="var(--gold)" />
        </g>

        {/* Middle Book: Slate Blue */}
        <g>
          <rect x="11" y="24" width="27" height="6.5" rx="2" fill="var(--blue)" stroke="var(--blue-hover)" strokeWidth="0.75" />
          <rect x="34" y="25.5" width="3" height="3.5" rx="0.5" fill="var(--cream-200)" />
          {/* Spine gold accent line */}
          <line x1="15" y1="24.5" x2="15" y2="30" stroke="var(--gold-text)" strokeWidth="0.75" />
        </g>

        {/* Top Book: Old Gold */}
        <g>
          <rect x="14" y="16" width="22" height="6" rx="1.5" fill="var(--gold)" stroke="var(--gold-hover)" strokeWidth="0.75" />
          <rect x="32" y="17.5" width="3" height="3" rx="0.5" fill="var(--cream-100)" />
          {/* Embossed title rule */}
          <line x1="18" y1="19" x2="28" y2="19" stroke="var(--text-on-gold)" strokeWidth="0.8" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
};
