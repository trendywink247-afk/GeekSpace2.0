// ============================================================
// ImageCreatorPage — state, data fetching, polling, layout shell
// UI is delegated to image-creator/ sub-components
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import {
  ImageIcon, Sparkles, Wand2,
  Zap, Upload, Images,
} from 'lucide-react';
import { imageService, picoService, agentService } from '@/services/api';
import type { UserImage, ImageModel } from '@/services/api';
import { BorderBeam } from '@/components/magicui/border-beam';
import {
  GenerateForm, ImageGallery, ImageCard, ShimmerCard,
  ImagePreviewModal, AgentPicker, ModelsPanel,
  type FleetAgent, type GenerationPhase, type TabId,
} from './';

export function ImageCreatorPage() {
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'image-creator' });

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<TabId>('generate');

  // ── Mode selection ──
  const [mode, setMode] = useState<'imagine' | 'edit' | null>(null);

  // ── Generation state (owned here so progress overlays work) ──
  const [generating,    setGenerating]    = useState(false);
  const [genPhase,      setGenPhase]      = useState<GenerationPhase>('idle');
  const [generateKey,   setGenerateKey]   = useState(0); // increment → reset GenerateForm

  // ── Gallery state ──
  const [images,         setImages]         = useState<UserImage[]>([]);
  const [imageCount,     setImageCount]     = useState(0);
  const [maxImages,      setMaxImages]      = useState(10);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [copiedId,       setCopiedId]       = useState<string | null>(null);
  const [previewImage,   setPreviewImage]   = useState<UserImage | null>(null);

  // ── Gallery tab filters ──
  const [galleryFilter,   setGalleryFilter]   = useState<'all' | 'generated' | 'edited'>('all');
  const [dateFrom,        setDateFrom]        = useState('');
  const [dateTo,          setDateTo]          = useState('');
  const [showDateFilter,  setShowDateFilter]  = useState(false);

  // ── Models ──
  const [models,              setModels]              = useState<ImageModel[]>([]);
  const [modelStatuses,       setModelStatuses]       = useState<Record<string, 'ok' | 'down' | 'unknown'>>({});
  const [preferredImageModel, setPreferredImageModel] = useState<string>('auto');
  const [savingModel,         setSavingModel]         = useState<string | null>(null);
  const [showModelsPanel,     setShowModelsPanel]     = useState(false);

  // ── Fleet agents ──
  const [assignedAgent,   setAssignedAgent]   = useState<FleetAgent | null>(null);
  const [fleetAgents,     setFleetAgents]     = useState<FleetAgent[]>([]);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agentLoading,    setAgentLoading]    = useState(true);

  // ── Toast ──
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Data loading ──
  const loadGallery = useCallback(async () => {
    try {
      const res = await imageService.list();
      setImages(res.data.images);
      setImageCount(res.data.count);
      setMaxImages(res.data.max);
    } catch { /* silently fail */ } finally {
      setGalleryLoading(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const res = await imageService.getModels();
      setModels(res.data.models);
    } catch { /* silently fail */ }
  }, []);

  const loadFleet = useCallback(async () => {
    try {
      const res = await picoService.getAgents();
      setFleetAgents(res.data);
      const savedSlot = localStorage.getItem('ig_assigned_agent');
      if (savedSlot) {
        const agent = res.data.find((a: FleetAgent) => a.slot === parseInt(savedSlot, 10));
        if (agent) setAssignedAgent(agent);
      }
    } catch { /* silently fail */ } finally {
      setAgentLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGallery();
    void loadModels();
    void loadFleet();
    imageService.getModelStatus()
      .then(res => setModelStatuses(res.data.statuses))
      .catch(() => {});
    agentService.getConfig()
      .then(res => { if (res.data.preferred_image_model) setPreferredImageModel(res.data.preferred_image_model); })
      .catch(() => {});
  }, [loadGallery, loadModels, loadFleet]);

  useEffect(() => {
    if (assignedAgent) localStorage.setItem('ig_assigned_agent', String(assignedAgent.slot));
    else localStorage.removeItem('ig_assigned_agent');
  }, [assignedAgent]);

  // ── Generation handler ──
  const handleGenerate = async (
    finalPrompt:   string,
    referenceUrl:  string,
    selectedModel: string,
    width:         number,
    height:        number,
  ) => {
    setGenerating(true);
    setGenPhase('submitting');
    void notifyStart(mode === 'edit' ? 'image-edit' : 'image-generate');
    try {
      setGenPhase('generating');
      if (mode === 'edit') {
        await imageService.edit(finalPrompt, referenceUrl || undefined, selectedModel);
      } else {
        await imageService.generate(finalPrompt, selectedModel, width, height);
      }
      setGenPhase('done');
      void notifyDone(`Image ${mode === 'edit' ? 'edited' : 'generated'} successfully`);
      showToast('Image generated! Check your gallery.');
      setGenerateKey(k => k + 1); // resets GenerateForm internal state
      await loadGallery();
      setTimeout(() => setGenPhase('idle'), 2000);
    } catch (err: unknown) {
      setGenPhase('error');
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Generation failed';
      void notifyFail(msg);
      showToast(msg, 'error');
      setTimeout(() => setGenPhase('idle'), 3000);
    } finally {
      setGenerating(false);
    }
  };

  // ── Image actions ──
  const handleDelete = async (id: string) => {
    try {
      await imageService.delete(id);
      showToast('Image deleted');
      await loadGallery();
      if (previewImage?.id === id) setPreviewImage(null);
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const handleCopyId = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSetDefaultModel = async (modelId: string) => {
    setSavingModel(modelId);
    try {
      await agentService.setImageModel(modelId);
      setPreferredImageModel(modelId);
    } catch { /* ignore */ } finally {
      setSavingModel(null);
    }
  };

  // ── Filtered images (gallery tab) ──
  const filteredImages = useMemo(() => {
    return images.filter(img => {
      if (galleryFilter === 'generated' && img.source === 'edited')  return false;
      if (galleryFilter === 'edited'    && img.source !== 'edited')  return false;
      if (dateFrom && new Date(img.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(img.created_at) > toDate) return false;
      }
      return true;
    });
  }, [images, galleryFilter, dateFrom, dateTo]);

  // ── Render ──
  return (
    <DashboardPageWrapper>
    <PageShell maxWidth="6xl">
    <div className="space-y-6 pb-24 md:pb-6 overflow-x-hidden">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-page-enter ${
          toast.type === 'success'
            ? 'bg-[#ADFF2F]/10 text-[#ADFF2F] border border-[#ADFF2F]/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {toast.text}
        </div>
      )}

      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <ImagePreviewModal
          image={previewImage}
          copiedId={copiedId}
          onClose={() => setPreviewImage(null)}
          onCopyId={handleCopyId}
        />
      )}

      {/* ── Page header ── */}
      <PageHeader
        icon={ImageIcon}
        title="Image Creator"
        subtitle={`Generate and manage AI images · ${imageCount}/${maxImages} saved`}
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#8B5CF6]/10 border border-[var(--ag-violet)]/30 text-[var(--ag-violet)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#8B5CF6]" />
            </span>
            Edith
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            {/* Credits badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-violet)]/20">
              <Zap className="w-4 h-4 text-[var(--ag-violet)]" />
              <div className="text-right">
                <div className="text-sm font-semibold text-[var(--ag-text-primary)]">{maxImages - imageCount}</div>
                <div className="text-[10px] text-[var(--ag-text-secondary)] leading-none">remaining</div>
              </div>
            </div>

            {/* Agent picker */}
            <AgentPicker
              assignedAgent={assignedAgent}
              fleetAgents={fleetAgents}
              agentLoading={agentLoading}
              showAgentPicker={showAgentPicker}
              setShowAgentPicker={setShowAgentPicker}
              onAssign={setAssignedAgent}
            />
          </div>
        }
      />

      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] w-fit">
        {([
          { id: 'generate' as const, label: 'Generate', icon: Sparkles },
          { id: 'gallery'  as const, label: 'Gallery',  icon: Images   },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.96] min-h-[44px] ${
              activeTab === tab.id
                ? 'bg-[#8B5CF6]/15 text-[var(--ag-violet)] border border-[var(--ag-violet)]/30 shadow-sm'
                : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'gallery' && images.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[var(--ag-violet)]">
                {images.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════ GENERATE TAB ════════════════ */}
      {activeTab === 'generate' && (
        <>
          {/* Mode selection cards */}
          <BlurFade delay={0.1} inView>
            <SectionCard>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  {
                    id: 'imagine' as const,
                    title: 'Imagine', subtitle: 'Text to image',
                    desc: 'Describe what you want and the AI will generate it from scratch.',
                    icon: Wand2,
                    activeBg: 'rgba(139,92,246,0.06)',
                    activeBorder: 'rgba(139,92,246,0.4)',
                    activeColor: '#8B5CF6',
                  },
                  {
                    id: 'edit' as const,
                    title: 'Upload & Edit', subtitle: 'Reference image + prompt',
                    desc: 'Upload an image as reference and describe the changes you want.',
                    icon: Upload,
                    activeBg: 'rgba(139,92,246,0.05)',
                    activeBorder: 'rgba(139,92,246,0.4)',
                    activeColor: 'var(--ag-cyan)',
                  },
                ]).map(card => {
                  const Icon = card.icon;
                  const isActive = mode === card.id;
                  return (
                    <button
                      key={card.id}
                      onClick={() => setMode(card.id)}
                      className={`relative p-6 rounded-2xl border text-left transition-all active:scale-[0.98] overflow-hidden ${
                        isActive
                          ? 'border-[var(--ag-violet)]/40'
                          : 'border-[var(--ag-border-default)] hover:border-[var(--ag-violet)]/30'
                      }`}
                      style={{
                        background: isActive ? card.activeBg : 'var(--ag-bg-surface)',
                        backdropFilter: 'blur(var(--ag-glass-blur))',
                        WebkitBackdropFilter: 'blur(var(--ag-glass-blur))',
                        borderColor: isActive ? card.activeBorder : undefined,
                      }}
                    >
                      {isActive && <BorderBeam size={150} duration={10} colorFrom="#8B5CF6" colorTo="#A78BFA" />}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: isActive ? `${card.activeColor}30` : 'var(--ag-bg-elevated)' }}
                        >
                          <Icon className="w-5 h-5" style={{ color: isActive ? card.activeColor : 'var(--ag-text-secondary)' }} />
                        </div>
                        <div>
                          <h3 className="text-[var(--ag-text-primary)] font-semibold">{card.title}</h3>
                          <p className="text-xs text-[var(--ag-text-secondary)]">{card.subtitle}</p>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--ag-text-secondary)]">{card.desc}</p>
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          </BlurFade>

          {/* Generate form */}
          {mode && (
            <BlurFade delay={0.2} inView>
              <GenerateForm
                key={generateKey}
                mode={mode}
                models={models}
                generating={generating}
                genPhase={genPhase}
                imageCount={imageCount}
                maxImages={maxImages}
                onGenerate={handleGenerate}
                onToast={showToast}
              />
            </BlurFade>
          )}

          {/* Quick gallery preview (5 most recent) */}
          {images.length > 0 && (
            <BlurFade delay={0.3} inView>
              <SectionCard>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-base font-semibold text-[var(--ag-text-primary)] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[var(--ag-violet)]" />
                    Recent Generations
                  </h2>
                  <button
                    onClick={() => setActiveTab('gallery')}
                    className="text-xs text-[var(--ag-violet)] hover:text-[var(--ag-violet)]/80 transition-colors"
                  >
                    View all in Gallery
                  </button>
                </div>
                {galleryLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <ShimmerCard key={i} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {images.slice(0, 5).map(img => (
                      <ImageCard
                        key={img.id}
                        img={img}
                        variant="grid"
                        onPreview={setPreviewImage}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            </BlurFade>
          )}

          {/* Empty state — no mode selected + no images */}
          {!mode && images.length === 0 && (
            <BlurFade delay={0.2} inView>
              <div className="rounded-2xl border border-dashed border-[var(--ag-violet)]/20 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="w-8 h-8 text-[var(--ag-violet)]/40" />
                </div>
                <p className="text-[var(--ag-text-primary)] text-sm font-medium mb-1">No images yet</p>
                <p className="text-[var(--ag-text-secondary)] text-xs max-w-xs mx-auto">
                  Choose Imagine or Upload &amp; Edit above to create your first AI image.
                </p>
              </div>
            </BlurFade>
          )}

          {/* Available models panel */}
          <ModelsPanel
            models={models}
            modelStatuses={modelStatuses}
            preferredImageModel={preferredImageModel}
            savingModel={savingModel}
            showModelsPanel={showModelsPanel}
            setShowModelsPanel={setShowModelsPanel}
            onSetDefault={handleSetDefaultModel}
          />
        </>
      )}

      {/* ════════════════ GALLERY TAB ════════════════ */}
      {activeTab === 'gallery' && (
        <ImageGallery
          filteredImages={filteredImages}
          galleryLoading={galleryLoading}
          galleryFilter={galleryFilter}
          setGalleryFilter={setGalleryFilter}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          showDateFilter={showDateFilter}
          setShowDateFilter={setShowDateFilter}
          onPreview={setPreviewImage}
          onDelete={handleDelete}
          onRefresh={loadGallery}
          onSwitchToGenerate={() => setActiveTab('generate')}
        />
      )}

    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
