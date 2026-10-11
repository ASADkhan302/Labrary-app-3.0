import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  BookOpen, 
  Save, 
  Sparkles, 
  AlertCircle, 
  Barcode as BarcodeIcon,
  MapPin,
  Layers,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Link2,
  CheckCircle2,
  FileText,
  Palette,
  Loader2,
  Check,
  RotateCcw,
  Zap,
  Info,
  ShieldCheck,
  ChevronDown,
  Hash,
  DollarSign,
  Bookmark,
  Calendar
} from 'lucide-react';
import { Book, BookGroup, Almari } from '../../types/library';
import { LibraryStorage } from '../../services/storage';
import { BarcodeService } from '../../services/barcodeService';
import { BookSheetService } from '../../services/bookSheetService';
import { AlmariService } from '../../services/almariService';
import CustomSelect from '../ui/CustomSelect';
import { getTodayIso, formatDisplayDate, normalizeDateAdded } from '../../utils/dateUtils';
import { isArabicOrUrduScript, sanitizeBidiOverrides } from '../../utils/urduUtils';

interface AddEditBookModalProps {
  isOpen: boolean;
  bookToEdit?: Book | null;
  initialBarcode?: string;
  onClose: () => void;
  onSave: (bookData: Omit<Book, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => { success: boolean; message: string };
  onUpdate: (id: string, updates: Partial<Book>) => { success: boolean; message: string };
  onDelete?: (book: Book) => void;
}

// Curated academic presets for 1-click book covers
const PRESET_COVERS = [
  {
    name: 'CS / Cyber',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
    theme: 'Deep Navy & Cyber'
  },
  {
    name: 'Algorithms',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
    theme: 'Amber & Charcoal'
  },
  {
    name: 'Mathematics',
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80',
    theme: 'Emerald & Sage'
  },
  {
    name: 'Physics & Law',
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
    theme: 'Crimson & Slate'
  }
];

const CATEGORY_OPTIONS = [
  'Computer Science',
  'Physics',
  'Mathematics',
  'Chemistry',
  'Law',
  'Islamic Studies',
  'English Literature',
  'Pakistan History',
  'Civil Engineering',
  'General Reference'
];

export const AddEditBookModal: React.FC<AddEditBookModalProps> = ({
  isOpen,
  bookToEdit,
  initialBarcode,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}) => {
  // Official Accession Register Fields in Paper Sequence
  const [accessionNo, setAccessionNo] = useState<string>('1');
  const [accessionNotice, setAccessionNotice] = useState<string | null>(null);
  const [accessionError, setAccessionError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string>('ULM-00001');
  const [author, setAuthor] = useState<string>('');
  const [bookName, setBookName] = useState<string>('');
  const [edition, setEdition] = useState<string>('1st Edition');
  const [place, setPlace] = useState<string>('Lakki Marwat');
  const [publisher, setPublisher] = useState<string>('ULM Press');
  const [publicationYear, setPublicationYear] = useState<number>(2024);
  const [pages, setPages] = useState<string>('480');
  const [priceRs, setPriceRs] = useState<string>('850');
  const [pricePs, setPricePs] = useState<string>('00');
  const [binding, setBinding] = useState<string>('HB'); // HB, SB, Other
  const [bindingCode, setBindingCode] = useState<string>('01');
  const [isbn, setIsbn] = useState<string>('');
  const [sourceRemarks, setSourceRemarks] = useState<string>('University Purchase');
  const [dateAdded, setDateAdded] = useState<string>(getTodayIso());
  const [dateAddedRaw, setDateAddedRaw] = useState<string>(formatDisplayDate(getTodayIso()));
  const [dateAddedError, setDateAddedError] = useState<string | null>(null);

  // Classification & Archival Coordinates
  const [category, setCategory] = useState<string>('Computer Science');
  const [deweyCallNumber, setDeweyCallNumber] = useState<string>('005.133 ULM');
  const [shelf, setShelf] = useState<string>('CS-Rack-01');
  const [row, setRow] = useState<string>('A-1');
  const [section, setSection] = useState<string>('Main Stacks');
  const [language, setLanguage] = useState<string>('English');
  const [titleRoman, setTitleRoman] = useState<string>('');
  const [authorRoman, setAuthorRoman] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Book Groups & Almaris (Phase 1)
  const [groupId, setGroupId] = useState<string>('');
  const [almariId, setAlmariId] = useState<string>('');
  const [shelfNo, setShelfNo] = useState<number>(1);
  const [suggestedNotice, setSuggestedNotice] = useState<string | null>(null);

  // Media & Inventory
  const [totalQuantity, setTotalQuantity] = useState<number>(3);
  const [availableQuantity, setAvailableQuantity] = useState<number>(3);
  const [bookImagePath, setBookImagePath] = useState<string>('');

  // Form UI states
  const [fastEntryMode, setFastEntryMode] = useState<boolean>(true);
  const [showMediaStudio, setShowMediaStudio] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isbnWarning, setIsbnWarning] = useState<string | null>(null);
  const [isDuplicateIsbn, setIsDuplicateIsbn] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'success'>('idle');

  // Autocomplete lists from library catalog
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [publisherSuggestions, setPublisherSuggestions] = useState<string[]>([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize or reload data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const allBooks = LibraryStorage.getBooks();

    // Extract distinct suggestions
    const authors = Array.from(new Set(allBooks.map(b => b.author).filter(Boolean))).slice(0, 8);
    const publishers = Array.from(new Set(allBooks.map(b => b.publisher).filter(Boolean))).slice(0, 8);
    const places = Array.from(new Set(['Lakki Marwat', 'Peshawar', 'Islamabad', 'Lahore', 'Karachi', 'Cambridge, MA', 'Oxford', 'New York']));

    setAuthorSuggestions(authors);
    setPublisherSuggestions(publishers);
    setPlaceSuggestions(places);

    if (bookToEdit) {
      // Editing existing book
      const numMatch = bookToEdit.barcode.match(/\d+/);
      const acc = numMatch ? numMatch[0] : '10001';
      setAccessionNo(acc);
      setBarcode(bookToEdit.barcode);
      setIsbn(bookToEdit.isbn || '');
      setBookName(bookToEdit.book_name || '');
      setAuthor(bookToEdit.author || '');
      setPublisher(bookToEdit.publisher || 'ULM Press');
      setCategory(bookToEdit.category || 'Computer Science');
      setEdition(bookToEdit.edition || '1st Edition');
      setPublicationYear(bookToEdit.publication_year || 2024);
      setLanguage(bookToEdit.language || (isArabicOrUrduScript(bookToEdit.book_name) ? 'Urdu' : 'English'));
      setTitleRoman(bookToEdit.title_roman || '');
      setAuthorRoman(bookToEdit.author_roman || '');
      setDescription(bookToEdit.description || '');
      setBookImagePath(bookToEdit.book_image_path || '');
      setTotalQuantity(bookToEdit.total_quantity || 1);
      setAvailableQuantity(bookToEdit.available_quantity || 1);
      setShelf(bookToEdit.shelf || 'CS-Rack-01');
      setRow(bookToEdit.row || 'A-1');
      setSection(bookToEdit.section || 'Main Stacks');
      setDeweyCallNumber(bookToEdit.dewey_call_number || '005.133 ULM');
      setGroupId(bookToEdit.group_id || '');
      setAlmariId(bookToEdit.almari_id || '');
      setShelfNo(bookToEdit.shelf_no || 1);
      const editDate = bookToEdit.date_added || (bookToEdit.created_at ? bookToEdit.created_at.split(' ')[0] : getTodayIso());
      setDateAdded(editDate);
      setDateAddedRaw(formatDisplayDate(editDate));
    } else {
      // New book: Pre-fill automatic accession number per specification
      const nextAccInfo = BookSheetService.getNextAccessionNumber();
      const nextAcc = nextAccInfo.accessionNo;
      const formattedBarcode = initialBarcode || BarcodeService.generateBarcode(nextAcc).barcode;

      // Check last entry memory from localStorage for rapid fast ledger entry
      const lastEntryStr = localStorage.getItem('ulm_lms_last_entry_cache');
      let cachedValues: Partial<{
        place: string;
        publisher: string;
        year: number;
        binding: string;
        bindingCode: string;
        source: string;
        category: string;
        dateAdded: string;
        groupId: string;
        almariId: string;
        shelfNo: number;
      }> = {};

      if (lastEntryStr) {
        try {
          cachedValues = JSON.parse(lastEntryStr);
        } catch {
          // Ignore parse errors
        }
      }

      setAccessionNo(String(nextAcc));
      setBarcode(formattedBarcode);
      setBookName('');
      setAuthor('');
      setEdition('1st Edition');
      setPlace(cachedValues.place || 'Lakki Marwat');
      setPublisher(cachedValues.publisher || 'ULM Press');
      setPublicationYear(cachedValues.year || 2024);
      setPages('350');
      setPriceRs('750');
      setPricePs('00');
      setBinding(cachedValues.binding || 'HB');
      setBindingCode(cachedValues.bindingCode || '01');
      setIsbn(`978-0-${String(nextAcc).slice(-4)}-101-2`);
      setSourceRemarks(cachedValues.source || 'University Purchase');
      const initialDate = cachedValues.dateAdded || getTodayIso();
      setDateAdded(initialDate);
      setDateAddedRaw(formatDisplayDate(initialDate));
      const initialCat = cachedValues.category || 'Computer Science';
      setCategory(initialCat);
      setDeweyCallNumber('005.133 ULM');
      setShelf('CS-Rack-01');
      setRow('A-1');
      setSection('Main Stacks');
      setLanguage('English');

      // Auto-suggest Group & Almari by rules, or keep last group and almari
      let chosenGrpId = cachedValues.groupId || '';
      let chosenAlmId = cachedValues.almariId || '';
      let chosenShelf = cachedValues.shelfNo || 1;

      if (!chosenGrpId) {
        const suggestedGrp = AlmariService.suggestGroup({ category: initialCat, language: 'English' });
        if (suggestedGrp) {
          chosenGrpId = suggestedGrp.id;
          const suggestedLoc = AlmariService.suggestAlmariAndShelf(suggestedGrp.id, allBooks);
          if (suggestedLoc) {
            chosenAlmId = suggestedLoc.almari.id;
            chosenShelf = suggestedLoc.shelf_no;
            setSuggestedNotice(`Suggested: ${suggestedGrp.name_en}, ${suggestedLoc.almari.code}, shelf ${suggestedLoc.shelf_no}`);
          }
        }
      } else if (chosenGrpId && chosenAlmId) {
        const almaris = AlmariService.getAlmaris();
        const grps = AlmariService.getGroups();
        const gName = grps.find(g => g.id === chosenGrpId)?.name_en || '';
        const aCode = almaris.find(a => a.id === chosenAlmId)?.code || '';
        setSuggestedNotice(`Suggested: ${gName}, ${aCode}, shelf ${chosenShelf}`);
      }

      setGroupId(chosenGrpId);
      setAlmariId(chosenAlmId);
      setShelfNo(chosenShelf);
      setDescription('');
      setBookImagePath('');
      setTotalQuantity(3);
      setAvailableQuantity(3);
    }

    setErrorMessage(null);
    setIsbnWarning(null);
    setShowUrlInput(false);
    setTempUrl('');

    // Focus title field for instant keyboard entry
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  }, [bookToEdit, initialBarcode, isOpen]);

  // ISBN checksum and duplicate checker
  useEffect(() => {
    if (!isbn.trim()) {
      setIsbnWarning(null);
      setIsDuplicateIsbn(false);
      return;
    }

    const clean = isbn.replace(/[-\s]/g, '');
    
    // Check duplicates in catalog
    const allBooks = LibraryStorage.getBooks();
    const isDup = allBooks.some(b => 
      b.isbn && b.isbn.replace(/[-\s]/g, '') === clean && (!bookToEdit || b.id !== bookToEdit.id)
    );
    setIsDuplicateIsbn(isDup);

    // Advisory checksum warning (never blocks)
    if (clean.length === 10) {
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(clean[i], 10) * (10 - i);
      }
      const lastChar = clean[9].toUpperCase();
      const lastVal = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
      sum += lastVal;
      if (sum % 11 !== 0) {
        setIsbnWarning('ISBN-10 checksum mismatch (advisory notice)');
      } else {
        setIsbnWarning(null);
      }
    } else if (clean.length === 13) {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(clean[i], 10) * (i % 2 === 0 ? 1 : 3);
      }
      const check = (10 - (sum % 10)) % 10;
      if (check !== parseInt(clean[12], 10)) {
        setIsbnWarning('ISBN-13 checksum mismatch (advisory notice)');
      } else {
        setIsbnWarning(null);
      }
    } else if (clean.length > 0 && clean.length !== 10 && clean.length !== 13) {
      setIsbnWarning('Non-standard ISBN character length (advisory)');
    } else {
      setIsbnWarning(null);
    }
  }, [isbn, bookToEdit]);

  // Sync accession number change with automatic barcode and validation (Section 2)
  const handleAccessionChange = (val: string) => {
    setAccessionNo(val);
    if (val.trim()) {
      const gen = BarcodeService.generateBarcode(val);
      setBarcode(gen.barcode);
      const validation = BookSheetService.validateAccessionNumber(val, bookToEdit?.id);
      if (!validation.valid) {
        setAccessionError(validation.message || 'Duplicate accession number blocked.');
        setAccessionNotice(null);
      } else {
        setAccessionError(null);
        if (validation.message) {
          setAccessionNotice(validation.message);
        } else {
          setAccessionNotice(null);
        }
      }
    } else {
      setAccessionError('Accession number is required.');
      setAccessionNotice(null);
    }
  };

  // Copy values from previous entry ("Same as above" / Ditto)
  const handleDittoField = (field: 'author' | 'publisher' | 'place' | 'edition' | 'category' | 'source' | 'date_added') => {
    const allBooks = LibraryStorage.getBooks();
    if (allBooks.length > 0) {
      const last = allBooks[0];
      if (field === 'author' && last.author) setAuthor(last.author);
      if (field === 'publisher' && last.publisher) setPublisher(last.publisher);
      if (field === 'category' && last.category) setCategory(last.category);
      if (field === 'edition' && last.edition) setEdition(last.edition);
      if (field === 'source') setSourceRemarks('University Purchase');
      if (field === 'date_added') {
        const lastDate = last.date_added || (last.created_at ? last.created_at.split(' ')[0] : getTodayIso());
        setDateAdded(lastDate);
        setDateAddedRaw(formatDisplayDate(lastDate));
        setDateAddedError(null);
      }
    }
  };

  const handleDatePick = (isoVal: string) => {
    if (!isoVal) return;
    setDateAdded(isoVal);
    setDateAddedRaw(formatDisplayDate(isoVal));
    const valRes = normalizeDateAdded(isoVal);
    if (!valRes.valid) {
      setDateAddedError(valRes.error || 'Invalid date');
    } else {
      setDateAddedError(null);
    }
  };

  const handleDateTextChange = (text: string) => {
    setDateAddedRaw(text);
    const valRes = normalizeDateAdded(text);
    if (valRes.valid && valRes.date) {
      setDateAdded(valRes.date);
      setDateAddedError(null);
    } else {
      setDateAddedError(valRes.error || 'Invalid date');
    }
  };

  const handleDateBlur = () => {
    const valRes = normalizeDateAdded(dateAddedRaw);
    if (valRes.valid && valRes.date) {
      setDateAdded(valRes.date);
      setDateAddedRaw(formatDisplayDate(valRes.date));
      setDateAddedError(null);
    } else {
      setDateAddedError(valRes.error || 'Invalid date. Must be real date between 1900 and today.');
    }
  };

  // Process uploaded image file
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    
    setIsProcessingImage(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 500;
        const maxH = 700;
        let width = img.width;
        let height = img.height;

        if (width > maxW || height > maxH) {
          if (width / height > maxW / maxH) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setBookImagePath(compressed);
        }
        setIsProcessingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const executeSave = (isNext: boolean) => {
    if (!bookName.trim()) {
      setErrorMessage('Book Title is mandatory.');
      titleInputRef.current?.focus();
      return;
    }
    if (!barcode.trim()) {
      setErrorMessage('Barcode / Accession is mandatory.');
      return;
    }
    if (accessionError) {
      setErrorMessage(accessionError);
      return;
    }

    const dateRes = normalizeDateAdded(dateAddedRaw || dateAdded);
    if (!dateRes.valid) {
      setDateAddedError(dateRes.error || 'Date Added must be a valid date between 1900 and today.');
      setErrorMessage(dateRes.error || 'Date Added must be a valid date between 1900 and today.');
      setSaveState('idle');
      return;
    }

    setSaveState('loading');

    // Build payload conforming exactly to Book schema
    const payload = {
      barcode: barcode.trim(),
      accession_no: accessionNo.trim(),
      isbn: isbn.trim(),
      book_name: bookName.trim(),
      author: author.trim() || 'Anonymous / Organization',
      publisher: publisher.trim(),
      place: place.trim(),
      binding: binding,
      pages: Number(pages) || 0,
      price: (Number(priceRs) || 0) + ((Number(pricePs) || 0) / 100),
      source_remarks: sourceRemarks.trim(),
      category: category,
      edition: edition.trim(),
      publication_year: Number(publicationYear) || 2024,
      language: language || (isArabicOrUrduScript(bookName) ? 'Urdu' : 'English'),
      title_roman: titleRoman.trim() || undefined,
      author_roman: authorRoman.trim() || undefined,
      description: description.trim(),
      book_image_path: bookImagePath.trim(),
      total_quantity: Number(totalQuantity) || 1,
      available_quantity: Math.min(Number(availableQuantity), Number(totalQuantity)),
      shelf: shelf.trim(),
      row: row.trim(),
      section: section.trim(),
      dewey_call_number: deweyCallNumber.trim(),
      group_id: groupId || null,
      almari_id: almariId || null,
      shelf_no: shelfNo ? Number(shelfNo) : null,
      date_added: dateRes.date!,
    };

    // Cache common fields for fast successive ledger entry (Save & Next keeps the last group and almari)
    try {
      localStorage.setItem('ulm_lms_last_entry_cache', JSON.stringify({
        place,
        publisher,
        year: publicationYear,
        binding,
        bindingCode,
        source: sourceRemarks,
        category,
        dateAdded: dateRes.date!,
        groupId,
        almariId,
        shelfNo: Number(shelfNo) || 1,
      }));
    } catch {
      // Ignore cache storage error
    }

    if (bookToEdit) {
      const res = onUpdate(bookToEdit.id, payload);
      if (!res.success) {
        setErrorMessage(res.message);
        setSaveState('idle');
        return;
      }
    } else {
      const res = onSave(payload);
      if (!res.success) {
        setErrorMessage(res.message);
        setSaveState('idle');
        return;
      }
    }

    setSaveState('success');

    if (isNext && !bookToEdit) {
      // Fast entry next: increment accession, clear title & author, focus title
      setTimeout(() => {
        const nextAccInfo = BookSheetService.getNextAccessionNumber();
        const nextAcc = nextAccInfo.accessionNo;
        setAccessionNo(nextAcc);
        setBarcode(BarcodeService.generateBarcode(nextAcc).barcode);
        setAccessionNotice(null);
        setAccessionError(null);
        setBookName('');
        setAuthor('');
        setIsbn(`978-0-${String(nextAcc).slice(-4)}-101-2`);
        setSaveState('idle');
        setErrorMessage(null);
        titleInputRef.current?.focus();
      }, 500);
    } else {
      setTimeout(() => {
        setSaveState('idle');
        onClose();
      }, 700);
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    // Enter key triggers Save & Next when fastEntryMode is active
    if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      if (fastEntryMode && !bookToEdit) {
        e.preventDefault();
        executeSave(true);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Dialog Window */}
      <div 
        className="w-full max-w-5xl bg-[#0B1220] border border-[#1E293B] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Gold / Amber Accent Hairline on Top */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent shrink-0" />

        {/* 1. INSTITUTIONAL ACCREDITED MODAL HEADER */}
        <div className="px-6 py-4 bg-[#020617] border-b border-[#1E293B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <BookOpen className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-cinzel text-base sm:text-lg font-bold tracking-wider text-[#F1F5F9]">
                  {bookToEdit ? 'EDIT ACCESSION RECORD' : 'ACCESSION REGISTER · NEW VOLUME'}
                </h3>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {bookToEdit ? `RECORD #${accessionNo}` : `ACCESSION #${accessionNo}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5 flex items-center gap-2">
                <span>University of Lakki Marwat</span>
                <span className="text-slate-600">·</span>
                <span>Central Campus Library Accession Ledger</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Fast Entry Switch for Rapid Paper Ledger Transcription */}
            {!bookToEdit && (
              <label 
                title="When active, pressing Enter saves and prepares the next sequential accession number automatically"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0F172A] border border-[#334155] text-xs font-mono cursor-pointer hover:border-amber-500/50 transition-colors"
              >
                <Zap className={`w-3.5 h-3.5 ${fastEntryMode ? 'text-amber-400' : 'text-slate-500'}`} />
                <span className="text-slate-300 font-medium text-[11px]">Save & Next (Enter ↵)</span>
                <input 
                  type="checkbox"
                  checked={fastEntryMode}
                  onChange={(e) => setFastEntryMode(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-[#020617] border-[#334155] cursor-pointer"
                />
              </label>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-slate-400 hover:text-[#F1F5F9] transition-colors border border-[#1E293B] cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. FORM BODY - RE-ENGINEERED WITH CLEAN ACCESSION REGISTER SEQUENCE */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0B1220]">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form Grid */}
          <form onKeyDown={handleFormKeyDown} onSubmit={(e) => { e.preventDefault(); executeSave(false); }} className="space-y-6">

            {/* REGISTER SEQUENCE ROW 1: PRIMARY IDENTITY (ACCESSION, BARCODE, TITLE) */}
            <div className="p-4 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2.5">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Register Identity & Accession Code
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Tab 1 — 3 · Paper Register Order
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* 1. Accession Number */}
                <div className="md:col-span-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span>1. Accession No</span>
                      <span className="text-rose-400">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      tabIndex={1}
                      value={accessionNo}
                      onChange={(e) => handleAccessionChange(e.target.value)}
                      placeholder="e.g. 1"
                      className={`w-full bg-[#020617] border rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-1 ${
                        accessionError
                          ? 'border-rose-500 text-rose-300 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-[#334155] text-amber-400 focus:border-amber-400 focus:ring-amber-400'
                      }`}
                    />
                    <Hash className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                  {accessionError && (
                    <p className="text-[11px] text-rose-400 font-medium animate-in fade-in flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{accessionError}</span>
                    </p>
                  )}
                  {accessionNotice && !accessionError && (
                    <p className="text-[11px] text-amber-400/90 font-medium animate-in fade-in flex items-center gap-1">
                      <Info className="w-3 h-3 shrink-0" />
                      <span>{accessionNotice}</span>
                    </p>
                  )}
                </div>

                {/* Barcode (Auto-derived from Accession No) */}
                <div className="md:col-span-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span>Physical Barcode</span>
                      <span className="text-slate-500 text-[10px]">(Code-128)</span>
                    </label>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#BC881B]/20 text-[#E0B450] border border-[#BC881B]/30">
                      AUTO
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={barcode}
                      placeholder="ULM-00000"
                      className="w-full bg-[#141214] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono font-bold text-[#E0B450] cursor-not-allowed select-all"
                    />
                    <BarcodeIcon className="w-3.5 h-3.5 text-[#B3AABD] absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* 2. Author / Editor */}
                <div className="md:col-span-6 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span>2. Author / Editor / Organization</span>
                      <span className="text-slate-500 text-[10px]">(Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDittoField('author')}
                      title="Clone author from last registered book"
                      className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Same as Above</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    tabIndex={3}
                    dir="auto"
                    style={{ unicodeBidi: 'plaintext' }}
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="e.g. Thomas H. Cormen or علامہ محمد اقبال"
                    list="authors-list"
                    className={`w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 ${
                      isArabicOrUrduScript(author) ? 'font-urdu text-base leading-[2.1]' : ''
                    }`}
                  />
                  <datalist id="authors-list">
                    {authorSuggestions.map((a, i) => (
                      <option key={i} value={a} />
                    ))}
                  </datalist>
                </div>

                {/* 3. Title of the Book (Full Width Focus Field) */}
                <div className="md:col-span-8 space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>3. Title of the Book</span>
                      <span className="text-rose-400 font-bold">*</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      English or Nastaliq Urdu (Auto-Aligns RTL/LTR)
                    </span>
                  </label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    tabIndex={4}
                    dir="auto"
                    style={{ unicodeBidi: 'plaintext' }}
                    value={bookName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBookName(v);
                      if (isArabicOrUrduScript(v) && language === 'English') {
                        setLanguage('Urdu');
                      }
                    }}
                    placeholder="e.g. Introduction to Algorithms or بانگِ درا"
                    className={`w-full bg-[#020617] border border-[#334155] rounded-lg px-3.5 py-2.5 text-base font-semibold text-[#F1F5F9] placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 ${
                      isArabicOrUrduScript(bookName) ? 'font-urdu text-lg leading-[2.1]' : ''
                    }`}
                  />
                </div>

                {/* Language Selector */}
                <div className="md:col-span-4 space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                    <span>Language / زبان</span>
                    {language === 'Urdu' && (
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                        Nastaliq Active
                      </span>
                    )}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25"
                  >
                    <option value="English">English</option>
                    <option value="Urdu">Urdu (اردو)</option>
                    <option value="Arabic">Arabic (العربية)</option>
                    <option value="Pashto">Pashto (پښتو)</option>
                    <option value="Persian">Persian (فارسی)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Optional Romanized Fields (Displayed for Urdu or when activated) */}
                {(language === 'Urdu' || isArabicOrUrduScript(bookName) || isArabicOrUrduScript(author) || titleRoman || authorRoman) && (
                  <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-amber-300 flex items-center justify-between">
                        <span>Title (Roman Urdu / Phonetic Search)</span>
                        <span className="text-[10px] text-amber-400/70">Optional</span>
                      </label>
                      <input
                        type="text"
                        value={titleRoman}
                        onChange={(e) => setTitleRoman(e.target.value)}
                        placeholder="e.g. Bang-e-Dra or Kulliyat-e-Mir"
                        className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-amber-300 flex items-center justify-between">
                        <span>Author (Roman Urdu / Phonetic Search)</span>
                        <span className="text-[10px] text-amber-400/70">Optional</span>
                      </label>
                      <input
                        type="text"
                        value={authorRoman}
                        onChange={(e) => setAuthorRoman(e.target.value)}
                        placeholder="e.g. Allama Iqbal or Mir Taqi Mir"
                        className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* REGISTER SEQUENCE ROW 2: PUBLICATION SPECIFICS (EDITION, PLACE, PUBLISHER, YEAR) */}
            <div className="p-4 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Publication & Imprint Details
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Tab 4 — 7 · Ledger Columns 4 to 7
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* 4. Edition */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    4. Edition
                  </label>
                  <input
                    type="text"
                    tabIndex={5}
                    value={edition}
                    onChange={(e) => setEdition(e.target.value)}
                    placeholder="e.g. 3rd Edition"
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* 5. Place of Publication */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      5. Place
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDittoField('place')}
                      className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Ditto</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    tabIndex={6}
                    dir="auto"
                    style={{ unicodeBidi: 'plaintext' }}
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="e.g. Cambridge, MA or لاہور"
                    list="places-list"
                    className={`w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-400 ${
                      isArabicOrUrduScript(place) ? 'font-urdu leading-[2]' : ''
                    }`}
                  />
                  <datalist id="places-list">
                    {placeSuggestions.map((p, i) => (
                      <option key={i} value={p} />
                    ))}
                  </datalist>
                </div>

                {/* 6. Publisher */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      6. Publisher
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDittoField('publisher')}
                      className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Ditto</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    tabIndex={7}
                    dir="auto"
                    style={{ unicodeBidi: 'plaintext' }}
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    placeholder="e.g. MIT Press or اقبال اکادمی"
                    list="publishers-list"
                    className={`w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-400 ${
                      isArabicOrUrduScript(publisher) ? 'font-urdu leading-[2]' : ''
                    }`}
                  />
                  <datalist id="publishers-list">
                    {publisherSuggestions.map((p, i) => (
                      <option key={i} value={p} />
                    ))}
                  </datalist>
                </div>

                {/* 7. Year (4 digits) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    7. Year (4 Digits)
                  </label>
                  <input
                    type="number"
                    tabIndex={8}
                    min={1800}
                    max={2030}
                    value={publicationYear}
                    onChange={(e) => setPublicationYear(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* REGISTER SEQUENCE ROW 3: PHYSICAL VOLUME (PAGES, PRICE, BINDING, ISBN, SOURCE) */}
            <div className="p-4 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2.5">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Physical Format, Currency & Acquisition
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Tab 8 — 13 · Ledger Columns 8 to 13 (Physical & Acquisition)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4">
                {/* 8. Pages (supports arabic & roman) */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    8. Pages (Arabic / Roman)
                  </label>
                  <input
                    type="text"
                    tabIndex={9}
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                    placeholder="e.g. xxiv, 1292"
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* 9. Price (Dual Box: Rs & Ps) */}
                <div className="md:col-span-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      9. Price (Pakistani Rupees & Paisa)
                    </label>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      Rs {priceRs || '0'}.{pricePs || '00'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400">Rs</span>
                      <input
                        type="text"
                        tabIndex={10}
                        value={priceRs}
                        onChange={(e) => setPriceRs(e.target.value)}
                        placeholder="1250"
                        className="w-full bg-[#020617] border border-[#334155] rounded-lg pl-8 pr-2 py-2 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="relative w-20">
                      <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400">Ps</span>
                      <input
                        type="text"
                        tabIndex={11}
                        maxLength={2}
                        value={pricePs}
                        onChange={(e) => setPricePs(e.target.value)}
                        placeholder="00"
                        className="w-full bg-[#020617] border border-[#334155] rounded-lg pl-8 pr-2 py-2 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 10. Binding & Code */}
                <div className="md:col-span-5 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    10. Binding & Binding Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <CustomSelect
                        value={binding}
                        onChange={(val) => setBinding(val)}
                        options={[
                          { value: 'HB', label: 'HB (Hard Bound)' },
                          { value: 'SB', label: 'SB (Soft Bound / Paper)' },
                          { value: 'Leather', label: 'Leather / Archival' },
                          { value: 'Other', label: 'Other Format' }
                        ]}
                      />
                    </div>
                    <input
                      type="text"
                      tabIndex={13}
                      maxLength={4}
                      value={bindingCode}
                      onChange={(e) => setBindingCode(e.target.value)}
                      placeholder="01"
                      title="Short register binding code (e.g. 01, 04)"
                      className="w-16 bg-[#020617] border border-[#334155] rounded-lg px-2 py-2 text-xs sm:text-sm font-mono text-center text-slate-200 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* 11. ISBN (with gentle non-blocking validation) */}
                <div className="md:col-span-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      11. ISBN (10 or 13)
                    </label>
                    {isbnWarning && (
                      <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                        <Info className="w-2.5 h-2.5" />
                        {isbnWarning}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    tabIndex={14}
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978-0-262-03384-8"
                    className={`w-full bg-[#020617] border rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none ${
                      isDuplicateIsbn 
                        ? 'border-amber-500/80 focus:border-amber-400' 
                        : 'border-[#334155] focus:border-amber-400'
                    }`}
                  />
                  {isDuplicateIsbn && (
                    <p className="text-[11px] text-amber-300 flex items-center gap-1">
                      <Info className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Duplicate ISBN: recorded as copy.</span>
                    </p>
                  )}
                </div>

                {/* 12. Source / Remarks */}
                <div className="md:col-span-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      12. Source / Acquisition
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDittoField('source')}
                      className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Ditto</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    tabIndex={15}
                    dir="auto"
                    style={{ unicodeBidi: 'plaintext' }}
                    value={sourceRemarks}
                    onChange={(e) => setSourceRemarks(e.target.value)}
                    placeholder="e.g. University Purchase, HEC Grant or عطیہ برائے لائبریری"
                    className={`w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-400 ${
                      isArabicOrUrduScript(sourceRemarks) ? 'font-urdu leading-[2]' : ''
                    }`}
                  />
                </div>

                {/* 13. Date Added (Acquisition Date) */}
                <div className="md:col-span-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span>13. Date Added</span>
                      <span className="text-amber-400 text-[10px] font-mono">(DD-MMM-YYYY)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDittoField('date_added')}
                      title="Clone Date Added from last entered book"
                      className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Same as Above</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        tabIndex={16}
                        value={dateAddedRaw}
                        onChange={(e) => handleDateTextChange(e.target.value)}
                        onBlur={handleDateBlur}
                        placeholder="02-Oct-2026"
                        className={`w-full bg-[#020617] border rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none ${
                          dateAddedError 
                            ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500' 
                            : 'border-[#334155] focus:border-amber-400'
                        }`}
                      />
                    </div>
                    {/* Visual date picker input */}
                    <div className="relative shrink-0">
                      <input
                        type="date"
                        max={getTodayIso()}
                        min="1900-01-01"
                        value={dateAdded}
                        onChange={(e) => handleDatePick(e.target.value)}
                        className="w-9 h-[36px] opacity-0 absolute inset-0 cursor-pointer z-10"
                        title="Pick date from calendar"
                      />
                      <div className="w-9 h-[36px] rounded-lg bg-[#0F172A] border border-[#334155] flex items-center justify-center text-amber-400 hover:text-amber-300 hover:border-amber-400 transition-colors pointer-events-none">
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  {dateAddedError ? (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{dateAddedError}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {formatDisplayDate(dateAdded)} · Defaults to today, editable
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* REGISTER SEQUENCE ROW 4: ARCHIVAL CLASSIFICATION & SHELVING */}
            <div className="p-4 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Archival Classification, Dewey Decimal & Shelving
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMediaStudio(!showMediaStudio)}
                    className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>{showMediaStudio ? 'Hide Cover Studio' : 'Open Cover Studio'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Academic Discipline / Category
                  </label>
                  <CustomSelect
                    value={category}
                    onChange={(val) => setCategory(val)}
                    options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                    searchable
                  />
                </div>

                {/* Dewey Decimal Call Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Dewey Call Number
                  </label>
                  <input
                    type="text"
                    tabIndex={17}
                    value={deweyCallNumber}
                    onChange={(e) => setDeweyCallNumber(e.target.value)}
                    placeholder="005.133 ULM"
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Book Group (گروپ) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Book Group (گروپ)
                    </label>
                    {groupId && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: AlmariService.getGroups().find(g => g.id === groupId)?.color || '#BC881B' }}
                      />
                    )}
                  </div>
                  <select
                    value={groupId}
                    onChange={(e) => {
                      const newGid = e.target.value;
                      setGroupId(newGid);
                      if (newGid) {
                        const allBooks = LibraryStorage.getBooks();
                        const loc = AlmariService.suggestAlmariAndShelf(newGid, allBooks);
                        if (loc) {
                          setAlmariId(loc.almari.id);
                          setShelfNo(loc.shelf_no);
                          const gName = AlmariService.getGroups().find(g => g.id === newGid)?.name_en || '';
                          setSuggestedNotice(`Suggested: ${gName}, ${loc.almari.code}, shelf ${loc.shelf_no}`);
                        }
                      }
                    }}
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    <option value="">(No group / Unassigned)</option>
                    {AlmariService.getGroups().filter(g => g.is_active).map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name_en} ({g.name_ur})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Almari (الماری) & Shelf No */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Almari (الماری) & Shelf
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={almariId}
                      onChange={(e) => {
                        setAlmariId(e.target.value);
                      }}
                      className="flex-1 bg-[#020617] border border-[#334155] rounded-lg px-2.5 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="">(No almari)</option>
                      {AlmariService.getAlmaris().filter(a => a.is_active).map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name_en}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-slate-400 font-mono">Sh:</span>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={shelfNo}
                        onChange={(e) => setShelfNo(parseInt(e.target.value, 10) || 1)}
                        className="w-12 bg-[#020617] border border-[#334155] rounded-lg px-1.5 py-2 text-xs font-mono text-center text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto-suggest note banner */}
              {suggestedNotice && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-mono">{suggestedNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuggestedNotice(null)}
                    className="text-amber-400 hover:text-white p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                {/* Legacy Shelf text (synced with Almari) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Legacy Shelf Reference
                  </label>
                  <input
                    type="text"
                    tabIndex={18}
                    value={shelf}
                    onChange={(e) => setShelf(e.target.value)}
                    placeholder="CS-Rack-01"
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Section / Stacks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Archival Stacks Section
                  </label>
                  <input
                    type="text"
                    tabIndex={19}
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="Main Stacks"
                    className="w-full bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Quantities */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#1E293B]">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-300">Total Physical Copies:</span>
                    <div className="flex items-center border border-[#334155] rounded-lg overflow-hidden bg-[#020617]">
                      <button
                        type="button"
                        onClick={() => setTotalQuantity(Math.max(1, totalQuantity - 1))}
                        className="px-2.5 py-1 text-slate-400 hover:text-[#F1F5F9] hover:bg-[#1E293B] cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 font-mono font-bold text-xs text-[#F1F5F9]">
                        {totalQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTotalQuantity(totalQuantity + 1)}
                        className="px-2.5 py-1 text-slate-400 hover:text-[#F1F5F9] hover:bg-[#1E293B] cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-300">Available in Circulation:</span>
                    <span className="font-mono text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25">
                      {Math.min(availableQuantity, totalQuantity)} of {totalQuantity} Copies
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Physical Copy Tracking: Each copy retains individual accession ID
                </div>
              </div>
            </div>

            {/* COLLAPSIBLE MEDIA & COVER STUDIO (CLEAN, BESPOKE, NON-INTRUSIVE) */}
            {showMediaStudio && (
              <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    Cover Art & Realistic Hardcover Preview
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && processImageFile(e.target.files[0])}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 rounded bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-medium text-slate-200 cursor-pointer"
                    >
                      {isProcessingImage ? 'Processing...' : 'Upload Image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="px-3 py-1 rounded bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-medium text-slate-200 cursor-pointer"
                    >
                      URL
                    </button>
                    {bookImagePath && (
                      <button
                        type="button"
                        onClick={() => setBookImagePath('')}
                        className="px-2 py-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 bg-[#020617] border border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => { if (tempUrl.trim()) { setBookImagePath(tempUrl.trim()); setTempUrl(''); setShowUrlInput(false); } }}
                      className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold"
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* Preset Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-mono">Academic Presets:</span>
                  {PRESET_COVERS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setBookImagePath(preset.url)}
                      className="px-2.5 py-1 rounded bg-[#020617] hover:bg-[#1E293B] border border-[#334155] text-[11px] text-slate-300 font-medium cursor-pointer"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DESCRIPTION / COURSE ABSTRACT */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Catalog Description, Syllabus Reference & Course Notes</span>
                <span className="text-[11px] font-mono text-slate-500">{description.length} chars</span>
              </label>
              <textarea
                rows={2}
                tabIndex={20}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Course codes, syllabus overview, prerequisites, or condition notes..."
                className="w-full bg-[#020617] border border-[#334155] rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 leading-relaxed resize-y"
              />
            </div>
          </form>
        </div>

        {/* 3. MODAL FOOTER BAR */}
        <div className="px-6 py-3.5 bg-[#020617] border-t border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {bookToEdit && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(bookToEdit);
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Withdraw Title</span>
              </button>
            )}
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>SQLite WAL Atomic Record</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-slate-300 text-xs font-semibold border border-[#334155] transition-colors cursor-pointer"
            >
              Cancel (Esc)
            </button>

            {!bookToEdit && (
              <button
                type="button"
                onClick={() => executeSave(true)}
                disabled={saveState !== 'idle'}
                className="px-4 py-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-amber-300 font-semibold text-xs border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Save current volume and immediately prepare next accession entry"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Save & Next (Enter ↵)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => executeSave(false)}
              disabled={saveState !== 'idle'}
              className="px-6 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] active:bg-[#B45309] text-[#020617] font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {saveState === 'loading' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : saveState === 'success' ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Committed</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>{bookToEdit ? 'Save Changes' : 'Register Volume'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
