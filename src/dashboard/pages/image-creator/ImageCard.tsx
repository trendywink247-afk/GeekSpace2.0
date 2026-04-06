// ============================================================
// ImageCard — single generated image card
//   variant="grid"    → used in quick-gallery preview (generate tab)
//   variant="masonry" → used in full gallery tab
// ============================================================

import { Clock, Download, MessageCircle, Trash2, ZoomIn } from 'lucide-react';
import type { UserImage } from '@/services/api';
import { timeLeft } from './helpers';

interface ImageCardProps {
  img:       UserImage;
  variant:   'grid' | 'masonry';
  onPreview: (img: UserImage) => void;
  onDelete:  (id: string) => Promise<void> | void;
}

// ---- Shimmer placeholder (exported so Page can use it in loading states) ----
export function ShimmerCard() {
  return (
    <div className="rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] overflow-hidden animate-pulse">
      <div className="aspect-square bg-[var(--ag-bg-elevated)]" />
      <div className="p-3 space-y-2">
        <div className="h-3 rounded bg-[var(--ag-bg-elevated)] w-3/4" />
        <div className="h-3 rounded bg-[var(--ag-bg-elevated)] w-1/2" />
      </div>
    </div>
  );
}

// ---- Grid variant ----
function GridCard({ img, onPreview, onDelete }: Omit<ImageCardProps, 'variant'>) {
  return (
    <div className="group relative rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_4px_20px_rgba(139,92,246,0.12)] overflow-hidden transition-[box-shadow,transform] duration-200 active:scale-[0.98] bg-[var(--ag-bg-surface)]">
      {/* Image */}
      <div
        className="aspect-square cursor-pointer relative"
        onClick={() => onPreview(img)}
      >
        <img
          src={img.image_url}
          alt={img.prompt ?? 'Generated image'}
          className="w-full h-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn className="w-5 h-5 text-white" />
        </div>
        <a
          href={img.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#8B5CF6]/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#7C3AED] z-10"
          onClick={(e) => e.stopPropagation()}
          aria-label="Download image"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Bottom bar */}
      <div className="p-3">
        <p className="text-xs text-[var(--ag-text-primary)] truncate mb-1">{img.prompt}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[var(--ag-text-secondary)]" />
            <span className="text-xs text-[var(--ag-text-secondary)]">{timeLeft(img.expires_at)}</span>
          </div>
          <button
            onClick={() => void onDelete(img.id)}
            className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--ag-text-secondary)] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors"
            aria-label="Delete image"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Masonry variant ----
function MasonryCard({ img, onPreview, onDelete }: Omit<ImageCardProps, 'variant'>) {
  return (
    <div
      className="group relative rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_4px_20px_rgba(139,92,246,0.12)] transition-[box-shadow,transform] duration-200 active:scale-[0.98] cursor-pointer mb-4"
      style={{ breakInside: 'avoid' }}
      onClick={() => onPreview(img)}
    >
      {/* Image */}
      <div className="bg-[var(--ag-bg-surface)]">
        <img
          src={img.image_url}
          alt={img.prompt ?? 'Generated image'}
          className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.03] outline outline-1 -outline-offset-1 outline-white/10"
          loading="lazy"
        />
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
        {/* Top action row */}
        <div className="flex items-center justify-end gap-1.5">
          <a
            href={img.image_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#8B5CF6]/90 text-white hover:bg-[#7C3AED] transition-colors shadow-lg"
            onClick={(e) => e.stopPropagation()}
            aria-label="Download image"
          >
            <Download className="w-4 h-4" />
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent('Check out what I created with Agentin! ' + img.image_url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#25D366]/80 text-white hover:bg-[#25D366] transition-colors shadow-lg"
            onClick={(e) => e.stopPropagation()}
            aria-label="Share on WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); void onDelete(img.id); }}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#FF6161]/80 text-white hover:bg-[#FF6161] transition-colors shadow-lg"
            aria-label="Delete image"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Centre zoom hint */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <ZoomIn className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Bottom meta */}
        <div>
          <p className="text-xs text-[var(--ag-text-primary)] line-clamp-2 mb-1">{img.prompt ?? ''}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ag-text-secondary)]">
              {new Date(img.created_at).toLocaleDateString()}
            </span>
            {img.width && img.height && (
              <span className="text-[10px] text-[var(--ag-text-secondary)]/60">
                {img.width}x{img.height}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Always-visible bottom bar (hidden on hover on ≥sm) */}
      <div className="px-2.5 py-2 border-t border-[var(--ag-border-subtle)] flex items-center justify-between gap-1 sm:group-hover:opacity-0 transition-opacity">
        <p className="text-xs text-[var(--ag-text-secondary)] truncate flex-1">{img.prompt ?? ''}</p>
        <a
          href={img.image_url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center min-w-[44px] min-h-[44px] text-[var(--ag-violet)] hover:text-[var(--ag-violet)]/80 transition-colors flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          aria-label="Download image"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

// ---- Public export ----
export function ImageCard({ variant, ...rest }: ImageCardProps) {
  if (variant === 'masonry') return <MasonryCard {...rest} />;
  return <GridCard {...rest} />;
}
