// @deprecated — DEAD CODE confirmed by Sprint 1 audit 2026-03-26. Not imported in DashboardApp.tsx. Safe to delete.
// ============================================================
// Media Gallery Page - Browse generated images/videos from DB
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Film, RefreshCw } from 'lucide-react';
import { MediaGallery, type MediaItem } from '@/components/MediaGallery';
import { imageService, videoService } from '@/services/api';

export function MediaGalleryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMedia = useCallback(async () => {
    setIsLoading(true);
    try {
      const [imagesRes, videosRes] = await Promise.allSettled([
        imageService.list(),
        videoService.list(),
      ]);

      const images: MediaItem[] =
        imagesRes.status === 'fulfilled'
          ? (imagesRes.value.data.images || []).map((img) => ({
              id: img.id,
              type: 'image' as const,
              url: img.image_url,
              prompt: img.prompt,
              createdAt: img.created_at,
              isFavorite: false,
              metadata: { width: img.width, height: img.height },
            }))
          : [];

      const videos: MediaItem[] =
        videosRes.status === 'fulfilled'
          ? (videosRes.value.data.videos || [])
              .filter((v) => v.status === 'ready')
              .map((vid) => ({
                id: vid.id,
                type: 'video' as const,
                url: vid.video_url,
                prompt: vid.prompt,
                createdAt: vid.created_at,
                isFavorite: false,
                metadata: { width: vid.width, height: vid.height },
              }))
          : [];

      const combined = [...images, ...videos].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setItems(combined);
    } catch {
      // Silently fail — empty state shown
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Optimistic removal
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      if (item.type === 'image') {
        await imageService.delete(id);
      } else {
        await videoService.delete(id);
      }
    } catch {
      // Revert on failure
      loadMedia();
    }
  };

  const handleFavorite = (id: string, isFavorite: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavorite } : item))
    );
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
      // download failure
    }
  };

  const imageCount = items.filter((i) => i.type === 'image').length;
  const videoCount = items.filter((i) => i.type === 'video').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center">
            <Film className="w-5 h-5 text-[#00F0FF]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#E8E8F0]">Media Gallery</h1>
            <p className="text-sm text-[#9CA3AF]">
              All your generated images and videos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <span className="px-2 py-1 rounded bg-[#00F0FF]/10 text-[#00F0FF]">
              {imageCount} images
            </span>
            <span className="px-2 py-1 rounded bg-[#8B5CF6]/10 text-[#8B5CF6]">
              {videoCount} videos
            </span>
          </div>
          <button
            onClick={loadMedia}
            className="p-2 rounded-lg hover:bg-[#00F0FF]/10 text-[#6B7280] hover:text-[#00F0FF] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
