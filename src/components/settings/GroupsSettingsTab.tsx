import React, { useState } from 'react';
import { 
  FolderPlus, 
  Layers, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  Palette,
  Sparkles,
  Info
} from 'lucide-react';
import { BookGroup } from '../../types/library';
import { AlmariService } from '../../services/almariService';

interface GroupsSettingsTabProps {
  onGroupsChanged?: () => void;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#059669', // Forest
  '#D97706', // Ochre
  '#14B8A6', // Teal
  '#EF4444', // Red
  '#84CC16', // Lime
  '#A855F7', // Violet
  '#64748B', // Slate
  '#BC881B', // Gold
];

export const GroupsSettingsTab: React.FC<GroupsSettingsTabProps> = ({ onGroupsChanged }) => {
  const [groups, setGroups] = useState<BookGroup[]>(() => AlmariService.getGroups());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameUr, setEditNameUr] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [editMatchCat, setEditMatchCat] = useState('');
  const [editMatchLang, setEditMatchLang] = useState('');

  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [newNameEn, setNewNameEn] = useState('');
  const [newNameUr, setNewNameUr] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newMatchCat, setNewMatchCat] = useState('');
  const [newMatchLang, setNewMatchLang] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleStartEdit = (grp: BookGroup) => {
    setEditingGroupId(grp.id);
    setEditNameEn(grp.name_en);
    setEditNameUr(grp.name_ur);
    setEditColor(grp.color);
    setEditMatchCat(grp.match_category || '');
    setEditMatchLang(grp.match_language || '');
  };

  const handleSaveEdit = () => {
    if (!editingGroupId || !editNameEn.trim()) return;
    AlmariService.updateGroup(editingGroupId, {
      name_en: editNameEn.trim(),
      name_ur: editNameUr.trim() || editNameEn.trim(),
      color: editColor,
      match_category: editMatchCat.trim() || undefined,
      match_language: editMatchLang.trim() || undefined,
    });
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    setEditingGroupId(null);
    onGroupsChanged?.();
    showToast('Book group updated.');
  };

  const handleSaveAdd = () => {
    if (!newNameEn.trim()) return;
    AlmariService.addGroup({
      name_en: newNameEn.trim(),
      name_ur: newNameUr.trim() || newNameEn.trim(),
      color: newColor,
      sort_order: groups.length + 1,
      is_active: true,
      match_category: newMatchCat.trim() || undefined,
      match_language: newMatchLang.trim() || undefined,
    });
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    setIsAdding(false);
    setNewNameEn('');
    setNewNameUr('');
    setNewMatchCat('');
    setNewMatchLang('');
    onGroupsChanged?.();
    showToast('New book group added.');
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete book group "${name}"?`)) return;
    AlmariService.deleteGroup(id);
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    onGroupsChanged?.();
    showToast(`Deleted group "${name}".`);
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= groups.length) return;
    const reordered = [...groups];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    const updated = reordered.map((g, idx) => ({ ...g, sort_order: idx + 1 }));
    AlmariService.saveGroups(updated);
    setGroups(updated);
    onGroupsChanged?.();
  };

  const handleToggleActive = (id: string, current: boolean) => {
    AlmariService.updateGroup(id, { is_active: !current });
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    onGroupsChanged?.();
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="p-3 bg-[#1A1A1A] border border-[var(--gold)]/40 rounded-[10px] text-[var(--gold-text)] text-[13px] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--gold)]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[14px]">
        <div>
          <h3 className="text-[15px] font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--gold)]" />
            Book Groups (گروپس) Configuration
          </h3>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            Define classification groups, color badges, and auto-suggestion matching rules (language and subject category).
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-[var(--gold)] hover:bg-[var(--gold-hover)] text-[#1A1A1A] font-semibold text-[13px] rounded-[8px] transition-colors flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            Add New Group
          </button>
        )}
      </div>

      {/* Add Form Panel */}
      {isAdding && (
        <div className="p-4 bg-[#221F26] border border-[var(--gold)]/40 rounded-[14px] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[14px] font-semibold text-[var(--gold-text)] flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-[var(--gold)]" />
              New Book Group
            </h4>
            <button
              onClick={() => setIsAdding(false)}
              className="text-[var(--text-muted)] hover:text-white p-1 rounded hover:bg-black/20"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                Group Name (English) *
              </label>
              <input
                type="text"
                value={newNameEn}
                onChange={e => setNewNameEn(e.target.value)}
                placeholder="e.g. Computer Science"
                className="w-full h-9 px-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[8px] text-[13px] text-white focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                Group Name (Urdu / اردو) *
              </label>
              <input
                type="text"
                dir="auto"
                value={newNameUr}
                onChange={e => setNewNameUr(e.target.value)}
                placeholder="مثلاً: کمپیوٹر سائنس"
                className="w-full h-9 px-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[8px] text-[13px] text-white font-urdu focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
          </div>

          {/* Color & Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] uppercase font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                Badge Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-9 h-9 rounded-[8px] bg-transparent border border-[var(--border-subtle)] cursor-pointer"
                />
                <div className="flex gap-1 flex-wrap">
                  {PRESET_COLORS.slice(0, 6).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className="w-5 h-5 rounded-full border border-white/20"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                Rule: Match Language (Optional)
              </label>
              <input
                type="text"
                value={newMatchLang}
                onChange={e => setNewMatchLang(e.target.value)}
                placeholder="e.g. Urdu, Pashto, English"
                className="w-full h-9 px-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[8px] text-[13px] text-white focus:outline-none focus:border-[var(--gold)]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                Rule: Match Category (Optional)
              </label>
              <input
                type="text"
                value={newMatchCat}
                onChange={e => setNewMatchCat(e.target.value)}
                placeholder="e.g. Computer Science, Physics"
                className="w-full h-9 px-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[8px] text-[13px] text-white focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 bg-[#2B2730] hover:bg-[#3F3B45] text-[var(--text-body)] text-[12px] font-medium rounded-[8px]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAdd}
              disabled={!newNameEn.trim()}
              className="px-4 py-1.5 bg-[var(--gold)] hover:bg-[var(--gold-hover)] text-[#1A1A1A] text-[12px] font-semibold rounded-[8px] disabled:opacity-50"
            >
              Create Group
            </button>
          </div>
        </div>
      )}

      {/* Groups List Table */}
      <div className="bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[#221F26] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4">Group Name (English & Urdu)</th>
                <th className="py-3 px-4">Color Badge</th>
                <th className="py-3 px-4">Suggestion Rules</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
              {groups.map((grp, idx) => {
                const isEditing = editingGroupId === grp.id;
                return (
                  <tr key={grp.id} className="hover:bg-[#221F26]/60 transition-colors">
                    {/* Reorder arrows */}
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => handleMoveOrder(idx, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-[var(--text-muted)] hover:text-white disabled:opacity-20"
                          title="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">{idx + 1}</span>
                        <button
                          onClick={() => handleMoveOrder(idx, 'down')}
                          disabled={idx === groups.length - 1}
                          className="p-0.5 text-[var(--text-muted)] hover:text-white disabled:opacity-20"
                          title="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Group names */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="space-y-1.5 max-w-sm">
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={e => setEditNameEn(e.target.value)}
                            className="w-full h-8 px-2 bg-[#2B2730] border border-[var(--border-subtle)] rounded text-[12px] text-white"
                            placeholder="English name"
                          />
                          <input
                            type="text"
                            dir="auto"
                            value={editNameUr}
                            onChange={e => setEditNameUr(e.target.value)}
                            className="w-full h-8 px-2 bg-[#2B2730] border border-[var(--border-subtle)] rounded text-[12px] text-white font-urdu"
                            placeholder="اردو نام"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{grp.name_en}</span>
                          <span className="text-[var(--text-muted)] font-urdu text-[14px]" dir="auto">
                            ({grp.name_ur})
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Color */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="color"
                          value={editColor}
                          onChange={e => setEditColor(e.target.value)}
                          className="w-8 h-8 rounded border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                            style={{ backgroundColor: grp.color }}
                          />
                          <span className="font-mono text-[11px] text-[var(--text-muted)]">{grp.color}</span>
                        </div>
                      )}
                    </td>

                    {/* Suggestion rules */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="space-y-1 max-w-xs">
                          <input
                            type="text"
                            value={editMatchLang}
                            onChange={e => setEditMatchLang(e.target.value)}
                            placeholder="match_language (e.g. Urdu)"
                            className="w-full h-7 px-2 bg-[#2B2730] border border-[var(--border-subtle)] rounded text-[11px] text-white"
                          />
                          <input
                            type="text"
                            value={editMatchCat}
                            onChange={e => setEditMatchCat(e.target.value)}
                            placeholder="match_category"
                            className="w-full h-7 px-2 bg-[#2B2730] border border-[var(--border-subtle)] rounded text-[11px] text-white"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {grp.match_language && (
                            <span className="inline-block px-2 py-0.5 bg-blue-900/30 text-blue-300 border border-blue-800/40 rounded text-[11px] mr-1.5 font-mono">
                              Lang: {grp.match_language}
                            </span>
                          )}
                          {grp.match_category && (
                            <span className="inline-block px-2 py-0.5 bg-purple-900/30 text-purple-300 border border-purple-800/40 rounded text-[11px] font-mono">
                              Cat: {grp.match_category}
                            </span>
                          )}
                          {!grp.match_language && !grp.match_category && (
                            <span className="text-[11px] text-[var(--text-muted)] italic">No auto-match rules</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Active */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleToggleActive(grp.id, grp.is_active)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          grp.is_active
                            ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/50'
                            : 'bg-stone-900/40 text-stone-400 border-stone-800'
                        }`}
                      >
                        {grp.is_active ? 'Active' : 'Hidden'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[12px] flex items-center gap-1"
                            title="Save changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingGroupId(null)}
                            className="p-1.5 bg-[#2B2730] hover:bg-[#3F3B45] text-[var(--text-muted)] rounded text-[12px]"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(grp)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--gold)] hover:bg-[#2B2730] rounded transition-colors"
                            title="Edit group"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(grp.id, grp.name_en)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-rose-400 hover:bg-[#2B2730] rounded transition-colors"
                            title="Delete group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
