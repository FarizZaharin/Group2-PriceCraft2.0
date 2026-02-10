import * as XLSX from 'xlsx';
import type { ParsedCSV } from './csv-parser';
import { FALLBACK_CATEGORIES, FALLBACK_UOMS } from '../types';

export interface ExcelFileInfo {
  sheetNames: string[];
  workbook: XLSX.WorkBook;
}

export function getExcelSheetNames(file: ArrayBuffer): string[] {
  const workbook = XLSX.read(file, { type: 'array' });
  return workbook.SheetNames;
}

export function parseExcelFile(file: ArrayBuffer, sheetName?: string): ParsedCSV {
  const workbook = XLSX.read(file, { type: 'array' });

  const targetSheet = sheetName || workbook.SheetNames[0];

  if (!targetSheet || !workbook.Sheets[targetSheet]) {
    throw new Error('Invalid sheet name or empty workbook');
  }

  const sheet = workbook.Sheets[targetSheet];
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawData.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rawData[0].map((h) => String(h).trim());
  const dataRows = rawData.slice(1);

  const normalized = dataRows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''))
    .map((row) => {
      const normalizedRow: string[] = [];
      for (let i = 0; i < headers.length; i++) {
        const cell = row[i];
        if (cell === null || cell === undefined) {
          normalizedRow.push('');
        } else if (typeof cell === 'number') {
          normalizedRow.push(String(cell));
        } else {
          normalizedRow.push(String(cell).trim());
        }
      }
      return normalizedRow;
    });

  return { headers, rows: normalized };
}

export function generateImportTemplateXLSX(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  const headers = [
    'row_type',
    'external_key',
    'section',
    'description',
    'uom',
    'qty',
    'rate',
    'category',
    'measurement',
    'assumptions',
    'action',
  ];

  const sampleRows = [
    ['SectionHeader', '', 'Structural Works', 'Structural Works', '', '', '', '', '', '', ''],
    ['LineItem', 'STR-001', 'Structural Works', 'Reinforced concrete grade 30', 'm3', '150', '450.00', 'Material', 'As per BQ measurement', 'Based on structural drawings', ''],
    ['LineItem', 'STR-002', 'Structural Works', 'Steel reinforcement bar Y16', 'kg', '5000', '3.50', 'Material', 'Weight from bar schedule', '', ''],
  ];

  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  dataSheet['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 35 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 25 },
    { wch: 30 },
    { wch: 10 },
  ];

  if (!dataSheet['!dataValidation']) {
    dataSheet['!dataValidation'] = [];
  }

  const rowTypeValidation = {
    type: 'list',
    allowBlank: false,
    sqref: 'A2:A2000',
    formulas: ['"LineItem,SectionHeader"'],
  };

  const categoryValidation = {
    type: 'list',
    allowBlank: true,
    sqref: 'H2:H2000',
    formulas: [`"${FALLBACK_CATEGORIES.join(',')}"`],
  };

  const uomValidation = {
    type: 'list',
    allowBlank: true,
    sqref: 'E2:E2000',
    formulas: [`"${FALLBACK_UOMS.join(',')}"`],
  };

  const actionValidation = {
    type: 'list',
    allowBlank: true,
    sqref: 'K2:K2000',
    formulas: ['"UPSERT,DELETE"'],
  };

  dataSheet['!dataValidation'].push(
    rowTypeValidation,
    categoryValidation,
    uomValidation,
    actionValidation
  );

  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data');

  const referenceData = [
    ['Field', 'Valid Values', 'Notes'],
    ['row_type', 'LineItem, SectionHeader', 'Required. LineItem for cost items, SectionHeader for section dividers.'],
    ['external_key', 'Any unique text', 'Optional. Used for updating existing rows via UPSERT or DELETE actions.'],
    ['section', 'Any text', 'Section name. Typically matches the SectionHeader description.'],
    ['description', 'Any text', 'Required. The item description.'],
    ['uom', FALLBACK_UOMS.join(', '), 'Unit of measure. Custom values are accepted.'],
    ['qty', 'Numbers only', 'Quantity. Required for LineItem rows. Must be non-negative.'],
    ['rate', 'Numbers only', 'Unit rate. Required for LineItem rows. Must be non-negative.'],
    ['category', FALLBACK_CATEGORIES.join(', '), 'Cost category. Custom values will map to "Other".'],
    ['measurement', 'Any text', 'Optional. Measurement notes or methodology.'],
    ['assumptions', 'Any text', 'Optional. Assumptions or clarifications.'],
    ['action', 'UPSERT, DELETE', 'Optional. UPSERT creates/updates rows, DELETE removes rows by external_key.'],
    ['', '', ''],
    ['Tips:', '', ''],
    ['1. Use external_key', '', 'Assign unique keys to enable updates via re-import.'],
    ['2. Row limit', '', 'Maximum 2,000 data rows per import.'],
    ['3. SectionHeaders', '', 'Use SectionHeader rows to organize items into logical groups.'],
    ['4. DELETE action', '', 'Requires external_key to identify which row to delete.'],
  ];

  const referenceSheet = XLSX.utils.aoa_to_sheet(referenceData);

  referenceSheet['!cols'] = [
    { wch: 20 },
    { wch: 40 },
    { wch: 60 },
  ];

  XLSX.utils.book_append_sheet(workbook, referenceSheet, 'Reference');

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}
