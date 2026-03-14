import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Film, Sparkles, Send, Loader2, Trash2, Copy, Check,
  Clock, Bot, Wifi, WifiOff, Wand2, ChevronDown,
  Download, X, Play, AlertCircle, RefreshCw, AlertTriangle
} from 'lucide-react';
import { videoService, picoService, agentService } from '@/services/api';
import type { UserVideo, VideoModel, DirectorJob } from '@/services/api';

// ---- Fleet agent type ----
interface FleetAgent {
  id: string;
  slot: number;
  name: string;
  personality: string;
  status: string;
  tasks_completed: number;
}

const statusColor: Record<string, string> = {
  active: '#00FF88',
  idle: '#6B7280',
  disabled: '#FF6161',
};

// 61.7: Lazy-load video thumbnails via IntersectionObserver
function LazyVideo({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !el.src) {
          el.src = src;
          setLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-[#0C0C18] animate-pulse" />
      )}
      <video
        ref={videoRef}
        className={className}
        muted
        preload="none"
      />
    </div>
  );
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}

export function VideoGenPage() {
  // Video generation state
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [models, setModels] = useState<VideoModel[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [duration, setDuration] = useState(5);

  // Gallery state
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [videoCount, setVideoCount] = useState(0);
  const [maxVideos, setMaxVideos] = useState(5);
  const [galleryLoading, setGalleryLoading] = useState(true);
  // 58.9: gallery sort
  const [gallerySort, setGallerySort] = useState<'newest' | 'status'>('newest');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<UserVideo | null>(null);

  // Polling for processing videos
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 55.13: Director Mode state ─────────────────────────────
  const [directorIdea, setDirectorIdea] = useState('');
  const [directorRunning, setDirectorRunning] = useState(false);
  // 65.13: Expand idea — AI enrichment of the director idea
  const [expandingIdea, setExpandingIdea] = useState(false);
  // 59.13: Multi-job queue — holds next idea to auto-start when current job finishes
  const [queuedIdea, setQueuedIdea] = useState<string | null>(null);
  const [directorJobId, setDirectorJobId] = useState<string | null>(null);
  const [directorJob, setDirectorJob] = useState<DirectorJob | null>(null);
  const [directorJobs, setDirectorJobs] = useState<DirectorJob[]>([]);
  // 66.11: Job history status filter
  const [jobHistoryFilter, setJobHistoryFilter] = useState<'all' | 'done' | 'failed'>('all');
  const [directorError, setDirectorError] = useState<string | null>(null);
  const directorPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 58.13: prevent double-triggering auto-stitch
  const autoStitchFiredRef = useRef(false);
  // 56.13: Clip preview modal
  const [previewClip, setPreviewClip] = useState<{ url: string; index: number } | null>(null);
  const [copiedClipUrl, setCopiedClipUrl] = useState(false);
  // 57.13: stitch progress + result
  const [stitching, setStitching] = useState(false);
  const [stitchResult, setStitchResult] = useState<{ url: string | null; clipUrls: string[]; softStitch: boolean } | null>(null);

  // Agent state
  const [assignedAgent, setAssignedAgent] = useState<FleetAgent | null>(null);
  const [fleetAgents, setFleetAgents] = useState<FleetAgent[]>([]);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agentLoading, setAgentLoading] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [videoModels, setVideoModels] = useState<Array<{ id: string; name: string; description: string; cost: string; credits: number; tier: string }>>([]);
  const [videoModelStatuses, setVideoModelStatuses] = useState<Record<string, 'ok' | 'down' | 'unknown'>>({});
  const [preferredVideoModel, setPreferredVideoModel] = useState<string>('auto');
  const [savingVideoModel, setSavingVideoModel] = useState<string | null>(null);
  const [showVideoModelsPanel, setShowVideoModelsPanel] = useState(false);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // Load gallery
  const loadGallery = useCallback(async () => {
    try {
      const res = await videoService.list();
      setVideos(res.data.videos);
      setVideoCount(res.data.count);
      setMaxVideos(res.data.max);
    } catch {
      // silently fail — UI shows empty gallery
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  // Load models
  const loadModels = useCallback(async () => {
    try {
      const res = await videoService.getModels();
      setModels(res.data.models);
    } catch {
      // silently fail — model picker stays hidden
    }
  }, []);

  // Load fleet agent
  const loadFleet = useCallback(async () => {
    try {
      const res = await picoService.getAgents();
      setFleetAgents(res.data);
      const savedSlot = localStorage.getItem('vg_assigned_agent');
      if (savedSlot) {
        const agent = res.data.find((a: FleetAgent) => a.slot === parseInt(savedSlot, 10));
        if (agent) setAssignedAgent(agent);
      }
    } catch {
      // silently fail — agent section shows empty state
    } finally {
      setAgentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGallery();
    loadModels();
    loadFleet();
    videoService.getModels().then(res => setVideoModels(res.data.models)).catch(() => {});
    videoService.getModelStatus().then(res => setVideoModelStatuses(res.data.statuses)).catch(() => {});
    agentService.getConfig().then(res => {
      const pref = res.data.preferred_video_model;
      if (pref) setPreferredVideoModel(pref);
    }).catch(() => {});
  }, [loadGallery, loadModels, loadFleet]);

  // Save assigned agent to localStorage
  useEffect(() => {
    if (assignedAgent) {
      localStorage.setItem('vg_assigned_agent', String(assignedAgent.slot));
    } else {
      localStorage.removeItem('vg_assigned_agent');
    }
  }, [assignedAgent]);

  // Poll for processing videos
  useEffect(() => {
    const processingVideos = videos.filter(v => v.status === 'processing');
    if (processingVideos.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      let changed = false;
      for (const vid of processingVideos) {
        try {
          const res = await videoService.checkStatus(vid.id);
          if (res.data.status === 'ready') changed = true;
        } catch { /* non-fatal */ }
      }
      if (changed) loadGallery();
    }, 10000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [videos, loadGallery]);

  // ── 55.13: Director Mode logic ─────────────────────────────

  const loadDirectorJobs = useCallback(async () => {
    try {
      const res = await videoService.directorList();
      setDirectorJobs(res.data.jobs);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void loadDirectorJobs(); }, [loadDirectorJobs]);

  // Poll active job
  useEffect(() => {
    if (!directorJobId) return;
    if (directorPollRef.current) clearInterval(directorPollRef.current);
    directorPollRef.current = setInterval(async () => {
      try {
        const res = await videoService.directorGet(directorJobId);
        setDirectorJob(res.data);
        if (res.data.status === 'done' || res.data.status === 'failed') {
          clearInterval(directorPollRef.current!);
          directorPollRef.current = null;
          setDirectorRunning(false);
          if (res.data.status === 'done') showToast('Director Mode complete! All clips generated.');
          else showToast(res.data.error || 'Director Mode failed', 'error');
          void loadDirectorJobs();
        }
      } catch { /* non-fatal */ }
    }, 4000);
    return () => { if (directorPollRef.current) clearInterval(directorPollRef.current); };
  }, [directorJobId, loadDirectorJobs]);

  // 58.13: Auto-stitch when all clips complete successfully
  useEffect(() => {
    if (
      directorJob?.status === 'done' &&
      directorJob.clips.length > 0 &&
      directorJob.clips.every((c) => c.success) &&
      !stitchResult &&
      !stitching &&
      !autoStitchFiredRef.current &&
      directorJobId
    ) {
      autoStitchFiredRef.current = true;
      // Defer slightly so UI settles after polling update
      const tid = setTimeout(() => {
        void (async () => {
          setStitching(true);
          try {
            const res = await videoService.directorStitch(directorJobId);
            setStitchResult({ url: res.data.stitchedUrl, clipUrls: res.data.clipUrls, softStitch: res.data.softStitch });
            if (res.data.stitchedUrl) showToast('Auto-stitch complete! Download your video below.');
          } catch { /* non-fatal — user can stitch manually */ } finally {
            setStitching(false);
          }
        })();
      }, 1500);
      return () => clearTimeout(tid);
    }
  }, [directorJob, stitchResult, stitching, directorJobId]);

  // 59.13: Auto-start queued job when current job finishes
  useEffect(() => {
    if (!directorRunning && queuedIdea) {
      const idea = queuedIdea;
      setQueuedIdea(null);
      setDirectorIdea(idea);
      // Small delay so state settles before starting
      const tid = setTimeout(() => { void handleDirectorSubmit(idea); }, 800);
      return () => clearTimeout(tid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directorRunning]);

  // 65.13: Expand idea via AI before submitting to Director Mode
  const handleExpandIdea = async () => {
    if (!directorIdea.trim() || expandingIdea) return;
    setExpandingIdea(true);
    try {
      const res = await videoService.directorExpandIdea(directorIdea.trim());
      setDirectorIdea(res.data.expanded);
    } catch { /* ignore — keep original idea */ } finally {
      setExpandingIdea(false);
    }
  };

  const handleDirectorSubmit = async (overrideIdea?: string) => {
    const idea = overrideIdea ?? directorIdea.trim();
    if (!idea) return;
    // 59.13: If a job is already running, queue the new idea instead of starting immediately
    if (directorRunning) {
      setQueuedIdea(idea);
      setDirectorIdea('');
      showToast('Queued! Will start automatically when the current job finishes.');
      return;
    }
    setDirectorRunning(true);
    setDirectorError(null);
    setDirectorJob(null);
    autoStitchFiredRef.current = false; // 58.13: allow auto-stitch for new job
    try {
      const res = await videoService.directorCreate(idea);
      setDirectorJobId(res.data.jobId);
      showToast('Director Mode pipeline started — generating 6 clips…');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Director Mode failed to start';
      setDirectorError(msg);
      setDirectorRunning(false);
      showToast(msg, 'error');
    }
  };

  // 57.13: Stitch clips into a single video
  const handleStitch = async () => {
    if (!directorJobId) return;
    setStitching(true);
    setStitchResult(null);
    try {
      const res = await videoService.directorStitch(directorJobId);
      setStitchResult({ url: res.data.stitchedUrl, clipUrls: res.data.clipUrls, softStitch: res.data.softStitch });
      if (res.data.stitchedUrl) showToast('Stitch complete! Download your video below.');
      else showToast('Soft stitch: individual clip URLs ready for download.');
    } catch {
      showToast('Stitch failed — try again', 'error');
    } finally {
      setStitching(false);
    }
  };

  // 57.13: Rerun director job with same idea
  const handleRerun = () => {
    if (!directorIdea.trim()) return;
    setDirectorJob(null);
    setDirectorJobId(null);
    setStitchResult(null);
    autoStitchFiredRef.current = false; // 58.13: allow auto-stitch for new job
    void handleDirectorSubmit();
  };

  const handleSetDefaultVideoModel = async (modelId: string) => {
    setSavingVideoModel(modelId);
    try {
      await agentService.setVideoModel(modelId);
      setPreferredVideoModel(modelId);
    } catch {
      // ignore silently
    } finally {
      setSavingVideoModel(null);
    }
  };

  // Handle video generation
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await videoService.generate(prompt, selectedModel, 1280, 720, duration);
      const est = res.data.estimated_time || 30;
      showToast(`Video generating! Estimated ${est}s. It will appear below.`);
      setPrompt('');
      await loadGallery();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Generation failed';
      showToast(msg, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Handle delete (called after confirmation)
  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await videoService.delete(id);
      showToast('Video deleted');
      await loadGallery();
      if (previewVideo?.id === id) setPreviewVideo(null);
    } catch {
      showToast('Failed to delete', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // Copy video ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Manually refresh a processing video
  const handleRefreshStatus = async (id: string) => {
    try {
      const res = await videoService.checkStatus(id);
      if (res.data.status === 'ready') {
        showToast('Video is ready!');
        await loadGallery();
      } else {
        showToast('Still processing... please wait.', 'error');
      }
    } catch {
      showToast('Failed to check status', 'error');
    }
  };

  const currentModel = models.find(m => m.id === selectedModel) || models[0];

  // Duration presets
  const durationPresets = [
    { label: '3s', val: 3 },
    { label: '5s', val: 5 },
    { label: '8s', val: 8 },
    { label: '10s', val: 10 },
  ];

  // 64.10: Estimated runtime based on duration + model tier
  const estimatedSeconds = (() => {
    const base = duration * 6; // ~6s per second of footage
    const multiplier = currentModel?.tier === 'premium' ? 1.5 : currentModel?.tier === 'standard' ? 1.1 : 1.0;
    const est = Math.round(base * multiplier);
    return Math.max(20, Math.min(est, 120));
  })();

  // Provider availability — all free video providers are currently blocked from Hostinger
  const BROKEN_VIDEO_PROVIDERS = ['pollinations-video', 'seedance-lite', 'veo2', 'veo2-openrouter', 'pollinations', 'auto', ''];
  const isProviderBroken = !selectedModel || BROKEN_VIDEO_PROVIDERS.some(p => selectedModel === p || selectedModel.includes(p));

  return (
    <div className="space-y-6">
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
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#9CA3AF] truncate flex-1 mr-4">
                {previewVideo.prompt}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewVideo.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#9CA3AF] hover:text-[#E8E8F0] transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                  aria-label="Download video"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewVideo(null)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#9CA3AF] hover:text-[#E8E8F0] transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {previewVideo.status === 'ready' ? (
              <video
                src={previewVideo.video_url}
                controls
                autoPlay
                className="w-full rounded-2xl border border-[#00F0FF]/20 bg-black"
              />
            ) : (
              <div className="w-full aspect-video rounded-2xl border border-[#00F0FF]/20 bg-[#06060B] flex flex-col items-center justify-center gap-4 p-6">
                <Loader2 className="w-8 h-8 text-[#A78BFA] animate-spin" />
                {/* 62.8: step indicator for processing state */}
                <div className="flex items-center gap-1.5 text-xs">
                  {(['Queued', 'Generating', 'Rendering', 'Ready'] as const).map((step, i) => (
                    <React.Fragment key={step}>
                      <span className={i === 1 ? 'text-[#A78BFA] font-semibold' : i < 1 ? 'text-[#00FF88]' : 'text-[#9CA3AF]'}>{step}</span>
                      {i < 3 && <span className="text-[#9CA3AF]">→</span>}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-xs text-[#9CA3AF]">30–120s depending on model &amp; duration</p>
              </div>
            )}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#9CA3AF]">{previewVideo.width}x{previewVideo.height}</span>
                <span className="text-xs text-[#9CA3AF]">{previewVideo.duration}s</span>
                <span className="text-xs text-[#9CA3AF]">{previewVideo.model}</span>
              </div>
              <button
                onClick={() => handleCopyId(previewVideo.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-xs text-[#9CA3AF] hover:text-[#00F0FF] transition-colors"
              >
                {copiedId === previewVideo.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === previewVideo.id ? 'Copied!' : previewVideo.id}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8F0]">Video Generator</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Create AI-powered short clips &middot; {videoCount}/{maxVideos} saved
          </p>
        </div>

        {/* Assigned Agent Badge */}
        <div className="relative">
          {assignedAgent ? (
            <button
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#A78BFA]/20 bg-[#A78BFA]/5 hover:border-[#A78BFA]/40 transition-colors"
            >
              <span className="text-lg">
                {assignedAgent.personality === 'edith' ? '⚡' : assignedAgent.personality === 'jarvis' ? '🎩' : '🤖'}
              </span>
              <div className="text-left">
                <div className="text-sm font-medium text-[#E8E8F0]">{assignedAgent.name}</div>
                <div className="text-xs text-[#9CA3AF]">Assigned agent</div>
              </div>
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusColor[assignedAgent.status] || '#6B7280' }}
              />
              <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
            </button>
          ) : (
            <button
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#A78BFA]/20 hover:border-[#A78BFA]/40 text-[#9CA3AF] hover:text-[#E8E8F0] transition-colors text-sm"
            >
              <Bot className="w-4 h-4" />
              {agentLoading ? 'Loading...' : 'Assign Agent'}
            </button>
          )}

          {/* Agent Picker Dropdown */}
          {showAgentPicker && (
            <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-[#00F0FF]/20 bg-[#0C0C18] shadow-2xl z-30 overflow-hidden">
              <div className="p-3 border-b border-[#00F0FF]/10">
                <p className="text-xs text-[#9CA3AF]">Choose an agent from your fleet</p>
              </div>
              {fleetAgents.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#9CA3AF]">
                  No agents in your fleet. Deploy one from the Fleet page.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {assignedAgent && (
                    <button
                      onClick={() => { setAssignedAgent(null); setShowAgentPicker(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FF6161]/5 transition-colors text-left border-b border-[#00F0FF]/10"
                    >
                      <X className="w-4 h-4 text-[#FF6161]" />
                      <span className="text-sm text-[#FF6161]">Unassign agent</span>
                    </button>
                  )}
                  {fleetAgents.map(agent => {
                    const isAssigned = assignedAgent?.id === agent.id;
                    const color = statusColor[agent.status] || '#6B7280';
                    return (
                      <button
                        key={agent.id}
                        onClick={() => { setAssignedAgent(agent); setShowAgentPicker(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#00F0FF]/5 transition-colors text-left ${
                          isAssigned ? 'bg-[#A78BFA]/5' : ''
                        }`}
                      >
                        <span className="text-lg">
                          {agent.personality === 'edith' ? '⚡' : agent.personality === 'jarvis' ? '🎩' : '🤖'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#E8E8F0]">{agent.name}</div>
                          <div className="text-xs text-[#9CA3AF]">Slot {agent.slot} &middot; {agent.tasks_completed} tasks done</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {agent.status === 'active' ? (
                            <Wifi className="w-3 h-3" style={{ color }} />
                          ) : (
                            <WifiOff className="w-3 h-3" style={{ color }} />
                          )}
                          <span className="text-xs capitalize" style={{ color }}>
                            {agent.status}
                          </span>
                        </div>
                        {isAssigned && <Check className="w-4 h-4 text-[#A78BFA]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Provider unavailability warning */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-yellow-300 font-medium text-sm">Video generation temporarily unavailable</p>
          <p className="text-yellow-400/70 text-xs mt-1">
            Free video providers are currently unreachable from this server. Video generation will be restored when a compatible provider becomes available. No credits will be deducted.
          </p>
        </div>
      </div>

      {/* Generation Panel */}
      <div
        className="rounded-2xl border border-[#A78BFA]/20 p-6"
        style={{ background: 'rgba(167, 139, 250, 0.03)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="w-5 h-5 text-[#A78BFA]" />
          <h3 className="text-[#E8E8F0] font-semibold">Create Video</h3>
        </div>

        {/* Model selector + Duration */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Model */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#06060B] border border-[#A78BFA]/15 text-sm text-[#E8E8F0] hover:border-[#A78BFA]/40 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
              {currentModel?.name || 'Select Model'}
              {currentModel?.tier === 'auto' ? (
                <span className="text-xs text-[#A78BFA] ml-1">Auto</span>
              ) : currentModel?.credits ? (
                <span className="text-xs text-[#FFB800] ml-1">{currentModel.credits}cr</span>
              ) : (
                <span className="text-xs text-[#00FF88] ml-1">Free</span>
              )}
              <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
            </button>

            {showModelPicker && (
              <div className="absolute top-full left-0 mt-2 w-80 rounded-xl border border-[#A78BFA]/20 bg-[#0C0C18] shadow-2xl z-20 overflow-hidden">
                {models.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#A78BFA]/5 transition-colors text-left ${
                      selectedModel === m.id ? 'bg-[#A78BFA]/10' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#E8E8F0]">{m.name}</div>
                      <div className="text-xs text-[#9CA3AF]">{m.description}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.tier === 'auto' ? 'bg-[#A78BFA]/10 text-[#A78BFA]' :
                      m.tier === 'free' ? 'bg-[#00FF88]/10 text-[#00FF88]' :
                      m.tier === 'premium' ? 'bg-[#FFB800]/10 text-[#FFB800]' :
                      'bg-[#00F0FF]/10 text-[#00F0FF]'
                    }`}>
                      {m.cost}
                    </span>
                    {selectedModel === m.id && <Check className="w-4 h-4 text-[#A78BFA] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Duration presets */}
          <div className="flex gap-1.5">
            {durationPresets.map(preset => (
              <button
                key={preset.label}
                onClick={() => setDuration(preset.val)}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  duration === preset.val
                    ? 'bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30'
                    : 'bg-[#06060B] text-[#9CA3AF] border border-[#A78BFA]/10 hover:border-[#A78BFA]/30'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt input */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to generate... (e.g. 'A drone flying over a city skyline at sunset, cinematic')"
          rows={3}
          className="w-full bg-[#06060B] border border-[#A78BFA]/20 rounded-xl px-4 py-3 text-[#E8E8F0] placeholder-[#6B7280]/50 resize-none focus:border-[#A78BFA]/50 outline-none text-sm"
        />

        {/* Generate button */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-[#9CA3AF]">
            {videoCount >= maxVideos ? (
              <span className="text-[#FF6161]">Video limit reached ({maxVideos}/{maxVideos})</span>
            ) : (
              <span>{videoCount}/{maxVideos} videos saved &middot; {duration}s duration &middot; 1280x720</span>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim() || videoCount >= maxVideos || isProviderBroken}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#A78BFA] text-[#06060B] font-semibold text-sm hover:bg-[#A78BFA]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isProviderBroken ? "Video generation is temporarily unavailable from this server region" : ""}
          >
            {isProviderBroken ? (
              <>
                <AlertTriangle className="w-4 h-4" />
                Unavailable
              </>
            ) : generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Generate Video
              </>
            )}
          </button>
        </div>

        {/* Unavailable notice */}
        {isProviderBroken && (
          <p className="text-xs text-[#FF6161] mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            Video generation is temporarily unavailable from this server region. Image generation works fine!
          </p>
        )}

        {/* 64.10: Estimated runtime display */}
        {!isProviderBroken && (
          <p className="text-xs text-[#9CA3AF] mt-3 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" />
            Est. ~{estimatedSeconds}s for {duration}s clip · The video will appear below once ready.
          </p>
        )}
      </div>

      {/* Gallery */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#E8E8F0] flex items-center gap-2">
            <Film className="w-5 h-5 text-[#A78BFA]" />
            Your Videos
            <span className="text-xs text-[#9CA3AF] font-normal ml-1">
              {videoCount}/{maxVideos}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {/* 58.9: Sort toggle */}
            <div className="flex items-center rounded-lg border border-[#A78BFA]/20 bg-[#0C0C18] p-0.5 gap-0.5">
              <button
                onClick={() => setGallerySort('newest')}
                className={`text-xs px-2 py-1 rounded transition-colors ${gallerySort === 'newest' ? 'bg-[#A78BFA]/20 text-[#A78BFA]' : 'text-[#9CA3AF] hover:text-[#E8E8F0]'}`}
              >Newest</button>
              <button
                onClick={() => setGallerySort('status')}
                className={`text-xs px-2 py-1 rounded transition-colors ${gallerySort === 'status' ? 'bg-[#A78BFA]/20 text-[#A78BFA]' : 'text-[#9CA3AF] hover:text-[#E8E8F0]'}`}
              >Status</button>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
              <Clock className="w-3 h-3" />
              Expire 24h
            </div>
          </div>
        </div>

        {galleryLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#A78BFA]/20 p-12 text-center">
            <Film className="w-10 h-10 text-[#A78BFA]/30 mx-auto mb-3" />
            <p className="text-[#9CA3AF] text-sm">No videos yet.</p>
            <p className="text-[#9CA3AF] text-xs mt-1">Describe what you want above and start generating!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...videos].sort((a, b) => {
              if (gallerySort === 'status') {
                const order = { ready: 0, processing: 1 };
                return (order[a.status] ?? 2) - (order[b.status] ?? 2);
              }
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }).map(vid => (
              <div
                key={vid.id}
                className="group rounded-2xl border border-[#A78BFA]/10 overflow-hidden hover:border-[#A78BFA]/30 transition-all bg-[#0C0C18]"
              >
                {/* Video / Processing placeholder */}
                <div
                  className="aspect-video cursor-pointer relative bg-[#06060B]"
                  onClick={() => setPreviewVideo(vid)}
                >
                  {vid.status === 'ready' ? (
                    <>
                      <LazyVideo
                        src={vid.video_url}
                        className="w-full h-full object-cover"
                      />
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-6 h-6 text-white ml-0.5" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#A78BFA] animate-spin" />
                      <span className="text-xs text-[#9CA3AF]">Processing...</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRefreshStatus(vid.id); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[#A78BFA] hover:bg-[#A78BFA]/10 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Check status
                      </button>
                    </div>
                  )}

                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white font-mono">
                    {vid.duration}s
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs text-[#E8E8F0] truncate mb-1.5">{vid.prompt}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[#9CA3AF]" />
                      <span className="text-xs text-[#9CA3AF]">{timeLeft(vid.expires_at)}</span>
                    </div>
                    <div className="flex gap-1">
                      {/* Copy ID */}
                      <button
                        onClick={() => handleCopyId(vid.id)}
                        className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#A78BFA] hover:bg-[#A78BFA]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
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
                        onClick={() => setDeleteConfirmId(vid.id)}
                        className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
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
                      vid.status === 'ready' ? 'bg-[#00FF88]/10 text-[#00FF88]' : 'bg-[#A78BFA]/10 text-[#A78BFA]'
                    }`}>
                      {vid.status === 'ready' ? 'Ready' : 'Processing'}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">{vid.model}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 55.13: Director Mode ─────────────────────────────────── */}
      <div className="rounded-2xl border border-[#BF5FFF]/20 bg-gradient-to-br from-[#0A0A1A] to-[#06060B] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#BF5FFF]/10">
          <div className="w-8 h-8 rounded-lg bg-[#BF5FFF]/15 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-[#BF5FFF]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#E8E8F0]">Director Mode <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#BF5FFF]/15 text-[#BF5FFF] ml-1">fal.ai Seedance</span></h2>
            <p className="text-xs text-[#9CA3AF]">One idea → AI director packet → 6 clips × 5s (60 credits)</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Idea input */}
          <div className="flex gap-3">
            <input
              value={directorIdea}
              onChange={(e) => setDirectorIdea(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleDirectorSubmit()}
              placeholder="e.g. A lone astronaut discovering an alien city at sunset"
              maxLength={500}
              className="flex-1 px-4 py-3 rounded-xl bg-[#0C0C18] border border-[#BF5FFF]/20 text-[#E8E8F0] text-sm placeholder-[#374151] focus:outline-none focus:border-[#BF5FFF]/50"
            />
            {/* 65.13: Expand idea with AI */}
            <button
              onClick={() => void handleExpandIdea()}
              disabled={!directorIdea.trim() || expandingIdea}
              title="Expand idea with AI"
              className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-[#BF5FFF]/10 border border-[#BF5FFF]/20 hover:bg-[#BF5FFF]/20 disabled:opacity-40 disabled:cursor-not-allowed text-[#BF5FFF] text-xs transition-colors"
            >
              {expandingIdea ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {expandingIdea ? '' : 'Expand'}
            </button>
            <button
              onClick={() => void handleDirectorSubmit()}
              disabled={!directorIdea.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#BF5FFF] hover:bg-[#A855F7] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {directorRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {directorRunning ? 'Queue' : 'Direct'}
            </button>
          </div>
          {/* 59.13: Queued job indicator */}
          {queuedIdea && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#BF5FFF]/10 border border-[#BF5FFF]/20 text-xs text-[#BF5FFF]" data-testid="queued-idea-banner">
              <span className="truncate flex-1 mr-2">⏳ Queued: <span className="text-[#D8B4FE]">{queuedIdea}</span></span>
              <button onClick={() => setQueuedIdea(null)} className="shrink-0 hover:text-[#E8E8F0] transition-colors" title="Cancel queued job">✕</button>
            </div>
          )}

          {directorError && (
            <div className="flex items-center gap-2 text-xs text-[#FF6161] bg-[#FF6161]/10 border border-[#FF6161]/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {directorError}
            </div>
          )}

          {/* Active job progress */}
          {directorJob && (
            <div className="rounded-xl border border-[#BF5FFF]/15 bg-[#BF5FFF]/5 p-4 space-y-3">
              {directorJob.packet && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#E8E8F0]">{directorJob.packet.title}</p>
                  <p className="text-xs text-[#BF5FFF]">{directorJob.packet.genre}</p>
                  <p className="text-xs text-[#9CA3AF]">{directorJob.packet.styleGuide}</p>
                </div>
              )}
              {directorJob.status === 'running' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-[#BF5FFF]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {/* 62.13: live clip count progress */}
                    {directorJob.packet?.shotlist && directorJob.packet.shotlist.length > 0 ? (
                      <span>
                        Clips: <strong>{directorJob.clips.length}</strong>/{directorJob.packet.shotlist.length} complete
                        {directorJob.clips.length === 0 && ' — waiting for first clip…'}
                      </span>
                    ) : (
                      <span>Generating clips… this takes 2-4 minutes</span>
                    )}
                  </div>
                  {directorJob.packet?.shotlist && directorJob.packet.shotlist.length > 0 && (
                    <div className="w-full bg-[#BF5FFF]/10 rounded-full h-1.5">
                      <div
                        className="bg-[#BF5FFF] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((directorJob.clips.length / directorJob.packet.shotlist.length) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              {directorJob.clips.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {directorJob.clips.map((clip, i) => {
                    // 64.13: shot prompt for this clip index
                    const shot = directorJob.packet?.shotlist?.[i];
                    return (
                    <div key={i} className="flex flex-col gap-1">
                    <div
                      className={`relative rounded-lg overflow-hidden aspect-video bg-[#0C0C18] border transition-all ${
                        clip.success ? 'border-[#BF5FFF]/10 cursor-pointer hover:border-[#BF5FFF]/40 hover:scale-[1.02]' : 'border-[#FF6161]/20'
                      }`}
                      onClick={() => clip.success && clip.url && setPreviewClip({ url: clip.url, index: i })}
                      title={shot ? `${shot.cameraMove} — ${shot.prompt}` : (clip.success ? 'Click to preview' : undefined)}
                    >
                      {clip.success ? (
                        <>
                          <video src={clip.url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                          <div className="absolute bottom-1 left-1 text-xs text-white/60 bg-black/40 px-1 rounded">
                            {i + 1}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                            <Play className="w-6 h-6 text-white drop-shadow" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#FF6161]">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs">Failed</span>
                          {/* 60.13: per-clip retry */}
                          {directorJob.status === 'done' && directorJobId && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await videoService.directorRetryClip(directorJobId, i);
                                  showToast(`Retrying clip ${i + 1}…`);
                                } catch { showToast('Retry failed — try again'); }
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
                    {/* 64.13: shot prompt label */}
                    {shot && (
                      <p className="text-xs text-[#9CA3AF] leading-tight truncate px-0.5" title={shot.prompt}>
                        <span className="text-[#BF5FFF]/60">{shot.cameraMove}</span> {shot.prompt}
                      </p>
                    )}
                    </div>
                    );
                  })}
                </div>
              )}

              {/* 63.13: Failed job restart button */}
              {(directorJob.status as string) === 'failed' && (
                <div className="flex items-center gap-3 rounded-lg border border-[#FF6161]/30 bg-[#FF6161]/5 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-[#FF6161] flex-shrink-0" />
                  <span className="text-xs text-[#FF6161] flex-1">Director job failed</span>
                  <button
                    onClick={handleRerun}
                    disabled={directorRunning}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#FF6161]/30 text-[#FF6161] hover:bg-[#FF6161]/10 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Restart Job
                  </button>
                </div>
              )}

              {/* 57.13: Stitch bar + Rerun — shown when job is done */}
              {directorJob.status === 'done' && directorJob.clips.length > 0 && (
                <div className="space-y-2">
                  {stitchResult ? (
                    <div className="rounded-xl border border-[#BF5FFF]/30 bg-[#BF5FFF]/5 p-3 space-y-2">
                      <p className="text-xs font-semibold text-[#BF5FFF]">
                        {stitchResult.url ? 'Stitched Video Ready' : 'Clip URLs Ready (soft stitch)'}
                      </p>
                      {stitchResult.url ? (
                        <div className="space-y-2">
                          {/* 63.8: Inline video player for stitched result */}
                          <video
                            src={stitchResult.url}
                            controls
                            className="w-full rounded-lg border border-[#BF5FFF]/30 max-h-48 bg-black"
                            preload="metadata"
                          />
                          <a
                            href={stitchResult.url}
                            download="stitched.mp4"
                            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10 transition-colors w-fit"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Stitched Video
                          </a>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {stitchResult.clipUrls.map((u, idx) => (
                            <a key={idx} href={u} download={`clip-${idx + 1}.mp4`} className="text-xs text-[#BF5FFF]/70 hover:text-[#BF5FFF] underline truncate">
                              Clip {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {/* 60.13: show partial clip count when some failed */}
                      {directorJob.clips.some((c) => !c.success) && (
                        <p className="text-xs text-amber-400">
                          {directorJob.clips.filter((c) => c.success).length}/{directorJob.clips.length} clips succeeded — stitch will use successful clips only
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void handleStitch()}
                          disabled={stitching || !directorJob.clips.some((c) => c.success)}
                          data-testid="stitch-btn"
                          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10 disabled:opacity-50 transition-colors"
                        >
                          {stitching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
                          {stitching ? 'Stitching…' : directorJob.clips.some((c) => !c.success) ? 'Partial Stitch' : 'Stitch Clips'}
                        </button>
                        {stitching && (
                          <div className="flex-1 h-1.5 rounded-full bg-[#0C0C18] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#BF5FFF] to-[#00F0FF] animate-pulse rounded-full" style={{ width: '60%' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleRerun}
                    disabled={directorRunning}
                    data-testid="rerun-director-btn"
                    className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#E8E8F0] disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Rerun with same idea
                  </button>
                </div>
              )}

              {/* 56.13: Clip preview modal */}
              {previewClip && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                  onClick={(e) => { if (e.target === e.currentTarget) setPreviewClip(null); }}
                >
                  <div className="relative w-full max-w-2xl bg-[#0C0C18] rounded-2xl border border-[#BF5FFF]/30 overflow-hidden shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#BF5FFF]/15">
                      <p className="text-sm font-medium text-[#E8E8F0]">
                        Clip {previewClip.index + 1} — {directorJob.packet?.shotlist?.[previewClip.index]?.prompt ?? 'Director Mode clip'}
                      </p>
                      <button onClick={() => setPreviewClip(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#9CA3AF] hover:text-[#E8E8F0] transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" aria-label="Close clip preview">
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
                    <div className="flex items-center gap-2 px-4 py-3 border-t border-[#BF5FFF]/15">
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(previewClip.url).catch(() => {});
                          setCopiedClipUrl(true);
                          setTimeout(() => setCopiedClipUrl(false), 2000);
                        }}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10 transition-colors"
                      >
                        {copiedClipUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedClipUrl ? 'Copied!' : 'Copy URL'}
                      </button>
                      <a
                        href={previewClip.url}
                        download={`clip-${previewClip.index + 1}.mp4`}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[#6B7280]/30 text-[#9CA3AF] hover:border-[#6B7280]/60 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                      {previewClip.index > 0 && (
                        <button
                          onClick={() => setPreviewClip({ url: directorJob.clips[previewClip.index - 1].url!, index: previewClip.index - 1 })}
                          className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-[#00F0FF]/20 text-[#00F0FF]/70 hover:text-[#00F0FF] transition-colors"
                        >← Prev</button>
                      )}
                      {previewClip.index < directorJob.clips.length - 1 && (
                        <button
                          onClick={() => setPreviewClip({ url: directorJob.clips[previewClip.index + 1].url!, index: previewClip.index + 1 })}
                          className={`text-xs px-3 py-1.5 rounded-lg border border-[#00F0FF]/20 text-[#00F0FF]/70 hover:text-[#00F0FF] transition-colors ${previewClip.index === 0 ? 'ml-auto' : ''}`}
                        >Next →</button>
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
                <p className="text-xs text-[#9CA3AF] font-medium">Recent Director Jobs</p>
                {/* 66.11: Status filter for job history */}
                <div className="flex items-center gap-1">
                  {(['all', 'done', 'failed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setJobHistoryFilter(f)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${jobHistoryFilter === f ? 'bg-[#BF5FFF]/15 border-[#BF5FFF]/50 text-[#BF5FFF]' : 'border-[#BF5FFF]/10 text-[#9CA3AF] hover:text-[#BF5FFF]'}`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {directorJobs.filter(j => jobHistoryFilter === 'all' || j.status === jobHistoryFilter).slice(0, 3).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#BF5FFF]/10 bg-[#BF5FFF]/5"
                >
                  <button
                    onClick={() => { setDirectorJob(job); setDirectorJobId(job.id); }}
                    className="flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    <p className="text-xs font-medium text-[#E8E8F0]">{job.packet?.title ?? job.idea.slice(0, 50)}</p>
                    <p className="text-xs text-[#9CA3AF]">{job.clips.filter(c => c.success).length}/{job.clips.length} clips · {new Date(job.created_at).toLocaleDateString()}</p>
                  </button>
                  {/* 64.13: Re-use idea button */}
                  <button
                    onClick={() => setDirectorIdea(job.idea)}
                    className="flex-shrink-0 p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#BF5FFF]/50 hover:text-[#BF5FFF] hover:bg-[#BF5FFF]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                    aria-label="Use this idea again"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Available Video Models */}
      <div className="rounded-2xl border border-[#A78BFA]/10 overflow-hidden">
        <button
          onClick={() => setShowVideoModelsPanel(p => !p)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#A78BFA]/5 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-[#A78BFA]" />
            <span className="text-sm font-semibold text-[#E8E8F0]">Available Video Models</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform ${showVideoModelsPanel ? 'rotate-180' : ''}`} />
        </button>

        {showVideoModelsPanel && (
          <div className="border-t border-[#A78BFA]/10 divide-y divide-[#A78BFA]/5">
            {videoModels.map(model => {
              const status = videoModelStatuses[model.id] ?? 'unknown';
              const isDefault = preferredVideoModel === model.id;
              const isSaving = savingVideoModel === model.id;

              return (
                <div key={model.id} className={`flex items-center gap-4 px-4 py-3 ${isDefault ? 'bg-[#A78BFA]/5' : ''}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    status === 'ok' ? 'bg-[#00FF88]' :
                    status === 'down' ? 'bg-[#FF6161]' :
                    'bg-[#6B7280]'
                  }`} title={status} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#E8E8F0]">{model.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        model.tier === 'auto' ? 'bg-[#A78BFA]/15 text-[#A78BFA]' :
                        model.tier === 'free' ? 'bg-[#00FF88]/15 text-[#00FF88]' :
                        model.tier === 'premium' ? 'bg-[#FFB800]/15 text-[#FFB800]' :
                        'bg-[#00F0FF]/15 text-[#00F0FF]'
                      }`}>
                        {model.cost}
                      </span>
                      {isDefault && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] font-medium">
                          Your default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{model.description}</p>
                  </div>

                  <button
                    onClick={() => handleSetDefaultVideoModel(model.id)}
                    disabled={isDefault || isSaving}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isDefault
                        ? 'bg-[#A78BFA]/10 text-[#A78BFA] cursor-default'
                        : 'bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 disabled:opacity-50'
                    }`}
                  >
                    {isSaving ? '...' : isDefault ? '✓ Default' : 'Set default'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage info */}
      <div className="rounded-xl border border-[#A78BFA]/10 p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#9CA3AF] shrink-0 mt-0.5" />
        <div className="text-xs text-[#9CA3AF] space-y-1">
          <p>Videos are saved for <strong className="text-[#E8E8F0]">24 hours</strong> and then automatically deleted.</p>
          <p>Generation takes <strong className="text-[#E8E8F0]">30-120 seconds</strong> depending on duration and model. The page auto-polls for readiness.</p>
          <p>Maximum <strong className="text-[#E8E8F0]">{maxVideos} videos</strong> at a time. Delete old ones to make room for new ones.</p>
          <p>Use <strong className="text-[#E8E8F0]">Copy ID</strong> to reference videos in other tools.</p>
        </div>
      </div>
      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" data-testid="delete-confirm-modal">
          <div className="bg-[#0D0D1A] border border-[#FF6161]/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF6161]/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#FF6161]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#F4F6FF]">Delete video?</h3>
                <p className="text-xs text-[#9CA3AF]">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-[#9CA3AF] mb-5">
              The video will be permanently removed from your gallery.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                className="flex-1 py-2 px-4 rounded-xl border border-[#2A2A3A] text-sm text-[#9CA3AF] hover:bg-[#1A1A2E] transition-colors disabled:opacity-50"
                data-testid="delete-confirm-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(deleteConfirmId)}
                disabled={isDeleting}
                className="flex-1 py-2 px-4 rounded-xl bg-[#FF6161]/15 border border-[#FF6161]/30 text-sm text-[#FF6161] hover:bg-[#FF6161]/25 transition-colors disabled:opacity-50 font-medium"
                data-testid="delete-confirm-ok"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
