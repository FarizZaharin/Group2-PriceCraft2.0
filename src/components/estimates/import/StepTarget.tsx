import { FileDown, Plus, FolderOpen } from 'lucide-react';
import type { BoQVersion } from '../../../types';

export type ImportTarget = 'new' | 'existing';

interface StepTargetProps {
  target: ImportTarget;
  setTarget: (t: ImportTarget) => void;
  existingVersionId: string;
  setExistingVersionId: (id: string) => void;
  unfrozenVersions: BoQVersion[];
  nextVersionLabel: string;
  onDownloadTemplate: () => void;
}

export default function StepTarget({
  target,
  setTarget,
  existingVersionId,
  setExistingVersionId,
  unfrozenVersions,
  nextVersionLabel,
  onDownloadTemplate,
}: StepTargetProps) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Choose where to import your spreadsheet data. You can create a fresh BoQ version or add rows to an existing unfrozen version.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setTarget('new')}
          className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
            target === 'new'
              ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-200'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <Plus className={`h-5 w-5 mt-0.5 shrink-0 ${target === 'new' ? 'text-blue-600' : 'text-gray-400'}`} />
          <div>
            <div className="text-sm font-semibold text-gray-900">Create new version</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Will be labeled <span className="font-mono font-medium">{nextVersionLabel}</span>
            </div>
          </div>
        </button>

        <button
          onClick={() => setTarget('existing')}
          disabled={unfrozenVersions.length === 0}
          className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
            target === 'existing'
              ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-200'
              : unfrozenVersions.length === 0
                ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <FolderOpen className={`h-5 w-5 mt-0.5 shrink-0 ${target === 'existing' ? 'text-blue-600' : 'text-gray-400'}`} />
          <div>
            <div className="text-sm font-semibold text-gray-900">Import into existing version</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {unfrozenVersions.length === 0
                ? 'No unfrozen versions available'
                : `${unfrozenVersions.length} unfrozen version${unfrozenVersions.length > 1 ? 's' : ''} available`}
            </div>
          </div>
        </button>
      </div>

      {target === 'existing' && unfrozenVersions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Select version
          </label>
          <select
            value={existingVersionId}
            onChange={(e) => setExistingVersionId(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Select --</option>
            {unfrozenVersions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.version_label} (created {new Date(v.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="pt-2 border-t border-gray-100">
        <button
          onClick={onDownloadTemplate}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          <FileDown className="h-4 w-4" />
          Download Excel template
        </button>
        <p className="text-xs text-gray-500 mt-1">
          Use this template to prepare your import file with the correct column headers. CSV files are also accepted.
        </p>
      </div>
    </div>
  );
}
