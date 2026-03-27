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
import { ColorVariants } from './components/ColorVariants';
import { LogoSVG } from './LogoEngine';
import { PRESETS } from './presets';
import { PageShell } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
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
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'logo-studio' });
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
    <div className="min-h-screen" style={{ background: 'var(--ag-bg-base, #06061a)' }}>
      {/* Keyframes for logo studio animations */}
      <style>{`
        @keyframes ls-card-reveal{from{opacity:0;transform:scale(0.85) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes ls-skeleton-pulse{0%,100%{opacity:0.04}50%{opacity:0.1}}
        .ls-card-reveal{animation:ls-card-reveal 0.45s cubic-bezier(0.16,1,0.3,1) both}
        .ls-skeleton{animation:ls-skeleton-pulse 1.5s ease-in-out infinite}
      `}</style>

      <StudioHeader />
      <PageShell maxWidth="6xl" spacing={6}>
        <main className="relative z-10">
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
                <AiSuggest currentParams={studio.params} onApply={studio.setParams} wizardResult={wizardResult} onSelectForRefine={setSelectedConcept} notifyStart={notifyStart} notifyDone={notifyDone} notifyFail={notifyFail} />
                {selectedConcept && !showChat && (
                  <button onClick={() => setShowChat(true)}
                    className="mt-3 w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-medium bg-violet-600/80 hover:bg-violet-600 text-white transition-colors cursor-pointer flex items-center justify-center gap-2">
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
              <>
                <section className="mt-8">
                  <ColorVariants
                    imageUrl={selectedConcept.url}
                    brandName={wizardResult?.brandName || selectedConcept.name}
                    onSelect={(dataUrl, name) => setSelectedConcept({ name, url: dataUrl })}
                  />
                </section>
                <section className="mt-8">
                  <ShareCard logoUrl={selectedConcept.url} brandName={wizardResult?.brandName || selectedConcept.name} />
                </section>
              </>
            )}
            {favorites.length > 0 && (
              <section className="mt-8">
                <FavoritesPanel favorites={favorites} onRemove={removeFavorite} onClearAll={clearAllFavorites} />
              </section>
            )}

            {/* Advanced: Parametric SVG (collapsed by default) */}
            <section className="mt-8">
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full min-h-[44px] flex items-center justify-between px-5 py-3 rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] text-sm text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] transition-colors cursor-pointer">
                <span>Advanced: Parametric SVG</span>
                <ChevronSvg cls={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
              {showAdvanced && (
                <div className="mt-4 space-y-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 md:w-3/5"><LogoPreview params={studio.params} /></div>
                    <div className="md:w-2/5 md:max-h-[calc(100vh-120px)] md:overflow-y-auto md:sticky md:top-20 rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)]">
                      <LogoControls params={studio.params} onChange={studio.setParams} onRandomize={studio.randomize} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.15em] text-[var(--ag-text-muted)] font-medium mb-3">Presets</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                      {PRESETS.map((p, i) => (
                        <button key={i} onClick={() => studio.setParams(p.params)}
                          className={`flex-shrink-0 min-h-[44px] flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors cursor-pointer ${
                            matchPreset(studio.params, p.params) ? 'border-violet-500/60 bg-violet-500/[0.06]' : 'border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] hover:border-[var(--ag-border-default)]'}`}>
                          <div className="w-12 h-12 rounded-lg bg-[var(--ag-bg-base)] flex items-center justify-center">
                            <LogoSVG params={p.params} size={32} />
                          </div>
                          <span className="text-[10px] text-[var(--ag-text-secondary)] whitespace-nowrap">{p.name}</span>
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
      </PageShell>
    </div>
  );
}

/* Wizard Summary Bar -- inline sub-component */
function SummaryBar({ result, onEdit }: { result: WizardResult; onEdit: () => void }) {
  const [open, setOpen] = useState(true);
  const pills = [result.brandName, result.industry, ...result.styles].filter(Boolean);
  return (
    <div className="rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] px-4 py-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen(!open)}
          className="min-h-[44px] flex items-center gap-2 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors cursor-pointer">
          <ChevronSvg cls={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="uppercase tracking-[0.12em] font-medium">Brand Brief</span>
        </button>
        <button onClick={onEdit}
          className="min-h-[44px] px-3 py-1 rounded-lg text-[11px] font-medium text-violet-400/70 hover:text-violet-400 border border-violet-500/20 hover:border-violet-500/40 transition-colors cursor-pointer">
          Edit
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {pills.map(t => <Pill key={t} text={t} />)}
          {result.colors.map(hex => (
            <span key={hex} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-[var(--ag-text-secondary)] bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)]">
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
  <span className="px-2.5 py-1 rounded-full text-[11px] text-[var(--ag-text-secondary)] bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)]">{text}</span>
);

function matchPreset(current: LogoParams, preset: LogoParams): boolean {
  return (Object.keys(preset) as (keyof LogoParams)[]).every(k => current[k] === preset[k]);
}
