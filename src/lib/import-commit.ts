import { db, calculateAmount } from './database';
import type { BoQRow } from '../types';
import type { ValidatedRow } from './import-validator';

export interface ImportReport {
  rowsCreated: number;
  rowsUpdated: number;
  rowsDeleted: number;
  warningCount: number;
  totalProcessed: number;
}

export async function executeImport(
  validRows: ValidatedRow[],
  boqVersionId: string,
  estimateId: string,
  userId: string,
  warningCount: number,
  roundingRule: number,
  fileName: string = '',
  fileType: string | null = null,
  fileContent: ArrayBuffer | Blob | null = null
): Promise<ImportReport> {
  const existingRows = await db.boqRows.getByVersionId(boqVersionId);
  const existingByKey = new Map<string, BoQRow>();
  for (const row of existingRows) {
    if (row.external_key) {
      existingByKey.set(row.external_key, row);
    }
  }

  let created = 0;
  let updated = 0;
  let deleted = 0;

  const upsertRows = validRows.filter((r) => r.action === 'UPSERT');
  const deleteRows = validRows.filter((r) => r.action === 'DELETE');

  for (const vrow of deleteRows) {
    if (!vrow.external_key) continue;
    const existing = existingByKey.get(vrow.external_key);
    if (existing) {
      await db.boqRows.delete(existing.id);
      deleted++;
    }
  }

  let itemCounter = 0;
  let sectionCounter = 0;

  for (let i = 0; i < upsertRows.length; i++) {
    const vrow = upsertRows[i];
    const amount = calculateAmount(vrow.qty, vrow.rate, roundingRule);

    if (vrow.row_type === 'SectionHeader') {
      sectionCounter++;
      itemCounter = 0;
    } else {
      itemCounter++;
    }

    const itemNo = vrow.row_type === 'SectionHeader'
      ? ''
      : sectionCounter > 0
        ? `${sectionCounter}.${itemCounter}`
        : `${itemCounter}`;

    const rowData = {
      boq_version_id: boqVersionId,
      row_type: vrow.row_type,
      item_no: itemNo,
      section: vrow.section,
      description: vrow.description,
      uom: vrow.uom,
      qty: vrow.qty,
      rate: vrow.rate,
      amount,
      measurement: vrow.measurement,
      assumptions: vrow.assumptions,
      category: vrow.category,
      row_status: 'Final' as const,
      sort_order: i,
      external_key: vrow.external_key || null,
    };

    const existing = vrow.external_key ? existingByKey.get(vrow.external_key) : null;

    if (existing) {
      const { boq_version_id, ...updates } = rowData;
      await db.boqRows.update(existing.id, updates);
      updated++;
    } else {
      await db.boqRows.create(rowData);
      created++;
    }
  }

  const report: ImportReport = {
    rowsCreated: created,
    rowsUpdated: updated,
    rowsDeleted: deleted,
    warningCount,
    totalProcessed: validRows.length,
  };

  const importJob = await db.importJobs.create({
    estimate_id: estimateId,
    boq_version_id: boqVersionId,
    actor_user_id: userId,
    file_name: fileName,
    file_path: null,
    file_type: fileType,
    status: 'committed',
    report_json: report as unknown as Record<string, unknown>,
  });

  if (fileContent && fileName) {
    try {
      const filePath = await db.storage.uploadImportFile(
        estimateId,
        importJob.id,
        fileName,
        fileContent
      );

      await db.importJobs.update(importJob.id, {
        file_path: filePath,
      });
    } catch (err) {
      console.error('Failed to upload import file to storage:', err);
    }
  }

  await db.auditLogs.create({
    estimate_id: estimateId,
    actor_user_id: userId,
    action_type: 'import_committed',
    entity_type: 'boq_version',
    entity_id: boqVersionId,
    before_snapshot: null,
    after_snapshot: report as unknown as Record<string, unknown>,
  });

  return report;
}
