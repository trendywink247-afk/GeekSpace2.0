import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Palette, Sparkles, ChevronDown } from 'lucide-react';
import { useLogoStudio } from './use-logo-studio';
import { LogoPreview } from './components/LogoPreview';
import { LogoControls } from './components/LogoControls';
import { VariantGrid } from './components/VariantGrid';
import { ExportPanel } from './components/ExportPanel';
import { AiSuggest } from './components/AiSuggest';
import { FavoritesPanel } from './components/FavoritesPanel';
import { LogoWizard } from './components/LogoWizard';
import { ChatRefine } from './components/ChatRefine';
import { BrandKitPanel } from './components/BrandKitPanel';
import { ShareCard } from './components/ShareCard';
import { ColorVariants } from './components/ColorVariants';
import { LogoSVG } from './LogoEngine';
import { PRESETS } from './presets';
import {
  AnimatedBackground,
  GlassCard,
  PageWrapper,
  SectionHeader,
  StatusBadge,
} from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import type { LogoParams } from './types';
import type { WizardResult } from './components/LogoWizard';

interface FavoriteConcept { name: string; url: string; timestamp: number }

const FAVORITES_KEY = 'gs-logo-favorites';

export function LogoStudioPage() {
  const studio = useLogoStudio();
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'logo-studio' });
  const [phase, setPhase] = useState<'wizard' | 'studio'>('wizard');
  const [wizardResult, setWizardResult] = useState<WizardResult | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<{ name: string; url: string; prompt?: string } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fading, setFading] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteConcept[]>(() => {
    try { const s = localStorage.getItem(FAVORITES_KEY); if (s) return JSON.parse(s); } catch {}
    return [];
  });
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
    <AnimatedBackground variant="aurora" intensity="medium">
      {/* Glass Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#06061a]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl
                bg-white/[0.03] border border-white/[0.06] hover:bg-[#8B5CF6]/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-[#9CA3AF]" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <h1 
                  className="font-bold text-lg text-[#F4F6FF]" 
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  Logo Studio
                </h1>
                <p className="text-[10px] text-[#64748B]">AI-powered brand design</p>
              </div>
            </div>
          </div>
          <StatusBadge variant="info">
            <Sparkles className="w-3 h-3 mr-1" />
            AI Powered
          </StatusBadge>
        </div>
      </nav>

      {/* Content */}
      <PageWrapper className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
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

              <div className="flex flex-col lg:flex-row gap-4 mt-6">
                <div className={showChat ? 'w-full lg:w-[60%]' : 'w-full'}>
                  <GlassCard className="mb-4" hover={false}>
                    <AiSuggest 
                      currentParams={studio.params} 
                      onApply={studio.setParams} 
                      wizardResult={wizardResult} 
                      onSelectForRefine={setSelectedConcept} 
                      notifyStart={notifyStart} 
                      notifyDone={notifyDone} 
                      notifyFail={notifyFail} 
                    />
                  </GlassCard>
                  
                  {selectedConcept && !showChat && (
                    <button 
                      onClick={() => setShowChat(true)}
                      className="w-full lg:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-medium 
                        bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-colors 
                        flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Refine with AI
                    </button>
                  )}
                </div>
                
                {showChat && (
                  <div className="w-full lg:w-[40%] lg:sticky lg:top-20 lg:max-h-[calc(100vh-100px)]">
                    <GlassCard className="h-full" hover={false}>
                      <ChatRefine {...chatProps} />
                    </GlassCard>
                  </div>
                )}
              </div>

              {wizardResult && (
                <section className="mt-8">
                  <BrandKitPanel 
                    companyName={wizardResult.brandName} 
                    industry={wizardResult.industry}
                    style={wizardResult.styles.join(', ')} 
                    primaryColor={wizardResult.colors[0]} 
                  />
                </section>
              )}

              {selectedConcept && (
                <>
                  <section className="mt-8">
                    <GlassCard>
                      <ColorVariants
                        imageUrl={selectedConcept.url}
                        brandName={wizardResult?.brandName || selectedConcept.name}
                        onSelect={(dataUrl, name) => setSelectedConcept({ name, url: dataUrl })}
                      />
                    </GlassCard>
                  </section>
                  <section className="mt-8">
                    <GlassCard>
                      <ShareCard 
                        logoUrl={selectedConcept.url} 
                        brandName={wizardResult?.brandName || selectedConcept.name} 
                      />
                    </GlassCard>
                  </section>
                </>
              )}

              {favorites.length > 0 && (
                <section className="mt-8">
                  <FavoritesPanel 
                    favorites={favorites} 
                    onRemove={removeFavorite} 
                    onClearAll={clearAllFavorites} 
                  />
                </section>
              )}

              {/* Advanced: Parametric SVG */}
              <section className="mt-8">
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full min-h-[44px] flex items-center justify-between px-5 py-3 rounded-xl 
                    bg-white/[0.03] border border-white/[0.06] text-sm text-[#9CA3AF] 
                    hover:text-[#F4F6FF] hover:border-white/[0.1] transition-colors"
                >
                  <span>Advanced: Parametric SVG</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className="flex-1 lg:w-3/5">
                        <GlassCard hover={false}>
                          <LogoPreview params={studio.params} />
                        </GlassCard>
                      </div>
                      <div className="lg:w-2/5 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:sticky lg:top-20">
                        <GlassCard>
                          <LogoControls 
                            params={studio.params} 
                            onChange={studio.setParams} 
                            onRandomize={studio.randomize} 
                          />
                        </GlassCard>
                      </div>
                    </div>
                    
                    <div>
                      <SectionHeader title="Presets" />
                      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                        {PRESETS.map((p, i) => (
                          <button 
                            key={i} 
                            onClick={() => studio.setParams(p.params)}
                            className={`flex-shrink-0 min-h-[44px] flex flex-col items-center gap-2 p-3 rounded-xl 
                              border transition-colors ${
                              matchPreset(studio.params, p.params) 
                                ? 'border-[#8B5CF6] bg-[#8B5CF6]/10' 
                                : 'border-white/[0.06] bg-white/[0.03] hover:border-white/[0.1]'
                            }`}
                          >
                            <div className="w-12 h-12 rounded-lg bg-[#06061a] flex items-center justify-center">
                              <LogoSVG params={p.params} size={32} />
                            </div>
                            <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <GlassCard>
                      <VariantGrid 
                        variants={studio.variants} 
                        activeId={studio.activeVariantId}
                        onSelect={studio.loadVariant} 
                        onDelete={studio.deleteVariant} 
                        onSave={() => studio.saveVariant()} 
                      />
                    </GlassCard>
                    
                    <GlassCard>
                      <ExportPanel 
                        onExportSVG={studio.exportSVG} 
                        onCopyCode={studio.copySVGCode} 
                        svgString={studio.svgString} 
                      />
                    </GlassCard>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </PageWrapper>
    </AnimatedBackground>
  );
}

/* Wizard Summary Bar */
function SummaryBar({ result, onEdit }: { result: WizardResult; onEdit: () => void }) {
  const [open, setOpen] = useState(true);
  const pills = [result.brandName, result.industry, ...result.styles].filter(Boolean);
  
  return (
    <GlassCard hover={false}>
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setOpen(!open)}
          className="min-h-[44px] flex items-center gap-2 text-xs text-[#9CA3AF] hover:text-[#F4F6FF] transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="uppercase tracking-[0.12em] font-medium">Brand Brief</span>
        </button>
        <button 
          onClick={onEdit}
          className="min-h-[44px] px-3 py-1 rounded-lg text-[11px] font-medium 
            text-[#8B5CF6] border border-[#8B5CF6]/30 hover:border-[#8B5CF6]/60 transition-colors"
        >
          Edit
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {pills.map(t => <Pill key={t} text={t} />)}
          {result.colors.map(hex => (
            <span 
              key={hex} 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] 
                text-[#9CA3AF] bg-white/[0.03] border border-white/[0.06]"
            >
              <span className="w-3 h-3 rounded-full" style={{ background: hex }} />
              {hex}
            </span>
          ))}
          {result.letAiChooseColors && (
            <span className="px-2.5 py-1 rounded-full text-[11px] text-[#8B5CF6] 
              bg-[#8B5CF6]/10 border border-[#8B5CF6]/20">
              AI-chosen colors
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
}

const Pill = ({ text }: { text: string }) => (
  <span className="px-2.5 py-1 rounded-full text-[11px] text-[#9CA3AF] 
    bg-white/[0.03] border border-white/[0.06]">
    {text}
  </span>
);

function matchPreset(current: LogoParams, preset: LogoParams): boolean {
  return (Object.keys(preset) as (keyof LogoParams)[]).every(k => current[k] === preset[k]);
}
