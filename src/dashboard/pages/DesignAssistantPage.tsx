// DesignAssistantPage.tsx — Edith-owned design assistant
// Revamped: design tokens, SectionCard, PageHeader, edith ownership, useAgentCanvas, brand-kit integration
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette, Image, Globe, Type, Sparkles, Send, Loader2,
  Copy, Check, Clock, Trash2, ChevronRight, Wand2, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { agentService } from '@/services/api';
import api from '@/services/api';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { BlurFade } from '@/components/magicui/blur-fade';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DesignStyle = 'minimal' | 'bold' | 'elegant' | 'playful' | 'custom';
type DesignType = 'image' | 'website' | 'color-palette' | 'social-post' | 'brand-kit';

interface ColorSwatch {
  hex: string;
  name?: string;
  usage?: string;
}

interface BrandFont {
  name: string;
  category: string;
  usage: string;
  googleFontsUrl: string;
}

interface DesignResult {
  id: string;
  prompt: string;
  style: DesignStyle;
  type: DesignType;
  response: string;
  colors: ColorSwatch[];
  fonts?: BrandFont[];
  taglines?: string[];
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STYLES: { id: DesignStyle; label: string }[] = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'bold', label: 'Bold' },
  { id: 'elegant', label: 'Elegant' },
  { id: 'playful', label: 'Playful' },
  { id: 'custom', label: 'Custom' },
];

const DESIGN_TYPES: { id: DesignType; label: string; icon: typeof Image; description: string }[] = [
  { id: 'color-palette', label: 'Color Palette', icon: Palette, description: 'Create harmonious color schemes' },
  { id: 'brand-kit', label: 'Brand Kit', icon: Wand2, description: 'Full brand identity — colors, fonts, taglines' },
  { id: 'image', label: 'Image', icon: Image, description: 'Generate AI artwork and visuals' },
  { id: 'website', label: 'Website', icon: Globe, description: 'Design layouts and wireframes' },
  { id: 'social-post', label: 'Social Post', icon: Type, description: 'Design social media content' },
];

