export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): ParsedCSV {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field.trim());
        field = '';
      } else if (char === '\r' && next === '\n') {
        current.push(field.trim());
        field = '';
        if (current.some((c) => c !== '')) {
          rows.push(current);
        }
        current = [];
        i++;
      } else if (char === '\n') {
        current.push(field.trim());
        field = '';
        if (current.some((c) => c !== '')) {
          rows.push(current);
        }
        current = [];
      } else {
        field += char;
      }
    }
  }

  current.push(field.trim());
  if (current.some((c) => c !== '')) {
    rows.push(current);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const normalized = dataRows.map((row) => {
    while (row.length < headers.length) {
      row.push('');
    }
    return row.slice(0, headers.length);
  });

  return { headers, rows: normalized };
}

export function generateImportTemplate(): string {
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

  const escapeField = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escapeField).join(','),
    ...sampleRows.map((row) => row.map(escapeField).join(',')),
  ];

  return lines.join('\n');
}
