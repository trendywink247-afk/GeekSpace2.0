// ── RecentCreations — videos generation tab + combined gallery tab ────────────
// Discriminated union: mode='videos' | mode='gallery'
import { Loader2, Film, Sparkles, RefreshCw, Send, Play, Clock, Trash2, Download } from 'lucide-react';
import type { UserVideo } from '@/services/api';
import { MediaGallery, type MediaItem } from '@/components/MediaGallery';
import { SectionCard } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';

// ── Prop shapes ───────────────────────────────────────────────────────────────
type VideosMode = {
  mode: 'videos';
  vidPrompt: string;
  vidGenerating: boolean;
  directorMode: boolean;
  directorRunning: boolean;
  videos: UserVideo[];
  vidLoading: boolean;
  onPromptChange: (v: string) => void;
  onDirectorToggle: () => void;
  onGenerate: () => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onPreview: (vid: UserVideo) => void;
};

type GalleryMode = {
  mode: 'gallery';
  galleryItems: MediaItem[];
  galleryLoading: boolean;
  onDelete: (id: string) => void;
  onFavorite: (id: string, isFavorite: boolean) => void;
  onDownload: (item: MediaItem) => void;
  onRefresh: () => void;
  onStartCreating: () => void;
};

export type RecentCreationsProps = VideosMode | GalleryMode;

// ── Component ─────────────────────────────────────────────────────────────────
export function RecentCreations(props: RecentCreationsProps) {
  if (props.mode === 'videos') return <VideosSection {...props} />;
  return <GallerySection {...props} />;
}

// ── Videos sub-section ────────────────────────────────────────────────────────
function VideosSection({
  vidPrompt, vidGenerating, directorMode, directorRunning,
  videos, vidLoading, onPromptChange, onDirectorToggle,
  onGenerate, onRefresh, onDelete, onPreview,
}: VideosMode) {
  return (
    <div className="space-y-6">
      {/* Generator prompt card */}
      <SectionCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-heading font-medium text-[var(--ag-text-primary)]">
              <Film className="w-4 h-4 text-[var(--ag-violet)]" />
              Generate Video
            </div>
            <button
              onClick={onDirectorToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.96] min-h-[44px] ${
                directorMode
                  ? 'bg-[#8B5CF6]/15 text-[var(--ag-violet)] border border-[rgba(139,92,246,0.15)]'
                  : 'bg-[rgba(12,12,30,0.6)] text-[var(--ag-text-secondary)] border border-transparent hover:text-[var(--ag-text-primary)]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Director Mode
            </button>
          </div>

          <textarea
            value={vidPrompt}
            onChange={e => onPromptChange(e.target.value)}
            placeholder={directorMode
              ? 'Describe your video concept — AI will create a multi-shot storyboard...'
              : 'Describe the video you want to create...'
            }
            rows={3}
            className="w-full bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-sm text-[var(--ag-text-primary)] placeholder-[#6B7280] resize-none focus:outline-none focus:border-[rgba(139,92,246,0.15)] transition-colors"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate(); }}
          />

          {directorMode && (
            <p className="text-xs text-[var(--ag-violet)]/70 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Director Mode generates a multi-shot storyboard and stitches clips together automatically.
            </p>
          )}

          <button
            onClick={onGenerate}
            disabled={!vidPrompt.trim() || vidGenerating || directorRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] text-white font-medium text-sm transition-all active:scale-[0.96] shadow-lg shadow-[var(--ag-violet)]/20 hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {vidGenerating || directorRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {directorRunning ? 'Directing...' : 'Generating...'}</>
            ) : (
              <><Send className="w-4 h-4" /> {directorMode ? 'Start Director' : 'Generate'}</>
            )}
          </button>
        </div>
      </SectionCard>

      {/* Recent videos grid */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">Recent Videos</h3>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-[#8B5CF6]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {vidLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--ag-violet)] animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-[rgba(139,92,246,0.15)]">
            <Film className="w-10 h-10 text-[var(--ag-violet)]/30 mb-3" />
            <p className="text-sm text-[var(--ag-text-secondary)]">No videos yet. Generate your first one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((vid, idx) => (
              <BlurFade key={vid.id} delay={idx * 0.04} inView>
                <div className="group relative rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_4px_20px_rgba(139,92,246,0.1)] bg-[var(--ag-bg-surface)] backdrop-blur-xl transition-[box-shadow] duration-200">
                  <div className="aspect-video relative">
                    {vid.status === 'processing' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--ag-bg-surface)]">
                        <Loader2 className="w-8 h-8 text-[var(--ag-violet)] animate-spin mb-2" />
                        <span className="text-xs text-[var(--ag-text-secondary)]">Processing...</span>
                      </div>
                    ) : (
                      <video
                        src={vid.video_url}
                        className="w-full h-full object-cover cursor-pointer"
                        muted
                        preload="metadata"
                        onClick={() => onPreview(vid)}
                      />
                    )}
                    {vid.status === 'ready' && (
                      <div
                        className="absolute inset-0 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                        onClick={() => onPreview(vid)}
                      >
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-6 h-6 text-white ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-[var(--ag-text-secondary)] line-clamp-2 mb-2">{vid.prompt}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--ag-text-muted)] font-variant-numeric tabular-nums">
                        <Clock className="w-3 h-3" />
                        {new Date(vid.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onDelete(vid.id)}
                          className="p-2 rounded-lg text-[var(--ag-text-muted)] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors active:scale-[0.96] min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {vid.status === 'ready' && (
                          <a
                            href={vid.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-[var(--ag-text-muted)] hover:text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 transition-colors active:scale-[0.96] min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Gallery sub-section ───────────────────────────────────────────────────────
function GallerySection({
  galleryItems, galleryLoading, onDelete, onFavorite, onDownload, onRefresh, onStartCreating,
}: GalleryMode) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--ag-text-secondary)]">
          <span className="px-2 py-1 rounded bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] text-xs">
            {galleryItems.filter(i => i.type === 'image').length} images
          </span>
          <span className="px-2 py-1 rounded bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)] text-xs">
            {galleryItems.filter(i => i.type === 'video').length} videos
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg hover:bg-[var(--ag-violet)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {galleryLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[var(--ag-violet)] animate-spin" />
        </div>
      ) : galleryItems.length === 0 ? (
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--ag-violet)]/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-[var(--ag-violet)]/40" />
            </div>
            <h3 className="text-base font-heading font-medium text-[var(--ag-text-primary)] mb-2">No media yet</h3>
            <p className="text-[var(--ag-text-secondary)] text-sm max-w-xs mb-6">
              Generate your first image or video using the tabs above.
            </p>
            <button
              onClick={onStartCreating}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] text-white font-medium text-sm transition-all active:scale-[0.96] shadow-lg shadow-[var(--ag-violet)]/20 hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 min-h-[44px]"
            >
              Start Creating
            </button>
          </div>
        </SectionCard>
      ) : (
        <MediaGallery
          items={galleryItems}
          onDelete={onDelete}
          onFavorite={onFavorite}
          onDownload={onDownload}
        />
      )}
    </div>
  );
}