const HEX_REGEX = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseHexColors(text: string): string[] {
  const matches = text.match(HEX_REGEX);
  if (!matches) return [];
  const seen = new Set<string>();
  return matches.filter((hex) => {
    const normalized = hex.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function buildPrompt(userPrompt: string, style: DesignStyle, type: DesignType): string {
  const styleLabel = style === 'custom' ? '' : ` in a ${style} style`;
  switch (type) {
    case 'image':
      return `Create a detailed image description${styleLabel} for: ${userPrompt}. Include visual details, composition, colors, and mood. Format it as a ready-to-use image generation prompt.`;
    case 'website':
      return `Design a website layout${styleLabel} for: ${userPrompt}. Describe the hero section, navigation, key sections, color palette (with hex codes), typography recommendations, and overall feel.`;
    case 'color-palette':
      return `Generate a color palette${styleLabel} for: ${userPrompt}. Provide exactly 5-6 hex color codes with their names and usage recommendations (e.g., primary, secondary, accent, background, text). Format each color as #XXXXXX.`;
    case 'social-post':
      return `Create social media post content${styleLabel} for: ${userPrompt}. Include headline text, body copy, hashtags, and visual style recommendations.`;
    case 'brand-kit':
      return ''; // handled by dedicated API
  }
}

function formatTimestamp(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DesignAssistantPage() {
  const navigate = useNavigate();
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'design-assistant' });

  // Form state
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<DesignStyle>('minimal');
  const [activeType, setActiveType] = useState<DesignType>('color-palette');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Brand kit state
  const [brandKitColors, setBrandKitColors] = useState<ColorSwatch[]>([]);
  const [brandKitFonts, setBrandKitFonts] = useState<BrandFont[]>([]);
  const [brandKitTaglines, setBrandKitTaglines] = useState<string[]>([]);

  // Results history (in-memory only)
  const [results, setResults] = useState<DesignResult[]>([]);
  const [copiedColors, setCopiedColors] = useState<Record<string, boolean>>({});

  // ---- Generate brand kit via /api/logo/brand-kit ----
  const handleBrandKit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setCurrentResponse('');
    setBrandKitColors([]);
    setBrandKitFonts([]);
    setBrandKitTaglines([]);
    void notifyStart('brand-kit-generate');

    try {
      const { data } = await api.post<{
        colors: { name: string; hex: string; usage: string }[];
        fonts: BrandFont[];
        taglines: string[];
      }>('/api/logo/brand-kit', {
        companyName: trimmed,
        industry: '',
        style,
        primaryColor: '',
      });

      const colors: ColorSwatch[] = (data.colors || []).map((c) => ({
        hex: c.hex,
        name: c.name,
        usage: c.usage,
      }));
      const fonts = data.fonts || [];
      const taglines = data.taglines || [];

      setBrandKitColors(colors);
      setBrandKitFonts(fonts);
      setBrandKitTaglines(taglines);
      setCurrentResponse(`Brand kit generated for "${trimmed}"`);

      const result: DesignResult = {
        id: crypto.randomUUID(),
        prompt: trimmed,
        style,
        type: 'brand-kit',
        response: `Brand kit for "${trimmed}" — ${colors.length} colors, ${fonts.length} fonts, ${taglines.length} taglines`,
        colors,
        fonts,
        taglines,
        timestamp: new Date(),
      };

      setResults((prev) => [result, ...prev].slice(0, 20));
      setPrompt('');
      void notifyDone(`brand-kit: ${colors.length} colors, ${fonts.length} fonts`);
    } catch (err) {
      toast.error('Failed to generate brand kit. Please try again.');
      console.error('Brand kit generation failed:', err);
      void notifyFail('brand-kit generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, style, isGenerating, notifyStart, notifyDone, notifyFail]);

  // ---- Generate design ----
  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    // Brand kit: dedicated API
    if (activeType === 'brand-kit') {
      handleBrandKit();
      return;
    }

    // For image type, redirect to ImageGen with pre-filled prompt
    if (activeType === 'image') {
      const imagePrompt = buildPrompt(trimmed, style, 'image');
      navigate(`/dashboard/image-gen?prompt=${encodeURIComponent(imagePrompt)}`);
      return;
    }

    // For website type, redirect to WebsiteBuilder with context
    if (activeType === 'website') {
      navigate(`/dashboard/website-builder?prompt=${encodeURIComponent(trimmed)}&style=${style}`);
      return;
    }

    // For social post, redirect to SocialMedia with content
    if (activeType === 'social-post') {
      navigate(`/dashboard/social-media?prompt=${encodeURIComponent(trimmed)}&style=${style}`);
      return;
    }

    // Color palette: use chat API
    setIsGenerating(true);
    setCurrentResponse('');
    setBrandKitColors([]);
    setBrandKitFonts([]);
    setBrandKitTaglines([]);
    const controller = new AbortController();
    abortRef.current = controller;
    void notifyStart('color-palette-generate');

    try {
      const fullPrompt = buildPrompt(trimmed, style, activeType);
      const res = await agentService.chatStream(fullPrompt, 'web', controller.signal);

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data) as { token?: string; text?: string };
              const token = parsed.token ?? parsed.text ?? '';
              accumulated += token;
              setCurrentResponse(accumulated);
            } catch {
              // Non-JSON data line -- might be plain text token
              if (data.trim()) {
                accumulated += data;
                setCurrentResponse(accumulated);
              }
            }
          }
        }
      }

      // Parse colors from final response
      const hexColors = parseHexColors(accumulated);
      const colors: ColorSwatch[] = hexColors.map((hex) => ({ hex }));

      const result: DesignResult = {
        id: crypto.randomUUID(),
        prompt: trimmed,
        style,
        type: activeType,
        response: accumulated,
        colors,
        timestamp: new Date(),
      };

      setResults((prev) => [result, ...prev].slice(0, 20));
      setPrompt('');
      void notifyDone(`palette: ${hexColors.length} colors`);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Fallback to non-streaming chat
        try {
          const fullPrompt = buildPrompt(trimmed, style, activeType);
          const { data } = await agentService.chat(fullPrompt, 'web');
          const responseText = data.text;
          setCurrentResponse(responseText);

          const hexColors = parseHexColors(responseText);
          const colors: ColorSwatch[] = hexColors.map((hex) => ({ hex }));

          const result: DesignResult = {
            id: crypto.randomUUID(),
            prompt: trimmed,
            style,
            type: activeType,
            response: responseText,
            colors,
            timestamp: new Date(),
          };

          setResults((prev) => [result, ...prev].slice(0, 20));
          setPrompt('');
          void notifyDone(`palette fallback: ${hexColors.length} colors`);
        } catch (fallbackErr) {
          toast.error('Failed to generate design. Please try again.');
          console.error('Design generation failed:', fallbackErr);
          void notifyFail('design generation failed');
        }
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [prompt, style, activeType, isGenerating, navigate, handleBrandKit, notifyStart, notifyDone, notifyFail]);

  // ---- Cancel generation ----
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  // ---- Copy color to clipboard ----
  const handleCopyColor = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedColors((prev) => ({ ...prev, [hex]: true }));
      toast.success(`Copied ${hex}`);
      setTimeout(() => {
        setCopiedColors((prev) => ({ ...prev, [hex]: false }));
      }, 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  // ---- Delete result ----
  const handleDeleteResult = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ---- Use result as new prompt ----
  const handleReuseResult = useCallback((result: DesignResult) => {
    setPrompt(result.prompt);
    setStyle(result.style);
    setActiveType(result.type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ---- Keyboard submit ----
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // Current colors from the latest streaming response
  const liveColors = parseHexColors(currentResponse);

  return (
    <DashboardPageWrapper>
    <PageShell maxWidth="5xl">
      {/* ---- Header — Edith ownership ---- */}
      <PageHeader
        icon={Palette}
        title="Design Assistant"
        subtitle="AI-powered design suggestions, color palettes, and brand kits"
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#8B5CF6]/10 border border-[var(--ag-violet)]/30 text-[var(--ag-violet)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#8B5CF6]" />
            </span>
            Edith
          </span>
        }
      />

      {/* ---- Prompt Bar ---- */}
      <BlurFade delay={0.1}>
        <SectionCard padding="md">
          <div className="space-y-3">
            <div className="flex gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeType === 'brand-kit' ? 'Enter your company or brand name...' : 'Describe what you want to design...'}
                rows={2}
                className="flex-1 bg-[var(--ag-bg-deep)] border border-[var(--ag-border-subtle)] rounded-lg px-4 py-3 text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--ag-cyan)]/40 text-sm min-h-[44px]"
              />
              <button
                onClick={isGenerating ? handleCancel : handleGenerate}
                disabled={!prompt.trim() && !isGenerating}
                className="min-w-[44px] min-h-[44px] px-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-gold)] text-white hover:opacity-90 active:scale-95"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Stop</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Generate</span>
                  </>
                )}
              </button>
            </div>

            {/* Style selector */}
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    style === s.id
                      ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)] border border-[var(--ag-violet)]/30'
                      : 'bg-[var(--ag-bg-deep)] text-[var(--ag-text-secondary)] border border-transparent hover:border-[var(--ag-border-subtle)] hover:text-[var(--ag-text-primary)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      </BlurFade>

      {/* ---- Design Type Tabs ---- */}
      <BlurFade delay={0.15}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {DESIGN_TYPES.map((dt) => {
            const Icon = dt.icon;
            const isActive = activeType === dt.id;
            return (
              <button
                key={dt.id}
                onClick={() => setActiveType(dt.id)}
                className={`flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] border border-[var(--ag-violet)]/25'
                    : 'bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {dt.label}
              </button>
            );
          })}
        </div>
      </BlurFade>

      {/* ---- Type description / redirect hint ---- */}
      {activeType !== 'color-palette' && activeType !== 'brand-kit' && (
        <BlurFade delay={0.2}>
          <div className="flex items-center gap-2 rounded-lg bg-[var(--ag-bg-deep)]/60 border border-[var(--ag-border-subtle)] px-4 py-3">
            <Sparkles className="w-4 h-4 text-[var(--ag-violet)] flex-shrink-0" />
            <p className="text-xs text-[var(--ag-text-secondary)]">
              {activeType === 'image' && 'Your prompt will be enhanced and sent to the Image Generator for visual creation.'}
              {activeType === 'website' && 'Your design brief will open in the Website Builder with AI-powered layout suggestions.'}
              {activeType === 'social-post' && 'Content will be crafted and opened in the Social Media composer.'}
            </p>
          </div>
        </BlurFade>
      )}

      {activeType === 'brand-kit' && (
        <BlurFade delay={0.2}>
          <div className="flex items-center gap-2 rounded-lg bg-[var(--ag-violet)]/5 border border-[var(--ag-violet)]/15 px-4 py-3">
            <Wand2 className="w-4 h-4 text-[var(--ag-violet)] flex-shrink-0" />
            <p className="text-xs text-[var(--ag-text-secondary)]">
              Enter your brand name to generate a complete identity: color palette, font pairing, taglines, and social media dimensions.
            </p>
          </div>
        </BlurFade>
      )}

      {/* ---- Brand Kit Results ---- */}
      {activeType === 'brand-kit' && (brandKitColors.length > 0 || brandKitFonts.length > 0) && (
        <BlurFade delay={0.1}>
          <div className="space-y-4">
            {/* Colors */}
            {brandKitColors.length > 0 && (
              <SectionCard 
                title="Brand Colors" 
                subtitle="Click any swatch to copy its hex code"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {brandKitColors.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleCopyColor(c.hex)}
                      className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)] transition-all min-h-[44px]"
                    >
                      <div
                        className="w-full h-16 rounded-lg border border-white/10 shadow-md transition-shadow group-hover:shadow-lg"
                        style={{ backgroundColor: c.hex }}
                      />
                      <div className="text-center">
                        {c.name && <p className="text-xs font-medium text-[var(--ag-text-primary)]">{c.name}</p>}
                        <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--ag-text-secondary)] group-hover:text-[var(--ag-text-primary)]">
                          {copiedColors[c.hex] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {c.hex}
                        </span>
                        {c.usage && <p className="text-[10px] text-[var(--ag-text-muted)] mt-0.5 line-clamp-1">{c.usage}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Fonts */}
            {brandKitFonts.length > 0 && (
              <SectionCard 
                title="Typography" 
                subtitle="Recommended font pairing"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {brandKitFonts.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] min-h-[44px]"
                    >
                      <div>
                        <p className="text-sm font-semibold font-heading text-[var(--ag-text-primary)]">{f.name}</p>
                        <p className="text-[10px] text-[var(--ag-text-secondary)]">{f.category} — {f.usage}</p>
                      </div>
                      {f.googleFontsUrl && (
                        <a
                          href={f.googleFontsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--ag-violet)]/10 text-[var(--ag-text-muted)] hover:text-[var(--ag-violet)] transition-colors"
                          title="View on Google Fonts"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Taglines */}
            {brandKitTaglines.length > 0 && (
              <SectionCard 
                title="Tagline Suggestions" 
                subtitle="AI-generated brand messaging"
              >
                <div className="space-y-2">
                  {brandKitTaglines.map((tagline, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] min-h-[44px]"
                    >
                      <span className="text-xs font-mono text-[var(--ag-violet)] w-5 text-center shrink-0">{i + 1}</span>
                      <p className="text-sm text-[var(--ag-text-primary)] italic">&ldquo;{tagline}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </BlurFade>
      )}

      {/* ---- Streaming Results Area (color palette mode) ---- */}
      {activeType !== 'brand-kit' && (isGenerating || currentResponse) && (
        <BlurFade delay={0.1}>
          <SectionCard>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {isGenerating && <Loader2 className="w-4 h-4 text-[var(--ag-violet)] animate-spin" />}
                <h3 className="text-sm font-semibold font-heading text-[var(--ag-text-primary)]">
                  {isGenerating ? 'Generating design...' : 'Design Result'}
                </h3>
              </div>

              {/* Streaming text output */}
              {currentResponse && (
                <div className="text-sm text-[var(--ag-text-secondary)] whitespace-pre-wrap leading-relaxed">
                  {currentResponse}
                </div>
              )}

              {/* Live color swatches */}
              {liveColors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium font-heading text-[var(--ag-text-primary)]/70 uppercase tracking-wider">Colors Found</h4>
                  <div className="flex flex-wrap gap-3">
                    {liveColors.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => handleCopyColor(hex)}
                        className="group flex flex-col items-center gap-1.5 min-w-[64px] min-h-[44px] transition-transform hover:scale-105 active:scale-95"
                      >
                        <div
                          className="w-12 h-12 rounded-lg border border-white/10 shadow-md transition-shadow group-hover:shadow-lg"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--ag-text-secondary)] group-hover:text-[var(--ag-text-primary)]">
                          {copiedColors[hex] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {hex}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </BlurFade>
      )}

      {/* ---- Loading state for brand kit ---- */}
      {activeType === 'brand-kit' && isGenerating && (
        <BlurFade delay={0.1}>
          <SectionCard>
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="w-5 h-5 text-[var(--ag-violet)] animate-spin" />
              <p className="text-sm text-[var(--ag-text-secondary)]">Generating brand identity...</p>
            </div>
          </SectionCard>
        </BlurFade>
      )}

      {/* ---- Recent Designs History ---- */}
      {results.length > 0 && (
        <BlurFade delay={0.25}>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold font-heading text-[var(--ag-text-primary)]/80 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--ag-text-secondary)]" />
              Recent Designs
            </h2>

            <div className="space-y-3">
              {results.map((result) => (
                <SectionCard key={result.id} padding="sm" className="group">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--ag-text-primary)] truncate">{result.prompt}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] capitalize">
                          {result.style}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)]">
                          {DESIGN_TYPES.find((dt) => dt.id === result.type)?.label}
                        </span>
                        <span className="text-[10px] text-[var(--ag-text-muted)]">{formatTimestamp(result.timestamp)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleReuseResult(result)}
                        className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--ag-bg-deep)] hover:bg-[var(--ag-violet)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] flex items-center justify-center transition-colors"
                        title="Reuse prompt"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteResult(result.id)}
                        className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--ag-bg-deep)] hover:bg-red-500/10 text-[var(--ag-text-secondary)] hover:text-red-400 flex items-center justify-center transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Color swatches for palette results */}
                  {result.colors.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {result.colors.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => handleCopyColor(c.hex)}
                          className="group/swatch flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--ag-bg-deep)] hover:bg-[var(--ag-bg-elevated)] transition-colors min-h-[32px]"
                        >
                          <div
                            className="w-5 h-5 rounded border border-white/10"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-[10px] font-mono text-[var(--ag-text-secondary)] group-hover/swatch:text-[var(--ag-text-primary)]">
                            {copiedColors[c.hex] ? (
                              <span className="text-green-400 flex items-center gap-0.5"><Check className="w-3 h-3" /> Copied</span>
                            ) : (
                              <>
                                {c.name ? `${c.name} ${c.hex}` : c.hex}
                              </>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Truncated response text */}
                  {result.type !== 'brand-kit' && (
                    <p className="text-xs text-[var(--ag-text-muted)] line-clamp-2 leading-relaxed mt-2">
                      {result.response}
                    </p>
                  )}
                </SectionCard>
              ))}
            </div>
          </div>
        </BlurFade>
      )}

      {/* ---- Empty state ---- */}
      {!isGenerating && !currentResponse && results.length === 0 && brandKitColors.length === 0 && (
        <BlurFade delay={0.2}>
          <SectionCard className="!border-dashed">
            <div className="flex flex-col items-center justify-center text-center space-y-3 py-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--ag-violet)]/10 to-[var(--ag-cyan)]/10 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-[var(--ag-text-secondary)]" />
              </div>
              <h3 className="text-sm font-semibold font-heading text-[var(--ag-text-primary)]">Ready to design</h3>
              <p className="text-xs text-[var(--ag-text-secondary)] max-w-sm">
                Describe your design vision above and choose a style. Try &quot;Modern SaaS dashboard with dark theme&quot; or &quot;Brand colors for a health app&quot;.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Modern portfolio site', 'Startup brand colors', 'App login screen', 'Social media banner'].map((example) => (
                  <button
                    key={example}
                    onClick={() => setPrompt(example)}
                    className="text-xs min-h-[44px] px-3 py-1.5 rounded-full bg-[var(--ag-bg-deep)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-violet)]/20 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        </BlurFade>
      )}
    </PageShell>
    </DashboardPageWrapper>
  );
}
