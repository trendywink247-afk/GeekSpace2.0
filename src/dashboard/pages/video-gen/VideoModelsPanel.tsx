import { SectionCard } from '@/components/agentin';
import { Film, ChevronDown } from 'lucide-react';

interface VideoModel {
  id: string;
  name: string;
  description: string;
  cost: string;
  credits: number;
  tier: string;
}

interface VideoModelsPanelProps {
  videoModels: VideoModel[];
  videoModelStatuses: Record<string, 'ok' | 'down' | 'unknown'>;
  preferredVideoModel: string;
  savingVideoModel: string | null;
  showPanel: boolean;
  onToggle: () => void;
  onSetDefault: (id: string) => void;
}

export function VideoModelsPanel({
  videoModels,
  videoModelStatuses,
  preferredVideoModel,
  savingVideoModel,
  showPanel,
  onToggle,
  onSetDefault,
}: VideoModelsPanelProps) {
  return (
    <SectionCard padding="sm" className="overflow-hidden bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 min-h-[44px] hover:bg-[#8B5CF6]/5 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[var(--ag-gold)]" />
          <span className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">
            Available Video Models
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--ag-text-muted)] transition-transform ${showPanel ? 'rotate-180' : ''}`} />
      </button>

      {showPanel && (
        <div className="border-t border-[rgba(139,92,246,0.08)] divide-y divide-[rgba(139,92,246,0.05)]">
          {videoModels.map((model) => {
            const status = videoModelStatuses[model.id] ?? 'unknown';
            const isDefault = preferredVideoModel === model.id;
            const isSaving = savingVideoModel === model.id;
            return (
              <div key={model.id} className={`flex items-center gap-4 px-4 py-3 ${isDefault ? 'bg-[#8B5CF6]/5' : ''}`}>
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    status === 'ok' ? 'bg-[#00FF88]' : status === 'down' ? 'bg-[#FF6161]' : 'bg-[#6B7280]'
                  }`}
                  title={status}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--ag-text-primary)]">{model.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      model.tier === 'auto'    ? 'bg-[#8B5CF6]/15 text-[var(--ag-violet)]' :
                      model.tier === 'free'    ? 'bg-[#00FF88]/15 text-[#00FF88]' :
                      model.tier === 'premium' ? 'bg-[#FFB800]/15 text-[#FFB800]' :
                                                'bg-[#A78BFA]/15 text-[var(--ag-cyan)]'
                    }`}>
                      {model.cost}
                    </span>
                    {isDefault && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[var(--ag-violet)] font-medium">
                        Your default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--ag-text-muted)] mt-0.5 truncate">{model.description}</p>
                </div>
                <button
                  onClick={() => onSetDefault(model.id)}
                  disabled={isDefault || isSaving}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isDefault
                      ? 'bg-[#8B5CF6]/10 text-[var(--ag-violet)] cursor-default'
                      : 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/20 disabled:opacity-50'
                  }`}
                >
                  {isSaving ? '...' : isDefault ? '✓ Default' : 'Set default'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
