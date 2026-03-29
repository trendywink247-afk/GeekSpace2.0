// ============================================================
// ImageCreatorPage — Unified Image Generate + Gallery
// Tabbed view: Generate | Gallery — both call imageService.list()
// Revamped: design tokens, PageHeader, SectionCard, edith ownership, useAgentCanvas
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PageShell, PageHeader } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  ImageIcon, Sparkles, Send, Loader2, Trash2, Copy, Check,
  Clock, Bot, Wifi, WifiOff, Upload, Wand2, ChevronDown,
  Download, X, ZoomIn, AlertCircle, Zap, Palette,
  Calendar, RefreshCw, Images, MessageCircle
} from 'lucide-react';
import { imageService, picoService, agentService } from '@/services/api';
import type { UserImage, ImageModel } from '@/services/api';
import { BorderBeam } from '@/components/magicui/border-beam';

// ---- Structured prompt builder options ----
const STYLE_OPTIONS = [
  'Photorealistic', 'Anime', 'Oil Painting', 'Watercolor',
  'Cyberpunk', 'Minimalist', 'Pixel Art', 'Digital Art',
  '3D Render', 'Sketch', 'Pop Art', 'Art Nouveau',
] as const;

const LIGHTING_OPTIONS = [
  'Natural', 'Studio', 'Dramatic', 'Neon', 'Golden Hour',
  'Cinematic', 'Soft Ambient', 'Backlit', 'Moonlight',
] as const;

const MOOD_OPTIONS = [
  'Happy', 'Dark', 'Serene', 'Epic', 'Mysterious',
  'Whimsical', 'Nostalgic', 'Futuristic', 'Romantic',
] as const;

type GenerationPhase = 'idle' | 'submitting' | 'generating' | 'done' | 'error';
type TabId = 'generate' | 'gallery';

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

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}

// ---- Shimmer placeholder for loading states ----
function ShimmerCard() {
  return (
    <div className="rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] overflow-hidden animate-pulse">
      <div className="aspect-square bg-[var(--ag-bg-elevated)]" />
      <div className="p-3 space-y-2">
        <div className="h-3 rounded bg-[var(--ag-bg-elevated)] w-3/4" />
        <div className="h-3 rounded bg-[var(--ag-bg-elevated)] w-1/2" />
      </div>
    </div>
  );
}

