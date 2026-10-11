import React from 'react';

/**
 * 2D Decorative Component: Success Toast Checkmark with Expanding Ring
 * - SVG check mark draws itself in 300 ms
 * - One expanding ring in 300 ms
 * - Strict compliance: aria-hidden="true", pointer-events: none, class "deco"
 * - ULM palette tokens only: success (#34D399) / gold (#BC881B)
 */
export const ToastSuccessDeco: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="deco pointer-events-none relative flex items-center justify-center w-5 h-5 shrink-0 select-none"
    >
      {/* Expanding Ring */}
      <span
        className="deco absolute inset-0 rounded-full border border-[var(--success)] pointer-events-none"
        style={{
          animation: 'ringExpand 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* Self-drawing SVG Check Mark */}
      <svg
        className="deco w-4 h-4 pointer-events-none"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="8" fill="rgba(52, 211, 153, 0.15)" />
        <path
          d="M 6 10.5 L 8.5 13 L 14 7.5"
          stroke="var(--success)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 20,
            strokeDashoffset: 20,
            animation: 'checkDraw 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        />
      </svg>
    </div>
  );
};
