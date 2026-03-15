// ============================================================
// Image Gallery Page — Phase 81 + CreativeCore polish
// Masonry grid, hover overlays, date range filter
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { Download, ImageIcon, RefreshCw, Loader2, Trash2, ZoomIn, X, Calendar } from 'lucide-react';
import { imageService, type UserImage } from '@/services/api';

export function ImageGalleryPage() {
  const [images, setImages] = useState<UserImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<UserImage | null>(null);
  const [filter, setFilter] = useState<'all' | 'generated' | 'edited'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  const loadGallery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await imageService.list();
      setImages(res.data.images);
    } catch {
      setError('Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await imageService.delete(id);
      setImages(prev => prev.filter(img => img.id !== id));
      if (lightboxImage?.id === id) setLightboxImage(null);
    } catch {
      // silently fail
    }
  };

  useEffect(() => { loadGallery(); }, []);

  const filteredImages = useMemo(() => {
    return images.filter(img => {
      // Source filter
      if (filter === 'generated' && img.source === 'edited') return false;
      if (filter === 'edited' && img.source !== 'edited') return false;
      // Date range filter
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (new Date(img.created_at) < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(img.created_at) > toDate) return false;
      }
      return true;
    });
  }, [images, filter, dateFrom, dateTo]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-[#00F0FF]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#E8E8F0]">Image Gallery</h1>
            <p className="text-xs text-[#9CA3AF]">Your last 30 generated images</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter pills */}
          <div className="flex items-center gap-1 bg-[#0C0C18] border border-[#00F0FF]/15 rounded-lg p-0.5">
            {(['all', 'generated', 'edited'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  filter === f
                    ? 'bg-[#00F0FF]/15 text-[#00F0FF] border-b-2 border-[#00F0FF]'
                    : 'text-[#9CA3AF] hover:text-[#E8E8F0]'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {/* Date filter toggle */}
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              showDateFilter || dateFrom || dateTo
                ? 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF]'
                : 'bg-[#0C0C18] border-[#00F0FF]/15 text-[#9CA3AF] hover:text-[#E8E8F0]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {dateFrom || dateTo ? 'Filtered' : 'Date'}
          </button>
          <button
            onClick={loadGallery}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-xs text-[#00F0FF] hover:bg-[#00F0FF]/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date range filter panel */}
      {showDateFilter && (
        <div className="flex items-center gap-3 flex-wrap px-1 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#9CA3AF]">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-[#0C0C18] border border-[#00F0FF]/15 rounded-lg px-3 py-1.5 text-xs text-[#E8E8F0] outline-none focus:border-[#00F0FF]/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#9CA3AF]">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-[#0C0C18] border border-[#00F0FF]/15 rounded-lg px-3 py-1.5 text-xs text-[#E8E8F0] outline-none focus:border-[#00F0FF]/40"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-[#FF6161] hover:text-[#FF6161]/80 transition-colors"
            >
              Clear dates
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#00F0FF]" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && filteredImages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center rounded-2xl border border-dashed border-[#00F0FF]/15">
          <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/10 flex items-center justify-center mb-1">
            <ImageIcon className="w-8 h-8 text-[#00F0FF]/40" />
          </div>
          <p className="text-[#E8E8F0] text-sm font-medium">No images yet</p>
          <p className="text-[#9CA3AF] text-xs max-w-xs">
            Generate some with AI using the Image Generator page. Your creations will appear here.
          </p>
        </div>
      )}

      {!loading && filteredImages.length > 0 && (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-4">
          {filteredImages.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-xl overflow-hidden border border-[#00F0FF]/10 bg-[#06060B] hover:border-[#00F0FF]/40 hover:shadow-[0_0_12px_rgba(0,240,255,0.1)] transition-all cursor-pointer mb-4"
              style={{ breakInside: 'avoid' }}
              onClick={() => setLightboxImage(img)}
            >
              <div className="bg-[#0A0A1A]">
                <img
                  src={img.image_url}
                  alt={img.prompt || 'Generated image'}
                  className="w-full h-auto object-cover transition-transform group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              {/* Hover overlay with download + delete actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                {/* Top action buttons */}
                <div className="flex items-center justify-end gap-1.5">
                  <a
                    href={img.image_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#00F0FF]/90 text-[#06060B] hover:bg-[#00F0FF] transition-colors shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Download image"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDelete(img.id); }}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#FF6161]/80 text-white hover:bg-[#FF6161] transition-colors shadow-lg"
                    aria-label="Delete image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/* Center zoom icon */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                    <ZoomIn className="w-5 h-5 text-white" />
                  </div>
                </div>
                {/* Bottom info */}
                <div>
                  <p className="text-xs text-[#E8E8F0] line-clamp-2 mb-1">{img.prompt ?? ''}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#9CA3AF]">
                      {new Date(img.created_at).toLocaleDateString()}
                    </span>
                    {img.width && img.height && (
                      <span className="text-[10px] text-[#9CA3AF]/60">{img.width}x{img.height}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Bottom bar: always visible with prompt + download (touch-friendly on mobile) */}
              <div className="px-2.5 py-2 border-t border-[#00F0FF]/10 flex items-center justify-between gap-1 sm:group-hover:opacity-0 transition-opacity">
                <p className="text-xs text-[#9CA3AF] truncate flex-1">{img.prompt ?? ''}</p>
                <a
                  href={img.image_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] text-[#00F0FF] hover:text-[#00F0FF]/80 active:text-[#00F0FF]/80 transition-colors flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Download image"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[#9CA3AF] truncate flex-1 mr-4">
                {lightboxImage.prompt}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#00F0FF] text-[#06060B] font-medium text-sm hover:bg-[#00F0FF]/90 transition-colors"
                  aria-label="Download image"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <button
                  onClick={() => { void handleDelete(lightboxImage.id); }}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#0C0C18] border border-[#FF6161]/20 text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors"
                  aria-label="Delete image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#9CA3AF] hover:text-[#E8E8F0] transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={lightboxImage.image_url}
              alt={lightboxImage.prompt || 'Generated image'}
              className="w-full rounded-2xl border border-[#00F0FF]/20"
              loading="lazy"
            />
            <div className="flex items-center gap-3 mt-3 text-xs text-[#9CA3AF]">
              {lightboxImage.width && lightboxImage.height && (
                <span>{lightboxImage.width}x{lightboxImage.height}</span>
              )}
              <span>{lightboxImage.model}</span>
              <span>{new Date(lightboxImage.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
