import { useState, useEffect, useCallback } from 'react';
import { useLogoStudio } from './useLogoStudio';
import { LogoPreview } from './components/LogoPreview';
import { LogoControls } from './components/LogoControls';
import { VariantGrid } from './components/VariantGrid';
import { ExportPanel } from './components/ExportPanel';
import { StudioHeader } from './components/StudioHeader';
import { AiSuggest } from './components/AiSuggest';
import { FavoritesPanel } from './components/FavoritesPanel';
import { LogoWizard } from './components/LogoWizard';
import { ChatRefine } from './components/ChatRefine';
import { BrandKitPanel } from './components/BrandKitPanel';
import { ShareCard } from './components/ShareCard';
import { LogoSVG } from './LogoEngine';
import { PRESETS } from './presets';
import type { LogoParams } from './types';
import type { WizardResult } from './components/LogoWizard';

interface FavoriteConcept { name: string; url: string; timestamp: number }

const FAVORITES_KEY = 'gs-logo-favorites';
const ChevronSvg = ({ cls }: { cls?: string }) => (
  <svg className={`w-4 h-4 ${cls || ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export function LogoStudioPage() {
  const studio = useLogoStudio();
  const [phase, setPhase] = useState<'wizard' | 'studio'>('wizard');
  const [wizardResult, setWizardResult] = useState<WizardResult | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<{ name: string; url: string; prompt?: string } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fading, setFading] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteConcept[]>([]);

  useEffect(() => {
    try { const s = localStorage.getItem(FAVORITES_KEY); if (s) setFavorites(JSON.parse(s)); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  const removeFavorite = useCallback((url: string) => setFavorites(p => p.filter(f => f.url !== url)), []);
  const clearAllFavorites = useCallback(() => setFavorites([]), []);

  const fadeToPhase = useCallback((next: 'wizard' | 'studio', result?: WizardResult | null) => {
    if (result !== undefined) setWizardResult(result);
    setFading(true);
    setTimeout(() => { setPhase(next); setTimeout(() => setFading(false), 50); }, 300);
  }, []);

  const chatProps = {
    currentConcept: selectedConcept,
    companyName: wizardResult?.brandName || '',
    style: wizardResult?.styles?.join(', ') || '',
    onSelectConcept: setSelectedConcept,
    onClose: () => setShowChat(false),
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--lp-bg, #06061a)' }}>
      {/* Keyframes for logo studio animations */}
      <style>{`
        @keyframes ls-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-20px) scale(1.05)}}
        @keyframes ls-pulse-glow{0%,100%{opacity:0.03}50%{opacity:0.06}}
        @keyframes ls-card-reveal{from{opacity:0;transform:scale(0.85) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes ls-skeleton-pulse{0%,100%{opacity:0.04}50%{opacity:0.1}}
        .ls-card-reveal{animation:ls-card-reveal 0.45s cubic-bezier(0.16,1,0.3,1) both}
        .ls-skeleton{animation:ls-skeleton-pulse 1.5s ease-in-out infinite}
      `}</style>

      {/* Layer 0: Noise texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Layer 1: Aurora mesh gradient (matching landing hero) */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.06) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%)
        `,
      }} />

      {/* Layer 2: Dot grid with radial fade */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
      }} />

      {/* Layer 3: Atmospheric depth blob */}
      <div className="fixed left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full pointer-events-none"
        style={{ background: 'rgba(139, 92, 246, 0.025)', filter: 'blur(140px)', animation: 'ls-pulse-glow 8s ease-in-out infinite' }} />

      {/* Layer 4: Floating orbs */}
      <div className="fixed top-[15%] left-[10%] w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'rgba(16, 185, 129, 0.03)', filter: 'blur(60px)', animation: 'ls-float 12s ease-in-out infinite' }} />
      <div className="fixed top-[60%] right-[8%] w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'rgba(245, 158, 11, 0.02)', filter: 'blur(80px)', animation: 'ls-float 16s ease-in-out infinite 3s' }} />

      <StudioHeader />
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-6">
        {phase === 'wizard' && (
          <div className="transition-opacity duration-300" style={{ opacity: fading ? 0 : 1 }}>
            <LogoWizard
              onComplete={r => fadeToPhase('studio', r)}
              onSkipToPrompt={() => fadeToPhase('studio', null)}
              defaultName={wizardResult?.brandName}
            />
          </div>
        )}

        {phase === 'studio' && (
          <div className="transition-opacity duration-300" style={{ opacity: fading ? 0 : 1 }}>
            {wizardResult && <SummaryBar result={wizardResult} onEdit={() => fadeToPhase('wizard')} />}

            <div className="flex flex-col md:flex-row gap-4 mt-4">
              <div className={showChat ? 'w-full md:w-[60%]' : 'w-full'}>
                <AiSuggest currentParams={studio.params} onApply={studio.setParams} wizardResult={wizardResult} onSelectForRefine={setSelectedConcept} />
                {selectedConcept && !showChat && (
                  <button onClick={() => setShowChat(true)}
                    className="mt-3 w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-medium bg-violet-600/80 hover:bg-violet-600 text-white transition-colors cursor-pointer flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Refine with Jarvis
                  </button>
                )}
              </div>
              {showChat && (
                <>
                  <div className="hidden md:block md:w-[40%] md:sticky md:top-20 md:max-h-[calc(100vh-100px)]">
                    <ChatRefine {...chatProps} />
                  </div>
                  <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowChat(false)} />
                    <div className="relative z-10 max-h-[75vh]"><ChatRefine {...chatProps} /></div>
                  </div>
                </>
              )}
            </div>

            {wizardResult && (
              <section className="mt-8">
                <BrandKitPanel companyName={wizardResult.brandName} industry={wizardResult.industry}
                  style={wizardResult.styles.join(', ')} primaryColor={wizardResult.colors[0]} />
              </section>
            )}
            {selectedConcept && (
              <section className="mt-8">
                <ShareCard logoUrl={selectedConcept.url} brandName={wizardResult?.brandName || selectedConcept.name} />
              </section>
            )}
            {favorites.length > 0 && (
              <section className="mt-8">
                <FavoritesPanel favorites={favorites} onRemove={removeFavorite} onClearAll={clearAllFavorites} />
              </section>
            )}

            {/* Advanced: Parametric SVG (collapsed by default) */}
            <section className="mt-8">
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-5 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm text-white/40 hover:text-white/60 hover:border-white/10 transition-colors cursor-pointer">
                <span>Advanced: Parametric SVG</span>
                <ChevronSvg cls={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
              {showAdvanced && (
                <div className="mt-4 space-y-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 md:w-3/5"><LogoPreview params={studio.params} /></div>
                    <div className="md:w-2/5 md:max-h-[calc(100vh-120px)] md:overflow-y-auto md:sticky md:top-20 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                      <LogoControls params={studio.params} onChange={studio.setParams} onRandomize={studio.randomize} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.15em] text-white/30 font-medium mb-3">Presets</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                      {PRESETS.map((p, i) => (
                        <button key={i} onClick={() => studio.setParams(p.params)}
                          className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors cursor-pointer ${
                            matchPreset(studio.params, p.params) ? 'border-violet-500/60 bg-violet-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'}`}>
                          <div className="w-12 h-12 rounded-lg bg-[#06061a] flex items-center justify-center">
                            <LogoSVG params={p.params} size={32} />
                          </div>
                          <span className="text-[10px] text-white/50 whitespace-nowrap">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <VariantGrid variants={studio.variants} activeId={studio.activeVariantId}
                    onSelect={studio.loadVariant} onDelete={studio.deleteVariant} onSave={() => studio.saveVariant()} />
                  <ExportPanel onExportSVG={studio.exportSVG} onCopyCode={studio.copySVGCode} svgString={studio.svgString} />
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

/* Wizard Summary Bar -- inline sub-component */
function SummaryBar({ result, onEdit }: { result: WizardResult; onEdit: () => void }) {
  const [open, setOpen] = useState(true);
  const pills = [result.brandName, result.industry, ...result.styles].filter(Boolean);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors cursor-pointer">
          <ChevronSvg cls={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="uppercase tracking-[0.12em] font-medium">Brand Brief</span>
        </button>
        <button onClick={onEdit}
          className="px-3 py-1 rounded-lg text-[11px] font-medium text-violet-400/70 hover:text-violet-400 border border-violet-500/20 hover:border-violet-500/40 transition-colors cursor-pointer">
          Edit
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {pills.map(t => <Pill key={t} text={t} />)}
          {result.colors.map(hex => (
            <span key={hex} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-white/60 bg-white/[0.05] border border-white/[0.06]">
              <span className="w-3 h-3 rounded-full" style={{ background: hex }} />{hex}
            </span>
          ))}
          {result.letAiChooseColors && (
            <span className="px-2.5 py-1 rounded-full text-[11px] text-violet-400/60 bg-violet-500/[0.06] border border-violet-500/20">
              AI-chosen colors
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const Pill = ({ text }: { text: string }) => (
  <span className="px-2.5 py-1 rounded-full text-[11px] text-white/60 bg-white/[0.05] border border-white/[0.06]">{text}</span>
);

function matchPreset(current: LogoParams, preset: LogoParams): boolean {
  return (Object.keys(preset) as (keyof LogoParams)[]).every(k => current[k] === preset[k]);
}
