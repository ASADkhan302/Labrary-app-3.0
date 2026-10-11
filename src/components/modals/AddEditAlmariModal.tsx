import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  X, 
  Check, 
  AlertTriangle, 
  Layers, 
  ArrowRight, 
  RotateCcw, 
  Sparkles,
  HelpCircle,
  Hash,
  BookOpen
} from 'lucide-react';
import { Almari, AlmariShelf, BookGroup, Book } from '../../types/library';
import { AlmariService } from '../../services/almariService';
import { LibraryStorage } from '../../services/storage';

interface AddEditAlmariModalProps {
  isOpen: boolean;
  onClose: () => void;
  almariToEdit?: Almari | null;
  onSaved: (almari: Almari, message: string, batchId?: string) => void;
}

export const AddEditAlmariModal: React.FC<AddEditAlmariModalProps> = ({
  isOpen,
  onClose,
  almariToEdit,
  onSaved,
}) => {
  const allGroups = useMemo(() => AlmariService.getGroups().filter(g => g.is_active), []);
  const allAlmaris = useMemo(() => AlmariService.getAlmaris().filter(a => a.is_active), []);
  const allBooks = useMemo(() => LibraryStorage.getBooks().filter(b => b.is_active), []);

  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameUr, setNameUr] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [shelfCount, setShelfCount] = useState<number>(6);
  const [shelfCapacities, setShelfCapacities] = useState<number[]>([]);
  const [totalCapacityInput, setTotalCapacityInput] = useState<number>(180);
  const [isPerShelfManual, setIsPerShelfManual] = useState<boolean>(false);

  // Assign Books Now options
  const [assignMode, setAssignMode] = useState<'none' | 'by_range' | 'by_group'>('none');
  const [fromBarcode, setFromBarcode] = useState('ULM-00001');
  const [toBarcode, setToBarcode] = useState('ULM-00060');
  const [moveExistingFromOtherAlmari, setMoveExistingFromOtherAlmari] = useState<boolean>(true);
  const [orderBy, setOrderBy] = useState<'barcode_series' | 'call_number' | 'title' | 'author'>('barcode_series');

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

    if (almariToEdit) {
      setCode(almariToEdit.code);
      setNameEn(almariToEdit.name_en);
      setNameUr(almariToEdit.name_ur);
      const linkedGroups = AlmariService.getGroupsForAlmari(almariToEdit.id);
      setSelectedGroupIds(linkedGroups.map(g => g.id));
      const count = almariToEdit.shelf_count || 5;
      setShelfCount(count);

      const shelves = AlmariService.getShelvesForAlmari(almariToEdit.id);
      if (shelves.length > 0) {
        setShelfCapacities(shelves.map(s => s.capacity || 30));
        setTotalCapacityInput(shelves.reduce((acc, s) => acc + (s.capacity || 30), 0));
      } else {
        const defaultCap = almariToEdit.books_per_shelf || 30;
        setShelfCapacities(Array(count).fill(defaultCap));
        setTotalCapacityInput(count * defaultCap);
      }
    } else {
      // Auto generate next code
      const nextIdx = allAlmaris.length + 1;
      setCode(`A-${String(nextIdx).padStart(2, '0')}`);
      setNameEn('');
      setNameUr('');
      setSelectedGroupIds(allGroups.length > 0 ? [allGroups[0].id] : []);
      setShelfCount(6);
      setShelfCapacities(Array(6).fill(30));
      setTotalCapacityInput(180);
    }
    setAssignMode('none');
  }, [isOpen, almariToEdit, allAlmaris.length, allGroups]);

  // Suggest English and Urdu name when groups change and name is not manually locked
  useEffect(() => {
    if (almariToEdit?.name_locked) return;
    if (selectedGroupIds.length === 0) return;

    const chosenGroups = allGroups.filter(g => selectedGroupIds.includes(g.id));
    if (chosenGroups.length > 0 && !nameEn) {
      const primary = chosenGroups[0];
      setNameEn(`${primary.name_en} Stacks`);
      setNameUr(`${primary.name_ur} الماری`);
    }
  }, [selectedGroupIds, allGroups, almariToEdit?.name_locked, nameEn]);

  // Adjust shelf capacities when shelf count or total capacity changes
  const handleShelfCountChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(20, newCount));
    setShelfCount(validCount);
    const baseCap = Math.floor(totalCapacityInput / validCount);
    let remainder = totalCapacityInput % validCount;
    const newCaps: number[] = [];
    for (let i = 0; i < validCount; i++) {
      newCaps.push(baseCap + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder--;
    }
    setShelfCapacities(newCaps);
  };

  const handleTotalCapacityChange = (newTotal: number) => {
    const validTotal = Math.max(shelfCount, newTotal);
    setTotalCapacityInput(validTotal);
    const baseCap = Math.floor(validTotal / shelfCount);
    let remainder = validTotal % shelfCount;
    const newCaps: number[] = [];
    for (let i = 0; i < shelfCount; i++) {
      newCaps.push(baseCap + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder--;
    }
    setShelfCapacities(newCaps);
  };

  const handleIndividualShelfCapacityChange = (idx: number, cap: number) => {
    const updated = [...shelfCapacities];
    updated[idx] = Math.max(1, cap);
    setShelfCapacities(updated);
    setTotalCapacityInput(updated.reduce((a, b) => a + b, 0));
  };

  // Compute live range preview if assignMode === 'by_range'
  const rangePreview = useMemo(() => {
    if (assignMode !== 'by_range') return null;
    return AlmariService.previewRangeAssignment(
      allBooks,
      fromBarcode,
      toBarcode,
      almariToEdit?.id,
      selectedGroupIds
    );
  }, [assignMode, allBooks, fromBarcode, toBarcode, almariToEdit?.id, selectedGroupIds]);

  // Books to place based on assign mode
  const candidateBooks = useMemo(() => {
    if (assignMode === 'none') return [];
    if (assignMode === 'by_range' && rangePreview) {
      if (moveExistingFromOtherAlmari) {
        return rangePreview.foundBooks;
      }
      return rangePreview.foundBooks.filter(b => !b.almari_id || b.almari_id === almariToEdit?.id);
    }
    if (assignMode === 'by_group') {
      const groupSet = new Set(selectedGroupIds);
      return allBooks.filter(b => (!b.almari_id || b.almari_id === almariToEdit?.id) && b.group_id && groupSet.has(b.group_id));
    }
    return [];
  }, [assignMode, rangePreview, moveExistingFromOtherAlmari, selectedGroupIds, allBooks, almariToEdit?.id]);

  // Compute shelf distribution preview
  const shelfDistributionPreview = useMemo(() => {
    if (candidateBooks.length === 0) return null;
    const dummyAlmari: Almari = {
      id: almariToEdit?.id || 'temp-alm',
      code: code || 'A-01',
      name_en: nameEn || 'New Almari',
      name_ur: nameUr || 'نئی الماری',
      shelf_count: shelfCount,
      books_per_shelf: Math.floor(totalCapacityInput / shelfCount),
      is_active: true,
    };
    const shelves: AlmariShelf[] = shelfCapacities.map((cap, i) => ({
      almari_id: dummyAlmari.id,
      shelf_no: i + 1,
      capacity: cap,
    }));

    return AlmariService.fillShelvesByCapacity(candidateBooks, dummyAlmari, shelves, orderBy);
  }, [candidateBooks, almariToEdit?.id, code, nameEn, nameUr, shelfCount, totalCapacityInput, shelfCapacities, orderBy]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!nameEn.trim()) return;

    const dummyAlmId = almariToEdit?.id || `alm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const shelvesToSave: AlmariShelf[] = shelfCapacities.map((cap, idx) => ({
      almari_id: dummyAlmId,
      shelf_no: idx + 1,
      capacity: cap,
    }));

    let savedAlmari: Almari;
    if (almariToEdit) {
      AlmariService.updateAlmari(almariToEdit.id, {
        code,
        name_en: nameEn.trim(),
        name_ur: nameUr.trim(),
        shelf_count: shelfCount,
        books_per_shelf: Math.floor(totalCapacityInput / shelfCount),
        shelves: shelvesToSave,
        name_locked: true,
      }, selectedGroupIds);
      savedAlmari = AlmariService.getAlmaris().find(a => a.id === almariToEdit.id)!;
    } else {
      savedAlmari = AlmariService.addAlmari({
        code,
        name_en: nameEn.trim(),
        name_ur: nameUr.trim(),
        shelf_count: shelfCount,
        books_per_shelf: Math.floor(totalCapacityInput / shelfCount),
        notes: `Created via Almari Studio`,
        is_active: true,
        name_locked: true,
        shelves: shelvesToSave,
      }, selectedGroupIds);
    }

    // Apply book assignments if configured
    let batchId: string | undefined;
    if (assignMode !== 'none' && shelfDistributionPreview && shelfDistributionPreview.updatedBooks.length > 0) {
      batchId = `batch-place-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const updatedMap = new Map(shelfDistributionPreview.updatedBooks.map(b => [b.id, b]));

      const fullCatalog = LibraryStorage.getBooks().map(b => {
        const up = updatedMap.get(b.id);
        if (up) {
          // Record location history
          AlmariService.recordMove({
            book_id: b.id,
            from: b.almari_id ? `${b.almari_id}, Shelf ${b.shelf_no || 1}` : 'Unassigned',
            to: `${savedAlmari.code}, Shelf ${up.shelf_no || 1}`,
            reason: `Assigned in Almari modal (${assignMode})`,
            batch_id: batchId,
          });
          return { ...b, almari_id: savedAlmari.id, shelf_no: up.shelf_no };
        }
        return b;
      });

      LibraryStorage.saveBooks(fullCatalog);
    }

    onSaved(savedAlmari, `Almari "${savedAlmari.name_en} (${savedAlmari.code})" saved with ${shelfCount} shelves (${totalCapacityInput} capacity).`, batchId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#1A1A1A] border border-[#BC881B]/40 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#E7E2EC]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#221F26]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#541A72]/40 border border-[#A66BC9]/30 flex items-center justify-center text-[#E0B450]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {almariToEdit ? 'Edit Almari' : 'Add New Almari'}
                <span className="text-xs px-2 py-0.5 rounded bg-[#BC881B]/20 text-[#E0B450] font-mono border border-[#BC881B]/30">
                  {code || 'A-01'}
                </span>
              </h2>
              <p className="text-xs text-[#B3AABD]">Configure shelves, divided capacity, and immediate range assignment</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Section 1: Names and Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#E0B450] mb-1">Code (Auto/Fixed)</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full bg-[#221F26] border border-white/[0.12] rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-[#BC881B] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#E0B450] mb-1">English Name</label>
              <input
                type="text"
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                placeholder="e.g. Computer Books"
                className="w-full bg-[#221F26] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-white focus:border-[#BC881B] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#E0B450] mb-1">Urdu Name (اردو نام)</label>
              <input
                type="text"
                dir="auto"
                value={nameUr}
                onChange={e => setNameUr(e.target.value)}
                placeholder="مثلاً کمپیوٹر کی کتب"
                className="w-full bg-[#221F26] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-white focus:border-[#BC881B] focus:outline-none font-urdu"
              />
            </div>
          </div>

          {/* Section 2: Associated Disciplines / Groups */}
          <div>
            <label className="block text-xs font-semibold text-[#E0B450] mb-1">
              Associated Subject Groups (Multi-select)
            </label>
            <div className="flex flex-wrap gap-2 p-3 bg-[#221F26] rounded-xl border border-white/[0.08] max-h-32 overflow-y-auto">
              {allGroups.map(grp => {
                const isSelected = selectedGroupIds.includes(grp.id);
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedGroupIds(selectedGroupIds.filter(id => id !== grp.id));
                      } else {
                        setSelectedGroupIds([...selectedGroupIds, grp.id]);
                      }
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#541A72] border-[#A66BC9] text-white shadow-sm'
                        : 'bg-[#1A1A1A] border-white/[0.1] text-[#B3AABD] hover:border-white/[0.2]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: grp.color }} />
                    <span>{grp.name_en}</span>
                    <span className="font-urdu text-[11px] opacity-80" dir="auto">{grp.name_ur}</span>
                    {isSelected && <Check className="w-3 h-3 text-[#E0B450] ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Shelves and Capacity Configuration */}
          <div className="bg-[#221F26] p-4 rounded-xl border border-white/[0.08] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#BC881B]" />
                  Shelves & Capacity Allocation
                </h3>
                <p className="text-xs text-[#B3AABD]">Typing a total capacity automatically divides it equally across all shelves</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#B3AABD]">Rows (Shelves):</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={shelfCount}
                    onChange={e => handleShelfCountChange(parseInt(e.target.value, 10) || 1)}
                    className="w-16 bg-[#1A1A1A] border border-white/[0.12] rounded px-2 py-1 text-sm text-center text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#B3AABD]">Total Capacity:</span>
                  <input
                    type="number"
                    min={shelfCount}
                    value={totalCapacityInput}
                    onChange={e => handleTotalCapacityChange(parseInt(e.target.value, 10) || shelfCount)}
                    className="w-20 bg-[#1A1A1A] border border-[#BC881B]/50 rounded px-2 py-1 text-sm font-bold text-center text-[#E0B450]"
                  />
                </div>
              </div>
            </div>

            {/* Shelf Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-white/[0.06]">
              {shelfCapacities.map((cap, idx) => (
                <div key={idx} className="bg-[#1A1A1A] border border-white/[0.08] rounded-lg p-2.5 text-center">
                  <span className="text-[11px] text-[#B3AABD] font-mono block mb-1">Shelf {idx + 1}</span>
                  <input
                    type="number"
                    min="1"
                    value={cap}
                    onChange={e => handleIndividualShelfCapacityChange(idx, parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#221F26] border border-white/[0.1] rounded px-1.5 py-1 text-center font-bold text-sm text-white focus:border-[#BC881B]"
                  />
                  <span className="text-[10px] text-[#B3AABD] mt-1 block">books</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Assign Books Now */}
          <div className="bg-[#221F26] p-4 rounded-xl border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#34D399]" />
                  Assign Books Now
                </h3>
                <p className="text-xs text-[#B3AABD]">Populate shelves immediately by continuous accession range or subject group</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssignMode('none')}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    assignMode === 'none' ? 'bg-[#541A72] border-[#A66BC9] text-white' : 'bg-[#1A1A1A] text-[#B3AABD] border-white/[0.08]'
                  }`}
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode('by_range')}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    assignMode === 'by_range' ? 'bg-[#BC881B] border-[#E0B450] text-[#1A1A1A] font-bold' : 'bg-[#1A1A1A] text-[#B3AABD] border-white/[0.08]'
                  }`}
                >
                  By Range
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode('by_group')}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    assignMode === 'by_group' ? 'bg-[#BC881B] border-[#E0B450] text-[#1A1A1A] font-bold' : 'bg-[#1A1A1A] text-[#B3AABD] border-white/[0.08]'
                  }`}
                >
                  By Group
                </button>
              </div>
            </div>

            {/* By Range Options */}
            {assignMode === 'by_range' && (
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] text-[#E0B450] mb-1">From Barcode</label>
                    <input
                      type="text"
                      value={fromBarcode}
                      onChange={e => setFromBarcode(e.target.value.toUpperCase())}
                      className="w-full bg-[#1A1A1A] border border-white/[0.12] rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                      placeholder="ULM-00001"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#E0B450] mb-1">To Barcode</label>
                    <input
                      type="text"
                      value={toBarcode}
                      onChange={e => setToBarcode(e.target.value.toUpperCase())}
                      className="w-full bg-[#1A1A1A] border border-white/[0.12] rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                      placeholder="ULM-00060"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#B3AABD] mb-1">Order By</label>
                    <select
                      value={orderBy}
                      onChange={e => setOrderBy(e.target.value as any)}
                      className="w-full bg-[#1A1A1A] border border-white/[0.12] rounded-lg px-3 py-1.5 text-xs text-white"
                    >
                      <option value="barcode_series">Barcode Series</option>
                      <option value="call_number">Call Number</option>
                      <option value="title">Title</option>
                      <option value="author">Author</option>
                    </select>
                  </div>
                </div>

                {/* Range stats and warnings */}
                {rangePreview && (
                  <div className="bg-[#1A1A1A] p-3 rounded-lg border border-white/[0.06] text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[#34D399] font-medium">
                        Found {rangePreview.foundBooks.length} of {rangePreview.totalExpected} numbers in series
                      </span>
                      {rangePreview.missingNumbers.length > 0 && (
                        <span className="text-[#FB7185]">
                          ({rangePreview.missingNumbers.length} missing numbers)
                        </span>
                      )}
                    </div>

                    {rangePreview.booksAlreadyInOtherAlmari.length > 0 && (
                      <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 p-2 rounded text-amber-200">
                        <span>{rangePreview.booksAlreadyInOtherAlmari.length} book(s) currently in another Almari</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={moveExistingFromOtherAlmari}
                            onChange={e => setMoveExistingFromOtherAlmari(e.target.checked)}
                            className="rounded accent-[#BC881B]"
                          />
                          <span>Move them here</span>
                        </label>
                      </div>
                    )}

                    {rangePreview.booksInAnotherGroup.length > 0 && (
                      <div className="text-[#B3AABD] italic">
                        Note: {rangePreview.booksInAnotherGroup.length} book(s) belong to other subject groups.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Distribution preview table */}
            {shelfDistributionPreview && (
              <div className="pt-2 border-t border-white/[0.06]">
                <h4 className="text-xs font-bold text-[#E0B450] mb-2 flex items-center justify-between">
                  <span>Shelf Filling Plan ({shelfDistributionPreview.updatedBooks.length} books)</span>
                  {shelfDistributionPreview.overCapacityCount > 0 && (
                    <span className="text-[#FB7185] font-normal">
                      Warning: {shelfDistributionPreview.overCapacityCount} books over total capacity!
                    </span>
                  )}
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {shelfDistributionPreview.shelfDistribution.map(sd => (
                    <div key={sd.shelf_no} className="flex items-center justify-between bg-[#1A1A1A] px-3 py-1.5 rounded text-xs border border-white/[0.04]">
                      <span className="font-semibold text-white">Shelf {sd.shelf_no}</span>
                      <span className="font-mono text-[#E0B450]">{sd.rangeStr || 'Empty'}</span>
                      <span className="text-[#B3AABD]">{sd.books.length} / {sd.capacity} books</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#221F26]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#B3AABD] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!nameEn.trim()}
            className="px-6 py-2 rounded-lg text-xs font-bold bg-[#BC881B] hover:bg-[#D4A02A] text-[#1A1A1A] transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{almariToEdit ? 'Save Changes' : 'Create Almari'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
