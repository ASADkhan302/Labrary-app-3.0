import React from 'react';

/**
 * 2D Decorative Component: Book Spines Loading Indicator
 * - Three small book-spine bars scaling up and down in sequence
 * - 900 ms loop: gold, purple, blue
 * - Strict compliance: aria-hidden="true", pointer-events: none, class "deco"
 * - ULM palette tokens only
 */
export const BookSpinesLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`deco pointer-events-none inline-flex items-end justify-center gap-1 h-4 w-5 select-none ${className}`}
    >
      {/* Spine 1: Old Gold */}
      <span
        className="deco w-1 h-3.5 rounded-t-[1px] bg-[var(--gold)] origin-bottom"
        style={{
          animation: 'bookSpineScale 900ms ease-in-out 0ms infinite',
        }}
      />
      {/* Spine 2: Royal Purple */}
      <span
        className="deco w-1 h-4 rounded-t-[1px] bg-[var(--purple)] origin-bottom"
        style={{
          animation: 'bookSpineScale 900ms ease-in-out 150ms infinite',
        }}
      />
      {/* Spine 3: Slate Blue */}
      <span
        className="deco w-1 h-3 rounded-t-[1px] bg-[var(--blue)] origin-bottom"
        style={{
          animation: 'bookSpineScale 900ms ease-in-out 300ms infinite',
        }}
      />
    </div>
  );
};
