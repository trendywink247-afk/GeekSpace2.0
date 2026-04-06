// ============================================================
// ImagePreviewModal — full-screen lightbox for a single image
// ============================================================

import { Check, Copy, Download, MessageCircle, X } from 'lucide-react';
import type { UserImage } from '@/services/api';

interface ImagePreviewModalProps {
  image:     UserImage;
  copiedId:  string | null;
  onClose:   () => void;
  onCopyId:  (id: string) => void;
}

export function ImagePreviewModal({ image, copiedId, onClose, onCopyId }: ImagePreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-[var(--ag-text-secondary)] truncate flex-1 mr-4">
            {image.prompt}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={image.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] text-white font-medium text-sm hover:bg-[#7C3AED] transition-colors"
              aria-label="Download image"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent('Check out what I created with Agentin! ' + image.image_url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 py-2 min-w-[44px] min-h-[44px] bg-[#25D366]/20 text-[#25D366] rounded-lg hover:bg-[#25D366]/30 transition-colors font-medium text-sm"
              aria-label="Share on WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            <button
              onClick={onClose}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <img
          src={image.image_url}
          alt={image.prompt ?? 'Generated image'}
          className="w-full rounded-2xl shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_8px_32px_rgba(0,0,0,0.5)] outline outline-1 -outline-offset-1 outline-white/10"
          loading="lazy"
        />

        {/* Footer row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {image.width && image.height && (
              <span className="text-xs text-[var(--ag-text-secondary)]">
                {image.width}x{image.height}
              </span>
            )}
            <span className="text-xs text-[var(--ag-text-secondary)]">{image.model}</span>
          </div>
          <button
            onClick={() => onCopyId(image.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] transition-colors"
          >
            {copiedId === image.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedId === image.id ? 'Copied!' : image.id}
          </button>
        </div>
      </div>
    </div>
  );
}
