import { Loader2, Send, Sparkles } from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import type { Artifact } from '@/types';

interface ImaginePanelProps {
  selectedProject: Artifact | null;
  imaginePrompt: string;
  imagineLoading: boolean;
  onPromptChange: (v: string) => void;
  onImagine: () => void;
}

export function ImaginePanel({
  selectedProject,
  imaginePrompt,
  imagineLoading,
  onPromptChange,
  onImagine,
}: ImaginePanelProps) {
  return (
    <SectionCard padding="lg" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[var(--ag-violet)]" />
        <h3 className="text-[var(--ag-text-primary)] font-heading font-semibold">
          {selectedProject ? `Update "${selectedProject.title}"` : 'Create Something New'}
        </h3>
      </div>
      <p className="text-sm text-[var(--ag-text-secondary)] mb-4">
        {selectedProject
          ? 'Describe changes you want — the agent will update your existing project.'
          : 'Describe what you want to build — the agent will create a new project for you.'}
      </p>
      <textarea
        value={imaginePrompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={
          selectedProject
            ? 'e.g. "Add a contact form section with a dark theme..."'
            : 'e.g. "A modern landing page for a SaaS product with pricing cards..."'
        }
        rows={3}
        className="w-full bg-[var(--ag-bg-elevated)] border border-[var(--ag-border-default)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)] resize-none focus:border-[var(--ag-border-active)] outline-none text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-[border-color,box-shadow] duration-150"
      />
      <div className="flex justify-end mt-3">
        <button
          onClick={onImagine}
          disabled={imagineLoading || !imaginePrompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white font-semibold text-sm hover:shadow-[var(--ag-glow-md)] transition-[transform,box-shadow,opacity] duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none min-h-[44px] active:scale-[0.96] shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
        >
          {imagineLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
          ) : (
            <><Send className="w-4 h-4" />Imagine &amp; Build</>
          )}
        </button>
      </div>
    </SectionCard>
  );
}
