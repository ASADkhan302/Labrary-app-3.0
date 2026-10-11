import { BookGroup, Almari, AlmariGroup, AlmariPlanEntry } from '../types/library';

export function toUrduDigits(num: number): string {
  const urduDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).split('').map(d => {
    const digit = parseInt(d, 10);
    return isNaN(digit) ? d : urduDigits[digit];
  }).join('');
}

export const DEFAULT_ALMARI_PLAN: AlmariPlanEntry[] = [
  {
    key: 'islamic',
    name_en: 'Islamic Books',
    name_ur: 'اسلامی کتب',
    group_names_en: ['Islamic Studies'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'science',
    name_en: 'Science Books',
    name_ur: 'سائنسی کتب',
    group_names_en: ['Mathematics', 'Physics', 'Chemistry', 'Biology'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'computer',
    name_en: 'Computer Books',
    name_ur: 'کمپیوٹر کی کتب',
    group_names_en: ['Computer Science', 'Software Engineering'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'engineering',
    name_en: 'Engineering Books',
    name_ur: 'انجینئرنگ کی کتب',
    group_names_en: ['Engineering'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'law',
    name_en: 'Law Books',
    name_ur: 'قانون کی کتب',
    group_names_en: ['Law'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'education',
    name_en: 'Education Books',
    name_ur: 'تعلیم کی کتب',
    group_names_en: ['Education'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'english',
    name_en: 'English Books',
    name_ur: 'انگریزی کتب',
    group_names_en: ['English'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'urdu',
    name_en: 'Urdu Books',
    name_ur: 'اردو کتب',
    group_names_en: ['Urdu'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'pashto',
    name_en: 'Pashto Books',
    name_ur: 'پشتو کتب',
    group_names_en: ['Pashto'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'arabic_persian',
    name_en: 'Arabic & Persian Books',
    name_ur: 'عربی و فارسی کتب',
    group_names_en: ['Arabic', 'Persian'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'reference',
    name_en: 'Reference Books',
    name_ur: 'حوالہ جاتی کتب',
    group_names_en: ['General Reference'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
  {
    key: 'other',
    name_en: 'Other Books',
    name_ur: 'متفرق کتب',
    group_names_en: ['Other'],
    default_shelves: 6,
    default_capacity_per_shelf: 30,
  },
];

export const INITIAL_BOOK_GROUPS: BookGroup[] = [
  {
    id: 'grp-cs',
    name_en: 'Computer Science',
    name_ur: 'کمپیوٹر سائنس',
    color: '#3B82F6', // Blue
    sort_order: 1,
    is_active: true,
    match_category: 'Computer Science',
  },
  {
    id: 'grp-en',
    name_en: 'English',
    name_ur: 'انگریزی',
    color: '#8B5CF6', // Purple
    sort_order: 2,
    is_active: true,
    match_language: 'English',
  },
  {
    id: 'grp-ur',
    name_en: 'Urdu',
    name_ur: 'اردو',
    color: '#10B981', // Emerald Green
    sort_order: 3,
    is_active: true,
    match_language: 'Urdu',
  },
  {
    id: 'grp-ps',
    name_en: 'Pashto',
    name_ur: 'پشتو',
    color: '#F59E0B', // Amber
    sort_order: 4,
    is_active: true,
    match_language: 'Pashto',
  },
  {
    id: 'grp-math',
    name_en: 'Mathematics',
    name_ur: 'ریاضی',
    color: '#06B6D4', // Cyan
    sort_order: 5,
    is_active: true,
    match_category: 'Mathematics',
  },
  {
    id: 'grp-phy',
    name_en: 'Physics',
    name_ur: 'طبیعیات',
    color: '#6366F1', // Indigo
    sort_order: 6,
    is_active: true,
    match_category: 'Physics',
  },
  {
    id: 'grp-chem',
    name_en: 'Chemistry',
    name_ur: 'کیمیا',
    color: '#EC4899', // Pink
    sort_order: 7,
    is_active: true,
    match_category: 'Chemistry',
  },
  {
    id: 'grp-isl',
    name_en: 'Islamic Studies',
    name_ur: 'اسلامیات',
    color: '#059669', // Forest green
    sort_order: 8,
    is_active: true,
    match_category: 'Islamic Studies',
  },
  {
    id: 'grp-law',
    name_en: 'Law',
    name_ur: 'قانون',
    color: '#D97706', // Ochre
    sort_order: 9,
    is_active: true,
    match_category: 'Law',
  },
  {
    id: 'grp-edu',
    name_en: 'Education',
    name_ur: 'تعلیم',
    color: '#14B8A6', // Teal
    sort_order: 10,
    is_active: true,
    match_category: 'Education',
  },
  {
    id: 'grp-engr',
    name_en: 'Engineering',
    name_ur: 'انجینئرنگ',
    color: '#EF4444', // Red
    sort_order: 11,
    is_active: true,
    match_category: 'Civil Engineering',
  },
  {
    id: 'grp-ar',
    name_en: 'Arabic',
    name_ur: 'عربی',
    color: '#84CC16', // Lime
    sort_order: 12,
    is_active: true,
    match_language: 'Arabic',
  },
  {
    id: 'grp-fa',
    name_en: 'Persian',
    name_ur: 'فارسی',
    color: '#A855F7', // Violet
    sort_order: 13,
    is_active: true,
    match_language: 'Persian',
  },
  {
    id: 'grp-gen',
    name_en: 'General Reference',
    name_ur: 'عمومی حوالہ جات',
    color: '#64748B', // Slate
    sort_order: 14,
    is_active: true,
    match_category: 'General Reference',
  },
  {
    id: 'grp-oth',
    name_en: 'Other',
    name_ur: 'دیگر کتب',
    color: '#78716C', // Stone
    sort_order: 15,
    is_active: true,
  },
];

export const INITIAL_ALMARIS: Almari[] = [
  {
    id: 'alm-01',
    code: 'A-01',
    name_en: 'Computer Science & Systems',
    name_ur: 'الماری ۱: کمپیوٹر سائنس و ٹیکنالوجی',
    shelf_count: 5,
    books_per_shelf: 30,
    notes: 'Main Ground Floor Bay 1 - CS & Algorithms',
    is_active: true,
  },
  {
    id: 'alm-02',
    code: 'A-02',
    name_en: 'Mathematics & Pure Sciences',
    name_ur: 'الماری ۲: ریاضی اور بنیادی علوم',
    shelf_count: 5,
    books_per_shelf: 30,
    notes: 'Ground Floor Bay 2 - Mathematics & Statistics',
    is_active: true,
  },
  {
    id: 'alm-03',
    code: 'A-03',
    name_en: 'Physics & Physical Sciences',
    name_ur: 'الماری ۳: طبیعیات اور تجرباتی علوم',
    shelf_count: 4,
    books_per_shelf: 28,
    notes: 'Ground Floor Bay 3 - Physics & Mechanics',
    is_active: true,
  },
  {
    id: 'alm-04',
    code: 'A-04',
    name_en: 'Chemistry & Engineering',
    name_ur: 'الماری ۴: کیمیا اور انجینئرنگ',
    shelf_count: 4,
    books_per_shelf: 28,
    notes: 'First Floor - Chemical & Civil Engineering',
    is_active: true,
  },
  {
    id: 'alm-05',
    code: 'A-05',
    name_en: 'Islamic Studies & Law',
    name_ur: 'الماری ۵: اسلامیات اور قانون',
    shelf_count: 5,
    books_per_shelf: 32,
    notes: 'First Floor - Fiqh, Hadith, Law Stacks',
    is_active: true,
  },
  {
    id: 'alm-06',
    code: 'A-06',
    name_en: 'Oriental Languages & Literature',
    name_ur: 'الماری ۶: اردو، پشتو و علاقائی زبانیں',
    shelf_count: 6,
    books_per_shelf: 35,
    notes: 'First Floor - Urdu, Pashto, Arabic & Persian collection',
    is_active: true,
  },
  {
    id: 'alm-07',
    code: 'A-07',
    name_en: 'General Reference & Education',
    name_ur: 'الماری ۷: عمومی حوالہ اور تعلیم',
    shelf_count: 4,
    books_per_shelf: 25,
    notes: 'Reading Hall - Encyclopedias & Education',
    is_active: true,
  },
];

export const INITIAL_ALMARI_GROUPS: AlmariGroup[] = [
  // A-01: CS
  { id: 'ag-1', almari_id: 'alm-01', group_id: 'grp-cs' },
  // A-02: Mathematics
  { id: 'ag-2', almari_id: 'alm-02', group_id: 'grp-math' },
  // A-03: Physics
  { id: 'ag-3', almari_id: 'alm-03', group_id: 'grp-phy' },
  // A-04: Chemistry, Engineering
  { id: 'ag-4', almari_id: 'alm-04', group_id: 'grp-chem' },
  { id: 'ag-5', almari_id: 'alm-04', group_id: 'grp-engr' },
  // A-05: Islamic Studies, Law
  { id: 'ag-6', almari_id: 'alm-05', group_id: 'grp-isl' },
  { id: 'ag-7', almari_id: 'alm-05', group_id: 'grp-law' },
  // A-06: Urdu, Pashto, Arabic, Persian
  { id: 'ag-8', almari_id: 'alm-06', group_id: 'grp-ur' },
  { id: 'ag-9', almari_id: 'alm-06', group_id: 'grp-ps' },
  { id: 'ag-10', almari_id: 'alm-06', group_id: 'grp-ar' },
  { id: 'ag-11', almari_id: 'alm-06', group_id: 'grp-fa' },
  // A-07: General Reference, Education, English, Other
  { id: 'ag-12', almari_id: 'alm-07', group_id: 'grp-gen' },
  { id: 'ag-13', almari_id: 'alm-07', group_id: 'grp-edu' },
  { id: 'ag-14', almari_id: 'alm-07', group_id: 'grp-en' },
  { id: 'ag-15', almari_id: 'alm-07', group_id: 'grp-oth' },
];
