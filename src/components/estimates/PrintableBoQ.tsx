import { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import type { Estimate, BoQRow, BoQVersion, AddOnConfig, User } from '../../types';
import { calculateSubtotals, calculateAddOns } from '../../lib/database';
import { generateItemNo } from '../../lib/export';

interface PrintableBoQProps {
  estimate: Estimate;
  version: BoQVersion;
  rows: BoQRow[];
  addOnConfig: AddOnConfig | null;
  owner: User | null;
  onClose: () => void;
}

export default function PrintableBoQ({
  estimate,
  version,
  rows,
  addOnConfig,
  owner,
  onClose,
}: PrintableBoQProps) {
  const [ready, setReady] = useState(false);
  const roundingRule = addOnConfig?.rounding_rule ?? 2;
  const subtotals = calculateSubtotals(rows, roundingRule);
  const addOns = addOnConfig ? calculateAddOns(subtotals.grandTotal, addOnConfig) : null;

  const assumptions = rows
    .filter((r) => r.row_type === 'LineItem' && r.assumptions && r.assumptions.trim())
    .map((r, i) => ({
      itemNo: generateItemNo(rows, rows.indexOf(r)),
      description: r.description,
      text: r.assumptions,
      index: i,
    }));

  useEffect(() => {
    setTimeout(() => setReady(true), 100);
  }, []);

  const fmt = (val: number | null) => {
    if (val === null) return '-';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: roundingRule,
      maximumFractionDigits: roundingRule,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const now = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto print-view">
      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Print Preview</h2>
          <span className="text-xs text-gray-500">
            {estimate.title} - {version.version_label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!ready}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="print-content max-w-[210mm] mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{estimate.title}</h1>
          <p className="text-sm text-gray-600 mb-4">
            Bill of Quantities - {version.version_label}
            {version.is_frozen && ' (Frozen)'}
          </p>

          <table className="text-xs text-gray-700 mb-6">
            <tbody>
              <tr>
                <td className="pr-6 py-0.5 font-medium text-gray-500">Category</td>
                <td className="py-0.5">
                  {estimate.category === 'Others' && estimate.category_other
                    ? `${estimate.category} (${estimate.category_other})`
                    : estimate.category}
                </td>
                <td className="pr-6 py-0.5 font-medium text-gray-500 pl-8">Currency</td>
                <td className="py-0.5">{estimate.currency}</td>
              </tr>
              <tr>
                <td className="pr-6 py-0.5 font-medium text-gray-500">Location</td>
                <td className="py-0.5">{estimate.location || '-'}</td>
                <td className="pr-6 py-0.5 font-medium text-gray-500 pl-8">Estimate Class</td>
                <td className="py-0.5">{estimate.estimate_class || '-'}</td>
              </tr>
              <tr>
                <td className="pr-6 py-0.5 font-medium text-gray-500">Owner</td>
                <td className="py-0.5">{owner?.name || '-'}</td>
                <td className="pr-6 py-0.5 font-medium text-gray-500 pl-8">Status</td>
                <td className="py-0.5">{estimate.status}</td>
              </tr>
            </tbody>
          </table>

          <div className="border-t border-gray-300 mb-6" />
        </div>

        <table className="w-full text-xs border-collapse print-table">
          <thead>
            <tr className="border-b-2 border-gray-400">
              <th className="text-left py-2 px-2 font-semibold text-gray-700 w-14">Item</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Description</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700 w-14">UOM</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700 w-16">Qty</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700 w-24">
                Rate ({estimate.currency})
              </th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700 w-28">
                Amount ({estimate.currency})
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isSection = row.row_type === 'SectionHeader';

              return (
                <tr key={row.id}>
                  {isSection ? (
                    <td
                      colSpan={6}
                      className="py-2 px-2 font-bold text-gray-900 bg-gray-100 border-b border-gray-300 text-xs uppercase tracking-wide"
                    >
                      {row.description || row.section}
                    </td>
                  ) : (
                    <>
                      <td className="py-1.5 px-2 text-gray-600 border-b border-gray-100 font-mono">
                        {generateItemNo(rows, index)}
                      </td>
                      <td className="py-1.5 px-2 text-gray-900 border-b border-gray-100">
                        {row.description}
                      </td>
                      <td className="py-1.5 px-2 text-gray-600 border-b border-gray-100">
                        {row.uom}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-700 border-b border-gray-100 font-mono">
                        {fmt(row.qty)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-700 border-b border-gray-100 font-mono">
                        {fmt(row.rate)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-900 border-b border-gray-100 font-mono font-medium">
                        {fmt(row.amount)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {Object.entries(subtotals.bySection).map(([section, total]) => (
              <tr key={`sub-${section}`} className="border-t border-gray-200">
                <td colSpan={5} className="py-1.5 px-2 text-right text-xs font-medium text-gray-500">
                  Subtotal - {section}
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-semibold text-gray-700">
                  {fmt(total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400">
              <td colSpan={5} className="py-2 px-2 text-right font-bold text-gray-900">
                Grand Subtotal
              </td>
              <td className="py-2 px-2 text-right font-mono font-bold text-gray-900">
                {fmt(subtotals.grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        {addOns && addOnConfig && (
          <div className="mt-6 border-t border-gray-300 pt-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Summary with Add-ons</h3>
            <table className="w-64 ml-auto text-xs">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-600">Subtotal</td>
                  <td className="py-1 text-right font-mono text-gray-900">{fmt(addOns.subtotal)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-600">Preliminaries ({addOnConfig.prelims_pct}%)</td>
                  <td className="py-1 text-right font-mono text-gray-700">{fmt(addOns.prelims)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-600">Contingency ({addOnConfig.contingency_pct}%)</td>
                  <td className="py-1 text-right font-mono text-gray-700">{fmt(addOns.contingency)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-600">Profit ({addOnConfig.profit_pct}%)</td>
                  <td className="py-1 text-right font-mono text-gray-700">{fmt(addOns.profit)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-600">Tax / SST ({addOnConfig.tax_pct}%)</td>
                  <td className="py-1 text-right font-mono text-gray-700">{fmt(addOns.tax)}</td>
                </tr>
                <tr className="border-t-2 border-gray-400">
                  <td className="py-2 font-bold text-gray-900">
                    Grand Total ({estimate.currency})
                  </td>
                  <td className="py-2 text-right font-mono font-bold text-gray-900">
                    {fmt(addOns.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {assumptions.length > 0 && (
          <div className="mt-8 border-t border-gray-300 pt-4 print-avoid-break">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Notes and Assumptions</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1.5 px-2 font-semibold text-gray-600 w-14">Item</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-gray-600 w-40">Description</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Assumptions</th>
                </tr>
              </thead>
              <tbody>
                {assumptions.map((a) => (
                  <tr key={a.index} className="border-b border-gray-100">
                    <td className="py-1 px-2 text-gray-500 font-mono">{a.itemNo}</td>
                    <td className="py-1 px-2 text-gray-700">{a.description}</td>
                    <td className="py-1 px-2 text-gray-700">{a.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-10 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
          <span>Generated from PriceCraft</span>
          <span>{now}</span>
        </div>
      </div>
    </div>
  );
}
