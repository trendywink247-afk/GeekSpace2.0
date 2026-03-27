// ============================================================
// Creative Studio — Unified creative hub (Image / Video / Templates / Gallery)
// Owner agent: Edith (#8B5CF6)
// Design tokens: PageShell + PageHeader + SectionCard + useAgentCanvas
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ImageIcon, Film, Sparkles, Send, Loader2, Trash2,
  Download, X, Play, RefreshCw, Wand2, Palette, Clock,
  LayoutTemplate,
} from 'lucide-react';
import { imageService, videoService, templateService } from '@/services/api';
import type { UserImage, UserVideo } from '@/services/api';
import type { Template, TemplateCategory } from '@/types';
import { MediaGallery, type MediaItem } from '@/components/MediaGallery';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';

// ---- Style presets for image generation ----
const STYLE_OPTIONS = [
  'Photorealistic', 'Anime', 'Oil Painting', 'Watercolor',
  'Cyberpunk', 'Minimalist', 'Pixel Art', 'Digital Art',
  '3D Render', 'Sketch', 'Pop Art', 'Art Nouveau',
] as const;

type TabId = 'images' | 'videos' | 'templates' | 'gallery';

export function CreativeStudioPage() {
  const [activeTab, setActiveTab] = useState<TabId>('images');
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'creative-studio' });

  // ─── Toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Image Generation ──────────────────────────────────────
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgStyle, setImgStyle] = useState('');
  const [imgGenerating, setImgGenerating] = useState(false);
  const [images, setImages] = useState<UserImage[]>([]);
  const [imgLoading, setImgLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<UserImage | null>(null);

  const loadImages = useCallback(async () => {
    try {
      const res = await imageService.list();
      setImages(res.data.images);
    } catch { /* empty gallery */ } finally {
      setImgLoading(false);
    }
  }, []);

  const handleImageGenerate = async () => {
    const raw = imgPrompt.trim();
    if (!raw) return;
    setImgGenerating(true);
    notifyStart('image-generate');
    try {
      const finalPrompt = imgStyle ? `${raw}, ${imgStyle} style` : raw;
      await imageService.generate(finalPrompt, 'auto', 1024, 1024);
      showToast('Image generated!');
      notifyDone('Image generated successfully');
      setImgPrompt('');
      setImgStyle('');
      await loadImages();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Generation failed';
      showToast(msg, 'error');
      notifyFail(msg);
    } finally {
      setImgGenerating(false);
    }
  };

  const handleImageDelete = async (id: string) => {
    try {
      await imageService.delete(id);
      setImages(prev => prev.filter(i => i.id !== id));
      if (previewImage?.id === id) setPreviewImage(null);
      showToast('Image deleted');
      notifyDone('Image deleted');
    } catch {
      showToast('Delete failed', 'error');
      notifyFail('Image delete failed');
    }
  };

  // ─── Video Generation ──────────────────────────────────────
  const [vidPrompt, setVidPrompt] = useState('');
  const [vidGenerating, setVidGenerating] = useState(false);
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [vidLoading, setVidLoading] = useState(true);
  const [directorMode, setDirectorMode] = useState(false);
  const [directorRunning, setDirectorRunning] = useState(false);
  const [directorJobId, setDirectorJobId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<UserVideo | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const directorPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      const res = await videoService.list();
      setVideos(res.data.videos);
    } catch { /* empty gallery */ } finally {
      setVidLoading(false);
    }
  }, []);

  const handleVideoGenerate = async () => {
    const raw = vidPrompt.trim();
    if (!raw) return;

    if (directorMode) {
      // Director Mode
      if (directorRunning) return;
      setDirectorRunning(true);
      notifyStart('video-director');
      try {
        const res = await videoService.directorCreate(raw);
        setDirectorJobId(res.data.jobId);
        showToast('Director Mode started — generating clips...');
        setVidPrompt('');
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Director Mode failed';
        showToast(msg, 'error');
        notifyFail(msg);
        setDirectorRunning(false);
      }
      return;
    }

    // Basic generation
    setVidGenerating(true);
    notifyStart('video-generate');
    try {
      const res = await videoService.generate(raw, 'auto', 1280, 720, 5);
      const est = res.data.estimated_time || 30;
      showToast(`Video generating! ~${est}s. It will appear below.`);
      notifyDone('Video generation started');
      setVidPrompt('');
      await loadVideos();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Generation failed';
      showToast(msg, 'error');
      notifyFail(msg);
    } finally {
      setVidGenerating(false);
    }
  };

  // Poll processing videos
  useEffect(() => {
    const processing = videos.filter(v => v.status === 'processing');
    if (processing.length === 0) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    pollingRef.current = setInterval(async () => {
      let changed = false;
      for (const vid of processing) {
        try {
          const res = await videoService.checkStatus(vid.id);
          if (res.data.status === 'ready') changed = true;
        } catch { /* non-fatal */ }
      }
      if (changed) loadVideos();
    }, 10000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [videos, loadVideos]);

  // Poll director job
  useEffect(() => {
    if (!directorJobId) return;
    if (directorPollRef.current) clearInterval(directorPollRef.current);
    directorPollRef.current = setInterval(async () => {
      try {
        const res = await videoService.directorGet(directorJobId);
        if (res.data.status === 'done' || res.data.status === 'failed') {
          clearInterval(directorPollRef.current!);
          directorPollRef.current = null;
          setDirectorRunning(false);
          setDirectorJobId(null);
          if (res.data.status === 'done') {
            showToast('Director Mode complete!');
            notifyDone('Director Mode finished');
            loadVideos();
          } else {
            showToast(res.data.error || 'Director Mode failed', 'error');
            notifyFail(res.data.error || 'Director Mode failed');
          }
        }
      } catch { /* non-fatal */ }
    }, 4000);
    return () => { if (directorPollRef.current) clearInterval(directorPollRef.current); };
  }, [directorJobId, loadVideos, notifyDone, notifyFail]);

  const handleVideoDelete = async (id: string) => {
    try {
      await videoService.delete(id);
      setVideos(prev => prev.filter(v => v.id !== id));
      if (previewVideo?.id === id) setPreviewVideo(null);
      showToast('Video deleted');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  // ─── Templates ──────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplCategories, setTplCategories] = useState<TemplateCategory[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [tplCategory, setTplCategory] = useState('all');
  const [tplSearch, setTplSearch] = useState('');
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [clonedId, setClonedId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setTplLoading(true);
    try {
      const [tplRes, catRes] = await Promise.all([
        templateService.list({
          category: tplCategory === 'all' ? undefined : tplCategory,
          search: tplSearch || undefined,
          officialOnly: false,
        }),
        templateService.getCategories(),
      ]);
      setTemplates(tplRes.data.templates);
      setTplCategories(catRes.data.categories);
    } catch { /* empty state */ } finally {
      setTplLoading(false);
    }
  }, [tplCategory, tplSearch]);

  const handleTemplateClone = async (template: Template) => {
    setCloningId(template.id);
    notifyStart('template-clone');
    try {
      await templateService.clone(template.id, `${template.name} (My Copy)`);
      setClonedId(template.id);
      showToast(`Cloned "${template.name}" to your artifacts`);
      notifyDone(`Template "${template.name}" cloned`);
      setTimeout(() => setClonedId(null), 2000);
    } catch {
      showToast('Clone failed', 'error');
      notifyFail('Template clone failed');
    } finally {
      setCloningId(null);
    }
  };

  // ─── Gallery (combined) ────────────────────────────────────
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const [imagesRes, videosRes] = await Promise.allSettled([
        imageService.list(),
        videoService.list(),
      ]);

      const imgs: MediaItem[] =
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

      const vids: MediaItem[] =
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

      const combined = [...imgs, ...vids].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setGalleryItems(combined);
    } catch { /* empty state */ } finally {
      setGalleryLoading(false);
    }
  }, []);

  const handleGalleryDelete = async (id: string) => {
    const item = galleryItems.find(i => i.id === id);
    if (!item) return;
    setGalleryItems(prev => prev.filter(i => i.id !== id));
    try {
      if (item.type === 'image') await imageService.delete(id);
      else await videoService.delete(id);
    } catch { loadGallery(); }
  };

  const handleGalleryFavorite = (id: string, isFavorite: boolean) => {
    setGalleryItems(prev =>
      prev.map(item => (item.id === id ? { ...item, isFavorite } : item))
    );
  };

  const handleGalleryDownload = async (item: MediaItem) => {
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
    } catch { /* download failure */ }
  };

  // ─── Load data on mount and tab switch ─────────────────────
  useEffect(() => {
    if (activeTab === 'images') loadImages();
    else if (activeTab === 'videos') loadVideos();
    else if (activeTab === 'templates') loadTemplates();
    else if (activeTab === 'gallery') loadGallery();
  }, [activeTab, loadImages, loadVideos, loadTemplates, loadGallery]);

  // ─── Tab definitions ───────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: typeof ImageIcon }[] = [
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'videos', label: 'Videos', icon: Film },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'gallery', label: 'Gallery', icon: Sparkles },
  ];

  return (
    <PageShell>
      {/* Header with edith ownership dot (#8B5CF6) */}
      <PageHeader
        icon={Palette}
        title="Creative Studio"
        subtitle="Generate images, videos, browse templates, and manage your creations"
        badge={
          <span className="relative flex h-3 w-3" title="Owned by Edith">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8B5CF6]" />
          </span>
        }
      />

      {/* Tab bar */}
      <SectionCard padding="sm" className="!p-1">
        <div className="flex items-center gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] shadow-sm'
                    : 'text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* ════════ Images Tab ════════ */}
      {activeTab === 'images' && (
        <div className="space-y-6">
          {/* Prompt card */}
          <SectionCard>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#F4F6FF]">
                <Wand2 className="w-4 h-4 text-[#8B5CF6]" />
                Generate Image
              </div>

              {/* Prompt input */}
              <textarea
                value={imgPrompt}
                onChange={e => setImgPrompt(e.target.value)}
                placeholder="Describe the image you want to create..."
                rows={3}
                className="w-full bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-sm text-[#F4F6FF] placeholder-[#6B7280] resize-none focus:outline-none focus:border-[rgba(139,92,246,0.15)] transition-colors"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleImageGenerate(); }}
              />

              {/* Style selector */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-[#9CA3AF] flex items-center">Style:</span>
                {STYLE_OPTIONS.map(style => (
                  <button
                    key={style}
                    onClick={() => setImgStyle(imgStyle === style ? '' : style)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs transition-all min-h-[32px] ${
                      imgStyle === style
                        ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[rgba(139,92,246,0.15)]'
                        : 'bg-[rgba(12,12,30,0.6)] text-[#9CA3AF] border border-transparent hover:text-[#F4F6FF]'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>

              {/* Generate button */}
              <button
                onClick={handleImageGenerate}
                disabled={!imgPrompt.trim() || imgGenerating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B5CF6] text-white font-medium text-sm transition-all hover:bg-[#8B5CF6]/90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {imgGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <><Send className="w-4 h-4" /> Generate</>
                )}
              </button>
            </div>
          </SectionCard>

          {/* Recent images grid */}
          <SectionCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#F4F6FF]">Recent Images</h3>
              <button
                onClick={loadImages}
                className="p-2 rounded-lg hover:bg-[#8B5CF6]/10 text-[#9CA3AF] hover:text-[#8B5CF6] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {imgLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-[rgba(139,92,246,0.15)]">
                <ImageIcon className="w-10 h-10 text-[#8B5CF6]/30 mb-3" />
                <p className="text-sm text-[#9CA3AF]">No images yet. Generate your first one above!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map(img => (
                  <div
                    key={img.id}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.6)] cursor-pointer"
                    onClick={() => setPreviewImage(img)}
                  >
                    <img
                      src={img.image_url}
                      alt={img.prompt || 'Generated image'}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-xs text-white/80 line-clamp-2">{img.prompt}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={e => { e.stopPropagation(); handleImageDelete(img.id); }}
                            className="p-2 rounded-lg bg-[#FF6161]/20 text-[#FF6161] hover:bg-[#FF6161]/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={img.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-2 rounded-lg bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ════════ Videos Tab ════════ */}
      {activeTab === 'videos' && (
        <div className="space-y-6">
          {/* Prompt card */}
          <SectionCard>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-[#F4F6FF]">
                  <Film className="w-4 h-4 text-[#8B5CF6]" />
                  Generate Video
                </div>
                {/* Director mode toggle */}
                <button
                  onClick={() => setDirectorMode(!directorMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[44px] ${
                    directorMode
                      ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[rgba(139,92,246,0.15)]'
                      : 'bg-[rgba(12,12,30,0.6)] text-[#9CA3AF] border border-transparent hover:text-[#F4F6FF]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Director Mode
                </button>
              </div>

              {/* Prompt input */}
              <textarea
                value={vidPrompt}
                onChange={e => setVidPrompt(e.target.value)}
                placeholder={directorMode
                  ? "Describe your video concept — AI will create a multi-shot storyboard..."
                  : "Describe the video you want to create..."
                }
                rows={3}
                className="w-full bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-sm text-[#F4F6FF] placeholder-[#6B7280] resize-none focus:outline-none focus:border-[rgba(139,92,246,0.15)] transition-colors"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleVideoGenerate(); }}
              />

              {directorMode && (
                <p className="text-xs text-[#8B5CF6]/70 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Director Mode generates a multi-shot storyboard and stitches clips together automatically.
                </p>
              )}

              {/* Generate button */}
              <button
                onClick={handleVideoGenerate}
                disabled={!vidPrompt.trim() || vidGenerating || directorRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B5CF6] text-white font-medium text-sm transition-all hover:bg-[#8B5CF6]/90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
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
              <h3 className="text-sm font-semibold text-[#F4F6FF]">Recent Videos</h3>
              <button
                onClick={loadVideos}
                className="p-2 rounded-lg hover:bg-[#8B5CF6]/10 text-[#9CA3AF] hover:text-[#8B5CF6] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {vidLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-[rgba(139,92,246,0.15)]">
                <Film className="w-10 h-10 text-[#8B5CF6]/30 mb-3" />
                <p className="text-sm text-[#9CA3AF]">No videos yet. Generate your first one above!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map(vid => (
                  <div
                    key={vid.id}
                    className="group relative rounded-xl overflow-hidden border border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.6)]"
                  >
                    <div className="aspect-video relative">
                      {vid.status === 'processing' ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(12,12,30,0.6)]">
                          <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin mb-2" />
                          <span className="text-xs text-[#9CA3AF]">Processing...</span>
                        </div>
                      ) : (
                        <video
                          src={vid.video_url}
                          className="w-full h-full object-cover cursor-pointer"
                          muted
                          preload="metadata"
                          onClick={() => setPreviewVideo(vid)}
                        />
                      )}
                      {vid.status === 'ready' && (
                        <div
                          className="absolute inset-0 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"
                          onClick={() => setPreviewVideo(vid)}
                        >
                          <Play className="w-10 h-10 text-white/90" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-[#9CA3AF] line-clamp-2 mb-2">{vid.prompt}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                          <Clock className="w-3 h-3" />
                          {new Date(vid.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleVideoDelete(vid.id)}
                            className="p-2 rounded-lg text-[#6B7280] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {vid.status === 'ready' && (
                            <a
                              href={vid.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg text-[#6B7280] hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ════════ Templates Tab ════════ */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Search + filter bar */}
          <SectionCard padding="sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={tplSearch}
                  onChange={e => setTplSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] rounded-lg pl-4 pr-4 py-2.5 text-sm text-[#F4F6FF] placeholder-[#6B7280] focus:outline-none focus:border-[rgba(139,92,246,0.15)] transition-colors min-h-[44px]"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setTplCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-h-[44px] ${
                    tplCategory === 'all'
                      ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]'
                      : 'text-[#9CA3AF] hover:text-[#F4F6FF]'
                  }`}
                >
                  All
                </button>
                {tplCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setTplCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-h-[44px] ${
                      tplCategory === cat.id
                        ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]'
                        : 'text-[#9CA3AF] hover:text-[#F4F6FF]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Template grid */}
          <div>
            {tplLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <SectionCard>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <LayoutTemplate className="w-10 h-10 text-[#8B5CF6]/30 mb-3" />
                  <p className="text-sm text-[#9CA3AF]">
                    {tplSearch ? 'No templates match your search.' : 'No templates available yet.'}
                  </p>
                </div>
              </SectionCard>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(tpl => (
                  <SectionCard key={tpl.id} padding="sm" className="!p-0 overflow-hidden">
                    {/* Thumbnail */}
                    <div className="aspect-video bg-[rgba(12,12,30,0.6)] relative overflow-hidden">
                      {tpl.thumbnail ? (
                        <img
                          src={tpl.thumbnail}
                          alt={tpl.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <LayoutTemplate className="w-10 h-10 text-[#8B5CF6]/20" />
                        </div>
                      )}
                      {tpl.isOfficial && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#8B5CF6]/90 text-white text-[10px] font-semibold uppercase tracking-wider">
                          Official
                        </span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#F4F6FF] truncate">{tpl.name}</h3>
                        <p className="text-xs text-[#9CA3AF] line-clamp-2 mt-1">{tpl.description}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#6B7280] uppercase tracking-wider">{tpl.category}</span>
                        <button
                          onClick={() => handleTemplateClone(tpl)}
                          disabled={cloningId === tpl.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[44px] ${
                            clonedId === tpl.id
                              ? 'bg-[#10B981]/15 text-[#10B981]'
                              : 'bg-[#8B5CF6]/15 text-[#8B5CF6] hover:bg-[#8B5CF6]/25'
                          } disabled:opacity-50`}
                        >
                          {cloningId === tpl.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : clonedId === tpl.id ? (
                            <>Cloned</>
                          ) : (
                            <>Clone</>
                          )}
                        </button>
                      </div>
                    </div>
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ Gallery Tab ════════ */}
      {activeTab === 'gallery' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
              <span className="px-2 py-1 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs">
                {galleryItems.filter(i => i.type === 'image').length} images
              </span>
              <span className="px-2 py-1 rounded bg-[#00F0FF]/10 text-[#00F0FF] text-xs">
                {galleryItems.filter(i => i.type === 'video').length} videos
              </span>
            </div>
            <button
              onClick={loadGallery}
              className="p-2 rounded-lg hover:bg-[#8B5CF6]/10 text-[#9CA3AF] hover:text-[#8B5CF6] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {galleryLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
            </div>
          ) : galleryItems.length === 0 ? (
            <SectionCard>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-[#8B5CF6]/40" />
                </div>
                <h3 className="text-base font-medium text-[#F4F6FF] mb-2">No media yet</h3>
                <p className="text-[#9CA3AF] text-sm max-w-xs mb-6">
                  Generate your first image or video using the tabs above.
                </p>
                <button
                  onClick={() => setActiveTab('images')}
                  className="px-5 py-2.5 rounded-xl bg-[#8B5CF6] text-white font-medium text-sm transition-all hover:bg-[#8B5CF6]/90 min-h-[44px]"
                >
                  Start Creating
                </button>
              </div>
            </SectionCard>
          ) : (
            <MediaGallery
              items={galleryItems}
              onDelete={handleGalleryDelete}
              onFavorite={handleGalleryFavorite}
              onDownload={handleGalleryDownload}
            />
          )}
        </div>
      )}

      {/* ════════ Image Preview Lightbox ════════ */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[#9CA3AF] truncate flex-1 mr-4">{previewImage.prompt}</p>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] text-white font-medium text-sm hover:bg-[#8B5CF6]/90 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.15)] text-[#9CA3AF] hover:text-[#F4F6FF] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={previewImage.image_url}
              alt={previewImage.prompt || 'Generated image'}
              className="w-full rounded-2xl border border-[rgba(139,92,246,0.15)]"
              loading="lazy"
            />
            <div className="flex items-center gap-3 mt-3 text-xs text-[#9CA3AF]">
              {previewImage.width && previewImage.height && (
                <span>{previewImage.width}x{previewImage.height}</span>
              )}
              <span>{previewImage.model}</span>
              <span>{new Date(previewImage.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ════════ Video Preview Modal ════════ */}
      {previewVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[#9CA3AF] truncate flex-1 mr-4">{previewVideo.prompt}</p>
              <div className="flex items-center gap-2">
                <a
                  href={previewVideo.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] text-white font-medium text-sm hover:bg-[#8B5CF6]/90 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
                <button
                  onClick={() => setPreviewVideo(null)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.15)] text-[#9CA3AF] hover:text-[#F4F6FF] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <video
              src={previewVideo.video_url}
              controls
              autoPlay
              className="w-full rounded-2xl border border-[rgba(139,92,246,0.15)]"
            />
            <div className="flex items-center gap-3 mt-3 text-xs text-[#9CA3AF]">
              {previewVideo.width && previewVideo.height && (
                <span>{previewVideo.width}x{previewVideo.height}</span>
              )}
              <span>{previewVideo.model}</span>
              <span>{new Date(previewVideo.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ════════ Toast ════════ */}
      {toast && (
        <div className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success'
            ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20'
            : 'bg-[#FF6161]/15 text-[#FF6161] border border-[#FF6161]/20'
        }`}>
          {toast.text}
        </div>
      )}
    </PageShell>
  );
}
