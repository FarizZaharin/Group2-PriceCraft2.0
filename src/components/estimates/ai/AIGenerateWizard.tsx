import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ArrowRight,
} from 'lucide-react';
import Modal from '../../shared/Modal';
import ImportStepIndicator from '../import/ImportStepIndicator';
import { db, calculateAmount } from '../../../lib/database';
import { generateDraftBoQ, type AIGeneratedRow, type GenerateBoQResult } from '../../../lib/ai-service';
import { supabase } from '../../../lib/supabase';
import type { Estimate, BoQVersion, SOWVersion } from '../../../types';

interface AIGenerateWizardProps {
  isOpen: boolean;
  onClose: () => void;
  estimate: Estimate;
  versions: BoQVersion[];
  userId: string;
  nextVersionLabel: string;
  roundingRule: number;
  onComplete: (versionId: string) => void;
}

interface SelectableRow extends AIGeneratedRow {
  selected: boolean;
}

const STEPS = ['Configure', 'Generating', 'Review', 'Result'];

const CONFIDENCE_STYLES = {
  high: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-red-100 text-red-800 border-red-200',
};

export default function AIGenerateWizard({
  isOpen,
  onClose,
  estimate,
  versions,
  userId,
  nextVersionLabel,
  roundingRule,
  onComplete,
}: AIGenerateWizardProps) {
  const [step, setStep] = useState(0);
  const [currentSOW, setCurrentSOW] = useState<SOWVersion | null>(null);
  const [loadingSOW, setLoadingSOW] = useState(true);
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState(estimate.location || '');
  const [generating, setGenerating] = useState(false);
  const [generatedRows, setGeneratedRows] = useState<SelectableRow[]>([]);
  const [aiResult, setAiResult] = useState<GenerateBoQResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [resultVersionId, setResultVersionId] = useState<string | null>(null);
  const [resultVersionLabel, setResultVersionLabel] = useState('');
  const [resultRowCount, setResultRowCount] = useState(0);
  const abortRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentSOW();
      if (estimate.duration_value && estimate.duration_unit) {
        setDuration(`${estimate.duration_value} ${estimate.duration_unit}`);
      }
    }
  }, [isOpen, estimate.id]);

  const loadCurrentSOW = async () => {
    setLoadingSOW(true);
    try {
      const sow = await db.sowVersions.getCurrent(estimate.id);
      setCurrentSOW(sow);
    } catch {
      setCurrentSOW(null);
    } finally {
      setLoadingSOW(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentSOW?.sow_text) return;
    setStep(1);
    setGenerating(true);
    setError(null);
    abortRef.current = false;

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const result = await generateDraftBoQ({
        sowText: currentSOW.sow_text,
        category: estimate.category || undefined,
        duration: duration || undefined,
        location: location || undefined,
        estimateClass: estimate.estimate_class || undefined,
      }, accessToken);

      if (abortRef.current) return;

      setAiResult(result);
      setGeneratedRows(result.rows.map((r) => ({ ...r, selected: true })));
      setStep(2);
    } catch (err) {
      if (abortRef.current) return;
      setError(err instanceof Error ? err.message : 'AI generation failed');
      setStep(0);
    } finally {
      setGenerating(false);
    }
  };

  const handleCommit = async () => {
    if (!aiResult || !currentSOW) return;
    setCommitting(true);
    setError(null);

    try {
      const selectedRows = generatedRows.filter((r) => r.selected);
      if (selectedRows.length === 0) {
        setError('Select at least one row to commit');
        setCommitting(false);
        return;
      }

      const latestVersion = versions.length > 0 ? versions[0] : null;
      const newVersion = await db.boqVersions.create({
        estimate_id: estimate.id,
        version_label: nextVersionLabel,
        created_by_user_id: userId,
        is_frozen: false,
        based_on_boq_version_id: latestVersion?.id || null,
      });

      const aiRun = await db.aiRuns.create({
        estimate_id: estimate.id,
        sow_version_id: currentSOW.id,
        output_boq_version_id: newVersion.id,
        model_name: aiResult.model,
        prompt_context: {
          sow_text: currentSOW.sow_text,
          sow_version_label: currentSOW.version_label,
          category: estimate.category,
          duration,
          location,
          estimate_class: estimate.estimate_class,
        },
        output_json: { rows: aiResult.rows, usage: aiResult.usage },
        status: 'Draft',
        accepted_by_user_id: null,
        accepted_at: null,
      });

      let sortOrder = 0;
      let lastSection = '';

      for (const row of selectedRows) {
        if (row.section && row.section !== lastSection) {
          await db.boqRows.create({
            boq_version_id: newVersion.id,
            row_type: 'SectionHeader',
            item_no: '',
            section: row.section,
            description: row.section,
            uom: '',
            qty: null,
            rate: null,
            amount: null,
            measurement: '',
            assumptions: '',
            category: '',
            row_status: 'AIDraft',
            sort_order: sortOrder++,
            external_key: aiRun.id,
          });
          lastSection = row.section;
        }

        const amount = calculateAmount(row.qty, null, roundingRule);
        await db.boqRows.create({
          boq_version_id: newVersion.id,
          row_type: 'LineItem',
          item_no: '',
          section: row.section,
          description: row.description,
          uom: row.uom,
          qty: row.qty,
          rate: null,
          amount,
          measurement: row.measurement,
          assumptions: row.confidence !== 'high'
            ? `[AI confidence: ${row.confidence}]${row.measurement ? ' ' + row.measurement : ''}`
            : '',
          category: row.category,
          row_status: 'AIDraft',
          sort_order: sortOrder++,
          external_key: aiRun.id,
        });
      }

      await db.auditLogs.create({
        estimate_id: estimate.id,
        actor_user_id: userId,
        action_type: 'ai_generate',
        entity_type: 'boq_version',
        entity_id: newVersion.id,
        before_snapshot: null,
        after_snapshot: {
          version_label: newVersion.version_label,
          ai_run_id: aiRun.id,
          model: aiResult.model,
          total_rows: selectedRows.length,
          sow_version: currentSOW.version_label,
        },
      });

      setResultVersionId(newVersion.id);
      setResultVersionLabel(newVersion.version_label);
      setResultRowCount(selectedRows.length);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit AI draft');
    } finally {
      setCommitting(false);
    }
  };

  const handleGoToVersion = () => {
    if (resultVersionId) {
      onComplete(resultVersionId);
    }
    handleClose();
  };

  const handleClose = () => {
    if (generating || committing) return;
    abortRef.current = true;
    setStep(0);
    setGeneratedRows([]);
    setAiResult(null);
    setError(null);
    setResultVersionId(null);
    setResultVersionLabel('');
    setResultRowCount(0);
    onClose();
  };

  const toggleRow = (idx: number) => {
    setGeneratedRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleAll = (selected: boolean) => {
    setGeneratedRows((prev) => prev.map((r) => ({ ...r, selected })));
  };

  const toggleSection = (section: string, selected: boolean) => {
    setGeneratedRows((prev) =>
      prev.map((r) => (r.section === section ? { ...r, selected } : r))
    );
  };

  const selectedCount = generatedRows.filter((r) => r.selected).length;
  const sections = [...new Set(generatedRows.map((r) => r.section))];
  const hasSOW = currentSOW?.sow_text && currentSOW.sow_text.trim().length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="AI Generate BoQ"
      size="xl"
      footer={
        step === 0 ? (
          <>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!hasSOW || loadingSOW}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              Generate Draft BoQ
            </button>
          </>
        ) : step === 1 ? (
          <button
            onClick={() => {
              abortRef.current = true;
              setGenerating(false);
              setStep(0);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        ) : step === 2 ? (
          <>
            <button
              onClick={() => {
                setStep(0);
                setGeneratedRows([]);
                setAiResult(null);
              }}
              disabled={committing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleClose}
              disabled={committing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              disabled={selectedCount === 0 || committing}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create Draft Version ({selectedCount} rows)
                </>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        )
      }
    >
      <ImportStepIndicator currentStep={step} steps={STEPS} />

      {error && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {step === 0 && <StepConfigure
        estimate={estimate}
        currentSOW={currentSOW}
        loadingSOW={loadingSOW}
        hasSOW={!!hasSOW}
        duration={duration}
        setDuration={setDuration}
        location={location}
        setLocation={setLocation}
      />}

      {step === 1 && <StepGenerating />}

      {step === 2 && (
        <StepReview
          rows={generatedRows}
          sections={sections}
          selectedCount={selectedCount}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onToggleSection={toggleSection}
        />
      )}

      {step === 3 && (
        <StepResult
          versionLabel={resultVersionLabel}
          rowCount={resultRowCount}
          onGoToVersion={handleGoToVersion}
        />
      )}
    </Modal>
  );
}

function StepConfigure({
  estimate,
  currentSOW,
  loadingSOW,
  hasSOW,
  duration,
  setDuration,
  location,
  setLocation,
}: {
  estimate: Estimate;
  currentSOW: SOWVersion | null;
  loadingSOW: boolean;
  hasSOW: boolean;
  duration: string;
  setDuration: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          SOW Input
        </label>
        {loadingSOW ? (
          <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading current SOW...
          </div>
        ) : hasSOW ? (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-h-48 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">
                {currentSOW?.version_label} (current)
              </span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
              {currentSOW?.sow_text}
            </pre>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-6 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">No SOW defined</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Add a Scope of Work in the SOW tab before generating a BoQ.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Duration (optional)
          </label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 12 months"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location (optional)
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Kuala Lumpur"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {estimate.category && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Category: <strong className="text-gray-700">{estimate.category}</strong></span>
          {estimate.estimate_class && (
            <>
              <span className="text-gray-300">|</span>
              <span>Class: <strong className="text-gray-700">{estimate.estimate_class}</strong></span>
            </>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-md">
        <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          AI will analyze the SOW and generate a draft Bill of Quantities. All generated rows
          will be marked as <strong>AI Draft</strong> and must be reviewed and accepted before use.
        </p>
      </div>
    </div>
  );
}

function StepGenerating() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-teal-600" />
        </div>
        <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-gray-900">Analyzing Scope of Work</p>
        <p className="text-sm text-gray-500 mt-1">
          Generating draft Bill of Quantities...
        </p>
        <p className="text-xs text-gray-400 mt-3">This may take 15-30 seconds</p>
      </div>
    </div>
  );
}

function StepReview({
  rows,
  sections,
  selectedCount,
  onToggleRow,
  onToggleAll,
  onToggleSection,
}: {
  rows: SelectableRow[];
  sections: string[];
  selectedCount: number;
  onToggleRow: (idx: number) => void;
  onToggleAll: (selected: boolean) => void;
  onToggleSection: (section: string, selected: boolean) => void;
}) {
  const allSelected = rows.every((r) => r.selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <strong className="text-gray-900">{rows.length}</strong> line items generated across{' '}
          <strong className="text-gray-900">{sections.length}</strong> sections.
          Select the rows to include in the draft version.
        </p>
        <button
          onClick={() => onToggleAll(!allSelected)}
          className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="border-b border-gray-200">
              <th className="w-10 px-3 py-2.5" />
              <th className="text-left px-3 py-2.5 font-medium text-gray-600">Description</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-16">UOM</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-20">Qty</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-24">Category</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600 w-24">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sections.map((section) => {
              const sectionRows = rows
                .map((r, i) => ({ ...r, originalIndex: i }))
                .filter((r) => r.section === section);
              const allInSectionSelected = sectionRows.every((r) => r.selected);

              return (
                <SectionGroup
                  key={section}
                  section={section}
                  rows={sectionRows}
                  allSelected={allInSectionSelected}
                  onToggleSection={() => onToggleSection(section, !allInSectionSelected)}
                  onToggleRow={onToggleRow}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-500">
          {selectedCount} of {rows.length} rows selected
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> High
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Low
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionGroup({
  section,
  rows,
  allSelected,
  onToggleSection,
  onToggleRow,
}: {
  section: string;
  rows: (SelectableRow & { originalIndex: number })[];
  allSelected: boolean;
  onToggleSection: () => void;
  onToggleRow: (idx: number) => void;
}) {
  return (
    <>
      <tr className="bg-slate-100">
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSection}
            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
        </td>
        <td colSpan={5} className="px-3 py-2 font-semibold text-gray-900 text-xs uppercase tracking-wide">
          {section}
        </td>
      </tr>
      {rows.map((row) => (
        <tr
          key={row.originalIndex}
          className={`transition-colors ${row.selected ? 'bg-white' : 'bg-gray-50/50 opacity-60'}`}
        >
          <td className="px-3 py-2">
            <input
              type="checkbox"
              checked={row.selected}
              onChange={() => onToggleRow(row.originalIndex)}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
          </td>
          <td className="px-3 py-2 text-gray-800 max-w-[280px]">
            <span className="block truncate" title={row.description}>
              {row.description}
            </span>
            {row.measurement && (
              <span className="block text-xs text-gray-400 truncate mt-0.5" title={row.measurement}>
                {row.measurement}
              </span>
            )}
          </td>
          <td className="px-3 py-2 text-gray-600">{row.uom}</td>
          <td className="px-3 py-2 text-right font-mono text-gray-700">
            {row.qty !== null ? row.qty : <span className="text-gray-400">TBC</span>}
          </td>
          <td className="px-3 py-2 text-gray-600">{row.category}</td>
          <td className="px-3 py-2 text-center">
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${CONFIDENCE_STYLES[row.confidence]}`}>
              {row.confidence}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

function StepResult({
  versionLabel,
  rowCount,
  onGoToVersion,
}: {
  versionLabel: string;
  rowCount: number;
  onGoToVersion: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-900">Draft BoQ Created</p>
        <p className="text-sm text-gray-600 mt-1">
          Version <strong>{versionLabel}</strong> has been created with{' '}
          <strong>{rowCount}</strong> AI-drafted line items.
        </p>
      </div>

      <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-md max-w-md mt-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          All rows are marked as <strong>AI Draft</strong>. Review each row, adjust quantities
          and rates, then accept or reject them individually or in bulk.
        </p>
      </div>

      <button
        onClick={onGoToVersion}
        className="inline-flex items-center gap-2 px-5 py-2.5 mt-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-colors"
      >
        Go to Draft Version
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
