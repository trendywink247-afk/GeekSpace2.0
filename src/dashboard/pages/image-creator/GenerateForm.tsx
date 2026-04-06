// ============================================================
// GenerateForm — prompt input, model selector, settings, generate button
// All form-local state is owned here; results bubble up via onGenerate()
// ============================================================

import { useState, useRef } from 'react';
import {
  Sparkles, Send, Loader2, Upload,
  ChevronDown, Check, AlertCircle, X,
} from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import type { ImageModel } from '@/services/api';
import { StyleSelector } from './StyleSelector';
import { SIZE_PRESETS, type GenerationPhase } from './helpers';

export interface GenerateFormProps {
  mode:       'imagine' | 'edit';
  models:     ImageModel[];
  generating: boolean;
  genPhase:   GenerationPhase;
  imageCount: number;
  maxImages:  number;
  onGenerate: (
    finalPrompt:   string,
    referenceUrl:  string,
    selectedModel: string,
    width:         number,
    height:        number,
  ) => void;
  onToast: (text: string, type?: 'success' | 'error') => void;
}

export function GenerateForm({
  mode, models, generating, genPhase, imageCount, maxImages, onGenerate, onToast,
}: GenerateFormProps) {
  // ---- Form-local state ----
  const [prompt,             setPrompt]             = useState('');
  const [selectedModel,      setSelectedModel]      = useState('auto');
  const [showModelPicker,    setShowModelPicker]    = useState(false);
  const [width,              setWidth]              = useState(1024);
  const [height,             setHeight]             = useState(1024);
  const [promptStyle,        setPromptStyle]        = useState('');
  const [promptLighting,     setPromptLighting]     = useState('');
  const [promptMood,         setPromptMood]         = useState('');
  const [showPromptBuilder,  setShowPromptBuilder]  = useState(false);
  const [referenceUrl,       setReferenceUrl]       = useState('');
  const [referencePreview,   setReferencePreview]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModel = models.find(m => m.id === selectedModel) ?? models[0];

  // ---- Helpers ----
  function buildEnhancedPrompt(): string {
    const parts: string[] = [];
    if (prompt.trim())     parts.push(prompt.trim());
    if (promptStyle)       parts.push(`${promptStyle} style`);
    if (promptLighting)    parts.push(`${promptLighting} lighting`);
    if (promptMood)        parts.push(`${promptMood} mood`);
    return parts.join(', ');
  }

  function handleEnhancePrompt() {
    if (!prompt.trim()) return;
    const enhanced = buildEnhancedPrompt();
    const qualityKeywords = ['highly detailed', '8k resolution', 'masterpiece'];
    const lower  = enhanced.toLowerCase();
    const extras = qualityKeywords.filter(kw => !lower.includes(kw));
    const final  = extras.length > 0 ? `${enhanced}, ${extras.join(', ')}` : enhanced;
    setPrompt(final);
    setPromptStyle('');
    setPromptLighting('');
    setPromptMood('');
    onToast('Prompt enhanced with style keywords!');
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onToast('Image too large (max 5MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setReferencePreview(dataUrl);
      setReferenceUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!prompt.trim()) return;
    const finalPrompt = promptStyle || promptLighting || promptMood
      ? buildEnhancedPrompt()
      : prompt.trim();
    onGenerate(finalPrompt, referenceUrl, selectedModel, width, height);
  }

  // ---- Render ----
  return (
    <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
      <div className="relative">

        {/* ── Reference image upload (edit mode) ── */}
        {mode === 'edit' && (
          <div className="mb-5">
            <label className="text-sm text-[var(--ag-text-secondary)] mb-2 block">
              Reference Image (optional)
            </label>
            <div className="flex gap-3 items-start">
              {referencePreview ? (
                <div className="relative group">
                  <img
                    src={referencePreview}
                    alt="Reference"
                    className="w-24 h-24 rounded-xl object-cover border border-[var(--ag-border-glow)]"
                  />
                  <button
                    onClick={() => { setReferencePreview(''); setReferenceUrl(''); }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#FF6161] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove reference image"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-[var(--ag-border-default)] hover:border-[var(--ag-violet)]/40 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                  aria-label="Upload reference image"
                >
                  <Upload className="w-5 h-5 text-[var(--ag-text-secondary)]" />
                  <span className="text-xs text-[var(--ag-text-secondary)]">Upload</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <p className="text-xs text-[var(--ag-text-secondary)] mt-1 flex-1">
                Upload a reference image and describe the edits you want.
              </p>
            </div>
          </div>
        )}

        {/* ── Model selector + Size presets ── */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-default)] text-sm text-[var(--ag-text-primary)] hover:border-[var(--ag-violet)]/40 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--ag-violet)]" />
              {currentModel?.name ?? 'Select Model'}
              {currentModel?.tier === 'auto' ? (
                <span className="text-xs text-[var(--ag-violet)] ml-1">Auto</span>
              ) : currentModel?.credits ? (
                <span className="text-xs text-[#FFB800] ml-1">{currentModel.credits}cr</span>
              ) : (
                <span className="text-xs text-[#00FF88] ml-1">Free</span>
              )}
              <ChevronDown className="w-3 h-3 text-[var(--ag-text-secondary)]" />
            </button>

            {showModelPicker && (
              <div
                className="absolute top-full left-0 mt-2 w-80 rounded-xl border border-[var(--ag-border-default)] bg-[var(--ag-bg-surface)] shadow-2xl z-20 overflow-hidden"
                style={{ backdropFilter: 'blur(var(--ag-glass-blur))' }}
              >
                {models.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#8B5CF6]/5 transition-colors text-left ${selectedModel === m.id ? 'bg-[#8B5CF6]/10' : ''}`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--ag-text-primary)]">{m.name}</div>
                      <div className="text-xs text-[var(--ag-text-secondary)]">{m.description}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.tier === 'auto'    ? 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)]' :
                      m.tier === 'free'    ? 'bg-[#00FF88]/10 text-[#00FF88]'                   :
                      m.tier === 'premium' ? 'bg-[#FFB800]/10 text-[#FFB800]'                   :
                                             'bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)]'
                    }`}>
                      {m.cost}
                    </span>
                    {selectedModel === m.id && <Check className="w-4 h-4 text-[var(--ag-violet)] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Size presets (imagine mode only) */}
          {mode === 'imagine' && (
            <div className="flex gap-1.5 flex-wrap">
              {SIZE_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => { setWidth(preset.w); setHeight(preset.h); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.96] min-h-[44px] ${
                    width === preset.w && height === preset.h
                      ? 'bg-[#8B5CF6]/15 text-[var(--ag-violet)] border border-[var(--ag-violet)]/40 shadow-[0_0_8px_rgba(139,92,246,0.2)]'
                      : 'bg-[var(--ag-bg-deep)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-violet)]/30'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Style / Lighting / Mood builder (imagine mode only) ── */}
        {mode === 'imagine' && (
          <StyleSelector
            promptStyle={promptStyle}       setPromptStyle={setPromptStyle}
            promptLighting={promptLighting} setPromptLighting={setPromptLighting}
            promptMood={promptMood}         setPromptMood={setPromptMood}
            showPromptBuilder={showPromptBuilder}
            setShowPromptBuilder={setShowPromptBuilder}
          />
        )}

        {/* ── Prompt textarea ── */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === 'edit'
              ? 'Describe the changes you want to make…'
              : 'Describe the image you want to generate…'
          }
          rows={3}
          className={`w-full bg-[var(--ag-bg-deep)] border rounded-xl px-4 py-3 text-[var(--ag-text-primary)] placeholder-[#6B7280]/50 resize-none outline-none text-sm ${
            mode === 'imagine'
              ? 'border-[var(--ag-violet)]/20 focus:border-[var(--ag-violet)]/50'
              : 'border-[var(--ag-border-glow)] focus:border-[var(--ag-border-active)]'
          }`}
        />

        {/* ── Enhance prompt (imagine + non-empty) ── */}
        {mode === 'imagine' && prompt.trim() && (
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleEnhancePrompt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/10 border border-[var(--ag-violet)]/20 text-xs text-[var(--ag-violet)] hover:bg-[#8B5CF6]/20 transition-colors active:scale-[0.96]"
            >
              <Sparkles className="w-3 h-3" />
              Enhance Prompt
            </button>
            {(promptStyle || promptLighting || promptMood) && (
              <span className="text-[10px] text-[var(--ag-text-secondary)]">
                Will add: {[promptStyle, promptLighting, promptMood].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        )}

        {/* ── Generation progress ── */}
        {genPhase !== 'idle' && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              {(['submitting', 'generating', 'done'] as const).map((step, i) => {
                const isActive = step === genPhase;
                const isPast   = (genPhase === 'generating' && i === 0) || (genPhase === 'done' && i <= 1);
                const isFailed = genPhase === 'error' && step === 'generating';
                return (
                  <div key={step} className="flex items-center gap-2">
                    {i > 0 && (
                      <div className={`w-8 h-0.5 rounded-full ${isPast ? 'bg-[#8B5CF6]' : 'bg-[#1A1A2E]'}`} />
                    )}
                    <div className={`flex items-center gap-1 text-xs font-medium transition-all ${
                      isFailed  ? 'text-[#FF6161]'                    :
                      isActive  ? 'text-[var(--ag-violet)]'           :
                      isPast    ? 'text-[var(--ag-violet)]/60'        :
                                  'text-[var(--ag-text-secondary)]/40'
                    }`}>
                      {isActive && genPhase !== 'done' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {isPast    && <Check       className="w-3 h-3" />}
                      {isFailed  && <AlertCircle className="w-3 h-3" />}
                      <span className="capitalize">
                        {step === 'submitting' ? 'Sending' : step === 'generating' ? 'Creating' : 'Complete'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {genPhase === 'generating' && (
              <div className="w-full h-1 rounded-full bg-[var(--ag-bg-deep)] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] rounded-full animate-pulse"
                  style={{ width: '60%' }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Footer: credits info + generate button ── */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs">
            {imageCount >= maxImages ? (
              <span className="px-2.5 py-1 rounded-lg bg-[#FF6161]/10 border border-[#FF6161]/20 text-[#FF6161] font-medium">
                Image limit reached ({maxImages}/{maxImages})
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-[#8B5CF6]/10 border border-[var(--ag-violet)]/15 text-[var(--ag-violet)]">
                <strong>{maxImages - imageCount}</strong> credits remaining &middot; {width}x{height}
              </span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={generating || !prompt.trim() || imageCount >= maxImages}
            className="glow-hover flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-violet-bright)] text-white font-semibold text-sm hover:from-[#7C3AED] hover:to-[#8B5CF6] transition-all active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--ag-violet)]/25"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
            ) : (
              <><Send className="w-4 h-4" />{mode === 'edit' ? 'Generate Edit' : 'Imagine'}</>
            )}
          </button>
        </div>

      </div>
    </SectionCard>
  );
}
