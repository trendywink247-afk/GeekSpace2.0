import { useState, useRef, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import {
  Code, LayoutTemplate, Wand2, Wrench, Loader2,
  Terminal, Bot,
} from 'lucide-react';
import { ArtifactsPage } from '../ArtifactsPage';
import { artifactService, picoService, agentService } from '@/services/api';
import type { Artifact } from '@/types';
import {
  TemplateGallery,
  ImaginePanel,
  EditorPanel,
  DeployPanel,
  type DeviceMode,
  type FleetAgent,
  type FleetTask,
} from './';

export function WebsiteBuilderPage() {
  const [activeTab, setActiveTab] = useState('projects');
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'website-builder' });

  // ---- Builder state ----
  const [builderMode, setBuilderMode] = useState<'imagine' | 'dev' | null>(null);
  const [imaginePrompt, setImaginePrompt] = useState('');
  const [imagineLoading, setImagineLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Artifact | null>(null);
  const [projects, setProjects] = useState<Artifact[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // ---- Dev mode state ----
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

  // ---- Weebos tab state ----
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

  // ---- Helpers ----
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const getPreviewHtml = () =>
    `<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${devCss}</style></head>\n<body>${devHtml}<script>${devJs}<` +
    `/script></body></html>`;

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

  // ---- Data fetching ----
  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await artifactService.list();
      setProjects(res.data.artifacts);
    } catch {
      // show empty list
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadFleet = useCallback(async () => {
    setFleetLoading(true);
    try {
      const [agentsRes, tasksRes] = await Promise.all([
        picoService.getAgents(),
        picoService.getTasks({ limit: 20 }),
      ]);
      setFleetAgents(agentsRes.data);
      setFleetTasks(tasksRes.data);
      const liveSlots = new Set(agentsRes.data.map((a: FleetAgent) => a.slot));
      setAssignedSlots((prev) => {
        const cleaned = new Set([...prev].filter((s) => liveSlots.has(s)));
        return cleaned.size !== prev.size ? cleaned : prev;
      });
    } catch {
      // show empty fleet
    } finally {
      setFleetLoading(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('wb_assigned_slots', JSON.stringify([...assignedSlots]));
  }, [assignedSlots]);

  // ---- Tab change ----
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'builder') { loadProjects(); setBuilderMode(null); setSelectedProject(null); }
    if (tab === 'weebos') { loadFleet(); }
  };

  // ---- Builder handlers ----
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

  const handleDevSave = async () => {
    setDevSaving(true);
    void notifyStart('Saving website project');
    try {
      if (selectedProject) {
        await artifactService.update(selectedProject.id, { html: devHtml, css: devCss, js: devJs });
        showToast('Changes saved and deployed!');
        void notifyDone(`Updated project "${selectedProject.title}"`);
      } else {
        const title = devTitle.trim() || 'My Project';
        const res = await artifactService.create({ title, html: devHtml, css: devCss, js: devJs });
        setSelectedProject(res.data as Artifact);
        showToast(`Project "${title}" created!`);
        void notifyDone(`Created project "${title}"`);
        await loadProjects();
      }
      setShowPreview(true);
      setTimeout(refreshPreview, 50);
    } catch {
      showToast('Failed to save changes', 'error');
      void notifyFail('Save failed');
    } finally {
      setDevSaving(false);
    }
  };

  const handleImagine = async () => {
    if (!imaginePrompt.trim()) return;
    setImagineLoading(true);
    const isEdit = !!selectedProject;
    void notifyStart(isEdit ? 'Updating project via AI' : 'Generating project via AI');
    try {
      const context = isEdit
        ? `Update the existing project titled "${selectedProject!.title}". `
        : 'Create a new website. ';
      const res = await agentService.chat(
        `${context}${imaginePrompt}`,
        'builder',
        isEdit ? selectedProject!.id : undefined,
      );
      const codeAction = res.data.actions?.find((a: { tool: string }) => a.tool === 'generate_code');
      if (codeAction?.success) {
        showToast(isEdit ? 'Project updated!' : 'New project created! Check My Projects.');
        void notifyDone(isEdit ? 'Project updated via AI' : 'New project generated via AI');
        if (isEdit && codeAction.artifactId) await loadProjects();
      } else if (res.data.actions?.length) {
        showToast(isEdit ? 'Project updated! Check My Projects.' : 'New project created! Check My Projects.');
        void notifyDone('AI action completed');
      } else {
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

  // ---- Weebo handlers ----
  const toggleAssign = (slot: number) => {
    setAssignedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) { next.delete(slot); }
      else if (next.size < 4) { next.add(slot); }
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
      setNewAgentName(''); setNewAgentPersonality('weebo'); setCreatingSlot(null);
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
      setAssignedSlots((prev) => { const n = new Set(prev); n.delete(agent.slot); return n; });
      await loadFleet();
    } catch {
      showToast('Failed to remove agent', 'error');
    }
  };

  // ---- Render ----
  return (
    <DashboardPageWrapper>
      <PageShell>
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
            <div
              className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${
                toast.type === 'success'
                  ? 'bg-[var(--ag-bg-surface)] text-[var(--ag-violet)] border border-[var(--ag-border-active)]'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {toast.text}
            </div>
          </BlurFade>
        )}

        <BlurFade delay={0.1}>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="overflow-x-auto scrollbar-hide w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
              <TabsList className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] flex w-max min-w-full">
                <TabsTrigger value="projects" className="data-[state=active]:bg-[var(--ag-active-bg)] data-[state=active]:text-[var(--ag-violet)] gap-2 flex-shrink-0 whitespace-nowrap min-h-[44px]">
                  <Code className="w-4 h-4" />My Projects
                </TabsTrigger>
                <TabsTrigger value="templates" className="data-[state=active]:bg-[var(--ag-active-bg)] data-[state=active]:text-[var(--ag-violet)] gap-2 flex-shrink-0 whitespace-nowrap min-h-[44px]">
                  <LayoutTemplate className="w-4 h-4" />Templates
                </TabsTrigger>
                <TabsTrigger value="builder" className="data-[state=active]:bg-[var(--ag-active-bg)] data-[state=active]:text-[var(--ag-violet)] gap-2 flex-shrink-0 whitespace-nowrap min-h-[44px]">
                  <Wrench className="w-4 h-4" />Builder
                </TabsTrigger>
                <TabsTrigger value="weebos" className="data-[state=active]:bg-[var(--ag-active-bg)] data-[state=active]:text-[var(--ag-violet)] gap-2 flex-shrink-0 whitespace-nowrap min-h-[44px]">
                  <Bot className="w-4 h-4" />Weebos
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ---- My Projects tab ---- */}
            <TabsContent value="projects" className="mt-6">
              <BlurFade delay={0.2}>
                <ArtifactsPage onNavigate={(page) => { if (page === 'templates') setActiveTab('templates'); }} />
              </BlurFade>
            </TabsContent>

            {/* ---- Templates tab ---- */}
            <TabsContent value="templates" className="mt-6">
              <BlurFade delay={0.2}>
                <TemplateGallery />
              </BlurFade>
            </TabsContent>

            {/* ---- Builder tab ---- */}
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
                        <Loader2 className="w-4 h-4 animate-spin" />Loading...
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

              {/* Mode selector cards */}
              <BlurFade delay={0.3}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setBuilderMode('imagine')}
                    className={`p-6 rounded-2xl text-left transition-[transform,box-shadow,border-color] duration-200 group active:scale-[0.96] ${
                      builderMode === 'imagine'
                        ? 'border border-[var(--ag-border-active)] bg-[var(--ag-active-bg)] shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_8px_32px_rgba(0,0,0,0.45),var(--ag-glow-md)]'
                        : 'border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-glow)] bg-[var(--ag-bg-surface)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.35)]'
                    }`}
                    style={{ backdropFilter: 'blur(var(--ag-glass-blur))', WebkitBackdropFilter: 'blur(var(--ag-glass-blur))' }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${builderMode === 'imagine' ? 'bg-[var(--ag-active-bg)]' : 'bg-[var(--ag-violet)]/10'}`}>
                        <Wand2 className={`w-5 h-5 ${builderMode === 'imagine' ? 'text-[var(--ag-violet)]' : 'text-[var(--ag-text-secondary)]'}`} />
                      </div>
                      <div>
                        <h3 className="text-[var(--ag-text-primary)] font-heading font-semibold">Imagine &amp; Add</h3>
                        <p className="text-xs text-[var(--ag-text-secondary)]">Let AI build it for you</p>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--ag-text-secondary)]">
                      Describe what you want and the agent will create or update your project.
                    </p>
                  </button>

                  <button
                    onClick={() => {
                      setBuilderMode('dev');
                      if (selectedProject && !devHtml && !devCss && !devJs) loadProjectForDev(selectedProject);
                    }}
                    className={`p-6 rounded-2xl text-left transition-[transform,box-shadow,border-color] duration-200 group active:scale-[0.96] ${
                      builderMode === 'dev'
                        ? 'border border-[var(--ag-border-active)] bg-[var(--ag-cyan)]/5 shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_8px_32px_rgba(0,0,0,0.45),var(--ag-glow-md)]'
                        : 'border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-glow)] bg-[var(--ag-bg-surface)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.35)]'
                    }`}
                    style={{ backdropFilter: 'blur(var(--ag-glass-blur))', WebkitBackdropFilter: 'blur(var(--ag-glass-blur))' }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${builderMode === 'dev' ? 'bg-[var(--ag-cyan)]/20' : 'bg-[var(--ag-cyan)]/10'}`}>
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

              {/* Imagine mode */}
              {builderMode === 'imagine' && (
                <BlurFade delay={0.4}>
                  <ImaginePanel
                    selectedProject={selectedProject}
                    imaginePrompt={imaginePrompt}
                    imagineLoading={imagineLoading}
                    onPromptChange={setImaginePrompt}
                    onImagine={handleImagine}
                  />
                </BlurFade>
              )}

              {/* Dev mode editor */}
              {builderMode === 'dev' && (
                <BlurFade delay={0.4}>
                  <EditorPanel
                    selectedProject={selectedProject}
                    devTitle={devTitle}
                    devHtml={devHtml}
                    devCss={devCss}
                    devJs={devJs}
                    devSaving={devSaving}
                    showPreview={showPreview}
                    splitView={splitView}
                    deviceMode={deviceMode}
                    previewRef={previewRef}
                    setDevTitle={setDevTitle}
                    setDevHtml={setDevHtml}
                    setDevCss={setDevCss}
                    setDevJs={setDevJs}
                    onSave={handleDevSave}
                    onTogglePreview={() => {
                      const next = !showPreview;
                      setShowPreview(next);
                      if (next) setTimeout(refreshPreview, 50);
                    }}
                    onToggleSplit={() => setSplitView((v) => !v)}
                    onDeviceModeChange={setDeviceMode}
                    onRefreshPreview={refreshPreview}
                  />
                </BlurFade>
              )}
            </TabsContent>

            {/* ---- Weebos tab ---- */}
            <TabsContent value="weebos" className="mt-6">
              <BlurFade delay={0.2}>
                <DeployPanel
                  fleetAgents={fleetAgents}
                  fleetTasks={fleetTasks}
                  fleetLoading={fleetLoading}
                  assignedSlots={assignedSlots}
                  creatingSlot={creatingSlot}
                  newAgentName={newAgentName}
                  newAgentPersonality={newAgentPersonality}
                  savingAgent={savingAgent}
                  taskInput={taskInput}
                  planningTask={planningTask}
                  onToggleAssign={toggleAssign}
                  onDeployAgent={handleDeployAgent}
                  onAssignTask={handleAssignTask}
                  onDeleteAgent={handleDeleteAgent}
                  setCreatingSlot={setCreatingSlot}
                  setNewAgentName={setNewAgentName}
                  setNewAgentPersonality={setNewAgentPersonality}
                  setTaskInput={setTaskInput}
                />
              </BlurFade>
            </TabsContent>
          </Tabs>
        </BlurFade>
      </PageShell>
    </DashboardPageWrapper>
  );
}
