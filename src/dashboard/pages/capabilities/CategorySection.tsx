// CategorySection.tsx — pipeline visualizer + hidden powers section components
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import { pipelineSteps, hiddenPowers } from './helpers';

// ── Pipeline Visualizer ────────────────────────────────────

export function PipelineVisualizer() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <SectionCard title="How Every Message Works" subtitle="From your chat to the response — the full request lifecycle">
      <div>
        {/* Example message */}
        <div className="mb-6 p-3 rounded-xl bg-[var(--ag-violet)]/5 border border-[var(--ag-violet)]/15 text-center">
          <span className="text-xs text-[var(--ag-text-secondary)]">You type: </span>
          <span className="text-sm text-[var(--ag-violet)] font-mono">"build me a hello world page"</span>
        </div>

        {/* Steps — horizontal on large desktop, vertical on smaller screens */}
        <div className="hidden lg:flex items-center gap-2">
          {pipelineSteps.map((step, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                className={`flex-1 flex flex-col items-center gap-2 p-3 min-h-[44px] rounded-xl border transition-[transform,border-color,background-color,box-shadow] duration-150 cursor-pointer group active:scale-[0.96] ${
                  activeStep === i
                    ? 'border-opacity-60 bg-opacity-20'
                    : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
                }`}
                style={activeStep === i ? {
                  borderColor: step.color,
                  backgroundColor: `${step.color}10`,
                } : {}}
                onClick={() => setActiveStep(activeStep === i ? null : i)}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    background: `${step.color}15`,
                    boxShadow: activeStep === i ? `0 0 12px ${step.color}40` : 'none',
                  }}
                >
                  <step.icon className="w-4 h-4" style={{ color: step.color }} />
                </div>
                <span className="text-[10px] text-[var(--ag-text-secondary,#9CA3AF)] font-medium text-center leading-tight">
                  {step.label}
                </span>
                {activeStep === i && (
                  <span className="text-[9px] text-center leading-tight font-mono px-1" style={{ color: step.color }}>
                    {step.detail}
                  </span>
                )}
              </button>
              {i < pipelineSteps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-[#2A2A3A] flex-shrink-0 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Vertical pipeline for smaller screens */}
        <div className="lg:hidden space-y-2">
          {pipelineSteps.map((step, i) => (
            <div key={i}>
              <button
                className="w-full flex items-center gap-3 p-3 min-h-[44px] rounded-xl border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-[transform,border-color] duration-150 text-left active:scale-[0.96]"
                onClick={() => setActiveStep(activeStep === i ? null : i)}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${step.color}15` }}
                >
                  <step.icon className="w-4 h-4" style={{ color: step.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[var(--ag-text-primary)]">{step.label}</div>
                  {activeStep === i && (
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: step.color }}>
                      {step.detail}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-[var(--ag-text-secondary,#9CA3AF)]">
                  {i + 1}/{pipelineSteps.length}
                </span>
              </button>
              {i < pipelineSteps.length - 1 && (
                <div className="flex justify-center">
                  <div className="w-px h-3" style={{ background: `${pipelineSteps[i].color}30` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] text-center mt-4">
          Click any step to see the exact data flowing through it
        </p>
      </div>
    </SectionCard>
  );
}

// ── Hidden Powers ──────────────────────────────────────────

export function HiddenPowers() {
  const [expanded, setExpanded] = useState(false);
  const visiblePowers = expanded ? hiddenPowers : hiddenPowers.slice(0, 4);

  return (
    <SectionCard title="Hidden Powers" subtitle="Things most users never discover — but you should know">
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visiblePowers.map((power, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-white/3 border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all group"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:scale-110"
                style={{ background: `${power.color}12`, boxShadow: `0 0 0 1px ${power.color}20` }}
              >
                <power.icon className="w-4 h-4" style={{ color: power.color }} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--ag-text-primary)] mb-1">{power.title}</div>
                <div className="text-[11px] text-[var(--ag-text-secondary,#9CA3AF)] leading-relaxed">
                  {power.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!expanded && hiddenPowers.length > 4 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full mt-4 py-2.5 min-h-[44px] rounded-xl border border-[rgba(139,92,246,0.08)] text-xs text-[var(--ag-text-secondary,#9CA3AF)] hover:border-[rgba(139,92,246,0.15)] hover:text-[var(--ag-text-primary,#F4F6FF)] transition-[transform,border-color,color] duration-150 flex items-center justify-center gap-2 active:scale-[0.96]"
          >
            Show {hiddenPowers.length - 4} more hidden powers
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </SectionCard>
  );
}
