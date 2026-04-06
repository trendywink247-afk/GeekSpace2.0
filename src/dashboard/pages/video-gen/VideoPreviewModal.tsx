import React from 'react';
import type { UserVideo } from '@/services/api';
import { Download, X, Loader2, Check, Copy } from 'lucide-react';

interface VideoPreviewModalProps {
  video: UserVideo;
  copiedId: string | null;
  onCopyId: (id: string) => void;
  onClose: () => void;
}

export function VideoPreviewModal({ video, copiedId, onCopyId, onClose }: VideoPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-[var(--ag-text-muted)] truncate flex-1 mr-4">
            {video.prompt}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={video.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-cyan)]/20 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50"
              aria-label="Download video"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-cyan)]/20 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video or processing state */}
        {video.status === 'ready' ? (
          <video
            src={video.video_url}
            controls
            autoPlay
            className="w-full rounded-2xl border border-[var(--ag-cyan)]/20 bg-[var(--ag-bg-base)] shadow-[0_0_30px_rgba(139,92,246,0.08)]"
            style={{ colorScheme: 'dark' }}
          />
        ) : (
          <div className="w-full aspect-video rounded-2xl border border-[var(--ag-cyan)]/20 bg-[var(--ag-bg-base)] flex flex-col items-center justify-center gap-4 p-6">
            <Loader2 className="w-8 h-8 text-[var(--ag-cyan)] animate-spin" />
            <div className="flex items-center gap-1.5 text-xs">
              {(['Queued', 'Generating', 'Rendering', 'Ready'] as const).map((step, i) => (
                <React.Fragment key={step}>
                  <span className={
                    i === 1 ? 'text-[var(--ag-cyan)] font-semibold'
                    : i < 1  ? 'text-[#00FF88]'
                    : 'text-[var(--ag-text-muted)]'
                  }>
                    {step}
                  </span>
                  {i < 3 && <span className="text-[var(--ag-text-muted)]">→</span>}
                </React.Fragment>
              ))}
            </div>
            <p className="text-xs text-[var(--ag-text-muted)]">30–120s depending on model &amp; duration</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--ag-text-muted)]">{video.width}x{video.height}</span>
            <span className="text-xs text-[var(--ag-text-muted)]">{video.duration}s</span>
            <span className="text-xs text-[var(--ag-text-muted)]">{video.model}</span>
          </div>
          <button
            onClick={() => onCopyId(video.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-cyan)]/20 text-xs text-[var(--ag-text-muted)] hover:text-[var(--ag-cyan)] transition-colors"
          >
            {copiedId === video.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedId === video.id ? 'Copied!' : video.id}
          </button>
        </div>
      </div>
    </div>
  );
}
