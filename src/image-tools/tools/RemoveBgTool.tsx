import { useState, useCallback, useRef, useEffect } from 'react';
import { Info, MousePointer2, Eraser } from 'lucide-react';
import { UploadZone } from '../components/UploadZone';
import { BeforeAfter } from '../components/BeforeAfter';
import { DownloadButton } from '../components/DownloadButton';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/** Color-distance in RGB space (Euclidean). */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Max possible distance in RGB space. */
const MAX_DIST = Math.sqrt(255 ** 2 * 3); // ~441.67

const CHECKERBOARD = {
  backgroundImage: [
    'linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%)',
    'linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%)',
    'linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%)',
    'linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%)',
  ].join(', '),
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  backgroundColor: '#12122a',
} as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RemoveBgTool({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultFilename, setResultFilename] = useState('');
  const [tolerance, setTolerance] = useState(30);
  const [error, setError] = useState('');
  const [pickedColor, setPickedColor] = useState<[number, number, number] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const prevUrlRef = useRef('');

  /* ---- file handling ---- */
  const handleFile = useCallback(async (f: File) => {
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    setError('');
    setResultUrl('');
    setPickedColor(null);
    setFile(f);

    try {
      const dataUrl = await fileToDataUrl(f);
      const img = await loadImage(dataUrl);
      imgRef.current = img;

      const url = URL.createObjectURL(f);
      prevUrlRef.current = url;
      setOriginalUrl(url);

      const baseName = f.name.replace(/\.[^.]+$/, '');
      setResultFilename(`${baseName}-nobg.png`);

      // Draw original onto canvas
      drawOriginal(img);
    } catch {
      setError('Could not read image.');
    }
  }, []);

  const drawOriginal = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }, []);

  /* Redraw original when canvas mounts (after file is set) */
  useEffect(() => {
    if (imgRef.current && canvasRef.current) drawOriginal(imgRef.current);
  }, [file, drawOriginal]);

  /* ---- magic wand: pick color from canvas click ---- */
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    setPickedColor([pixel[0], pixel[1], pixel[2]]);
  }, []);

  /* ---- remove color range ---- */
  const removeColor = useCallback((targetR: number, targetG: number, targetB: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redraw original first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const threshold = (tolerance / 100) * MAX_DIST;

    for (let i = 0; i < data.length; i += 4) {
      const dist = colorDistance(data[i], data[i + 1], data[i + 2], targetR, targetG, targetB);
      if (dist <= threshold) {
        // Smooth edge: fade alpha near the threshold boundary
        const ratio = dist / threshold;
        if (ratio < 0.7) {
          data[i + 3] = 0;
        } else {
          data[i + 3] = Math.round(((ratio - 0.7) / 0.3) * data[i + 3]);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setResultUrl(canvas.toDataURL('image/png'));
  }, [tolerance]);

  /* Apply picked color whenever picked color or tolerance changes */
  useEffect(() => {
    if (pickedColor) {
      removeColor(pickedColor[0], pickedColor[1], pickedColor[2]);
    }
  }, [pickedColor, tolerance, removeColor]);

  /* ---- preset removers ---- */
  const removeWhiteBg = useCallback(() => {
    setPickedColor([255, 255, 255]);
  }, []);

  const removeBlackBg = useCallback(() => {
    setPickedColor([0, 0, 0]);
  }, []);

  /* ---- reset ---- */
  const handleReset = useCallback(() => {
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    setFile(null);
    setOriginalUrl('');
    setResultUrl('');
    setPickedColor(null);
    setError('');
    imgRef.current = null;
  }, []);

  return (
    <div className="space-y-5 p-4 pb-24 md:pb-4 max-w-3xl mx-auto">
      {/* Header with back button */}
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="mt-0.5 flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white/80 hover:border-white/[0.15] transition-colors cursor-pointer"
          aria-label="Back to tools"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-[#E8E8F0]">Remove Background</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Click a color to make it transparent, or use one-click presets
          </p>
        </div>
      </div>

      {/* Upload */}
      {!file && <UploadZone onFile={handleFile} accept="image/*" />}

      {file && (
        <>
          {/* File info card */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/10">
                <Eraser className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#E8E8F0] truncate">{file.name}</p>
                <p className="text-xs text-[#6B7280]">
                  {file.size < 1024 * 1024
                    ? `${(file.size / 1024).toFixed(1)} KB`
                    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-[#6B7280] hover:text-[#FF6B6B] transition-colors"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Controls panel */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-4">
            {/* Quick remove buttons */}
            <div>
              <label className="text-xs text-[#6B7280] font-medium uppercase tracking-wide mb-2 block">
                Quick Remove
              </label>
              <div className="flex gap-2">
                <button
                  onClick={removeWhiteBg}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    pickedColor && pickedColor[0] === 255 && pickedColor[1] === 255 && pickedColor[2] === 255
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'bg-white/[0.04] text-[#6B7280] border border-white/[0.08] hover:text-[#E8E8F0] hover:border-white/[0.12]'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white border border-white/20 flex-shrink-0" />
                  White BG
                </button>
                <button
                  onClick={removeBlackBg}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    pickedColor && pickedColor[0] === 0 && pickedColor[1] === 0 && pickedColor[2] === 0
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'bg-white/[0.04] text-[#6B7280] border border-white/[0.08] hover:text-[#E8E8F0] hover:border-white/[0.12]'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-black border border-white/20 flex-shrink-0" />
                  Black BG
                </button>
              </div>
            </div>

            {/* Tolerance slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">
                  Tolerance
                </label>
                <span className="text-xs font-mono text-[#E8E8F0]">{tolerance}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={tolerance}
                onChange={(e) => setTolerance(parseInt(e.target.value, 10))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                  bg-white/[0.08] accent-violet-500
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-violet-500
                  [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(139,92,246,0.5)]"
              />
              <div className="flex justify-between text-[10px] text-[#6B7280] mt-1">
                <span>Exact match</span>
                <span>Aggressive</span>
              </div>
            </div>

            {/* Picked color indicator */}
            {pickedColor && (
              <div className="flex items-center gap-3 pt-1">
                <span
                  className="w-6 h-6 rounded-md border border-white/20 flex-shrink-0"
                  style={{ backgroundColor: `rgb(${pickedColor[0]},${pickedColor[1]},${pickedColor[2]})` }}
                />
                <span className="text-xs text-[#6B7280]">
                  Target: rgb({pickedColor[0]}, {pickedColor[1]}, {pickedColor[2]})
                </span>
              </div>
            )}
          </div>

          {/* Canvas: magic wand click area */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <MousePointer2 className="w-3.5 h-3.5 text-violet-400" />
              <p className="text-xs text-[#6B7280]">
                Click on any color in the image to remove it
              </p>
            </div>
            <div
              className="rounded-lg overflow-hidden border border-white/[0.06] flex items-center justify-center"
              style={CHECKERBOARD}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-w-full max-h-[420px] object-contain cursor-crosshair"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-lg p-3 text-sm text-[#FF6B6B]">
              <Info className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Before/After + Download */}
          {resultUrl && (
            <div className="space-y-4">
              <BeforeAfter
                before={originalUrl}
                after={resultUrl}
                beforeLabel="Original"
                afterLabel="Transparent"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/70 hover:text-white hover:border-white/20 transition-colors"
                >
                  New Image
                </button>
                <DownloadButton dataUrl={resultUrl} filename={resultFilename} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
