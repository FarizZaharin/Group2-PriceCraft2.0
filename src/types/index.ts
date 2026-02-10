export type UserRole = 'admin' | 'procurement_officer' | 'estimator' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type EstimateStatus = 'Draft' | 'InReview' | 'Final' | 'Archived';

export interface Estimate {
  id: string;
  title: string;
  category: string;
  category_other: string | null;
  location: string;
  currency: string;
  estimate_class: string;
  timeline_start: string | null;
  timeline_end: string | null;
  duration_value: number | null;
  duration_unit: string | null;
  owner_user_id: string;
  status: EstimateStatus;
  created_at: string;
  updated_at: string;
}

export interface SOWVersion {
  id: string;
  estimate_id: string;
  version_label: string;
  sow_text: string;
  created_by_user_id: string;
  is_current: boolean;
  created_at: string;
}

export interface BoQVersion {
  id: string;
  estimate_id: string;
  version_label: string;
  created_by_user_id: string;
  is_frozen: boolean;
  based_on_boq_version_id: string | null;
  created_at: string;
}

export type RowType = 'LineItem' | 'SectionHeader';
export type RowStatus = 'AIDraft' | 'Final';

export interface BoQRow {
  id: string;
  boq_version_id: string;
  row_type: RowType;
  item_no: string;
  section: string;
  description: string;
  uom: string;
  qty: number | null;
  rate: number | null;
  amount: number | null;
  measurement: string;
  assumptions: string;
  category: string;
  row_status: RowStatus;
  sort_order: number;
  external_key: string | null;
  created_at: string;
  updated_at: string;
}

export type ImportJobStatus = 'pending' | 'committed' | 'failed';

export interface ImportJob {
  id: string;
  estimate_id: string;
  boq_version_id: string;
  actor_user_id: string;
  file_name: string;
  file_path: string | null;
  file_type: string | null;
  status: ImportJobStatus;
  report_json: Record<string, unknown>;
  created_at: string;
}

export interface AddOnConfig {
  id: string;
  estimate_id: string;
  prelims_pct: number;
  contingency_pct: number;
  profit_pct: number;
  tax_pct: number;
  rounding_rule: number;
  created_at: string;
  updated_at: string;
}

export interface RowComment {
  id: string;
  boq_row_id: string;
  comment_text: string;
  created_by_user_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  estimate_id: string;
  actor_user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export type AIRunStatus = 'Draft' | 'Accepted' | 'Rejected';

export interface AIRun {
  id: string;
  estimate_id: string;
  sow_version_id: string;
  output_boq_version_id: string | null;
  model_name: string;
  prompt_context: Record<string, unknown>;
  output_json: Record<string, unknown>;
  status: AIRunStatus;
  created_at: string;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
}

export interface GlobalSettings {
  defaultCurrency: string;
  defaultTaxPercent: number;
  roundingDecimals: number;
  defaultPrelimsPct: number;
  defaultContingencyPct: number;
  defaultProfitPct: number;
}

export interface AdminSettingRow {
  id: string;
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface UomRecord {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface SectionTemplate {
  id: string;
  name: string;
  description: string;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectionTemplateRow {
  id: string;
  template_id: string;
  row_type: RowType;
  section: string;
  description: string;
  uom: string;
  category: string;
  sort_order: number;
}

export const FALLBACK_CATEGORIES = [
  'Prelims',
  'Labour',
  'Material',
  'Equipment',
  'Subcon',
  'Other'
] as const;

export const FALLBACK_UOMS = [
  'LS',
  'm',
  'm2',
  'm3',
  'unit',
  'lot',
  'day',
  'hour',
  'kg',
  'tonne'
] as const;
