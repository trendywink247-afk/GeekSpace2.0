// ============================================================
// Media Gallery Page - Browse generated images/videos
// ============================================================

import { useState, useEffect } from 'react';
import { Sparkles, Film } from 'lucide-react';
import { MediaGallery, type MediaItem } from '@/components/MediaGallery';

export function MediaGalleryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load media from localStorage
  useEffect(() => {
    const loadMedia = () => {
      setIsLoading(true);
      try {
        const stored = localStorage.getItem('agentin-generated-media');
        if (stored) {
          try { setItems(JSON.parse(stored)); } catch { /* corrupted cache — ignore */ }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadMedia();
  }, []);

  const handleDelete = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    localStorage.setItem('agentin-generated-media', JSON.stringify(updated));
  };

  const handleFavorite = (id: string, isFavorite: boolean) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, isFavorite } : item
    );
    setItems(updated);
    localStorage.setItem('agentin-generated-media', JSON.stringify(updated));
  };

  const handleDownload = async (item: MediaItem) => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentin-${item.type}-${item.id}.${item.type === 'image' ? 'png' : 'mp4'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      // download failure — user sees no download
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center">
            <Film className="w-5 h-5 text-[#00F0FF]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#E8E8F0]">
              Media Gallery
            </h1>
            <p className="text-sm text-[#9CA3AF]">
              All your generated images and videos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/20">
            <span className="text-sm text-[#00F0FF] font-medium">
              {items.length} items
            </span>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <MediaGallery
        items={items}
        onDelete={handleDelete}
        onFavorite={handleFavorite}
        onDownload={handleDownload}
      />

      {/* Empty State */}
      {items.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[#00F0FF]/15">
          <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/10 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-[#00F0FF]/40" />
          </div>
          <h3 className="text-base font-medium text-[#E8E8F0] mb-2">No media yet</h3>
          <p className="text-[#9CA3AF] text-sm max-w-xs mb-6">
            Generate your first image or video using the agent chat. They will appear here automatically.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-agent-chat'))}
            className="glow-hover px-5 py-2.5 rounded-xl bg-[#00F0FF] text-[#06060B] font-medium text-sm transition-all hover:bg-[#00F0FF]/90"
          >
            Open Agent Chat
          </button>
        </div>
      )}
    </div>
  );
}
