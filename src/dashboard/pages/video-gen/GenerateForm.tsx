import { useState } from 'react';
import { SectionCard } from '@/components/agentin';
import type { VideoModel } from '@/services/api';
import {
  Sparkles, Wand2, Send, Loader2, ChevronDown, Check,
  AlertTriangle, AlertCircle,
} from 'lucide-react';
import { durationPresets } from './helpers';

interface GenerateFormProps {
  prompt: string;
  onPromptChange: (v: string) => void;
  generating: boolean;
  selectedModel: string;
  onModelChange: (id: string) => void;
  models: VideoModel[];
  duration: number;
  onDurationChange: (d: number) => void;
  videoCount: number;
  maxVideos: number;
  isProviderBroken: boolean;
  onGenerate: () => void;
}

export function GenerateForm({
  prompt,
  onPromptChange,
  generating,
  selectedModel,
  onModelChange,
  models,
  duration,
  onDurationChange,
  videoCount,
  maxVideos,
  isProviderBroken,
  onGenerate,
}: GenerateFormProps) {
  const [showModelPicker, setShowModelPicker] = useState(false);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  // Estimated runtime based on duration + model tier
  const estimatedSeconds = (() => {
    const base = duration * 6;
    const multiplier =
      currentModel?.tier === 'premium' ? 1.5
      : currentModel?.tier === 'standard' ? 1.1
      : 1.0;
    return Math.max(20, Math.min(Math.round(base * multiplier), 120));
  })();

  return (
    <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
      <div className="flex items-center gap-2 mb-4">
        <Wand2 className="w-5 h-5 text-[var(--ag-gold)]" />
        <h3 className="text-[var(--ag-text-primary)] font-heading font-semibold">Create Video</h3>
      </div>

      {/* Model selector + Duration */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Model picker */}
        <div className="relative">
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)] text-sm text-[var(--ag-text-primary)] hover:border-[var(--ag-violet)]/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--ag-violet)]" />
            {currentModel?.name || 'Select Model'}
            {currentModel?.tier === 'auto' ? (
              <span className="text-xs text-[var(--ag-violet)] ml-1">Auto</span>
            ) : currentModel?.credits ? (
              <span className="text-xs text-[#FFB800] ml-1">{currentModel.credits}cr</span>
            ) : (
              <span className="text-xs text-[#00FF88] ml-1">Free</span>
            )}
            <ChevronDown className="w-3 h-3 text-[var(--ag-text-muted)]" />
          </button>

          {showModelPicker && (
            <div className="absolute top-full left-0 mt-2 w-80 rounded-xl border border-[rgba(139,92,246,0.15)] bg-[rgba(12,12,30,0.6)] backdrop-blur-xl shadow-2xl z-20 overflow-hidden">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onModelChange(m.id); setShowModelPicker(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] hover:bg-[#8B5CF6]/5 transition-colors text-left ${
                    selectedModel === m.id ? 'bg-[#8B5CF6]/10' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--ag-text-primary)]">{m.name}</div>
                    <div className="text-xs text-[var(--ag-text-secondary)]">{m.description}</div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    m.tier === 'auto'    ? 'bg-[#8B5CF6]/10 text-[var(--ag-violet)]' :
                    m.tier === 'free'    ? 'bg-[#00FF88]/10 text-[#00FF88]' :
                    m.tier === 'premium' ? 'bg-[#FFB800]/10 text-[#FFB800]' :
                                          'bg-[#A78BFA]/10 text-[var(--ag-cyan)]'
                  }`}>
                    {m.cost}
                  </span>
                  {selectedModel === m.id && (
                    <Check className="w-4 h-4 text-[var(--ag-violet)] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Duration presets */}
        <div className="flex gap-1.5">
          {durationPresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onDurationChange(preset.val)}
              className={`px-3 py-2 min-h-[44px] rounded-lg text-xs transition-all active:scale-[0.96] ${
                duration === preset.val
                  ? 'bg-[#A78BFA]/15 text-[var(--ag-cyan)] border border-[var(--ag-cyan)]/40 shadow-[0_0_8px_rgba(139,92,246,0.2)]'
                  : 'bg-[var(--ag-bg-base)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-violet)]/30'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt input */}
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Describe the video you want to generate... (e.g. 'A drone flying over a city skyline at sunset, cinematic')"
        rows={3}
        className="w-full bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)]/70 resize-none focus:border-[var(--ag-violet)]/30 outline-none text-sm"
      />

      {/* Footer row */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-xs">
          {videoCount >= maxVideos ? (
            <span className="px-2.5 py-1 rounded-lg bg-[#FF6161]/10 border border-[#FF6161]/20 text-[#FF6161] font-medium">
              Video limit reached ({maxVideos}/{maxVideos})
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-[#A78BFA]/10 border border-[var(--ag-cyan)]/15 text-[var(--ag-cyan)]">
              <strong>{maxVideos - videoCount}</strong> credits remaining · {duration}s · 1280x720
            </span>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={generating || !prompt.trim() || videoCount >= maxVideos || isProviderBroken}
          className="glow-hover flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] text-white font-semibold text-sm hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 transition-all active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--ag-violet)]/20"
          title={isProviderBroken ? 'Video generation is temporarily unavailable from this server region' : ''}
        >
          {isProviderBroken ? (
            <>
              <AlertTriangle className="w-4 h-4" />
              Unavailable
            </>
          ) : generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Generate Video
            </>
          )}
        </button>
      </div>

      {/* Credit-safety notice */}
      {isProviderBroken ? (
        <p className="text-xs text-[var(--ag-amber)] mt-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          Video generation is temporarily unavailable — your credits will not be charged.
        </p>
      ) : (
        <p className="text-xs text-[var(--ag-text-muted)] mt-3 flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3" />
          Est. ~{estimatedSeconds}s for {duration}s clip · The video will appear below once ready.
        </p>
      )}
    </SectionCard>
  );
}
