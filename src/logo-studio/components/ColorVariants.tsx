import { useState, useEffect, useCallback, useRef } from 'react';

interface ColorVariant {
  name: string;
  desc: string;
  gradient: string;
  hueShift: number;        // degrees to shift blue hues
  satMult: number;
  mode: 'hue' | 'gradient' | 'duotone';
  gradientStops?: [number, number]; // top hue, bottom hue (0-1)
  duotoneColors?: [[number,number,number],[number,number,number]];
}

const VARIANTS: ColorVariant[] = [
  { name: 'Deep Violet', desc: 'Brand primary', gradient: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', hueShift: 60, satMult: 1.15, mode: 'hue' },
  { name: 'Electric Violet', desc: 'Neon glow', gradient: 'linear-gradient(135deg,#8b5cf6,#c084fc)', hueShift: 68, satMult: 1.4, mode: 'hue' },
  { name: 'Emerald', desc: 'Growth & trust', gradient: 'linear-gradient(135deg,#059669,#10b981)', hueShift: -55, satMult: 1.2, mode: 'hue' },
  { name: 'Neon Mint', desc: 'Fresh & futuristic', gradient: 'linear-gradient(135deg,#10b981,#6ee7b7)', hueShift: -45, satMult: 1.4, mode: 'hue' },
  { name: 'Violet → Emerald', desc: 'Both brand colors', gradient: 'linear-gradient(135deg,#8b5cf6,#10b981)', hueShift: 0, satMult: 1.2, mode: 'gradient', gradientStops: [0.75, 0.43] },
  { name: 'Violet → Amber', desc: 'Matches CTA button', gradient: 'linear-gradient(135deg,#8B5CF6,#F59E0B)', hueShift: 0, satMult: 1.2, mode: 'gradient', gradientStops: [0.75, 0.10] },
  { name: 'Violet → Rose', desc: 'Bold & passionate', gradient: 'linear-gradient(135deg,#8b5cf6,#e11d48)', hueShift: 0, satMult: 1.25, mode: 'gradient', gradientStops: [0.75, 0.93] },
  { name: 'Rose Neon', desc: 'Max energy', gradient: 'linear-gradient(135deg,#e11d48,#f43f5e)', hueShift: 120, satMult: 1.35, mode: 'hue' },
  { name: 'Amber Gold', desc: 'Warm premium', gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', hueShift: -170, satMult: 1.25, mode: 'hue' },
  { name: 'Cyber Pink', desc: 'Cyberpunk edge', gradient: 'linear-gradient(135deg,#a855f7,#ec4899)', hueShift: 0, satMult: 1.35, mode: 'gradient', gradientStops: [0.82, 0.95] },
  { name: 'Duotone Brand', desc: 'Violet + Amber', gradient: 'linear-gradient(135deg,#7c3aed,#f59e0b)', hueShift: 0, satMult: 1, mode: 'duotone', duotoneColors: [[124,58,237],[245,158,11]] },
  { name: 'Midnight Aurora', desc: '3-stop gradient', gradient: 'linear-gradient(135deg,#4338ca,#10b981,#8b5cf6)', hueShift: 0, satMult: 1.3, mode: 'gradient', gradientStops: [0.68, 0.43] },
];

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max, v = max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, v];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function recolorImageData(source: ImageData, variant: ColorVariant, w: number, h: number): ImageData {
  const out = new ImageData(new Uint8ClampedArray(source.data), w, h);
  const d = out.data;

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 10) continue;

    const r = d[i], g = d[i + 1], b = d[i + 2];
    const [hu, sa, va] = rgbToHsv(r, g, b);

    if (variant.mode === 'duotone' && variant.duotoneColors) {
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const [r1, g1, b1] = variant.duotoneColors[0];
      const [r2, g2, b2] = variant.duotoneColors[1];
      d[i] = Math.round(r1 * (1 - lum) + r2 * lum);
      d[i + 1] = Math.round(g1 * (1 - lum) + g2 * lum);
      d[i + 2] = Math.round(b1 * (1 - lum) + b2 * lum);
      continue;
    }

    // Only shift blue/cyan range (hue 0.45-0.72)
    if (hu > 0.40 && hu < 0.75 && sa > 0.08) {
      if (variant.mode === 'gradient' && variant.gradientStops) {
        const py = Math.floor(i / 4 / w);
        const px = (i / 4) % w;
        const t = px / w * 0.5 + py / h * 0.5; // diagonal
        const [topH, botH] = variant.gradientStops;
        const targetH = topH * (1 - t) + botH * t;
        const hn = targetH + (hu - 0.58) * 0.12;
        const sn = Math.min(1, sa * variant.satMult);
        const [rn, gn, bn] = hsvToRgb(hn, sn, va);
        d[i] = rn; d[i + 1] = gn; d[i + 2] = bn;
      } else {
        const shift = variant.hueShift / 360;
        const hn = hu + shift;
        const sn = Math.min(1, sa * variant.satMult);
        const [rn, gn, bn] = hsvToRgb(hn, sn, va);
        d[i] = rn; d[i + 1] = gn; d[i + 2] = bn;
      }
    }
  }
  return out;
}

