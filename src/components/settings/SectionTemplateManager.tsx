import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../shared/Toast';
import { adminDb } from '../../lib/admin-database';
import { canManageSettings } from '../../lib/permissions';
import { SectionTemplate } from '../../types';
import ConfirmDialog from '../shared/ConfirmDialog';
import SectionTemplateEditor from './SectionTemplateEditor';

export default function SectionTemplateManager() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const canEdit = user && canManageSettings(user.role);

  const [templates, setTemplates] = useState<SectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<SectionTemplate | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await adminDb.sectionTemplates.getAll(false);
      setTemplates(data);
    } catch {
      showToast('error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    try {
      const created = await adminDb.sectionTemplates.create({
        name: newName.trim(),
        description: newDescription.trim(),
        created_by: user.id,
      });
      setCreatingNew(false);
      setNewName('');
      setNewDescription('');
      await loadTemplates();
      setEditingTemplate(created);
      showToast('success', 'Template created');
    } catch {
      showToast('error', 'Failed to create template');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await adminDb.sectionTemplates.delete(deletingId);
      await loadTemplates();
      showToast('success', 'Template deleted');
    } catch {
      showToast('error', 'Failed to delete template');
    }
    setDeletingId(null);
  };

  if (editingTemplate) {
    return (
      <SectionTemplateEditor
        template={editingTemplate}
        onBack={() => {
          setEditingTemplate(null);
          loadTemplates();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        Loading templates...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Section Templates</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Pre-built BoQ section structures that can be reused across estimates
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreatingNew(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Template
            </button>
          )}
        </div>

        {creatingNew && (
          <div className="p-5 border-b border-gray-100 bg-blue-50/50">
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., M&E Standard Section"
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreatingNew(false); setNewName(''); setNewDescription(''); }
                  }}
                  placeholder="Brief description of this template"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => { setCreatingNew(false); setNewName(''); setNewDescription(''); }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {templates.length === 0 && !creatingNew ? (
            <div className="px-5 py-12 text-center">
              <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No section templates yet</p>
              {canEdit && (
                <p className="text-xs text-gray-400 mt-1">Create one to define reusable BoQ structures</p>
              )}
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className={`flex items-center gap-4 px-5 py-4 group hover:bg-gray-50/50 transition-colors ${
                  !template.is_active ? 'opacity-50' : ''
                }`}
              >
                <FileText className="h-5 w-5 text-gray-400 shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{template.name}</p>
                  {template.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{template.description}</p>
                  )}
                </div>

                {!template.is_active && (
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-1.5 py-0.5 bg-gray-100 rounded">
                    Inactive
                  </span>
                )}

                {canEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingTemplate(template)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit template"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingId(template.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setEditingTemplate(template)}
                  className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message="Are you sure you want to delete this template? This will also delete all template rows. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
