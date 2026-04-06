import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/agentin';
import { portfolioService, agentService } from '@/services/api';
import type { Portfolio, AgentPersonality } from '@/types';

interface AITabProps {
  onAiEdit: (data: Portfolio) => void;
  showMessage: (type: 'success' | 'error', text: string) => void;
}

export function AITab({ onAiEdit, showMessage }: AITabProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [portfolioPersonality, setPortfolioPersonality] = useState<AgentPersonality>('weebo');
  const [personalitySaving, setPersonalitySaving] = useState(false);
  const [personalitySaved, setPersonalitySaved] = useState(false);

  useEffect(() => {
    agentService.getConfig().then(({ data }) => {
      if (data.personality) setPortfolioPersonality(data.personality);
    }).catch(() => { /* non-fatal */ });
  }, []);

  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await portfolioService.aiEdit(aiPrompt);
      onAiEdit(data);
      setAiPrompt('');
      showMessage('success', 'AI edits applied — review and save when ready');
    } catch {
      showMessage('error', 'AI edit failed — try again');
    } finally {
      setAiLoading(false);
    }
  };

  const handlePersonalitySave = async (p: AgentPersonality) => {
    setPortfolioPersonality(p);
    setPersonalitySaving(true);
    try {
      await agentService.updateConfig({ personality: p });
      setPersonalitySaved(true);
      setTimeout(() => setPersonalitySaved(false), 2000);
    } catch {
      // revert on failure
    } finally {
      setPersonalitySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title="AI Portfolio Editor" subtitle="Describe changes in plain English and let AI update your portfolio">
        <div className="space-y-4">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. Make my bio more professional, add a React project, rewrite my headline to focus on AI engineering..."
            className="w-full p-4 rounded-xl bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] min-h-[140px] resize-none focus:outline-none focus:border-[var(--ag-violet)]"
          />
          <Button
            onClick={handleAiEdit}
            disabled={aiLoading || !aiPrompt.trim()}
            className="bg-[#8B5CF6] hover:bg-[#7C3AED] w-full min-h-[44px]"
          >
            {aiLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Apply AI Edit</>
            )}
          </Button>
          <p className="text-xs text-[var(--ag-text-secondary)] text-center">
            Changes are applied locally — review them in the other tabs, then click Save Changes to persist.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Portfolio Agent Personality" subtitle="Choose how your public portfolio agent greets and responds to visitors">
        <div className="flex gap-3 flex-wrap">
          {(
            [
              { id: 'jarvis' as AgentPersonality, label: 'Jarvis', emoji: '🟣', desc: 'Professional butler' },
              { id: 'edith' as AgentPersonality, label: 'Edith', emoji: '🔷', desc: 'Sharp CTO' },
              { id: 'weebo' as AgentPersonality, label: 'Weebo', emoji: '💚', desc: 'Enthusiastic' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => handlePersonalitySave(p.id)}
              disabled={personalitySaving}
              className={`flex-1 min-w-[100px] flex flex-col items-center gap-2 px-4 py-4 rounded-xl border transition-all focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                portfolioPersonality === p.id
                  ? 'border-[var(--ag-violet)]/60 bg-[#8B5CF6]/10'
                  : 'border-[var(--ag-violet)]/20 bg-[var(--ag-bg-base)] hover:border-[var(--ag-violet)]/40'
              }`}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-sm font-medium text-[var(--ag-text-primary)]">{p.label}</span>
              <span className="text-xs text-[var(--ag-text-muted)]">{p.desc}</span>
              {portfolioPersonality === p.id && !personalitySaving && (
                <span className="text-xs text-[var(--ag-violet)]">
                  {personalitySaved ? 'Saved!' : 'Active'}
                </span>
              )}
              {personalitySaving && portfolioPersonality === p.id && (
                <Loader2 className="w-3 h-3 animate-spin text-[var(--ag-violet)]" />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--ag-text-muted)] mt-4 text-center">
          This also applies to your agent in the dashboard. Change it anytime in Agent Settings.
        </p>
      </SectionCard>
    </div>
  );
}
