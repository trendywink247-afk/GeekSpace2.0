import { useState, useCallback, useRef, useEffect } from 'react';
import { ToolShell } from '../components/ToolShell';
import { UploadZone } from '../components/UploadZone';
import { DownloadButton } from '../components/DownloadButton';

type WatermarkMode = 'text' | 'image';
type GridPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

interface TextConfig {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: GridPosition;
  rotation: number;
  tiled: boolean;
}

interface ImageConfig {
  opacity: number;
  position: GridPosition;
  scale: number; // 0.05 – 1
  rotation: number;
}

const DEFAULT_TEXT: TextConfig = {
  text: 'Watermark',
  fontSize: 32,
  color: '#ffffff',
  opacity: 0.3,
  position: 'bottom-right',
  rotation: 0,
  tiled: false,
};

const DEFAULT_IMG: ImageConfig = {
  opacity: 0.4,
  position: 'bottom-right',
  scale: 0.25,
  rotation: 0,
};

const GRID: { pos: GridPosition; label: string }[] = [
  { pos: 'top-left', label: 'TL' }, { pos: 'top-center', label: 'TC' }, { pos: 'top-right', label: 'TR' },
  { pos: 'middle-left', label: 'ML' }, { pos: 'center', label: 'C' }, { pos: 'middle-right', label: 'MR' },
  { pos: 'bottom-left', label: 'BL' }, { pos: 'bottom-center', label: 'BC' }, { pos: 'bottom-right', label: 'BR' },
];

