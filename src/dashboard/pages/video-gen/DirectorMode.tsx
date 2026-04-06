import { useState } from 'react';
import { SectionCard } from '@/components/agentin';
import { videoService } from '@/services/api';
import type { DirectorJob } from '@/services/api';
import {
  Wand2, Sparkles, Loader2, AlertCircle, AlertTriangle,
  RefreshCw, Film, Download, Copy, Check, X, Play,
} from 'lucide-react';

interface DirectorModeProps {
  directorIdea: string;
  onIdeaChange: (v: string) => void;
  directorRunning: boolean;
  expandingIdea: boolean;
  queuedIdea: string | null;
  onCancelQueue: () => void;
  directorJob: DirectorJob | null;
  directorJobs: DirectorJob[];
  directorError: string | null;
  jobHistoryFilter: 'all' | 'done' | 'failed';
  onJobHistoryFilterChange: (f: 'all' | 'done' | 'failed') => void;
  stitching: boolean;
  stitchResult: { url: string | null; clipUrls: string[]; softStitch: boolean } | null;
  onExpandIdea: () => void;
  onSubmit: () => void;
  onStitch: () => void;
  onRerun: () => void;
  onSelectJob: (job: DirectorJob) => void;
  onReuseIdea: (idea: string) => void;
  onRetryClip: (index: number) => void;
  directorJobId: string | null;
}

