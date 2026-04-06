// ============================================================
// Creative Studio — Unified creative hub (Image / Video / Templates / Gallery)
// Owner agent: Edith (#8B5CF6)
// Sub-components: creative-studio/ToolGrid, RecentCreations, ToolCard, helpers
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Palette, Download, X } from 'lucide-react';
import { imageService, videoService, templateService } from '@/services/api';
import type { UserImage, UserVideo } from '@/services/api';
import type { Template, TemplateCategory } from '@/types';
import { type MediaItem } from '@/components/MediaGallery';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { ToolGrid, RecentCreations, TABS } from './creative-studio';
import type { TabId } from './creative-studio';

export function CreativeStudioPage() {
  const [activeTab, setActiveTab] = useState<TabId>('images');
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'creative-studio' });

  // ─── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Image state ───────────────────────────────────────────────────────────
  const [imgPrompt, setImgPrompt]       = useState('');
  const [imgStyle,  setImgStyle]        = useState('');
  const [imgGenerating, setImgGenerating] = useState(false);
  const [images, setImages]             = useState<UserImage[]>([]);
  const [imgLoading, setImgLoading]     = useState(true);
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
    if (!imgPrompt.trim()) return;
    setImgGenerating(true);
    notifyStart('image-generate');
    try {
      const finalPrompt = imgStyle ? `${imgPrompt.trim()}, ${imgStyle} style` : imgPrompt.trim();
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

  // ─── Video state ───────────────────────────────────────────────────────────
  const [vidPrompt, setVidPrompt]         = useState('');
  const [vidGenerating, setVidGenerating] = useState(false);
  const [videos, setVideos]               = useState<UserVideo[]>([]);
  const [vidLoading, setVidLoading]       = useState(true);
  const [directorMode, setDirectorMode]   = useState(false);
  const [directorRunning, setDirectorRunning] = useState(false);
  const [directorJobId, setDirectorJobId]     = useState<string | null>(null);
  const [previewVideo, setPreviewVideo]       = useState<UserVideo | null>(null);
  const pollingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (!vidPrompt.trim()) return;

    if (directorMode) {
      if (directorRunning) return;
      setDirectorRunning(true);
      notifyStart('video-director');
      try {
        const res = await videoService.directorCreate(vidPrompt.trim());
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

    setVidGenerating(true);
    notifyStart('video-generate');
    try {
      const res = await videoService.generate(vidPrompt.trim(), 'auto', 1280, 720, 5);
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

  // ─── Template state ────────────────────────────────────────────────────────
  const [templates, setTemplates]           = useState<Template[]>([]);
  const [tplCategories, setTplCategories]   = useState<TemplateCategory[]>([]);
  const [tplLoading, setTplLoading]         = useState(true);
  const [tplCategory, setTplCategory]       = useState('all');
  const [tplSearch, setTplSearch]           = useState('');
  const [cloningId, setCloningId]           = useState<string | null>(null);
  const [clonedId, setClonedId]             = useState<string | null>(null);

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

  // ─── Gallery state ─────────────────────────────────────────────────────────
  const [galleryItems, setGalleryItems]     = useState<MediaItem[]>([]);
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
          ? (imagesRes.value.data.images || []).map(img => ({
              id: img.id, type: 'image' as const,
              url: img.image_url, prompt: img.prompt,
              createdAt: img.created_at, isFavorite: false,
              metadata: { width: img.width, height: img.height },
            }))
          : [];

      const vids: MediaItem[] =
        videosRes.status === 'fulfilled'
          ? (videosRes.value.data.videos || [])
              .filter(v => v.status === 'ready')
              .map(vid => ({
                id: vid.id, type: 'video' as const,
                url: vid.video_url, prompt: vid.prompt,
                createdAt: vid.created_at, isFavorite: false,
                metadata: { width: vid.width, height: vid.height },
              }))
          : [];

      setGalleryItems(
        [...imgs, ...vids].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
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
    setGalleryItems(prev => prev.map(item => item.id === id ? { ...item, isFavorite } : item));
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

  // ─── Load on tab switch ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'images')    loadImages();
    else if (activeTab === 'videos')    loadVideos();
    else if (activeTab === 'templates') loadTemplates();
    else if (activeTab === 'gallery')   loadGallery();
  }, [activeTab, loadImages, loadVideos, loadTemplates, loadGallery]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <PageShell>
        <PageHeader
          icon={Palette}
          title="Creative Studio"
          subtitle="Generate images, videos, browse templates, and manage your creations"
          badge={
            <span className="relative flex h-3 w-3" title="Owned by Edith">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ag-violet)] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--ag-violet)]" />
            </span>
          }
        />

        {/* Tab bar */}
        <SectionCard padding="sm" className="!p-1">
          <div className="flex items-center gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.96] min-h-[44px] ${
                    isActive
                      ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)] shadow-sm'
                      : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface)]/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Images tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'images' && (
          <ToolGrid
            mode="images"
            imgPrompt={imgPrompt}
            imgStyle={imgStyle}
            imgGenerating={imgGenerating}
            images={images}
            imgLoading={imgLoading}
            onPromptChange={setImgPrompt}
            onStyleChange={setImgStyle}
            onGenerate={handleImageGenerate}
            onRefresh={loadImages}
            onDelete={handleImageDelete}
            onPreview={setPreviewImage}
          />
        )}

        {/* ── Videos tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'videos' && (
          <RecentCreations
            mode="videos"
            vidPrompt={vidPrompt}
            vidGenerating={vidGenerating}
            directorMode={directorMode}
            directorRunning={directorRunning}
            videos={videos}
            vidLoading={vidLoading}
            onPromptChange={setVidPrompt}
            onDirectorToggle={() => setDirectorMode(d => !d)}
            onGenerate={handleVideoGenerate}
            onRefresh={loadVideos}
            onDelete={handleVideoDelete}
            onPreview={setPreviewVideo}
          />
        )}

        {/* ── Templates tab ──────────────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <ToolGrid
            mode="templates"
            templates={templates}
            tplCategories={tplCategories}
            tplLoading={tplLoading}
            tplCategory={tplCategory}
            tplSearch={tplSearch}
            cloningId={cloningId}
            clonedId={clonedId}
            onSearch={setTplSearch}
            onCategory={setTplCategory}
            onClone={handleTemplateClone}
          />
        )}

        {/* ── Gallery tab ────────────────────────────────────────────────────── */}
        {activeTab === 'gallery' && (
          <RecentCreations
            mode="gallery"
            galleryItems={galleryItems}
            galleryLoading={galleryLoading}
            onDelete={handleGalleryDelete}
            onFavorite={handleGalleryFavorite}
            onDownload={handleGalleryDownload}
            onRefresh={loadGallery}
            onStartCreating={() => setActiveTab('images')}
          />
        )}

        {/* ── Image preview lightbox ─────────────────────────────────────────── */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-[var(--ag-text-secondary)] truncate flex-1 mr-4">{previewImage.prompt}</p>
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
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <img
                src={previewImage.image_url}
                alt={previewImage.prompt || 'Generated image'}
                className="w-full rounded-2xl shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_8px_32px_rgba(0,0,0,0.5)] outline outline-1 -outline-offset-1 outline-white/10"
                loading="lazy"
              />
              <div className="flex items-center gap-3 mt-3 text-xs text-[var(--ag-text-secondary)]">
                {previewImage.width && previewImage.height && (
                  <span>{previewImage.width}x{previewImage.height}</span>
                )}
                <span>{previewImage.model}</span>
                <span>{new Date(previewImage.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Video preview modal ────────────────────────────────────────────── */}
        {previewVideo && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewVideo(null)}
          >
            <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-[var(--ag-text-secondary)] truncate flex-1 mr-4">{previewVideo.prompt}</p>
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
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors"
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
              <div className="flex items-center gap-3 mt-3 text-xs text-[var(--ag-text-secondary)]">
                {previewVideo.width && previewVideo.height && (
                  <span>{previewVideo.width}x{previewVideo.height}</span>
                )}
                <span>{previewVideo.model}</span>
                <span>{new Date(previewVideo.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Toast ──────────────────────────────────────────────────────────── */}
        {toast && (
          <div className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-[var(--ag-success)]/15 text-[var(--ag-success)] border border-[var(--ag-success)]/20'
              : 'bg-[var(--ag-error)]/15 text-[var(--ag-error)] border border-[var(--ag-error)]/20'
          }`}>
            {toast.text}
          </div>
        )}
      </PageShell>
    </DashboardPageWrapper>
  );
}
