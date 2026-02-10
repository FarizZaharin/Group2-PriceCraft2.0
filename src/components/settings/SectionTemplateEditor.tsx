import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Save, ChevronUp, ChevronDown, LayoutList } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../shared/Toast';
import { adminDb } from '../../lib/admin-database';
import { canManageSettings } from '../../lib/permissions';
import { SectionTemplate, SectionTemplateRow, RowType } from '../../types';

interface SectionTemplateEditorProps {
  template: SectionTemplate;
  onBack: () => void;
}

interface LocalRow {
  id?: string;
  row_type: RowType;
  section: string;
  description: string;
  uom: string;
  category: string;
  sort_order: number;
  isNew?: boolean;
}

export default function SectionTemplateEditor({ template, onBack }: SectionTemplateEditorProps) {
  const { user } = useAuth();
  const { categoryNames, uomCodes } = useSettings();
  const { showToast } = useToast();

  const canEdit = user && canManageSettings(user.role);

  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadRows();
  }, [template.id]);

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await adminDb.templateRows.getByTemplateId(template.id);
      setRows(data.map((r) => ({ ...r })));
    } catch {
      showToast('error', 'Failed to load template rows');
    } finally {
      setLoading(false);
    }
  };

  const addRow = (type: RowType) => {
    const maxSort = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
    setRows([
      ...rows,
      {
        row_type: type,
        section: type === 'SectionHeader' ? 'New Section' : '',
        description: type === 'SectionHeader' ? 'Section Header' : '',
        uom: type === 'LineItem' ? (uomCodes[0] || 'LS') : '',
        category: type === 'LineItem' ? (categoryNames[0] || 'Labour') : '',
        sort_order: maxSort,
        isNew: true,
      },
    ]);
    setHasChanges(true);
  };

  const updateRow = (index: number, field: keyof LocalRow, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      (updated[index] as unknown as Record<string, unknown>)[field] = value;
      return updated;
    });
    setHasChanges(true);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const moveRow = (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const updated = [...rows];
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    setRows(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminDb.sectionTemplates.update(template.id, {
        name: name.trim(),
        description: description.trim(),
      });

      const templateRows: Omit<SectionTemplateRow, 'id'>[] = rows.map((r, i) => ({
        template_id: template.id,
        row_type: r.row_type,
        section: r.section,
        description: r.description,
        uom: r.uom,
        category: r.category,
        sort_order: i,
      }));

      await adminDb.templateRows.replaceAll(template.id, templateRows);
      setHasChanges(false);
      showToast('success', 'Template saved');
    } catch {
      showToast('error', 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900">Edit Template</h3>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900">Template Rows</h4>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => addRow('LineItem')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Line Item
              </button>
              <button
                onClick={() => addRow('SectionHeader')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <LayoutList className="h-3 w-3" />
                Section
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading rows...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No rows yet. Add section headers and line items to build this template.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-10" />
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">Section</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">UOM</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">Category</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, index) => (
                  <tr
                    key={index}
                    className={row.row_type === 'SectionHeader' ? 'bg-slate-50' : ''}
                  >
                    <td className="px-3 py-2 text-gray-400 text-xs font-mono">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${
                        row.row_type === 'SectionHeader'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {row.row_type === 'SectionHeader' ? 'Section' : 'Line Item'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.section}
                        onChange={(e) => updateRow(index, 'section', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateRow(index, 'description', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {row.row_type === 'LineItem' ? (
                        <select
                          value={row.uom}
                          onChange={(e) => updateRow(index, 'uom', e.target.value)}
                          disabled={!canEdit}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:border-transparent"
                        >
                          {uomCodes.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.row_type === 'LineItem' ? (
                        <select
                          value={row.category}
                          onChange={(e) => updateRow(index, 'category', e.target.value)}
                          disabled={!canEdit}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:border-transparent"
                        >
                          {categoryNames.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {canEdit && (
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => moveRow(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveRow(index, 'down')}
                            disabled={index === rows.length - 1}
                            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => removeRow(index)}
                            className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
