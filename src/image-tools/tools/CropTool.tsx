import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { UploadZone } from '../components/UploadZone';
import { DownloadButton } from '../components/DownloadButton';

/* ---------- aspect-ratio presets ---------- */
interface AspectPreset {
  label: string;
  value: number | undefined; // undefined = free
}

const ASPECT_PRESETS: AspectPreset[] = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];

/* ---------- canvas helpers ---------- */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = url;
  });
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );
  return canvas.toDataURL('image/png');
}

/* ---------- component ---------- */
export function CropTool(_props: { onBack: () => void }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  /* file upload handler */
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setResult(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
    };
    reader.readAsDataURL(file);
  }, []);

  /* crop complete callback from react-easy-crop */
  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  /* apply crop */
  const handleApply = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const dataUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
      setResult(dataUrl);
    } catch {
      // silently fail -- the user can retry
    } finally {
      setProcessing(false);
    }
  }, [imageSrc, croppedAreaPixels]);

  /* reset to upload state */
  const handleReset = useCallback(() => {
    setImageSrc(null);
    setResult(null);
    setCroppedAreaPixels(null);
  }, []);

  /* ---- render: upload state ---- */
  if (!imageSrc) {
    return (
      <div className="space-y-6">
        <UploadZone onFile={handleFile} />
      </div>
    );
  }

  /* ---- render: result state ---- */
  if (result) {
    return (
      <div className="space-y-6">
        {/* preview */}
        <div className="rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] backdrop-blur-md p-4 flex items-center justify-center">
          <img
            src={result}
            alt="Cropped result"
            className="max-w-full max-h-[480px] rounded-lg object-contain"
          />
        </div>

        {/* actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-5 min-h-[44px] rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] text-sm text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] transition-colors"
          >
            New Image
          </button>
          <button
            onClick={() => setResult(null)}
            className="px-5 min-h-[44px] rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] text-sm text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] transition-colors"
          >
            Re-Crop
          </button>
          <DownloadButton dataUrl={result} filename="cropped.png" />
        </div>
      </div>
    );
  }

  /* ---- render: crop editor ---- */
  return (
    <div className="space-y-5">
      {/* cropper viewport */}
      <div
        className="relative rounded-2xl border border-[var(--ag-border-subtle)] bg-black/40 overflow-hidden"
        style={{ height: 400 }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* controls panel */}
      <div className="rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] backdrop-blur-md p-5 space-y-5">
        {/* aspect ratio presets */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--ag-text-secondary)] uppercase tracking-wider">
            Aspect Ratio
          </label>
          <div className="flex flex-wrap gap-2">
            {ASPECT_PRESETS.map((preset) => {
              const active = aspect === preset.value;
              return (
                <button
                  key={preset.label}
                  onClick={() => setAspect(preset.value)}
                  className={`px-3.5 min-h-[44px] rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-[var(--ag-violet)] text-[var(--ag-text-primary)] shadow-lg shadow-[var(--ag-violet)]/25'
                      : 'border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* zoom slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--ag-text-secondary)] uppercase tracking-wider">
              Zoom
            </label>
            <span className="text-xs text-[var(--ag-text-muted)] tabular-nums">{zoom.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[#8B5CF6]"
          />
        </div>

        {/* rotation slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--ag-text-secondary)] uppercase tracking-wider">
              Rotation
            </label>
            <span className="text-xs text-[var(--ag-text-muted)] tabular-nums">{rotation}deg</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="w-full accent-[#8B5CF6]"
          />
        </div>
      </div>

      {/* action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleReset}
          className="px-5 min-h-[44px] rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] text-sm text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={processing}
          className="px-6 min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[#7C3AED] text-sm font-semibold text-[var(--ag-text-primary)] shadow-lg shadow-[var(--ag-violet)]/25 hover:shadow-[var(--ag-violet)]/40 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Cropping...' : 'Apply Crop'}
        </button>
      </div>
    </div>
  );
}
