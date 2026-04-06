// ============================================================
// ModelsPanel — collapsible list of available image models with
//               status indicators and set-as-default action
// ============================================================

import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { SectionCard } from '@/components/agentin';
import type { ImageModel } from '@/services/api';

interface ModelsPanelProps {
  models:               ImageModel[];
  modelStatuses:        Record<string, 'ok' | 'down' | 'unknown'>;
  preferredImageModel:  string;
  savingModel:          string | null;
  showModelsPanel:      boolean;
  setShowModelsPanel:   (v: boolean | ((prev: boolean) => boolean)) => void;
  onSetDefault:         (modelId: string) => void;
}

export function ModelsPanel({
  models, modelStatuses, preferredImageModel, savingModel,
  showModelsPanel, setShowModelsPanel, onSetDefault,
}: ModelsPanelProps) {
  if (models.length === 0) return null;

  return (
    <BlurFade delay={0.4} inView>
      <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
        {/* Toggle header */}
        <button
          onClick={() => setShowModelsPanel(p => !p)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#8B5CF6]/5 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--ag-violet)]" />
            <span className="font-heading text-sm font-semibold text-[var(--ag-text-primary)]">
              Available Image Models
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[var(--ag-text-secondary)] transition-transform ${showModelsPanel ? 'rotate-180' : ''}`} />
        </button>

        {/* Model rows */}
        {showModelsPanel && (
          <div className="border-t border-[var(--ag-border-subtle)] divide-y divide-[var(--ag-border-subtle)]">
            {models.map(model => {
              const status    = modelStatuses[model.id] ?? 'unknown';
              const isDefault = preferredImageModel === model.id;
              const isSaving  = savingModel === model.id;
              return (
                <div key={model.id} className={`flex items-center gap-4 px-4 py-3 ${isDefault ? 'bg-[#8B5CF6]/5' : ''}`}>
                  {/* Status dot */}
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      status === 'ok'   ? 'bg-[#00FF88]' :
                      status === 'down' ? 'bg-[#FF6161]' : 'bg-[#6B7280]'
                    }`}
                    title={status}
                  />

                  {/* Model info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--ag-text-primary)]">{model.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        model.tier === 'auto'    ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)]' :
                        model.tier === 'free'    ? 'bg-[#00FF88]/15 text-[#00FF88]'                   :
                        model.tier === 'premium' ? 'bg-[#FFB800]/15 text-[#FFB800]'                   :
                                                   'bg-[var(--ag-cyan)]/15 text-[var(--ag-cyan)]'
                      }`}>
                        {model.cost}
                      </span>
                      {isDefault && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[var(--ag-violet)] border border-[var(--ag-violet)]/30">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--ag-text-secondary)] mt-0.5">{model.description}</div>
                  </div>

                  {/* Set default button */}
                  <button
                    onClick={() => onSetDefault(model.id)}
                    disabled={isSaving || isDefault}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors min-h-[44px] ${
                      isDefault
                        ? 'text-[var(--ag-violet)] cursor-default'
                        : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] hover:bg-[#8B5CF6]/10 border border-[var(--ag-border-subtle)]'
                    }`}
                  >
                    {isSaving
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : isDefault ? 'Default' : 'Set Default'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </BlurFade>
  );
}
