import { useState, useRef, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  Code, LayoutTemplate, Wand2, Wrench, Send, Loader2, Eye,
  Play, X, Sparkles, Terminal, Bot, Plus, Trash2, Clock,
  CheckCircle, AlertCircle, Wifi, WifiOff, Monitor, Smartphone, Tablet,
  PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { ArtifactsPage } from './ArtifactsPage';
import { TemplateGalleryPage } from './TemplateGalleryPage';
import { artifactService, picoService } from '@/services/api';
import { agentService } from '@/services/api';
import type { Artifact } from '@/types';

// ---- Fleet agent types ----
interface FleetAgent {
  id: string;
  user_id: string;
  slot: number;
  name: string;
  personality: string;
  status: string;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
}

interface FleetTask {
  id: string;
  agent_slot: number;
  agent_name: string;
  task_type: string;
  description: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const MAX_ASSIGNED = 4;

const statusMeta: Record<string, { color: string; label: string }> = {
  active: { color: '#00FF88', label: 'Active' },
  idle: { color: 'var(--ag-text-muted)', label: 'Idle' },
  disabled: { color: '#FF6161', label: 'Offline' },
};

function getStatusColor(status: string) {
  return statusMeta[status]?.color ?? '#6B7280';
}

function formatTimeAgo(ts: string | null): string {
  if (!ts) return '--';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- Device preview config ----
type DeviceMode = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function WebsiteBuilderPage() {
  const [activeTab, setActiveTab] = useState('projects');
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'website-builder' });

  // Builder state
  const [builderMode, setBuilderMode] = useState<'imagine' | 'dev' | null>(null);
  const [imaginePrompt, setImaginePrompt] = useState('');
  const [imagineLoading, setImagineLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Artifact | null>(null);
  const [projects, setProjects] = useState<Artifact[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Dev mode state
  const [devTitle, setDevTitle] = useState('');
  const [devHtml, setDevHtml] = useState('');
  const [devCss, setDevCss] = useState('');
  const [devJs, setDevJs] = useState('');
  const [devSaving, setDevSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Weebos tab state
  const [fleetAgents, setFleetAgents] = useState<FleetAgent[]>([]);
  const [fleetTasks, setFleetTasks] = useState<FleetTask[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [assignedSlots, setAssignedSlots] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('wb_assigned_slots');
      return saved ? new Set(JSON.parse(saved)) : new Set<number>();
    } catch { return new Set<number>(); }
  });
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPersonality, setNewAgentPersonality] = useState<'edith' | 'jarvis' | 'weebo'>('weebo');
  const [savingAgent, setSavingAgent] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [planningTask, setPlanningTask] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  // Load user projects for the builder
  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await artifactService.list();
      setProjects(res.data.artifacts);
    } catch {
      // load failure — empty project list shown
    } finally {
      setProjectsLoading(false);
    }
  };

  // Persist assigned slots
  useEffect(() => {
    localStorage.setItem('wb_assigned_slots', JSON.stringify([...assignedSlots]));
  }, [assignedSlots]);

  // Load fleet data
  const loadFleet = useCallback(async () => {
    setFleetLoading(true);
    try {
      const [agentsRes, tasksRes] = await Promise.all([
        picoService.getAgents(),
        picoService.getTasks({ limit: 20 }),
      ]);
      setFleetAgents(agentsRes.data);
      setFleetTasks(tasksRes.data);
      // Auto-clean stale assigned slots (agent was deleted)
      const liveSlots = new Set(agentsRes.data.map((a: FleetAgent) => a.slot));
      setAssignedSlots(prev => {
        const cleaned = new Set([...prev].filter(s => liveSlots.has(s)));
        if (cleaned.size !== prev.size) return cleaned;
        return prev;
      });
    } catch {
      // load failure — empty fleet shown
    } finally {
      setFleetLoading(false);
    }
  }, []);

  // When switching to builder tab, load projects
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'builder') {
      loadProjects();
      setBuilderMode(null);
      setSelectedProject(null);
    }
    if (tab === 'weebos') {
      loadFleet();
    }
  };

  // Load selected project code into dev editor
  const loadProjectForDev = async (artifact: Artifact) => {
    setSelectedProject(artifact);
    try {
      const res = await artifactService.get(artifact.id);
      setDevHtml(res.data.html || '');
      setDevCss(res.data.css || '');
      setDevJs(res.data.js || '');
    } catch {
      showToast('Failed to load project code', 'error');
    }
  };

  // Generate preview HTML for the iframe
  const getPreviewHtml = () => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${devCss}</style></head>
