import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Check, 
  Loader2, 
  AlertTriangle 
} from 'lucide-react';
import { Borrower, BorrowerRole } from '../../types/library';

interface BorrowerCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  onBatchImport: (borrowers: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>[]) => { success: boolean; imported: number; errors: string[] };
}

const CSV_TEMPLATE_CONTENT = `University_ID,Name,Role,Department,Father_Name,Program,Session,Semester,Designation,Phone,Email,Address,Borrow_Limit,Valid_Until,Status,Notes
ULM-FA23-BCS-050,Shahid Afridi,Student,Computer Science,Fazal Afridi,BCS,FA23,4,,0300-1122334,shahid.cs@ulm.edu.pk,Lakki Marwat,3,2027-06-30,active,Class FA23
ULM-FAC-PHY-011,Dr. Rehmat Ullah,Faculty,Physics,,,,,Assistant Professor,0345-2233445,rehmat.phy@ulm.edu.pk,Bannu Road Campus,10,,active,Faculty
ULM-STF-ADM-004,Muhammad Irfan,Staff,Management Sciences,,,,,Senior Clerk,0312-5566778,irfan.adm@ulm.edu.pk,Admin Block ULM,5,,active,Admin staff`;

export const BorrowerCsvImportModal: React.FC<BorrowerCsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  onBatchImport,
}) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [validationReports, setValidationReports] = useState<{ line: number; message: string; type: 'error' | 'warning' }[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ULM_Borrowers_Class_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCsv(text);
    };
    reader.readAsText(file);
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    // Helper parser for quoted CSV
    const parseLine = (line: string): string[] => {
      const fields: string[] = [];
      let field = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          fields.push(field.trim());
          field = '';
        } else {
          field += c;
        }
      }
      fields.push(field.trim());
      return fields;
    };

    const headerCols = parseLine(lines[0]);
    setHeaders(headerCols);

    const parsedRows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      parsedRows.push(parseLine(lines[i]));
    }
    setRows(parsedRows);

    // Auto-map columns
    const initialMapping: Record<string, number> = {};
    const targetFields = [
      'university_id', 'name', 'role', 'department', 'father_name',
      'program', 'session', 'semester', 'designation', 'phone',
      'email', 'address', 'borrow_limit', 'valid_until', 'status', 'notes'
    ];

    targetFields.forEach(tf => {
      const idx = headerCols.findIndex(hc => {
        const clean = hc.toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetClean = tf.replace(/[^a-z0-9]/g, '');
        return clean === targetClean || clean.includes(targetClean);
      });
      if (idx !== -1) {
        initialMapping[tf] = idx;
      }
    });

    setColumnMapping(initialMapping);
    runValidation(parsedRows, initialMapping);
  };

  const runValidation = (parsedRows: string[][], mapping: Record<string, number>) => {
    const reports: { line: number; message: string; type: 'error' | 'warning' }[] = [];

    const uidIdx = mapping['university_id'];
    const nameIdx = mapping['name'];
    const phoneIdx = mapping['phone'];

    if (uidIdx === undefined) {
      reports.push({ line: 1, message: 'Missing mapping for mandatory column "University ID".', type: 'error' });
    }
    if (nameIdx === undefined) {
      reports.push({ line: 1, message: 'Missing mapping for mandatory column "Name".', type: 'error' });
    }

    const seenUids = new Set<string>();

    parsedRows.forEach((r, idx) => {
      const lineNum = idx + 2; // header is line 1
      const uid = uidIdx !== undefined && r[uidIdx] ? r[uidIdx].trim().toUpperCase() : '';
      const n = nameIdx !== undefined && r[nameIdx] ? r[nameIdx].trim() : '';

      if (!uid) {
        reports.push({ line: lineNum, message: 'Missing mandatory University ID.', type: 'error' });
      } else if (seenUids.has(uid)) {
        reports.push({ line: lineNum, message: `Duplicate University ID "${uid}" within CSV batch.`, type: 'error' });
      } else {
        seenUids.add(uid);
      }

      if (!n) {
        reports.push({ line: lineNum, message: 'Missing mandatory Member Name.', type: 'error' });
      }

      if (phoneIdx !== undefined && r[phoneIdx]) {
        const p = r[phoneIdx].trim();
        if (p && !/^(\+92\s?3\d{2}|03\d{2})[- ]?\d{7}$/.test(p)) {
          reports.push({ line: lineNum, message: `Phone "${p}" may not match standard Pakistani format.`, type: 'warning' });
        }
      }
    });

    setValidationReports(reports);
  };

  const handleStartImport = async () => {
    setIsImporting(true);
    setProgress(10);

    // Build payload list
    const borrowersToImport: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>[] = [];

    const uidIdx = columnMapping['university_id'];
    const nameIdx = columnMapping['name'];
    const roleIdx = columnMapping['role'];
    const deptIdx = columnMapping['department'];
    const fatherIdx = columnMapping['father_name'];
    const progIdx = columnMapping['program'];
    const sessIdx = columnMapping['session'];
    const semIdx = columnMapping['semester'];
    const desigIdx = columnMapping['designation'];
    const phoneIdx = columnMapping['phone'];
    const emailIdx = columnMapping['email'];
    const addrIdx = columnMapping['address'];
    const limitIdx = columnMapping['borrow_limit'];
    const validIdx = columnMapping['valid_until'];
    const statusIdx = columnMapping['status'];
    const notesIdx = columnMapping['notes'];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const uid = uidIdx !== undefined && r[uidIdx] ? r[uidIdx].trim().toUpperCase() : '';
      const nameVal = nameIdx !== undefined && r[nameIdx] ? r[nameIdx].trim() : '';
      if (!uid || !nameVal) continue;

      let rRole: BorrowerRole = 'Student';
      if (roleIdx !== undefined && r[roleIdx]) {
        const rawRole = r[roleIdx].trim();
        if (rawRole.toLowerCase().includes('fac')) rRole = 'Faculty';
        else if (rawRole.toLowerCase().includes('staff')) rRole = 'Staff';
      }

      const deptVal = deptIdx !== undefined && r[deptIdx] ? r[deptIdx].trim() : 'Computer Science';
      const fatherVal = fatherIdx !== undefined && r[fatherIdx] ? r[fatherIdx].trim() : undefined;
      const progVal = progIdx !== undefined && r[progIdx] ? r[progIdx].trim() : (rRole === 'Student' ? 'BCS' : rRole);
      const sessVal = sessIdx !== undefined && r[sessIdx] ? r[sessIdx].trim() : undefined;
      const semVal = semIdx !== undefined && r[semIdx] ? parseInt(r[semIdx], 10) || 1 : null;
      const desigVal = desigIdx !== undefined && r[desigIdx] ? r[desigIdx].trim() : undefined;
      const phoneVal = phoneIdx !== undefined && r[phoneIdx] ? r[phoneIdx].trim() : '0300-0000000';
      const emailVal = emailIdx !== undefined && r[emailIdx] ? r[emailIdx].trim() : undefined;
      const addrVal = addrIdx !== undefined && r[addrIdx] ? r[addrIdx].trim() : undefined;
      const limitVal = limitIdx !== undefined && r[limitIdx] ? parseInt(r[limitIdx], 10) || (rRole === 'Faculty' ? 10 : rRole === 'Staff' ? 5 : 3) : (rRole === 'Faculty' ? 10 : rRole === 'Staff' ? 5 : 3);
      const validVal = validIdx !== undefined && r[validIdx] ? r[validIdx].trim() : null;
      const statusVal = (statusIdx !== undefined && r[statusIdx] ? r[statusIdx].trim().toLowerCase() : 'active') as any;
      const notesVal = notesIdx !== undefined && r[notesIdx] ? r[notesIdx].trim() : undefined;

      borrowersToImport.push({
        role: rRole,
        university_id: uid,
        student_id: uid,
        barcode: uid,
        name: nameVal,
        father_name: fatherVal,
        department: deptVal,
        program: progVal,
        session: sessVal,
        semester: semVal,
        designation: desigVal,
        phone: phoneVal,
        email: emailVal,
        address: addrVal,
        borrow_limit: limitVal,
        joined_date: new Date().toISOString().split('T')[0],
        valid_until: validVal,
        status: statusVal || 'active',
        notes: notesVal,
      });
    }

    setProgress(50);
    await new Promise(r => setTimeout(r, 200));

    // One-transaction atomic batch import
    const res = onBatchImport(borrowersToImport);
    setProgress(100);
    setIsImporting(false);
    setImportResult({ imported: res.imported, errors: res.errors });
    if (res.success) {
      onImportComplete();
    }
  };

  const hasFatalErrors = validationReports.some(vr => vr.type === 'error');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl bg-[#0B1220] border border-[#334155] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#020617] border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F1F5F9] font-cinzel leading-tight">
                Bulk Import Class Students &amp; Faculty (CSV)
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Atomic Batch Ingestion · Automatic Column Mapping · Validation Report
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#F1F5F9] hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* Upload Drop Zone */}
          {!csvFile ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#334155] hover:border-amber-500/50 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#020617]/50 hover:bg-[#020617] transition-all cursor-pointer space-y-3"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Upload className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#F1F5F9]">Select Whole-Class CSV File</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Upload an institutional CSV export containing enrolled students or department staff rosters.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md pointer-events-none"
              >
                Browse CSV File...
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#020617] border border-[#334155]">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-[#F1F5F9] block">{csvFile.name}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {rows.length} rows parsed · {headers.length} columns detected
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCsvFile(null);
                  setRows([]);
                  setHeaders([]);
                  setValidationReports([]);
                  setImportResult(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 cursor-pointer"
              >
                Choose Different File
              </button>
            </div>
          )}

          {/* Validation & Import Progress */}
          {isImporting && (
            <div className="p-4 rounded-xl bg-[#020617] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-amber-400 font-bold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  Executing Atomic Batch Import Transaction...
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Import Result Feedback */}
          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Batch Transaction Committed Successfully!</span>
              </div>
              <p className="text-xs text-emerald-200/90 font-mono">
                Imported {importResult.imported} borrower profiles into ULM library SQLite database.
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-amber-300 space-y-1">
                  <span className="font-semibold block">Notes / Skipped items:</span>
                  <ul className="list-disc pl-5 font-mono text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Validation Report with Line Numbers */}
          {validationReports.length > 0 && (
            <div className="p-4 rounded-xl bg-[#020617] border border-[#334155] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F1F5F9] flex items-center gap-2 font-mono uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Batch Pre-validation Report ({validationReports.length})</span>
                </span>
                {hasFatalErrors ? (
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                    Errors detected (Must fix before import)
                  </span>
                ) : (
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    Validation Passed with Warnings
                  </span>
                )}
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                {validationReports.map((vr, i) => (
                  <div 
                    key={i}
                    className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono ${
                      vr.type === 'error'
                        ? 'bg-rose-950/40 text-rose-300 border border-rose-900/40'
                        : 'bg-amber-950/40 text-amber-300 border border-amber-900/40'
                    }`}
                  >
                    <span className="font-bold underline">Line {vr.line}:</span>
                    <span>{vr.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview First 20 Rows */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Dataset Preview (First 20 of {rows.length} Rows)
                </span>
              </div>

              <div className="rounded-xl border border-[#334155] overflow-hidden bg-[#020617]">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-[11px] text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-[#334155] sticky top-0">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        {headers.map((h, i) => (
                          <th key={i} className="py-2 px-3 font-semibold whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {rows.slice(0, 20).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/40 font-mono">
                          <td className="py-1.5 px-3 text-slate-500">{rIdx + 1}</td>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-1.5 px-3 whitespace-nowrap truncate max-w-[160px]">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#020617] border-t border-[#334155] flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">
            {rows.length > 0 ? `${rows.length} total rows queued for import` : 'Ready to parse CSV'}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleStartImport}
              disabled={rows.length === 0 || hasFatalErrors || isImporting}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Import {rows.length} Members</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BorrowerCsvImportModal;