export function ImageCreatorPage() {
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'image-creator' });
  const [activeTab, setActiveTab] = useState<TabId>('generate');

  // Image generation state
  const [mode, setMode] = useState<'imagine' | 'edit' | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [models, setModels] = useState<ImageModel[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);

  // Structured prompt builder state
  const [promptStyle, setPromptStyle] = useState('');
  const [promptLighting, setPromptLighting] = useState('');
  const [promptMood, setPromptMood] = useState('');
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const [genPhase, setGenPhase] = useState<GenerationPhase>('idle');

  // Edit mode state
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referencePreview, setReferencePreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared gallery state (both tabs use the same imageService.list())
  const [images, setImages] = useState<UserImage[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [maxImages, setMaxImages] = useState(10);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<UserImage | null>(null);

  // Gallery tab filters
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'generated' | 'edited'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Agent state
  const [assignedAgent, setAssignedAgent] = useState<FleetAgent | null>(null);
  const [fleetAgents, setFleetAgents] = useState<FleetAgent[]>([]);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agentLoading, setAgentLoading] = useState(true);

  // Model status panel
  const [modelStatuses, setModelStatuses] = useState<Record<string, 'ok' | 'down' | 'unknown'>>({});
  const [preferredImageModel, setPreferredImageModel] = useState<string>('auto');
  const [savingModel, setSavingModel] = useState<string | null>(null);
  const [showModelsPanel, setShowModelsPanel] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // Load gallery — single source of truth using imageService.list()
  const loadGallery = useCallback(async () => {
    try {
      const res = await imageService.list();
      setImages(res.data.images);
      setImageCount(res.data.count);
      setMaxImages(res.data.max);
    } catch {
      // silently fail — UI shows empty gallery
    } finally {
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
    loadGallery();
    loadModels();
    loadFleet();
    imageService.getModelStatus().then(res => setModelStatuses(res.data.statuses)).catch(() => {});
    agentService.getConfig().then(res => {
      const pref = res.data.preferred_image_model;
      if (pref) setPreferredImageModel(pref);
    }).catch(() => {});
  }, [loadGallery, loadModels, loadFleet]);

  useEffect(() => {
    if (assignedAgent) localStorage.setItem('ig_assigned_agent', String(assignedAgent.slot));
    else localStorage.removeItem('ig_assigned_agent');
  }, [assignedAgent]);

  // Build enhanced prompt from structured inputs
  const buildEnhancedPrompt = (): string => {
    const parts: string[] = [];
    if (prompt.trim()) parts.push(prompt.trim());
    if (promptStyle) parts.push(`${promptStyle} style`);
    if (promptLighting) parts.push(`${promptLighting} lighting`);
    if (promptMood) parts.push(`${promptMood} mood`);
    return parts.join(', ');
  };

  const handleEnhancePrompt = () => {
    if (!prompt.trim()) return;
    const enhanced = buildEnhancedPrompt();
    const qualityKeywords = ['highly detailed', '8k resolution', 'masterpiece'];
    const lower = enhanced.toLowerCase();
    const extras = qualityKeywords.filter(kw => !lower.includes(kw));
    const finalPrompt = extras.length > 0 ? `${enhanced}, ${extras.join(', ')}` : enhanced;
    setPrompt(finalPrompt);
    setPromptStyle('');
    setPromptLighting('');
    setPromptMood('');
    showToast('Prompt enhanced with style keywords!');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenPhase('submitting');
    void notifyStart(mode === 'edit' ? 'image-edit' : 'image-generate');
    try {
      const finalPrompt = promptStyle || promptLighting || promptMood
        ? buildEnhancedPrompt()
        : prompt.trim();
      setGenPhase('generating');
      if (mode === 'edit') {
        await imageService.edit(finalPrompt, referenceUrl || undefined, selectedModel);
      } else {
        await imageService.generate(finalPrompt, selectedModel, width, height);
      }
      setGenPhase('done');
      void notifyDone(`Image ${mode === 'edit' ? 'edited' : 'generated'} successfully`);
      showToast('Image generated! Check your gallery.');
      setPrompt('');
      setPromptStyle('');
      setPromptLighting('');
      setPromptMood('');
      setReferenceUrl('');
      setReferencePreview('');
      await loadGallery();
      setTimeout(() => setGenPhase('idle'), 2000);
    } catch (err: unknown) {
      setGenPhase('error');
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Generation failed';
      void notifyFail(msg);
      showToast(msg, 'error');
      setTimeout(() => setGenPhase('idle'), 3000);
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setReferencePreview(dataUrl);
      setReferenceUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

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
    navigator.clipboard.writeText(id);
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

  const currentModel = models.find(m => m.id === selectedModel) || models[0];
  const sizePresets = [
    { label: 'Square', w: 1024, h: 1024 },
    { label: 'Landscape', w: 1280, h: 720 },
    { label: 'Portrait', w: 720, h: 1280 },
    { label: 'Wide', w: 1536, h: 640 },
  ];

  // Gallery filtered images
  const filteredImages = useMemo(() => {
    return images.filter(img => {
      if (galleryFilter === 'generated' && img.source === 'edited') return false;
      if (galleryFilter === 'edited' && img.source !== 'edited') return false;
      if (dateFrom && new Date(img.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(img.created_at) > toDate) return false;
      }
      return true;
    });
  }, [images, galleryFilter, dateFrom, dateTo]);

  return (
    <PageShell maxWidth="6xl">
    <div className="space-y-6 pb-24 md:pb-6 overflow-x-hidden">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-page-enter ${
          toast.type === 'success' ? 'bg-[#ADFF2F]/10 text-[#ADFF2F] border border-[#ADFF2F]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {toast.text}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[var(--ag-text-secondary)] truncate flex-1 mr-4">{previewImage.prompt}</div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] text-white font-medium text-sm hover:bg-[#7C3AED] transition-colors"
                  aria-label="Download image"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent('Check out what I created with Agentin! ' + previewImage.image_url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2 min-w-[44px] min-h-[44px] bg-[#25D366]/20 text-[#25D366] rounded-lg hover:bg-[#25D366]/30 transition-colors font-medium text-sm"
                  aria-label="Share on WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={previewImage.image_url}
              alt={previewImage.prompt}
              className="w-full rounded-2xl border border-[var(--ag-border-glow)]"
              loading="lazy"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                {previewImage.width && previewImage.height && (
                  <span className="text-xs text-[var(--ag-text-secondary)]">{previewImage.width}x{previewImage.height}</span>
                )}
                <span className="text-xs text-[var(--ag-text-secondary)]">{previewImage.model}</span>
              </div>
              <button
                onClick={() => handleCopyId(previewImage.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-xs text-[var(--ag-text-secondary)] hover:text-[#8B5CF6] transition-colors"
              >
                {copiedId === previewImage.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === previewImage.id ? 'Copied!' : previewImage.id}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header -- Edith ownership */}
      <PageHeader
        icon={ImageIcon}
        title="Image Creator"
        subtitle={`Generate and manage AI images \u00b7 ${imageCount}/${maxImages} saved`}
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#8B5CF6]">
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--ag-bg-surface)] border border-[#8B5CF6]/20">
              <Zap className="w-4 h-4 text-[#8B5CF6]" />
              <div className="text-right">
                <div className="text-sm font-semibold text-[var(--ag-text-primary)]">{maxImages - imageCount}</div>
                <div className="text-[10px] text-[var(--ag-text-secondary)] leading-none">remaining</div>
              </div>
            </div>

            {/* Agent picker */}
            <div className="relative">
              {assignedAgent ? (
                <button
                  onClick={() => setShowAgentPicker(!showAgentPicker)}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/5 hover:border-[#00FF88]/40 transition-colors"
              >
                <span className="text-lg">
                  {assignedAgent.personality === 'edith' ? '⚡' : assignedAgent.personality === 'jarvis' ? '🎩' : '🤖'}
                </span>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--ag-text-primary)]">{assignedAgent.name}</div>
                  <div className="text-xs text-[var(--ag-text-secondary)]">Assigned agent</div>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor[assignedAgent.status] || '#6B7280' }} />
                <ChevronDown className="w-3.5 h-3.5 text-[var(--ag-text-secondary)]" />
              </button>
            ) : (
              <button
                onClick={() => setShowAgentPicker(!showAgentPicker)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[var(--ag-border-default)] hover:border-[#8B5CF6]/40 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors text-sm"
              >
                <Bot className="w-4 h-4" />
                {agentLoading ? 'Loading...' : 'Assign Agent'}
              </button>
            )}

            {showAgentPicker && (
              <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-[var(--ag-border-default)] bg-[var(--ag-bg-surface)] shadow-2xl z-30 overflow-hidden"
                style={{ backdropFilter: 'blur(var(--ag-glass-blur))' }}>
                <div className="p-3 border-b border-[var(--ag-border-subtle)]">
                  <p className="text-xs text-[var(--ag-text-secondary)]">Choose an agent from your fleet</p>
                </div>
                {fleetAgents.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[var(--ag-text-secondary)]">
                    No agents in your fleet. Deploy one from the Fleet page.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {assignedAgent && (
                      <button
                        onClick={() => { setAssignedAgent(null); setShowAgentPicker(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/5 transition-colors text-left border-b border-[var(--ag-border-subtle)]"
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
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#8B5CF6]/5 transition-colors text-left ${isAssigned ? 'bg-[#00FF88]/5' : ''}`}
                        >
                          <span className="text-lg">
                            {agent.personality === 'edith' ? '⚡' : agent.personality === 'jarvis' ? '🎩' : '🤖'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--ag-text-primary)]">{agent.name}</div>
                            <div className="text-xs text-[var(--ag-text-secondary)]">Slot {agent.slot} &middot; {agent.tasks_completed} tasks</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {agent.status === 'active' ? <Wifi className="w-3 h-3" style={{ color }} /> : <WifiOff className="w-3 h-3" style={{ color }} />}
                            <span className="text-xs capitalize" style={{ color }}>{agent.status}</span>
                          </div>
                          {isAssigned && <Check className="w-4 h-4 text-[#00FF88]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        }
      />

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] w-fit">
        {([
          { id: 'generate' as const, label: 'Generate', icon: Sparkles },
          { id: 'gallery' as const, label: 'Gallery', icon: Images },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              activeTab === tab.id
                ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30 shadow-sm'
                : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'gallery' && images.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6]">
                {images.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* === GENERATE TAB === */}
      {activeTab === 'generate' && (
        <>
          {/* Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                id: 'imagine' as const,
                title: 'Imagine',
                subtitle: 'Text to image',
                desc: 'Describe what you want and the AI will generate it from scratch.',
                icon: Wand2,
                activeColor: '#8B5CF6',
                activeBg: 'rgba(139,92,246,0.06)',
                activeBorder: 'rgba(139,92,246,0.4)',
              },
              {
                id: 'edit' as const,
                title: 'Upload & Edit',
                subtitle: 'Reference image + prompt',
                desc: 'Upload an image as reference and describe the changes you want.',
                icon: Upload,
                activeColor: 'var(--ag-cyan)',
                activeBg: 'rgba(139,92,246,0.05)',
                activeBorder: 'rgba(139,92,246,0.4)',
              },
            ].map(card => {
              const Icon = card.icon;
              const isActive = mode === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setMode(card.id)}
                  className={`relative p-6 rounded-2xl border text-left transition-all group cursor-pointer overflow-hidden ${
                    isActive ? 'border-[#8B5CF6]/40' : 'border-[var(--ag-border-default)] hover:border-[#8B5CF6]/30'
                  }`}
                  style={{
                    background: isActive ? card.activeBg : 'var(--ag-bg-surface)',
                    backdropFilter: 'blur(var(--ag-glass-blur))',
                    WebkitBackdropFilter: 'blur(var(--ag-glass-blur))',
                    borderColor: isActive ? card.activeBorder : undefined,
                  }}
                >
                  {isActive && <BorderBeam size={150} duration={10} colorFrom="#8B5CF6" colorTo="#8B5CF6" />}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: isActive ? `${card.activeColor}30` : 'var(--ag-bg-elevated)' }}>
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

          {/* Generation Panel */}
          {mode && (
            <div
              className="relative rounded-2xl border overflow-hidden p-6"
              style={{
                borderColor: mode === 'imagine' ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.2)',
                background: mode === 'imagine' ? 'rgba(139,92,246,0.03)' : 'rgba(139,92,246,0.03)',
              }}
            >
              {/* Reference image upload (edit mode) */}
              {mode === 'edit' && (
                <div className="mb-5">
                  <label className="text-sm text-[var(--ag-text-secondary)] mb-2 block">Reference Image (optional)</label>
                  <div className="flex gap-3 items-start">
                    {referencePreview ? (
                      <div className="relative group">
                        <img src={referencePreview} alt="Reference" className="w-24 h-24 rounded-xl object-cover border border-[var(--ag-border-glow)]" />
                        <button
                          onClick={() => { setReferencePreview(''); setReferenceUrl(''); }}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#FF6161] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove reference image"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-xl border-2 border-dashed border-[var(--ag-border-default)] hover:border-[#8B5CF6]/40 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                        aria-label="Upload reference image"
                      >
                        <Upload className="w-5 h-5 text-[var(--ag-text-secondary)]" />
                        <span className="text-xs text-[var(--ag-text-secondary)]">Upload</span>
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    <p className="text-xs text-[var(--ag-text-secondary)] mt-1 flex-1">
                      Upload a reference image and describe the edits you want.
                    </p>
                  </div>
                </div>
              )}

              {/* Model pill buttons + Size presets */}
              <div className="flex flex-wrap gap-3 mb-4">
                {/* Model selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-default)] text-sm text-[var(--ag-text-primary)] hover:border-[#8B5CF6]/40 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    {currentModel?.name || 'Select Model'}
                    {currentModel?.tier === 'auto' ? (
                      <span className="text-xs text-[var(--ag-violet)] ml-1">Auto</span>
                    ) : currentModel?.credits ? (
                      <span className="text-xs text-[#FFB800] ml-1">{currentModel.credits}cr</span>
                    ) : (
                      <span className="text-xs text-[#00FF88] ml-1">Free</span>
                    )}
                    <ChevronDown className="w-3 h-3 text-[var(--ag-text-secondary)]" />
                  </button>

                  {showModelPicker && (
                    <div className="absolute top-full left-0 mt-2 w-80 rounded-xl border border-[var(--ag-border-default)] bg-[var(--ag-bg-surface)] shadow-2xl z-20 overflow-hidden"
                      style={{ backdropFilter: 'blur(var(--ag-glass-blur))' }}>
                      {models.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#8B5CF6]/5 transition-colors text-left ${selectedModel === m.id ? 'bg-[#8B5CF6]/10' : ''}`}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-[var(--ag-text-primary)]">{m.name}</div>
                            <div className="text-xs text-[var(--ag-text-secondary)]">{m.description}</div>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            m.tier === 'auto' ? 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)]' :
                            m.tier === 'free' ? 'bg-[#00FF88]/10 text-[#00FF88]' :
                            m.tier === 'premium' ? 'bg-[#FFB800]/10 text-[#FFB800]' :
                            'bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)]'
                          }`}>
                            {m.cost}
                          </span>
                          {selectedModel === m.id && <Check className="w-4 h-4 text-[#8B5CF6] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Size presets as pill buttons */}
                {mode === 'imagine' && (
                  <div className="flex gap-1.5 flex-wrap">
                    {sizePresets.map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => { setWidth(preset.w); setHeight(preset.h); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[44px] ${
                          width === preset.w && height === preset.h
                            ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/40 shadow-[0_0_8px_rgba(139,92,246,0.2)]'
                            : 'bg-[var(--ag-bg-deep)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:border-[#8B5CF6]/30'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Prompt builder (imagine mode only) */}
              {mode === 'imagine' && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowPromptBuilder(!showPromptBuilder)}
                    className="flex items-center gap-2 text-xs text-[#8B5CF6]/80 hover:text-[#8B5CF6] transition-colors mb-3"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    {showPromptBuilder ? 'Hide' : 'Show'} Prompt Builder
                    <ChevronDown className={`w-3 h-3 transition-transform ${showPromptBuilder ? 'rotate-180' : ''}`} />
                  </button>

                  {showPromptBuilder && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[var(--ag-bg-deep)] border border-[#8B5CF6]/15">
                      {[
                        { label: 'Style', value: promptStyle, onChange: setPromptStyle, options: STYLE_OPTIONS },
                        { label: 'Lighting', value: promptLighting, onChange: setPromptLighting, options: LIGHTING_OPTIONS },
                        { label: 'Mood', value: promptMood, onChange: setPromptMood, options: MOOD_OPTIONS },
                      ].map(({ label, value, onChange, options }) => (
                        <div key={label}>
                          <label className="text-[10px] uppercase tracking-wider text-[var(--ag-text-secondary)] mb-1.5 block font-medium">{label}</label>
                          <select
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="w-full bg-[var(--ag-bg-surface)] border border-[#8B5CF6]/20 rounded-lg px-3 py-2 text-sm text-[var(--ag-text-primary)] outline-none focus:border-[#8B5CF6]/50 appearance-none cursor-pointer"
                          >
                            <option value="">Select {label.toLowerCase()}...</option>
                            {options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prompt input */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === 'edit' ? 'Describe the changes you want to make...' : 'Describe the image you want to generate...'}
                rows={3}
                className={`w-full bg-[var(--ag-bg-deep)] border rounded-xl px-4 py-3 text-[var(--ag-text-primary)] placeholder-[#6B7280]/50 resize-none outline-none text-sm ${
                  mode === 'imagine'
                    ? 'border-[#8B5CF6]/20 focus:border-[#8B5CF6]/50'
                    : 'border-[var(--ag-border-glow)] focus:border-[var(--ag-border-active)]'
                }`}
              />

              {/* Enhance prompt */}
              {mode === 'imagine' && prompt.trim() && (
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleEnhancePrompt}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-xs text-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    Enhance Prompt
                  </button>
                  {(promptStyle || promptLighting || promptMood) && (
                    <span className="text-[10px] text-[var(--ag-text-secondary)]">
                      Will add: {[promptStyle, promptLighting, promptMood].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              )}

              {/* Generation progress */}
              {genPhase !== 'idle' && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    {(['submitting', 'generating', 'done'] as const).map((step, i) => {
                      const isActive = step === genPhase;
                      const isPast = (genPhase === 'generating' && i === 0) || (genPhase === 'done' && i <= 1);
                      const isFailed = genPhase === 'error' && step === 'generating';
                      return (
                        <div key={step} className="flex items-center gap-2">
                          {i > 0 && <div className={`w-8 h-0.5 rounded-full ${isPast ? 'bg-[#8B5CF6]' : 'bg-[#1A1A2E]'}`} />}
                          <div className={`flex items-center gap-1 text-xs font-medium transition-all ${
                            isFailed ? 'text-[#FF6161]' : isActive ? 'text-[#8B5CF6]' : isPast ? 'text-[#8B5CF6]/60' : 'text-[var(--ag-text-secondary)]/40'
                          }`}>
                            {isActive && genPhase !== 'done' && <Loader2 className="w-3 h-3 animate-spin" />}
                            {isPast && <Check className="w-3 h-3" />}
                            {isFailed && <AlertCircle className="w-3 h-3" />}
                            <span className="capitalize">{step === 'submitting' ? 'Sending' : step === 'generating' ? 'Creating' : 'Complete'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {genPhase === 'generating' && (
                    <div className="w-full h-1 rounded-full bg-[var(--ag-bg-deep)] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#8B5CF6] rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                </div>
              )}

              {/* Generate button */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs">
                  {imageCount >= maxImages ? (
                    <span className="px-2.5 py-1 rounded-lg bg-[#FF6161]/10 border border-[#FF6161]/20 text-[#FF6161] font-medium">Image limit reached ({maxImages}/{maxImages})</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/15 text-[#8B5CF6]">
                      <strong>{maxImages - imageCount}</strong> credits remaining &middot; {width}x{height}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !prompt.trim() || imageCount >= maxImages}
                  className="glow-hover flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-[#8B5CF6] text-white font-semibold text-sm hover:bg-[#7C3AED] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                  ) : (
                    <><Send className="w-4 h-4" />{mode === 'edit' ? 'Generate Edit' : 'Imagine'}</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Quick Gallery preview in Generate tab */}
          {images.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#8B5CF6]" />
                  Recent Generations
                </h2>
                <button
                  onClick={() => setActiveTab('gallery')}
                  className="text-xs text-[#8B5CF6] hover:text-[#8B5CF6]/80 transition-colors"
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
                    <div
                      key={img.id}
                      className="group relative rounded-2xl border border-[var(--ag-border-subtle)] overflow-hidden hover:border-[#8B5CF6]/40 hover:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all bg-[var(--ag-bg-surface)]"
                    >
                      <div className="aspect-square cursor-pointer relative" onClick={() => setPreviewImage(img)}>
                        <img src={img.image_url} alt={img.prompt} className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                        <a
                          href={img.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#8B5CF6]/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#7C3AED] z-10"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Download image"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-[var(--ag-text-primary)] truncate mb-1">{img.prompt}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[var(--ag-text-secondary)]" />
                            <span className="text-xs text-[var(--ag-text-secondary)]">{timeLeft(img.expires_at)}</span>
                          </div>
                          <button
                            onClick={() => void handleDelete(img.id)}
                            className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--ag-text-secondary)] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors"
                            aria-label="Delete image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state for generate tab */}
          {!mode && images.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#8B5CF6]/20 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-8 h-8 text-[#8B5CF6]/40" />
              </div>
              <p className="text-[var(--ag-text-primary)] text-sm font-medium mb-1">No images yet</p>
              <p className="text-[var(--ag-text-secondary)] text-xs max-w-xs mx-auto">
                Choose Imagine or Upload & Edit above to create your first AI image.
              </p>
            </div>
          )}

          {/* Available Models panel */}
          {models.length > 0 && (
            <div className="rounded-2xl border border-[var(--ag-border-subtle)] overflow-hidden">
              <button
                onClick={() => setShowModelsPanel(p => !p)}
                className="w-full flex items-center justify-between p-4 hover:bg-[#8B5CF6]/5 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-sm font-semibold text-[var(--ag-text-primary)]">Available Image Models</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[var(--ag-text-secondary)] transition-transform ${showModelsPanel ? 'rotate-180' : ''}`} />
              </button>

              {showModelsPanel && (
                <div className="border-t border-[var(--ag-border-subtle)] divide-y divide-[var(--ag-border-subtle)]">
                  {models.map(model => {
                    const status = modelStatuses[model.id] ?? 'unknown';
                    const isDefault = preferredImageModel === model.id;
                    const isSaving = savingModel === model.id;
                    return (
                      <div key={model.id} className={`flex items-center gap-4 px-4 py-3 ${isDefault ? 'bg-[#8B5CF6]/5' : ''}`}>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          status === 'ok' ? 'bg-[#00FF88]' : status === 'down' ? 'bg-[#FF6161]' : 'bg-[#6B7280]'
                        }`} title={status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[var(--ag-text-primary)]">{model.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              model.tier === 'auto' ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)]' :
                              model.tier === 'free' ? 'bg-[#00FF88]/15 text-[#00FF88]' :
                              model.tier === 'premium' ? 'bg-[#FFB800]/15 text-[#FFB800]' :
                              'bg-[var(--ag-cyan)]/15 text-[var(--ag-cyan)]'
                            }`}>{model.cost}</span>
                            {isDefault && <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">Default</span>}
                          </div>
                          <div className="text-xs text-[var(--ag-text-secondary)] mt-0.5">{model.description}</div>
                        </div>
                        <button
                          onClick={() => void handleSetDefaultModel(model.id)}
                          disabled={isSaving || isDefault}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors min-h-[44px] ${
                            isDefault
                              ? 'text-[#8B5CF6] cursor-default'
                              : 'text-[var(--ag-text-secondary)] hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 border border-[var(--ag-border-subtle)]'
                          }`}
                        >
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : isDefault ? 'Default' : 'Set Default'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* === GALLERY TAB === */}
      {activeTab === 'gallery' && (
        <>
          {/* Gallery controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] rounded-lg p-0.5">
              {(['all', 'generated', 'edited'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setGalleryFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all min-h-[44px] ${
                    galleryFilter === f
                      ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30'
                      : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg border text-xs transition-colors ${
                  showDateFilter || dateFrom || dateTo
                    ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#8B5CF6]'
                    : 'bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {dateFrom || dateTo ? 'Filtered' : 'Date'}
              </button>
              <button
                onClick={() => void loadGallery()}
                disabled={galleryLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-xs text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${galleryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Date filter panel */}
          {showDateFilter && (
            <div className="flex items-center gap-3 flex-wrap px-1">
              {[
                { label: 'From:', value: dateFrom, onChange: setDateFrom },
                { label: 'To:', value: dateTo, onChange: setDateTo },
              ].map(({ label, value, onChange }) => (
                <div key={label} className="flex items-center gap-2">
                  <label className="text-xs text-[var(--ag-text-secondary)]">{label}</label>
                  <input
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--ag-text-primary)] outline-none focus:border-[#8B5CF6]/40"
                  />
                </div>
              ))}
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-[#FF6161] hover:text-[#FF6161]/80 transition-colors">
                  Clear dates
                </button>
              )}
            </div>
          )}

          {/* Gallery loading shimmer */}
          {galleryLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <ShimmerCard key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!galleryLoading && filteredImages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center rounded-2xl border border-dashed border-[#8B5CF6]/15">
              <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-1">
                <ImageIcon className="w-8 h-8 text-[#8B5CF6]/40" />
              </div>
              <p className="text-[var(--ag-text-primary)] text-sm font-medium">No images yet</p>
              <p className="text-[var(--ag-text-secondary)] text-xs max-w-xs">
                Generate some with AI using the Generate tab. Your creations will appear here.
              </p>
              <button
                onClick={() => setActiveTab('generate')}
                className="mt-2 px-4 py-2 rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6] text-sm font-medium hover:bg-[#8B5CF6]/25 transition-colors border border-[#8B5CF6]/30 min-h-[44px]"
              >
                Start Generating
              </button>
            </div>
          )}

          {/* Masonry grid */}
          {!galleryLoading && filteredImages.length > 0 && (
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-4">
              {filteredImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative rounded-xl overflow-hidden border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-deep)] hover:border-[#8B5CF6]/40 hover:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all cursor-pointer mb-4"
                  style={{ breakInside: 'avoid' }}
                  onClick={() => setPreviewImage(img)}
                >
                  <div className="bg-[var(--ag-bg-surface)]">
                    <img
                      src={img.image_url}
                      alt={img.prompt || 'Generated image'}
                      className="w-full h-auto object-cover transition-transform group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={img.image_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#8B5CF6]/90 text-white hover:bg-[#7C3AED] transition-colors shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Download image"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent('Check out what I created with Agentin! ' + img.image_url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#25D366]/80 text-white hover:bg-[#25D366] transition-colors shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Share on WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(img.id); }}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#FF6161]/80 text-white hover:bg-[#FF6161] transition-colors shadow-lg"
                        aria-label="Delete image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ag-text-primary)] line-clamp-2 mb-1">{img.prompt ?? ''}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--ag-text-secondary)]">{new Date(img.created_at).toLocaleDateString()}</span>
                        {img.width && img.height && <span className="text-[10px] text-[var(--ag-text-secondary)]/60">{img.width}x{img.height}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Bottom bar (always visible on mobile) */}
                  <div className="px-2.5 py-2 border-t border-[var(--ag-border-subtle)] flex items-center justify-between gap-1 sm:group-hover:opacity-0 transition-opacity">
                    <p className="text-xs text-[var(--ag-text-secondary)] truncate flex-1">{img.prompt ?? ''}</p>
                    <a
                      href={img.image_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center min-w-[44px] min-h-[44px] text-[#8B5CF6] hover:text-[#8B5CF6]/80 transition-colors flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Download image"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
    </PageShell>
  );
}
