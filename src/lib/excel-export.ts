import * as XLSX from 'xlsx';
import type { BoQRow, Estimate, AddOnConfig } from '../types';
import { calculateSubtotals, calculateAddOns } from './database';
import { generateItemNo } from './export';

function formatNumber(value: number | null, decimals: number): string | number {
  if (value === null) return '';
  return Number(value.toFixed(decimals));
}

export function generateBoQExcel(
  rows: BoQRow[],
  estimate: Estimate,
  addOnConfig: AddOnConfig | null,
  roundingRule: number
): ArrayBuffer {
  const subtotals = calculateSubtotals(rows, roundingRule);
  const workbook = XLSX.utils.book_new();

  const headers = [
    'Item No',
    'Section',
    'Description',
    'UOM',
    'Qty',
    `Rate (${estimate.currency})`,
    `Amount (${estimate.currency})`,
    'Category',
    'Measurement',
    'Assumptions',
  ];

  const data: (string | number)[][] = [headers];

  let currentSection = '';
  rows.forEach((row, index) => {
    if (row.row_type === 'SectionHeader') {
      currentSection = row.section || row.description;
      data.push([
        '',
        currentSection,
        row.description,
        '', '', '', '', '', '', '',
      ]);
    } else {
      data.push([
        generateItemNo(rows, index),
        row.section,
        row.description,
        row.uom,
        formatNumber(row.qty, roundingRule),
        formatNumber(row.rate, roundingRule),
        formatNumber(row.amount, roundingRule),
        row.category,
        row.measurement,
        row.assumptions,
      ]);
    }

    const isLastInSection =
      index === rows.length - 1 || rows[index + 1]?.row_type === 'SectionHeader';
    if (isLastInSection && currentSection && subtotals.bySection[currentSection] !== undefined) {
      data.push([
        '', '', `Subtotal - ${currentSection}`,
        '', '', '',
        formatNumber(subtotals.bySection[currentSection], roundingRule),
        '', '', '',
      ]);
    }
  });

  data.push(['', '', '', '', '', '', '', '', '', '']);
  data.push([
    '', '', 'GRAND SUBTOTAL', '', '', '',
    formatNumber(subtotals.grandTotal, roundingRule),
    '', '', ''
  ]);

  if (addOnConfig) {
    const addOns = calculateAddOns(subtotals.grandTotal, addOnConfig);
    data.push(['', '', '', '', '', '', '', '', '', '']);
    data.push(['', '', 'ADD-ONS', '', '', '', '', '', '', '']);
    data.push([
      '', '', `Preliminaries (${addOnConfig.prelims_pct}%)`, '', '', '',
      formatNumber(addOns.prelims, roundingRule), '', '', ''
    ]);
    data.push([
      '', '', `Contingency (${addOnConfig.contingency_pct}%)`, '', '', '',
      formatNumber(addOns.contingency, roundingRule), '', '', ''
    ]);
    data.push([
      '', '', `Profit (${addOnConfig.profit_pct}%)`, '', '', '',
      formatNumber(addOns.profit, roundingRule), '', '', ''
    ]);
    data.push([
      '', '', `Tax / SST (${addOnConfig.tax_pct}%)`, '', '', '',
      formatNumber(addOns.tax, roundingRule), '', '', ''
    ]);
    data.push(['', '', '', '', '', '', '', '', '', '']);
    data.push([
      '', '', 'GRAND TOTAL', '', '', '',
      formatNumber(addOns.grandTotal, roundingRule), '', '', ''
    ]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 10 },
    { wch: 20 },
    { wch: 40 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 18 },
    { wch: 12 },
    { wch: 25 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'BoQ');

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export function generateSummaryExcel(
  subtotal: number,
  addOnConfig: AddOnConfig,
  currency: string
): ArrayBuffer {
  const addOns = calculateAddOns(subtotal, addOnConfig);
  const r = addOnConfig.rounding_rule;
  const workbook = XLSX.utils.book_new();

  const headers = ['Item', 'Percentage', `Amount (${currency})`];
  const data: (string | number)[][] = [
    headers,
    ['Line Items Subtotal', '', formatNumber(addOns.subtotal, r)],
    ['Preliminaries', `${addOnConfig.prelims_pct}%`, formatNumber(addOns.prelims, r)],
    ['Contingency', `${addOnConfig.contingency_pct}%`, formatNumber(addOns.contingency, r)],
    ['Profit', `${addOnConfig.profit_pct}%`, formatNumber(addOns.profit, r)],
    ['Tax / SST', `${addOnConfig.tax_pct}%`, formatNumber(addOns.tax, r)],
    ['GRAND TOTAL', '', formatNumber(addOns.grandTotal, r)],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}
