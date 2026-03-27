// ============================================================
// ConvertTool — Image format conversion (JPG/PNG/WebP/HEIC)
//
// Uses Canvas API for standard formats and heic2any for HEIC.
// ============================================================

import { useState, useCallback, useRef } from 'react';
import heic2any from 'heic2any';
import { UploadZone } from '../components/UploadZone';
import { DownloadButton } from '../components/DownloadButton';

// ── Types ────────────────────────────────────────────────────

type TargetFormat = 'png' | 'jpeg' | 'webp';

interface ConversionResult {
  dataUrl: string;
  filename: string;
  originalSize: number;
  convertedSize: number;
  originalFormat: string;
  targetFormat: TargetFormat;
}

// ── Helpers ──────────────────────────────────────────────────

const MIME_MAP: Record<TargetFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const EXT_MAP: Record<TargetFormat, string> = {
  png: '.png',
  jpeg: '.jpg',
  webp: '.webp',
};

const FORMAT_LABELS: Record<TargetFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
};

function detectFormat(file: File): string {
  if (file.type === 'image/png') return 'PNG';
  if (file.type === 'image/jpeg') return 'JPEG';
  if (file.type === 'image/webp') return 'WebP';
  if (file.type === 'image/gif') return 'GIF';
  if (file.type === 'image/bmp') return 'BMP';
  if (file.type === 'image/svg+xml') return 'SVG';

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'heic' || ext === 'heif') return 'HEIC';
  if (ext === 'png') return 'PNG';
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG';
  if (ext === 'webp') return 'WebP';

  return file.type || 'Unknown';
}

function isHeic(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'heic' || ext === 'heif' || file.type === 'image/heic' || file.type === 'image/heif';
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sizeChangeLabel(original: number, converted: number): string {
  if (original === 0) return '';
  const pct = ((converted - original) / original) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ── SVG Icons (inline to avoid dep on icon lib) ─────────────

function FormatIcon({ format }: { format: TargetFormat }) {
  const label = FORMAT_LABELS[format];
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="currentColor"
        fontSize="7"
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

// ── Canvas conversion ────────────────────────────────────────

function convertViaCanvas(
  imageSrc: string,
  targetMime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        },
        targetMime,
        quality,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageSrc;
  });
}

// ── Component ────────────────────────────────────────────────