function positionXY(pos: GridPosition, cw: number, ch: number, ew: number, eh: number) {
  const pad = 20;
  const col = pos === 'center' ? 'center' : pos.split('-')[1];
  const row = pos === 'center' ? 'middle' : pos.split('-')[0];
  const xMap: Record<string, number> = { left: pad, center: (cw - ew) / 2, right: cw - ew - pad };
  const yMap: Record<string, number> = { top: pad, middle: (ch - eh) / 2, bottom: ch - eh - pad };
  return { x: xMap[col!] ?? xMap.center, y: yMap[row!] ?? yMap.middle };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function drawTextWatermark(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cfg: TextConfig) {
  const { width: cw, height: ch } = ctx.canvas;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);
  ctx.globalAlpha = cfg.opacity;
  ctx.fillStyle = cfg.color;
  ctx.font = `bold ${cfg.fontSize}px sans-serif`;

  if (cfg.tiled) {
    const tw = ctx.measureText(cfg.text).width;
    const stepX = tw + 60;
    const stepY = cfg.fontSize * 3;
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((cfg.rotation * Math.PI) / 180);
    ctx.translate(-cw / 2, -ch / 2);
    for (let y = -ch; y < ch * 2; y += stepY)
      for (let x = -cw; x < cw * 2; x += stepX)
        ctx.fillText(cfg.text, x, y);
    ctx.restore();
  } else {
    const tw = ctx.measureText(cfg.text).width;
    const th = cfg.fontSize;
    const { x, y } = positionXY(cfg.position, cw, ch, tw, th);
    ctx.save();
    ctx.translate(x + tw / 2, y + th / 2);
    ctx.rotate((cfg.rotation * Math.PI) / 180);
    ctx.fillText(cfg.text, -tw / 2, th / 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawImageWatermark(
  ctx: CanvasRenderingContext2D, baseImg: HTMLImageElement,
  wmImg: HTMLImageElement, cfg: ImageConfig,
) {
  const { width: cw, height: ch } = ctx.canvas;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(baseImg, 0, 0, cw, ch);
  const ww = Math.round(wmImg.naturalWidth * cfg.scale);
  const wh = Math.round(wmImg.naturalHeight * cfg.scale);
  const { x, y } = positionXY(cfg.position, cw, ch, ww, wh);
  ctx.save();
  ctx.globalAlpha = cfg.opacity;
  ctx.translate(x + ww / 2, y + wh / 2);
  ctx.rotate((cfg.rotation * Math.PI) / 180);
  ctx.drawImage(wmImg, -ww / 2, -wh / 2, ww, wh);
  ctx.restore();
  ctx.globalAlpha = 1;
}

const sliderCls = 'w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#8B5CF6] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20 [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(139,92,246,0.4)]';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-white/50 font-medium uppercase tracking-wider">{children}</label>;
}

function SliderRow({ label, value, display, min, max, step, onChange }: {
  label: string; value: number; display: string;
  min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-white/70 tabular-nums font-medium">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className={sliderCls} />
    </div>
  );
}

function PositionGrid({ value, onChange, disabled }: {
  value: GridPosition; onChange: (p: GridPosition) => void; disabled?: boolean;
}) {
  return (
    <div className={`inline-grid grid-cols-3 gap-1.5 transition-opacity ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      {GRID.map(({ pos, label }) => (
        <button key={pos} onClick={() => onChange(pos)} title={pos}
          className={`w-10 h-10 rounded-lg text-[10px] font-medium transition-all border flex items-center justify-center ${
            value === pos
              ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/20 text-white'
              : 'border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
          }`}>{label}</button>
      ))}
    </div>
  );
}

export function WatermarkTool({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<WatermarkMode>('text');

  // Base image
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [baseSrc, setBaseSrc] = useState<string | null>(null);
  const baseImgRef = useRef<HTMLImageElement | null>(null);
  const baseUrlRef = useRef<string | null>(null);

  // Watermark image (image mode)
  const [wmSrc, setWmSrc] = useState<string | null>(null);
  const wmImgRef = useRef<HTMLImageElement | null>(null);
  const wmUrlRef = useRef<string | null>(null);

  // Configs
  const [textCfg, setTextCfg] = useState<TextConfig>({ ...DEFAULT_TEXT });
  const [imgCfg, setImgCfg] = useState<ImageConfig>({ ...DEFAULT_IMG });

  // Result
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateText = useCallback(<K extends keyof TextConfig>(k: K, v: TextConfig[K]) => {
    setTextCfg(prev => ({ ...prev, [k]: v }));
    setResultUrl(null);
  }, []);

  const updateImg = useCallback(<K extends keyof ImageConfig>(k: K, v: ImageConfig[K]) => {
    setImgCfg(prev => ({ ...prev, [k]: v }));
    setResultUrl(null);
  }, []);

  const handleBaseFile = useCallback((f: File) => {
    if (baseUrlRef.current) URL.revokeObjectURL(baseUrlRef.current);
    const url = URL.createObjectURL(f);
    baseUrlRef.current = url;
    setBaseFile(f);
    setBaseSrc(url);
    setResultUrl(null);
  }, []);

  const handleWmFile = useCallback((f: File) => {
    if (wmUrlRef.current) URL.revokeObjectURL(wmUrlRef.current);
    const url = URL.createObjectURL(f);
    wmUrlRef.current = url;
    setWmSrc(url);
    setResultUrl(null);
  }, []);

  useEffect(() => {
    if (!baseSrc) { baseImgRef.current = null; return; }
    loadImg(baseSrc).then(img => { baseImgRef.current = img; drawPreview(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSrc]);

  useEffect(() => {
    if (!wmSrc) { wmImgRef.current = null; return; }
    loadImg(wmSrc).then(img => { wmImgRef.current = img; drawPreview(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wmSrc]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseImgRef.current;
    if (!canvas || !base) return;
    const maxW = 600;
    const scale = Math.min(1, maxW / base.naturalWidth);
    canvas.width = Math.round(base.naturalWidth * scale);
    canvas.height = Math.round(base.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (mode === 'text') {
      drawTextWatermark(ctx, base, { ...textCfg, fontSize: Math.round(textCfg.fontSize * scale) });
    } else if (wmImgRef.current) {
      drawImageWatermark(ctx, base, wmImgRef.current, { ...imgCfg, scale: imgCfg.scale * scale });
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    }
  }, [mode, textCfg, imgCfg]);

  useEffect(() => { drawPreview(); }, [drawPreview]);

  const handleApply = useCallback(() => {
    const base = baseImgRef.current;
    if (!base) return;
    setApplying(true);
    setResultUrl(null);
    requestAnimationFrame(() => {
      try {
        const c = document.createElement('canvas');
        c.width = base.naturalWidth;
        c.height = base.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) { setApplying(false); return; }

        if (mode === 'text') {
          drawTextWatermark(ctx, base, textCfg);
        } else if (wmImgRef.current) {
          drawImageWatermark(ctx, base, wmImgRef.current, imgCfg);
        }

        c.toBlob(blob => {
          if (!blob) { setApplying(false); return; }
          const reader = new FileReader();
          reader.onload = () => { setResultUrl(reader.result as string); setApplying(false); };
          reader.onerror = () => setApplying(false);
          reader.readAsDataURL(blob);
        }, 'image/png', 1);
      } catch { setApplying(false); }
    });
  }, [mode, textCfg, imgCfg]);

  const handleReset = useCallback(() => {
    if (baseUrlRef.current) URL.revokeObjectURL(baseUrlRef.current);
    if (wmUrlRef.current) URL.revokeObjectURL(wmUrlRef.current);
    baseUrlRef.current = null; wmUrlRef.current = null;
    baseImgRef.current = null; wmImgRef.current = null;
    setBaseFile(null); setBaseSrc(null); setWmSrc(null);
    setTextCfg({ ...DEFAULT_TEXT }); setImgCfg({ ...DEFAULT_IMG });
    setResultUrl(null);
  }, []);

  const resultName = baseFile ? baseFile.name.replace(/\.[^.]+$/, '') + '-watermarked.png' : 'watermarked.png';
  const canApply = mode === 'text' ? !!textCfg.text.trim() : !!wmImgRef.current;

  const modeBtn = (m: WatermarkMode, label: string) => (
    <button onClick={() => { setMode(m); setResultUrl(null); }}
      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
        mode === m
          ? 'bg-[#8B5CF6]/20 text-white border border-[#8B5CF6]/40'
          : 'bg-white/[0.03] text-white/50 border border-white/[0.06] hover:text-white/70 hover:border-white/[0.12]'
      }`}>{label}</button>
  );

  return (
    <ToolShell title="Watermark" description="Add text or image watermarks to protect your images" onBack={onBack}>
      {/* Upload base image */}
      {!baseFile && <UploadZone onFile={handleBaseFile} accept="image/*" />}

      {baseFile && baseSrc && (
        <>
          {/* Preview */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/90">Live Preview</h3>
              <button onClick={handleReset}
                className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-md hover:bg-white/5">
                Change image
              </button>
            </div>
            <div className="flex justify-center rounded-lg bg-[#0a0a1f] border border-white/5 p-2 overflow-hidden">
              <canvas ref={canvasRef} className="max-w-full h-auto rounded" style={{ maxHeight: 360 }} />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">{modeBtn('text', 'Text Watermark')}{modeBtn('image', 'Image Watermark')}</div>

          {/* Controls */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-5">
            {mode === 'text' ? (
              <>
                {/* Text input */}
                <div className="space-y-2">
                  <Label>Text</Label>
                  <input type="text" value={textCfg.text} maxLength={100}
                    onChange={e => updateText('text', e.target.value)} placeholder="Your watermark"
                    className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5
                      text-sm text-white placeholder-white/30
                      focus:outline-none focus:border-[#8B5CF6]/50 transition-all" />
                </div>
                <SliderRow label="Font Size" value={textCfg.fontSize}
                  display={`${textCfg.fontSize}px`} min={12} max={72} step={1}
                  onChange={v => updateText('fontSize', v)} />
                {/* Color picker */}
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={textCfg.color}
                      onChange={e => updateText('color', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer
                        [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0" />
                    <input type="text" value={textCfg.color} maxLength={9}
                      onChange={e => { if (/^#[0-9a-fA-F]{0,8}$/.test(e.target.value)) updateText('color', e.target.value); }}
                      className="w-24 rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-2
                        text-xs text-white/90 font-mono focus:outline-none focus:border-[#8B5CF6]/50 transition-all" />
                  </div>
                </div>
                <SliderRow label="Opacity" value={textCfg.opacity}
                  display={`${Math.round(textCfg.opacity * 100)}%`} min={0} max={1} step={0.05}
                  onChange={v => updateText('opacity', v)} />
                <SliderRow label="Rotation" value={textCfg.rotation}
                  display={`${textCfg.rotation}deg`} min={-180} max={180} step={1}
                  onChange={v => updateText('rotation', v)} />
                {/* Position */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Position</Label>
                    {textCfg.tiled && <span className="text-[10px] text-white/30">Tiled overrides position</span>}
                  </div>
                  <PositionGrid value={textCfg.position} onChange={p => updateText('position', p)} disabled={textCfg.tiled} />
                </div>
                {/* Tiled toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Repeat across image</Label>
                    <p className="text-[10px] text-white/30 mt-0.5">Tile watermark with rotation angle</p>
                  </div>
                  <button onClick={() => updateText('tiled', !textCfg.tiled)}
                    className={`relative w-11 h-6 rounded-full transition-all border ${
                      textCfg.tiled ? 'bg-[#8B5CF6]/30 border-[#8B5CF6]/50' : 'bg-white/5 border-white/10'
                    }`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
                      textCfg.tiled ? 'left-[22px] bg-[#8B5CF6]' : 'left-0.5 bg-white/40'
                    }`} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Watermark image upload */}
                <div className="space-y-2">
                  <Label>Watermark Image</Label>
                  {!wmSrc ? (
                    <UploadZone onFile={handleWmFile} accept="image/*" />
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <img src={wmSrc} alt="Watermark" className="w-12 h-12 rounded-lg object-contain border border-white/[0.06]" />
                      <span className="flex-1 text-xs text-white/60 truncate">Watermark loaded</span>
                      <button onClick={() => {
                        if (wmUrlRef.current) URL.revokeObjectURL(wmUrlRef.current);
                        wmUrlRef.current = null; wmImgRef.current = null;
                        setWmSrc(null); setResultUrl(null);
                      }} className="text-xs text-white/40 hover:text-white/70 transition-colors">Remove</button>
                    </div>
                  )}
                </div>
                <SliderRow label="Scale" value={imgCfg.scale}
                  display={`${Math.round(imgCfg.scale * 100)}%`} min={0.05} max={1} step={0.01}
                  onChange={v => updateImg('scale', v)} />
                <SliderRow label="Opacity" value={imgCfg.opacity}
                  display={`${Math.round(imgCfg.opacity * 100)}%`} min={0} max={1} step={0.05}
                  onChange={v => updateImg('opacity', v)} />
                <SliderRow label="Rotation" value={imgCfg.rotation}
                  display={`${imgCfg.rotation}deg`} min={-180} max={180} step={1}
                  onChange={v => updateImg('rotation', v)} />
                <div className="space-y-2">
                  <Label>Position</Label>
                  <PositionGrid value={imgCfg.position} onChange={p => updateImg('position', p)} />
                </div>
              </>
            )}

            {/* Apply button */}
            <button onClick={handleApply} disabled={applying || !canApply}
              className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                applying || !canApply
                  ? 'bg-[#8B5CF6]/30 text-white/50 cursor-wait'
                  : 'bg-violet-600/80 hover:bg-violet-600 text-white active:scale-[0.98]'
              }`}>
              {applying ? (
                <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>Applying...</>
              ) : 'Apply Watermark'}
            </button>
          </div>

          {/* Result + download */}
          {resultUrl && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
              <h3 className="text-sm font-medium text-white/90">Watermarked Result</h3>
              <div className="flex justify-center rounded-lg bg-[#0a0a1f] border border-white/5 p-2 overflow-hidden">
                <img src={resultUrl} alt="Result" className="max-w-full h-auto rounded" style={{ maxHeight: 360 }} />
              </div>
              <DownloadButton dataUrl={resultUrl} filename={resultName} />
            </div>
          )}
        </>
      )}
    </ToolShell>
  );
}
