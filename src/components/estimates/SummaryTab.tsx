import { useState, useEffect, useCallback } from 'react';
import { Calculator, RotateCcw, Save, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../shared/Toast';
import { db, calculateSubtotals, calculateAddOns } from '../../lib/database';
import { canEditEstimate, canExportEstimate } from '../../lib/permissions';
import { generateSummaryCSV, downloadFile, sanitizeFilename } from '../../lib/export';
import { Estimate, AddOnConfig, BoQRow, BoQVersion } from '../../types';

interface SummaryTabProps {
  estimate: Estimate;
}

interface AddOnFormData {
  prelims_pct: string;
  contingency_pct: string;
  profit_pct: string;
  tax_pct: string;
  rounding_rule: string;
}

export default function SummaryTab({ estimate }: SummaryTabProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [config, setConfig] = useState<AddOnConfig | null>(null);
  const [formData, setFormData] = useState<AddOnFormData>({
    prelims_pct: '10',
    contingency_pct: '5',
    profit_pct: '10',
    tax_pct: settings.defaultTaxPercent.toString(),
    rounding_rule: '2',
  });
  const [rows, setRows] = useState<BoQRow[]>([]);
  const [versions, setVersions] = useState<BoQVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [exportingSummary, setExportingSummary] = useState(false);

  const isOwner = user?.id === estimate.owner_user_id;
  const canEdit = user && canEditEstimate(user.role, isOwner);
  const canExport = user && canExportEstimate(user.role);

  useEffect(() => {
    loadData();
  }, [estimate.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [addOnConfig, boqVersions] = await Promise.all([
        db.addOnConfigs.getByEstimateId(estimate.id),
        db.boqVersions.getByEstimateId(estimate.id),
      ]);

      setConfig(addOnConfig);
      setVersions(boqVersions);

      if (addOnConfig) {
        setFormData({
          prelims_pct: addOnConfig.prelims_pct.toString(),
          contingency_pct: addOnConfig.contingency_pct.toString(),
          profit_pct: addOnConfig.profit_pct.toString(),
          tax_pct: addOnConfig.tax_pct.toString(),
          rounding_rule: addOnConfig.rounding_rule.toString(),
        });
      }

      if (boqVersions.length > 0) {
        const latest = boqVersions.find((v) => !v.is_frozen) || boqVersions[0];
        const boqRows = await db.boqRows.getByVersionId(latest.id);
        setRows(boqRows);
      }
    } catch {
      showToast('error', 'Failed to load summary data');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof AddOnFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.addOnConfigs.update(estimate.id, {
        prelims_pct: parseFloat(formData.prelims_pct) || 0,
        contingency_pct: parseFloat(formData.contingency_pct) || 0,
        profit_pct: parseFloat(formData.profit_pct) || 0,
        tax_pct: parseFloat(formData.tax_pct) || 0,
        rounding_rule: parseInt(formData.rounding_rule) || 2,
      });
      setHasChanges(false);
      showToast('success', 'Add-on configuration saved');
    } catch {
      showToast('error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      prelims_pct: settings.defaultPrelimsPct.toString(),
      contingency_pct: settings.defaultContingencyPct.toString(),
      profit_pct: settings.defaultProfitPct.toString(),
      tax_pct: settings.defaultTaxPercent.toString(),
      rounding_rule: settings.roundingDecimals.toString(),
    });
    setHasChanges(true);
  };

  const currentConfig: AddOnConfig = {
    id: config?.id || '',
    estimate_id: estimate.id,
    prelims_pct: parseFloat(formData.prelims_pct) || 0,
    contingency_pct: parseFloat(formData.contingency_pct) || 0,
    profit_pct: parseFloat(formData.profit_pct) || 0,
    tax_pct: parseFloat(formData.tax_pct) || 0,
    rounding_rule: parseInt(formData.rounding_rule) || 2,
    created_at: config?.created_at || '',
    updated_at: config?.updated_at || '',
  };

  const subtotals = calculateSubtotals(rows, currentConfig.rounding_rule);
  const addOns = calculateAddOns(subtotals.grandTotal, currentConfig);

  const handleExportSummary = async () => {
    if (!config) return;
    setExportingSummary(true);
    try {
      const csv = generateSummaryCSV(subtotals.grandTotal, currentConfig, estimate.currency);
      const versionLabel = versions.length > 0 ? versions[0].version_label : 'export';
      const filename = `${sanitizeFilename(estimate.title)}_Summary_${versionLabel}.csv`;
      downloadFile(csv, filename, 'text/csv');

      if (user) {
        await db.auditLogs.create({
          estimate_id: estimate.id,
          actor_user_id: user.id,
          action_type: 'export_summary_csv',
          entity_type: 'addon_config',
          entity_id: config.id,
          before_snapshot: null,
          after_snapshot: {
            format: 'summary_csv',
            exported_at: new Date().toISOString(),
          },
        });
      }

      showToast('success', 'Summary exported as CSV');
    } catch {
      showToast('error', 'Failed to export summary');
    } finally {
      setExportingSummary(false);
    }
  };

  const formatCurrency = useCallback(
    (amount: number) => {
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: currentConfig.rounding_rule,
        maximumFractionDigits: currentConfig.rounding_rule,
      });
    },
    [currentConfig.rounding_rule]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-gray-500">Loading summary...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">Add-on Configuration</h3>
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

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preliminaries (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.prelims_pct}
              onChange={(e) => handleFieldChange('prelims_pct', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contingency (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.contingency_pct}
              onChange={(e) => handleFieldChange('contingency_pct', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profit (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.profit_pct}
              onChange={(e) => handleFieldChange('profit_pct', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax / SST (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.tax_pct}
              onChange={(e) => handleFieldChange('tax_pct', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rounding (decimal places)
            </label>
            <select
              value={formData.rounding_rule}
              onChange={(e) => handleFieldChange('rounding_rule', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="0">0 decimals</option>
              <option value="1">1 decimal</option>
              <option value="2">2 decimals</option>
              <option value="3">3 decimals</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Totals Breakdown</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {versions.length > 0
                  ? `Based on latest BoQ version (${versions[0].version_label})`
                  : 'No BoQ data available'}
              </p>
            </div>
            {canExport && rows.length > 0 && (
              <button
                onClick={handleExportSummary}
                disabled={exportingSummary}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-300 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {exportingSummary ? 'Exporting...' : 'Export CSV'}
              </button>
            )}
          </div>

          <div className="p-5">
            {rows.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No BoQ rows to calculate</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Line Items Subtotal</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {estimate.currency} {formatCurrency(addOns.subtotal)}
                  </span>
                </div>

                <div className="border-t border-dashed border-gray-200" />

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-600">
                    + Preliminaries ({formData.prelims_pct}%)
                  </span>
                  <span className="text-sm font-mono text-gray-700">
                    {estimate.currency} {formatCurrency(addOns.prelims)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-600">
                    + Contingency ({formData.contingency_pct}%)
                  </span>
                  <span className="text-sm font-mono text-gray-700">
                    {estimate.currency} {formatCurrency(addOns.contingency)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-600">
                    + Profit ({formData.profit_pct}%)
                  </span>
                  <span className="text-sm font-mono text-gray-700">
                    {estimate.currency} {formatCurrency(addOns.profit)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-600">
                    + Tax / SST ({formData.tax_pct}%)
                  </span>
                  <span className="text-sm font-mono text-gray-700">
                    {estimate.currency} {formatCurrency(addOns.tax)}
                  </span>
                </div>

                <div className="border-t-2 border-gray-300 pt-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-gray-900">Grand Total</span>
                    <span className="text-lg font-mono font-bold text-gray-900">
                      {estimate.currency} {formatCurrency(addOns.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {rows.length > 0 && Object.keys(subtotals.byCategory).length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Category Breakdown</h3>
            </div>
            <div className="p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-600">Category</th>
                    <th className="text-right py-2 font-medium text-gray-600">Amount</th>
                    <th className="text-right py-2 font-medium text-gray-600 w-20">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(subtotals.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => {
                      const pct =
                        subtotals.grandTotal > 0
                          ? (amount / subtotals.grandTotal) * 100
                          : 0;
                      return (
                        <tr key={category}>
                          <td className="py-2 text-gray-800">{category}</td>
                          <td className="py-2 text-right font-mono text-gray-700">
                            {estimate.currency} {formatCurrency(amount)}
                          </td>
                          <td className="py-2 text-right text-gray-500">
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300">
                    <td className="py-2 font-semibold text-gray-900">Total</td>
                    <td className="py-2 text-right font-mono font-semibold text-gray-900">
                      {estimate.currency} {formatCurrency(subtotals.grandTotal)}
                    </td>
                    <td className="py-2 text-right font-semibold text-gray-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
