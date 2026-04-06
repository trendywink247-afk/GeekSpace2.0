import { BlurFade } from '@/components/magicui/blur-fade';
import type { UserVideo } from '@/services/api';
import { Film, Clock } from 'lucide-react';
import { VideoCard } from './VideoCard';

interface VideoGalleryProps {
  videos: UserVideo[];
  videoCount: number;
  maxVideos: number;
  galleryLoading: boolean;
  gallerySort: 'newest' | 'status';
  onSortChange: (sort: 'newest' | 'status') => void;
  copiedId: string | null;
  onPreview: (vid: UserVideo) => void;
  onCopyId: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRefreshStatus: (id: string) => void;
}

export function VideoGallery({
  videos,
  videoCount,
  maxVideos,
  galleryLoading,
  gallerySort,
  onSortChange,
  copiedId,
  onPreview,
  onCopyId,
  onRequestDelete,
  onRefreshStatus,
}: VideoGalleryProps) {
  const sorted = [...videos].sort((a, b) => {
    if (gallerySort === 'status') {
      const order: Record<string, number> = { ready: 0, processing: 1 };
      return (order[a.status] ?? 2) - (order[b.status] ?? 2);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <BlurFade delay={0.4}>
      <div>
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-semibold text-[var(--ag-text-primary)] flex items-center gap-2">
            <Film className="w-5 h-5 text-[var(--ag-gold)]" />
            Your Videos
            <span className="text-xs text-[var(--ag-text-muted)] font-normal ml-1">
              {videoCount}/{maxVideos}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {/* Sort toggle */}
            <div className="flex items-center rounded-lg border border-[var(--ag-cyan)]/15 bg-[var(--ag-bg-surface)] p-0.5 gap-0.5">
              <button
                onClick={() => onSortChange('newest')}
                className={`text-xs px-2.5 py-1 rounded transition-all ${
                  gallerySort === 'newest'
                    ? 'bg-[#A78BFA]/15 text-[var(--ag-cyan)] border-b-2 border-[var(--ag-cyan)]'
                    : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'
                }`}
              >
                Newest
              </button>
              <button
                onClick={() => onSortChange('status')}
                className={`text-xs px-2.5 py-1 rounded transition-all ${
                  gallerySort === 'status'
                    ? 'bg-[#A78BFA]/15 text-[var(--ag-cyan)] border-b-2 border-[var(--ag-cyan)]'
                    : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'
                }`}
              >
                Status
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--ag-text-muted)]">
              <Clock className="w-3 h-3" />
              Expire 24h
            </div>
          </div>
        </div>

        {/* Body */}
        {galleryLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[rgba(139,92,246,0.08)] p-12 text-center">
            <Film className="w-10 h-10 text-[#F59E0B]/30 mx-auto mb-3" />
            <p className="text-[var(--ag-text-muted)] text-sm">No videos yet.</p>
            <p className="text-[var(--ag-text-muted)] text-xs mt-1">
              Describe what you want above and start generating!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((vid, index) => (
              <VideoCard
                key={vid.id}
                vid={vid}
                index={index}
                copiedId={copiedId}
                onCopyId={onCopyId}
                onRequestDelete={onRequestDelete}
                onRefreshStatus={onRefreshStatus}
                onPreview={onPreview}
              />
            ))}
          </div>
        )}
      </div>
    </BlurFade>
  );
}
