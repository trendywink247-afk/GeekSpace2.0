// ── ToolCard — single template card in the Creative Studio browser ───────────
import { Loader2, LayoutTemplate } from 'lucide-react';
import type { Template } from '@/types';
import { SectionCard } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';

interface ToolCardProps {
  template: Template;
  cloningId: string | null;
  clonedId:  string | null;
  onClone:   (template: Template) => void;
  index:     number;
}

export function ToolCard({ template: tpl, cloningId, clonedId, onClone, index }: ToolCardProps) {
  return (
    <BlurFade delay={index * 0.04} inView>
      <SectionCard
        padding="sm"
        className="!p-0 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_4px_16px_rgba(139,92,246,0.1)] transition-[box-shadow] duration-200"
      >
        {/* Thumbnail */}
        <div className="aspect-video bg-[var(--ag-bg-surface)] backdrop-blur-xl relative overflow-hidden">
          {tpl.thumbnail ? (
            <img
              src={tpl.thumbnail}
              alt={tpl.name}
              className="w-full h-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <LayoutTemplate className="w-10 h-10 text-[var(--ag-violet)]/20" />
            </div>
          )}
          {tpl.isOfficial && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[var(--ag-violet)]/90 text-white text-[10px] font-semibold uppercase tracking-wider">
              Official
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)] truncate">{tpl.name}</h3>
            <p className="text-xs text-[var(--ag-text-secondary)] line-clamp-2 mt-1">{tpl.description}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--ag-text-muted)] uppercase tracking-wider">{tpl.category}</span>
            <button
              onClick={() => onClone(tpl)}
              disabled={cloningId === tpl.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.96] min-h-[44px] ${
                clonedId === tpl.id
                  ? 'bg-[var(--ag-success)]/15 text-[var(--ag-success)]'
                  : 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/25'
              } disabled:opacity-50`}
            >
              {cloningId === tpl.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : clonedId === tpl.id ? (
                <>Cloned</>
              ) : (
                <>Clone</>
              )}
            </button>
          </div>
        </div>
      </SectionCard>
    </BlurFade>
  );
}
