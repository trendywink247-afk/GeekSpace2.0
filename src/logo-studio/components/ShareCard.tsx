import { useState, useRef, useCallback, useEffect } from 'react';

interface ShareCardProps {
  logoUrl: string;
  brandName: string;
  onShare?: () => void;
}

const CARD_SIZE = 1080;
const SHARE_URL = 'https://ai.agentin.chat/logo-studio';

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

function createGradient(ctx: CanvasRenderingContext2D, w: number, h: number): CanvasGradient {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#06061a');
  grad.addColorStop(1, '#1a1a3e');
  return grad;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function renderShareCard(
  canvas: HTMLCanvasElement,
  logoUrl: string,
  brandName: string,
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;

  // Background gradient
  ctx.fillStyle = createGradient(ctx, CARD_SIZE, CARD_SIZE);
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  // Violet accent border (inset)
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 24, 24, CARD_SIZE - 48, CARD_SIZE - 48, 20);
  ctx.stroke();

  // Load and draw logo in upper 60%
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    logoImg.onload = () => resolve();
    logoImg.onerror = () => reject(new Error('Failed to load logo image'));
    logoImg.src = logoUrl;
  });

  const logoAreaHeight = CARD_SIZE * 0.6;
  const maxLogoSize = Math.min(logoAreaHeight - 120, CARD_SIZE - 200);
  const logoW = Math.min(logoImg.naturalWidth, maxLogoSize);
  const logoH = Math.min(logoImg.naturalHeight, maxLogoSize);
  const scale = Math.min(maxLogoSize / logoW, maxLogoSize / logoH, 1);
  const drawW = logoW * scale;
  const drawH = logoH * scale;
  const logoX = (CARD_SIZE - drawW) / 2;
  const logoY = (logoAreaHeight - drawH) / 2 + 40;

  ctx.drawImage(logoImg, logoX, logoY, drawW, drawH);

  // Brand name
  const textY = CARD_SIZE * 0.68;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let displayName = brandName;
  while (ctx.measureText(displayName).width > CARD_SIZE - 120 && displayName.length > 3)
    displayName = displayName.slice(0, -1);
  if (displayName !== brandName) displayName += '...';

  ctx.fillText(displayName, CARD_SIZE / 2, textY);

  // "Made with Geekspace" subtitle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Made with Geekspace', CARD_SIZE / 2, textY + 60);

  // Subtle violet line separator
  const lineY = textY - 30;
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CARD_SIZE * 0.3, lineY);
  ctx.lineTo(CARD_SIZE * 0.7, lineY);
  ctx.stroke();
}

export function ShareCard({ logoUrl, brandName, onShare }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const renderCard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !logoUrl) return;

    setRendering(true);
    setError('');
    try {
      await renderShareCard(canvas, logoUrl, brandName);
      setRendered(true);
      // Create preview data URL for display
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to render share card';
      setError(message);
    } finally {
      setRendering(false);
    }
  }, [logoUrl, brandName]);

  // Render on mount and when logoUrl/brandName changes
  useEffect(() => {
    if (logoUrl) {
      renderCard();
    }
  }, [renderCard, logoUrl]);

  const getShareText = () =>
    `Check out the logo I just created for ${brandName}! Made with Geekspace Logo Studio`;

  const handleWhatsAppShare = async () => {
    onShare?.();
    const text = getShareText();
    const url = SHARE_URL;

    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // User cancelled or share API failed, fall through to link
      }
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `${brandName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-share-card.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' } as const;
  const strokeProps = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return (
    <div className="rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] p-5">
      <h3 className="text-xs uppercase tracking-[0.15em] text-[var(--ag-text-muted)] font-medium mb-4">
        Share Your Logo
      </h3>

      {error && <p className="text-xs text-red-400/80 mb-3">{error}</p>}

      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Card preview */}
      <div className="mb-4">
        {rendering && (
          <div className="flex items-center justify-center py-12 rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-base)]">
            <Spinner />
            <span className="ml-2 text-sm text-white/40">Rendering card...</span>
          </div>
        )}

        {rendered && previewUrl && !rendering && (
          <div className="rounded-xl overflow-hidden border border-[var(--ag-border-subtle)]">
            <img
              src={previewUrl}
              alt={`Share card for ${brandName}`}
              className="w-full h-auto"
            />
          </div>
        )}

        {!rendered && !rendering && !error && (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-base)]">
            <p className="text-xs text-white/20 mb-3">
              {logoUrl
                ? 'Preparing share card...'
                : 'Select a logo to generate a share card'}
            </p>
            {logoUrl && (
              <button
                onClick={renderCard}
                className="min-h-[44px] px-4 py-1.5 rounded-lg text-[11px] font-medium bg-violet-600/80 hover:bg-violet-600 text-white cursor-pointer"
              >
                Generate Card
              </button>
            )}
          </div>
        )}
      </div>

      {/* Share buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* WhatsApp Share - primary CTA */}
        <button
          onClick={handleWhatsAppShare}
          disabled={!rendered}
          className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-[#25D366] hover:bg-[#22c55e] text-white flex items-center justify-center gap-2"
        >
          <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.11-1.14l-.29-.174-3.01.79.81-2.96-.19-.3A7.96 7.96 0 014 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8z" />
          </svg>
          Share on WhatsApp
        </button>

        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:bg-[var(--ag-bg-surface-hover)] flex items-center justify-center gap-2"
        >
          <svg {...iconProps}>
            {linkCopied ? (
              <path d="M5 12l5 5L20 7" {...strokeProps} />
            ) : (
              <path
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                {...strokeProps}
              />
            )}
          </svg>
          {linkCopied ? 'Link Copied!' : 'Copy Link'}
        </button>

        {/* Download Card */}
        <button
          onClick={handleDownloadCard}
          disabled={!rendered}
          className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--ag-edith,#8B5CF6)] to-[#7C3AED] hover:opacity-90 text-white flex items-center justify-center gap-2"
        >
          <svg {...iconProps}>
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17h16" {...strokeProps} />
          </svg>
          Download Card
        </button>
      </div>
    </div>
  );
}
