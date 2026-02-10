export type BoQField =
  | 'row_type'
  | 'external_key'
  | 'section'
  | 'description'
  | 'uom'
  | 'qty'
  | 'rate'
  | 'amount'
  | 'category'
  | 'measurement'
  | 'assumptions'
  | 'action';

export type ColumnMapping = Record<string, number>;

export const BOQ_FIELDS: { key: BoQField; label: string; required: boolean }[] = [
  { key: 'row_type', label: 'Row Type', required: false },
  { key: 'external_key', label: 'External Key', required: false },
  { key: 'section', label: 'Section', required: false },
  { key: 'description', label: 'Description', required: true },
  { key: 'uom', label: 'UOM', required: false },
  { key: 'qty', label: 'Qty', required: false },
  { key: 'rate', label: 'Rate', required: false },
  { key: 'amount', label: 'Amount', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'measurement', label: 'Measurement', required: false },
  { key: 'assumptions', label: 'Assumptions', required: false },
  { key: 'action', label: 'Action', required: false },
];

const ALIASES: Record<BoQField, string[]> = {
  row_type: ['row_type', 'rowtype', 'type', 'row type', 'line type'],
  external_key: ['external_key', 'externalkey', 'external key', 'ext_key', 'ref', 'reference', 'ref_id', 'external id'],
  section: ['section', 'section name', 'group', 'category group'],
  description: ['description', 'desc', 'item description', 'item', 'item name', 'line description', 'scope', 'work item'],
  uom: ['uom', 'unit', 'unit of measure', 'units', 'unit of measurement', 'measure'],
  qty: ['qty', 'quantity', 'amount qty', 'no', 'count', 'number'],
  rate: ['rate', 'unit rate', 'unit price', 'price', 'cost', 'unit cost'],
  amount: ['amount', 'total', 'total amount', 'line total', 'line amount', 'sum', 'value'],
  category: ['category', 'cost category', 'type category', 'classification', 'cost type', 'trade'],
  measurement: ['measurement', 'measurements', 'measurement notes', 'measure notes', 'dimensions'],
  assumptions: ['assumptions', 'assumption', 'notes', 'remarks', 'comments', 'clarifications'],
  action: ['action', 'operation', 'op', 'crud', 'import action'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();

  for (const field of BOQ_FIELDS) {
    const aliases = ALIASES[field.key].map(normalize);
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      const normalized = normalize(headers[i]);
      if (aliases.includes(normalized)) {
        mapping[field.key] = i;
        used.add(i);
        break;
      }
    }
  }

  return mapping;
}

export function getUnmappedHeaders(headers: string[], mapping: ColumnMapping): number[] {
  const mappedIndices = new Set(Object.values(mapping));
  return headers
    .map((_, i) => i)
    .filter((i) => !mappedIndices.has(i));
}
