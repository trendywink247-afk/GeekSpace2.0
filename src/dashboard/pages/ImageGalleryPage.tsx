// ============================================================
// Image Gallery Page — Phase 81
// Displays last 30 user-generated images in a responsive grid
// with prompt text, timestamp, and download button.
// ============================================================

import { useState, useEffect } from 'react';
import { Download, ImageIcon, RefreshCw, Loader2 } from 'lucide-react';
import { imageAsyncService, type ImageGalleryItem } from '@/services/api';

export function ImageGalleryPage() {
  const [images, setImages] = useState<ImageGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGallery = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await imageAsyncService.gallery();
      setImages(data.images);
    } catch {
      setError('Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGallery(); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/20 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-[#A78BFA]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#E8E8F0]">Image Gallery</h1>
            <p className="text-xs text-[#6B7280]">Your last 30 generated images</p>
          </div>
        </div>
        <button
          onClick={loadGallery}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-[#A78BFA]/30 text-xs text-[#A78BFA] hover:bg-[#A78BFA]/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#A78BFA]" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && images.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <ImageIcon className="w-10 h-10 text-[#6B7280]/40" />
          <p className="text-[#6B7280] text-sm">No images yet.</p>
          <p className="text-[#6B7280]/60 text-xs">
            Type <code className="bg-[#1a1a2e] px-1.5 py-0.5 rounded text-[#A78BFA]">/image [prompt]</code> in chat to generate one.
          </p>
        </div>
      )}

      {!loading && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-xl overflow-hidden border border-[#A78BFA]/20 bg-[#06060B] hover:border-[#A78BFA]/50 transition-all"
            >
              <div className="aspect-square bg-[#0A0A1A]">
                <img
                  src={img.image_url}
                  alt={img.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-xs text-[#E8E8F0] line-clamp-2 mb-1">{img.prompt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6B7280]">
                    {new Date(img.created_at).toLocaleDateString()}
                  </span>
                  <a
                    href={img.image_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-3 h-3" /> Save
                  </a>
                </div>
              </div>
              {/* Bottom label always visible */}
              <div className="px-2 py-1.5 border-t border-[#A78BFA]/10">
                <p className="text-[10px] text-[#6B7280] truncate">{img.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
