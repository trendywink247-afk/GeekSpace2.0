import { useState, useCallback, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { Loader2, FileDown, Image as ImageIcon, Info } from 'lucide-react';
import { UploadZone } from '../components/UploadZone';
import { BeforeAfter } from '../components/BeforeAfter';
import { DownloadButton } from '../components/DownloadButton';

type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

interface FileInfo {
  name: string;
  size: number;
  width: number;
  height: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(format: OutputFormat): string {
  const map: Record<OutputFormat, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[format];
}

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export function CompressTool(_props: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [originalInfo, setOriginalInfo] = useState<FileInfo | null>(null);
  const [originalUrl, setOriginalUrl] = useState('');

  // Controls
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState<number | ''>('');
  const [maxHeight, setMaxHeight] = useState<number | ''>('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');

  // Result
  const [compressing, setCompressing] = useState(false);
  const [compressedUrl, setCompressedUrl] = useState('');
  const [compressedSize, setCompressedSize] = useState(0);
  const [compressedName, setCompressedName] = useState('');
  const [error, setError] = useState('');

  const prevUrlRef = useRef('');
  const prevCompressedRef = useRef('');

  const handleFile = useCallback(async (f: File) => {
    // Revoke previous object URLs
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    if (prevCompressedRef.current) URL.revokeObjectURL(prevCompressedRef.current);

    setError('');
    setCompressedUrl('');
    setCompressedSize(0);
    setFile(f);

    try {
      const dims = await loadImageDimensions(f);
      setOriginalInfo({ name: f.name, size: f.size, width: dims.width, height: dims.height });
      setMaxWidth(dims.width);
      setMaxHeight(dims.height);

      const url = URL.createObjectURL(f);
      prevUrlRef.current = url;
      setOriginalUrl(url);
    } catch {
      setError('Could not read image dimensions.');
    }
  }, []);

  const handleCompress = useCallback(async () => {
    if (!file || !originalInfo) return;

    setCompressing(true);
    setError('');

    try {
      const maxDim = Math.max(
        typeof maxWidth === 'number' ? maxWidth : originalInfo.width,
        typeof maxHeight === 'number' ? maxHeight : originalInfo.height,
      );

      // quality maps to maxSizeMB heuristic: lower quality = smaller target
      const estimatedMaxMB = (file.size / (1024 * 1024)) * quality;

      const compressed = await imageCompression(file, {
        maxSizeMB: Math.max(estimatedMaxMB, 0.01),
        maxWidthOrHeight: maxDim || undefined,
        useWebWorker: true,
        fileType: outputFormat,
        initialQuality: quality,
      });

      if (prevCompressedRef.current) URL.revokeObjectURL(prevCompressedRef.current);

      const url = URL.createObjectURL(compressed);
      prevCompressedRef.current = url;

      const ext = getExtension(outputFormat);
      const baseName = file.name.replace(/\.[^.]+$/, '');

      setCompressedUrl(url);
      setCompressedSize(compressed.size);
      setCompressedName(`${baseName}-compressed.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compression failed');
    } finally {
      setCompressing(false);
    }
  }, [file, originalInfo, quality, maxWidth, maxHeight, outputFormat]);

  const reductionPercent =
    originalInfo && compressedSize > 0
      ? Math.round((1 - compressedSize / originalInfo.size) * 100)
      : 0;

  const formatOptions: { label: string; value: OutputFormat }[] = [
    { label: 'JPEG', value: 'image/jpeg' },
    { label: 'PNG', value: 'image/png' },
    { label: 'WebP', value: 'image/webp' },
  ];

  return (
    <div className="space-y-5 p-4 pb-24 md:pb-4 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--ag-text-primary)]">Compress Image</h2>
        <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
          Reduce file size while preserving visual quality
        </p>
      </div>

      {/* Upload */}
      {!file && <UploadZone onFile={handleFile} accept="image/*" />}

      {/* Original info + controls */}
      {originalInfo && (
        <>
          {/* File info card */}
          <div className="rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--ag-forge)]/10">
                <ImageIcon className="w-5 h-5 text-[var(--ag-forge)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ag-text-primary)] truncate">{originalInfo.name}</p>
                <p className="text-xs text-[var(--ag-text-secondary)]">
                  {originalInfo.width} x {originalInfo.height} &middot; {formatBytes(originalInfo.size)}
                </p>
              </div>
              <button
                onClick={() => {
                  if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
                  if (prevCompressedRef.current) URL.revokeObjectURL(prevCompressedRef.current);
                  setFile(null);
                  setOriginalInfo(null);
                  setOriginalUrl('');
                  setCompressedUrl('');
                  setCompressedSize(0);
                  setError('');
                }}
                className="text-xs min-h-[44px] text-[var(--ag-text-secondary)] hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] p-4 space-y-4">
            {/* Quality slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[var(--ag-text-secondary)] font-medium uppercase tracking-wide">
                  Quality
                </label>
                <span className="text-xs font-mono text-[var(--ag-text-primary)]">
                  {Math.round(quality * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                  bg-white/[0.08] accent-violet-500
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-violet-500
                  [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(139,92,246,0.5)]"
              />
              <div className="flex justify-between text-[10px] text-[var(--ag-text-muted)] mt-1">
                <span>Smallest file</span>
                <span>Best quality</span>
              </div>
            </div>

            {/* Max dimensions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--ag-text-secondary)] font-medium uppercase tracking-wide mb-1.5 block">
                  Max Width
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxWidth}
                  onChange={(e) => setMaxWidth(e.target.value ? parseInt(e.target.value, 10) : '')}
                  placeholder={String(originalInfo.width)}
                  className="w-full min-h-[44px] bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] rounded-lg px-3 py-2
                    text-sm text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)]
                    focus:outline-none focus:border-[var(--ag-violet)]/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--ag-text-secondary)] font-medium uppercase tracking-wide mb-1.5 block">
                  Max Height
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(e.target.value ? parseInt(e.target.value, 10) : '')}
                  placeholder={String(originalInfo.height)}
                  className="w-full min-h-[44px] bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] rounded-lg px-3 py-2
                    text-sm text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)]
                    focus:outline-none focus:border-[var(--ag-violet)]/50 transition-colors"
                />
              </div>
            </div>

            {/* Output format */}
            <div>
              <label className="text-xs text-[var(--ag-text-secondary)] font-medium uppercase tracking-wide mb-2 block">
                Output Format
              </label>
              <div className="flex gap-2">
                {formatOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setOutputFormat(opt.value)}
                    className={`px-4 min-h-[44px] rounded-lg text-sm font-medium transition-all ${
                      outputFormat === opt.value
                        ? 'bg-[var(--ag-violet)]/20 text-[var(--ag-violet)] border border-[var(--ag-violet)]/40'
                        : 'bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compress button */}
            <button
              onClick={handleCompress}
              disabled={compressing}
              className="w-full min-h-[44px] rounded-lg text-sm font-semibold text-[var(--ag-text-primary)]
                bg-gradient-to-r from-[var(--ag-violet)] to-[#7C3AED]
                hover:brightness-110
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all flex items-center justify-center gap-2"
            >
              {compressing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Compressing...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Compress
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              <Info className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Results */}
          {compressedUrl && (
            <div className="space-y-4">
              {/* Size reduction summary */}
              <div className="rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[var(--ag-text-primary)]">
                    <span className="text-[var(--ag-text-secondary)]">{formatBytes(originalInfo.size)}</span>
                    <span className="mx-2 text-[var(--ag-text-muted)]">&rarr;</span>
                    <span className="font-semibold text-[var(--ag-green)]">
                      {formatBytes(compressedSize)}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                      reductionPercent > 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-yellow-500/15 text-yellow-400'
                    }`}
                  >
                    {reductionPercent > 0
                      ? `${reductionPercent}% smaller`
                      : 'No size reduction'}
                  </span>
                </div>

                {/* Size bar visualization */}
                <div className="mt-3 h-2 rounded-full bg-[var(--ag-bg-elevated)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.max(100 - reductionPercent, 2)}%` }}
                  />
                </div>
              </div>

              {/* Before / After comparison */}
              <BeforeAfter before={originalUrl} after={compressedUrl} />

              {/* Download */}
              <DownloadButton dataUrl={compressedUrl} filename={compressedName} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
