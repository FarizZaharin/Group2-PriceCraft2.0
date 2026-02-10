import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, X, Check, EyeOff, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../shared/Toast';
import { adminDb } from '../../lib/admin-database';
import { canManageSettings } from '../../lib/permissions';
import { CategoryRecord } from '../../types';
import ConfirmDialog from '../shared/ConfirmDialog';

export default function CategoryManager() {
  const { user } = useAuth();
  const { refreshCategories } = useSettings();
  const { showToast } = useToast();

  const canEdit = user && canManageSettings(user.role);

  const [items, setItems] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, [showInactive]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await adminDb.categories.getAll(!showInactive);
      setItems(data);
    } catch {
      showToast('error', 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      await adminDb.categories.create(newName.trim(), maxSort);
      setNewName('');
      setAddingNew(false);
      await loadItems();
      await refreshCategories();
      showToast('success', 'Category added');
    } catch {
      showToast('error', 'Failed to add category. Name may already exist.');
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await adminDb.categories.update(id, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      await loadItems();
      await refreshCategories();
      showToast('success', 'Category renamed');
    } catch {
      showToast('error', 'Failed to rename category');
    }
  };

  const handleToggleActive = async (item: CategoryRecord) => {
    try {
      await adminDb.categories.toggleActive(item.id, !item.is_active);
      await loadItems();
      await refreshCategories();
      showToast('success', item.is_active ? 'Category deactivated' : 'Category activated');
    } catch {
      showToast('error', 'Failed to update category');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setItems(updated);
    try {
      await adminDb.categories.reorder(
        updated.map((item, i) => ({ id: item.id, sort_order: i }))
      );
      await refreshCategories();
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
      await adminDb.categories.reorder(
        updated.map((item, i) => ({ id: item.id, sort_order: i }))
      );
      await refreshCategories();
    } catch {
      showToast('error', 'Failed to reorder');
    }
  };

  const startEdit = (item: CategoryRecord) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        Loading categories...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-gray-900">BoQ Categories</h3>
          <p className="text-xs text-gray-500 mt-0.5">Used for cost classification in the BoQ editor</p>
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
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
              }}
              placeholder="Category name"
              autoFocus
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              className="p-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewName(''); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            No categories found
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
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(item.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => handleRename(item.id)} className="p-1 text-emerald-600 hover:text-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => canEdit && startEdit(item)}
                    className={`text-sm text-gray-900 ${canEdit ? 'cursor-pointer hover:text-blue-600' : ''}`}
                  >
                    {item.name}
                  </span>
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
            await adminDb.categories.toggleActive(deletingId, false);
            await loadItems();
            await refreshCategories();
            showToast('success', 'Category deactivated');
          } catch {
            showToast('error', 'Failed to remove category');
          }
          setDeletingId(null);
        }}
        title="Deactivate Category"
        message="This will deactivate the category. Existing BoQ rows using this category will not be affected. You can reactivate it later."
        confirmText="Deactivate"
        variant="danger"
      />
    </div>
  );
}
