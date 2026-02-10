import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { ImportReport } from '../../../lib/import-commit';

interface StepResultProps {
  report: ImportReport | null;
  error: string | null;
  versionLabel: string;
  onGoToVersion: () => void;
}

export default function StepResult({ report, error, versionLabel, onGoToVersion }: StepResultProps) {
  if (error) {
    return (
      <div className="text-center py-6">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Failed</h3>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="text-center py-4">
      <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Import Complete</h3>
      <p className="text-sm text-gray-500 mb-6">
        Data has been imported into version <span className="font-mono font-semibold">{versionLabel}</span>
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto mb-6">
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="text-xl font-bold text-emerald-700">{report.rowsCreated}</div>
          <div className="text-xs text-emerald-600">Created</div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xl font-bold text-blue-700">{report.rowsUpdated}</div>
          <div className="text-xs text-blue-600">Updated</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-xl font-bold text-gray-700">{report.rowsDeleted}</div>
          <div className="text-xs text-gray-500">Deleted</div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="text-xl font-bold text-amber-700">{report.warningCount}</div>
          <div className="text-xs text-amber-600">Warnings</div>
        </div>
      </div>

      {report.warningCount > 0 && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-amber-700 mb-4">
          <AlertTriangle className="h-3.5 w-3.5" />
          Some rows had warnings. Review the imported data for accuracy.
        </div>
      )}

      <button
        onClick={onGoToVersion}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        View Imported BoQ
      </button>
    </div>
  );
}
