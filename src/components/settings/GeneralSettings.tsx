import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../shared/Toast';
import { adminDb } from '../../lib/admin-database';
import { canManageSettings } from '../../lib/permissions';

export default function GeneralSettings() {
  const { user } = useAuth();
  const { settings, updateSettings, refreshAll } = useSettings();
  const { showToast } = useToast();

  const canEdit = user && canManageSettings(user.role);

  const [formData, setFormData] = useState({
    defaultCurrency: settings.defaultCurrency,
    defaultTaxPercent: settings.defaultTaxPercent.toString(),
    roundingDecimals: settings.roundingDecimals.toString(),
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
        defaultCurrency: formData.defaultCurrency,
        defaultTaxPercent: parseFloat(formData.defaultTaxPercent) || 6.0,
        roundingDecimals: parseInt(formData.roundingDecimals) || 2,
      };
      await adminDb.settings.updateBulk(updates, user.id);
      updateSettings(updates);
      await refreshAll();
      setHasChanges(false);
      showToast('success', 'General settings saved');
    } catch {
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      defaultCurrency: 'MYR',
      defaultTaxPercent: '6.0',
      roundingDecimals: '2',
    });
    setHasChanges(true);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-gray-900">General Settings</h3>
          <p className="text-xs text-gray-500 mt-0.5">Currency, tax, and rounding defaults</p>
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Default Currency
          </label>
          <select
            value={formData.defaultCurrency}
            onChange={(e) => handleChange('defaultCurrency', e.target.value)}
            disabled={!canEdit}
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="MYR">MYR - Malaysian Ringgit</option>
            <option value="USD">USD - US Dollar</option>
            <option value="SGD">SGD - Singapore Dollar</option>
            <option value="EUR">EUR - Euro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Default Tax/SST (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.defaultTaxPercent}
            onChange={(e) => handleChange('defaultTaxPercent', e.target.value)}
            disabled={!canEdit}
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Rounding Decimals
          </label>
          <select
            value={formData.roundingDecimals}
            onChange={(e) => handleChange('roundingDecimals', e.target.value)}
            disabled={!canEdit}
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="0">0 decimals</option>
            <option value="2">2 decimals</option>
            <option value="3">3 decimals</option>
            <option value="4">4 decimals</option>
          </select>
        </div>
      </div>
    </div>
  );
}
