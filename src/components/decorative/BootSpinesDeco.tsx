import React from 'react';

/**
 * 2D Decorative Component: Boot Splash Book Spines
 * - Row of 7 book spines in purple, gold, blue, and near-black tones
 * - Slide up and settle one by one (90 ms stagger, 500 ms each)
 * - Strict compliance: aria-hidden="true", pointer-events: none, class "deco"
 * - ULM palette tokens only
 */
export const BootSpinesDeco: React.FC = () => {
  const spines = [
    { id: 1, height: 50, color: 'var(--purple)', accent: 'var(--gold-text)', label: 'I' },
    { id: 2, height: 62, color: 'var(--gold)', accent: 'var(--text-on-gold)', label: 'II' },
    { id: 3, height: 44, color: 'var(--surface-1)', accent: 'var(--border-field)', label: 'III' },
    { id: 4, height: 58, color: 'var(--blue)', accent: 'var(--strong)', label: 'IV' },
    { id: 5, height: 52, color: 'var(--purple-hover)', accent: 'var(--gold)', label: 'V' },
    { id: 6, height: 60, color: 'var(--surface-2)', accent: 'var(--gold-text)', label: 'VI' },
    { id: 7, height: 48, color: 'var(--blue-hover)', accent: 'var(--strong)', label: 'VII' },
  ];

  return (
    <div
      aria-hidden="true"
      className="deco pointer-events-none flex items-end justify-center gap-1.5 h-16 my-2 select-none"
    >
      {spines.map((spine, index) => (
        <div
          key={spine.id}
          className="deco w-4 rounded-t-[3px] border border-black/30 relative flex flex-col items-center justify-between py-1 shadow-sm"
          style={{
            height: `${spine.height}px`,
            backgroundColor: spine.color,
            animation: `spineSlideUp 500ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 90}ms both`,
          }}
        >
          {/* Top spine gold/accent rib */}
          <div 
            className="deco w-full h-[1.5px] opacity-75"
            style={{ backgroundColor: spine.accent }}
          />
          {/* Micro roman numeral spine stamp */}
          <span 
            className="deco font-mono text-[7px] font-bold leading-none select-none tracking-tighter"
            style={{ color: spine.accent }}
          >
            {spine.label}
          </span>
          {/* Bottom spine rib */}
          <div 
            className="deco w-full h-[1.5px] opacity-75"
            style={{ backgroundColor: spine.accent }}
          />
        </div>
      ))}
    </div>
  );
};