export function ConvertTool(_props: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [originalFormat, setOriginalFormat] = useState('');
  const [target, setTarget] = useState<TargetFormat>('png');
  const [quality, setQuality] = useState(0.85);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // ── File upload handler ──────────────────────────────────
  const handleFile = useCallback((incoming: File) => {
    // Revoke old preview URL
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    setFile(incoming);
    setResult(null);
    setError(null);
    setOriginalFormat(detectFormat(incoming));

    // Create preview — for HEIC we need conversion first
    if (isHeic(incoming)) {
      heic2any({ blob: incoming, toType: 'image/jpeg', quality: 0.5 })
        .then((blob) => {
          const single = Array.isArray(blob) ? blob[0] : blob;
          const url = URL.createObjectURL(single);
          previewUrlRef.current = url;
          setPreview(url);
        })
        .catch(() => {
          setPreview(null);
        });
    } else {
      const url = URL.createObjectURL(incoming);
      previewUrlRef.current = url;
      setPreview(url);
    }
  }, []);

  // ── Convert handler ──────────────────────────────────────
  const handleConvert = useCallback(async () => {
    if (!file) return;
    setConverting(true);
    setError(null);
    setResult(null);

    try {
      const targetMime = MIME_MAP[target];
      let blob: Blob;

      if (isHeic(file)) {
        const converted = await heic2any({
          blob: file,
          toType: targetMime,
          quality: target === 'png' ? undefined : quality,
        });
        blob = Array.isArray(converted) ? converted[0] : converted;
      } else {
        // Standard format — load via object URL then canvas-convert
        const src = URL.createObjectURL(file);
        try {
          blob = await convertViaCanvas(src, targetMime, quality);
        } finally {
          URL.revokeObjectURL(src);
        }
      }

      // Build data URL for download
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read converted blob'));
        reader.readAsDataURL(blob);
      });

      const baseName = stripExtension(file.name);
      setResult({
        dataUrl,
        filename: baseName + EXT_MAP[target],
        originalSize: file.size,
        convertedSize: blob.size,
        originalFormat: originalFormat,
        targetFormat: target,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setConverting(false);
    }
  }, [file, target, quality, originalFormat]);

  // ── Reset ────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setFile(null);
    setPreview(null);
    setOriginalFormat('');
    setResult(null);
    setError(null);
  }, []);

  const showQuality = target === 'jpeg' || target === 'webp';

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {!file && (
        <UploadZone
          onFile={handleFile}
          accept="image/*,.heic,.heif"
        />
      )}

      {/* File loaded — show controls */}
      {file && (
        <>
          {/* Preview + format info */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-4 space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {preview && (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-12 h-12 rounded-lg object-cover border border-white/[0.06] shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-white/90 font-medium truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {originalFormat} &middot; {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-md hover:bg-white/5"
              >
                Change
              </button>
            </div>

            {/* Target format selector */}
            <div className="space-y-2">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                Convert to
              </label>
              <div className="flex gap-2">
                {(['png', 'jpeg', 'webp'] as TargetFormat[]).map((fmt) => {
                  const active = target === fmt;
                  return (
                    <button
                      key={fmt}
                      onClick={() => {
                        setTarget(fmt);
                        setResult(null);
                      }}
                      className={[
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all border',
                        active
                          ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/15 text-white font-medium'
                          : 'border-white/[0.06] bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white/80',
                      ].join(' ')}
                    >
                      <FormatIcon format={fmt} />
                      {FORMAT_LABELS[fmt]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality slider (JPEG / WebP only) */}
            {showQuality && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                    Quality
                  </label>
                  <span className="text-xs text-white/70 tabular-nums font-medium">
                    {Math.round(quality * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={quality}
                  onChange={(e) => {
                    setQuality(parseFloat(e.target.value));
                    setResult(null);
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-runnable-track]:rounded-full
                    [&::-webkit-slider-runnable-track]:bg-white/10
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-[#8B5CF6]
                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20
                    [&::-webkit-slider-thumb]:-mt-[5px]
                    [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(139,92,246,0.4)]"
                />
                <div className="flex justify-between text-[10px] text-white/30">
                  <span>Smaller file</span>
                  <span>Better quality</span>
                </div>
              </div>
            )}

            {/* Convert button */}
            <button
              onClick={handleConvert}
              disabled={converting}
              className={[
                'w-full rounded-lg px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2',
                converting
                  ? 'bg-[#8B5CF6]/30 text-white/50 cursor-wait'
                  : 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white hover:opacity-90 active:scale-[0.98]',
              ].join(' ')}
            >
              {converting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Converting...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 8h.01" />
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                  Convert to {FORMAT_LABELS[target]}
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-4 space-y-4">
              <h3 className="text-sm font-medium text-white/90">Conversion Complete</h3>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">From</p>
                  <p className="text-sm text-white/80 font-medium">{result.originalFormat}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">To</p>
                  <p className="text-sm text-[#8B5CF6] font-medium">{FORMAT_LABELS[result.targetFormat]}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Size</p>
                  <p className="text-sm text-white/80 font-medium">
                    {formatBytes(result.convertedSize)}
                  </p>
                  <p className={[
                    'text-[10px] mt-0.5',
                    result.convertedSize <= result.originalSize ? 'text-emerald-400' : 'text-amber-400',
                  ].join(' ')}>
                    {sizeChangeLabel(result.originalSize, result.convertedSize)}
                  </p>
                </div>
              </div>

              {/* Download */}
              <DownloadButton
                dataUrl={result.dataUrl}
                filename={result.filename}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
