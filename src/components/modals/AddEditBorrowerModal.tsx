import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  UserCheck, 
  UserPlus, 
  AlertCircle, 
  Upload, 
  Trash2, 
  Sparkles, 
  AlertTriangle,
  ArrowRight,
  Copy,
  ExternalLink,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Crop
} from 'lucide-react';
import { Borrower, BorrowerRole, BorrowerStatus } from '../../types/library';
import CustomSelect from '../ui/CustomSelect';
import { MemberCard } from '../cards/MemberCard';
import { PhotoCropModal } from '../shared/PhotoCropModal';

interface AddEditBorrowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (borrowerData: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => { success: boolean; message: string; borrower?: Borrower; existingBorrowerId?: string };
  onUpdate?: (id: string, updates: Partial<Borrower>) => { success: boolean; message: string; borrower?: Borrower };
  borrowerToEdit?: Borrower | null;
  allBorrowers: Borrower[];
  onOpenExisting?: (borrowerId: string) => void;
  onCreated?: (borrower: Borrower) => void;
}

const DEFAULT_DEPARTMENTS = [
  'Computer Science',
  'Law',
  'Education',
  'Physics',
  'Mathematics',
  'Chemistry',
  'English',
  'Islamic Studies',
  'Management Sciences',
  'Civil Engineering'
];

const FACULTY_STAFF_DESIGNATIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Lecturer',
  'Visiting Faculty',
  'Librarian',
  'Assistant Librarian',
  'Lab Engineer',
  'Clerk',
  'Senior Clerk',
  'Other'
];

const DEGREE_LEVELS = ['BS', 'MS', 'MPhil', 'PhD', 'ADP', 'Other'];
const STUDY_MODES = [
  { value: 'Regular', label: 'Regular (Reg)' },
  { value: 'Self-Finance', label: 'Self-Finance (SF)' },
  { value: 'Evening', label: 'Evening (Eve)' }
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

const DRAFT_STORAGE_KEY = 'ulm_borrower_form_draft_v3';
const LAST_SAVED_VALUES_KEY = 'ulm_borrower_last_saved_fields_v2';

// Helper to calculate student valid until date: 30 June of (Session Year + Duration)
function computeStudentValidUntil(sessionStr: string, degree: string): string {
  let startYear = new Date().getFullYear();
  const match = (sessionStr || '').match(/(\d{2,4})/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val < 100) {
      startYear = 2000 + val;
    } else {
      startYear = val;
    }
  }
  let duration = 4;
  const upperDeg = (degree || '').trim().toUpperCase();
  if (upperDeg === 'ADP' || upperDeg === 'MS' || upperDeg === 'MPHIL') {
    duration = 2;
  } else if (upperDeg === 'PHD') {
    duration = 3;
  } else if (upperDeg === 'BS') {
    duration = 4;
  }
  const endYear = startYear + duration;
  return `${endYear}-06-30`;
}

