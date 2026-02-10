import { useState } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  XCircle,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { analyzeScope, type ScopeAnalysisResult } from '../../../lib/ai-service';
import { supabase } from '../../../lib/supabase';

interface ScopeAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sowText: string;
  category?: string;
}

const SEVERITY_STYLES = {
  high: 'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
};

const SEVERITY_DOT = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
};

export default function ScopeAnalysisPanel({
  isOpen,
  onClose,
  sowText,
  category,
}: ScopeAnalysisPanelProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScopeAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const data = await analyzeScope(sowText, category, accessToken);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scope analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">Scope Analysis</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!result && !analyzing && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-teal-600" />
              </div>
              <p className="text-base font-semibold text-gray-900 mb-1">
                Analyze Scope of Work
              </p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
                AI will review your SOW to identify missing items, suggest questions to ask,
                and recommend assumptions and exclusions.
              </p>
              <button
                onClick={handleAnalyze}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Run Analysis
              </button>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-teal-600" />
                </div>
                <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">Analyzing scope...</p>
                <p className="text-xs text-gray-400 mt-1">This may take 10-20 seconds</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Analysis failed</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {result.missingItems.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h4 className="text-sm font-semibold text-gray-900">
                      Likely Missing Items
                    </h4>
                    <span className="text-xs text-gray-500">
                      ({result.missingItems.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {result.missingItems.map((item, i) => (
                      <div
                        key={i}
                        className={`px-3 py-2.5 rounded-md border ${SEVERITY_STYLES[item.severity]}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[item.severity]}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.item}</p>
                            {item.rationale && (
                              <p className="text-xs opacity-80 mt-0.5">{item.rationale}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {result.clarificationQuestions.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <HelpCircle className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-semibold text-gray-900">
                      Clarification Questions
                    </h4>
                    <span className="text-xs text-gray-500">
                      ({result.clarificationQuestions.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {result.clarificationQuestions.map((q, i) => (
                      <div
                        key={i}
                        className="px-3 py-2.5 rounded-md border border-blue-200 bg-blue-50/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-blue-900 font-medium">{q.question}</p>
                            {q.context && (
                              <p className="text-xs text-blue-600 mt-0.5">
                                Re: {q.context}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleCopy(q.question, `q-${i}`)}
                            className="shrink-0 p-1 text-blue-400 hover:text-blue-700 transition-colors"
                            title="Copy question"
                          >
                            {copiedIdx === `q-${i}` ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {result.suggestedAssumptions.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-sm font-semibold text-gray-900">
                      Suggested Assumptions & Exclusions
                    </h4>
                    <span className="text-xs text-gray-500">
                      ({result.suggestedAssumptions.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {result.suggestedAssumptions.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                a.type === 'exclusion'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {a.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800">{a.assumption}</p>
                        </div>
                        <button
                          onClick={() => handleCopy(a.assumption, `a-${i}`)}
                          className="shrink-0 p-1 text-gray-400 hover:text-gray-700 transition-colors"
                          title="Copy text"
                        >
                          {copiedIdx === `a-${i}` ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setResult(null);
                    setError(null);
                    handleAnalyze();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-300 rounded-md hover:bg-teal-100 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Re-analyze
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
