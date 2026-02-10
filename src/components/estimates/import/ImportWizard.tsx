import { useState, useMemo } from 'react';
import Modal from '../../shared/Modal';
import ImportStepIndicator from './ImportStepIndicator';
import StepTarget, { type ImportTarget } from './StepTarget';
import StepUpload from './StepUpload';
import StepMapping from './StepMapping';
import StepPreview from './StepPreview';
import StepResult from './StepResult';
import type { Estimate, BoQVersion } from '../../../types';
import type { ParsedCSV } from '../../../lib/csv-parser';
import { autoMapColumns, type ColumnMapping } from '../../../lib/column-mapper';
import { validateImportRows, type ValidationResult } from '../../../lib/import-validator';
import { executeImport, type ImportReport } from '../../../lib/import-commit';
import { downloadFile } from '../../../lib/export';
import { generateImportTemplateXLSX } from '../../../lib/excel-parser';
import { db } from '../../../lib/database';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  estimate: Estimate;
  versions: BoQVersion[];
  userId: string;
  nextVersionLabel: string;
  roundingRule: number;
  onImportComplete: (versionId: string) => void;
}

const STEPS = ['Target', 'Upload', 'Mapping', 'Preview', 'Result'];

export default function ImportWizard({
  isOpen,
  onClose,
  estimate,
  versions,
  userId,
  nextVersionLabel,
  roundingRule,
  onImportComplete,
}: ImportWizardProps) {
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<ImportTarget>('new');
  const [existingVersionId, setExistingVersionId] = useState('');
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState<ArrayBuffer | Blob | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [resultVersionId, setResultVersionId] = useState<string | null>(null);
  const [resultVersionLabel, setResultVersionLabel] = useState('');

  const unfrozenVersions = useMemo(
    () => versions.filter((v) => !v.is_frozen),
    [versions]
  );

  const canProceed = () => {
    switch (step) {
      case 0:
        return target === 'new' || (target === 'existing' && existingVersionId !== '');
      case 1:
        return parsedCSV !== null;
      case 2:
        return mapping['description'] !== undefined && mapping['description'] !== -1;
      case 3:
        return validation !== null && validation.errors.length === 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step === 1 && parsedCSV) {
      const autoMapped = autoMapColumns(parsedCSV.headers);
      setMapping(autoMapped);
    }

    if (step === 2 && parsedCSV) {
      const result = validateImportRows(parsedCSV.rows, mapping);
      setValidation(result);
    }

    if (step === 3) {
      handleCommit();
      return;
    }

    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step === 3) {
      setValidation(null);
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const handleCommit = async () => {
    if (!validation || !parsedCSV) return;
    setCommitting(true);
    setCommitError(null);

    try {
      let versionId: string;
      let versionLabel: string;

      if (target === 'new') {
        const latestVersion = versions.length > 0 ? versions[0] : null;
        const newVersion = await db.boqVersions.create({
          estimate_id: estimate.id,
          version_label: nextVersionLabel,
          created_by_user_id: userId,
          is_frozen: false,
          based_on_boq_version_id: latestVersion?.id || null,
        });
        versionId = newVersion.id;
        versionLabel = newVersion.version_label;

        await db.auditLogs.create({
          estimate_id: estimate.id,
          actor_user_id: userId,
          action_type: 'create_version_via_import',
          entity_type: 'boq_version',
          entity_id: newVersion.id,
          before_snapshot: null,
          after_snapshot: { version_label: newVersion.version_label },
        });
      } else {
        versionId = existingVersionId;
        const existing = versions.find((v) => v.id === existingVersionId);
        versionLabel = existing?.version_label || '';
      }

      const result = await executeImport(
        validation.validRows,
        versionId,
        estimate.id,
        userId,
        validation.warnings.length,
        roundingRule,
        fileName,
        fileType,
        fileData
      );

      setReport(result);
      setResultVersionId(versionId);
      setResultVersionLabel(versionLabel);
      setStep(4);
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Import failed unexpectedly.');
      setStep(4);
    } finally {
      setCommitting(false);
    }
  };

  const handleGoToVersion = () => {
    if (resultVersionId) {
      onImportComplete(resultVersionId);
    }
    onClose();
  };

  const handleDownloadTemplate = () => {
    const buffer = generateImportTemplateXLSX();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boq_import_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    if (committing) return;
    setStep(0);
    setTarget('new');
    setExistingVersionId('');
    setParsedCSV(null);
    setFileName('');
    setFileData(null);
    setFileType(null);
    setMapping({});
    setValidation(null);
    setReport(null);
    setCommitError(null);
    setResultVersionId(null);
    setResultVersionLabel('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import BoQ"
      size="xl"
      footer={
        step < 4 ? (
          <>
            {step > 0 && (
              <button
                onClick={handleBack}
                disabled={committing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              onClick={handleClose}
              disabled={committing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed() || committing}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing
                ? 'Importing...'
                : step === 3
                  ? 'Commit Import'
                  : 'Next'}
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

      {step === 0 && (
        <StepTarget
          target={target}
          setTarget={setTarget}
          existingVersionId={existingVersionId}
          setExistingVersionId={setExistingVersionId}
          unfrozenVersions={unfrozenVersions}
          nextVersionLabel={nextVersionLabel}
          onDownloadTemplate={handleDownloadTemplate}
        />
      )}

      {step === 1 && (
        <StepUpload
          parsedCSV={parsedCSV}
          setParsedCSV={setParsedCSV}
          fileName={fileName}
          setFileName={setFileName}
          setFileData={setFileData}
          setFileType={setFileType}
        />
      )}

      {step === 2 && parsedCSV && (
        <StepMapping
          headers={parsedCSV.headers}
          mapping={mapping}
          setMapping={setMapping}
        />
      )}

      {step === 3 && validation && (
        <StepPreview
          validation={validation}
          roundingRule={roundingRule}
        />
      )}

      {step === 4 && (
        <StepResult
          report={report}
          error={commitError}
          versionLabel={resultVersionLabel}
          onGoToVersion={handleGoToVersion}
        />
      )}
    </Modal>
  );
}
