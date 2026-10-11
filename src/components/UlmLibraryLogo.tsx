import React from 'react';

interface UlmLibraryLogoProps {
  className?: string;
  showText?: boolean;
}

export const UlmLibraryLogo: React.FC<UlmLibraryLogoProps> = ({ 
  className = 'w-9 h-9',
  showText = false 
}) => {
  return (
    <div className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
        aria-label="ULM Library Official Crest"
      >
        <defs>
          <linearGradient id="shieldGrad" x1="100" y1="35" x2="100" y2="135" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="blueAccent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Outer Circular Seal Rings */}
        <circle cx="100" cy="86" r="76" stroke="#1E3A8A" strokeWidth="3" className="stroke-blue-800 dark:stroke-blue-400" />
        <circle cx="100" cy="86" r="71" stroke="#3B82F6" strokeWidth="1.2" strokeDasharray="3 2" className="stroke-blue-500/70" />
        <circle cx="100" cy="86" r="66" stroke="#1E3A8A" strokeWidth="1.8" className="stroke-blue-900/80 dark:stroke-blue-400/80" />

        {/* Laurel Wreath Left Side */}
        <g fill="#1E3A8A" className="fill-blue-800 dark:fill-blue-400">
          <path d="M 36 82 C 34 76, 42 74, 46 80 C 44 86, 38 86, 36 82 Z" />
          <path d="M 40 68 C 39 62, 47 61, 50 67 C 48 73, 42 73, 40 68 Z" />
          <path d="M 46 54 C 47 48, 55 49, 56 55 C 53 60, 48 60, 46 54 Z" />
          <path d="M 56 42 C 59 37, 66 40, 66 46 C 62 50, 57 48, 56 42 Z" />
          <path d="M 68 34 C 72 30, 79 34, 78 40 C 73 43, 69 40, 68 34 Z" />
          <path d="M 37 96 C 36 102, 44 103, 47 97 C 46 91, 40 91, 37 96 Z" />
          <path d="M 43 110 C 43 116, 51 116, 53 110 C 51 104, 45 105, 43 110 Z" />
          <path d="M 52 122 C 54 128, 62 126, 62 120 C 59 115, 54 116, 52 122 Z" />
          <path d="M 66 132 C 70 137, 77 133, 76 127 C 72 123, 67 126, 66 132 Z" />
          <path d="M 82 139 C 87 142, 92 137, 89 132 C 84 130, 81 134, 82 139 Z" />
        </g>

        {/* Laurel Wreath Right Side */}
        <g fill="#1E3A8A" className="fill-blue-800 dark:fill-blue-400">
          <path d="M 164 82 C 166 76, 158 74, 154 80 C 156 86, 162 86, 164 82 Z" />
          <path d="M 160 68 C 161 62, 153 61, 150 67 C 152 73, 158 73, 160 68 Z" />
          <path d="M 154 54 C 153 48, 145 49, 144 55 C 147 60, 152 60, 154 54 Z" />
          <path d="M 144 42 C 141 37, 134 40, 134 46 C 138 50, 143 48, 144 42 Z" />
          <path d="M 132 34 C 128 30, 121 34, 122 40 C 127 43, 131 40, 132 34 Z" />
          <path d="M 163 96 C 164 102, 156 103, 153 97 C 154 91, 160 91, 163 96 Z" />
          <path d="M 157 110 C 157 116, 149 116, 147 110 C 149 104, 155 105, 157 110 Z" />
          <path d="M 148 122 C 146 128, 138 126, 138 120 C 141 115, 146 116, 148 122 Z" />
          <path d="M 134 132 C 130 137, 123 133, 124 127 C 128 123, 133 126, 134 132 Z" />
          <path d="M 118 139 C 113 142, 108 137, 111 132 C 116 130, 119 134, 118 139 Z" />
        </g>

        {/* Five-Pointed Star at Bottom Center */}
        <polygon 
          points="100,138 103,146 111,146 105,151 107,159 100,154 93,159 95,151 89,146 97,146" 
          fill="#1E3A8A" 
          className="fill-blue-700 dark:fill-blue-400"
        />

        {/* Central Heraldic Shield */}
        <path 
          d="M 62 48 Q 100 42 100 42 Q 100 42 138 48 C 139 78, 135 110, 100 134 C 65 110, 61 78, 62 48 Z" 
          fill="#0B132B" 
          stroke="#1E3A8A" 
          strokeWidth="3.5"
          className="fill-slate-900 stroke-blue-700 dark:stroke-blue-400"
        />
        <path 
          d="M 66 52 Q 100 46 100 46 Q 100 46 134 52 C 135 77, 131 106, 100 128 C 69 106, 65 77, 66 52 Z" 
          fill="none" 
          stroke="#3B82F6" 
          strokeWidth="1.2"
          className="stroke-blue-500/70"
        />

        {/* Upper Shield: "ULM" Serif Typography */}
        <text 
          x="100" 
          y="74" 
          textAnchor="middle" 
          fontFamily="'Cinzel', Georgia, 'Times New Roman', serif" 
          fontSize="24" 
          fontWeight="900" 
          letterSpacing="2.5" 
          fill="#F8FAFC" 
          className="fill-white drop-shadow"
        >
          ULM
        </text>

        {/* Open Book in the Center of the Shield */}
        <g id="open-book">
          <path 
            d="M 100 88 C 88 84, 76 86, 70 84 L 70 76 C 76 78, 88 76, 100 80 Z" 
            fill="#F1F5F9" 
            stroke="#1E3A8A" 
            strokeWidth="0.8" 
          />
          <path 
            d="M 100 88 C 112 84, 124 86, 130 84 L 130 76 C 124 78, 112 76, 100 80 Z" 
            fill="#F1F5F9" 
            stroke="#1E3A8A" 
            strokeWidth="0.8" 
          />
          <path d="M 74 81 C 82 82, 92 80, 97 83" stroke="#94A3B8" strokeWidth="0.6" fill="none" />
          <path d="M 103 83 C 108 80, 118 82, 126 81" stroke="#94A3B8" strokeWidth="0.6" fill="none" />
          <line x1="100" y1="80" x2="100" y2="89" stroke="#1E3A8A" strokeWidth="1.5" />
        </g>

        {/* Digital Barcode / Library Pillar Grid below Open Book */}
        <g id="digital-barcode-pillars">
          <rect x="73" y="94" width="2.5" height="10" fill="#60A5FA" rx="0.5" />
          <rect x="78" y="93" width="1.8" height="15" fill="#3B82F6" rx="0.5" />
          <rect x="82" y="92" width="3" height="19" fill="#1D4ED8" rx="0.5" />
          <rect x="87" y="92" width="2" height="23" fill="#60A5FA" rx="0.5" />
          <rect x="91" y="91" width="3.5" height="27" fill="#3B82F6" rx="0.5" />
          <rect x="97" y="91" width="2" height="31" fill="#93C5FD" rx="0.5" />
          
          {/* Center Column Pillar (Longest) */}
          <rect x="100" y="91" width="2.5" height="33" fill="#3B82F6" rx="0.5" />

          {/* Right Symmetrical Pillars */}
          <rect x="104" y="91" width="2" height="31" fill="#93C5FD" rx="0.5" />
          <rect x="108" y="91" width="3.5" height="27" fill="#3B82F6" rx="0.5" />
          <rect x="113" y="92" width="2" height="23" fill="#60A5FA" rx="0.5" />
          <rect x="117" y="92" width="3" height="19" fill="#1D4ED8" rx="0.5" />
          <rect x="122" y="93" width="1.8" height="15" fill="#3B82F6" rx="0.5" />
          <rect x="126" y="94" width="2.5" height="10" fill="#60A5FA" rx="0.5" />
          
          <rect x="95" y="125" width="2" height="2" fill="#60A5FA" />
          <rect x="104" y="125" width="2" height="2" fill="#60A5FA" />
          <rect x="98.5" y="127" width="2.5" height="2" fill="#93C5FD" />
        </g>

        {/* Fountain Pen Nib descending into shield top */}
        <g id="fountain-pen-nib">
          <path 
            d="M 93 30 L 100 48 L 107 30 Q 100 32 93 30 Z" 
            fill="#F8FAFC" 
            stroke="#1E3A8A" 
            strokeWidth="1.5" 
          />
          <line x1="100" y1="36" x2="100" y2="47" stroke="#1E3A8A" strokeWidth="1.2" />
          <circle cx="100" cy="36" r="1.5" fill="#1E3A8A" />
        </g>

        {/* Academic Mortarboard Cap */}
        <g id="graduation-cap">
          <path d="M 88 23 L 88 28 C 88 32, 112 32, 112 28 L 112 23 Z" fill="#0B132B" stroke="#1E3A8A" strokeWidth="1" />
          <polygon 
            points="100,12 126,20 100,28 74,20" 
            fill="#0F172A" 
            stroke="#3B82F6" 
            strokeWidth="1.5" 
            className="fill-slate-950 stroke-blue-500"
          />
          <circle cx="100" cy="20" r="1.8" fill="#60A5FA" />
          <path d="M 100 20 Q 118 21 123 29" stroke="#60A5FA" strokeWidth="1.2" fill="none" />
          <polygon points="121,29 125,29 124,35 122,35" fill="#60A5FA" />
        </g>
      </svg>

      {/* Optional full emblem text below crest */}
      {showText && (
        <div className="flex flex-col items-center mt-2 text-center">
          <span className="font-cinzel font-bold text-sm tracking-wider text-slate-900 dark:text-white uppercase leading-none">
            ULM LIBRARY
          </span>
          <div className="flex items-center gap-1.5 w-full my-1">
            <span className="h-[1px] flex-1 bg-blue-500/40" />
            <span className="w-1.5 h-1.5 rotate-45 bg-blue-600 dark:bg-blue-400" />
            <span className="h-[1px] flex-1 bg-blue-500/40" />
          </div>
          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 tracking-wider uppercase leading-none">
            University of Lakki Marwat
          </span>
          <span className="text-[8px] font-mono text-slate-500 tracking-tight uppercase mt-0.5">
            Library Management System
          </span>
        </div>
      )}
    </div>
  );
};

export default UlmLibraryLogo;
