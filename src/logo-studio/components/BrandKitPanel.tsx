import { useState, useEffect, useCallback, useRef } from 'react';

interface BrandKitColor { hex: string; usage: string }
interface BrandKitFont { name: string; category: string; googleUrl: string }
interface SocialSize { platform: string; width: number; height: number }

interface BrandKitData {
  colors: BrandKitColor[];
  fonts: BrandKitFont[];
  taglines: { text: string }[];
  socialSizes: SocialSize[];
}

interface BrandKitPanelProps {
  companyName: string;
  industry?: string;
  style?: string;
  primaryColor?: string;
  onGenerate?: () => void;
}

const DEFAULT_SOCIAL_SIZES: SocialSize[] = [
  { platform: 'Instagram Post', width: 1080, height: 1080 },
  { platform: 'WhatsApp DP', width: 500, height: 500 },
  { platform: 'Facebook Cover', width: 820, height: 312 },
  { platform: 'Twitter Header', width: 1500, height: 500 },
  { platform: 'LinkedIn Banner', width: 1584, height: 396 },
  { platform: 'Favicon', width: 32, height: 32 },
];

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="31.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border border-white/[0.06] bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white/80"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

export function BrandKitPanel({
  companyName,
  industry,
  style,
  primaryColor,
  onGenerate,
}: BrandKitPanelProps) {
  const [kit, setKit] = useState<BrandKitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fontLinksRef = useRef<Set<string>>(new Set());

  const generate = useCallback(async () => {
    if (!companyName.trim()) return;
    setLoading(true);
    setError('');
    onGenerate?.();
    try {
      const res = await fetch('/api/logo/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          industry: industry || undefined,
          style: style || undefined,
          primaryColor: primaryColor || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const kitData: BrandKitData = {
        colors: data.colors || [],
        fonts: data.fonts || [],
        taglines: data.taglines || [],
        socialSizes: data.socialSizes?.length ? data.socialSizes : DEFAULT_SOCIAL_SIZES,
      };
      setKit(kitData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate brand kit';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [companyName, industry, style, primaryColor, onGenerate]);

  // Auto-generate on mount if companyName is provided
  useEffect(() => {
    if (companyName.trim()) {
      generate();
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Google Fonts dynamically
  useEffect(() => {
    if (!kit?.fonts) return;
    kit.fonts.forEach((font) => {
      if (fontLinksRef.current.has(font.name)) return;
      fontLinksRef.current.add(font.name);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.name)}&display=swap`;
      document.head.appendChild(link);
    });
  }, [kit?.fonts]);

  const sectionHeading = 'text-[11px] uppercase tracking-[0.12em] text-white/40 font-medium mb-3';
  const card = 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-4';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase tracking-[0.15em] text-white/30 font-medium">
          Brand Kit
        </h3>
        <button
          onClick={generate}
          disabled={loading || !companyName.trim()}
          className="px-4 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600/80 hover:bg-violet-600 text-white flex items-center gap-2"
        >
          {loading ? (
            <>
              <Spinner />
              Generating...
            </>
          ) : kit ? (
            'Regenerate'
          ) : (
            'Generate Kit'
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-400/80 mb-3">{error}</p>}

      {!kit && !loading && !error && (
        <p className="text-xs text-white/20 text-center py-6">
          Generate a complete brand kit with colors, typography, taglines, and social media sizes
        </p>
      )}

      {loading && !kit && (
        <div className="flex items-center justify-center py-10">
          <Spinner />
          <span className="ml-2 text-sm text-white/40">Building your brand kit...</span>
        </div>
      )}

      {kit && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Color Palette */}
          <div className={card}>
            <div className="flex items-center justify-between mb-3">
              <h4 className={sectionHeading + ' mb-0'}>Color Palette</h4>
              <CopyButton
                text={kit.colors.map((c) => `${c.usage}: ${c.hex}`).join('\n')}
                label="Copy palette"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {kit.colors.map((color, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => navigator.clipboard?.writeText(color.hex)}
                    className="w-10 h-10 rounded-full border border-white/[0.06] cursor-pointer transition-transform hover:scale-110"
                    style={{ backgroundColor: color.hex }}
                    title={`Copy ${color.hex}`}
                  />
                  <span className="text-[10px] font-mono text-white/50">{color.hex}</span>
                  <span className="text-[9px] text-white/30">{color.usage}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className={card}>
            <h4 className={sectionHeading}>Typography</h4>
            <div className="space-y-3">
              {kit.fonts.map((font, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/70 font-medium">{font.name}</span>
                    <span className="text-[9px] text-violet-400/60 uppercase tracking-wider">
                      {font.category}
                    </span>
                  </div>
                  <p
                    className="text-lg text-white/50 mb-2 leading-tight"
                    style={{ fontFamily: `'${font.name}', sans-serif` }}
                  >
                    Aa Bb Cc 123
                  </p>
                  <a
                    href={font.googleUrl || `https://fonts.google.com/specimen/${encodeURIComponent(font.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-violet-400/50 hover:text-violet-400 transition-colors"
                  >
                    View on Google Fonts
                  </a>
                </div>
              ))}
              {kit.fonts.length === 0 && (
                <p className="text-[10px] text-white/20 text-center py-3">No font suggestions</p>
              )}
            </div>
          </div>

          {/* Social Media Sizes */}
          <div className={card}>
            <h4 className={sectionHeading}>Social Media Sizes</h4>
            <div className="space-y-2">
              {kit.socialSizes.map((size, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0"
                >
                  <div>
                    <span className="text-xs text-white/60">{size.platform}</span>
                    <span className="ml-2 text-[10px] font-mono text-white/30">
                      {size.width}x{size.height}
                    </span>
                  </div>
                  <button
                    className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer border border-white/[0.06] bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                    title={`Download ${size.platform} (${size.width}x${size.height})`}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tagline Suggestions */}
          <div className={card}>
            <h4 className={sectionHeading}>Tagline Suggestions</h4>
            <div className="space-y-2">
              {kit.taglines.map((tagline, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2.5"
                >
                  <p className="text-sm text-white/60 italic flex-1 mr-3 leading-snug">
                    "{tagline.text}"
                  </p>
                  <CopyButton text={tagline.text} label="Copy" />
                </div>
              ))}
              {kit.taglines.length === 0 && (
                <p className="text-[10px] text-white/20 text-center py-3">
                  No tagline suggestions
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
