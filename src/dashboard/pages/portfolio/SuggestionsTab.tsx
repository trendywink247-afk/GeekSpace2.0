import { useState } from 'react';
import { Lightbulb, Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/agentin';
import { portfolioService } from '@/services/api';
import type { Portfolio } from '@/types';

export interface PortfolioSuggestion {
  id: string;
  field: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  confidence: number;
}

interface SuggestionsTabProps {
  suggestions: PortfolioSuggestion[];
  setSuggestions: (v: PortfolioSuggestion[]) => void;
  loadingSuggestions: boolean;
  onSuggestionApplied: (data: Portfolio) => void;
  showMessage: (type: 'success' | 'error', text: string) => void;
}

export function SuggestionsTab({
  suggestions, setSuggestions, loadingSuggestions, onSuggestionApplied, showMessage,
}: SuggestionsTabProps) {
  const [applyingSuggestion, setApplyingSuggestion] = useState<string | null>(null);

  const handleApplySuggestion = async (suggestionId: string) => {
    setApplyingSuggestion(suggestionId);
    try {
      await portfolioService.applySuggestion(suggestionId);
      const { data } = await portfolioService.get();
      onSuggestionApplied(data);
      setSuggestions(suggestions.filter((s) => s.id !== suggestionId));
      showMessage('success', 'Suggestion applied — save to persist');
    } catch {
      showMessage('error', 'Failed to apply suggestion');
    } finally {
      setApplyingSuggestion(null);
    }
  };

  return (
    <SectionCard title="Memory-Driven Suggestions" subtitle="AI found these portfolio-worthy items from your conversations">
      <div className="space-y-4">
        {loadingSuggestions ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#EC4899] animate-spin" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-12 h-12 text-[#EC4899]/30 mx-auto mb-4" />
            <p className="text-[var(--ag-text-muted)] mb-2">No suggestions yet</p>
            <p className="text-sm text-[var(--ag-text-muted)]/70">
              Chat with your agent about projects and accomplishments — suggestions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-4 rounded-lg bg-[var(--ag-bg-base)] shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_2px_8px_rgba(0,0,0,0.1)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.16),0_4px_16px_rgba(0,0,0,0.18)] transition-[box-shadow] duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="border-[rgba(139,92,246,0.15)] text-[#EC4899]">
                        {suggestion.field}
                      </Badge>
                      <span className="text-xs text-[var(--ag-text-muted)]">
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-[var(--ag-text-primary)] mb-1">{suggestion.reason}</p>
                    <p className="text-sm text-[var(--ag-text-muted)] line-clamp-2">{suggestion.suggestedValue}</p>
                  </div>
                  <Button
                    onClick={() => handleApplySuggestion(suggestion.id)}
                    disabled={applyingSuggestion === suggestion.id}
                    size="sm"
                    className="bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88] hover:bg-[#00FF88]/20 shrink-0"
                  >
                    {applyingSuggestion === suggestion.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-1" />Apply</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--ag-text-secondary)] text-center pt-4">
          Suggestions are based on memories from your agent conversations. Review before applying.
        </p>
      </div>
    </SectionCard>
  );
}
