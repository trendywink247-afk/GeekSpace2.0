import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell, PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { Check, Sparkles, Bot, Brain, Wrench, Link2, Settings } from 'lucide-react';
import { AgentHeroCard } from './agent-settings/AgentHeroCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboard-store';
import { confirmAction, showSuccess, showError } from '@/utils/alerts';
import { agentService, memoryService, integrationService } from '@/services/api';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import type { Personality, AgentPersonality } from '@/types';
import {
  PersonalityTab,
  MemoryTab,
  ToolsTab,
  ChannelsTab,
  AGENTS,
} from './agent-settings';

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentSettingsPage() {
  const { agent, updateAgent, integrations, loadIntegrations } = useDashboardStore();
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'agent-settings' });
  const isDirty = useRef(false);

  // Personality state
  const [selectedPersonality, setSelectedPersonality] = useState<AgentPersonality>(
    agent.personality || 'weebo',
  );
  const [personalities, setPersonalities] = useState<Record<string, Personality>>({});
  const [agentName, setAgentName] = useState(agent.name || 'Weebo');
  const [tone, setTone] = useState([agent.formality ?? 50]);
  const [verbosity, setVerbosity] = useState([agent.verbosity ?? 50]);
  const [creativity, setCreativity] = useState([agent.creativity ?? 50]);
  const [humor, setHumor] = useState([agent.humor ?? 50]);
  const [empathy, setEmpathy] = useState([agent.empathy ?? 50]);
  const [language, setLanguage] = useState('english');
  const [autonomyLevel, setAutonomyLevel] = useState('assisted');
  const [customInstructions, setCustomInstructions] = useState(agent.systemPrompt || '');
  const [selectedModel, setSelectedModel] = useState(agent.primaryModel || 'auto');

  // Memory state
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryCount, setMemoryCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);

  // Tools state
  const [toolStates, setToolStates] = useState<Record<string, boolean>>({
    web_search: true,
    calculator: true,
    calendar: false,
    reminders: true,
    image_gen: true,
    code_exec: true,
  });

  // Channels state
  const [telegramStatus, setTelegramStatus] = useState<
    'connected' | 'not_connected' | 'checking'
  >('checking');

  // Save / toast state
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState('personality');

  // ─── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    agentService
      .getPersonalities()
      .then(({ data }) => setPersonalities(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    memoryService
      .list()
      .then(({ data }) => {
        if (Array.isArray(data)) setMemoryCount(data.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadIntegrations().catch(() => {});
    integrationService
      .checkTelegramLink()
      .then(({ data }) => {
        setTelegramStatus(data.linked ? 'connected' : 'not_connected');
      })
      .catch(() => setTelegramStatus('not_connected'));
  }, [loadIntegrations]);

  // Sync from store once on mount
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (!hasHydrated.current && agent.id) {
      setSelectedPersonality(agent.personality || 'weebo');
      setAgentName(agent.name || 'Weebo');
      setTone([agent.formality ?? 50]);
      setVerbosity([agent.verbosity ?? 50]);
      setCreativity([agent.creativity ?? 50]);
      setHumor([agent.humor ?? 50]);
      setEmpathy([agent.empathy ?? 50]);
      setCustomInstructions(agent.systemPrompt || '');
      setSelectedModel(agent.primaryModel || 'auto');
      hasHydrated.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAgentSwitch = useCallback(
    async (id: AgentPersonality) => {
      const prev = selectedPersonality;
      setSelectedPersonality(id);
      const agentDef = AGENTS.find((a) => a.id === id);
      try {
        await updateAgent({ personality: id });
        const p = personalities[id];
        setSaveToast(`Switched to ${p?.name || agentDef?.name}!`);
        setTimeout(() => setSaveToast(''), 2500);
      } catch {
        setSelectedPersonality(prev);
        setSaveToast('Failed to switch. Try again.');
        setTimeout(() => setSaveToast(''), 2500);
      }
    },
    [selectedPersonality, personalities, updateAgent],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveToast('');
    try {
      await updateAgent({
        name: agentName,
        formality: tone[0],
        creativity: creativity[0],
        verbosity: verbosity[0],
        humor: humor[0],
        empathy: empathy[0],
        systemPrompt: customInstructions,
        primaryModel: selectedModel,
      });
      isDirty.current = false;
      await notifyDone('Agent settings saved');
      await showSuccess('Saved', 'Agent settings updated successfully.');
    } catch {
      await notifyFail('Failed to save agent settings');
      await showError('Save Failed', 'Could not save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    agentName,
    tone,
    verbosity,
    creativity,
    humor,
    empathy,
    customInstructions,
    selectedModel,
    updateAgent,
    notifyDone,
    notifyFail,
  ]);

  const handleClearAllMemories = useCallback(async () => {
    const confirmed = await confirmAction(
      'Clear All Memories?',
      `This will permanently delete ${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'}. This cannot be undone.`,
    );
    if (!confirmed) return;
    setIsClearing(true);
    try {
      const { data } = await memoryService.clearAll();
      setMemoryCount(0);
      await showSuccess('Memories Cleared', `Deleted ${data.deleted} memories`);
    } catch {
      await showError('Clear Failed', 'Failed to clear memories. Try again.');
    } finally {
      setIsClearing(false);
    }
  }, [memoryCount]);

  const toggleTool = useCallback((toolId: string) => {
    setToolStates((prev) => ({ ...prev, [toolId]: !prev[toolId] }));
    isDirty.current = true;
  }, []);

  // ─── Derived values ───────────────────────────────────────────────────────

  const currentAgent = AGENTS.find((a) => a.id === selectedPersonality) || AGENTS[0];
  const telegramInt = integrations.find((i) => i.type === 'telegram');
  const isTelegramConnected =
    telegramStatus === 'connected' || telegramInt?.status === 'connected';

  const tabs = [
    { value: 'personality', label: 'Personality', icon: Bot },
    { value: 'memory', label: 'Memory', icon: Brain },
    { value: 'tools', label: 'Tools', icon: Wrench },
    { value: 'channels', label: 'Channels', icon: Link2 },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardPageWrapper>
      <PageShell maxWidth="4xl">

        {/* ── Toast ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {saveToast && (
            <motion.div
              key="toast"
              initial={{ opacity: 0, y: -16, scale: 0.95, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, scale: 0.97, filter: 'blur(4px)' }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
              className="fixed top-6 right-6 z-50"
            >
              <div
                className="px-4 py-3 rounded-2xl text-sm text-[var(--ag-text-primary)] flex items-center gap-2.5"
                style={{
                  background: 'var(--ag-bg-elevated)',
                  backdropFilter: 'blur(16px)',
                  boxShadow:
                    '0 0 0 1px rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.4), var(--ag-glow-md)',
                }}
              >
                {saveToast.includes('Saved') ||
                saveToast.includes('Switched') ||
                saveToast.includes('Cleared') ? (
                  <Check className="w-4 h-4 text-[var(--ag-lime)] flex-shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                )}
                <span>{saveToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <PageHeader
          icon={Settings}
          title="Agent Settings"
          subtitle={`Configure ${currentAgent.name} — personality, memory, tools & channels`}
          badge={
            <span className="relative flex h-3 w-3" title="Owned by Weebo">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ag-cyan)] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--ag-cyan)]" />
            </span>
          }
        />

        {/* ── Agent hero card ──────────────────────────────────────────────── */}
        <AgentHeroCard
          selectedPersonality={selectedPersonality}
          onSwitch={handleAgentSwitch}
        />

        {/* ── Tab navigation + content ──────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab bar */}
          <div
            className="relative flex rounded-2xl overflow-hidden p-1.5 gap-1"
            style={{
              background: 'rgba(255,255,255,0.02)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.05) inset',
            }}
          >
            <TabsList className="flex w-full bg-transparent p-0 h-auto gap-1 rounded-none">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.value;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative flex-1 rounded-xl px-3 py-2.5 min-h-[44px] text-sm font-medium z-10 bg-transparent shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                    style={{ color: isActive ? 'var(--ag-text-primary)' : 'var(--ag-text-secondary)' }}
                  >
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          layoutId="tab-active-bg"
                          className="absolute inset-0 rounded-xl"
                          style={{
                            background: 'var(--ag-bg-elevated)',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)',
                          }}
                          transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
                        />
                      )}
                    </AnimatePresence>
                    <span className="relative z-10 flex items-center justify-center gap-1.5">
                      <tab.icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* ── Personality tab ─────────────────────────────────────────── */}
          <TabsContent value="personality" asChild>
            <AnimatePresence mode="wait">
              {activeTab === 'personality' && (
                <PersonalityTab
                  key="personality"
                  agentName={agentName}
                  setAgentName={setAgentName}
                  tone={tone}
                  setTone={setTone}
                  verbosity={verbosity}
                  setVerbosity={setVerbosity}
                  creativity={creativity}
                  setCreativity={setCreativity}
                  humor={humor}
                  setHumor={setHumor}
                  empathy={empathy}
                  setEmpathy={setEmpathy}
                  language={language}
                  setLanguage={setLanguage}
                  autonomyLevel={autonomyLevel}
                  setAutonomyLevel={setAutonomyLevel}
                  customInstructions={customInstructions}
                  setCustomInstructions={setCustomInstructions}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  isSaving={isSaving}
                  currentAgentName={currentAgent.name}
                  onDirty={() => { isDirty.current = true; }}
                  onSave={handleSave}
                />
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── Memory tab ──────────────────────────────────────────────── */}
          <TabsContent value="memory" asChild>
            <AnimatePresence mode="wait">
              {activeTab === 'memory' && (
                <MemoryTab
                  key="memory"
                  memoryEnabled={memoryEnabled}
                  setMemoryEnabled={setMemoryEnabled}
                  memoryCount={memoryCount}
                  isClearing={isClearing}
                  onClearAllMemories={handleClearAllMemories}
                />
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── Tools tab ───────────────────────────────────────────────── */}
          <TabsContent value="tools" asChild>
            <AnimatePresence mode="wait">
              {activeTab === 'tools' && (
                <ToolsTab
                  key="tools"
                  toolStates={toolStates}
                  onToggleTool={toggleTool}
                />
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── Channels tab ────────────────────────────────────────────── */}
          <TabsContent value="channels" asChild>
            <AnimatePresence mode="wait">
              {activeTab === 'channels' && (
                <ChannelsTab
                  key="channels"
                  telegramStatus={telegramStatus}
                  isTelegramConnected={isTelegramConnected}
                />
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </PageShell>
    </DashboardPageWrapper>
  );
}
