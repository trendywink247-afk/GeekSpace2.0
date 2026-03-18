import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette, Image, Globe, Type, Sparkles, Send, Loader2,
  Copy, Check, Clock, Trash2, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { agentService } from '@/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DesignStyle = 'minimal' | 'bold' | 'elegant' | 'playful' | 'custom';
type DesignType = 'image' | 'website' | 'color-palette' | 'social-post';

interface ColorSwatch {
  hex: string;
  copied: boolean;
}

interface DesignResult {
  id: string;
  prompt: string;
  style: DesignStyle;
  type: DesignType;
  response: string;
  colors: ColorSwatch[];
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
  { id: 'image', label: 'Image', icon: Image, description: 'Generate AI artwork and visuals' },
  { id: 'website', label: 'Website', icon: Globe, description: 'Design layouts and wireframes' },
  { id: 'color-palette', label: 'Color Palette', icon: Palette, description: 'Create harmonious color schemes' },
  { id: 'social-post', label: 'Social Post', icon: Type, description: 'Design social media content' },
];

const HEX_REGEX = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseHexColors(text: string): string[] {
  const matches = text.match(HEX_REGEX);
  if (!matches) return [];
  // Deduplicate and normalize
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

  // Form state
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<DesignStyle>('minimal');
  const [activeType, setActiveType] = useState<DesignType>('color-palette');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Results history (in-memory only)
  const [results, setResults] = useState<DesignResult[]>([]);
  const [copiedColors, setCopiedColors] = useState<Record<string, boolean>>({});

  // ---- Generate design ----
  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

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
    const controller = new AbortController();
    abortRef.current = controller;

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
      const colors: ColorSwatch[] = hexColors.map((hex) => ({ hex, copied: false }));

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
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Fallback to non-streaming chat
        try {
          const fullPrompt = buildPrompt(trimmed, style, activeType);
          const { data } = await agentService.chat(fullPrompt, 'web');
          const responseText = data.text;
          setCurrentResponse(responseText);

          const hexColors = parseHexColors(responseText);
          const colors: ColorSwatch[] = hexColors.map((hex) => ({ hex, copied: false }));

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
        } catch (fallbackErr) {
          toast.error('Failed to generate design. Please try again.');
          console.error('Design generation failed:', fallbackErr);
        }
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [prompt, style, activeType, isGenerating, navigate]);

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
    <div className="space-y-6 pb-24 md:pb-6">
      {/* ---- Header ---- */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00F0FF]/20 to-[#8B5CF6]/20 flex items-center justify-center">
          <Palette className="w-5 h-5 text-[#00F0FF]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#F4F6FF]">Design Assistant</h1>
          <p className="text-sm text-[#8892A4]">AI-powered design suggestions and color palettes</p>
        </div>
      </div>

      {/* ---- Prompt Bar ---- */}
      <div className="rounded-xl border border-[rgba(0,240,255,0.1)] bg-[#0C0C18] p-4 space-y-3">
        <div className="flex gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to design..."
            rows={2}
            className="flex-1 bg-[#12121F] border border-[rgba(0,240,255,0.1)] rounded-lg px-4 py-3 text-[#F4F6FF] placeholder:text-[#8892A4]/60 resize-none focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/40 text-sm"
          />
          <button
            onClick={isGenerating ? handleCancel : handleGenerate}
            disabled={!prompt.trim() && !isGenerating}
            className="min-w-[44px] min-h-[44px] px-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6] text-[#05050A] hover:opacity-90 active:scale-95"
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
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                style === s.id
                  ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
                  : 'bg-[#12121F] text-[#8892A4] border border-transparent hover:border-[rgba(0,240,255,0.1)] hover:text-[#F4F6FF]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Design Type Tabs ---- */}
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
                  ? 'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/25'
                  : 'bg-[#0C0C18] text-[#8892A4] border border-[rgba(0,240,255,0.08)] hover:text-[#F4F6FF] hover:border-[rgba(0,240,255,0.15)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {dt.label}
            </button>
          );
        })}
      </div>

      {/* ---- Type description / redirect hint ---- */}
      {activeType !== 'color-palette' && (
        <div className="flex items-center gap-2 rounded-lg bg-[#12121F]/60 border border-[rgba(0,240,255,0.06)] px-4 py-3">
          <Sparkles className="w-4 h-4 text-[#8B5CF6] flex-shrink-0" />
          <p className="text-xs text-[#8892A4]">
            {activeType === 'image' && 'Your prompt will be enhanced and sent to the Image Generator for visual creation.'}
            {activeType === 'website' && 'Your design brief will open in the Website Builder with AI-powered layout suggestions.'}
            {activeType === 'social-post' && 'Content will be crafted and opened in the Social Media composer.'}
          </p>
        </div>
      )}

      {/* ---- Results Area ---- */}
      {(isGenerating || currentResponse) && (
        <div className="rounded-xl border border-[rgba(0,240,255,0.1)] bg-[#0C0C18] p-5 space-y-4">
          <div className="flex items-center gap-2">
            {isGenerating && <Loader2 className="w-4 h-4 text-[#00F0FF] animate-spin" />}
            <h3 className="text-sm font-semibold text-[#F4F6FF]">
              {isGenerating ? 'Generating design...' : 'Design Result'}
            </h3>
          </div>

          {/* Streaming text output */}
          {currentResponse && (
            <div className="text-sm text-[#8892A4] whitespace-pre-wrap leading-relaxed">
              {currentResponse}
            </div>
          )}

          {/* Live color swatches */}
          {liveColors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#F4F6FF]/70 uppercase tracking-wider">Colors Found</h4>
              <div className="flex flex-wrap gap-3">
                {liveColors.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => handleCopyColor(hex)}
                    className="group flex flex-col items-center gap-1.5 min-w-[64px] transition-transform hover:scale-105 active:scale-95"
                  >
                    <div
                      className="w-12 h-12 rounded-lg border border-white/10 shadow-md transition-shadow group-hover:shadow-lg"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#8892A4] group-hover:text-[#F4F6FF]">
                      {copiedColors[hex] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {hex}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Recent Designs History ---- */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#F4F6FF]/80 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#8892A4]" />
            Recent Designs
          </h2>

          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.id}
                className="rounded-xl border border-[rgba(0,240,255,0.08)] bg-[#0C0C18] p-4 space-y-3 group"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F4F6FF] truncate">{result.prompt}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] capitalize">
                        {result.style}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
                        {DESIGN_TYPES.find((dt) => dt.id === result.type)?.label}
                      </span>
                      <span className="text-[10px] text-[#8892A4]">{formatTimestamp(result.timestamp)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleReuseResult(result)}
                      className="min-w-[32px] min-h-[32px] rounded-lg bg-[#12121F] hover:bg-[#00F0FF]/10 text-[#8892A4] hover:text-[#00F0FF] flex items-center justify-center transition-colors"
                      title="Reuse prompt"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteResult(result.id)}
                      className="min-w-[32px] min-h-[32px] rounded-lg bg-[#12121F] hover:bg-red-500/10 text-[#8892A4] hover:text-red-400 flex items-center justify-center transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Color swatches for palette results */}
                {result.colors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {result.colors.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => handleCopyColor(c.hex)}
                        className="group/swatch flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#12121F] hover:bg-[#12121F]/80 transition-colors"
                      >
                        <div
                          className="w-5 h-5 rounded border border-white/10"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-[10px] font-mono text-[#8892A4] group-hover/swatch:text-[#F4F6FF]">
                          {copiedColors[c.hex] ? (
                            <span className="text-green-400 flex items-center gap-0.5"><Check className="w-3 h-3" /> Copied</span>
                          ) : c.hex}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Truncated response text */}
                <p className="text-xs text-[#8892A4]/70 line-clamp-2 leading-relaxed">
                  {result.response}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Empty state ---- */}
      {!isGenerating && !currentResponse && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-[rgba(0,240,255,0.1)] bg-[#0C0C18]/50 p-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00F0FF]/10 to-[#8B5CF6]/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-[#8892A4]" />
          </div>
          <h3 className="text-sm font-semibold text-[#F4F6FF]">Ready to design</h3>
          <p className="text-xs text-[#8892A4] max-w-sm">
            Describe your design vision above and choose a style. Try &quot;Modern SaaS dashboard with dark theme&quot; or &quot;Brand colors for a health app&quot;.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['Modern portfolio site', 'Startup brand colors', 'App login screen', 'Social media banner'].map((example) => (
              <button
                key={example}
                onClick={() => setPrompt(example)}
                className="text-xs px-3 py-1.5 rounded-full bg-[#12121F] text-[#8892A4] hover:text-[#00F0FF] border border-[rgba(0,240,255,0.06)] hover:border-[#00F0FF]/20 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
