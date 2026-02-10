import type { BoQRow, Estimate, AddOnConfig } from '../types';
import { calculateSubtotals, calculateAddOns } from './database';

function escapeCSV(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatNumber(value: number | null, decimals: number): string {
  if (value === null) return '';
  return value.toFixed(decimals);
}

export function generateItemNo(rows: BoQRow[], index: number): string {
  const row = rows[index];
  if (row.row_type === 'SectionHeader') return '';
  let sectionCount = 0;
  let itemInSection = 0;
  for (let i = 0; i <= index; i++) {
    if (rows[i].row_type === 'SectionHeader') {
      sectionCount++;
      itemInSection = 0;
    } else {
      itemInSection++;
    }
  }
  return sectionCount > 0 ? `${sectionCount}.${itemInSection}` : `${itemInSection}`;
}

export function generateBoQCSV(
  rows: BoQRow[],
  estimate: Estimate,
  addOnConfig: AddOnConfig | null,
  roundingRule: number
): string {
  const subtotals = calculateSubtotals(rows, roundingRule);
  const lines: string[] = [];

  lines.push(
    [
      escapeCSV('Item No'),
      escapeCSV('Section'),
      escapeCSV('Description'),
      escapeCSV('UOM'),
      escapeCSV('Qty'),
      escapeCSV(`Rate (${estimate.currency})`),
      escapeCSV(`Amount (${estimate.currency})`),
      escapeCSV('Category'),
      escapeCSV('Measurement'),
      escapeCSV('Assumptions'),
    ].join(',')
  );

  let currentSection = '';
  rows.forEach((row, index) => {
    if (row.row_type === 'SectionHeader') {
      currentSection = row.section || row.description;
      lines.push(
        [
          escapeCSV(''),
          escapeCSV(currentSection),
          escapeCSV(row.description),
          '', '', '', '', '', '', '',
        ].join(',')
      );
    } else {
      lines.push(
        [
          escapeCSV(generateItemNo(rows, index)),
          escapeCSV(row.section),
          escapeCSV(row.description),
          escapeCSV(row.uom),
          escapeCSV(formatNumber(row.qty, roundingRule)),
          escapeCSV(formatNumber(row.rate, roundingRule)),
          escapeCSV(formatNumber(row.amount, roundingRule)),
          escapeCSV(row.category),
          escapeCSV(row.measurement),
          escapeCSV(row.assumptions),
        ].join(',')
      );
    }

    const isLastInSection =
      index === rows.length - 1 || rows[index + 1]?.row_type === 'SectionHeader';
    if (isLastInSection && currentSection && subtotals.bySection[currentSection] !== undefined) {
      lines.push(
        [
          '', '', escapeCSV(`Subtotal - ${currentSection}`),
          '', '', '',
          escapeCSV(formatNumber(subtotals.bySection[currentSection], roundingRule)),
          '', '', '',
        ].join(',')
      );
    }
  });

  lines.push('');
  lines.push(
    ['', '', escapeCSV('GRAND SUBTOTAL'), '', '', '',
      escapeCSV(formatNumber(subtotals.grandTotal, roundingRule)),
      '', '', ''].join(',')
  );

  if (addOnConfig) {
    const addOns = calculateAddOns(subtotals.grandTotal, addOnConfig);
    lines.push('');
    lines.push(['', '', escapeCSV('ADD-ONS'), '', '', '', '', '', '', ''].join(','));
    lines.push(
      ['', '', escapeCSV(`Preliminaries (${addOnConfig.prelims_pct}%)`), '', '', '',
        escapeCSV(formatNumber(addOns.prelims, roundingRule)), '', '', ''].join(',')
    );
    lines.push(
      ['', '', escapeCSV(`Contingency (${addOnConfig.contingency_pct}%)`), '', '', '',
        escapeCSV(formatNumber(addOns.contingency, roundingRule)), '', '', ''].join(',')
    );
    lines.push(
      ['', '', escapeCSV(`Profit (${addOnConfig.profit_pct}%)`), '', '', '',
        escapeCSV(formatNumber(addOns.profit, roundingRule)), '', '', ''].join(',')
    );
    lines.push(
      ['', '', escapeCSV(`Tax / SST (${addOnConfig.tax_pct}%)`), '', '', '',
        escapeCSV(formatNumber(addOns.tax, roundingRule)), '', '', ''].join(',')
    );
    lines.push('');
    lines.push(
      ['', '', escapeCSV('GRAND TOTAL'), '', '', '',
        escapeCSV(formatNumber(addOns.grandTotal, roundingRule)), '', '', ''].join(',')
    );
  }

  return lines.join('\n');
}

export function generateSummaryCSV(
  subtotal: number,
  addOnConfig: AddOnConfig,
  currency: string
): string {
  const addOns = calculateAddOns(subtotal, addOnConfig);
  const r = addOnConfig.rounding_rule;
  const lines: string[] = [];

  lines.push([escapeCSV('Item'), escapeCSV('Percentage'), escapeCSV(`Amount (${currency})`)].join(','));
  lines.push([escapeCSV('Line Items Subtotal'), '', escapeCSV(formatNumber(addOns.subtotal, r))].join(','));
  lines.push([escapeCSV('Preliminaries'), escapeCSV(`${addOnConfig.prelims_pct}%`), escapeCSV(formatNumber(addOns.prelims, r))].join(','));
  lines.push([escapeCSV('Contingency'), escapeCSV(`${addOnConfig.contingency_pct}%`), escapeCSV(formatNumber(addOns.contingency, r))].join(','));
  lines.push([escapeCSV('Profit'), escapeCSV(`${addOnConfig.profit_pct}%`), escapeCSV(formatNumber(addOns.profit, r))].join(','));
  lines.push([escapeCSV('Tax / SST'), escapeCSV(`${addOnConfig.tax_pct}%`), escapeCSV(formatNumber(addOns.tax, r))].join(','));
  lines.push([escapeCSV('GRAND TOTAL'), '', escapeCSV(formatNumber(addOns.grandTotal, r))].join(','));

  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadBinaryFile(buffer: ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
}
