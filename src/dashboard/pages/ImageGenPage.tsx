import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ImageIcon, Sparkles, Send, Loader2, Trash2, Copy, Check,
  Clock, Bot, Wifi, WifiOff, Upload, Wand2, ChevronDown,
  Download, X, ZoomIn, AlertCircle, Zap, Palette
} from 'lucide-react';
import { imageService, picoService, agentService } from '@/services/api';
import type { UserImage, ImageModel } from '@/services/api';

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

export function ImageGenPage() {
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

  // Gallery state
  const [images, setImages] = useState<UserImage[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [maxImages, setMaxImages] = useState(10);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<UserImage | null>(null);

  // Agent state
  const [assignedAgent, setAssignedAgent] = useState<FleetAgent | null>(null);
  const [fleetAgents, setFleetAgents] = useState<FleetAgent[]>([]);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agentLoading, setAgentLoading] = useState(true);

  // Image models panel
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

  // Load gallery
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

  // Load models
  const loadModels = useCallback(async () => {
    try {
      const res = await imageService.getModels();
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
      // Try to restore saved assigned agent
      const savedSlot = localStorage.getItem('ig_assigned_agent');
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
    // Load model statuses and user preference
    imageService.getModelStatus().then(res => setModelStatuses(res.data.statuses)).catch(() => {});
    agentService.getConfig().then(res => {
      const pref = res.data.preferred_image_model;
      if (pref) setPreferredImageModel(pref);
    }).catch(() => {});
  }, [loadGallery, loadModels, loadFleet]);

  // Save assigned agent to localStorage
  useEffect(() => {
    if (assignedAgent) {
      localStorage.setItem('ig_assigned_agent', String(assignedAgent.slot));
    } else {
      localStorage.removeItem('ig_assigned_agent');
    }
  }, [assignedAgent]);

  // Build the enhanced prompt from structured inputs
  const buildEnhancedPrompt = (): string => {
    const parts: string[] = [];
    if (prompt.trim()) parts.push(prompt.trim());
    if (promptStyle) parts.push(`${promptStyle} style`);
    if (promptLighting) parts.push(`${promptLighting} lighting`);
    if (promptMood) parts.push(`${promptMood} mood`);
    return parts.join(', ');
  };

  // "Enhance prompt" — frontend-only enrichment
  const handleEnhancePrompt = () => {
    if (!prompt.trim()) return;
    const enhanced = buildEnhancedPrompt();
    // Add quality keywords if not already present
    const qualityKeywords = ['highly detailed', '8k resolution', 'masterpiece'];
    const lower = enhanced.toLowerCase();
    const extras = qualityKeywords.filter(kw => !lower.includes(kw));
    const finalPrompt = extras.length > 0 ? `${enhanced}, ${extras.join(', ')}` : enhanced;
    setPrompt(finalPrompt);
    // Reset dropdowns so they do not double-apply
    setPromptStyle('');
    setPromptLighting('');
    setPromptMood('');
    showToast('Prompt enhanced with style keywords!');
  };

  // Handle image generation
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenPhase('submitting');
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
      showToast('Image generated! Check your gallery below.');
      setPrompt('');
      setPromptStyle('');
      setPromptLighting('');
      setPromptMood('');
      setReferenceUrl('');
      setReferencePreview('');
      await loadGallery();
      // Reset phase after brief success display
      setTimeout(() => setGenPhase('idle'), 2000);
    } catch (err: unknown) {
      setGenPhase('error');
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Generation failed';
      showToast(msg, 'error');
      setTimeout(() => setGenPhase('idle'), 3000);
    } finally {
      setGenerating(false);
    }
  };

  // Handle file upload for reference
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image too large (max 5MB)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setReferencePreview(dataUrl);
      setReferenceUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Handle delete
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

  // Copy image ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Set default image model
  const handleSetDefaultModel = async (modelId: string) => {
    setSavingModel(modelId);
    try {
      await agentService.setImageModel(modelId);
      setPreferredImageModel(modelId);
    } catch {
      // ignore silently — user can retry
    } finally {
      setSavingModel(null);
    }
  };

  const currentModel = models.find(m => m.id === selectedModel) || models[0];

  // Size presets
  const sizePresets = [
    { label: 'Square', w: 1024, h: 1024 },
    { label: 'Landscape', w: 1280, h: 720 },
    { label: 'Portrait', w: 720, h: 1280 },
    { label: 'Wide', w: 1536, h: 640 },
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-6">
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
              <div className="text-sm text-[#9CA3AF] truncate flex-1 mr-4">
                {previewImage.prompt}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#00F0FF] text-[#06060B] font-medium text-sm hover:bg-[#00F0FF]/90 transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                  aria-label="Download image"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#9CA3AF] hover:text-[#E8E8F0] transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={previewImage.image_url}
              alt={previewImage.prompt}
              className="w-full rounded-2xl border border-[#00F0FF]/20"
              loading="lazy"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#9CA3AF]">{previewImage.width}x{previewImage.height}</span>
                <span className="text-xs text-[#9CA3AF]">{previewImage.model}</span>
              </div>
              <button
                onClick={() => handleCopyId(previewImage.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-xs text-[#9CA3AF] hover:text-[#00F0FF] transition-colors"
              >
                {copiedId === previewImage.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === previewImage.id ? 'Copied!' : previewImage.id}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8F0]">Image Generator</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Create and edit AI images &middot; {imageCount}/{maxImages} saved
          </p>
        </div>

        {/* Credit counter badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0C0C18] border border-[#ADFF2F]/20">
            <Zap className="w-4 h-4 text-[#ADFF2F]" />
            <div className="text-right">
              <div className="text-sm font-semibold text-[#E8E8F0]">{maxImages - imageCount}</div>
              <div className="text-[10px] text-[#9CA3AF] leading-none">remaining</div>
            </div>
          </div>

        {/* Assigned Agent Badge */}
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#00F0FF]/20 hover:border-[#00F0FF]/40 text-[#9CA3AF] hover:text-[#E8E8F0] transition-colors text-sm"
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
                  {/* Unassign option */}
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
                          isAssigned ? 'bg-[#00FF88]/5' : ''
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
                        {isAssigned && <Check className="w-4 h-4 text-[#00FF88]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        </div>{/* close flex items-center gap-3 */}
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setMode('imagine')}
          className={`p-6 rounded-2xl border text-left transition-all group cursor-pointer ${
            mode === 'imagine'
              ? 'border-[#ADFF2F]/40 bg-[#ADFF2F]/5'
              : 'border-[#00F0FF]/10 hover:border-[#ADFF2F]/30 bg-[#0C0C18]/50'
          }`}
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              mode === 'imagine' ? 'bg-[#ADFF2F]/20' : 'bg-[#00F0FF]/10'
            }`}>
              <Wand2 className={`w-5 h-5 ${mode === 'imagine' ? 'text-[#ADFF2F]' : 'text-[#00F0FF]'}`} />
            </div>
            <div>
              <h3 className="text-[#E8E8F0] font-semibold">Imagine</h3>
              <p className="text-xs text-[#9CA3AF]">Text to image</p>
            </div>
          </div>
          <p className="text-sm text-[#9CA3AF]">
            Describe what you want and the AI will generate it from scratch.
          </p>
        </button>

        <button
          onClick={() => setMode('edit')}
          className={`p-6 rounded-2xl border text-left transition-all group cursor-pointer ${
            mode === 'edit'
              ? 'border-[#00F0FF]/40 bg-[#00F0FF]/5'
              : 'border-[#00F0FF]/10 hover:border-[#00F0FF]/30 bg-[#0C0C18]/50'
          }`}
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              mode === 'edit' ? 'bg-[#00F0FF]/20' : 'bg-[#00F0FF]/10'
            }`}>
              <Upload className={`w-5 h-5 ${mode === 'edit' ? 'text-[#00F0FF]' : 'text-[#9CA3AF]'}`} />
            </div>
            <div>
              <h3 className="text-[#E8E8F0] font-semibold">Upload & Edit</h3>
              <p className="text-xs text-[#9CA3AF]">Reference image + prompt</p>
            </div>
          </div>
          <p className="text-sm text-[#9CA3AF]">
            Upload an image as reference and describe the changes you want.
          </p>
        </button>
      </div>

      {/* Generation Panel */}
      {mode && (
        <div
          className={`rounded-2xl border p-6 ${
            mode === 'imagine'
              ? 'border-[#ADFF2F]/20'
              : 'border-[#00F0FF]/20'
          }`}
          style={{ background: mode === 'imagine' ? 'rgba(173, 255, 47, 0.03)' : 'rgba(0, 240, 255, 0.03)' }}
        >
          {/* Reference image upload (edit mode) */}
          {mode === 'edit' && (
            <div className="mb-5">
              <label className="text-sm text-[#9CA3AF] mb-2 block">Reference Image (optional)</label>
              <div className="flex gap-3 items-start">
                {referencePreview ? (
                  <div className="relative group">
                    <img
                      src={referencePreview}
                      alt="Reference"
                      className="w-24 h-24 rounded-xl object-cover border border-[#00F0FF]/20"
                    />
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
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-[#00F0FF]/20 hover:border-[#00F0FF]/40 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                    aria-label="Upload reference image"
                  >
                    <Upload className="w-5 h-5 text-[#9CA3AF]" />
                    <span className="text-xs text-[#9CA3AF]">Upload</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-xs text-[#9CA3AF] mt-1 flex-1">
                  Upload a reference image and describe the edits you want.
                  The AI will generate a new image based on your instructions.
                </p>
              </div>
            </div>
          )}

          {/* Model selector + Size */}
          <div className="flex flex-wrap gap-3 mb-4">
            {/* Model */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/15 text-sm text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#ADFF2F]" />
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
                <div className="absolute top-full left-0 mt-2 w-80 rounded-xl border border-[#00F0FF]/20 bg-[#0C0C18] shadow-2xl z-20 overflow-hidden">
                  {models.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#00F0FF]/5 transition-colors text-left ${
                        selectedModel === m.id ? 'bg-[#00F0FF]/10' : ''
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
                      {selectedModel === m.id && <Check className="w-4 h-4 text-[#00F0FF] shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Size presets (only for imagine mode) */}
            {mode === 'imagine' && (
              <div className="flex gap-1.5">
                {sizePresets.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => { setWidth(preset.w); setHeight(preset.h); }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      width === preset.w && height === preset.h
                        ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                        : 'bg-[#06060B] text-[#9CA3AF] border border-[#00F0FF]/10 hover:border-[#00F0FF]/30'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Structured Prompt Builder */}
          {mode === 'imagine' && (
            <div className="mb-4">
              <button
                onClick={() => setShowPromptBuilder(!showPromptBuilder)}
                className="flex items-center gap-2 text-xs text-[#ADFF2F]/80 hover:text-[#ADFF2F] transition-colors mb-3"
              >
                <Palette className="w-3.5 h-3.5" />
                {showPromptBuilder ? 'Hide' : 'Show'} Prompt Builder
                <ChevronDown className={`w-3 h-3 transition-transform ${showPromptBuilder ? 'rotate-180' : ''}`} />
              </button>

              {showPromptBuilder && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#06060B] border border-[#ADFF2F]/15">
                  {/* Style dropdown */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] mb-1.5 block font-medium">Style</label>
                    <select
                      value={promptStyle}
                      onChange={(e) => setPromptStyle(e.target.value)}
                      className="w-full bg-[#0C0C18] border border-[#ADFF2F]/20 rounded-lg px-3 py-2 text-sm text-[#E8E8F0] outline-none focus:border-[#ADFF2F]/50 appearance-none cursor-pointer"
                    >
                      <option value="">Select style...</option>
                      {STYLE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Lighting dropdown */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] mb-1.5 block font-medium">Lighting</label>
                    <select
                      value={promptLighting}
                      onChange={(e) => setPromptLighting(e.target.value)}
                      className="w-full bg-[#0C0C18] border border-[#ADFF2F]/20 rounded-lg px-3 py-2 text-sm text-[#E8E8F0] outline-none focus:border-[#ADFF2F]/50 appearance-none cursor-pointer"
                    >
                      <option value="">Select lighting...</option>
                      {LIGHTING_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  {/* Mood dropdown */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] mb-1.5 block font-medium">Mood</label>
                    <select
                      value={promptMood}
                      onChange={(e) => setPromptMood(e.target.value)}
                      className="w-full bg-[#0C0C18] border border-[#ADFF2F]/20 rounded-lg px-3 py-2 text-sm text-[#E8E8F0] outline-none focus:border-[#ADFF2F]/50 appearance-none cursor-pointer"
                    >
                      <option value="">Select mood...</option>
                      {MOOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prompt input */}
          <div className="flex gap-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 'edit'
                ? 'Describe the changes you want to make...'
                : 'Describe the image you want to generate...'
              }
              rows={3}
              className={`flex-1 bg-[#06060B] border rounded-xl px-4 py-3 text-[#E8E8F0] placeholder-[#6B7280]/50 resize-none outline-none text-sm ${
                mode === 'imagine' ? 'border-[#ADFF2F]/20 focus:border-[#ADFF2F]/50' : 'border-[#00F0FF]/20 focus:border-[#00F0FF]/50'
              }`}
            />
          </div>

          {/* Enhance prompt button (imagine mode only) */}
          {mode === 'imagine' && prompt.trim() && (
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleEnhancePrompt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ADFF2F]/10 border border-[#ADFF2F]/20 text-xs text-[#ADFF2F] hover:bg-[#ADFF2F]/20 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Enhance Prompt
              </button>
              {(promptStyle || promptLighting || promptMood) && (
                <span className="text-[10px] text-[#9CA3AF]">
                  Will add: {[promptStyle, promptLighting, promptMood].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Generation progress indicator */}
          {genPhase !== 'idle' && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                {(['submitting', 'generating', 'done'] as const).map((step, i) => {
                  const isActive = step === genPhase;
                  const isPast = (genPhase === 'generating' && i === 0)
                    || (genPhase === 'done' && i <= 1);
                  const isFailed = genPhase === 'error' && step === 'generating';
                  return (
                    <div key={step} className="flex items-center gap-2">
                      {i > 0 && <div className={`w-8 h-0.5 rounded-full ${isPast ? 'bg-[#ADFF2F]' : 'bg-[#1A1A2E]'}`} />}
                      <div className={`flex items-center gap-1 text-xs font-medium transition-all ${
                        isFailed ? 'text-[#FF6161]'
                          : isActive ? 'text-[#ADFF2F]'
                          : isPast ? 'text-[#ADFF2F]/60'
                          : 'text-[#9CA3AF]/40'
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
                <div className="w-full h-1 rounded-full bg-[#0C0C18] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#ADFF2F] to-[#00F0FF] rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              )}
            </div>
          )}

          {/* Generate button + credits */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs">
              {imageCount >= maxImages ? (
                <span className="px-2.5 py-1 rounded-lg bg-[#FF6161]/10 border border-[#FF6161]/20 text-[#FF6161] font-medium">Image limit reached ({maxImages}/{maxImages})</span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/15 text-[#00F0FF]">
                  <strong>{maxImages - imageCount}</strong> credits remaining &middot; {width}x{height}
                </span>
              )}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || imageCount >= maxImages}
              className={`glow-hover flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'imagine'
                  ? 'bg-[#ADFF2F] text-[#06060B] hover:bg-[#ADFF2F]/90'
                  : 'bg-[#00F0FF] text-[#06060B] hover:bg-[#00F0FF]/90'
              }`}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {mode === 'edit' ? 'Generate Edit' : 'Imagine'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Gallery */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#E8E8F0] flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#ADFF2F]" />
            Your Gallery
            <span className="text-xs text-[#9CA3AF] font-normal ml-1">
              {imageCount}/{maxImages}
            </span>
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
            <Clock className="w-3 h-3" />
            Images expire in 24h
          </div>
        </div>

        {galleryLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#00F0FF]/20 p-12 text-center">
            <ImageIcon className="w-10 h-10 text-[#ADFF2F]/30 mx-auto mb-3" />
            <p className="text-[#9CA3AF] text-sm">No images yet.</p>
            <p className="text-[#9CA3AF] text-xs mt-1">Select a mode above and start generating!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map(img => (
              <div
                key={img.id}
                className="group relative rounded-2xl border border-[#00F0FF]/10 overflow-hidden hover:border-[#00F0FF]/40 hover:shadow-[0_0_12px_rgba(0,240,255,0.1)] transition-all bg-[#0C0C18]"
              >
                {/* Image */}
                <div
                  className="aspect-square cursor-pointer relative"
                  onClick={() => setPreviewImage(img)}
                >
                  <img
                    src={img.image_url}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <ZoomIn className="w-5 h-5 text-white" />
                  </div>
                  {/* Download button overlay */}
                  <a
                    href={img.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 p-2 rounded-lg bg-[#00F0FF]/90 text-[#06060B] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#00F0FF] z-10"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Download image"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs text-[#E8E8F0] truncate mb-1.5">{img.prompt}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[#9CA3AF]" />
                      <span className="text-xs text-[#9CA3AF]">{timeLeft(img.expires_at)}</span>
                    </div>
                    <div className="flex gap-1">
                      {/* Copy ID */}
                      <button
                        onClick={() => handleCopyId(img.id)}
                        className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                        aria-label={`Copy ID: ${img.id}`}
                      >
                        {copiedId === img.id ? (
                          <Check className="w-3.5 h-3.5 text-[#00FF88]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(img.id)}
                        className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                        aria-label="Delete image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Model & source badge */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      img.source === 'edited' ? 'bg-[#00F0FF]/10 text-[#00F0FF]' : 'bg-[#ADFF2F]/10 text-[#ADFF2F]'
                    }`}>
                      {img.source === 'edited' ? 'Edited' : 'Generated'}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">{img.model}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Image Models */}
      <div className="rounded-2xl border border-[#00F0FF]/10 overflow-hidden">
        <button
          onClick={() => setShowModelsPanel(p => !p)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#00F0FF]/5 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#ADFF2F]" />
            <span className="text-sm font-semibold text-[#E8E8F0]">Available Image Models</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform ${showModelsPanel ? 'rotate-180' : ''}`} />
        </button>

        {showModelsPanel && (
          <div className="border-t border-[#00F0FF]/10 divide-y divide-[#00F0FF]/5">
            {models.map(model => {
              const status = modelStatuses[model.id] ?? 'unknown';
              const isDefault = preferredImageModel === model.id;
              const isSaving = savingModel === model.id;

              return (
                <div key={model.id} className={`flex items-center gap-4 px-4 py-3 ${isDefault ? 'bg-[#ADFF2F]/5' : ''}`}>
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    status === 'ok' ? 'bg-[#00FF88]' :
                    status === 'down' ? 'bg-[#FF6161]' :
                    'bg-[#6B7280]'
                  }`} title={status} />

                  {/* Info */}
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
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#ADFF2F]/15 text-[#ADFF2F] font-medium">
                          Your default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{model.description}</p>
                  </div>

                  {/* Set as default button */}
                  <button
                    onClick={() => handleSetDefaultModel(model.id)}
                    disabled={isDefault || isSaving}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isDefault
                        ? 'bg-[#ADFF2F]/10 text-[#ADFF2F] cursor-default'
                        : 'bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 disabled:opacity-50'
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
      <div className="rounded-xl border border-[#00F0FF]/10 p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#9CA3AF] shrink-0 mt-0.5" />
        <div className="text-xs text-[#9CA3AF] space-y-1">
          <p>Images are saved for <strong className="text-[#E8E8F0]">24 hours</strong> and then automatically deleted.</p>
          <p>Use the <strong className="text-[#E8E8F0]">Copy ID</strong> button to get an image ID you can reference in your Website Builder projects.</p>
          <p>Maximum <strong className="text-[#E8E8F0]">{maxImages} images</strong> at a time. Delete old ones to make room for new ones.</p>
        </div>
      </div>
    </div>
  );
}
