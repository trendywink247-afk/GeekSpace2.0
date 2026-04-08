import { useState, useEffect, useCallback, useRef } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { Film, AlertCircle, AlertTriangle, ImageIcon, Sparkles, Trash2 } from 'lucide-react';
import { videoService, picoService, agentService } from '@/services/api';
import type { UserVideo, VideoModel, DirectorJob } from '@/services/api';
import {
  GenerateForm, VideoGallery, DirectorMode,
  VideoPreviewModal, VideoModelsPanel, AgentPickerDropdown,
  type FleetAgent, BROKEN_VIDEO_PROVIDERS,
} from './video-gen';

export function VideoGenPage() {
  // ── Video generation ────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [models, setModels] = useState<VideoModel[]>([]);
  const [duration, setDuration] = useState(5);

  // ── Gallery ─────────────────────────────────────────────────
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [videoCount, setVideoCount] = useState(0);
  const [maxVideos, setMaxVideos] = useState(5);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [gallerySort, setGallerySort] = useState<'newest' | 'status'>('newest');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<UserVideo | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Director Mode ────────────────────────────────────────────
  const [directorIdea, setDirectorIdea] = useState('');
  const [directorRunning, setDirectorRunning] = useState(false);
  const [expandingIdea, setExpandingIdea] = useState(false);
  const [queuedIdea, setQueuedIdea] = useState<string | null>(null);
  const [directorJobId, setDirectorJobId] = useState<string | null>(null);
  const [directorJob, setDirectorJob] = useState<DirectorJob | null>(null);
  const [directorJobs, setDirectorJobs] = useState<DirectorJob[]>([]);
  const [jobHistoryFilter, setJobHistoryFilter] = useState<'all' | 'done' | 'failed'>('all');
  const [directorError, setDirectorError] = useState<string | null>(null);
  const directorPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStitchFiredRef = useRef(false);
  const [stitching, setStitching] = useState(false);
  const [stitchResult, setStitchResult] = useState<{
    url: string | null; clipUrls: string[]; softStitch: boolean;
  } | null>(null);

  // ── Fleet agent ──────────────────────────────────────────────
  const [assignedAgent, setAssignedAgent] = useState<FleetAgent | null>(null);
  const [fleetAgents, setFleetAgents] = useState<FleetAgent[]>([]);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agentLoading, setAgentLoading] = useState(true);

  // ── Video models panel ───────────────────────────────────────
  const [videoModels, setVideoModels] = useState<Array<{
    id: string; name: string; description: string; cost: string; credits: number; tier: string;
  }>>([]);
  const [videoModelStatuses, setVideoModelStatuses] = useState<Record<string, 'ok' | 'down' | 'unknown'>>({});
  const [preferredVideoModel, setPreferredVideoModel] = useState('auto');
  const [savingVideoModel, setSavingVideoModel] = useState<string | null>(null);
  const [showVideoModelsPanel, setShowVideoModelsPanel] = useState(false);

  // ── Misc UI ──────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'forge', page: 'video-gen' });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const isProviderBroken =
    !selectedModel || BROKEN_VIDEO_PROVIDERS.some((p) => selectedModel === p || selectedModel.includes(p));

  // ── Data loading ─────────────────────────────────────────────
  const loadGallery = useCallback(async () => {
    try {
      const res = await videoService.list();
      setVideos(res.data.videos); setVideoCount(res.data.count); setMaxVideos(res.data.max);
    } catch { /* silently fail */ } finally { setGalleryLoading(false); }
  }, []);

  const loadModels = useCallback(async () => {
    try { const res = await videoService.getModels(); setModels(res.data.models); } catch { /* */ }
  }, []);

  const loadFleet = useCallback(async () => {
    try {
      const res = await picoService.getAgents();
      setFleetAgents(res.data);
      const savedSlot = localStorage.getItem('vg_assigned_agent');
      if (savedSlot) {
        const agent = res.data.find((a: FleetAgent) => a.slot === parseInt(savedSlot, 10));
        if (agent) setAssignedAgent(agent);
      }
    } catch { /* */ } finally { setAgentLoading(false); }
  }, []);

  const loadDirectorJobs = useCallback(async () => {
    try { const res = await videoService.directorList(); setDirectorJobs(res.data.jobs); } catch { /* */ }
  }, []);

  useEffect(() => {
    loadGallery(); loadModels(); loadFleet();
    videoService.getModels().then((r) => setVideoModels(r.data.models)).catch(() => {});
    videoService.getModelStatus().then((r) => setVideoModelStatuses(r.data.statuses)).catch(() => {});
    agentService.getConfig().then((r) => { if (r.data.preferred_video_model) setPreferredVideoModel(r.data.preferred_video_model); }).catch(() => {});
    void loadDirectorJobs();
  }, [loadGallery, loadModels, loadFleet, loadDirectorJobs]);

  useEffect(() => {
    if (assignedAgent) localStorage.setItem('vg_assigned_agent', String(assignedAgent.slot));
    else localStorage.removeItem('vg_assigned_agent');
  }, [assignedAgent]);

  // Poll processing videos
  useEffect(() => {
    const processing = videos.filter((v) => v.status === 'processing');
    if (!processing.length) { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } return; }
    pollingRef.current = setInterval(async () => {
      let changed = false;
      for (const vid of processing) {
        try { const r = await videoService.checkStatus(vid.id); if (r.data.status === 'ready') changed = true; } catch { /* */ }
      }
      if (changed) loadGallery();
    }, 10000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [videos, loadGallery]);

  // Poll active director job
  useEffect(() => {
    if (!directorJobId) return;
    if (directorPollRef.current) clearInterval(directorPollRef.current);
    directorPollRef.current = setInterval(async () => {
      try {
        const res = await videoService.directorGet(directorJobId);
        setDirectorJob(res.data);
        if (res.data.status === 'done' || res.data.status === 'failed') {
          clearInterval(directorPollRef.current!); directorPollRef.current = null; setDirectorRunning(false);
          showToast(res.data.status === 'done' ? 'Director Mode complete!' : (res.data.error || 'Director Mode failed'), res.data.status === 'done' ? 'success' : 'error');
          void loadDirectorJobs();
        }
      } catch { /* */ }
    }, 4000);
    return () => { if (directorPollRef.current) clearInterval(directorPollRef.current); };
  }, [directorJobId, loadDirectorJobs]);

  // Auto-stitch when all clips succeed
  useEffect(() => {
    if (directorJob?.status === 'done' && directorJob.clips.length > 0 && directorJob.clips.every((c) => c.success) && !stitchResult && !stitching && !autoStitchFiredRef.current && directorJobId) {
      autoStitchFiredRef.current = true;
      const tid = setTimeout(() => {
        void (async () => {
          setStitching(true);
          try {
            const res = await videoService.directorStitch(directorJobId);
            setStitchResult({ url: res.data.stitchedUrl, clipUrls: res.data.clipUrls, softStitch: res.data.softStitch });
            if (res.data.stitchedUrl) showToast('Auto-stitch complete! Download your video below.');
          } catch { /* */ } finally { setStitching(false); }
        })();
      }, 1500);
      return () => clearTimeout(tid);
    }
  }, [directorJob, stitchResult, stitching, directorJobId]);

  // Auto-start queued job
  useEffect(() => {
    if (!directorRunning && queuedIdea) {
      const idea = queuedIdea; setQueuedIdea(null); setDirectorIdea(idea);
      const tid = setTimeout(() => { void handleDirectorSubmit(idea); }, 800);
      return () => clearTimeout(tid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directorRunning]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (isProviderBroken) { showToast('Video generation temporarily unavailable — credits not charged.', 'error'); return; }
    setGenerating(true); void notifyStart('Video generation');
    try {
      const res = await videoService.generate(prompt, selectedModel, 1280, 720, duration);
      showToast(`Video generating! Est. ${res.data.estimated_time || 30}s.`);
      setPrompt(''); await loadGallery(); void notifyDone(`Video generation started (${selectedModel})`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Video generation failed';
      showToast(`${msg} — credits not charged.`, 'error'); void notifyFail(msg);
    } finally { setGenerating(false); }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await videoService.delete(id); showToast('Video deleted'); await loadGallery();
      if (previewVideo?.id === id) setPreviewVideo(null); void notifyDone('Video deleted');
    } catch { showToast('Failed to delete', 'error'); void notifyFail('Failed to delete video');
    } finally { setIsDeleting(false); setDeleteConfirmId(null); }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefreshStatus = async (id: string) => {
    try {
      const res = await videoService.checkStatus(id);
      if (res.data.status === 'ready') { showToast('Video is ready!'); await loadGallery(); }
      else showToast('Still processing... please wait.', 'error');
    } catch { showToast('Failed to check status', 'error'); }
  };

  const handleDirectorSubmit = async (overrideIdea?: string) => {
    const idea = overrideIdea ?? directorIdea.trim();
    if (!idea) return;
    if (directorRunning) { setQueuedIdea(idea); setDirectorIdea(''); showToast('Queued! Starts when current job finishes.'); return; }
    setDirectorRunning(true); setDirectorError(null); setDirectorJob(null); autoStitchFiredRef.current = false;
    void notifyStart('Director Mode pipeline');
    try {
      const res = await videoService.directorCreate(idea);
      setDirectorJobId(res.data.jobId); showToast('Director Mode started — generating 6 clips…'); void notifyDone('Director Mode pipeline started');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Director Mode failed to start';
      setDirectorError(msg); setDirectorRunning(false); showToast(msg, 'error'); void notifyFail(msg);
    }
  };

  const handleStitch = async () => {
    if (!directorJobId) return;
    setStitching(true); setStitchResult(null);
    try {
      const res = await videoService.directorStitch(directorJobId);
      setStitchResult({ url: res.data.stitchedUrl, clipUrls: res.data.clipUrls, softStitch: res.data.softStitch });
      showToast(res.data.stitchedUrl ? 'Stitch complete!' : 'Soft stitch: clip URLs ready.');
    } catch { showToast('Stitch failed — try again', 'error');
    } finally { setStitching(false); }
  };

  const handleRerun = () => {
    if (!directorIdea.trim()) return;
    setDirectorJob(null); setDirectorJobId(null); setStitchResult(null); autoStitchFiredRef.current = false;
    void handleDirectorSubmit();
  };

  const handleSetDefaultVideoModel = async (id: string) => {
    setSavingVideoModel(id);
    try { await agentService.setVideoModel(id); setPreferredVideoModel(id); } catch { /* */ } finally { setSavingVideoModel(null); }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <PageShell>
        <div className="space-y-6 pb-24 md:pb-6 overflow-x-hidden">

          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-page-enter ${
              toast.type === 'success' ? 'bg-[#ADFF2F]/10 text-[#ADFF2F] border border-[#ADFF2F]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {toast.text}
            </div>
          )}

          {/* Video Preview Modal */}
          {previewVideo && (
            <VideoPreviewModal
              video={previewVideo}
              copiedId={copiedId}
              onCopyId={handleCopyId}
              onClose={() => setPreviewVideo(null)}
            />
          )}

          {/* Header */}
          <BlurFade delay={0.1}>
            <PageHeader
              icon={Film}
              title="Video Generator"
              subtitle={`Create AI-powered short clips · ${videoCount}/${maxVideos} saved`}
              badge={
                <span className="relative flex h-2.5 w-2.5" title="Forge agent">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ag-gold)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--ag-gold)]" />
                </span>
              }
              actions={
                <AgentPickerDropdown
                  assignedAgent={assignedAgent}
                  fleetAgents={fleetAgents}
                  agentLoading={agentLoading}
                  showPicker={showAgentPicker}
                  onToggle={() => setShowAgentPicker((p) => !p)}
                  onAssign={(agent) => { setAssignedAgent(agent); setShowAgentPicker(false); }}
                  onUnassign={() => { setAssignedAgent(null); setShowAgentPicker(false); }}
                />
              }
            />
          </BlurFade>

          {/* Provider unavailability notice */}
          {isProviderBroken && (
            <BlurFade delay={0.2}>
              <div className="relative overflow-hidden rounded-2xl border border-[var(--ag-amber)]/30 bg-gradient-to-br from-[var(--ag-amber)]/5 via-[var(--ag-bg-base)] to-[var(--ag-amber)]/3 p-6 bg-[var(--ag-bg-surface)] backdrop-blur-xl">
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[var(--ag-amber)]/6 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--ag-amber)]/15 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-8 h-8 text-[var(--ag-amber)]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-[var(--ag-text-primary)]">Video generation is temporarily unavailable</h3>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--ag-amber)]/20 text-[var(--ag-amber)] border border-[var(--ag-amber)]/30 font-semibold">Service Notice</span>
                    </div>
                    <p className="text-sm text-[var(--ag-text-secondary)] font-medium">Your credits were not charged.</p>
                    <p className="text-sm text-[var(--ag-text-secondary)] mt-2">
                      Free video providers (Pollinations, SeedAnce, Veo2) are currently unavailable from this server region.
                      Paid generation via OpenRouter is available if you add your API key.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-xs text-[var(--ag-text-secondary)]">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--ag-amber)]" />
                        <span>OpenRouter video models available with API key</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/20 text-xs text-[#00FF88]">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Image generation works fine — try that instead!</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </BlurFade>
          )}

          {/* Generate Form */}
          <BlurFade delay={0.3}>
            <GenerateForm
              prompt={prompt} onPromptChange={setPrompt}
              generating={generating}
              selectedModel={selectedModel} onModelChange={setSelectedModel}
              models={models}
              duration={duration} onDurationChange={setDuration}
              videoCount={videoCount} maxVideos={maxVideos}
              isProviderBroken={isProviderBroken}
              onGenerate={handleGenerate}
            />
          </BlurFade>

          {/* Gallery */}
          <VideoGallery
            videos={videos} videoCount={videoCount} maxVideos={maxVideos}
            galleryLoading={galleryLoading}
            gallerySort={gallerySort} onSortChange={setGallerySort}
            copiedId={copiedId}
            onPreview={setPreviewVideo} onCopyId={handleCopyId}
            onRequestDelete={setDeleteConfirmId} onRefreshStatus={handleRefreshStatus}
          />

          {/* Director Mode */}
          <BlurFade delay={0.6}>
            <DirectorMode
              directorIdea={directorIdea} onIdeaChange={setDirectorIdea}
              directorRunning={directorRunning} expandingIdea={expandingIdea}
              queuedIdea={queuedIdea} onCancelQueue={() => setQueuedIdea(null)}
              directorJob={directorJob} directorJobs={directorJobs}
              directorError={directorError}
              jobHistoryFilter={jobHistoryFilter} onJobHistoryFilterChange={setJobHistoryFilter}
              stitching={stitching} stitchResult={stitchResult}
              onExpandIdea={async () => {
                if (!directorIdea.trim() || expandingIdea) return;
                setExpandingIdea(true);
                try { const r = await videoService.directorExpandIdea(directorIdea.trim()); setDirectorIdea(r.data.expanded); }
                catch { /* keep original */ } finally { setExpandingIdea(false); }
              }}
              onSubmit={() => void handleDirectorSubmit()} onStitch={handleStitch} onRerun={handleRerun}
              onSelectJob={(job) => { setDirectorJob(job); setDirectorJobId(job.id); }}
              onReuseIdea={setDirectorIdea}
              onRetryClip={(i) => showToast(`Retrying clip ${i + 1}…`)}
              directorJobId={directorJobId}
            />
          </BlurFade>

          {/* Available Video Models */}
          <BlurFade delay={0.7}>
            <VideoModelsPanel
              videoModels={videoModels} videoModelStatuses={videoModelStatuses}
              preferredVideoModel={preferredVideoModel} savingVideoModel={savingVideoModel}
              showPanel={showVideoModelsPanel} onToggle={() => setShowVideoModelsPanel((p) => !p)}
              onSetDefault={handleSetDefaultVideoModel}
            />
          </BlurFade>

          {/* Usage info */}
          <BlurFade delay={0.8}>
            <SectionCard padding="sm" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
              <div className="flex items-start gap-3 p-1">
                <AlertCircle className="w-4 h-4 text-[var(--ag-text-secondary)] shrink-0 mt-0.5" />
                <div className="text-xs text-[var(--ag-text-secondary)] space-y-1">
                  <p>Videos are saved for <strong className="text-[var(--ag-text-primary)]">24 hours</strong> then automatically deleted.</p>
                  <p>Generation takes <strong className="text-[var(--ag-text-primary)]">30-120 seconds</strong>. The page auto-polls for readiness.</p>
                  <p>Maximum <strong className="text-[var(--ag-text-primary)]">{maxVideos} videos</strong> at a time. Delete old ones to make room.</p>
                  <p>Use <strong className="text-[var(--ag-text-primary)]">Copy ID</strong> to reference videos in other tools.</p>
                </div>
              </div>
            </SectionCard>
          </BlurFade>

          {/* Delete confirmation modal */}
          {deleteConfirmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" data-testid="delete-confirm-modal">
              <div className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-error)]/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--ag-error)]/10 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-[var(--ag-error)]" />
                  </div>
                  <div>
                    <h3 className="text-base font-heading font-semibold text-[var(--ag-text-primary)]">Delete video?</h3>
                    <p className="text-xs text-[var(--ag-text-muted)]">This action cannot be undone.</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--ag-text-muted)] mb-5">The video will be permanently removed from your gallery.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirmId(null)} disabled={isDeleting} className="flex-1 py-2 px-4 min-h-[44px] rounded-xl border border-[var(--ag-border-subtle)] text-sm text-[var(--ag-text-muted)] hover:bg-[var(--ag-bg-surface)] transition-colors disabled:opacity-50" data-testid="delete-confirm-cancel">Cancel</button>
                  <button onClick={() => void handleDelete(deleteConfirmId)} disabled={isDeleting} className="flex-1 py-2 px-4 min-h-[44px] rounded-xl bg-[var(--ag-error)]/15 border border-[var(--ag-error)]/30 text-sm text-[var(--ag-error)] hover:bg-[var(--ag-error)]/25 transition-colors disabled:opacity-50 font-medium" data-testid="delete-confirm-ok">
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
