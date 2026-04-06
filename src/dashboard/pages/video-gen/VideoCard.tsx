import { BlurFade } from '@/components/magicui/blur-fade';
import type { UserVideo } from '@/services/api';
import {
  Clock, Copy, Check, Trash2, Play, Loader2, RefreshCw,
} from 'lucide-react';
import { LazyVideo } from './LazyVideo';
import { timeLeft } from './helpers';

interface VideoCardProps {
  vid: UserVideo;
  index: number;
  copiedId: string | null;
  onCopyId: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRefreshStatus: (id: string) => void;
  onPreview: (vid: UserVideo) => void;
}

export function VideoCard({
  vid,
  index,
  copiedId,
  onCopyId,
  onRequestDelete,
  onRefreshStatus,
  onPreview,
}: VideoCardProps) {
  return (
    <BlurFade key={vid.id} delay={0.5 + index * 0.05}>
      <div className="group rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_4px_20px_rgba(139,92,246,0.1)] overflow-hidden transition-[box-shadow,transform] duration-200 bg-[var(--ag-bg-surface)] backdrop-blur-xl">

        {/* Video / Processing placeholder */}
        <div
          className="aspect-video cursor-pointer relative bg-[var(--ag-bg-base)]"
          onClick={() => onPreview(vid)}
        >
          {vid.status === 'ready' ? (
            <>
              <LazyVideo src={vid.video_url} className="w-full h-full object-cover" />
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Play className="w-6 h-6 text-white ml-0.5" />
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-[var(--ag-cyan)] animate-spin" />
              <span className="text-xs text-[var(--ag-text-muted)]">Processing...</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRefreshStatus(vid.id); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--ag-violet)] hover:bg-[#8B5CF6]/10 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Check status
              </button>
            </div>
          )}

          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white font-mono tabular-nums">
            {vid.duration}s
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-xs text-[var(--ag-text-primary)] truncate mb-1.5">{vid.prompt}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[var(--ag-text-muted)]" />
              <span className="text-xs text-[var(--ag-text-muted)]">{timeLeft(vid.expires_at)}</span>
            </div>
            <div className="flex gap-1">
              {/* Copy ID */}
              <button
                onClick={() => onCopyId(vid.id)}
                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                aria-label={`Copy ID: ${vid.id}`}
              >
                {copiedId === vid.id ? (
                  <Check className="w-3.5 h-3.5 text-[#00FF88]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              {/* Delete */}
              <button
                onClick={() => onRequestDelete(vid.id)}
                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--ag-text-muted)] hover:text-[var(--ag-error)] hover:bg-[var(--ag-error)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                aria-label="Delete video"
                data-testid={`delete-video-${vid.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Model & status badge */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              vid.status === 'ready'
                ? 'bg-[#00FF88]/10 text-[#00FF88]'
                : 'bg-[#8B5CF6]/10 text-[var(--ag-violet)]'
            }`}>
              {vid.status === 'ready' ? 'Ready' : 'Processing'}
            </span>
            <span className="text-xs text-[var(--ag-text-muted)]">{vid.model}</span>
          </div>
        </div>
      </div>
    </BlurFade>
  );
}
