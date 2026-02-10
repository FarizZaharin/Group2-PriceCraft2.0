import { useState } from 'react';
import { Save, RotateCcw, Percent } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../shared/Toast';
import { adminDb } from '../../lib/admin-database';
import { canManageSettings } from '../../lib/permissions';

export default function DefaultAddOns() {
  const { user } = useAuth();
  const { settings, updateSettings, refreshAll } = useSettings();
  const { showToast } = useToast();

  const canEdit = user && canManageSettings(user.role);

  const [formData, setFormData] = useState({
    defaultPrelimsPct: settings.defaultPrelimsPct.toString(),
    defaultContingencyPct: settings.defaultContingencyPct.toString(),
    defaultProfitPct: settings.defaultProfitPct.toString(),
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates = {
        defaultPrelimsPct: parseFloat(formData.defaultPrelimsPct) || 0,
        defaultContingencyPct: parseFloat(formData.defaultContingencyPct) || 0,
        defaultProfitPct: parseFloat(formData.defaultProfitPct) || 0,
      };
      await adminDb.settings.updateBulk(updates, user.id);
      updateSettings(updates);
      await refreshAll();
      setHasChanges(false);
      showToast('success', 'Default add-on percentages saved');
    } catch {
      showToast('error', 'Failed to save add-on defaults');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      defaultPrelimsPct: '10.0',
      defaultContingencyPct: '5.0',
      defaultProfitPct: '10.0',
    });
    setHasChanges(true);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">Default Add-on Percentages</h3>
            <p className="text-xs text-gray-500 mt-0.5">Applied when new estimates are created</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        <p className="text-sm text-gray-600 bg-gray-50 rounded-md p-3">
          These percentages are used as starting values when a new estimate is created. Users can still adjust them per-estimate in the Summary tab.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Preliminaries (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.defaultPrelimsPct}
              onChange={(e) => handleChange('defaultPrelimsPct', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contingency (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.defaultContingencyPct}
              onChange={(e) => handleChange('defaultContingencyPct', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Profit (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.defaultProfitPct}
              onChange={(e) => handleChange('defaultProfitPct', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Preview Cascade</h4>
          <div className="text-xs text-gray-500 space-y-1 font-mono bg-gray-50 rounded-md p-3">
            <p>Subtotal</p>
            <p>+ Prelims ({formData.defaultPrelimsPct}%)</p>
            <p>+ Contingency ({formData.defaultContingencyPct}%)</p>
            <p>+ Profit ({formData.defaultProfitPct}%)</p>
            <p>+ Tax/SST ({settings.defaultTaxPercent}%)</p>
            <p className="font-semibold text-gray-700 pt-1 border-t border-gray-200">= Grand Total</p>
          </div>
        </div>
      </div>
    </div>
  );
}
