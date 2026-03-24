import { useState, useEffect, useCallback, useRef } from 'react';
import { LogoSVG } from '../LogoEngine';
import { MagicCard } from '@/components/magicui/magic-card';
import type { LogoParams } from '../types';

/* ---------- types ---------- */

interface VisualConcept { name: string; url: string; prompt?: string }
interface FavoriteConcept { name: string; url: string; timestamp: number }
interface AiVariant { name: string; params: LogoParams }

export interface AiSuggestProps {
  currentParams: LogoParams;
  onApply: (params: LogoParams) => void;
  wizardResult?: {
    brandName: string; industry: string; styles: string[];
    colors: string[]; letAiChooseColors: boolean;
  } | null;
  onSelectForRefine?: (concept: { name: string; url: string; prompt?: string }) => void;
}

/* ---------- constants ---------- */

const STYLE_PRESETS = ['Tech','Flashy','Modern','Playful','Abstract','Minimal','Luxury','Indian'] as const;
type StylePreset = (typeof STYLE_PRESETS)[number];

const WIZARD_STYLE_MAP: Record<string, StylePreset> = {
  Minimal: 'Minimal', Bold: 'Flashy', Playful: 'Playful', Elegant: 'Luxury',
  Geometric: 'Modern', Abstract: 'Abstract', 'Indian Traditional': 'Indian', 'Modern Tech': 'Tech',
};

const LS_KEY = 'gs-logo-favorites';
const MAX_FAVORITES = 20;
const MAX_SELECTED = 3;
const HEART_D = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const EXPAND_D = 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5';

/* ---------- helpers ---------- */

function loadFavorites(): FavoriteConcept[] {
  try { const r = localStorage.getItem(LS_KEY); return r ? (Array.isArray(JSON.parse(r)) ? JSON.parse(r) : []) : []; }
  catch { return []; }
}
function saveFavorites(f: FavoriteConcept[]) { localStorage.setItem(LS_KEY, JSON.stringify(f.slice(0, MAX_FAVORITES))); }

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" />
  </svg>
);

const SparkleIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-5.36l-1.42 1.42M7.05 16.95l-1.42 1.42m12.72 0l-1.42-1.42M7.05 7.05L5.63 5.63M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
);

/* ---------- component ---------- */

