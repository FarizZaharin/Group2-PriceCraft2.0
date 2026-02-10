import { useState, useEffect } from 'react';
import {
  Plus,
  Copy,
  Lock,
  ChevronDown,
  Layers,
  Download,
  FileSpreadsheet,
  Printer,
  Upload,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../shared/Toast';
import { db, calculateSubtotals } from '../../lib/database';
import { canEditEstimate, canFreezeVersion, canExportEstimate, canImportBoQ, canUseAI } from '../../lib/permissions';
import { generateBoQCSV, generateSummaryCSV, downloadFile, downloadBinaryFile, sanitizeFilename } from '../../lib/export';
import { generateBoQExcel, generateSummaryExcel } from '../../lib/excel-export';
import { Estimate, BoQVersion, BoQRow, AddOnConfig, User } from '../../types';
import ConfirmDialog from '../shared/ConfirmDialog';
import BoQEditor from './BoQEditor';
import RowCommentsPanel from './RowCommentsPanel';
import PrintableBoQ from './PrintableBoQ';
import ImportWizard from './import/ImportWizard';
import AIGenerateWizard from './ai/AIGenerateWizard';

interface BoQTabProps {
  estimate: Estimate;
}

export default function BoQTab({ estimate }: BoQTabProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [versions, setVersions] = useState<BoQVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [freezeConfirmOpen, setFreezeConfirmOpen] = useState(false);
  const [commentRowId, setCommentRowId] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [printData, setPrintData] = useState<{
    rows: BoQRow[];
    addOnConfig: AddOnConfig | null;
    owner: User | null;
  } | null>(null);

  const isOwner = user?.id === estimate.owner_user_id;
  const canEdit = user && canEditEstimate(user.role, isOwner);
  const canFreeze = user && canFreezeVersion(user.role);
  const canExport = user && canExportEstimate(user.role);
  const canImport = user && canImportBoQ(user.role, isOwner);
  const canAI = user && canUseAI(user.role, isOwner);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const exportAllowed = canExport && selectedVersion && (selectedVersion.is_frozen || user?.role === 'admin');

  useEffect(() => {
    loadVersions();
  }, [estimate.id]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await db.boqVersions.getByEstimateId(estimate.id);
      setVersions(data);
      if (data.length > 0 && !selectedVersionId) {
        const unfrozen = data.find((v) => !v.is_frozen);
        setSelectedVersionId(unfrozen?.id || data[0].id);
      }
    } catch {
      showToast('error', 'Failed to load BoQ versions');
    } finally {
      setLoading(false);
    }
  };

  const getNextVersionLabel = () => {
    if (versions.length === 0) return 'v0.1';
    const latest = versions[0];
    const match = latest.version_label.match(/v(\d+)\.(\d+)/);
    if (match) {
      const minor = parseInt(match[2]) + 1;
      return `v${match[1]}.${minor}`;
    }
    return `v0.${versions.length + 1}`;
  };

  const handleCreateVersion = async () => {
    if (!user) return;
    try {
      const newVersion = await db.boqVersions.create({
        estimate_id: estimate.id,
        version_label: getNextVersionLabel(),
        created_by_user_id: user.id,
        is_frozen: false,
        based_on_boq_version_id: null,
      });
      setVersions((prev) => [newVersion, ...prev]);
      setSelectedVersionId(newVersion.id);
      showToast('success', 'New BoQ version created');
    } catch {
      showToast('error', 'Failed to create version');
    }
  };

  const handleDuplicateVersion = async () => {
    if (!user || !selectedVersionId) return;
    setDuplicating(true);
    try {
      const newVersion = await db.boqVersions.duplicate(
        selectedVersionId,
        getNextVersionLabel(),
        user.id
      );
      setVersions((prev) => [newVersion, ...prev]);
      setSelectedVersionId(newVersion.id);
      showToast('success', 'Version duplicated with all rows');
    } catch {
      showToast('error', 'Failed to duplicate version');
    } finally {
      setDuplicating(false);
    }
  };

  const handleFreezeVersion = async () => {
    if (!selectedVersionId) return;
    try {
      const frozen = await db.boqVersions.freeze(selectedVersionId);
      setVersions((prev) =>
        prev.map((v) => (v.id === frozen.id ? frozen : v))
      );
      showToast('success', 'Version frozen successfully');
    } catch {
      showToast('error', 'Failed to freeze version');
    }
  };

  const fetchExportData = async () => {
    if (!selectedVersionId) return null;
    const [rows, addOnConfig, ownerData] = await Promise.all([
      db.boqRows.getByVersionId(selectedVersionId),
      db.addOnConfigs.getByEstimateId(estimate.id),
      db.users.getById(estimate.owner_user_id),
    ]);
    return { rows, addOnConfig, owner: ownerData };
  };

  const logExport = async (actionType: string) => {
    if (!user || !selectedVersionId) return;
    try {
      await db.auditLogs.create({
        estimate_id: estimate.id,
        actor_user_id: user.id,
        action_type: actionType,
        entity_type: 'boq_version',
        entity_id: selectedVersionId,
        before_snapshot: null,
        after_snapshot: {
          format: actionType,
          version_label: selectedVersion?.version_label,
          exported_at: new Date().toISOString(),
        },
      });
    } catch {
      // audit log failure should not block the export
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await fetchExportData();
      if (!data) return;
      const roundingRule = data.addOnConfig?.rounding_rule ?? 2;
      const csv = generateBoQCSV(data.rows, estimate, data.addOnConfig, roundingRule);
      const filename = `${sanitizeFilename(estimate.title)}_BoQ_${selectedVersion?.version_label || 'export'}.csv`;
      downloadFile(csv, filename, 'text/csv');
      await logExport('export_csv');
      showToast('success', 'BoQ exported as CSV');
    } catch {
      showToast('error', 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSummaryCSV = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await fetchExportData();
      if (!data || !data.addOnConfig) {
        showToast('error', 'No add-on configuration found');
        return;
      }
      const subtotals = calculateSubtotals(data.rows, data.addOnConfig.rounding_rule);
      const csv = generateSummaryCSV(subtotals.grandTotal, data.addOnConfig, estimate.currency);
      const filename = `${sanitizeFilename(estimate.title)}_Summary_${selectedVersion?.version_label || 'export'}.csv`;
      downloadFile(csv, filename, 'text/csv');
      await logExport('export_summary_csv');
      showToast('success', 'Summary exported as CSV');
    } catch {
      showToast('error', 'Failed to export summary');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await fetchExportData();
      if (!data) return;
      const roundingRule = data.addOnConfig?.rounding_rule ?? 2;
      const buffer = generateBoQExcel(data.rows, estimate, data.addOnConfig, roundingRule);
      const filename = `${sanitizeFilename(estimate.title)}_BoQ_${selectedVersion?.version_label || 'export'}.xlsx`;
      downloadBinaryFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await logExport('export_excel');
      showToast('success', 'BoQ exported as Excel');
    } catch {
      showToast('error', 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSummaryExcel = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await fetchExportData();
      if (!data || !data.addOnConfig) {
        showToast('error', 'No add-on configuration found');
        return;
      }
      const subtotals = calculateSubtotals(data.rows, data.addOnConfig.rounding_rule);
      const buffer = generateSummaryExcel(subtotals.grandTotal, data.addOnConfig, estimate.currency);
      const filename = `${sanitizeFilename(estimate.title)}_Summary_${selectedVersion?.version_label || 'export'}.xlsx`;
      downloadBinaryFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await logExport('export_summary_excel');
      showToast('success', 'Summary exported as Excel');
    } catch {
      showToast('error', 'Failed to export summary');
    } finally {
      setExporting(false);
    }
  };

  const handlePrintPreview = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await fetchExportData();
      if (!data) return;
      setPrintData(data);
      setShowPrintView(true);
      await logExport('export_print');
    } catch {
      showToast('error', 'Failed to load print data');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-gray-500">Loading bill of quantities...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-blue-600" />
            <div className="relative">
              <button
                onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                {selectedVersion ? (
                  <>
                    {selectedVersion.version_label}
                    {selectedVersion.is_frozen && (
                      <Lock className="h-3.5 w-3.5 text-amber-600" />
                    )}
                  </>
                ) : (
                  'Select Version'
                )}
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {showVersionDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowVersionDropdown(false)}
                  />
                  <div className="absolute left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                    {versions.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVersionId(v.id);
                          setShowVersionDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${
                          v.id === selectedVersionId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{v.version_label}</span>
                          {v.is_frozen && (
                            <Lock className="h-3 w-3 text-amber-600" />
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(v.created_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {selectedVersion && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{formatDate(selectedVersion.created_at)}</span>
                <span className="text-gray-300">|</span>
                <span>{rowCount} rows</span>
              </div>
            )}
          </div>

          {(canEdit || canImport || canAI || exportAllowed) && (
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  <button
                    onClick={handleCreateVersion}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Version
                  </button>
                  {selectedVersionId && (
                    <button
                      onClick={handleDuplicateVersion}
                      disabled={duplicating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {duplicating ? 'Duplicating...' : 'Duplicate'}
                    </button>
                  )}
                </>
              )}
              {canImport && (
                <button
                  onClick={() => setShowImportWizard(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-300 rounded-md hover:bg-teal-100 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </button>
              )}
              {canAI && (
                <button
                  onClick={() => setShowAIWizard(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 border border-teal-700 rounded-md hover:bg-teal-700 transition-colors shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Generate
                </button>
              )}
              {canFreeze && selectedVersion && !selectedVersion.is_frozen && (
                <button
                  onClick={() => setFreezeConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded-md hover:bg-amber-100 transition-colors"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Freeze
                </button>
              )}
              {exportAllowed && (
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {exporting ? 'Exporting...' : 'Export'}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {showExportMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                      <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                        <button
                          onClick={handleExportCSV}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-t-md"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          Export BoQ CSV
                        </button>
                        <button
                          onClick={handleExportSummaryCSV}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Download className="h-4 w-4 text-blue-600" />
                          Export Summary CSV
                        </button>
                        <button
                          onClick={handleExportExcel}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          Export BoQ as Excel
                        </button>
                        <button
                          onClick={handleExportSummaryExcel}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Download className="h-4 w-4 text-blue-600" />
                          Export Summary as Excel
                        </button>
                        <button
                          onClick={handlePrintPreview}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-b-md"
                        >
                          <Printer className="h-4 w-4 text-gray-600" />
                          Print / Preview
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedVersionId && selectedVersion && (
        <BoQEditor
          estimate={estimate}
          versionId={selectedVersionId}
          isFrozen={selectedVersion.is_frozen}
          onRowCountChange={setRowCount}
          onOpenComments={setCommentRowId}
        />
      )}

      {!selectedVersionId && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No BoQ versions found</p>
          {canEdit && (
            <button
              onClick={handleCreateVersion}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create First Version
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={freezeConfirmOpen}
        onClose={() => setFreezeConfirmOpen(false)}
        onConfirm={handleFreezeVersion}
        title="Freeze Version"
        message={`Are you sure you want to freeze "${selectedVersion?.version_label}"? This action is irreversible. Once frozen, no further edits can be made to this version.`}
        confirmText="Freeze Version"
        variant="danger"
      />

      {commentRowId && (
        <RowCommentsPanel
          rowId={commentRowId}
          estimateOwnerId={estimate.owner_user_id}
          onClose={() => setCommentRowId(null)}
        />
      )}

      {showPrintView && printData && selectedVersion && (
        <PrintableBoQ
          estimate={estimate}
          version={selectedVersion}
          rows={printData.rows}
          addOnConfig={printData.addOnConfig}
          owner={printData.owner}
          onClose={() => setShowPrintView(false)}
        />
      )}

      {user && (
        <ImportWizard
          isOpen={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          estimate={estimate}
          versions={versions}
          userId={user.id}
          nextVersionLabel={getNextVersionLabel()}
          roundingRule={settings.roundingDecimals}
          onImportComplete={(versionId) => {
            loadVersions().then(() => {
              setSelectedVersionId(versionId);
              showToast('success', 'CSV import completed successfully');
            });
          }}
        />
      )}

      {user && (
        <AIGenerateWizard
          isOpen={showAIWizard}
          onClose={() => setShowAIWizard(false)}
          estimate={estimate}
          versions={versions}
          userId={user.id}
          nextVersionLabel={getNextVersionLabel()}
          roundingRule={settings.roundingDecimals}
          onComplete={(versionId) => {
            loadVersions().then(() => {
              setSelectedVersionId(versionId);
              showToast('success', 'AI draft BoQ created successfully');
            });
          }}
        />
      )}
    </div>
  );
}
