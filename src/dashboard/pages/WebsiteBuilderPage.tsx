import { useState, useRef, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Code, LayoutTemplate, Wand2, Wrench, Send, Loader2, Eye,
  Play, X, Sparkles, Terminal, Bot, Plus, Trash2, Clock,
  CheckCircle, AlertCircle, Wifi, WifiOff
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
  idle: { color: '#6B7280', label: 'Idle' },
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

export function WebsiteBuilderPage() {
  const [activeTab, setActiveTab] = useState('projects');

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
      console.error('Failed to load projects');
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
      const liveSlots = new Set(agentsRes.data.map(a => a.slot));
      setAssignedSlots(prev => {
        const cleaned = new Set([...prev].filter(s => liveSlots.has(s)));
        if (cleaned.size !== prev.size) return cleaned;
        return prev;
      });
    } catch {
      console.error('Failed to load fleet data');
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

  // Handle "Let's do it" — save dev changes (update existing or create new)
  const handleDevSave = async () => {
    setDevSaving(true);
    try {
      if (selectedProject) {
        // Update existing project
        await artifactService.update(selectedProject.id, {
          html: devHtml,
          css: devCss,
          js: devJs,
        });
        showToast('Changes saved and deployed!');
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
        await loadProjects();
      }
      setShowPreview(true);
      // Update iframe
      if (previewRef.current) {
        const doc = previewRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(getPreviewHtml());
          doc.close();
        }
      }
    } catch {
      showToast('Failed to save changes', 'error');
    } finally {
      setDevSaving(false);
    }
  };

  // Handle "Imagine & Add" — send prompt to agent
  const handleImagine = async () => {
    if (!imaginePrompt.trim()) return;
    setImagineLoading(true);
    try {
      const isEdit = !!selectedProject;
      const context = isEdit
        ? `Update the existing project titled "${selectedProject!.title}". `
        : 'Create a new website. ';
      const fullPrompt = `${context}${imaginePrompt}`;
      // Use 'builder' channel so the backend applies the code-generation system prompt,
      // and pass existingArtifactId when editing so generate_code updates instead of creates.
      const res = await agentService.chat(fullPrompt, 'builder', isEdit ? selectedProject!.id : undefined);
      const codeAction = res.data.actions?.find(a => a.tool === 'generate_code');
      if (codeAction?.success) {
        showToast(isEdit ? 'Project updated!' : 'New project created! Check My Projects.');
        if (isEdit && codeAction.artifactId) {
          // Refresh project list and re-select the updated project
          await loadProjects();
        }
      } else if (res.data.actions?.length) {
        showToast(isEdit ? 'Project updated! Check My Projects.' : 'New project created! Check My Projects.');
      } else {
        // No action block — show the AI text as a hint, but also warn
        showToast('AI responded but no code was generated. Try being more specific.', 'error');
      }
      setImaginePrompt('');
    } catch {
      showToast('Failed to generate. Try again.', 'error');
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
    try {
      await picoService.createAgent(newAgentName.trim(), newAgentPersonality);
      showToast(`Agent "${newAgentName.trim()}" deployed!`);
      setNewAgentName('');
      setNewAgentPersonality('weebo');
      setCreatingSlot(null);
      await loadFleet();
    } catch {
      showToast('Failed to deploy agent', 'error');
    } finally {
      setSavingAgent(false);
    }
  };

  const handleAssignTask = async () => {
    if (!taskInput.trim() || assignedSlots.size === 0) return;
    setPlanningTask(true);
    try {
      const res = await picoService.planTask(taskInput.trim());
      const count = res.data.queued;
      showToast(`Planned ${count} task${count !== 1 ? 's' : ''} for assigned agents`);
      setTaskInput('');
      await loadFleet();
    } catch {
      showToast('Failed to plan task', 'error');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8E8F0]">Website Builder</h1>
        <p className="text-sm text-[#6B7280] mt-1">Build, manage, and deploy your web projects</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-page-enter ${
          toast.type === 'success' ? 'bg-[#ADFF2F]/10 text-[#ADFF2F] border border-[#ADFF2F]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {toast.text}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="overflow-x-auto scrollbar-hide w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsList className="bg-[#0C0C18] border border-[#00F0FF]/10 flex w-max min-w-full">
            <TabsTrigger value="projects" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] gap-2 flex-shrink-0 whitespace-nowrap">
              <Code className="w-4 h-4" />
              My Projects
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] gap-2 flex-shrink-0 whitespace-nowrap">
              <LayoutTemplate className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="builder" className="data-[state=active]:bg-[#ADFF2F]/10 data-[state=active]:text-[#ADFF2F] gap-2 flex-shrink-0 whitespace-nowrap">
              <Wrench className="w-4 h-4" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="weebos" className="data-[state=active]:bg-[#00FF88]/10 data-[state=active]:text-[#00FF88] gap-2 flex-shrink-0 whitespace-nowrap">
              <Bot className="w-4 h-4" />
              Weebos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="projects" className="mt-6">
          <ArtifactsPage onNavigate={(page) => {
            if (page === 'templates') setActiveTab('templates');
          }} />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplateGalleryPage />
        </TabsContent>

        <TabsContent value="builder" className="mt-6">
          {/* Project selector */}
          <div className="mb-6">
            <label className="text-sm text-[#6B7280] mb-2 block">Working on:</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedProject(null)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  !selectedProject
                    ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30'
                    : 'bg-[#0C0C18] text-[#6B7280] border border-[#00F0FF]/10 hover:border-[#00F0FF]/30'
                }`}
              >
                New Project
              </button>
              {projectsLoading ? (
                <div className="flex items-center gap-2 text-[#6B7280] text-sm px-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadProjectForDev(p)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors truncate max-w-[200px] ${
                      selectedProject?.id === p.id
                        ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30'
                        : 'bg-[#0C0C18] text-[#6B7280] border border-[#00F0FF]/10 hover:border-[#00F0FF]/30'
                    }`}
                  >
                    {p.title}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Mode selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Imagine & Add */}
            <button
              onClick={() => setBuilderMode('imagine')}
              className={`p-6 rounded-2xl border text-left transition-all group ${
                builderMode === 'imagine'
                  ? 'border-[#ADFF2F]/40 bg-[#ADFF2F]/5'
                  : 'border-[#00F0FF]/10 hover:border-[#ADFF2F]/30 bg-[#0C0C18]/50'
              }`}
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  builderMode === 'imagine' ? 'bg-[#ADFF2F]/20' : 'bg-[#00F0FF]/10'
                }`}>
                  <Wand2 className={`w-5 h-5 ${builderMode === 'imagine' ? 'text-[#ADFF2F]' : 'text-[#00F0FF]'}`} />
                </div>
                <div>
                  <h3 className="text-[#E8E8F0] font-semibold">Imagine & Add</h3>
                  <p className="text-xs text-[#6B7280]">Let AI build it for you</p>
                </div>
              </div>
              <p className="text-sm text-[#6B7280]">
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
              className={`p-6 rounded-2xl border text-left transition-all group ${
                builderMode === 'dev'
                  ? 'border-[#00F0FF]/40 bg-[#00F0FF]/5'
                  : 'border-[#00F0FF]/10 hover:border-[#00F0FF]/30 bg-[#0C0C18]/50'
              }`}
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  builderMode === 'dev' ? 'bg-[#00F0FF]/20' : 'bg-[#00F0FF]/10'
                }`}>
                  <Terminal className={`w-5 h-5 ${builderMode === 'dev' ? 'text-[#00F0FF]' : 'text-[#6B7280]'}`} />
                </div>
                <div>
                  <h3 className="text-[#E8E8F0] font-semibold">Feelin&apos; to be a Dev</h3>
                  <p className="text-xs text-[#6B7280]">I&apos;ll input on it myself</p>
                </div>
              </div>
              <p className="text-sm text-[#6B7280]">
                Write HTML, CSS, and JavaScript directly. Full control over your code.
              </p>
            </button>
          </div>

          {/* ---- Imagine Mode ---- */}
          {builderMode === 'imagine' && (
            <div className="rounded-2xl border border-[#ADFF2F]/20 p-6" style={{ background: 'rgba(173, 255, 47, 0.03)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#ADFF2F]" />
                <h3 className="text-[#E8E8F0] font-semibold">
                  {selectedProject ? `Update "${selectedProject.title}"` : 'Create Something New'}
                </h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-4">
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
                  className="flex-1 bg-[#06060B] border border-[#ADFF2F]/20 rounded-xl px-4 py-3 text-[#E8E8F0] placeholder-[#6B7280]/50 resize-none focus:border-[#ADFF2F]/50 outline-none text-sm"
                />
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleImagine}
                  disabled={imagineLoading || !imaginePrompt.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ADFF2F] text-[#06060B] font-semibold text-sm hover:bg-[#ADFF2F]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
          )}

          {/* ---- Dev Mode ---- */}
          {builderMode === 'dev' && (
            <div className="space-y-4">
              {/* Title input — only shown for new projects */}
              {!selectedProject && (
                <div className="rounded-xl border border-[#00F0FF]/15 bg-[#0C0C18]/50 p-4 space-y-3">
                  <p className="text-sm text-[#6B7280]">
                    Starting fresh? Give your project a name and start coding below. Or select an existing project above to edit it.
                  </p>
                  <input
                    type="text"
                    value={devTitle}
                    onChange={(e) => setDevTitle(e.target.value)}
                    placeholder="Project name (e.g. Hello World)"
                    className="w-full bg-[#06060B] border border-[#00F0FF]/20 rounded-xl px-4 py-2.5 text-[#E8E8F0] placeholder-[#6B7280]/50 text-sm focus:border-[#00F0FF]/50 outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* HTML */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-[#E8E8F0]">
                        <span className="px-1.5 py-0.5 bg-[#FF6B35]/20 text-[#FF6B35] text-xs rounded font-mono">HTML</span>
                      </label>
                      <textarea
                        value={devHtml}
                        onChange={(e) => setDevHtml(e.target.value)}
                        spellCheck={false}
                        className="w-full h-64 bg-[#06060B] border border-[#00F0FF]/15 rounded-xl px-4 py-3 text-[#E8E8F0] font-mono text-xs resize-none focus:border-[#00F0FF]/40 outline-none leading-relaxed"
                        placeholder="<div>Your HTML here...</div>"
                      />
                    </div>

                    {/* CSS */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-[#E8E8F0]">
                        <span className="px-1.5 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] text-xs rounded font-mono">CSS</span>
                      </label>
                      <textarea
                        value={devCss}
                        onChange={(e) => setDevCss(e.target.value)}
                        spellCheck={false}
                        className="w-full h-64 bg-[#06060B] border border-[#00F0FF]/15 rounded-xl px-4 py-3 text-[#E8E8F0] font-mono text-xs resize-none focus:border-[#00F0FF]/40 outline-none leading-relaxed"
                        placeholder="body { color: white; }"
                      />
                    </div>

                    {/* JavaScript */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-[#E8E8F0]">
                        <span className="px-1.5 py-0.5 bg-[#FFD700]/20 text-[#FFD700] text-xs rounded font-mono">JS</span>
                      </label>
                      <textarea
                        value={devJs}
                        onChange={(e) => setDevJs(e.target.value)}
                        spellCheck={false}
                        className="w-full h-64 bg-[#06060B] border border-[#00F0FF]/15 rounded-xl px-4 py-3 text-[#E8E8F0] font-mono text-xs resize-none focus:border-[#00F0FF]/40 outline-none leading-relaxed"
                        placeholder="console.log('Hello world');"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleDevSave}
                      disabled={devSaving}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00F0FF] text-[#06060B] font-bold text-sm hover:bg-[#00F0FF]/80 transition-colors disabled:opacity-50"
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
                        setShowPreview(!showPreview);
                        if (!showPreview && previewRef.current) {
                          setTimeout(() => {
                            const doc = previewRef.current?.contentDocument;
                            if (doc) {
                              doc.open();
                              doc.write(getPreviewHtml());
                              doc.close();
                            }
                          }, 50);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/20 text-[#6B7280] hover:text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-colors text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      {showPreview ? 'Hide Preview' : 'Preview'}
                    </button>
                  </div>

                  {/* Live Preview */}
              {showPreview && (
                <div className="rounded-2xl border border-[#00F0FF]/20 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#0C0C18] border-b border-[#00F0FF]/10">
                    <span className="text-xs text-[#6B7280] font-mono">Preview</span>
                    <button onClick={() => setShowPreview(false)} className="text-[#6B7280] hover:text-[#E8E8F0]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <iframe
                    ref={previewRef}
                    title="Live Preview"
                    sandbox="allow-scripts allow-modals allow-forms"
                    className="w-full h-[500px] bg-white"
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ======== Weebos Tab ======== */}
        <TabsContent value="weebos" className="mt-6 space-y-6">
          {fleetLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#00FF88] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Assigned agents */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#E8E8F0] flex items-center gap-2">
                    <Bot className="w-5 h-5 text-[#00FF88]" />
                    Assigned Weebos
                    <span className="text-xs text-[#6B7280] font-normal ml-1">
                      {assignedAgents.length}/{MAX_ASSIGNED} max
                    </span>
                  </h3>
                </div>

                {assignedAgents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#00FF88]/20 p-8 text-center">
                    <Bot className="w-10 h-10 text-[#00FF88]/30 mx-auto mb-3" />
                    <p className="text-[#6B7280] text-sm">No agents assigned yet.</p>
                    <p className="text-[#6B7280] text-xs mt-1">Assign agents from your fleet below, or deploy a new one.</p>
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
                          className="rounded-2xl border border-[#00FF88]/20 p-5 transition-all hover:border-[#00FF88]/40"
                          style={{ background: 'rgba(0, 255, 136, 0.03)' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{personality}</span>
                              <div>
                                <div className="font-semibold text-[#E8E8F0] text-sm">{agent.name}</div>
                                <div className="text-xs text-[#6B7280] capitalize">Slot {agent.slot} &middot; {agent.personality}</div>
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
                                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors"
                                title="Unassign from Builder"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="flex gap-3 mb-3">
                            <div className="flex-1 p-2.5 rounded-lg bg-[#06060B] border border-[#00FF88]/10">
                              <div className="text-xs text-[#6B7280]">Completed</div>
                              <div className="text-lg font-bold text-[#00FF88] font-mono">{agent.tasks_completed}</div>
                            </div>
                            <div className="flex-1 p-2.5 rounded-lg bg-[#06060B] border border-[#FF6161]/10">
                              <div className="text-xs text-[#6B7280]">Failed</div>
                              <div className="text-lg font-bold text-[#FF6161] font-mono">{agent.tasks_failed}</div>
                            </div>
                          </div>

                          {/* Current work progress */}
                          {agentTasks.length > 0 ? (
                            <div className="space-y-2">
                              <div className="text-xs text-[#6B7280] font-medium">Current Work</div>
                              {agentTasks.slice(0, 2).map(task => (
                                <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/10">
                                  {task.status === 'running' ? (
                                    <Loader2 className="w-3.5 h-3.5 text-[#FFB800] animate-spin shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-[#00F0FF] shrink-0" />
                                  )}
                                  <span className="text-xs text-[#E8E8F0] truncate flex-1">{task.description}</span>
                                  <span className="text-[10px] capitalize shrink-0"
                                    style={{ color: task.status === 'running' ? '#FFB800' : '#00F0FF' }}>
                                    {task.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#06060B] border border-[#00F0FF]/10">
                              <CheckCircle className="w-3.5 h-3.5 text-[#6B7280]" />
                              <span className="text-xs text-[#6B7280]">No active tasks — ready for work</span>
                            </div>
                          )}

                          <div className="mt-2 text-[10px] text-[#6B7280] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Created {formatTimeAgo(agent.created_at)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick task for assigned agents */}
              {assignedAgents.length > 0 && (
                <div className="rounded-2xl border border-[#00F0FF]/20 p-5" style={{ background: 'rgba(0, 240, 255, 0.02)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4 text-[#00F0FF]" />
                    <h3 className="text-sm font-semibold text-[#E8E8F0]">Assign Task</h3>
                  </div>
                  <div className="flex gap-3">
                    <input
                      value={taskInput}
                      onChange={e => setTaskInput(e.target.value)}
                      placeholder="Describe a website task for your agents..."
                      className="flex-1 bg-[#06060B] border border-[#00F0FF]/20 rounded-xl px-4 py-2.5 text-[#E8E8F0] placeholder-[#6B7280]/50 text-sm focus:border-[#00F0FF]/50 outline-none"
                      onKeyDown={e => e.key === 'Enter' && !planningTask && handleAssignTask()}
                      disabled={planningTask}
                    />
                    <button
                      onClick={handleAssignTask}
                      disabled={!taskInput.trim() || planningTask}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00F0FF] text-[#06060B] font-semibold text-sm hover:bg-[#00F0FF]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <p className="text-xs text-[#6B7280] mt-2">
                    The planner will break your request into tasks and assign them to available agents.
                  </p>
                </div>
              )}

              {/* Assign from fleet */}
              {unassignedAgents.length > 0 && assignedSlots.size < MAX_ASSIGNED && (
                <div>
                  <h3 className="text-sm font-semibold text-[#E8E8F0] mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#00F0FF]" />
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
                          className="flex items-center gap-3 p-4 rounded-xl border border-[#00F0FF]/10 bg-[#0C0C18]/50 hover:border-[#00FF88]/40 hover:bg-[#00FF88]/5 transition-all text-left cursor-pointer group"
                        >
                          <span className="text-lg">{personality}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#E8E8F0] truncate">{agent.name}</div>
                            <div className="text-xs text-[#6B7280]">Slot {agent.slot}</div>
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]"
                            style={{ background: `${color}15`, color }}>
                            {statusMeta[agent.status]?.label ?? agent.status}
                          </div>
                          <Plus className="w-4 h-4 text-[#00FF88] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Deploy new agent */}
              {emptySlots.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#E8E8F0] mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#ADFF2F]" />
                    Deploy New Agent
                  </h3>

                  {creatingSlot !== null ? (
                    <div className="rounded-2xl border border-dashed border-[#00F0FF]/30 p-5 max-w-md">
                      <p className="text-sm text-[#6B7280] mb-3">Choose personality for Slot {creatingSlot}</p>
                      <div className="flex gap-2 mb-3">
                        {([
                          { id: 'weebo' as const, emoji: '🤖', label: 'Weebo', color: '#00FF88' },
                          { id: 'jarvis' as const, emoji: '🎩', label: 'Jarvis', color: '#00F0FF' },
                          { id: 'edith' as const, emoji: '⚡', label: 'Edith', color: '#FFB800' },
                        ]).map(p => (
                          <button
                            key={p.id}
                            onClick={() => setNewAgentPersonality(p.id)}
                            className="flex flex-col items-center gap-1 p-3 rounded-lg border transition-all min-w-[60px]"
                            style={{
                              borderColor: newAgentPersonality === p.id ? p.color : 'rgba(0, 240, 255, 0.15)',
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
                        className="w-full bg-[#06060B] border border-[#00F0FF]/20 rounded-xl px-4 py-2.5 text-[#E8E8F0] placeholder-[#6B7280]/50 text-sm focus:border-[#00F0FF]/50 outline-none mb-3"
                        onKeyDown={e => e.key === 'Enter' && handleDeployAgent()}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setCreatingSlot(null); setNewAgentName(''); }}
                          className="px-4 py-2 rounded-xl border border-[#00F0FF]/20 text-[#6B7280] text-sm hover:text-[#E8E8F0] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeployAgent}
                          disabled={!newAgentName.trim() || savingAgent}
                          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00FF88] text-[#06060B] font-semibold text-sm hover:bg-[#00FF88]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deploy'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {emptySlots.slice(0, 3).map(slot => (
                        <button
                          key={slot}
                          onClick={() => setCreatingSlot(slot)}
                          className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-[#00F0FF]/20 hover:border-[#00FF88]/40 hover:bg-[#00FF88]/5 transition-all cursor-pointer group"
                        >
                          <Plus className="w-5 h-5 text-[#00F0FF] group-hover:text-[#00FF88]" />
                          <span className="text-sm text-[#6B7280] group-hover:text-[#E8E8F0]">Slot {slot}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Agent removal section — only show if there are assigned agents */}
              {assignedAgents.length > 0 && (
                <div className="pt-4 border-t border-[#00F0FF]/10">
                  <details className="group">
                    <summary className="text-xs text-[#6B7280] cursor-pointer hover:text-[#E8E8F0] transition-colors flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Manage assigned agents
                    </summary>
                    <div className="mt-3 space-y-2">
                      {assignedAgents.map(agent => (
                        <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-[#06060B] border border-[#00F0FF]/10">
                          <span className="text-sm text-[#E8E8F0]">
                            {agent.personality === 'edith' ? '⚡' : agent.personality === 'jarvis' ? '🎩' : '🤖'} {agent.name} (Slot {agent.slot})
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleAssign(agent.slot)}
                              className="px-3 py-1 rounded-lg text-xs text-[#6B7280] border border-[#00F0FF]/10 hover:text-[#E8E8F0] hover:border-[#00F0FF]/30 transition-colors"
                            >
                              Unassign
                            </button>
                            {agent.slot !== 1 && (
                              <button
                                onClick={() => handleDeleteAgent(agent)}
                                className="px-3 py-1 rounded-lg text-xs text-[#FF6161] border border-[#FF6161]/20 hover:bg-[#FF6161]/10 transition-colors flex items-center gap-1"
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
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
