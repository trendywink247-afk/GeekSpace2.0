import { useState, useCallback, useRef, useEffect } from 'react';
import { Lock, Unlock, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { UploadZone } from '../components/UploadZone';
import { DownloadButton } from '../components/DownloadButton';

interface ImageDims {
  width: number;
  height: number;
}

interface SocialPreset {
  label: string;
  width: number;
  height: number;
}

const SCALE_PRESETS = [
  { label: '50%', factor: 0.5 },
  { label: '75%', factor: 0.75 },
  { label: '150%', factor: 1.5 },
  { label: '200%', factor: 2 },
] as const;

const SOCIAL_PRESETS: SocialPreset[] = [
  { label: 'Instagram', width: 1080, height: 1080 },
  { label: 'FB Cover', width: 820, height: 312 },
  { label: 'Twitter Header', width: 1500, height: 500 },
  { label: 'YT Thumbnail', width: 1280, height: 720 },
];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function resizeToDataUrl(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetWidth);
  canvas.height = Math.round(targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function ResizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [originalDims, setOriginalDims] = useState<ImageDims | null>(null);
  const [, setOriginalUrl] = useState('');

  // Controls
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [lockAspect, setLockAspect] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Preview
  const [previewUrl, setPreviewUrl] = useState('');
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevOriginalRef = useRef('');

  const aspectRatio = originalDims ? originalDims.width / originalDims.height : 1;

  const handleFile = useCallback(async (f: File) => {
    if (prevOriginalRef.current) URL.revokeObjectURL(prevOriginalRef.current);

    setFile(f);
    setPreviewUrl('');
    setActivePreset(null);

    try {
      const img = await loadImage(f);
      setImageEl(img);
      setOriginalDims({ width: img.naturalWidth, height: img.naturalHeight });
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);

      const url = URL.createObjectURL(f);
      prevOriginalRef.current = url;
      setOriginalUrl(url);
    } catch {
      setOriginalDims(null);
    }
  }, []);

  // Debounced live preview
  useEffect(() => {
    if (!imageEl || !width || !height) {
      setPreviewUrl('');
      return;
    }

    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);

    previewTimeoutRef.current = setTimeout(() => {
      const dataUrl = resizeToDataUrl(imageEl, Number(width), Number(height));
      setPreviewUrl(dataUrl);
    }, 200);

    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, [imageEl, width, height]);

  const handleWidthChange = useCallback(
    (val: string) => {
      const w = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1);
      setWidth(w);
      setActivePreset('Custom');
      if (lockAspect && typeof w === 'number' && originalDims) {
        setHeight(Math.round(w / aspectRatio));
      }
    },
    [lockAspect, aspectRatio, originalDims],
  );

  const handleHeightChange = useCallback(
    (val: string) => {
      const h = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1);
      setHeight(h);
      setActivePreset('Custom');
      if (lockAspect && typeof h === 'number' && originalDims) {
        setWidth(Math.round(h * aspectRatio));
      }
    },
    [lockAspect, aspectRatio, originalDims],
  );

  const applyScalePreset = useCallback(
    (factor: number, label: string) => {
      if (!originalDims) return;
      const w = Math.round(originalDims.width * factor);
      const h = Math.round(originalDims.height * factor);
      setWidth(w);
      setHeight(h);
      setActivePreset(label);
    },
    [originalDims],
  );

  const applySocialPreset = useCallback((preset: SocialPreset) => {
    setWidth(preset.width);
    setHeight(preset.height);
    setLockAspect(false);
    setActivePreset(preset.label);
  }, []);

  const outputFilename = file
    ? `${file.name.replace(/\.[^.]+$/, '')}-${width}x${height}.png`
    : 'resized.png';

  const handleReset = useCallback(() => {
    if (prevOriginalRef.current) URL.revokeObjectURL(prevOriginalRef.current);
    setFile(null);
    setImageEl(null);
    setOriginalDims(null);
    setOriginalUrl('');
    setPreviewUrl('');
    setWidth('');
    setHeight('');
    setActivePreset(null);
  }, []);

  return (
    <div className="space-y-5 p-4 pb-24 md:pb-4 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Resize Image</h2>
        <p className="text-xs text-white/50 mt-0.5">
          Scale to exact dimensions or popular social media sizes
        </p>
      </div>

      {/* Upload */}
      {!file && <UploadZone onFile={handleFile} accept="image/*" />}

      {originalDims && (
        <>
          {/* Original info */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/10">
                <ImageIcon className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{file?.name}</p>
                <p className="text-xs text-white/50">
                  {originalDims.width} x {originalDims.height} px
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-white/50 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-4">
            {/* Dimension inputs + lock */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-white/50 font-medium uppercase tracking-wide mb-1.5 block">
                  Width
                </label>
                <input
                  type="number"
                  min={1}
                  value={width}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2
                    text-sm text-white placeholder:text-white/20
                    focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>

              {/* Lock toggle */}
              <button
                onClick={() => setLockAspect((v) => !v)}
                className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all mb-0.5 ${
                  lockAspect
                    ? 'bg-violet-500/15 border-violet-500/40 text-violet-400'
                    : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'
                }`}
                title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
              >
                {lockAspect ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>

              <div className="flex-1">
                <label className="text-xs text-white/50 font-medium uppercase tracking-wide mb-1.5 block">
                  Height
                </label>
                <input
                  type="number"
                  min={1}
                  value={height}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2
                    text-sm text-white placeholder:text-white/20
                    focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Scale presets */}
            <div>
              <label className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2 block">
                Scale
              </label>
              <div className="flex flex-wrap gap-2">
                {SCALE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyScalePreset(p.factor, p.label)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activePreset === p.label
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                        : 'bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-white hover:border-white/[0.12]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setActivePreset('Custom')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activePreset === 'Custom'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-white hover:border-white/[0.12]'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Social media presets */}
            <div>
              <label className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2 block">
                Social Media
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SOCIAL_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applySocialPreset(p)}
                    className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      activePreset === p.label
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                        : 'bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-white hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="font-medium">{p.label}</span>
                    <span className="text-[10px] opacity-60">{p.width}x{p.height}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Output dimensions summary */}
            {width && height && originalDims && (
              <div className="flex items-center gap-2 text-xs text-white/50 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                <Maximize2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {originalDims.width}x{originalDims.height}
                </span>
                <span>&rarr;</span>
                <span className="text-white font-medium">
                  {width}x{height}
                </span>
                {originalDims.width !== 0 && (
                  <span className="ml-auto text-violet-400">
                    {Math.round((Number(width) / originalDims.width) * 100)}% scale
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Live preview */}
          {previewUrl && (
            <div className="space-y-3">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wide block">
                Preview
              </label>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 flex items-center justify-center overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Resized preview"
                  className="max-w-full max-h-[400px] object-contain rounded-lg"
                  style={{
                    imageRendering: Number(width) < (originalDims?.width ?? 0) ? 'auto' : 'auto',
                  }}
                />
              </div>

              {/* Download */}
              <DownloadButton dataUrl={previewUrl} filename={outputFilename} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
