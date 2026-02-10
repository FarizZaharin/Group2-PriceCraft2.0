import { supabase } from './supabase';
import type {
  Estimate,
  SOWVersion,
  BoQVersion,
  BoQRow,
  AddOnConfig,
  RowComment,
  AuditLog,
  AIRun,
  User,
  EstimateStatus,
  ImportJob
} from '../types';

export const db = {
  users: {
    async getAll() {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as User[];
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as User | null;
    }
  },

  estimates: {
    async getAll() {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Estimate[];
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Estimate | null;
    },

    async create(estimate: Omit<Estimate, 'id' | 'created_at' | 'updated_at'>) {
      const { data, error } = await supabase
        .from('estimates')
        .insert(estimate)
        .select()
        .single();

      if (error) throw error;
      return data as Estimate;
    },

    async createWithDefaults(
      estimate: Omit<Estimate, 'id' | 'created_at' | 'updated_at' | 'status'>,
      defaults: {
        taxPct: number;
        prelimsPct: number;
        contingencyPct: number;
        profitPct: number;
        roundingDecimals: number;
      }
    ) {
      const newEstimate = await this.create({
        ...estimate,
        status: 'Draft'
      });

      await db.addOnConfigs.create({
        estimate_id: newEstimate.id,
        prelims_pct: defaults.prelimsPct,
        contingency_pct: defaults.contingencyPct,
        profit_pct: defaults.profitPct,
        tax_pct: defaults.taxPct,
        rounding_rule: defaults.roundingDecimals
      });

      await db.sowVersions.create({
        estimate_id: newEstimate.id,
        version_label: 'v0.1',
        sow_text: '',
        created_by_user_id: estimate.owner_user_id,
        is_current: true
      });

      await db.boqVersions.create({
        estimate_id: newEstimate.id,
        version_label: 'v0.1',
        created_by_user_id: estimate.owner_user_id,
        is_frozen: false,
        based_on_boq_version_id: null
      });

      return newEstimate;
    },

    async update(id: string, updates: Partial<Estimate>) {
      const { data, error } = await supabase
        .from('estimates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Estimate;
    },

    async delete(id: string) {
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    async updateStatus(id: string, status: EstimateStatus) {
      return this.update(id, { status });
    }
  },

  sowVersions: {
    async getByEstimateId(estimateId: string) {
      const { data, error } = await supabase
        .from('sow_versions')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SOWVersion[];
    },

    async getCurrent(estimateId: string) {
      const { data, error } = await supabase
        .from('sow_versions')
        .select('*')
        .eq('estimate_id', estimateId)
        .eq('is_current', true)
        .maybeSingle();

      if (error) throw error;
      return data as SOWVersion | null;
    },

    async create(version: Omit<SOWVersion, 'id' | 'created_at'>) {
      const { data, error } = await supabase
        .from('sow_versions')
        .insert(version)
        .select()
        .single();

      if (error) throw error;
      return data as SOWVersion;
    },

    async setCurrent(id: string, estimateId: string) {
      await supabase
        .from('sow_versions')
        .update({ is_current: false })
        .eq('estimate_id', estimateId);

      const { data, error } = await supabase
        .from('sow_versions')
        .update({ is_current: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SOWVersion;
    }
  },

  boqVersions: {
    async getByEstimateId(estimateId: string) {
      const { data, error } = await supabase
        .from('boq_versions')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BoQVersion[];
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('boq_versions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as BoQVersion | null;
    },

    async create(version: Omit<BoQVersion, 'id' | 'created_at'>) {
      const { data, error } = await supabase
        .from('boq_versions')
        .insert(version)
        .select()
        .single();

      if (error) throw error;
      return data as BoQVersion;
    },

    async freeze(id: string) {
      const { data, error } = await supabase
        .from('boq_versions')
        .update({ is_frozen: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BoQVersion;
    },

    async duplicate(sourceId: string, newLabel: string, userId: string) {
      const source = await this.getById(sourceId);
      if (!source) throw new Error('Source version not found');

      const newVersion = await this.create({
        estimate_id: source.estimate_id,
        version_label: newLabel,
        created_by_user_id: userId,
        is_frozen: false,
        based_on_boq_version_id: sourceId
      });

      const rows = await db.boqRows.getByVersionId(sourceId);

      for (const row of rows) {
        const { id, boq_version_id, created_at, updated_at, ...rowData } = row;
        await db.boqRows.create({
          ...rowData,
          boq_version_id: newVersion.id
        });
      }

      return newVersion;
    }
  },

  boqRows: {
    async getByVersionId(versionId: string) {
      const { data, error } = await supabase
        .from('boq_rows')
        .select('*')
        .eq('boq_version_id', versionId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as BoQRow[];
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('boq_rows')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as BoQRow | null;
    },

    async create(row: Omit<BoQRow, 'id' | 'created_at' | 'updated_at'>) {
      const { data, error } = await supabase
        .from('boq_rows')
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      return data as BoQRow;
    },

    async update(id: string, updates: Partial<BoQRow>) {
      const { data, error } = await supabase
        .from('boq_rows')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BoQRow;
    },

    async delete(id: string) {
      const { error } = await supabase
        .from('boq_rows')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    async reorder(_versionId: string, rowIds: string[]) {
      const updates = rowIds.map((id, index) => ({
        id,
        sort_order: index
      }));

      for (const update of updates) {
        await this.update(update.id, { sort_order: update.sort_order });
      }
    },

    async bulkUpdateStatus(rowIds: string[], status: 'AIDraft' | 'Final') {
      for (const id of rowIds) {
        await this.update(id, { row_status: status });
      }
    },

    async bulkDelete(rowIds: string[]) {
      for (const id of rowIds) {
        await this.delete(id);
      }
    }
  },

  addOnConfigs: {
    async getByEstimateId(estimateId: string) {
      const { data, error } = await supabase
        .from('addon_configs')
        .select('*')
        .eq('estimate_id', estimateId)
        .maybeSingle();

      if (error) throw error;
      return data as AddOnConfig | null;
    },

    async create(config: Omit<AddOnConfig, 'id' | 'created_at' | 'updated_at'>) {
      const { data, error } = await supabase
        .from('addon_configs')
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      return data as AddOnConfig;
    },

    async update(estimateId: string, updates: Partial<AddOnConfig>) {
      const { data, error } = await supabase
        .from('addon_configs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('estimate_id', estimateId)
        .select()
        .single();

      if (error) throw error;
      return data as AddOnConfig;
    }
  },

  rowComments: {
    async getByRowId(rowId: string) {
      const { data, error } = await supabase
        .from('row_comments')
        .select('*')
        .eq('boq_row_id', rowId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as RowComment[];
    },

    async create(comment: Omit<RowComment, 'id' | 'created_at'>) {
      const { data, error } = await supabase
        .from('row_comments')
        .insert(comment)
        .select()
        .single();

      if (error) throw error;
      return data as RowComment;
    }
  },

  auditLogs: {
    async getByEstimateId(estimateId: string, limit = 100) {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as AuditLog[];
    },

    async create(log: Omit<AuditLog, 'id' | 'created_at'>) {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert(log)
        .select()
        .single();

      if (error) throw error;
      return data as AuditLog;
    }
  },

  aiRuns: {
    async getByEstimateId(estimateId: string) {
      const { data, error } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AIRun[];
    },

    async create(run: Omit<AIRun, 'id' | 'created_at'>) {
      const { data, error } = await supabase
        .from('ai_runs')
        .insert(run)
        .select()
        .single();

      if (error) throw error;
      return data as AIRun;
    },

    async accept(id: string, userId: string) {
      const { data, error } = await supabase
        .from('ai_runs')
        .update({
          status: 'Accepted',
          accepted_by_user_id: userId,
          accepted_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AIRun;
    },

    async reject(id: string, userId: string) {
      const { data, error } = await supabase
        .from('ai_runs')
        .update({
          status: 'Rejected',
          accepted_by_user_id: userId,
          accepted_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AIRun;
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as AIRun | null;
    }
  },

  importJobs: {
    async getByEstimateId(estimateId: string) {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ImportJob[];
    },

    async create(job: Omit<ImportJob, 'id' | 'created_at'>) {
      const { data, error } = await supabase
        .from('import_jobs')
        .insert(job)
        .select()
        .single();

      if (error) throw error;
      return data as ImportJob;
    },

    async update(id: string, updates: Partial<Omit<ImportJob, 'id' | 'created_at'>>) {
      const { data, error } = await supabase
        .from('import_jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ImportJob;
    }
  },

  storage: {
    async uploadImportFile(
      estimateId: string,
      importJobId: string,
      fileName: string,
      fileContent: ArrayBuffer | Blob
    ): Promise<string> {
      const filePath = `${estimateId}/${importJobId}/${fileName}`;

      const { error } = await supabase.storage
        .from('import-files')
        .upload(filePath, fileContent, {
          contentType: fileName.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        });

      if (error) throw error;
      return filePath;
    },

    async getImportFileUrl(filePath: string): Promise<string> {
      const { data } = supabase.storage
        .from('import-files')
        .getPublicUrl(filePath);

      return data.publicUrl;
    }
  }
};

export function calculateAmount(qty: number | null, rate: number | null, roundingRule: number = 2): number | null {
  if (qty === null || rate === null) return null;
  const amount = qty * rate;
  return Number(amount.toFixed(roundingRule));
}

export function calculateSubtotals(rows: BoQRow[], roundingRule: number = 2) {
  const totals = {
    bySection: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    grandTotal: 0
  };

  for (const row of rows) {
    if (row.row_type === 'LineItem' && row.amount !== null) {
      const amount = Number(row.amount);

      if (row.section) {
        totals.bySection[row.section] = (totals.bySection[row.section] || 0) + amount;
      }

      if (row.category) {
        totals.byCategory[row.category] = (totals.byCategory[row.category] || 0) + amount;
      }

      totals.grandTotal += amount;
    }
  }

  totals.grandTotal = Number(totals.grandTotal.toFixed(roundingRule));

  for (const key in totals.bySection) {
    totals.bySection[key] = Number(totals.bySection[key].toFixed(roundingRule));
  }

  for (const key in totals.byCategory) {
    totals.byCategory[key] = Number(totals.byCategory[key].toFixed(roundingRule));
  }

  return totals;
}

export function calculateAddOns(
  subtotal: number,
  config: AddOnConfig
) {
  const prelims = subtotal * (config.prelims_pct / 100);
  const baseWithPrelims = subtotal + prelims;

  const contingency = baseWithPrelims * (config.contingency_pct / 100);
  const baseWithContingency = baseWithPrelims + contingency;

  const profit = baseWithContingency * (config.profit_pct / 100);
  const baseWithProfit = baseWithContingency + profit;

  const tax = baseWithProfit * (config.tax_pct / 100);
  const grandTotal = baseWithProfit + tax;

  const round = (n: number) => Number(n.toFixed(config.rounding_rule));

  return {
    subtotal: round(subtotal),
    prelims: round(prelims),
    contingency: round(contingency),
    profit: round(profit),
    tax: round(tax),
    grandTotal: round(grandTotal)
  };
}