<body>${devHtml}<script>${devJs}<` + `/script></body></html>`;

  // Refresh the preview iframe contents
  const refreshPreview = useCallback(() => {
    if (previewRef.current) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(getPreviewHtml());
        doc.close();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devHtml, devCss, devJs]);

  // Handle "Let's do it" — save dev changes (update existing or create new)
  const handleDevSave = async () => {
    setDevSaving(true);
    void notifyStart('Saving website project');
    try {
      if (selectedProject) {
        // Update existing project
        await artifactService.update(selectedProject.id, {
          html: devHtml,
          css: devCss,
          js: devJs,
        });
        showToast('Changes saved and deployed!');
        void notifyDone(`Updated project "${selectedProject.title}"`);
      } else {
        // Create a new project from scratch
        const title = devTitle.trim() || 'My Project';
        const res = await artifactService.create({
          title,
          html: devHtml,
          css: devCss,
          js: devJs,
        });
        // Select the newly created project so subsequent saves update it
        setSelectedProject(res.data as Artifact);
        showToast(`Project "${title}" created!`);
        void notifyDone(`Created project "${title}"`);
        await loadProjects();
      }
      setShowPreview(true);
      // Update iframe
      setTimeout(refreshPreview, 50);
    } catch {
      showToast('Failed to save changes', 'error');
      void notifyFail('Save failed');
    } finally {
      setDevSaving(false);
    }
  };

  // Handle "Imagine & Add" — send prompt to agent
  const handleImagine = async () => {
    if (!imaginePrompt.trim()) return;
    setImagineLoading(true);
    const isEdit = !!selectedProject;
    void notifyStart(isEdit ? 'Updating project via AI' : 'Generating project via AI');
    try {
      const context = isEdit
        ? `Update the existing project titled "${selectedProject!.title}". `
        : 'Create a new website. ';
      const fullPrompt = `${context}${imaginePrompt}`;
      // Use 'builder' channel so the backend applies the code-generation system prompt,
      // and pass existingArtifactId when editing so generate_code updates instead of creates.
      const res = await agentService.chat(fullPrompt, 'builder', isEdit ? selectedProject!.id : undefined);
      const codeAction = res.data.actions?.find((a: { tool: string }) => a.tool === 'generate_code');
      if (codeAction?.success) {
        showToast(isEdit ? 'Project updated!' : 'New project created! Check My Projects.');
        void notifyDone(isEdit ? 'Project updated via AI' : 'New project generated via AI');
        if (isEdit && codeAction.artifactId) {
          // Refresh project list and re-select the updated project
          await loadProjects();
        }
      } else if (res.data.actions?.length) {
        showToast(isEdit ? 'Project updated! Check My Projects.' : 'New project created! Check My Projects.');
        void notifyDone('AI action completed');
      } else {
        // No action block — show the AI text as a hint, but also warn
        showToast('AI responded but no code was generated. Try being more specific.', 'error');
        void notifyFail('No code generated');
      }
      setImaginePrompt('');
    } catch {
      showToast('Failed to generate. Try again.', 'error');
      void notifyFail('AI generation failed');
    } finally {
      setImagineLoading(false);
    }
  };

  // ---- Weebo actions ----
  const toggleAssign = (slot: number) => {
    setAssignedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) {
        next.delete(slot);
      } else if (next.size < MAX_ASSIGNED) {
        next.add(slot);
      }
      return next;
    });
  };

  const handleDeployAgent = async () => {
    if (!newAgentName.trim() || creatingSlot === null) return;
    setSavingAgent(true);
    void notifyStart('Deploying new agent');
    try {
      await picoService.createAgent(newAgentName.trim(), newAgentPersonality);
      showToast(`Agent "${newAgentName.trim()}" deployed!`);
      void notifyDone(`Agent "${newAgentName.trim()}" deployed`);
      setNewAgentName('');
      setNewAgentPersonality('weebo');
      setCreatingSlot(null);
      await loadFleet();
    } catch {
      showToast('Failed to deploy agent', 'error');
      void notifyFail('Agent deployment failed');
    } finally {
      setSavingAgent(false);
    }
  };

  const handleAssignTask = async () => {
    if (!taskInput.trim() || assignedSlots.size === 0) return;
    setPlanningTask(true);
    void notifyStart('Planning task for agents');
    try {
      const res = await picoService.planTask(taskInput.trim());
      const count = res.data.queued;
      showToast(`Planned ${count} task${count !== 1 ? 's' : ''} for assigned agents`);
      void notifyDone(`Planned ${count} task(s)`);
      setTaskInput('');
      await loadFleet();
    } catch {
      showToast('Failed to plan task', 'error');
      void notifyFail('Task planning failed');
    } finally {
      setPlanningTask(false);
    }
  };

  const handleDeleteAgent = async (agent: FleetAgent) => {
    try {
      await picoService.deleteAgent(agent.id);
      showToast(`Agent "${agent.name}" removed`);
      setAssignedSlots(prev => {
        const next = new Set(prev);
        next.delete(agent.slot);
        return next;
      });
      await loadFleet();
    } catch {
      showToast('Failed to remove agent', 'error');
    }
  };

  const assignedAgents = fleetAgents.filter(a => assignedSlots.has(a.slot));
  const unassignedAgents = fleetAgents.filter(a => !assignedSlots.has(a.slot));
  const emptySlots = [1, 2, 3, 4, 5, 6].filter(s => !fleetAgents.some(a => a.slot === s));

  // ---- Device preview bar ----
  const DeviceBar = () => (
    <div className="flex items-center gap-1">
      {([
        { mode: 'desktop' as DeviceMode, icon: Monitor, label: 'Desktop' },
        { mode: 'tablet' as DeviceMode, icon: Tablet, label: 'Tablet' },
        { mode: 'mobile' as DeviceMode, icon: Smartphone, label: 'Mobile' },
      ]).map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => setDeviceMode(mode)}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-[transform,color,background-color] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
            deviceMode === mode
              ? 'text-[var(--ag-violet)] bg-[#8B5CF6]/10'
              : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary,#F4F6FF)]'
          }`}
          aria-label={`Preview ${label}`}
          title={label}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );

  // ---- Preview iframe component ----
  const PreviewFrame = ({ className = '' }: { className?: string }) => (
    <div className={`flex items-start justify-center overflow-auto ${
      deviceMode !== 'desktop' ? 'p-4 md:p-8 bg-[var(--ag-bg-base)]' : 'p-0'
    } ${className}`}>
      <iframe
        ref={previewRef}
        title="Live Preview"
        sandbox="allow-scripts allow-same-origin"
        className={`bg-white transition-all duration-300 ${
          deviceMode === 'mobile'
            ? 'w-[375px] h-[667px] border border-[rgba(139,92,246,0.15)] rounded-xl shadow-2xl'
            : deviceMode === 'tablet'
              ? 'w-[768px] h-[600px] border border-[rgba(139,92,246,0.15)] rounded-xl shadow-2xl'
              : 'w-full h-full'
        }`}
        style={deviceMode === 'desktop' ? undefined : { maxWidth: DEVICE_WIDTHS[deviceMode] }}
      />
    </div>
  );

  return (
    <DashboardPageWrapper>
    <PageShell>
      {/* ---- Header ---- */}
      <BlurFade delay={0}>
        <PageHeader
          icon={Code}
          title="Website Builder"
          subtitle="Powered by Edith"
          badge={
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ag-violet)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--ag-violet)]" />
            </span>
          }
        />
      </BlurFade>

      {/* Toast */}
      {toast && (
        <BlurFade delay={0}>
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${
            toast.type === 'success'
              ? 'bg-[var(--ag-bg-surface)] text-[var(--ag-violet)] border border-[var(--ag-border-active)]'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {toast.text}
          </div>
        </BlurFade>
      )}

      <BlurFade delay={0.1}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="overflow-x-auto scrollbar-hide w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
            <TabsList className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] flex w-max min-w-full">
            <TabsTrigger value="projects" className="data-[state=active]:bg-[var(--ag-active-bg)] data-[state=active]:text-[var(--ag-violet)] gap-2 flex-shrink-0 whitespace-nowrap min-h-[44px]">
              <Code className="w-4 h-4" />
              My Projects
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-[var(--ag-active-bg)] data-[state=active]:text-[var(--ag-violet)] gap-2 flex-shrink-0 whitespace-nowrap min-h-[44px]">
              <LayoutTemplate className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="builder" className="data-[state=active]:bg-[var(--ag-active-bg)] data-[state=active]:text-[var(--ag-violet)] gap-2 flex-shrink-0 whitespace-nowrap min-h-[44px]">
              <Wrench className="w-4 h-4" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="weebos" className="data-[state=active]:bg-[var(--ag-active-bg)] data-[state=active]:text-[var(--ag-violet)] gap-2 flex-shrink-0 whitespace-nowrap min-h-[44px]">
              <Bot className="w-4 h-4" />
              Weebos
            </TabsTrigger>
          </TabsList>
          </div>
        <TabsContent value="projects" className="mt-6">
          <BlurFade delay={0.2}>
            <ArtifactsPage onNavigate={(page) => {
              if (page === 'templates') setActiveTab('templates');
            }} />
          </BlurFade>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <BlurFade delay={0.2}>
            <TemplateGalleryPage embedded />
          </BlurFade>
        </TabsContent>

        <TabsContent value="builder" className="mt-6">
          {/* Project selector */}
          <BlurFade delay={0.2}>
            <SectionCard padding="md" className="mb-6 bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
            <label className="text-sm text-[var(--ag-text-secondary)] mb-2 block">Working on:</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedProject(null)}
                className={`px-3 py-2 rounded-lg text-sm transition-[transform,box-shadow,border-color,color] duration-150 min-h-[44px] active:scale-[0.96] ${
                  !selectedProject
                    ? 'bg-[var(--ag-active-bg)] text-[var(--ag-violet)] border border-[var(--ag-border-active)] shadow-[var(--ag-glow-sm)]'
                    : 'bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)]'
                }`}
              >
                New Project
              </button>
              {projectsLoading ? (
                <div className="flex items-center gap-2 text-[var(--ag-text-secondary)] text-sm px-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadProjectForDev(p)}
                    className={`px-3 py-2 rounded-lg text-sm transition-[transform,box-shadow,border-color,color] duration-150 truncate max-w-[200px] min-h-[44px] active:scale-[0.96] ${
                      selectedProject?.id === p.id
                        ? 'bg-[var(--ag-active-bg)] text-[var(--ag-violet)] border border-[var(--ag-border-active)] shadow-[var(--ag-glow-sm)]'
                        : 'bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)]'
                    }`}
                  >
                    {p.title}
                  </button>
                ))
              )}
            </div>
            </SectionCard>
          </BlurFade>

          {/* Mode selector */}
          <BlurFade delay={0.3}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Imagine & Add */}
            <button
              onClick={() => setBuilderMode('imagine')}
              className={`p-6 rounded-2xl text-left transition-[transform,box-shadow,border-color] duration-200 group active:scale-[0.96] ${
                builderMode === 'imagine'
                  ? 'border border-[var(--ag-border-active)] bg-[var(--ag-active-bg)] shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_8px_32px_rgba(0,0,0,0.45),var(--ag-glow-md)]'
                  : 'border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-glow)] bg-[var(--ag-bg-surface)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.35)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_24px_rgba(0,0,0,0.45)]'
              }`}
              style={{ backdropFilter: 'blur(var(--ag-glass-blur))', WebkitBackdropFilter: 'blur(var(--ag-glass-blur))' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  builderMode === 'imagine' ? 'bg-[var(--ag-active-bg)]' : 'bg-[var(--ag-violet)]/10'
                }`}>
                  <Wand2 className={`w-5 h-5 ${builderMode === 'imagine' ? 'text-[var(--ag-violet)]' : 'text-[var(--ag-text-secondary)]'}`} />
                </div>
                <div>
                  <h3 className="text-[var(--ag-text-primary)] font-heading font-semibold">Imagine & Add</h3>
                  <p className="text-xs text-[var(--ag-text-secondary)]">Let AI build it for you</p>
                </div>
              </div>
              <p className="text-sm text-[var(--ag-text-secondary)]">
                Describe what you want and the agent will create or update your project.
              </p>
            </button>

            {/* Dev Mode */}
            <button
              onClick={() => {
                setBuilderMode('dev');
                if (selectedProject && !devHtml && !devCss && !devJs) {
                  loadProjectForDev(selectedProject);
                }
              }}
              className={`p-6 rounded-2xl text-left transition-[transform,box-shadow,border-color] duration-200 group active:scale-[0.96] ${
                builderMode === 'dev'
                  ? 'border border-[var(--ag-border-active)] bg-[var(--ag-cyan)]/5 shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_8px_32px_rgba(0,0,0,0.45),var(--ag-glow-md)]'
                  : 'border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-glow)] bg-[var(--ag-bg-surface)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.35)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_24px_rgba(0,0,0,0.45)]'
              }`}
              style={{ backdropFilter: 'blur(var(--ag-glass-blur))', WebkitBackdropFilter: 'blur(var(--ag-glass-blur))' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  builderMode === 'dev' ? 'bg-[var(--ag-cyan)]/20' : 'bg-[var(--ag-cyan)]/10'
                }`}>
                  <Terminal className={`w-5 h-5 ${builderMode === 'dev' ? 'text-[var(--ag-cyan)]' : 'text-[var(--ag-text-secondary)]'}`} />
                </div>
                <div>
                  <h3 className="text-[var(--ag-text-primary)] font-heading font-semibold">Feelin&apos; to be a Dev</h3>
                  <p className="text-xs text-[var(--ag-text-secondary)]">I&apos;ll input on it myself</p>
                </div>
              </div>
              <p className="text-sm text-[var(--ag-text-secondary)]">
                Write HTML, CSS, and JavaScript directly. Full control over your code.
              </p>
            </button>
            </div>
          </BlurFade>

          {/* ---- Imagine Mode ---- */}
          {builderMode === 'imagine' && (
            <BlurFade delay={0.4}>
              <SectionCard padding="lg" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[var(--ag-violet)]" />
                <h3 className="text-[var(--ag-text-primary)] font-heading font-semibold">
                  {selectedProject ? `Update "${selectedProject.title}"` : 'Create Something New'}
                </h3>
              </div>
              <p className="text-sm text-[var(--ag-text-secondary)] mb-4">
                {selectedProject
                  ? 'Describe changes you want — the agent will update your existing project.'
                  : 'Describe what you want to build — the agent will create a new project for you.'}
              </p>
              <div className="flex gap-3">
                <textarea
                  value={imaginePrompt}
                  onChange={(e) => setImaginePrompt(e.target.value)}
                  placeholder={selectedProject
                    ? 'e.g. "Add a contact form section with a dark theme..."'
                    : 'e.g. "A modern landing page for a SaaS product with pricing cards..."'}
                  rows={3}
                  className="flex-1 bg-[var(--ag-bg-elevated)] border border-[var(--ag-border-default)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)] resize-none focus:border-[var(--ag-border-active)] outline-none text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-[border-color,box-shadow] duration-150"
                />
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleImagine}
                  disabled={imagineLoading || !imaginePrompt.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white font-semibold text-sm hover:shadow-[var(--ag-glow-md)] transition-[transform,box-shadow,opacity] duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none min-h-[44px] active:scale-[0.96] shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
                >
                  {imagineLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Imagine & Build
                    </>
                  )}
                </button>
              </div>
              </SectionCard>
            </BlurFade>
          )}

          {/* ---- Dev Mode ---- */}
          {builderMode === 'dev' && (
            <BlurFade delay={0.4}>
              <div className="space-y-4">
              {/* Title input — only shown for new projects */}
              {!selectedProject && (
                <SectionCard padding="md" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
                  <p className="text-sm text-[var(--ag-text-secondary)]">
                    Starting fresh? Give your project a name and start coding below. Or select an existing project above to edit it.
                  </p>
                  <input
                    type="text"
                    value={devTitle}
                    onChange={(e) => setDevTitle(e.target.value)}
                    placeholder="Project name (e.g. Hello World)"
                    className="w-full mt-3 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] rounded-xl px-4 py-2.5 text-[var(--ag-text-primary)] placeholder-[#6B7280]/50 text-sm focus:border-[var(--ag-violet)]/50 outline-none min-h-[44px]"
                  />
                </SectionCard>
              )}

              {/* Split view: code + preview side by side */}
              {splitView && showPreview ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left: code editors stacked */}
                  <div className="space-y-4">
                    {/* HTML */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
                        <span className="px-1.5 py-0.5 bg-[#FF6B35]/20 text-[#FF6B35] text-xs rounded font-mono">HTML</span>
                      </label>
                      <textarea
                        value={devHtml}
                        onChange={(e) => setDevHtml(e.target.value)}
                        spellCheck={false}
                        className="w-full h-48 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed"
                        placeholder="<div>Your HTML here...</div>"
                      />
                    </div>

                    {/* CSS */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
                        <span className="px-1.5 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] text-xs rounded font-mono">CSS</span>
                      </label>
                      <textarea
                        value={devCss}
                        onChange={(e) => setDevCss(e.target.value)}
                        spellCheck={false}
                        className="w-full h-48 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed"
                        placeholder="body { color: white; }"
                      />
                    </div>

                    {/* JavaScript */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
                        <span className="px-1.5 py-0.5 bg-[#FFD700]/20 text-[#FFD700] text-xs rounded font-mono">JS</span>
                      </label>
                      <textarea
                        value={devJs}
                        onChange={(e) => setDevJs(e.target.value)}
                        spellCheck={false}
                        className="w-full h-48 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed"
                        placeholder="console.log('Hello world');"
                      />
                    </div>
                  </div>

                  {/* Right: preview */}
                  <div className="rounded-2xl border border-[rgba(139,92,246,0.15)] overflow-hidden flex flex-col min-h-[500px]">
                    <div className="flex items-center justify-between px-4 py-2 bg-[rgba(12,12,30,0.6)] border-b border-[rgba(139,92,246,0.08)]">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--ag-text-secondary)] font-mono">Preview</span>
                        <DeviceBar />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => refreshPreview()}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                          aria-label="Refresh preview"
                          title="Refresh"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSplitView(false)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                          aria-label="Exit split view"
                          title="Exit split view"
                        >
                          <PanelLeftClose className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <PreviewFrame className="flex-1" />
                  </div>
                </div>
              ) : (
                /* Regular stacked code editors */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* HTML */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
                      <span className="px-1.5 py-0.5 bg-[#FF6B35]/20 text-[#FF6B35] text-xs rounded font-mono">HTML</span>
                    </label>
                    <textarea
                      value={devHtml}
                      onChange={(e) => setDevHtml(e.target.value)}
                      spellCheck={false}
                      className="w-full h-64 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed"
                      placeholder="<div>Your HTML here...</div>"
                    />
                  </div>

                  {/* CSS */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
                      <span className="px-1.5 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] text-xs rounded font-mono">CSS</span>
                    </label>
                    <textarea
                      value={devCss}
                      onChange={(e) => setDevCss(e.target.value)}
                      spellCheck={false}
                      className="w-full h-64 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed"
                      placeholder="body { color: white; }"
                    />
                  </div>

                  {/* JavaScript */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
                      <span className="px-1.5 py-0.5 bg-[#FFD700]/20 text-[#FFD700] text-xs rounded font-mono">JS</span>
                    </label>
                    <textarea
                      value={devJs}
                      onChange={(e) => setDevJs(e.target.value)}
                      spellCheck={false}
                      className="w-full h-64 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed"
                      placeholder="console.log('Hello world');"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleDevSave}
                  disabled={devSaving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white font-bold text-sm hover:shadow-[var(--ag-glow-md)] transition-[transform,box-shadow,opacity] duration-150 disabled:opacity-50 disabled:hover:shadow-none min-h-[44px] active:scale-[0.96] shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
                >
                  {devSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      {selectedProject ? "Let's do it" : 'Save & Create'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const nextShow = !showPreview;
                    setShowPreview(nextShow);
                    if (nextShow) {
                      setTimeout(refreshPreview, 50);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-active)] transition-[transform,border-color,color] duration-150 text-sm min-h-[44px] active:scale-[0.96] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Hide Preview' : 'Preview'}
                </button>
                {showPreview && (
                  <button
                    onClick={() => setSplitView(!splitView)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-active)] transition-[transform,border-color,color] duration-150 text-sm min-h-[44px] active:scale-[0.96] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                    title={splitView ? 'Stack view' : 'Split view'}
                  >
                    <PanelLeft className="w-4 h-4" />
                    {splitView ? 'Stack' : 'Split'}
                  </button>
                )}
              </div>

              {/* Live Preview — stacked (non-split) */}
              {showPreview && !splitView && (
                <div className="rounded-2xl border border-[var(--ag-border-default)] overflow-hidden bg-[var(--ag-bg-surface)] backdrop-blur-xl">
                  <div className="flex items-center justify-between px-4 py-2 bg-[var(--ag-bg-surface)] border-b border-[var(--ag-border-subtle)]">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--ag-text-secondary)] font-mono">Preview</span>
                      <DeviceBar />
                    </div>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 rounded-lg transition-colors"
                      aria-label="Close preview"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <PreviewFrame className="h-[500px]" />
                </div>
              )}
              </div>
            </BlurFade>
          )}
        </TabsContent>

        {/* ======== Weebos Tab ======== */}
        <TabsContent value="weebos" className="mt-6 space-y-6">
          {fleetLoading ? (
            <BlurFade delay={0.2}>
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[var(--ag-violet)] border-t-transparent rounded-full animate-spin" />
              </div>
            </BlurFade>
          ) : (
            <div className="space-y-6">
              {/* Assigned agents */}
              <BlurFade delay={0.2}>
                <SectionCard padding="lg" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-heading font-semibold text-[var(--ag-text-primary)] flex items-center gap-2">
                    <Bot className="w-5 h-5 text-[var(--ag-violet)]" />
                    Assigned Weebos
                    <span className="text-xs text-[var(--ag-text-secondary)] font-normal ml-1">
                      {assignedAgents.length}/{MAX_ASSIGNED} max
                    </span>
                  </h3>
                </div>

                {assignedAgents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--ag-border-glow)] p-10 text-center bg-[var(--ag-active-bg)] shadow-[inset_0_0_40px_rgba(139,92,246,0.03)]">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--ag-violet)]/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_0_1px_rgba(139,92,246,0.15)]">
                      <Bot className="w-7 h-7 text-[var(--ag-violet)]/50" />
                    </div>
                    <p className="text-[var(--ag-text-primary)] font-medium text-sm mb-1">No agents assigned yet</p>
                    <p className="text-[var(--ag-text-secondary)] text-xs max-w-xs mx-auto">Assign agents from your fleet below, or deploy a new one to start automating website tasks.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assignedAgents.map(agent => {
                      const color = getStatusColor(agent.status);
                      const agentTasks = fleetTasks.filter(t => t.agent_slot === agent.slot && (t.status === 'running' || t.status === 'queued'));
                      const personality = agent.personality === 'edith' ? '⚡' : agent.personality === 'jarvis' ? '🎩' : '🤖';
                      return (
                        <div
                          key={agent.id}
                          className="rounded-2xl p-5 transition-[box-shadow,border-color] duration-200 bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_8px_32px_rgba(0,0,0,0.45)] hover:border-[var(--ag-border-active)]"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{personality}</span>
                              <div>
                                <div className="font-semibold text-[var(--ag-text-primary)] text-sm">{agent.name}</div>
                                <div className="text-xs text-[var(--ag-text-secondary)] capitalize">Slot {agent.slot} &middot; {agent.personality}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Status indicator */}
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                                style={{ background: `${color}15`, color }}>
                                {agent.status === 'active' ? (
                                  <Wifi className="w-3 h-3" />
                                ) : (
                                  <WifiOff className="w-3 h-3" />
                                )}
                                {statusMeta[agent.status]?.label ?? agent.status}
                              </div>
                              {/* Unassign */}
                              <button
                                onClick={() => toggleAssign(agent.slot)}
                                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--ag-text-secondary)] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-[transform,color,background-color] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                                aria-label={`Unassign ${agent.name} from Builder`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="flex gap-3 mb-3">
                            <div className="flex-1 p-2.5 rounded-lg bg-[var(--ag-bg-base)] border border-[var(--ag-green)]/10">
                              <div className="text-xs text-[var(--ag-text-secondary)]">Completed</div>
                              <div className="text-lg font-bold text-[var(--ag-green)] font-mono tabular-nums">{agent.tasks_completed}</div>
                            </div>
                            <div className="flex-1 p-2.5 rounded-lg bg-[var(--ag-bg-base)] border border-[#FF6161]/10">
                              <div className="text-xs text-[var(--ag-text-secondary)]">Failed</div>
                              <div className="text-lg font-bold text-[#FF6161] font-mono tabular-nums">{agent.tasks_failed}</div>
                            </div>
                          </div>

                          {/* Current work progress */}
                          {agentTasks.length > 0 ? (
                            <div className="space-y-2">
                              <div className="text-xs text-[var(--ag-text-secondary)] font-medium">Current Work</div>
                              {agentTasks.slice(0, 2).map(task => (
                                <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)]">
                                  {task.status === 'running' ? (
                                    <Loader2 className="w-3.5 h-3.5 text-[var(--ag-amber)] animate-spin shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-[var(--ag-cyan)] shrink-0" />
                                  )}
                                  <span className="text-xs text-[var(--ag-text-primary)] truncate flex-1">{task.description}</span>
                                  <span className="text-xs capitalize shrink-0"
                                    style={{ color: task.status === 'running' ? 'var(--ag-amber)' : 'var(--ag-cyan)' }}>
                                    {task.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)]">
                              <CheckCircle className="w-3.5 h-3.5 text-[var(--ag-text-secondary)]" />
                              <span className="text-xs text-[var(--ag-text-secondary)]">No active tasks — ready for work</span>
                            </div>
                          )}

                          <div className="mt-2 text-xs text-[var(--ag-text-secondary)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Created {formatTimeAgo(agent.created_at)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
              </BlurFade>

              {/* Quick task for assigned agents */}
              {assignedAgents.length > 0 && (
                <BlurFade delay={0.3}>
                  <SectionCard padding="lg" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4 text-[var(--ag-violet)]" />
                    <h3 className="text-sm font-semibold text-[var(--ag-text-primary)]">Assign Task</h3>
                  </div>
                  <div className="flex gap-3">
                    <input
                      value={taskInput}
                      onChange={e => setTaskInput(e.target.value)}
                      placeholder="Describe a website task for your agents..."
                      className="flex-1 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] rounded-xl px-4 py-2.5 text-[var(--ag-text-primary)] placeholder-[#6B7280]/50 text-sm focus:border-[var(--ag-violet)]/50 outline-none min-h-[44px]"
                      onKeyDown={e => e.key === 'Enter' && !planningTask && handleAssignTask()}
                      disabled={planningTask}
                    />
                    <button
                      onClick={handleAssignTask}
                      disabled={!taskInput.trim() || planningTask}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B5CF6] text-white font-semibold text-sm hover:bg-[#8B5CF6]/90 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none min-h-[44px] shadow-[0_4px_16px_rgba(139,92,246,0.25)]"
                    >
                      {planningTask ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Plan
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--ag-text-secondary)] mt-2">
                    The planner will break your request into tasks and assign them to available agents.
                  </p>
                  </SectionCard>
                </BlurFade>
              )}

              {/* Assign from fleet */}
              {unassignedAgents.length > 0 && assignedSlots.size < MAX_ASSIGNED && (
                <BlurFade delay={0.4}>
                  <div>
                    <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[var(--ag-violet)]" />
                      Assign from Fleet
                    </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {unassignedAgents.map(agent => {
                      const color = getStatusColor(agent.status);
                      const personality = agent.personality === 'edith' ? '⚡' : agent.personality === 'jarvis' ? '🎩' : '🤖';
                      return (
                        <button
                          key={agent.id}
                          onClick={() => toggleAssign(agent.slot)}
                          className="flex items-center gap-3 p-4 rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] hover:border-[var(--ag-border-active)] hover:bg-[var(--ag-active-bg)] transition-[transform,box-shadow,border-color,background-color] duration-150 active:scale-[0.96] text-left cursor-pointer group min-h-[44px] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                        >
                          <span className="text-lg">{personality}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--ag-text-primary)] truncate">{agent.name}</div>
                            <div className="text-xs text-[var(--ag-text-secondary)]">Slot {agent.slot}</div>
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                            style={{ background: `${color}15`, color }}>
                            {statusMeta[agent.status]?.label ?? agent.status}
                          </div>
                          <Plus className="w-4 h-4 text-[var(--ag-violet)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                  </div>
                </BlurFade>
              )}

              {/* Deploy new agent */}
              {emptySlots.length > 0 && (
                <BlurFade delay={0.5}>
                  <div>
                    <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[var(--ag-violet)]" />
                      Deploy New Agent
                    </h3>

                  {creatingSlot !== null ? (
                    <SectionCard padding="lg" className="max-w-md">
                      <p className="text-sm text-[var(--ag-text-secondary)] mb-3">Choose personality for Slot {creatingSlot}</p>
                      <div className="flex gap-2 mb-3">
                        {([
                          { id: 'weebo' as const, emoji: '🤖', label: 'Weebo', color: '#00FF88' },
                          { id: 'jarvis' as const, emoji: '🎩', label: 'Jarvis', color: 'var(--ag-cyan)' },
                          { id: 'edith' as const, emoji: '⚡', label: 'Edith', color: 'var(--ag-violet)' },
                        ]).map(p => (
                          <button
                            key={p.id}
                            onClick={() => setNewAgentPersonality(p.id)}
                            className="flex flex-col items-center gap-1 p-3 rounded-lg border transition-[transform,border-color,background-color] duration-150 active:scale-[0.96] min-w-[60px] min-h-[44px]"
                            style={{
                              borderColor: newAgentPersonality === p.id ? p.color : 'rgba(139, 92, 246, 0.15)',
                              backgroundColor: newAgentPersonality === p.id ? `${p.color}10` : 'transparent',
                            }}
                          >
                            <span className="text-lg">{p.emoji}</span>
                            <span className="text-xs font-medium" style={{ color: newAgentPersonality === p.id ? p.color : '#6B7280' }}>{p.label}</span>
                          </button>
                        ))}
                      </div>
                      <input
                        value={newAgentName}
                        onChange={e => setNewAgentName(e.target.value)}
                        placeholder="Agent name..."
                        className="w-full bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] rounded-xl px-4 py-2.5 text-[var(--ag-text-primary)] placeholder-[#6B7280]/50 text-sm focus:border-[var(--ag-violet)]/50 outline-none mb-3 min-h-[44px]"
                        onKeyDown={e => e.key === 'Enter' && handleDeployAgent()}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setCreatingSlot(null); setNewAgentName(''); }}
                          className="px-4 py-2 rounded-xl border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] text-sm hover:text-[var(--ag-text-primary)] transition-[transform,color,border-color] duration-150 active:scale-[0.96] min-h-[44px] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeployAgent}
                          disabled={!newAgentName.trim() || savingAgent}
                          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#8B5CF6] text-white font-semibold text-sm hover:bg-[#8B5CF6]/90 transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] shadow-[0_4px_16px_rgba(139,92,246,0.25)]"
                        >
                          {savingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deploy'}
                        </button>
                      </div>
                    </SectionCard>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {emptySlots.slice(0, 3).map(slot => (
                        <button
                          key={slot}
                          onClick={() => setCreatingSlot(slot)}
                          className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-[var(--ag-border-default)] hover:border-[var(--ag-border-active)] hover:bg-[var(--ag-active-bg)] transition-[transform,border-color,background-color] duration-150 active:scale-[0.96] cursor-pointer group min-h-[44px] backdrop-blur-xl"
                        >
                          <Plus className="w-5 h-5 text-[var(--ag-violet)] group-hover:text-[var(--ag-violet)]" />
                          <span className="text-sm text-[var(--ag-text-secondary)] group-hover:text-[var(--ag-text-primary)]">Slot {slot}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                </BlurFade>
              )}

              {/* Agent removal section — only show if there are assigned agents */}
              {assignedAgents.length > 0 && (
                <BlurFade delay={0.6}>
                  <div className="pt-4 border-t border-[var(--ag-border-subtle)]">
                  <details className="group">
                    <summary className="text-xs text-[var(--ag-text-secondary)] cursor-pointer hover:text-[var(--ag-text-primary)] transition-colors flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Manage assigned agents
                    </summary>
                    <div className="mt-3 space-y-2">
                      {assignedAgents.map(agent => (
                        <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)]">
                          <span className="text-sm text-[var(--ag-text-primary)]">
                            {agent.personality === 'edith' ? '⚡' : agent.personality === 'jarvis' ? '🎩' : '🤖'} {agent.name} (Slot {agent.slot})
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleAssign(agent.slot)}
                              className="px-3 py-1 rounded-lg text-xs text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] transition-colors min-h-[44px] flex items-center"
                            >
                              Unassign
                            </button>
                            {agent.slot !== 1 && (
                              <button
                                onClick={() => handleDeleteAgent(agent)}
                                className="px-3 py-1 rounded-lg text-xs text-[#FF6161] border border-[#FF6161]/20 hover:bg-[#FF6161]/10 transition-colors flex items-center gap-1 min-h-[44px]"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                  </div>
                </BlurFade>
              )}
            </div>
          )}
        </TabsContent>
        </Tabs>
      </BlurFade>
    </PageShell>
    </DashboardPageWrapper>
  );
}
