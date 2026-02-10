import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { ValidationResult } from '../../../lib/import-validator';
import { calculateAmount } from '../../../lib/database';

interface StepPreviewProps {
  validation: ValidationResult;
  roundingRule: number;
}

export default function StepPreview({ validation, roundingRule }: StepPreviewProps) {
  const [showErrors, setShowErrors] = useState(validation.errors.length > 0);
  const [showWarnings, setShowWarnings] = useState(false);

  const previewRows = validation.validRows.slice(0, 50);
  const hasBlockingErrors = validation.errors.length > 0;
  const deleteCount = validation.validRows.filter((r) => r.action === 'DELETE').length;
  const upsertCount = validation.validRows.filter((r) => r.action === 'UPSERT').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <div className="text-lg font-bold text-gray-900">{validation.totalParsedRows}</div>
          <div className="text-xs text-gray-500">Total Rows</div>
        </div>
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
          <div className="text-lg font-bold text-emerald-700">{upsertCount}</div>
          <div className="text-xs text-emerald-600">Valid (Upsert)</div>
        </div>
        {deleteCount > 0 && (
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
            <div className="text-lg font-bold text-orange-700">{deleteCount}</div>
            <div className="text-xs text-orange-600">To Delete</div>
          </div>
        )}
        <div className={`p-3 rounded-lg border text-center ${
          hasBlockingErrors ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className={`text-lg font-bold ${hasBlockingErrors ? 'text-red-700' : 'text-gray-900'}`}>
            {validation.errors.length}
          </div>
          <div className={`text-xs ${hasBlockingErrors ? 'text-red-600' : 'text-gray-500'}`}>Errors</div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
          <div className="text-lg font-bold text-amber-700">{validation.warnings.length}</div>
          <div className="text-xs text-amber-600">Warnings</div>
        </div>
      </div>

      {hasBlockingErrors && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            Import is blocked due to {validation.errors.length} validation error{validation.errors.length > 1 ? 's' : ''}. Fix the issues below and re-upload.
          </p>
        </div>
      )}

      {!hasBlockingErrors && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-700">
            All rows passed validation. Ready to commit.
          </p>
        </div>
      )}

      {validation.errors.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors"
          >
            <span>Errors ({validation.errors.length})</span>
            {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showErrors && (
            <div className="max-h-48 overflow-y-auto divide-y divide-red-100">
              {validation.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 px-4 py-2 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="border border-amber-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowWarnings(!showWarnings)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <span>Warnings ({validation.warnings.length})</span>
            {showWarnings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showWarnings && (
            <div className="max-h-48 overflow-y-auto divide-y divide-amber-100">
              {validation.warnings.map((warn, i) => (
                <div key={i} className="flex items-start gap-2 px-4 py-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {warn.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {previewRows.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5">
            Preview (first {Math.min(50, validation.validRows.length)} valid rows)
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 sticky top-0">
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200">#</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200">Type</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200">Description</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200">UOM</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600 border-b border-gray-200">Qty</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600 border-b border-gray-200">Rate</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600 border-b border-gray-200">Amount</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200">Category</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => {
                    const amt = calculateAmount(row.qty, row.rate, roundingRule);
                    const isSection = row.row_type === 'SectionHeader';
                    const isDelete = row.action === 'DELETE';
                    return (
                      <tr
                        key={i}
                        className={`border-b border-gray-100 ${
                          isSection ? 'bg-slate-100 font-semibold' : isDelete ? 'bg-red-50/40' : ''
                        }`}
                      >
                        <td className="px-2 py-1 text-gray-400">{row.rowIndex + 2}</td>
                        <td className="px-2 py-1 text-gray-600">{row.row_type}</td>
                        <td className="px-2 py-1 text-gray-800 max-w-[180px] truncate">{row.description}</td>
                        <td className="px-2 py-1 text-gray-600">{row.uom}</td>
                        <td className="px-2 py-1 text-right font-mono text-gray-700">{row.qty ?? ''}</td>
                        <td className="px-2 py-1 text-right font-mono text-gray-700">{row.rate ?? ''}</td>
                        <td className="px-2 py-1 text-right font-mono text-gray-700">
                          {amt !== null ? amt.toFixed(roundingRule) : ''}
                        </td>
                        <td className="px-2 py-1 text-gray-600">{row.category}</td>
                        <td className="px-2 py-1">
                          {isDelete ? (
                            <span className="text-red-600 font-medium">DELETE</span>
                          ) : (
                            <span className="text-emerald-600">Upsert</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
