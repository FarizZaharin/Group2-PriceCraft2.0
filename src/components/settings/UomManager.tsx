import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, X, Check, EyeOff, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../shared/Toast';
import { adminDb } from '../../lib/admin-database';
import { canManageSettings } from '../../lib/permissions';
import { UomRecord } from '../../types';
import ConfirmDialog from '../shared/ConfirmDialog';

export default function UomManager() {
  const { user } = useAuth();
  const { refreshUoms } = useSettings();
  const { showToast } = useToast();

  const canEdit = user && canManageSettings(user.role);

  const [items, setItems] = useState<UomRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, [showInactive]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await adminDb.uoms.getAll(!showInactive);
      setItems(data);
    } catch {
      showToast('error', 'Failed to load units of measure');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCode.trim()) return;
    try {
      const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      await adminDb.uoms.create(newCode.trim(), newLabel.trim(), maxSort);
      setNewCode('');
      setNewLabel('');
      setAddingNew(false);
      await loadItems();
      await refreshUoms();
      showToast('success', 'Unit of measure added');
    } catch {
      showToast('error', 'Failed to add UOM. Code may already exist.');
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editCode.trim()) return;
    try {
      await adminDb.uoms.update(id, { code: editCode.trim(), label: editLabel.trim() });
      setEditingId(null);
      await loadItems();
      await refreshUoms();
      showToast('success', 'Unit of measure updated');
    } catch {
      showToast('error', 'Failed to update UOM');
    }
  };

  const handleToggleActive = async (item: UomRecord) => {
    try {
      await adminDb.uoms.toggleActive(item.id, !item.is_active);
      await loadItems();
      await refreshUoms();
      showToast('success', item.is_active ? 'UOM deactivated' : 'UOM activated');
    } catch {
      showToast('error', 'Failed to update UOM');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setItems(updated);
    try {
      await adminDb.uoms.reorder(
        updated.map((item, i) => ({ id: item.id, sort_order: i }))
      );
      await refreshUoms();
    } catch {
      showToast('error', 'Failed to reorder');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setItems(updated);
    try {
      await adminDb.uoms.reorder(
        updated.map((item, i) => ({ id: item.id, sort_order: i }))
      );
      await refreshUoms();
    } catch {
      showToast('error', 'Failed to reorder');
    }
  };

  const startEdit = (item: UomRecord) => {
    setEditingId(item.id);
    setEditCode(item.code);
    setEditLabel(item.label);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        Loading units of measure...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Units of Measure</h3>
          <p className="text-xs text-gray-500 mt-0.5">Available UOM options in the BoQ editor</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show inactive
          </label>
          {canEdit && (
            <button
              onClick={() => setAddingNew(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {addingNew && (
          <div className="flex items-center gap-2 px-5 py-3 bg-blue-50/50">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setAddingNew(false); setNewCode(''); setNewLabel(''); }
              }}
              placeholder="Code (e.g., m2)"
              autoFocus
              className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setAddingNew(false); setNewCode(''); setNewLabel(''); }
              }}
              placeholder="Label (e.g., Square Metre)"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              className="p-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewCode(''); setNewLabel(''); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            No units of measure found
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-5 py-3 group ${
                !item.is_active ? 'bg-gray-50 opacity-60' : ''
              }`}
            >
              {canEdit && (
                <div className="flex flex-col">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-0 transition-colors"
                  >
                    <GripVertical className="h-3 w-3 rotate-180" />
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-0 transition-colors"
                  >
                    <GripVertical className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="flex-1 min-w-0">
                {editingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      autoFocus
                      className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      placeholder="Label"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => handleSaveEdit(item.id)} className="p-1 text-emerald-600 hover:text-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => canEdit && startEdit(item)}
                    className={`flex items-center gap-3 ${canEdit ? 'cursor-pointer hover:text-blue-600' : ''}`}
                  >
                    <span className="text-sm font-mono font-medium text-gray-900 w-16">{item.code}</span>
                    <span className="text-sm text-gray-500">{item.label || '-'}</span>
                  </div>
                )}
              </div>

              {!item.is_active && (
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-1.5 py-0.5 bg-gray-100 rounded">
                  Inactive
                </span>
              )}

              {canEdit && editingId !== item.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title={item.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {item.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => setDeletingId(item.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await adminDb.uoms.toggleActive(deletingId, false);
            await loadItems();
            await refreshUoms();
            showToast('success', 'UOM deactivated');
          } catch {
            showToast('error', 'Failed to remove UOM');
          }
          setDeletingId(null);
        }}
        title="Deactivate Unit of Measure"
        message="This will deactivate the UOM. Existing BoQ rows using this UOM will not be affected. You can reactivate it later."
        confirmText="Deactivate"
        variant="danger"
      />
    </div>
  );
}
