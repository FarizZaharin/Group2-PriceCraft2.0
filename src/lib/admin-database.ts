import { supabase } from './supabase';
import type {
  CategoryRecord,
  UomRecord,
  SectionTemplate,
  SectionTemplateRow,
  GlobalSettings,
} from '../types';

const SETTINGS_KEY_MAP: Record<string, keyof GlobalSettings> = {
  default_currency: 'defaultCurrency',
  default_tax_percent: 'defaultTaxPercent',
  rounding_decimals: 'roundingDecimals',
  default_prelims_pct: 'defaultPrelimsPct',
  default_contingency_pct: 'defaultContingencyPct',
  default_profit_pct: 'defaultProfitPct',
};

const REVERSE_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SETTINGS_KEY_MAP).map(([k, v]) => [v, k])
);

export const adminDb = {
  settings: {
    async getAll(): Promise<GlobalSettings> {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value');

      if (error) throw error;

      const defaults: GlobalSettings = {
        defaultCurrency: 'MYR',
        defaultTaxPercent: 6.0,
        roundingDecimals: 2,
        defaultPrelimsPct: 10.0,
        defaultContingencyPct: 5.0,
        defaultProfitPct: 10.0,
      };

      if (data) {
        for (const row of data) {
          const field = SETTINGS_KEY_MAP[row.key];
          if (field) {
            (defaults as unknown as Record<string, unknown>)[field] = row.value;
          }
        }
      }

      return defaults;
    },

    async update(key: keyof GlobalSettings, value: unknown, userId: string) {
      const dbKey = REVERSE_KEY_MAP[key];
      if (!dbKey) throw new Error(`Unknown setting key: ${key}`);

      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { key: dbKey, value: JSON.stringify(value), updated_by: userId, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;
    },

    async updateBulk(settings: Partial<GlobalSettings>, userId: string) {
      for (const [key, value] of Object.entries(settings)) {
        await this.update(key as keyof GlobalSettings, value, userId);
      }
    },
  },

  categories: {
    async getAll(activeOnly = true) {
      let query = supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CategoryRecord[];
    },

    async create(name: string, sortOrder: number) {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, sort_order: sortOrder })
        .select()
        .single();

      if (error) throw error;
      return data as CategoryRecord;
    },

    async update(id: string, updates: Partial<Pick<CategoryRecord, 'name' | 'sort_order' | 'is_active'>>) {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CategoryRecord;
    },

    async reorder(items: { id: string; sort_order: number }[]) {
      for (const item of items) {
        await supabase
          .from('categories')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
      }
    },

    async toggleActive(id: string, isActive: boolean) {
      return this.update(id, { is_active: isActive });
    },
  },

  uoms: {
    async getAll(activeOnly = true) {
      let query = supabase
        .from('uom_library')
        .select('*')
        .order('sort_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UomRecord[];
    },

    async create(code: string, label: string, sortOrder: number) {
      const { data, error } = await supabase
        .from('uom_library')
        .insert({ code, label, sort_order: sortOrder })
        .select()
        .single();

      if (error) throw error;
      return data as UomRecord;
    },

    async update(id: string, updates: Partial<Pick<UomRecord, 'code' | 'label' | 'sort_order' | 'is_active'>>) {
      const { data, error } = await supabase
        .from('uom_library')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as UomRecord;
    },

    async reorder(items: { id: string; sort_order: number }[]) {
      for (const item of items) {
        await supabase
          .from('uom_library')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
      }
    },

    async toggleActive(id: string, isActive: boolean) {
      return this.update(id, { is_active: isActive });
    },
  },

  sectionTemplates: {
    async getAll(activeOnly = true) {
      let query = supabase
        .from('section_templates')
        .select('*')
        .order('name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SectionTemplate[];
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('section_templates')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as SectionTemplate | null;
    },

    async create(template: { name: string; description: string; created_by: string }) {
      const { data, error } = await supabase
        .from('section_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      return data as SectionTemplate;
    },

    async update(id: string, updates: Partial<Pick<SectionTemplate, 'name' | 'description' | 'is_active'>>) {
      const { data, error } = await supabase
        .from('section_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SectionTemplate;
    },

    async delete(id: string) {
      const { error } = await supabase
        .from('section_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
  },

  templateRows: {
    async getByTemplateId(templateId: string) {
      const { data, error } = await supabase
        .from('section_template_rows')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as SectionTemplateRow[];
    },

    async create(row: Omit<SectionTemplateRow, 'id'>) {
      const { data, error } = await supabase
        .from('section_template_rows')
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      return data as SectionTemplateRow;
    },

    async update(id: string, updates: Partial<Omit<SectionTemplateRow, 'id' | 'template_id'>>) {
      const { data, error } = await supabase
        .from('section_template_rows')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SectionTemplateRow;
    },

    async delete(id: string) {
      const { error } = await supabase
        .from('section_template_rows')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    async replaceAll(templateId: string, rows: Omit<SectionTemplateRow, 'id'>[]) {
      const { error: deleteError } = await supabase
        .from('section_template_rows')
        .delete()
        .eq('template_id', templateId);

      if (deleteError) throw deleteError;

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('section_template_rows')
          .insert(rows);

        if (insertError) throw insertError;
      }
    },
  },
};