interface Props {
  imageUrl: string;
  brandName?: string;
  onSelect?: (dataUrl: string, variantName: string) => void;
  onClose?: () => void;
}

export function ColorVariants({ imageUrl, brandName, onSelect, onClose }: Props) {
  const [variants, setVariants] = useState<{ name: string; desc: string; gradient: string; dataUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = Math.min(img.width, 512);
      const h = Math.round((img.height / img.width) * w);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const source = ctx.getImageData(0, 0, w, h);

      const results: typeof variants = [];
      for (const v of VARIANTS) {
        const recolored = recolorImageData(source, v, w, h);
        ctx.putImageData(recolored, 0, 0);
        results.push({ name: v.name, desc: v.desc, gradient: v.gradient, dataUrl: canvas.toDataURL('image/png') });
      }
      setVariants(results);
    } catch (err) {
      console.error('ColorVariants generation failed:', err);
    } finally {
      setLoading(false);
    }
  }, [imageUrl]);

  useEffect(() => { generate(); }, [generate]);

  return (
    <div className="mt-6">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-[0.12em]">
          Color Variants{brandName ? ` -- ${brandName}` : ''}
        </h3>
        {onClose && (
          <button onClick={onClose}
            className="min-h-[44px] text-xs text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] transition-colors cursor-pointer">
            Close
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/[0.03] border border-white/[0.04] ls-skeleton" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Original first */}
            <button
              onClick={() => { setSelected(-1); onSelect?.(imageUrl, 'Original'); }}
              className={`group relative rounded-xl border p-3 flex flex-col items-center gap-2 transition-all duration-300 cursor-pointer ${
                selected === -1
                  ? 'border-violet-500/60 bg-violet-500/[0.06] shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                  : 'border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] hover:border-white/[0.12] hover:-translate-y-1'
              }`}
            >
              <div className="absolute inset-0 rounded-xl opacity-10 blur-2xl pointer-events-none"
                style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)' }} />
              <img src={imageUrl} alt="Original" crossOrigin="anonymous"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain relative z-10 drop-shadow-lg group-hover:scale-105 transition-transform" />
              <span className="text-[11px] font-semibold text-white/70 relative z-10">Original</span>
              <div className="w-full h-[3px] rounded-full mt-auto" style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', opacity: selected === -1 ? 1 : 0.4 }} />
            </button>

            {variants.map((v, i) => (
              <button key={i}
                onClick={() => { setSelected(i); onSelect?.(v.dataUrl, v.name); }}
                className={`group relative rounded-xl border p-3 flex flex-col items-center gap-2 transition-all duration-300 cursor-pointer ls-card-reveal ${
                  selected === i
                    ? 'border-violet-500/60 bg-violet-500/[0.06] shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                    : 'border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] hover:border-white/[0.12] hover:-translate-y-1'
                }`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="absolute inset-0 rounded-xl opacity-10 blur-2xl pointer-events-none"
                  style={{ background: v.gradient }} />
                <img src={v.dataUrl} alt={v.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain relative z-10 drop-shadow-lg group-hover:scale-105 transition-transform" />
                <span className="text-[11px] font-semibold text-white/70 relative z-10">{v.name}</span>
                <span className="text-[9px] text-white/25 relative z-10 hidden sm:block">{v.desc}</span>
                <div className="w-full h-[3px] rounded-full mt-auto transition-opacity"
                  style={{ background: v.gradient, opacity: selected === i ? 1 : 0.4 }} />
              </button>
            ))}
          </div>

          {selected !== null && selected >= 0 && (
            <div className="mt-4 p-4 rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg" style={{ background: variants[selected].gradient }} />
                <div>
                  <div className="text-sm font-semibold text-white/80">{variants[selected].name}</div>
                  <div className="text-[10px] text-white/30 font-mono">{variants[selected].gradient}</div>
                </div>
              </div>
              <div className="h-10 rounded-lg mb-3" style={{ background: variants[selected].gradient }} />
              <div className="flex gap-2">
                <div className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ background: variants[selected].gradient }}>Get Started</div>
                <div className="px-4 py-2 rounded-lg text-xs font-bold text-white/50"
                  style={{ background: variants[selected].gradient, opacity: 0.5 }}>Learn More</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
