import { useState, useCallback, useEffect, useRef } from 'react';
import { UploadZone } from '../components/UploadZone';
import { DownloadButton } from '../components/DownloadButton';

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

/**
 * Render the image with the given rotation and flip to a data URL.
 * For 90/270 rotations the output canvas swaps width/height so the
 * full image is always visible without clipping.
 */
async function renderTransformed(
  imageSrc: string,
  angleDeg: number,
  flipH: boolean,
  flipV: boolean,
): Promise<string> {
  const img = await createImage(imageSrc);
  const rad = (angleDeg * Math.PI) / 180;

  // For 90 or 270 degree rotations, swap canvas dimensions
  const swap = Math.abs(angleDeg % 360) === 90 || Math.abs(angleDeg % 360) === 270;
  const canvasW = swap ? img.height : img.width;
  const canvasH = swap ? img.width : img.height;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate(rad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  return canvas.toDataURL('image/png');
}

/* ---------- state description helper ---------- */
function describeState(angleDeg: number, flipH: boolean, flipV: boolean): string {
  const parts: string[] = [];

  const normalized = ((angleDeg % 360) + 360) % 360;
  if (normalized !== 0) {
    if (normalized === 90) parts.push('Rotated 90\u00B0 CW');
    else if (normalized === 180) parts.push('Rotated 180\u00B0');
    else if (normalized === 270) parts.push('Rotated 90\u00B0 CCW');
    else parts.push(`Rotated ${angleDeg}\u00B0`);
  }

  if (flipH) parts.push('Flipped H');
  if (flipV) parts.push('Flipped V');

  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

/* ---------- component ---------- */
export function RotateTool() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [angle, setAngle] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  /* live preview canvas */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewImgRef = useRef<HTMLImageElement | null>(null);

  /* file upload handler */
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setResult(null);
      setAngle(0);
      setFlipH(false);
      setFlipV(false);
      previewImgRef.current = null;
    };
    reader.readAsDataURL(file);
  }, []);

  /* draw live preview whenever transforms change */
  useEffect(() => {
    if (!imageSrc) return;

    let cancelled = false;

    const draw = async () => {
      // cache the HTMLImageElement across re-renders
      if (!previewImgRef.current) {
        previewImgRef.current = await createImage(imageSrc);
      }
      if (cancelled) return;

      const img = previewImgRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rad = (angle * Math.PI) / 180;
      const swap = Math.abs(angle % 360) === 90 || Math.abs(angle % 360) === 270;
      const cw = swap ? img.height : img.width;
      const ch = swap ? img.width : img.height;

      // fit within 600x400 preview area
      const maxW = 600;
      const maxH = 400;
      const scale = Math.min(1, maxW / cw, maxH / ch);

      canvas.width = Math.round(cw * scale);
      canvas.height = Math.round(ch * scale);

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.scale(flipH ? -scale : scale, flipV ? -scale : scale);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    };

    draw();
    return () => {
      cancelled = true;
    };
  }, [imageSrc, angle, flipH, flipV]);

  /* apply transforms at full resolution */
  const handleApply = useCallback(async () => {
    if (!imageSrc) return;
    setProcessing(true);
    try {
      const dataUrl = await renderTransformed(imageSrc, angle, flipH, flipV);
      setResult(dataUrl);
    } catch {
      // silently fail
    } finally {
      setProcessing(false);
    }
  }, [imageSrc, angle, flipH, flipV]);

  /* reset to upload state */
  const handleReset = useCallback(() => {
    setImageSrc(null);
    setResult(null);
    previewImgRef.current = null;
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
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-4 flex items-center justify-center">
          <img
            src={result}
            alt="Transformed result"
            className="max-w-full max-h-[480px] rounded-lg object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.04] text-sm text-white/70 hover:text-white hover:border-white/[0.12] transition-colors"
          >
            New Image
          </button>
          <button
            onClick={() => setResult(null)}
            className="px-5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.04] text-sm text-white/70 hover:text-white hover:border-white/[0.12] transition-colors"
          >
            Edit Again
          </button>
          <DownloadButton dataUrl={result} filename="rotated.png" />
        </div>
      </div>
    );
  }

  /* ---- render: editor ---- */
  const stateDescription = describeState(angle, flipH, flipV);

  return (
    <div className="space-y-5">
      {/* live preview */}
      <div className="rounded-2xl border border-white/[0.06] bg-black/40 overflow-hidden flex items-center justify-center min-h-[400px] p-4">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>

      {/* controls panel */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-5 space-y-5">
        {/* state indicator */}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
          {stateDescription}
        </div>

        {/* quick rotation buttons */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Rotate
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAngle((a) => a - 90)}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium border border-white/[0.06] bg-white/[0.04] text-white/60 hover:text-white hover:border-white/[0.12] transition-all"
            >
              -90deg
            </button>
            <button
              onClick={() => setAngle((a) => a + 90)}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium border border-white/[0.06] bg-white/[0.04] text-white/60 hover:text-white hover:border-white/[0.12] transition-all"
            >
              +90deg
            </button>
            <button
              onClick={() => setAngle((a) => a + 180)}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium border border-white/[0.06] bg-white/[0.04] text-white/60 hover:text-white hover:border-white/[0.12] transition-all"
            >
              180deg
            </button>
          </div>
        </div>

        {/* custom angle slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Custom Angle
            </label>
            <span className="text-xs text-white/40 tabular-nums">{angle}deg</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={((angle % 360) + 540) % 360 - 180} // normalize to -180..180 for slider
            onChange={(e) => setAngle(Number(e.target.value))}
            className="w-full accent-[#8B5CF6]"
          />
        </div>

        {/* flip buttons */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Flip
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setFlipH((f) => !f)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                flipH
                  ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25'
                  : 'border border-white/[0.06] bg-white/[0.04] text-white/60 hover:text-white hover:border-white/[0.12]'
              }`}
            >
              Horizontal
            </button>
            <button
              onClick={() => setFlipV((f) => !f)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                flipV
                  ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25'
                  : 'border border-white/[0.06] bg-white/[0.04] text-white/60 hover:text-white hover:border-white/[0.12]'
              }`}
            >
              Vertical
            </button>
          </div>
        </div>
      </div>

      {/* action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleReset}
          className="px-5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.04] text-sm text-white/70 hover:text-white hover:border-white/[0.12] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={processing}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-sm font-semibold text-white shadow-lg shadow-[#8B5CF6]/25 hover:shadow-[#8B5CF6]/40 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Applying...' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
