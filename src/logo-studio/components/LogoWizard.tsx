import { useState, useCallback } from 'react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { ShimmerButton } from '@/components/magicui/shimmer-button';

export interface WizardResult {
  brandName: string;
  industry: string;
  styles: string[];
  colors: string[];
  letAiChooseColors: boolean;
}

export interface LogoWizardProps {
  onComplete: (result: WizardResult) => void;
  onSkipToPrompt: () => void;
  defaultName?: string;
}

const INDUSTRIES = [
  { label: 'Technology', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
  { label: 'E-commerce', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6a1 1 0 00.9 1.4h12.8M10 21a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z' },
  { label: 'Food & Beverage', icon: 'M12 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z' },
  { label: 'Education', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.42A12.08 12.08 0 0121 12.06V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-6.94c0-.55.18-1.08.5-1.52L12 14z' },
  { label: 'Healthcare', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { label: 'Finance', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Fashion', icon: 'M5 3l3.06 7.59L5 18h14l-3.06-7.41L19 3H5zm7 12a2 2 0 100-4 2 2 0 000 4z' },
  { label: 'Real Estate', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Gaming', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
  { label: 'Social Media', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'AI/ML', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { label: 'Other', icon: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z' },
] as const;

const STYLES = [
  { label: 'Minimal', desc: 'Clean & simple', colors: ['#94a3b8', '#e2e8f0'] },
  { label: 'Bold', desc: 'Strong & confident', colors: ['#1a1a2e', '#EF4444'] },
  { label: 'Playful', desc: 'Fun & friendly', colors: ['#F59E0B', '#EC4899', '#10B981'] },
  { label: 'Elegant', desc: 'Premium & refined', colors: ['#F59E0B', '#1e1b4b'] },
  { label: 'Geometric', desc: 'Structured & precise', colors: ['#14b8a6', '#0d9488'] },
  { label: 'Abstract', desc: 'Creative & unique', colors: ['#8B5CF6', '#EC4899'] },
  { label: 'Indian Traditional', desc: 'Cultural & rich', colors: ['#f97316', '#881337'] },
  { label: 'Modern Tech', desc: 'Futuristic & sharp', colors: ['#8B5CF6', '#10B981'] },
] as const;

const COLOR_OPTIONS = [
  { hex: '#8B5CF6', label: 'Violet' },
  { hex: '#10B981', label: 'Emerald' },
  { hex: '#F59E0B', label: 'Gold' },
  { hex: '#EC4899', label: 'Rose' },
  { hex: '#EF4444', label: 'Crimson' },
  { hex: '#3B82F6', label: 'Ocean' },
  { hex: '#F97316', label: 'Amber' },
  { hex: '#64748B', label: 'Slate' },
] as const;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 bg-violet-500'
              : i < current
                ? 'w-2 bg-violet-500/40'
                : 'w-2 bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

function NavButtons({
  step,
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-8">
      {step > 0 ? (
        <button
          onClick={onBack}
          className="min-h-[44px] px-5 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
        >
          Back
        </button>
      ) : (
        <div />
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="min-h-[44px] px-6 py-2.5 rounded-xl text-sm font-medium bg-violet-600/80 hover:bg-violet-600 text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {nextLabel || 'Next'}
      </button>
    </div>
  );
}

export function LogoWizard({ onComplete, onSkipToPrompt, defaultName = '' }: LogoWizardProps) {
  const [step, setStep] = useState(0);
  const [brandName, setBrandName] = useState(defaultName);
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState('#8B5CF6');
  const [letAiChoose, setLetAiChoose] = useState(true);

  const toggleStyle = useCallback((label: string) => {
    setSelectedStyles((prev) => {
      if (prev.includes(label)) return prev.filter((s) => s !== label);
      if (prev.length >= 2) return prev;
      return [...prev, label];
    });
  }, []);

  const toggleColor = useCallback((hex: string) => {
    setSelectedColors((prev) => {
      if (prev.includes(hex)) return prev.filter((c) => c !== hex);
      if (prev.length >= 3) return prev;
      return [...prev, hex];
    });
  }, []);

  const addCustomColor = useCallback(() => {
    if (customColor && !selectedColors.includes(customColor) && selectedColors.length < 3) {
      setSelectedColors((prev) => [...prev, customColor]);
    }
  }, [customColor, selectedColors]);

  const handleGenerate = useCallback(() => {
    const finalIndustry = industry === 'Other' ? customIndustry : industry;
    onComplete({
      brandName: brandName.trim(),
      industry: finalIndustry,
      styles: selectedStyles,
      colors: letAiChoose ? [] : selectedColors,
      letAiChooseColors: letAiChoose,
    });
  }, [brandName, industry, customIndustry, selectedStyles, selectedColors, letAiChoose, onComplete]);

  return (
    <div className="relative mb-8">
      {/* Animated gradient border glow */}
      <div className="absolute -inset-[1px] rounded-2xl opacity-60 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(16,185,129,0.2), rgba(245,158,11,0.15), rgba(139,92,246,0.3))',
          backgroundSize: '300% 300%',
          animation: 'ls-border-shift 8s ease infinite',
          filter: 'blur(1px)',
        }} />
      <style>{`@keyframes ls-border-shift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}`}</style>
      <div className="relative rounded-2xl bg-[#08081e]/90 backdrop-blur-xl p-5 sm:p-8 border border-white/[0.06]">
      {/* Visual anchor icon */}
      <div className="flex justify-center mb-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(16,185,129,0.1))',
            boxShadow: '0 0 30px rgba(139,92,246,0.1)',
          }}>
          <svg className="w-6 h-6 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        </div>
      </div>
      <StepDots current={step} total={4} />

      {/* Step 0: Brand Name */}
      {step === 0 && (
        <BlurFade delay={0.1}>
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-semibold mb-2"
            style={{ background: 'linear-gradient(135deg, #fff 30%, #8B5CF6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            What's your brand name?
          </h2>
          <p className="text-sm text-white/40 mb-6">
            Supports English, Hindi, and regional scripts
          </p>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. Agentin, ChaiPoint, ZestPay"
            autoFocus
            className="w-full text-center text-lg bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white/90 placeholder:text-white/20 outline-none focus:border-violet-500/40 transition-colors"
          />
          <NavButtons
            step={0}
            onBack={() => {}}
            onNext={() => setStep(1)}
            nextDisabled={!brandName.trim()}
          />
          <button
            onClick={onSkipToPrompt}
            className="mt-4 text-sm text-violet-400/50 hover:text-violet-400 transition-colors cursor-pointer"
          >
            Skip to free-form prompt
          </button>
        </div>
        </BlurFade>
      )}

      {/* Step 1: Industry */}
      {step === 1 && (
        <BlurFade delay={0.1}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-white/90 mb-1 text-center">
            What's your industry?
          </h2>
          <p className="text-sm text-white/40 mb-6 text-center">Optional -- helps AI tailor designs</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {INDUSTRIES.map(({ label, icon }) => {
              const active = industry === label;
              return (
                <button
                  key={label}
                  onClick={() => setIndustry(active ? '' : label)}
                  className={`min-h-[44px] flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-all cursor-pointer ${
                    active
                      ? 'border-violet-500/60 bg-violet-500/[0.08]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                  }`}
                >
                  <svg
                    className={`w-5 h-5 ${active ? 'text-violet-400' : 'text-white/30'}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={icon} />
                  </svg>
                  <span className={`text-[11px] leading-tight ${active ? 'text-violet-300' : 'text-white/50'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={customIndustry}
            onChange={(e) => {
              setCustomIndustry(e.target.value);
              if (e.target.value && industry !== 'Other') setIndustry('Other');
            }}
            placeholder="Or type your industry..."
            autoFocus={industry === 'Other'}
            className="mt-3 w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-violet-500/40 transition-colors"
          />
          <NavButtons
            step={1}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
            nextLabel={!industry && !customIndustry ? 'Skip' : 'Next'}
          />
        </div>
        </BlurFade>
      )}

      {/* Step 2: Style */}
      {step === 2 && (
        <BlurFade delay={0.1}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-white/90 mb-1 text-center">
            Pick your style
          </h2>
          <p className="text-sm text-white/40 mb-6 text-center">
            Select up to 2 styles
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STYLES.map(({ label, desc, colors }) => {
              const active = selectedStyles.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleStyle(label)}
                  className={`min-h-[44px] flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all cursor-pointer ${
                    active
                      ? 'border-violet-500/60 bg-violet-500/[0.08] ring-1 ring-violet-500/30'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                  }`}
                >
                  {/* Color swatch */}
                  <div className="flex gap-0.5">
                    {colors.map((c, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full"
                        style={{
                          background:
                            colors.length === 2 && i === 0
                              ? `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
                              : c,
                        }}
                      />
                    ))}
                  </div>
                  <span className={`text-sm font-medium ${active ? 'text-white/90' : 'text-white/70'}`}>
                    {label}
                  </span>
                  <span className={`text-[10px] ${active ? 'text-violet-300/70' : 'text-white/30'}`}>
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>
          <NavButtons
            step={2}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            nextDisabled={selectedStyles.length === 0}
          />
        </div>
        </BlurFade>
      )}

      {/* Step 3: Colors + Generate */}
      {step === 3 && (
        <BlurFade delay={0.1}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-white/90 mb-1 text-center">
            Any color preferences?
          </h2>
          <p className="text-sm text-white/40 mb-6 text-center">Optional -- select up to 3</p>

          {/* AI toggle */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className={`text-sm ${letAiChoose ? 'text-white/40' : 'text-white/70'}`}>Manual</span>
            <button
              onClick={() => setLetAiChoose(!letAiChoose)}
              className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${
                letAiChoose ? 'bg-violet-600' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  letAiChoose ? 'left-6' : 'left-1'
                }`}
              />
            </button>
            <span className={`text-sm ${letAiChoose ? 'text-violet-300' : 'text-white/40'}`}>Let AI choose</span>
          </div>

          {/* Color circles */}
          <div
            className={`transition-opacity ${letAiChoose ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
          >
            <div className="flex flex-wrap justify-center gap-3 mb-4">
              {COLOR_OPTIONS.map(({ hex, label }) => {
                const active = selectedColors.includes(hex);
                return (
                  <button
                    key={hex}
                    onClick={() => toggleColor(hex)}
                    title={label}
                    className={`w-11 h-11 rounded-full border-2 transition-all cursor-pointer ${
                      active ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ background: hex }}
                  >
                    {active && (
                      <svg className="w-5 h-5 mx-auto text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom color */}
            <div className="flex items-center justify-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <span className="text-xs text-white/30 font-mono">{customColor}</span>
              <button
                onClick={addCustomColor}
                disabled={selectedColors.length >= 3}
                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          {/* Generate CTA */}
          <ShimmerButton
            onClick={handleGenerate}
            className="mt-8 w-full"
            shimmerColor="#8B5CF6"
            background="linear-gradient(135deg, #7C3AED, #8B5CF6)"
          >
            <span className="text-white font-medium">Generate 10 Logos</span>
          </ShimmerButton>
          <p className="mt-2.5 text-center text-xs text-white/25">
            Powered by FLUX AI -- takes ~15 seconds
          </p>

          {/* Back */}
          <div className="flex justify-start mt-4">
            <button
              onClick={() => setStep(2)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>
        </BlurFade>
      )}
    </div>
    </div>
  );
}
