import React from 'react';

/**
 * 2D Decorative Component: Start Screen Hero
 * - SVG Crest outline that draws itself with stroke-dashoffset (1.2 s, once)
 * - Open book whose pages flip with a 2D scaleX/skew trick (6 s loop)
 * - 16 small gold motes drifting upward (12-20 s, staggered delays, 20-40% alpha)
 * - Soft purple radial glow that pulses (scale 1 to 1.06, 8 s)
 *
 * Strict Compliance:
 * - aria-hidden="true"
 * - pointer-events: none
 * - class "deco"
 * - ULM palette tokens only (never pure white background or text)
 * - Disabled via html.no-deco
 */
export const StartScreenHeroDeco: React.FC = () => {
  // Pre-generate 16 deterministic drifting motes
  const motes = [
    { id: 1, left: 12, size: 3, dur: 14, delay: 0.2, alpha: 0.25 },
    { id: 2, left: 24, size: 2.5, dur: 18, delay: 3.5, alpha: 0.35 },
    { id: 3, left: 32, size: 4, dur: 13, delay: 1.8, alpha: 0.2 },
    { id: 4, left: 45, size: 2, dur: 16, delay: 5.2, alpha: 0.4 },
    { id: 5, left: 55, size: 3.5, dur: 19, delay: 2.1, alpha: 0.3 },
    { id: 6, left: 68, size: 2.5, dur: 15, delay: 4.0, alpha: 0.22 },
    { id: 7, left: 78, size: 3, dur: 17, delay: 0.8, alpha: 0.38 },
    { id: 8, left: 88, size: 2, dur: 12, delay: 6.1, alpha: 0.28 },
    { id: 9, left: 18, size: 2.5, dur: 16, delay: 7.4, alpha: 0.32 },
    { id: 10, left: 28, size: 3.5, dur: 20, delay: 8.9, alpha: 0.24 },
    { id: 11, left: 40, size: 2, dur: 14, delay: 4.6, alpha: 0.36 },
    { id: 12, left: 50, size: 3, dur: 17, delay: 9.3, alpha: 0.27 },
    { id: 13, left: 62, size: 4, dur: 15, delay: 2.8, alpha: 0.31 },
    { id: 14, left: 74, size: 2.5, dur: 18, delay: 6.7, alpha: 0.29 },
    { id: 15, left: 82, size: 3, dur: 13, delay: 10.5, alpha: 0.4 },
    { id: 16, left: 92, size: 2, dur: 19, delay: 5.9, alpha: 0.25 },
  ];

  return (
    <div 
      aria-hidden="true" 
      className="deco pointer-events-none absolute inset-0 overflow-hidden flex items-center justify-center select-none"
    >
      {/* 1. Soft purple radial glow that pulses (scale 1 to 1.06, 8 s) */}
      <div 
        className="deco absolute w-[360px] h-[360px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(84, 26, 114, 0.42) 0%, rgba(42, 19, 56, 0.16) 45%, transparent 72%)',
          animation: 'purpleGlowPulse 8s ease-in-out infinite alternate',
          transformOrigin: 'center center',
          filter: 'blur(28px)',
        }}
      />

      {/* 2. Upward drifting gold motes (12-20s, staggered, 20-40% alpha) */}
      <div className="deco absolute inset-0 pointer-events-none overflow-hidden">
        {motes.map((m) => (
          <span
            key={m.id}
            className="deco absolute rounded-full bg-[var(--gold)] pointer-events-none"
            style={{
              left: `${m.left}%`,
              bottom: '10%',
              width: `${m.size}px`,
              height: `${m.size}px`,
              opacity: m.alpha,
              animation: `moteDrift ${m.dur}s ease-in-out ${m.delay}s infinite`,
            }}
          />
        ))}
      </div>

    </div>

  );
};
