import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Check, 
  ArrowRight,
  GraduationCap
} from 'lucide-react';
import { playClickSound } from '../services/audio';
import { StartScreenHeroDeco } from './decorative/StartScreenHeroDeco';
import { BootSpinesDeco } from './decorative/BootSpinesDeco';
import { ULM_CREST_SRC } from '../assets/brand/crestData';

interface AppOpeningSplashProps {
  onComplete: () => void;
}

interface StepItem {
  id: string;
  label: string;
  triggerPct: number;
}

const SQLITE_STEPS: StepItem[] = [
  { id: 'opening', label: 'Opening database', triggerPct: 20 },
  { id: 'wal', label: 'WAL mode enabled', triggerPct: 45 },
  { id: 'catalog', label: 'Loading catalog', triggerPct: 75 },
  { id: 'ready', label: 'Ready', triggerPct: 95 }
];

export const AppOpeningSplash: React.FC<AppOpeningSplashProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const hasFinishedRef = useRef(false);

  const handleFinish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setIsExiting(true);
    // Exit: splash fades and scales up slightly (400ms)
    setTimeout(() => {
      onComplete();
    }, 400);
  };

  useEffect(() => {
    // Any click or Enter key skips the splash
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    try {
      playClickSound();
    } catch {
      // Audio autoplay policy fallback
    }

    const duration = 2800; // ~3s total sequence
    const startTime = Date.now();

    const interval = setInterval(() => {
      if (hasFinishedRef.current) {
        clearInterval(interval);
        return;
      }

      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(rawProgress);

      // Check SQLite mounting steps
      SQLITE_STEPS.forEach(step => {
        if (rawProgress >= step.triggerPct) {
          setCompletedSteps(prev => prev.includes(step.id) ? prev : [...prev, step.id]);
        }
      });

      if (rawProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          handleFinish();
        }, 150);
      }
    }, 24);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      onClick={handleFinish}
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#020617] text-[#F1F5F9] select-none overflow-hidden cursor-pointer transition-all duration-[400ms] ease-out ${
        isExiting 
          ? 'opacity-0 scale-[1.04] pointer-events-none' 
          : 'opacity-100 scale-100'
      }`}
    >
      <style>{`
        @keyframes crestEntrance {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes crestPulse {
          0% {
            box-shadow: 0 0 0 rgba(96, 165, 250, 0);
          }
          100% {
            box-shadow: 0 0 24px rgba(96, 165, 250, 0.35);
          }
        }
        @keyframes fadeUp12px {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .splash-step-1 {
          animation: fadeUp12px 400ms cubic-bezier(0.16, 1, 0.3, 1) 0ms both;
        }
        .splash-step-2 {
          animation: fadeUp12px 400ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
        }
        .splash-step-3 {
          animation: fadeUp12px 400ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both;
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-step-1, .splash-step-2, .splash-step-3 {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Skip Hint (Top Right) */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleFinish();
          }}
          className="btn-secondary h-8 px-3 text-[12px] flex items-center gap-2 cursor-pointer border border-slate-700 bg-slate-900/80 text-[#CBD5E1] hover:text-[#F1F5F9]"
        >
          <span>Skip [Enter]</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Centerpiece Stage Container */}
      <div 
        className="relative z-10 max-w-md w-full px-6 flex flex-col items-center text-center space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Crest container with 2D Hero decorations placed below content */}
        <div className="relative flex items-center justify-center">
          {/* Start Screen Hero 2D Decorations (Crest draw, flipping page, motes, purple pulse) */}
          <StartScreenHeroDeco />

          {/* a) University crest with refined institutional gold styling & soft glow pulse */}
          <div 
            className="w-[140px] h-[140px] flex items-center justify-center relative z-10 p-1.5 rounded-full bg-gradient-to-br from-[#BC881B]/30 via-transparent to-[#BC881B]/15 border border-[#BC881B]/50 shadow-[0_0_28px_rgba(188,136,27,0.35)]"
            style={{
              animation: 'crestEntrance 600ms cubic-bezier(0.16, 1, 0.3, 1) both, crestPulse 2s ease-in-out 600ms infinite alternate',
            }}
          >
            <img 
              src={ULM_CREST_SRC} 
              alt="University of Lakki Marwat crest" 
              width={140} 
              height={140} 
              className="w-full h-full object-contain drop-shadow-2xl select-none" 
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </div>
        </div>

        {/* b) Dark Scrim (rgba(2,6,23,0.6)) behind text areas so text is never over glow or gradient */}
        <div className="w-full bg-[rgba(2,6,23,0.6)] backdrop-blur-xs p-5 rounded-2xl border border-slate-800/80 space-y-4">
          <div className="space-y-1">
            <div className="splash-step-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#93C5FD]/15 border border-[#93C5FD]/25 text-[#93C5FD] text-[12px] font-mono font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#93C5FD]" />
                <span>CENTRAL CAMPUS WORKSTATION</span>
              </span>
            </div>

            <h1 className="splash-step-2 text-[20px] font-bold font-cinzel tracking-wider text-[#F8FAFC] pt-2">
              UNIVERSITY OF LAKKI MARWAT
            </h1>

            <p className="splash-step-3 text-[12px] font-medium text-[#CBD5E1] tracking-normal font-sans">
              Library Management System • Win32 Edition
            </p>
          </div>

          {/* Boot Splash Book Spines: 7 spines sliding up and settling one by one */}
          <BootSpinesDeco />

          {/* c & d) SQLite mounting status lines + Thin progress bar fills 0 to 100% */}
          <div className="w-full space-y-3 pt-1">
            {/* Progress Bar & Percentage text */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[12px] font-mono">
                <span className="text-[#93C5FD] font-medium">System Mounting Status</span>
                <span className="text-[#F1F5F9] font-bold tabular-nums">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#0B1220] rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-[#2563EB] transition-all duration-75 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* SQLite mounting status lines */}
            <div className="bg-[#0B1220] border border-slate-700 rounded-[8px] p-3 text-left space-y-1.5 min-h-[110px] flex flex-col justify-center">
              {SQLITE_STEPS.map((step) => {
                const isChecked = completedSteps.includes(step.id);
                const isVisible = progress >= step.triggerPct - 5;
                if (!isVisible) return null;

                return (
                  <div 
                    key={step.id} 
                    className="flex items-center justify-between text-[12px] font-mono text-[#93C5FD] animate-in fade-in slide-in-from-bottom-1 duration-200"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[#60A5FA] font-bold">›</span>
                      <span>{step.label}</span>
                    </span>
                    {isChecked ? (
                      <span className="flex items-center gap-1 text-[#86EFAC] text-[12px] font-bold animate-in zoom-in-75 duration-150">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>OK</span>
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#60A5FA] animate-ping" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footnote */}
        <div className="text-[12px] font-mono text-[#CBD5E1] tracking-normal">
          Click anywhere or press Enter to launch
        </div>

      </div>
    </div>
  );
};