export function DirectorMode({
  directorIdea,
  onIdeaChange,
  directorRunning,
  expandingIdea,
  queuedIdea,
  onCancelQueue,
  directorJob,
  directorJobs,
  directorError,
  jobHistoryFilter,
  onJobHistoryFilterChange,
  stitching,
  stitchResult,
  onExpandIdea,
  onSubmit,
  onStitch,
  onRerun,
  onSelectJob,
  onReuseIdea,
  onRetryClip,
  directorJobId,
}: DirectorModeProps) {
  // Clip preview modal — internal UI state
  const [previewClip, setPreviewClip] = useState<{ url: string; index: number } | null>(null);
  const [copiedClipUrl, setCopiedClipUrl] = useState(false);

  return (
    <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[var(--ag-gold)]/15 flex items-center justify-center">
          <Wand2 className="w-4 h-4 text-[var(--ag-gold)]" />
        </div>
        <div>
          <h2 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">
            Director Mode{' '}
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--ag-violet)]/15 text-[var(--ag-violet)] ml-1">
              fal.ai Seedance
            </span>
          </h2>
          <p className="text-xs text-[var(--ag-text-secondary)]">
            One idea → AI director packet → 6 clips × 5s (750 credits)
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Idea input row */}
        <div className="flex gap-3">
          <input
            value={directorIdea}
            onChange={(e) => onIdeaChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            placeholder="e.g. A lone astronaut discovering an alien city at sunset"
            maxLength={500}
            className="flex-1 px-4 py-3 min-h-[44px] rounded-xl bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] text-sm placeholder-[var(--ag-text-muted)]/60 focus:outline-none focus:border-[var(--ag-violet)]/30"
          />
          {/* Expand with AI */}
          <button
            onClick={onExpandIdea}
            disabled={!directorIdea.trim() || expandingIdea}
            title="Expand idea with AI"
            className="flex items-center gap-1.5 px-3 py-3 min-h-[44px] rounded-xl bg-[#8B5CF6]/10 border border-[rgba(139,92,246,0.15)] hover:bg-[#8B5CF6]/20 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--ag-violet)] text-xs transition-colors active:scale-[0.96]"
          >
            {expandingIdea ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            {expandingIdea ? '' : 'Expand'}
          </button>
          <button
            onClick={onSubmit}
            disabled={!directorIdea.trim()}
            className="flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all active:scale-[0.96] shadow-lg shadow-[var(--ag-violet)]/20"
          >
            {directorRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {directorRunning ? 'Queue' : 'Direct'}
          </button>
        </div>

        {/* Queued job indicator */}
        {queuedIdea && (
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#8B5CF6]/10 border border-[var(--ag-violet)]/20 text-xs text-[var(--ag-violet)]"
            data-testid="queued-idea-banner"
          >
            <span className="truncate flex-1 mr-2">
              ⏳ Queued: <span className="text-[#D8B4FE]">{queuedIdea}</span>
            </span>
            <button
              onClick={onCancelQueue}
              className="shrink-0 hover:text-[var(--ag-text-primary)] transition-colors"
              title="Cancel queued job"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error */}
        {directorError && (
          <div className="flex items-center gap-2 text-xs text-[#FF6161] bg-[#FF6161]/10 border border-[#FF6161]/20 px-3 py-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {directorError}
          </div>
        )}

        {/* Active job progress */}
        {directorJob && (
          <div className="rounded-xl border border-[var(--ag-violet)]/15 bg-[var(--ag-violet)]/5 p-4 space-y-3">
            {directorJob.packet && (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--ag-text-primary)]">{directorJob.packet.title}</p>
                <p className="text-xs text-[var(--ag-violet)]">{directorJob.packet.genre}</p>
                <p className="text-xs text-[var(--ag-text-muted)]">{directorJob.packet.styleGuide}</p>
              </div>
            )}

            {directorJob.status === 'running' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[var(--ag-violet)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {directorJob.packet?.shotlist && directorJob.packet.shotlist.length > 0 ? (
                    <span>
                      Clips: <strong>{directorJob.clips.length}</strong>
                      /{directorJob.packet.shotlist.length} complete
                      {directorJob.clips.length === 0 && ' — waiting for first clip…'}
                    </span>
                  ) : (
                    <span>Generating clips… this takes 2-4 minutes</span>
                  )}
                </div>
                {directorJob.packet?.shotlist && directorJob.packet.shotlist.length > 0 && (
                  <div className="w-full bg-[#8B5CF6]/10 rounded-full h-1.5">
                    <div
                      className="bg-[#8B5CF6] h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          (directorJob.clips.length / directorJob.packet.shotlist.length) * 100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Clip grid */}
            {directorJob.clips.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {directorJob.clips.map((clip, i) => {
                  const shot = directorJob.packet?.shotlist?.[i];
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div
                        className={`relative rounded-lg overflow-hidden aspect-video bg-[var(--ag-bg-surface)] border transition-all ${
                          clip.success
                            ? 'border-[var(--ag-violet)]/10 cursor-pointer hover:border-[var(--ag-violet)]/40 hover:scale-[1.02]'
                            : 'border-[var(--ag-error)]/20'
                        }`}
                        onClick={() =>
                          clip.success && clip.url && setPreviewClip({ url: clip.url, index: i })
                        }
                        title={
                          shot
                            ? `${shot.cameraMove} — ${shot.prompt}`
                            : clip.success
                            ? 'Click to preview'
                            : undefined
                        }
                      >
                        {clip.success ? (
                          <>
                            <video
                              src={clip.url}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              autoPlay
                              playsInline
                            />
                            <div className="absolute bottom-1 left-1 text-xs text-white/60 bg-black/40 px-1 rounded">
                              {i + 1}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                              <Play className="w-6 h-6 text-white drop-shadow" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#FF6161]">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs">Failed</span>
                            {/* Per-clip retry */}
                            {directorJob.status === 'done' && directorJobId && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await videoService.directorRetryClip(directorJobId, i);
                                    onRetryClip(i);
                                  } catch {
                                    // parent handles toast
                                  }
                                }}
                                className="text-xs px-1.5 py-0.5 rounded bg-[#FF6161]/20 hover:bg-[#FF6161]/40 text-[#FF6161] transition-colors"
                                data-testid={`retry-clip-${i}`}
                              >
                                ↻ Retry
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Shot prompt label */}
                      {shot && (
                        <p
                          className="text-xs text-[var(--ag-text-muted)] leading-tight truncate px-0.5"
                          title={shot.prompt}
                        >
                          <span className="text-[var(--ag-violet)]/60">{shot.cameraMove}</span>{' '}
                          {shot.prompt}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Failed job restart */}
            {(directorJob.status as string) === 'failed' && (
              <div className="flex items-center gap-3 rounded-lg border border-[#FF6161]/30 bg-[#FF6161]/5 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-[#FF6161] flex-shrink-0" />
                <span className="text-xs text-[#FF6161] flex-1">Director job failed</span>
                <button
                  onClick={onRerun}
                  disabled={directorRunning}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#FF6161]/30 text-[#FF6161] hover:bg-[#FF6161]/10 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restart Job
                </button>
              </div>
            )}

            {/* Stitch bar — shown when job is done */}
            {directorJob.status === 'done' && directorJob.clips.length > 0 && (
              <div className="space-y-2">
                {stitchResult ? (
                  <div className="rounded-xl border border-[var(--ag-violet)]/30 bg-[var(--ag-violet)]/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-[var(--ag-violet)]">
                      {stitchResult.url ? 'Stitched Video Ready' : 'Clip URLs Ready (soft stitch)'}
                    </p>
                    {stitchResult.url ? (
                      <div className="space-y-2">
                        <video
                          src={stitchResult.url}
                          controls
                          className="w-full rounded-lg border border-[var(--ag-violet)]/30 max-h-48 bg-black"
                          preload="metadata"
                        />
                        <a
                          href={stitchResult.url}
                          download="stitched.mp4"
                          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[var(--ag-violet)]/30 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 transition-colors w-fit"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Stitched Video
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {stitchResult.clipUrls.map((u, idx) => (
                          <a
                            key={idx}
                            href={u}
                            download={`clip-${idx + 1}.mp4`}
                            className="text-xs text-[var(--ag-violet)]/70 hover:text-[var(--ag-violet)] underline truncate"
                          >
                            Clip {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {directorJob.clips.some((c) => !c.success) && (
                      <p className="text-xs text-amber-400">
                        {directorJob.clips.filter((c) => c.success).length}/
                        {directorJob.clips.length} clips succeeded — stitch will use successful clips only
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onStitch}
                        disabled={stitching || !directorJob.clips.some((c) => c.success)}
                        data-testid="stitch-btn"
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[var(--ag-violet)]/30 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 disabled:opacity-50 transition-colors"
                      >
                        {stitching ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Film className="w-3.5 h-3.5" />
                        )}
                        {stitching
                          ? 'Stitching…'
                          : directorJob.clips.some((c) => !c.success)
                          ? 'Partial Stitch'
                          : 'Stitch Clips'}
                      </button>
                      {stitching && (
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--ag-bg-surface)] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] animate-pulse rounded-full"
                            style={{ width: '60%' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <button
                  onClick={onRerun}
                  disabled={directorRunning}
                  data-testid="rerun-director-btn"
                  className="flex items-center gap-1.5 text-xs text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Rerun with same idea
                </button>
              </div>
            )}

            {/* Clip preview modal */}
            {previewClip && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={(e) => { if (e.target === e.currentTarget) setPreviewClip(null); }}
              >
                <div className="relative w-full max-w-2xl bg-[var(--ag-bg-surface)] rounded-2xl border border-[var(--ag-violet)]/30 overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ag-violet)]/15">
                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">
                      Clip {previewClip.index + 1}
                      {' — '}
                      {directorJob.packet?.shotlist?.[previewClip.index]?.prompt ?? 'Director Mode clip'}
                    </p>
                    <button
                      onClick={() => setPreviewClip(null)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50"
                      aria-label="Close clip preview"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <video
                    key={previewClip.url}
                    src={previewClip.url}
                    className="w-full aspect-video bg-black"
                    controls
                    autoPlay
                    loop
                  />
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--ag-violet)]/15">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(previewClip.url).catch(() => {});
                        setCopiedClipUrl(true);
                        setTimeout(() => setCopiedClipUrl(false), 2000);
                      }}
                      className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[var(--ag-violet)]/30 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 transition-colors"
                    >
                      {copiedClipUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedClipUrl ? 'Copied!' : 'Copy URL'}
                    </button>
                    <a
                      href={previewClip.url}
                      download={`clip-${previewClip.index + 1}.mp4`}
                      className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[var(--ag-border-subtle)] text-[var(--ag-text-muted)] hover:border-[var(--ag-border-subtle)]/80 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                    {previewClip.index > 0 && (
                      <button
                        onClick={() =>
                          setPreviewClip({
                            url: directorJob.clips[previewClip.index - 1].url!,
                            index: previewClip.index - 1,
                          })
                        }
                        className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-[var(--ag-cyan)]/20 text-[var(--ag-cyan)]/70 hover:text-[var(--ag-cyan)] transition-colors"
                      >
                        ← Prev
                      </button>
                    )}
                    {previewClip.index < directorJob.clips.length - 1 && (
                      <button
                        onClick={() =>
                          setPreviewClip({
                            url: directorJob.clips[previewClip.index + 1].url!,
                            index: previewClip.index + 1,
                          })
                        }
                        className={`text-xs px-3 py-1.5 rounded-lg border border-[var(--ag-cyan)]/20 text-[var(--ag-cyan)]/70 hover:text-[var(--ag-cyan)] transition-colors ${
                          previewClip.index === 0 ? 'ml-auto' : ''
                        }`}
                      >
                        Next →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Past director jobs */}
        {directorJobs.length > 0 && !directorJob && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--ag-text-muted)] font-medium">Recent Director Jobs</p>
              <div className="flex items-center gap-1">
                {(['all', 'done', 'failed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => onJobHistoryFilterChange(f)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                      jobHistoryFilter === f
                        ? 'bg-[#8B5CF6]/15 border-[var(--ag-violet)]/50 text-[var(--ag-violet)]'
                        : 'border-[var(--ag-violet)]/10 text-[var(--ag-text-muted)] hover:text-[var(--ag-violet)]'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {directorJobs
              .filter((j) => jobHistoryFilter === 'all' || j.status === jobHistoryFilter)
              .slice(0, 3)
              .map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--ag-violet)]/10 bg-[var(--ag-violet)]/5"
                >
                  <button
                    onClick={() => onSelectJob(job)}
                    className="flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    <p className="text-xs font-medium text-[var(--ag-text-primary)]">
                      {job.packet?.title ?? job.idea.slice(0, 50)}
                    </p>
                    <p className="text-xs text-[var(--ag-text-muted)]">
                      {job.clips.filter((c) => c.success).length}/{job.clips.length} clips ·{' '}
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </button>
                  {/* Re-use idea */}
                  <button
                    onClick={() => onReuseIdea(job.idea)}
                    className="flex-shrink-0 p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--ag-violet)]/50 hover:text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                    aria-label="Use this idea again"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
