export interface AIGeneratedRow {
  section: string;
  description: string;
  uom: string;
  qty: number | null;
  measurement: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface GenerateBoQParams {
  sowText: string;
  category?: string;
  duration?: string;
  location?: string;
  estimateClass?: string;
}

export interface GenerateBoQResult {
  rows: AIGeneratedRow[];
  model: string;
  usage: Record<string, unknown>;
}

export interface MissingItem {
  item: string;
  severity: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface ClarificationQuestion {
  question: string;
  context: string;
}

export interface SuggestedAssumption {
  assumption: string;
  type: 'assumption' | 'exclusion';
}

export interface ScopeAnalysisResult {
  missingItems: MissingItem[];
  clarificationQuestions: ClarificationQuestion[];
  suggestedAssumptions: SuggestedAssumption[];
  model: string;
  usage: Record<string, unknown>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Edge function returned ${response.status}`);
  }

  return data as T;
}

export async function generateDraftBoQ(
  params: GenerateBoQParams,
  accessToken: string
): Promise<GenerateBoQResult> {
  return callEdgeFunction<GenerateBoQResult>('generate-boq', {
    sowText: params.sowText,
    category: params.category,
    duration: params.duration,
    location: params.location,
    estimateClass: params.estimateClass,
  }, accessToken);
}

export async function analyzeScope(
  sowText: string,
  category: string | undefined,
  accessToken: string
): Promise<ScopeAnalysisResult> {
  return callEdgeFunction<ScopeAnalysisResult>('analyze-scope', {
    sowText,
    category,
  }, accessToken);
}