export const AddEditBorrowerModal: React.FC<AddEditBorrowerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  borrowerToEdit,
  allBorrowers,
  onOpenExisting,
  onCreated,
}) => {
  const isEditMode = Boolean(borrowerToEdit);

  // Form Fields
  const [role, setRole] = useState<BorrowerRole>('Student');
  const [universityId, setUniversityId] = useState('');
  const [name, setName] = useState('');
  const [nameUrdu, setNameUrdu] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [customDept, setCustomDept] = useState('');
  
  // Student Specific
  const [rollNumber, setRollNumber] = useState('');
  const [degreeLevel, setDegreeLevel] = useState('BS');
  const [studyMode, setStudyMode] = useState('Regular');
  const [program, setProgram] = useState('Computer Science');
  const [session, setSession] = useState('FA23');
  const [semester, setSemester] = useState<number>(1);

  // Faculty / Staff Specific
  const [employeeNo, setEmployeeNo] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');

  // General Fields
  const [bloodGroup, setBloodGroup] = useState('Unknown');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [joinedDate, setJoinedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [borrowLimit, setBorrowLimit] = useState(3);
  const [status, setStatus] = useState<BorrowerStatus>('active');
  const [notes, setNotes] = useState('');

  // UI & Validation States
  const [idPatternWarning, setIdPatternWarning] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<{ message: string; existingId?: string; existingName?: string } | null>(null);
  const [samePersonWarning, setSamePersonWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Card Preview States
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Photo Crop Modal State
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Last entered values (for "Save & Next" & "Same as above")
  const [lastSaved, setLastSaved] = useState<Record<string, any>>(() => {
    try {
      const data = localStorage.getItem(LAST_SAVED_VALUES_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  });

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Load draft or populate for edit
  useEffect(() => {
    if (!isOpen) return;

    if (borrowerToEdit) {
      setRole(borrowerToEdit.role || 'Student');
      setUniversityId(borrowerToEdit.university_id || borrowerToEdit.student_id || '');
      setName(borrowerToEdit.name || '');
      setNameUrdu(borrowerToEdit.name_urdu || '');
      setFatherName(borrowerToEdit.father_name || '');
      setDepartment(borrowerToEdit.department || 'Computer Science');
      setRollNumber(borrowerToEdit.roll_number || '');
      setDegreeLevel(borrowerToEdit.degree_level || 'BS');
      setStudyMode(borrowerToEdit.study_mode || 'Regular');
      setProgram(borrowerToEdit.program || '');
      setSession(borrowerToEdit.session || '');
      setSemester(borrowerToEdit.semester || 1);
      setEmployeeNo(borrowerToEdit.employee_no || '');
      setDesignation(borrowerToEdit.designation || 'Assistant Professor');
      setBloodGroup(borrowerToEdit.blood_group || 'Unknown');
      setPhone(borrowerToEdit.phone || '');
      setEmail(borrowerToEdit.email || '');
      setAddress(borrowerToEdit.address || '');
      setPhotoUrl(borrowerToEdit.photo_url || borrowerToEdit.photo_path || '');
      setJoinedDate(borrowerToEdit.joined_date || new Date().toISOString().split('T')[0]);
      setValidUntil(borrowerToEdit.valid_until || '');
      setBorrowLimit(borrowerToEdit.borrow_limit || (borrowerToEdit.role === 'Faculty' ? 10 : borrowerToEdit.role === 'Staff' ? 5 : 3));
      setStatus(borrowerToEdit.status || 'active');
      setNotes(borrowerToEdit.notes || '');
      setDuplicateError(null);
      setSamePersonWarning(null);
      setFormError(null);
    } else {
      // Check saved draft
      try {
        const draftStr = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draftStr) {
          const draft = JSON.parse(draftStr);
          setRole(draft.role || 'Student');
          setUniversityId(draft.universityId || '');
          setName(draft.name || '');
          setNameUrdu(draft.nameUrdu || '');
          setFatherName(draft.fatherName || '');
          setDepartment(draft.department || 'Computer Science');
          setRollNumber(draft.rollNumber || '');
          setDegreeLevel(draft.degreeLevel || 'BS');
          setStudyMode(draft.studyMode || 'Regular');
          setProgram(draft.program || 'Computer Science');
          setSession(draft.session || 'FA23');
          setSemester(draft.semester || 1);
          setEmployeeNo(draft.employeeNo || '');
          setDesignation(draft.designation || 'Assistant Professor');
          setBloodGroup(draft.bloodGroup || 'Unknown');
          setPhone(draft.phone || '');
          setEmail(draft.email || '');
          setAddress(draft.address || '');
          setPhotoUrl(draft.photoUrl || '');
          setJoinedDate(draft.joinedDate || new Date().toISOString().split('T')[0]);
          setValidUntil(draft.validUntil || computeStudentValidUntil(draft.session || 'FA23', draft.degreeLevel || 'BS'));
          setBorrowLimit(draft.borrowLimit || 3);
          setStatus(draft.status || 'active');
          setNotes(draft.notes || '');
        } else {
          resetNewForm();
        }
      } catch {
        resetNewForm();
      }
    }
  }, [isOpen, borrowerToEdit]);

  const resetNewForm = () => {
    setRole('Student');
    setUniversityId('');
    setName('');
    setNameUrdu('');
    setFatherName('');
    setDepartment('Computer Science');
    setRollNumber('');
    setDegreeLevel('BS');
    setStudyMode('Regular');
    setProgram('Computer Science');
    setSession('FA23');
    setSemester(1);
    setEmployeeNo('');
    setDesignation('Assistant Professor');
    setBloodGroup('Unknown');
    setPhone('');
    setEmail('');
    setAddress('');
    setPhotoUrl('');
    setJoinedDate(new Date().toISOString().split('T')[0]);
    setValidUntil(computeStudentValidUntil('FA23', 'BS'));
    setBorrowLimit(3);
    setStatus('active');
    setNotes('');
    setDuplicateError(null);
    setSamePersonWarning(null);
    setFormError(null);
  };

  // Auto-compute valid until when session or degree level changes in student mode (if user hasn't typed a custom override)
  const handleSessionChange = (newSession: string) => {
    setSession(newSession);
    if (role === 'Student' && !borrowerToEdit) {
      setValidUntil(computeStudentValidUntil(newSession, degreeLevel));
    }
  };

  const handleDegreeLevelChange = (newDegree: string) => {
    setDegreeLevel(newDegree);
    if (role === 'Student' && !borrowerToEdit) {
      setValidUntil(computeStudentValidUntil(session, newDegree));
    }
  };

  // Save draft on change when adding new
  useEffect(() => {
    if (!isOpen || isEditMode) return;
    const draft = {
      role,
      universityId,
      name,
      nameUrdu,
      fatherName,
      department,
      rollNumber,
      degreeLevel,
      studyMode,
      program,
      session,
      semester,
      employeeNo,
      designation,
      bloodGroup,
      phone,
      email,
      address,
      photoUrl,
      joinedDate,
      validUntil,
      borrowLimit,
      status,
      notes,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    isOpen,
    isEditMode,
    role,
    universityId,
    name,
    nameUrdu,
    fatherName,
    department,
    rollNumber,
    degreeLevel,
    studyMode,
    program,
    session,
    semester,
    employeeNo,
    designation,
    bloodGroup,
    phone,
    email,
    address,
    photoUrl,
    joinedDate,
    validUntil,
    borrowLimit,
    status,
    notes,
  ]);

  // Adjust default limit when role changes
  const handleRoleChange = (newRole: BorrowerRole) => {
    setRole(newRole);
    if (!isEditMode) {
      if (newRole === 'Faculty') {
        setBorrowLimit(10);
        setValidUntil('');
      } else if (newRole === 'Staff') {
        setBorrowLimit(5);
        setValidUntil('');
      } else {
        setBorrowLimit(3);
        setValidUntil(computeStudentValidUntil(session, degreeLevel));
      }
    }
  };

  // Auto-fill Session and Program from University ID pattern
  const handleUniversityIdChange = (raw: string) => {
    setUniversityId(raw);
    setDuplicateError(null);

    const trimmed = raw.trim();
    if (!trimmed) {
      setIdPatternWarning(null);
      return;
    }

    const match = trimmed.match(/^ULM-([A-Z]{2}\d{2})-([A-Z]+)-(\d{3,4})$/i);
    if (match) {
      setIdPatternWarning(null);
      if (role === 'Student') {
        const detectedSession = match[1].toUpperCase();
        const detectedProgram = match[2].toUpperCase();
        setSession(detectedSession);
        setProgram(detectedProgram);
        setValidUntil(computeStudentValidUntil(detectedSession, degreeLevel));
      }
    } else {
      setIdPatternWarning('Format note: Standard student ID follows pattern ULM-FA23-BCS-042 (Faculty & Staff IDs may vary).');
    }

    // Live duplicate check
    const existing = allBorrowers.find(
      b => (b.university_id || b.student_id).trim().toUpperCase() === trimmed.toUpperCase() && 
           b.status !== 'left' &&
           (!borrowerToEdit || b.id !== borrowerToEdit.id)
    );
    if (existing) {
      setDuplicateError({
        message: `Already exists: ${existing.name}`,
        existingId: existing.id,
        existingName: existing.name
      });
    }
  };

  // Name & Phone similarity warning
  useEffect(() => {
    if (!name.trim() || !phone.trim()) {
      setSamePersonWarning(null);
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 7) {
      const match = allBorrowers.find(
        b => b.name.toLowerCase().trim() === name.toLowerCase().trim() &&
             b.phone.replace(/\D/g, '') === cleanPhone &&
             (!borrowerToEdit || b.id !== borrowerToEdit.id)
      );
      if (match) {
        setSamePersonWarning(`Notice: A borrower with name "${match.name}" and phone "${match.phone}" is already in database (${match.university_id}).`);
      } else {
        setSamePersonWarning(null);
      }
    } else {
      setSamePersonWarning(null);
    }
  }, [name, phone, allBorrowers, borrowerToEdit]);

  // Browse photo and open Drag-and-Zoom Crop Modal
  const handlePhotoBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      if (rawData) {
        setRawPhotoToCrop(rawData);
        setIsCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // "Same as above" helper: copies value from last saved entry
  const applySameAsAbove = (field: string) => {
    if (field in lastSaved && lastSaved[field] !== undefined) {
      const val = lastSaved[field];
      if (field === 'role') handleRoleChange(val);
      else if (field === 'department') setDepartment(val);
      else if (field === 'degreeLevel') handleDegreeLevelChange(val);
      else if (field === 'studyMode') setStudyMode(val);
      else if (field === 'program') setProgram(val);
      else if (field === 'session') handleSessionChange(val);
      else if (field === 'semester') setSemester(val);
      else if (field === 'bloodGroup') setBloodGroup(val);
      else if (field === 'validUntil') setValidUntil(val);
      else if (field === 'borrowLimit') setBorrowLimit(val);
      else if (field === 'designation') setDesignation(val);
      else if (field === 'address') setAddress(val);
    }
  };

  // Pakistani phone normalizer
  const normalizePakistaniPhone = (raw: string): string => {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('92') && digits.length >= 12) {
      digits = '0' + digits.substring(2);
    }
    if (digits.length === 11 && digits.startsWith('03')) {
      return `${digits.substring(0, 4)}-${digits.substring(4)}`;
    }
    return raw.trim();
  };

  // Collect & Validate
  const handleSave = (isSaveAndNext: boolean = false) => {
    setFormError(null);

    if (!universityId.trim()) {
      setFormError('University ID is required.');
      return;
    }
    if (!name.trim()) {
      setFormError('Full Name is required.');
      return;
    }
    if (!department.trim()) {
      setFormError('Department is required.');
      return;
    }

    // Phone validation
    const normPhone = normalizePakistaniPhone(phone);
    if (phone.trim() && !/^(\+92\s?3\d{2}|03\d{2})[- ]?\d{7}$/.test(phone.trim())) {
      setFormError('Please enter a valid Pakistani phone number format (03XX-XXXXXXX or +92 3XX XXXXXXX).');
      return;
    }

    // Email validation
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter a valid university email address.');
      return;
    }

    // Check duplicate ID again
    const dup = allBorrowers.find(
      b => (b.university_id || b.student_id).trim().toUpperCase() === universityId.trim().toUpperCase() &&
           b.status !== 'left' &&
           (!borrowerToEdit || b.id !== borrowerToEdit.id)
    );
    if (dup) {
      setDuplicateError({
        message: `Already exists: ${dup.name}`,
        existingId: dup.id,
        existingName: dup.name
      });
      return;
    }

    const borrowerPayload = {
      role,
      university_id: universityId.trim().toUpperCase(),
      barcode: universityId.trim().toUpperCase(),
      name: name.trim(),
      name_urdu: nameUrdu.trim() || undefined,
      father_name: role === 'Student' ? fatherName.trim() : undefined,
      department: department.trim(),
      roll_number: role === 'Student' ? (rollNumber.trim() || undefined) : undefined,
      degree_level: role === 'Student' ? degreeLevel : undefined,
      study_mode: role === 'Student' ? studyMode : undefined,
      program: role === 'Student' ? program.trim() : (role === 'Faculty' ? 'Faculty' : 'Staff'),
      session: role === 'Student' ? session.trim().toUpperCase() : undefined,
      semester: role === 'Student' ? semester : null,
      employee_no: role !== 'Student' ? (employeeNo.trim() || undefined) : undefined,
      designation: role !== 'Student' ? designation.trim() : undefined,
      blood_group: bloodGroup !== 'Unknown' ? bloodGroup : undefined,
      phone: normPhone || '0300-0000000',
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      photo_url: photoUrl || undefined,
      photo_path: photoUrl || undefined,
      joined_date: joinedDate || new Date().toISOString().split('T')[0],
      valid_until: validUntil ? validUntil : null,
      borrow_limit: borrowLimit,
      status,
      notes: notes.trim() || undefined,
      student_id: universityId.trim().toUpperCase(),
    };

    if (isEditMode && borrowerToEdit && onUpdate) {
      const res = onUpdate(borrowerToEdit.id, borrowerPayload);
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      onClose();
    } else {
      const res = onSave(borrowerPayload);
      if (!res.success) {
        setFormError(res.message);
        if (res.existingBorrowerId) {
          setDuplicateError({
            message: res.message,
            existingId: res.existingBorrowerId
          });
        }
        return;
      }

      // Save fields to memory for "Save & Next" and "Same as above"
      const remembered = {
        role,
        department,
        degreeLevel,
        studyMode,
        program,
        session,
        semester,
        bloodGroup,
        validUntil,
        borrowLimit,
        designation,
        address,
      };
      setLastSaved(remembered);
      try {
        localStorage.setItem(LAST_SAVED_VALUES_KEY, JSON.stringify(remembered));
      } catch {
        // ignore
      }

      if (res.borrower && onCreated) {
        onCreated(res.borrower);
      }

      if (isSaveAndNext) {
        setUniversityId('');
        setName('');
        setNameUrdu('');
        setRollNumber('');
        setEmployeeNo('');
        setFatherName('');
        setPhone('');
        setEmail('');
        setPhotoUrl('');
        setNotes('');
        setDuplicateError(null);
        setSamePersonWarning(null);
        setFormError(null);
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
      } else {
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
        onClose();
      }
    }
  };

  // Keyboard navigation: Enter = "Save & Next" when adding
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (isEditMode) {
        handleSave(false);
      } else {
        handleSave(true);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Live Card Preview Data Object
  const previewMember: Borrower = useMemo(() => {
    const uid = universityId.trim().toUpperCase() || 'ULM-FA23-BCS-042';
    return {
      id: borrowerToEdit?.id || 'temp-preview',
      role,
      university_id: uid,
      barcode: uid,
      name: name.trim() || 'Muhammad Bilal Ahmad',
      name_urdu: nameUrdu.trim(),
      father_name: fatherName.trim(),
      department: department.trim() || 'Computer Science',
      roll_number: role === 'Student' ? (rollNumber.trim() || 'BSCS-23-42') : undefined,
      degree_level: degreeLevel,
      study_mode: studyMode,
      program: role === 'Student' ? (program.trim() || 'Computer Science') : role,
      session: role === 'Student' ? (session.trim() || 'FA23') : undefined,
      semester: role === 'Student' ? semester : null,
      employee_no: role !== 'Student' ? (employeeNo.trim() || uid) : undefined,
      designation: role !== 'Student' ? designation : undefined,
      blood_group: bloodGroup !== 'Unknown' ? bloodGroup : 'O+',
      phone: phone || '0300-1234567',
      email: email || undefined,
      address: address || undefined,
      photo_url: photoUrl || undefined,
      photo_path: photoUrl || undefined,
      joined_date: joinedDate,
      valid_until: validUntil || (role === 'Student' ? '2027-06-30' : 'PERMANENT'),
      borrow_limit: borrowLimit,
      status,
      notes: notes || undefined,
      student_id: uid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };
  }, [
    borrowerToEdit,
    role,
    universityId,
    name,
    nameUrdu,
    fatherName,
    department,
    rollNumber,
    degreeLevel,
    studyMode,
    program,
    session,
    semester,
    employeeNo,
    designation,
    bloodGroup,
    phone,
    email,
    address,
    photoUrl,
    joinedDate,
    validUntil,
    borrowLimit,
    status,
    notes,
  ]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="borrower-dialog-title"
      >
        {/* Dynamic Modal Container (Adapts from single column up to 2-column wide layout) */}
        <div 
          className="w-full max-w-[1140px] bg-[#0B1220] border border-[#334155] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] transition-all text-slate-200"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-3.5 bg-[#020617] border-b border-[#334155] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <UserPlus className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h2 id="borrower-dialog-title" className="text-sm sm:text-base font-bold text-[#F1F5F9] font-cinzel leading-tight tracking-wide">
                  {isEditMode ? 'Edit Library Borrower Profile' : 'Enroll Borrower (Add Person)'}
                </h2>
                <p className="text-[10.5px] text-slate-400 font-sans mt-0.5">
                  Institutional Registration · Smart CR80 Member Identification System
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile Card Preview Toggle Button */}
              <button
                type="button"
                onClick={() => setShowMobilePreview(!showMobilePreview)}
                className="lg:hidden px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card Preview</span>
                {showMobilePreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#F1F5F9] hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Main Content Area: Form on Left + Live Preview on Right (Wide Windows) */}
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
            
            {/* LEFT / FORM COLUMN */}
            <div className="flex-1 p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

              {/* Form Error Banner */}
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Duplicate University ID Blocking Banner */}
              {duplicateError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-600/40 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <span className="font-bold">{duplicateError.message}</span>
                      <p className="text-[11px] text-rose-300/80 mt-0.5">
                        University ID must be strictly unique in the institutional database.
                      </p>
                    </div>
                  </div>
                  {duplicateError.existingId && onOpenExisting && (
                    <button
                      type="button"
                      onClick={() => onOpenExisting(duplicateError.existingId!)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-[#F1F5F9] font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
                    >
                      <span>Open Record</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Same Person Warning (Name + Phone) */}
              {samePersonWarning && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{samePersonWarning}</span>
                </div>
              )}

              {/* Collapsible Mobile Card Preview (Visible only on narrow screens when toggled) */}
              {showMobilePreview && (
                <div className="lg:hidden p-3 rounded-xl bg-[#020617] border border-amber-500/30 flex flex-col items-center gap-3">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-mono text-amber-400 font-bold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Live Member Card
                    </span>
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-700 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setPreviewSide('front')}
                        className={`px-2 py-0.5 rounded ${previewSide === 'front' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                      >
                        Front
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewSide('back')}
                        className={`px-2 py-0.5 rounded ${previewSide === 'back' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto w-full flex justify-center py-1">
                    <MemberCard member={previewMember} side={previewSide} />
                  </div>
                </div>
              )}

              {/* Top Segmented Selector: [Student | Faculty | Staff] */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">
                  People Type / Institutional Role <span className="text-amber-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2 bg-[#020617] p-1.5 rounded-xl border border-[#334155]">
                  {(['Student', 'Faculty', 'Staff'] as BorrowerRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        role === r
                          ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-400'
                          : 'text-slate-400 hover:text-[#F1F5F9] hover:bg-slate-800/60'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{r}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. University ID & Blood Group Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200 tracking-wide">
                      University ID (Unique Barcode ID) <span className="text-amber-500">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-amber-400/90">Card ID NO</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={universityId}
                    onChange={(e) => handleUniversityIdChange(e.target.value)}
                    placeholder="e.g. ULM-FA23-BCS-042"
                    className="w-full bg-[#020617] border border-[#334155] rounded-xl px-3.5 py-2 text-xs font-mono text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs transition-colors"
                  />
                  {idPatternWarning && (
                    <p className="text-[10px] text-amber-400/90 mt-1 leading-tight font-sans">
                      {idPatternWarning}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200 tracking-wide">
                      Blood Group
                    </label>
                    <button
                      type="button"
                      onClick={() => applySameAsAbove('bloodGroup')}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Same
                    </button>
                  </div>
                  <CustomSelect
                    value={bloodGroup}
                    onChange={(val) => setBloodGroup(String(val))}
                    options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
                    compact
                  />
                </div>
              </div>

              {/* 2. Full Name (English) & Name in Urdu (اردو نام) Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200 tracking-wide">
                      Full Name (English) <span className="text-amber-500">*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Muhammad Bilal Ahmad"
                    className="w-full bg-[#020617] border border-[#334155] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-amber-300/90 tracking-wide">
                      Name in Urdu (اردو نام)
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">Card Header RTL</span>
                  </div>
                  <input
                    type="text"
                    dir="rtl"
                    value={nameUrdu}
                    onChange={(e) => setNameUrdu(e.target.value)}
                    placeholder="محمد بلال احمد"
                    className="w-full bg-[#020617] border border-[#334155] rounded-xl px-3.5 py-2 text-sm text-amber-300 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs font-urdu transition-colors"
                    style={{ fontFamily: 'var(--font-urdu)' }}
                  />
                </div>
              </div>

              {/* 3. STUDENT ACADEMIC PROFILE (Only for students) */}
              {role === 'Student' && (
                <div className="p-4 rounded-xl bg-[#020617] border border-amber-500/25 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Student Academic Profile
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        applySameAsAbove('degreeLevel');
                        applySameAsAbove('studyMode');
                        applySameAsAbove('program');
                        applySameAsAbove('session');
                        applySameAsAbove('semester');
                      }}
                      className="text-[10.5px] font-mono text-amber-400/90 hover:text-amber-300 underline cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Same as previous student
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Roll Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-300">Roll Number</label>
                        <span className="text-[10px] font-mono text-slate-500">e.g. BSCS-23-42</span>
                      </div>
                      <input
                        type="text"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        placeholder="BSCS-23-42"
                        className="w-full bg-[#0B1220] border border-[#334155] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Degree Level */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-300">Degree Level</label>
                        <button
                          type="button"
                          onClick={() => applySameAsAbove('degreeLevel')}
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Same
                        </button>
                      </div>
                      <CustomSelect
                        value={degreeLevel}
                        onChange={(val) => handleDegreeLevelChange(String(val))}
                        options={DEGREE_LEVELS.map((d) => ({ value: d, label: d }))}
                        compact
                      />
                    </div>

                    {/* Study Mode */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-300">Study Mode</label>
                        <button
                          type="button"
                          onClick={() => applySameAsAbove('studyMode')}
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Same
                        </button>
                      </div>
                      <CustomSelect
                        value={studyMode}
                        onChange={(val) => setStudyMode(String(val))}
                        options={STUDY_MODES}
                        compact
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Degree Program */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-300">Degree Program</label>
                        <button
                          type="button"
                          onClick={() => applySameAsAbove('program')}
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Same
                        </button>
                      </div>
                      <input
                        type="text"
                        value={program}
                        onChange={(e) => setProgram(e.target.value)}
                        placeholder="e.g. Computer Science, Physics, LLB"
                        className="w-full bg-[#0B1220] border border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Academic Session */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-300">Session (e.g. FA23)</label>
                        <button
                          type="button"
                          onClick={() => applySameAsAbove('session')}
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Same
                        </button>
                      </div>
                      <input
                        type="text"
                        value={session}
                        onChange={(e) => handleSessionChange(e.target.value)}
                        placeholder="e.g. FA23, SP24"
                        className="w-full bg-[#0B1220] border border-[#334155] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Current Semester */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-300">Semester (1-8)</label>
                        <button
                          type="button"
                          onClick={() => applySameAsAbove('semester')}
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Same
                        </button>
                      </div>
                      <CustomSelect
                        value={semester}
                        onChange={(val) => setSemester(Number(val))}
                        options={[1, 2, 3, 4, 5, 6, 7, 8].map(s => ({ value: s, label: `Semester ${s}` }))}
                        compact
                      />
                    </div>
                  </div>

                  {/* Father Name */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">
                      Father Name
                    </label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="e.g. Gulzar Ahmad"
                      className="w-full bg-[#0B1220] border border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* 4. FACULTY / STAFF PROFILE (Only for Faculty and Staff) */}
              {role !== 'Student' && (
                <div className="p-4 rounded-xl bg-[#020617] border border-blue-500/25 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                      {role} Institutional Appointment &amp; Employee Details
                    </span>
                    <button
                      type="button"
                      onClick={() => applySameAsAbove('designation')}
                      className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                    >
                      Same as above
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Designation Rank
                      </label>
                      <CustomSelect
                        value={designation}
                        onChange={(val) => setDesignation(val)}
                        options={FACULTY_STAFF_DESIGNATIONS.map((d) => ({ value: d, label: d }))}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Employee No / Staff ID
                      </label>
                      <input
                        type="text"
                        value={employeeNo}
                        onChange={(e) => setEmployeeNo(e.target.value)}
                        placeholder="e.g. EMP-1042 or ULM-FAC-05"
                        className="w-full bg-[#0B1220] border border-[#334155] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Department Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-200 tracking-wide">
                    Department <span className="text-amber-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => applySameAsAbove('department')}
                    className="text-[10.5px] font-mono text-amber-400 hover:underline cursor-pointer"
                  >
                    Same as above
                  </button>
                </div>

                <CustomSelect
                  value={department}
                  onChange={(val) => setDepartment(val)}
                  options={Array.from(new Set([...DEFAULT_DEPARTMENTS, ...(customDept ? [customDept] : [])])).map((d) => ({ value: d, label: d }))}
                  searchable
                  allowAdd
                  onAddNew={(newDept) => {
                    setCustomDept(newDept);
                    setDepartment(newDept);
                  }}
                  addNewPlaceholder="Type new department name..."
                />
              </div>

              {/* 6. Phone & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200 tracking-wide">
                      Mobile Phone (Pakistani)
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">03XX-XXXXXXX</span>
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300-1234567 or +92 300..."
                    className="w-full bg-[#020617] border border-[#334155] rounded-xl px-3.5 py-2 text-xs font-mono text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200 tracking-wide">
                      University Email (Optional)
                    </label>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@ulm.edu.pk"
                    className="w-full bg-[#020617] border border-[#334155] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs transition-colors"
                  />
                </div>
              </div>

              {/* 7. Address */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-200 tracking-wide">
                    Campus / Residential Address
                  </label>
                  <button
                    type="button"
                    onClick={() => applySameAsAbove('address')}
                    className="text-[10.5px] font-mono text-amber-400 hover:underline cursor-pointer"
                  >
                    Same as above
                  </button>
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Hostels / Lakki Marwat Campus Address"
                  className="w-full bg-[#020617] border border-[#334155] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs transition-colors"
                />
              </div>

              {/* 8. Photo Upload with Drag & Zoom 4:5 Crop */}
              <div className="p-3.5 rounded-xl bg-[#020617] border border-[#334155] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-[70px] rounded-lg overflow-hidden bg-slate-900 border-2 border-amber-500/40 flex items-center justify-center shrink-0 shadow-xs">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-[9px] font-mono text-slate-500 text-center p-1 leading-tight">
                        4:5 Portrait (300×375)
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#F1F5F9] block">
                      Member Portrait Photo (4:5 Crop, 300 × 375 px)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Drag-and-zoom crop ready for CR80 Smart Card printing
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoBrowse}
                    className="hidden"
                    id="borrower-modal-photo-input"
                  />
                  <label
                    htmlFor="borrower-modal-photo-input"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-[#334155] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-500" />
                    <span>{photoUrl ? 'Change...' : 'Browse...'}</span>
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 cursor-pointer"
                      title="Remove photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 9. Joined Date, Valid Until, Limit, Status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Joined Date
                  </label>
                  <input
                    type="date"
                    value={joinedDate}
                    onChange={(e) => setJoinedDate(e.target.value)}
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">Valid Until</label>
                    <button
                      type="button"
                      onClick={() => applySameAsAbove('validUntil')}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Same
                    </button>
                  </div>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">Borrow Limit</label>
                    <button
                      type="button"
                      onClick={() => applySameAsAbove('borrowLimit')}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Same
                    </button>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={borrowLimit}
                    onChange={(e) => setBorrowLimit(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9] focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Status
                  </label>
                  <CustomSelect
                    value={status}
                    onChange={(val) => setStatus(val as BorrowerStatus)}
                    options={[
                      { value: 'active', label: 'Active', badge: 'Normal' },
                      { value: 'suspended', label: 'Suspended', badge: 'Blocked' },
                      { value: 'left', label: 'Left', badge: 'Archived' }
                    ]}
                    compact
                  />
                </div>
              </div>

              {/* 10. Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 tracking-wide">
                  Institutional Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Verified by HOD, special library clearance, or remarks..."
                  className="w-full bg-[#020617] border border-[#334155] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>

            </div>

            {/* RIGHT COLUMN: DEDICATED LIVE CARD PREVIEW (Wide Windows: lg+) */}
            <div className="hidden lg:flex w-[440px] bg-[#070B14] border-l border-[#334155] p-5 flex-col items-center justify-between shrink-0">
              <div className="w-full space-y-4">
                {/* Preview Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white font-cinzel leading-none">
                        Live Card Preview
                      </h4>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        Updates in real-time as you type
                      </p>
                    </div>
                  </div>

                  {/* Side Switcher */}
                  <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewSide('front')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        previewSide === 'front'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Front
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSide('back')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        previewSide === 'back'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Back
                    </button>
                  </div>
                </div>

                {/* Scaled Preview Wrapper (Center 398 × 227 card) */}
                <div className="py-2 flex justify-center items-center">
                  <div className="transition-transform duration-200 hover:scale-[1.02]">
                    <MemberCard member={previewMember} side={previewSide} />
                  </div>
                </div>

                {/* Spec Highlights Checklist */}
                <div className="bg-[#020617] rounded-xl p-3 border border-slate-800 text-[10.5px] font-mono text-slate-300 space-y-1.5">
                  <div className="text-amber-400 font-bold uppercase text-[10px] tracking-wider pb-1 border-b border-slate-800 flex items-center justify-between">
                    <span>Card Specifications</span>
                    <span className="text-[9px] text-slate-400 font-normal">CR80 7:4</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Card ID:</span>
                    <span className="text-amber-300 font-bold">{previewMember.university_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cardholder:</span>
                    <span className="text-slate-100 truncate max-w-[190px]">{previewMember.name}</span>
                  </div>
                  {previewMember.name_urdu && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">اردو نام:</span>
                      <span className="text-amber-300 font-urdu">{previewMember.name_urdu}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expiry / Valid:</span>
                    <span className="text-slate-200 font-semibold">{previewMember.valid_until || 'PERMANENT'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Circulation Limit:</span>
                    <span className="text-emerald-400 font-bold">{previewMember.borrow_limit} Books</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 text-center font-sans pt-2">
                CR80 Dual-Sided Thermal PVC Print Ready
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="px-5 sm:px-6 py-3.5 bg-[#020617] border-t border-[#334155] flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-slate-500">
              {isEditMode ? 'Editing Borrower Profile' : 'Tip: Press [Enter] for rapid "Save & Next"'}
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {!isEditMode && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={Boolean(duplicateError)}
                  className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="Save this record and keep role, department and class context ready for the next person"
                >
                  <span>Save &amp; Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={Boolean(duplicateError)}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {isEditMode ? 'Save Changes' : 'Save & Close'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Photo Crop Modal (Drag-and-Zoom 4:5 Portrait Crop) */}
      <PhotoCropModal
        isOpen={isCropModalOpen}
        imageSrc={rawPhotoToCrop || ''}
        onCropComplete={(croppedData) => {
          setPhotoUrl(croppedData);
        }}
        onClose={() => {
          setIsCropModalOpen(false);
          setRawPhotoToCrop(null);
        }}
      />
    </>
  );
};

export default AddEditBorrowerModal;
