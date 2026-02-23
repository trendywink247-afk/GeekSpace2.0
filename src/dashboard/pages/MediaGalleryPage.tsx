// ============================================================
// Media Gallery Page - Browse generated images/videos
// ============================================================

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { MediaGallery, type MediaItem } from '@/components/MediaGallery';

export function MediaGalleryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load media from localStorage
  useEffect(() => {
    const loadMedia = () => {
      setIsLoading(true);
      try {
        const stored = localStorage.getItem('geekspace-generated-media');
        if (stored) {
          setItems(JSON.parse(stored));
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
    localStorage.setItem('geekspace-generated-media', JSON.stringify(updated));
  };

  const handleFavorite = (id: string, isFavorite: boolean) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, isFavorite } : item
    );
    setItems(updated);
    localStorage.setItem('geekspace-generated-media', JSON.stringify(updated));
  };

  const handleDownload = async (item: MediaItem) => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `geekspace-${item.type}-${item.id}.${item.type === 'image' ? 'png' : 'mp4'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
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
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Media Gallery
          </h1>
          <p className="text-[#6B7280]">
            All your generated images and videos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30">
            <span className="text-sm text-[#00F0FF]">
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#00F0FF]/10 flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-[#00F0FF]" />
          </div>
          <h3 className="text-lg font-medium text-[#E8E8F0] mb-2">No media yet</h3>
          <p className="text-[#6B7280] max-w-sm mb-6">
            Generate your first image or video using the agent chat. They'll appear here automatically.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-agent-chat'))}
            className="px-6 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#00D4B0] text-white font-medium transition-colors"
          >
            Open Agent Chat
          </button>
        </div>
      )}
    </div>
  );
}
