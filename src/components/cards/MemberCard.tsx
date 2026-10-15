import React from 'react';
import { Wifi, Shield, Award, CheckCircle } from 'lucide-react';
import { Borrower } from '../../types/library';
import { ULM_CREST_SRC, ULM_CREST_LOGO_SRC, ULM_CREST_WATERMARK_SRC } from '../../assets/brand/crestData';

export interface MemberCardProps {
  member: Partial<Borrower> | null;
  side?: 'front' | 'back';
  scale?: number;
  className?: string;
  showLanyardSlot?: boolean;
}

// Generate realistic Code-128 style barcode bars as SVG rects
const renderCode128Svg = (code: string) => {
  const safeCode = (code || 'ULM-00000').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  // Start pattern (Code 128B start: 211214)
  const modulePatterns: number[] = [2, 1, 1, 2, 1, 4];

  for (let i = 0; i < safeCode.length; i++) {
    const charCode = safeCode.charCodeAt(i);
    // Deterministic 6-module pattern with sum of 11 modules
    const m1 = ((charCode * 3) % 4) + 1;
    const m2 = ((charCode * 5) % 4) + 1;
    const m3 = ((charCode * 7) % 3) + 1;
    const m4 = ((charCode * 11) % 3) + 1;
    const m5 = ((charCode * 13) % 3) + 1;
    const sum5 = m1 + m2 + m3 + m4 + m5;
    const m6 = Math.max(1, 11 - sum5);
    modulePatterns.push(m1, m2, m3, m4, m5, m6);
  }

  // Stop pattern (2331112)
  modulePatterns.push(2, 3, 3, 1, 1, 1, 2);

  let currentX = 2;
  const rects: React.ReactNode[] = [];
  let isBar = true;

  modulePatterns.forEach((width, index) => {
    if (isBar) {
      rects.push(
        <rect
          key={index}
          x={currentX}
          y={0}
          width={width * 1.05}
          height={26}
          fill="#000000"
        />
      );
    }
    currentX += width * 1.05;
    isBar = !isBar;
  });

  return (
    <svg
      viewBox={`0 0 ${currentX + 4} 26`}
      preserveAspectRatio="none"
      className="w-full h-full block"
    >
      <rect x={0} y={0} width={currentX + 4} height={26} fill="#ffffff" />
      {rects}
    </svg>
  );
};

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  side = 'front',
  scale = 1,
  className = '',
  showLanyardSlot = true,
}) => {
  if (!member) return null;

  const role = member.role || 'Student';
  const uid = member.university_id || member.student_id || 'ULM-FA23-BCS-001';
  const name = member.name || 'Member Full Name';
  const nameUrdu = member.name_urdu || '';
  const department = member.department || 'Computer Science';
  const bloodGroup = member.blood_group || 'O+';
  const validUntil = member.valid_until || (role === 'Student' ? '2027-06-30' : 'PERMANENT');

  // Student specific
  const rollNumber = member.roll_number || (role === 'Student' ? 'BSCS-23-42' : '');
  const degreeLevel = member.degree_level || 'BS';
  const program = member.program || 'Computer Science';
  const studyMode = member.study_mode || 'Regular';
  const session = member.session || 'FA23';

  // Faculty/Staff specific
  const designation = member.designation || (role === 'Faculty' ? 'Assistant Professor' : 'Administrative Staff');
  const employeeNo = member.employee_no || uid;

  const modeShort = studyMode === 'Self-Finance' ? 'SF' : studyMode === 'Evening' ? 'Eve' : 'Reg';

  // Format valid until display: "30 JUN 2027"
  const formatExpiryDisplay = (val: string) => {
    if (!val || val.toUpperCase() === 'PERMANENT') return 'PERMANENT';
    const parts = val.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const monthStr = monthNames[mIdx] || parts[1];
      return `${day} ${monthStr} ${year}`;
    }
    return val.toUpperCase();
  };

  const cardStyle: React.CSSProperties = {
    width: '398px',
    height: '227px',
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'top left',
  };

  const cardContainerStyle: React.CSSProperties = scale !== 1 ? {
    width: `${398 * scale}px`,
    height: `${227 * scale}px`,
  } : {};

  return (
    <div
      className={`member-card-scalable relative select-none print:shadow-none ${className}`}
      style={cardContainerStyle}
    >
      <div
        className="w-[398px] h-[227px] rounded-xl p-[1.5px] bg-gradient-to-br from-[#f6b84a] via-[#d99e32] to-[#b37e1b] shadow-2xl relative overflow-hidden transition-all text-slate-100 flex flex-col print:m-0 print:border-[#d99e32]"
        style={cardStyle}
        data-member-card="true"
        data-card-side={side}
      >
        {/* INNER CARD BODY: Dark navy background #0d101a */}
        <div className="w-full h-full rounded-[10px] bg-[#0d101a] relative overflow-hidden flex flex-col justify-between p-2.5">
          {/* Subtle Glossy Diagonal Highlight */}
          <div
            className="absolute inset-0 pointer-events-none z-1"
            style={{
              background:
                'linear-gradient(115deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 26%, transparent 52%)',
            }}
          />

          {/* Faint Purple/Gold Corner Glows (z-0 behind watermark) */}
          <div
            className="absolute top-0 left-0 w-44 h-44 pointer-events-none z-0"
            style={{
              background: 'radial-gradient(circle at top left, rgba(84, 26, 114, 0.25) 0%, transparent 60%)',
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-48 h-48 pointer-events-none z-0"
            style={{
              background: 'radial-gradient(circle at bottom right, rgba(217, 158, 50, 0.15) 0%, transparent 60%)',
            }}
          />

          {/* Authentic ULM Crest Watermark Centered Behind Content (14% institutional opacity) */}
          <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] pointer-events-none select-none z-1 flex items-center justify-center opacity-[0.14]" 
            aria-hidden="true"
          >
            <img 
              src={ULM_CREST_LOGO_SRC} 
              alt="University of Lakki Marwat crest watermark" 
              width={160} 
              height={160} 
              className="w-full h-full object-contain pointer-events-none select-none" 
              style={{ 
                imageRendering: '-webkit-optimize-contrast' 
              }}
            />
          </div>

          {/* Small Lanyard-Slot Pill Centered Above Card (simulated punched slot) */}
          {showLanyardSlot && (
            <div className="absolute top-[2.5px] left-1/2 -translate-x-1/2 w-9 h-[4px] rounded-full bg-[#070911] border border-[#d99e32]/40 shadow-inner z-20 pointer-events-none" />
          )}

          {side === 'front' ? (
            /* ================= FRONT SIDE ================= */
            <>
              {/* HEADER ROW */}
              <div className="relative z-10 flex items-center justify-between pb-1.5 border-b border-[#d99e32]/35">
                {/* Official Crest (about 9.5mm high) & University Titles */}
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0 flex items-center justify-center p-[1px] rounded-full bg-gradient-to-br from-[#d99e32]/30 via-transparent to-[#d99e32]/15 border border-[#d99e32]/50 shadow-[0_0_6px_rgba(217,158,50,0.3)]">
                    <img 
                      src={ULM_CREST_SRC} 
                      alt="University of Lakki Marwat crest" 
                      width={38} 
                      height={38} 
                      className="w-[38px] h-[38px] max-w-[9.5mm] max-h-[9.5mm] object-contain shrink-0 select-none drop-shadow-sm" 
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                    />
                  </div>

                  <div>
                    <h1 className="font-cinzel text-white uppercase font-bold tracking-wider text-[10px] leading-tight drop-shadow-xs">
                      University of Lakki Marwat
                    </h1>
                    <p className="text-[#f6b84a] font-mono text-[7px] font-bold tracking-[0.15em] uppercase leading-none mt-0.5 flex items-center gap-1">
                      <span>Central Campus Library</span>
                      <span className="text-[#d99e32]/80">•</span>
                      <span>Smart ID</span>
                    </p>
                  </div>
                </div>

                {/* Right Chip: Circulation + RFID Enabled */}
                <div className="flex flex-col items-end shrink-0">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#d99e32] bg-[#d99e32]/10 text-[#f6b84a] shadow-xs">
                    <Wifi className="w-2.5 h-2.5 rotate-90 text-[#f6b84a]" />
                    <span className="font-mono font-bold text-[7px] tracking-wider uppercase leading-none">
                      Circulation
                    </span>
                  </div>
                  <span className="text-[5.5px] font-mono tracking-widest text-[#f6b84a]/80 mt-0.5 uppercase">
                    RFID Enabled
                  </span>
                </div>
              </div>

              {/* BODY ROW: Portrait Photo on Left, Details & Names on Right */}
              <div className="relative z-10 flex items-start gap-2.5 my-auto pt-1">
                {/* Portrait Photo (4:5 Ratio) in Gold Frame */}
                <div className="relative shrink-0">
                  <div className="w-[66px] h-[82px] rounded border-[1.5px] border-[#d99e32] bg-[#05070d] overflow-hidden shadow-md flex items-center justify-center">
                    {member.photo_url || member.photo_path ? (
                      <img
                        src={member.photo_url || member.photo_path}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#d99e32]/70 bg-gradient-to-b from-[#141824] to-[#0a0d16]">
                        <span className="font-cinzel text-base font-bold text-[#f6b84a]">
                          {name.charAt(0) || 'U'}
                        </span>
                        <span className="text-[6.5px] font-mono text-slate-400 mt-0.5">Photo</span>
                      </div>
                    )}
                  </div>

                  {/* Small Gold Badge at Photo's Bottom-Right Corner */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-[#f6b84a] to-[#d99e32] p-[1px] shadow-sm flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#0d101a] flex items-center justify-center text-[#f6b84a]">
                      <Award className="w-2.5 h-2.5" />
                    </div>
                  </div>
                </div>

                {/* Right Column: Names & Detail Grid */}
                <div className="min-w-0 flex-1 flex flex-col justify-between h-[82px]">
                  {/* Name Header: English Bold (Inter) + Urdu Name (Noto Nastaliq Urdu) */}
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-1 gap-1">
                    <h2 className="text-[11.5px] font-bold text-white tracking-tight truncate leading-tight font-sans">
                      {name}
                    </h2>
                    {nameUrdu ? (
                      <span
                        dir="rtl"
                        className="font-urdu text-[#f6b84a] text-[12px] leading-none shrink-0 font-bold"
                        style={{ fontFamily: 'var(--font-urdu)' }}
                      >
                        {nameUrdu}
                      </span>
                    ) : (
                      <span className="text-[7px] font-mono uppercase px-1 py-0.2 rounded border border-amber-500/40 text-amber-300 bg-amber-500/10">
                        {role}
                      </span>
                    )}
                  </div>

                  {/* Field Details Grid */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[7.5px] pt-0.5">
                    {/* Row 1: ID NO & Roll / Emp NO */}
                    <div>
                      <span className="text-slate-400 font-semibold tracking-wider uppercase text-[6.5px] block leading-none">
                        ID No
                      </span>
                      <span className="font-mono text-[#f6b84a] font-bold text-[8px] leading-tight truncate block">
                        {uid}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold tracking-wider uppercase text-[6.5px] block leading-none">
                        {role === 'Student' ? 'Roll No' : 'Emp No'}
                      </span>
                      <span className="font-mono text-white font-bold text-[8px] leading-tight truncate block">
                        {role === 'Student' ? rollNumber || '—' : employeeNo || '—'}
                      </span>
                    </div>

                    {/* Row 2: Degree / Program / Designation */}
                    <div className="col-span-2">
                      <span className="text-slate-400 font-semibold tracking-wider uppercase text-[6.5px] block leading-none">
                        {role === 'Student' ? 'Degree / Program' : 'Designation'}
                      </span>
                      <span className="font-sans text-slate-100 font-bold text-[7.5px] leading-tight truncate block">
                        {role === 'Student'
                          ? `${degreeLevel} ${program} (${modeShort})`
                          : `${designation} · ${role}`}
                      </span>
                    </div>

                    {/* Row 3: Session / Dept & Blood Group */}
                    <div>
                      <span className="text-slate-400 font-semibold tracking-wider uppercase text-[6.5px] block leading-none">
                        {role === 'Student' ? 'Session' : 'Department'}
                      </span>
                      <span className="font-mono text-slate-200 font-bold text-[7.5px] leading-tight truncate block">
                        {role === 'Student' ? session : department}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-slate-400 font-semibold tracking-wider uppercase text-[6.5px] block leading-none">
                          Blood
                        </span>
                        <span className="font-mono text-amber-400 font-black text-[7.5px] leading-tight block">
                          {bloodGroup}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold tracking-wider uppercase text-[6.5px] block leading-none">
                          Valid Till
                        </span>
                        <span className="font-mono text-slate-200 font-bold text-[7px] leading-tight block">
                          {formatExpiryDisplay(validUntil)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER ROW: High-Contrast Code 128 Barcode & Card Tag */}
              <div className="relative z-10 pt-1 border-t border-slate-700/60 flex items-center justify-between gap-2">
                {/* Barcode & Human-readable number */}
                <div className="flex-1 flex flex-col justify-center">
                  <div className="h-[20px] w-full bg-white rounded-[2px] p-[1px] shadow-xs overflow-hidden">
                    {renderCode128Svg(uid)}
                  </div>
                  <div className="flex items-center justify-between text-[6.5px] font-mono text-slate-400 pt-0.5 px-0.5 leading-none">
                    <span className="tracking-wider text-slate-300 font-semibold">{uid}</span>
                    <span className="text-amber-400/90 font-mono">Limit: {member.borrow_limit || (role === 'Faculty' ? 10 : role === 'Staff' ? 5 : 3)} Books</span>
                  </div>
                </div>

                {/* Right Badge / University Seal Chip */}
                <div className="shrink-0 flex flex-col items-end justify-center pl-1">
                  <div className="px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500/20 to-amber-600/30 border border-amber-500/50 text-[6.5px] font-mono font-bold text-amber-300 uppercase tracking-widest leading-none">
                    Official
                  </div>
                  <span className="text-[5.5px] font-sans text-slate-400 tracking-tighter mt-0.5">
                    Lakki Marwat
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* ================= BACK SIDE ================= */
            <>
              {/* BACK HEADER */}
              <div className="relative z-10 flex items-center justify-between pb-1.5 border-b border-[#d99e32]/35">
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0 flex items-center justify-center p-[1px] rounded-full bg-gradient-to-br from-[#d99e32]/30 via-transparent to-[#d99e32]/15 border border-[#d99e32]/50 shadow-[0_0_6px_rgba(217,158,50,0.3)]">
                    <img 
                      src={ULM_CREST_SRC} 
                      alt="University of Lakki Marwat crest" 
                      width={28} 
                      height={28} 
                      className="w-[28px] h-[28px] max-w-[7.5mm] max-h-[7.5mm] object-contain shrink-0 select-none drop-shadow-sm" 
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                    />
                  </div>
                  <div>
                    <h3 className="font-cinzel text-white text-[9px] uppercase font-bold tracking-wider leading-tight">
                      University of Lakki Marwat
                    </h3>
                    <p className="text-[#f6b84a] font-mono text-[6.5px] tracking-wider uppercase leading-none">
                      Central Campus Library · Circulation Terms
                    </p>
                  </div>
                </div>

                <div className="text-[6.5px] font-mono text-amber-400/90 border border-amber-500/40 px-1 py-0.5 rounded bg-amber-500/10">
                  CR80 / 85.6 × 54 mm
                </div>
              </div>

              {/* BACK BODY: Official Terms & Regulations */}
              <div className="relative z-10 my-auto py-1 space-y-1 text-[6.5px] text-slate-300 leading-snug">
                <div className="flex items-start gap-1">
                  <span className="font-mono text-amber-400 font-bold shrink-0">1.</span>
                  <span>This Smart ID card is non-transferable and remains the official property of ULM Central Campus Library.</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="font-mono text-amber-400 font-bold shrink-0">2.</span>
                  <span>The cardholder is strictly responsible for all library materials issued against this credential.</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="font-mono text-amber-400 font-bold shrink-0">3.</span>
                  <span>Loss of this card must be immediately reported to the Circulation Desk for security deactivation.</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="font-mono text-amber-400 font-bold shrink-0">4.</span>
                  <span>If found, please return to: Central Campus Library, University of Lakki Marwat, KP, Pakistan.</span>
                </div>
              </div>

              {/* SIGNATURES & AUTHORITY STAMP */}
              <div className="relative z-10 pt-1 border-t border-slate-700/60 grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-full border-b border-dotted border-slate-500 h-4 flex items-end justify-center">
                    <span className="text-[6px] font-sans text-slate-400 italic">Signature</span>
                  </div>
                  <span className="text-[6px] uppercase font-mono text-slate-400 mt-0.5 tracking-wider">
                    Cardholder Signature
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-full border-b border-slate-400 h-4 flex items-end justify-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-[6.5px] font-cinzel font-bold text-amber-300">ULM Library</span>
                  </div>
                  <span className="text-[6px] uppercase font-mono text-amber-400 mt-0.5 tracking-wider">
                    Issuing Authority
                  </span>
                </div>
              </div>

              {/* BACK FOOTER CONTACT */}
              <div className="relative z-10 pt-0.5 text-center text-[5.5px] font-mono text-slate-400 border-t border-slate-800">
                <span>Tel: +92 969 511819</span>
                <span className="mx-1 text-amber-400/80">•</span>
                <span>Email: library@ulm.edu.pk</span>
                <span className="mx-1 text-amber-400/80">•</span>
                <span>Web: www.ulm.edu.pk</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
