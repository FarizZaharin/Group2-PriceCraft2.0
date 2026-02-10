import { ArrowRight, AlertTriangle } from 'lucide-react';
import type { ColumnMapping } from '../../../lib/column-mapper';
import { BOQ_FIELDS } from '../../../lib/column-mapper';

interface StepMappingProps {
  headers: string[];
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
}

export default function StepMapping({ headers, mapping, setMapping }: StepMappingProps) {
  const mappedIndices = new Set(Object.values(mapping));
  const descriptionMapped = mapping['description'] !== undefined && mapping['description'] !== -1;

  const handleChange = (fieldKey: string, csvIndex: number | -1) => {
    const updated = { ...mapping };
    if (csvIndex === -1) {
      delete updated[fieldKey];
    } else {
      updated[fieldKey] = csvIndex;
    }
    setMapping(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Map your CSV columns to BoQ fields. Auto-detected mappings are pre-filled.
        </p>
        {!descriptionMapped && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
            <AlertTriangle className="h-3.5 w-3.5" />
            Description must be mapped
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-0 bg-gray-50 px-4 py-2 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">BoQ Field</span>
          <span className="w-8" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">CSV Column</span>
        </div>

        <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
          {BOQ_FIELDS.map((field) => {
            const currentIdx = mapping[field.key];
            const isMapped = currentIdx !== undefined && currentIdx !== -1;

            return (
              <div
                key={field.key}
                className={`grid grid-cols-[1fr,auto,1fr] items-center gap-0 px-4 py-2.5 ${
                  isMapped ? 'bg-white' : 'bg-gray-50/40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-800 font-medium">{field.label}</span>
                  {field.required && (
                    <span className="text-red-500 text-xs font-bold">*</span>
                  )}
                </div>

                <ArrowRight className={`h-3.5 w-3.5 mx-3 ${isMapped ? 'text-emerald-500' : 'text-gray-300'}`} />

                <select
                  value={currentIdx ?? -1}
                  onChange={(e) => handleChange(field.key, parseInt(e.target.value))}
                  className={`block w-full rounded-md border px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                    isMapped ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-300 bg-white'
                  }`}
                >
                  <option value={-1}>-- Skip --</option>
                  {headers.map((h, i) => {
                    const usedElsewhere = mappedIndices.has(i) && currentIdx !== i;
                    return (
                      <option key={i} value={i} disabled={usedElsewhere}>
                        {h}{usedElsewhere ? ' (used)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
