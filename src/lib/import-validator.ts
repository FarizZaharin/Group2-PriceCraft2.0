import { FALLBACK_CATEGORIES } from '../types';
import type { ColumnMapping } from './column-mapper';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  rowIndex: number;
  field: string;
  severity: ValidationSeverity;
  message: string;
}

export type ImportAction = 'UPSERT' | 'DELETE';

export interface ValidatedRow {
  rowIndex: number;
  action: ImportAction;
  row_type: 'LineItem' | 'SectionHeader';
  external_key: string;
  section: string;
  description: string;
  uom: string;
  qty: number | null;
  rate: number | null;
  category: string;
  measurement: string;
  assumptions: string;
}

export interface ValidationResult {
  validRows: ValidatedRow[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  totalParsedRows: number;
}

const MAX_ROWS = 2000;
const VALID_ROW_TYPES = ['LineItem', 'SectionHeader'];
const VALID_CATEGORIES = [...FALLBACK_CATEGORIES] as string[];

function getMappedValue(
  csvRow: string[],
  mapping: ColumnMapping,
  field: string
): string {
  const idx = mapping[field];
  if (idx === undefined || idx === -1) return '';
  return (csvRow[idx] ?? '').trim();
}

export function validateImportRows(
  csvRows: string[][],
  mapping: ColumnMapping
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const validRows: ValidatedRow[] = [];

  if (csvRows.length > MAX_ROWS) {
    errors.push({
      rowIndex: -1,
      field: '',
      severity: 'error',
      message: `File contains ${csvRows.length} data rows, exceeding the maximum of ${MAX_ROWS}.`,
    });
    return { validRows: [], errors, warnings, totalParsedRows: csvRows.length };
  }

  for (let i = 0; i < csvRows.length; i++) {
    const csvRow = csvRows[i];
    const displayRow = i + 2;
    let rowHasError = false;

    const rawRowType = getMappedValue(csvRow, mapping, 'row_type');
    const rawAction = getMappedValue(csvRow, mapping, 'action').toUpperCase();
    const description = getMappedValue(csvRow, mapping, 'description');
    const uom = getMappedValue(csvRow, mapping, 'uom');
    const rawQty = getMappedValue(csvRow, mapping, 'qty');
    const rawRate = getMappedValue(csvRow, mapping, 'rate');
    const rawCategory = getMappedValue(csvRow, mapping, 'category');
    const rawAmount = getMappedValue(csvRow, mapping, 'amount');
    const externalKey = getMappedValue(csvRow, mapping, 'external_key');
    const section = getMappedValue(csvRow, mapping, 'section');
    const measurement = getMappedValue(csvRow, mapping, 'measurement');
    const assumptions = getMappedValue(csvRow, mapping, 'assumptions');

    const rowType = rawRowType || 'LineItem';
    if (!VALID_ROW_TYPES.includes(rowType)) {
      errors.push({
        rowIndex: i,
        field: 'row_type',
        severity: 'error',
        message: `Row ${displayRow}: Invalid row_type "${rawRowType}". Must be LineItem or SectionHeader.`,
      });
      rowHasError = true;
    }

    if (!description) {
      errors.push({
        rowIndex: i,
        field: 'description',
        severity: 'error',
        message: `Row ${displayRow}: Description is required.`,
      });
      rowHasError = true;
    }

    let action: ImportAction = 'UPSERT';
    if (rawAction === 'DELETE') {
      action = 'DELETE';
    }

    if (action === 'DELETE' && !externalKey) {
      errors.push({
        rowIndex: i,
        field: 'action',
        severity: 'error',
        message: `Row ${displayRow}: DELETE action requires an external_key to identify the row.`,
      });
      rowHasError = true;
    }

    let qty: number | null = null;
    let rate: number | null = null;
    let category = rawCategory || '';

    if (rowType === 'LineItem') {
      if (!uom && action !== 'DELETE') {
        errors.push({
          rowIndex: i,
          field: 'uom',
          severity: 'error',
          message: `Row ${displayRow}: UOM is required for LineItem rows.`,
        });
        rowHasError = true;
      }

      if (rawQty !== '') {
        const parsed = parseFloat(rawQty);
        if (isNaN(parsed) || parsed < 0) {
          errors.push({
            rowIndex: i,
            field: 'qty',
            severity: 'error',
            message: `Row ${displayRow}: Qty must be a number >= 0. Got "${rawQty}".`,
          });
          rowHasError = true;
        } else {
          qty = parsed;
        }
      }

      if (rawRate !== '') {
        const parsed = parseFloat(rawRate);
        if (isNaN(parsed) || parsed < 0) {
          errors.push({
            rowIndex: i,
            field: 'rate',
            severity: 'error',
            message: `Row ${displayRow}: Rate must be a number >= 0. Got "${rawRate}".`,
          });
          rowHasError = true;
        } else {
          rate = parsed;
        }
      }

      if (category && !VALID_CATEGORIES.includes(category)) {
        warnings.push({
          rowIndex: i,
          field: 'category',
          severity: 'warning',
          message: `Row ${displayRow}: Unknown category "${category}" will be mapped to "Other".`,
        });
        category = 'Other';
      }
    }

    if (rawAmount !== '') {
      warnings.push({
        rowIndex: i,
        field: 'amount',
        severity: 'warning',
        message: `Row ${displayRow}: Amount value ignored; will be computed as Qty x Rate.`,
      });
    }

    if (!rowHasError) {
      validRows.push({
        rowIndex: i,
        action,
        row_type: rowType as 'LineItem' | 'SectionHeader',
        external_key: externalKey,
        section,
        description,
        uom: rowType === 'SectionHeader' ? '' : uom,
        qty: rowType === 'SectionHeader' ? null : qty,
        rate: rowType === 'SectionHeader' ? null : rate,
        category: rowType === 'SectionHeader' ? '' : category,
        measurement,
        assumptions,
      });
    }
  }

  return { validRows, errors, warnings, totalParsedRows: csvRows.length };
}