export function AiSuggest({ currentParams, onApply, wizardResult, onSelectForRefine }: AiSuggestProps) {
  const [variants, setVariants] = useState<AiVariant[]>([]);
  const [concepts, setConcepts] = useState<VisualConcept[]>([]);
  const [loading, setLoading] = useState(false);
  const [visualLoading, setVisualLoading] = useState(false);
  const [evolveLoading, setEvolveLoading] = useState(false);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState('');
  const [companyName, setCompanyName] = useState('Agentin');
  const [activeTab, setActiveTab] = useState<'visual' | 'parametric'>('visual');
  const [selectedConcepts, setSelectedConcepts] = useState<Set<number>>(new Set());
  const [expandedImg, setExpandedImg] = useState<string | null>(null);
  const [generateCount, setGenerateCount] = useState(0);
  const [activeStyle, setActiveStyle] = useState<StylePreset>('Tech');
  const [similarity, setSimilarity] = useState(0.5);
  const [favorites, setFavorites] = useState<FavoriteConcept[]>(loadFavorites);
  const [industry, setIndustry] = useState('');

  const stylesRef = useRef<HTMLDivElement>(null);
  const autoGenTriggered = useRef(false);

  /* Sync wizard result into local state */
  useEffect(() => {
    if (!wizardResult) return;
    if (wizardResult.brandName) setCompanyName(wizardResult.brandName);
    if (wizardResult.industry) setIndustry(wizardResult.industry);
    if (wizardResult.styles.length > 0) {
      const mapped = WIZARD_STYLE_MAP[wizardResult.styles[0]];
      if (mapped) setActiveStyle(mapped);
    }
    if (!wizardResult.letAiChooseColors && wizardResult.colors.length > 0)
      setDirection(wizardResult.colors.join(', '));
  }, [wizardResult]);

  /* Auto-generate when wizard provided results (once only) */
  useEffect(() => {
    if (!wizardResult || autoGenTriggered.current) return;
    autoGenTriggered.current = true;
    const t = setTimeout(() => generateVisualsFromWizard(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardResult]);

  useEffect(() => { saveFavorites(favorites); }, [favorites]);

  const isFavorited = useCallback((url: string) => favorites.some((f) => f.url === url), [favorites]);

  const toggleFavorite = useCallback((c: VisualConcept) => {
    setFavorites((prev) => {
      const idx = prev.findIndex((f) => f.url === c.url);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [{ name: c.name, url: c.url, timestamp: Date.now() }, ...prev].slice(0, MAX_FAVORITES);
    });
  }, []);

  const toggleSelect = useCallback((i: number) => {
    setSelectedConcepts((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else if (next.size < MAX_SELECTED) next.add(i);
      return next;
    });
  }, []);

  const selectionOrder = useCallback(
    (i: number) => { const pos = Array.from(selectedConcepts).indexOf(i); return pos >= 0 ? pos + 1 : 0; },
    [selectedConcepts],
  );

  const clearSelection = useCallback(() => setSelectedConcepts(new Set()), []);

  /* Build body for /ai-visual calls */
  const buildBody = useCallback(
    (batch: number, ov?: { name?: string; style?: StylePreset; ind?: string }) => {
      const body: Record<string, unknown> = {
        batch, companyName: ov?.name ?? companyName, style: ov?.style ?? activeStyle,
        direction: direction || undefined,
      };
      const ind = ov?.ind ?? industry;
      if (ind) body.industry = ind;
      body.logoType = ov?.style ?? activeStyle;
      return body;
    },
    [companyName, activeStyle, industry, direction],
  );

  const suggestParametric = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/logo/ai-suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentParams, direction: direction || undefined, companyName }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(d.error || `HTTP ${res.status}`); }
      setVariants((await res.json()).variants || []);
    } catch (err: any) { setError(err.message || 'Failed to get suggestions'); }
    finally { setLoading(false); }
  };

  const doGenerateVisuals = async (ov?: { name?: string; style?: StylePreset; ind?: string; dir?: string }) => {
    setVisualLoading(true); setError('');
    const batchNum = generateCount + 1; setGenerateCount(batchNum);
    try {
      const dirHint = ov?.dir ?? direction;
      const reqs = Array.from({ length: 3 }, (_, b) =>
        fetch('/api/logo/ai-visual', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...buildBody(b, ov), direction: dirHint || undefined }),
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      );
      const results = await Promise.allSettled(reqs);
      const all: VisualConcept[] = [];
      for (const r of results) if (r.status === 'fulfilled') all.push(...(r.value.concepts || []));
      if (!all.length) throw new Error('No images generated -- try again');
      setConcepts(all.slice(0, 10).map((c, i) => ({ ...c, name: c.name || (dirHint ? `${dirHint} #${i + 1}` : `Concept ${i + 1}`) })));
      setSelectedConcepts(new Set());
    } catch (err: any) { setError(err.message || 'Failed to generate'); }
    finally { setVisualLoading(false); }
  };

  const generateVisuals = () => doGenerateVisuals();

  const generateVisualsFromWizard = () => {
    if (!wizardResult) return;
    const mapped = WIZARD_STYLE_MAP[wizardResult.styles[0]] ?? 'Tech';
    const colorDir = !wizardResult.letAiChooseColors && wizardResult.colors.length > 0
      ? wizardResult.colors.join(', ') : undefined;
    doGenerateVisuals({ name: wizardResult.brandName, style: mapped, ind: wizardResult.industry, dir: colorDir });
  };

  const evolveConcepts = async () => {
    if (!selectedConcepts.size) return;
    setEvolveLoading(true); setError('');
    try {
      const prompts = Array.from(selectedConcepts).map((idx) => concepts[idx].prompt || `${concepts[idx].name} ${activeStyle}`.trim());
      const body: Record<string, unknown> = { selectedPrompts: prompts, direction: direction || undefined, similarity, companyName, style: activeStyle };
      if (industry) body.industry = industry;
      const res = await fetch('/api/logo/ai-evolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(d.error || `HTTP ${res.status}`); }
      const data = await res.json();
      const nc: VisualConcept[] = (data.concepts || []).map((c: VisualConcept, i: number) => ({ ...c, name: c.name || `Evolved ${concepts.length + i + 1}` }));
      if (!nc.length) throw new Error('No evolved concepts returned -- try again');
      setConcepts((prev) => [...prev, ...nc]);
      setSelectedConcepts(new Set());
    } catch (err: any) { setError(err.message || 'Failed to evolve'); }
    finally { setEvolveLoading(false); }
  };

  const isLoading = loading || visualLoading || evolveLoading;
  const handleSubmit = () => (activeTab === 'visual' ? generateVisuals() : suggestParametric());

  /* ---------- render ---------- */

  const tabBtn = (tab: 'visual' | 'parametric', label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
        activeTab === tab ? 'bg-violet-600/80 text-white' : 'text-white/40 hover:text-white/60'
      }`}
    >{label}</button>
  );

  return (
    <MagicCard
      className="rounded-2xl p-5"
      gradientColor="rgba(139, 92, 246, 0.05)"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase tracking-[0.15em] text-white/30 font-medium">
          AI Logo Studio
          {concepts.length > 0 && activeTab === 'visual' && <span className="ml-2 text-violet-400/60">{concepts.length} concepts</span>}
        </h3>
        <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
          {tabBtn('visual', 'AI Art')}{tabBtn('parametric', 'Parametric')}
        </div>
      </div>

      {activeTab === 'visual' && (
        <>
          <div className="mb-3">
            <label className="block text-[11px] text-white/30 mb-1">Company Name</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Agentin"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-violet-500/40" />
          </div>
          <div className="mb-3">
            <div ref={stylesRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
              {STYLE_PRESETS.map((s) => (
                <button key={s} onClick={() => setActiveStyle(s)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    activeStyle === s ? 'bg-violet-600/80 text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/60 border border-white/[0.06]'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Direction + generate */}
      <div className="flex gap-2 mb-4">
        <input type="text" value={direction} onChange={(e) => setDirection(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSubmit()}
          placeholder={activeTab === 'visual' ? 'e.g. cyberpunk neon, luxury gold, minimal flat...' : 'e.g. bold gradient, minimal clean...'}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-violet-500/40" />
        <button onClick={handleSubmit} disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600/80 hover:bg-violet-600 text-white whitespace-nowrap">
          {visualLoading ? <span className="flex items-center gap-2"><Spinner /> Generating 10...</span>
           : loading ? <span className="flex items-center gap-2"><Spinner /> Suggesting...</span>
           : activeTab === 'visual' ? 'Generate 10' : 'Suggest'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400/80 mb-3">{error}</p>}

      {/* Similarity slider */}
      {activeTab === 'visual' && selectedConcepts.size > 0 && (
        <div className="mb-4 px-1">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/50 shrink-0">Similar</span>
            <input type="range" min={0.1} max={1.0} step={0.1} value={similarity}
              onChange={(e) => setSimilarity(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-violet-500 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:appearance-none" />
            <span className="text-[11px] text-white/50 shrink-0">Creative</span>
          </div>
          <div className="text-center mt-1"><span className="text-[10px] text-white/30">{similarity.toFixed(1)}</span></div>
        </div>
      )}

      {/* Skeleton loading grid */}
      {activeTab === 'visual' && visualLoading && concepts.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-1.5 rounded-xl border border-white/[0.04]">
              <div className="w-full aspect-square rounded-lg ls-skeleton bg-white/[0.04]"
                style={{ animationDelay: `${i * 0.15}s` }} />
              <div className="h-3 w-2/3 rounded-full ls-skeleton bg-white/[0.04]"
                style={{ animationDelay: `${i * 0.15 + 0.1}s` }} />
            </div>
          ))}
        </div>
      )}

      {/* Concept grid */}
      {activeTab === 'visual' && concepts.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {concepts.map((c, i) => {
              const order = selectionOrder(i);
              const sel = order > 0;
              const fav = isFavorited(c.url);
              return (
                <div key={`${generateCount}-${i}`}
                  className={`ls-card-reveal relative flex flex-col items-center gap-2 p-1.5 rounded-xl border transition-all duration-200 group/card ${
                    sel
                      ? 'border-violet-500 bg-violet-500/[0.08] ring-2 ring-violet-500/30 scale-[1.02]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/[0.08]'
                  }`}
                  style={{
                    animationDelay: `${i * 0.06}s`,
                    boxShadow: sel ? '0 0 24px rgba(139, 92, 246, 0.2), 0 0 48px rgba(139, 92, 246, 0.06)' : undefined,
                  }}>
                  {/* Heart */}
                  <button onClick={(e) => { e.stopPropagation(); toggleFavorite(c); }}
                    className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-black/60 transition-all opacity-0 group-hover/card:opacity-100"
                    aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}>
                    <svg className={`w-4 h-4 ${fav ? 'text-red-500' : 'text-white/40'}`} viewBox="0 0 24 24"
                      fill={fav ? 'currentColor' : 'none'} stroke={fav ? undefined : 'currentColor'} strokeWidth={fav ? undefined : 2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={HEART_D} />
                    </svg>
                  </button>
                  {/* Always show heart if favorited */}
                  {fav && (
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(c); }}
                      className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-black/60 transition-all group-hover/card:hidden"
                      aria-label="Remove from favorites">
                      <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d={HEART_D} /></svg>
                    </button>
                  )}
                  {/* Selection badge */}
                  {sel && <div className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-violet-900/40">{order}</div>}
                  {/* Image */}
                  <button onClick={() => toggleSelect(i)} className="w-full aspect-square rounded-lg overflow-hidden bg-[#06061a] relative cursor-pointer group/img">
                    <img src={c.url} alt={c.name} className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-[1.03]" loading="lazy" />
                  </button>
                  {/* Expand */}
                  <button onClick={() => setExpandedImg(c.url)} aria-label="Expand"
                    className="absolute bottom-8 right-3 z-10 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-black/60 transition-all opacity-0 group-hover/card:opacity-100">
                    <svg className="w-3 h-3 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d={EXPAND_D} />
                    </svg>
                  </button>
                  {/* Refine with Jarvis */}
                  {sel && onSelectForRefine && (
                    <button onClick={(e) => { e.stopPropagation(); onSelectForRefine({ name: c.name, url: c.url, prompt: c.prompt }); }}
                      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer shadow-lg shadow-violet-900/40">
                      <SparkleIcon /> Refine with Jarvis
                    </button>
                  )}
                  <span className="text-[10px] text-white/50 text-center leading-tight truncate w-full px-1">{c.name}</span>
                </div>
              );
            })}
          </div>
          {!isLoading && (
            <div className="mt-3 flex justify-center">
              <button onClick={generateVisuals} className="text-xs text-violet-400/50 hover:text-violet-400 cursor-pointer transition-colors">
                Regenerate with new variations
              </button>
            </div>
          )}
        </>
      )}

      {/* Selection action bar */}
      {activeTab === 'visual' && selectedConcepts.size > 0 && (
        <div className="sticky bottom-0 mt-4 flex items-center gap-3 p-3 rounded-xl bg-violet-500/[0.06] border border-violet-500/20 backdrop-blur-sm">
          <span className="text-sm text-white/80 font-medium">{selectedConcepts.size} selected</span>
          <div className="flex-1" />
          <button onClick={clearSelection}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.1] cursor-pointer">Clear</button>
          <button onClick={evolveConcepts} disabled={evolveLoading}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-violet-600/80 text-white hover:bg-violet-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            {evolveLoading ? <><Spinner /> Evolving...</> : 'Evolve'}
          </button>
        </div>
      )}

      {/* Expanded modal */}
      {expandedImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setExpandedImg(null)}>
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={expandedImg} alt="Logo concept" className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
              <a href={expandedImg} download="logo-concept.jpg"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600/80 text-white hover:bg-violet-600 cursor-pointer">Download</a>
              <button onClick={() => setExpandedImg(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 cursor-pointer">Close</button>
            </div>
          </div>
          <button className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 cursor-pointer"
            onClick={() => setExpandedImg(null)}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Parametric variants */}
      {activeTab === 'parametric' && variants.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {variants.map((v, i) => (
            <button key={i} onClick={() => onApply(v.params)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-violet-500/40 hover:bg-violet-500/[0.04] transition-colors cursor-pointer">
              <div className="w-16 h-16 rounded-lg bg-[#06061a] flex items-center justify-center"><LogoSVG params={v.params} size={48} /></div>
              <span className="text-[10px] text-white/50 text-center leading-tight">{v.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (activeTab === 'visual' ? concepts.length === 0 : variants.length === 0) && !error && (
        <p className="text-xs text-white/20 text-center py-4">
          {activeTab === 'visual'
            ? 'Describe your vision and hit Generate -- FLUX AI creates 10 unique logo concepts'
            : 'Describe a style or click Suggest for parametric SVG variations'}
        </p>
      )}
    </MagicCard>
  );
}
