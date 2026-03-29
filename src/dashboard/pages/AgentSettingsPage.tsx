import { useState, useEffect, useRef, useCallback } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Check,
  Sparkles,
  Brain,
  Save,
  Search,
  Calculator,
  CalendarDays,
  Bell,
  ImageIcon,
  Code,
  Globe,
  MessageCircle,
  Trash2,
  ExternalLink,
  Send,
  Wrench,
  Link2,
  Shield,
  Users,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboardStore';
import { confirmAction, showSuccess, showError } from '@/utils/alerts';
import { agentService, memoryService, integrationService } from '@/services/api';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import type { Personality, AgentPersonality } from '@/types';

// ---- Agent definitions ----

interface AgentDef {
  id: AgentPersonality;
  name: string;
  color: string;
  description: string;
}

const AGENTS: AgentDef[] = [
  { id: 'weebo', name: 'Weebo', color: '#8B5CF6', description: 'Balanced all-rounder' },
  { id: 'edith', name: 'Edith', color: '#8B5CF6', description: 'Strategic & focused' },
  { id: 'jarvis', name: 'Jarvis', color: '#ADFF2F', description: 'Professional & efficient' },
];

// ---- Model definitions ----

interface ModelDef {
  id: string;
  label: string;
  tier: 'free' | 'pro';
}

const MODELS: ModelDef[] = [
  { id: 'auto', label: 'Auto', tier: 'free' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', tier: 'free' },
  { id: 'claude-3-haiku', label: 'Claude Haiku', tier: 'free' },
  { id: 'gpt-4o', label: 'GPT-4o', tier: 'pro' },
  { id: 'claude-3.5-sonnet', label: 'Claude Sonnet', tier: 'pro' },
  { id: 'claude-3-opus', label: 'Claude Opus', tier: 'pro' },
];

// ---- Tool definitions ----

interface ToolDef {
  id: string;
  label: string;
  description: string;
  icon: typeof Search;
}

const TOOLS: ToolDef[] = [
  { id: 'web_search', label: 'Web Search', description: 'Search the internet for information', icon: Search },
  { id: 'calculator', label: 'Calculator', description: 'Perform math calculations', icon: Calculator },
  { id: 'calendar', label: 'Calendar Access', description: 'Read and manage your calendar', icon: CalendarDays },
  { id: 'reminders', label: 'Reminder Creation', description: 'Set and manage reminders', icon: Bell },
  { id: 'image_gen', label: 'Image Generation', description: 'Generate images from prompts', icon: ImageIcon },
  { id: 'code_exec', label: 'Code Execution', description: 'Run code snippets', icon: Code },
];

// ---- Tone / Verbosity labels ----

const TONE_LABELS = ['Very Formal', 'Formal', 'Balanced', 'Casual', 'Very Casual'];
const VERBOSITY_LABELS = ['Terse', 'Brief', 'Balanced', 'Detailed', 'Very Detailed'];
const HUMOR_LABELS = ['Serious', 'Neutral', 'Balanced', 'Witty', 'Very Humorous'];
const EMPATHY_LABELS = ['Direct', 'Factual', 'Balanced', 'Warm', 'Very Empathetic'];

// ---- Autonomy levels ----

const AUTONOMY_LEVELS = [
  { id: 'ask', label: 'Ask me first', icon: Shield, description: 'Agent proposes actions and waits for your approval before executing.' },
  { id: 'assisted', label: 'Assisted', icon: Bot, description: 'Agent acts on routine tasks, asks for important ones.' },
  { id: 'auto', label: 'Just do it', icon: Sparkles, description: 'Agent executes without asking. You can always undo.' },
] as const;

// ---- Agent feature assignments ----

const AGENT_ASSIGNMENTS: Record<string, string[]> = {
  weebo: ['Creative', 'Social', 'Chat'],
  edith: ['Code', 'Systems', 'Terminal'],
  jarvis: ['Calendar', 'Reminders', 'Email'],
};

// ---- Component ----

export function AgentSettingsPage() {
  const navigate = useNavigate();
  const { agent, updateAgent, integrations, loadIntegrations } = useDashboardStore();
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'agent-settings' });
  const isDirty = useRef(false);

  // Personality state
  const [selectedPersonality, setSelectedPersonality] = useState<AgentPersonality>(agent.personality || 'weebo');
  const [personalities, setPersonalities] = useState<Record<string, Personality>>({});
  const [agentName, setAgentName] = useState(agent.name || 'Weebo');
  const [tone, setTone] = useState([agent.formality ?? 50]); // 0=casual, 100=formal
  const [verbosity, setVerbosity] = useState([agent.verbosity ?? 50]);
  const [creativity, setCreativity] = useState([agent.creativity ?? 50]);
  const [humor, setHumor] = useState([agent.humor ?? 50]);
  const [empathy, setEmpathy] = useState([agent.empathy ?? 50]);
  const [language, setLanguage] = useState('english');
  const [autonomyLevel, setAutonomyLevel] = useState<string>('assisted');
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
  const [telegramStatus, setTelegramStatus] = useState<'connected' | 'not_connected' | 'checking'>('checking');

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState('personality');

  // Fetch personalities on mount
  useEffect(() => {
    agentService.getPersonalities().then(({ data }) => setPersonalities(data)).catch(() => {});
  }, []);

  // Fetch memory count
  useEffect(() => {
    memoryService.list().then(({ data }) => {
      if (Array.isArray(data)) setMemoryCount(data.length);
    }).catch(() => {});
  }, []);

  // Check Telegram status
  useEffect(() => {
    loadIntegrations().catch(() => {});
    integrationService.checkTelegramLink().then(({ data }) => {
      setTelegramStatus(data.linked ? 'connected' : 'not_connected');
    }).catch(() => setTelegramStatus('not_connected'));
  }, [loadIntegrations]);

  // Sync from store once on mount — hasHydrated guard prevents re-sync on every agent field change
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

  // ---- Handlers ----

  const handleAgentSwitch = useCallback(async (id: AgentPersonality) => {
    const prev = selectedPersonality;
    setSelectedPersonality(id);
    const agentDef = AGENTS.find(a => a.id === id);
    try {
      await updateAgent({ personality: id });
      const p = personalities[id];
      if (p || agentDef) {
        setSaveToast(`Switched to ${p?.name || agentDef?.name}!`);
        setTimeout(() => setSaveToast(''), 2500);
      }
    } catch {
      setSelectedPersonality(prev);
      setSaveToast('Failed to switch. Try again.');
      setTimeout(() => setSaveToast(''), 2500);
    }
  }, [selectedPersonality, personalities, updateAgent]);

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
  }, [agentName, tone, verbosity, creativity, humor, empathy, customInstructions, selectedModel, updateAgent, notifyDone, notifyFail]);

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
    setToolStates(prev => ({ ...prev, [toolId]: !prev[toolId] }));
    isDirty.current = true;
  }, []);

  // ---- Derived values ----

  const currentAgent = AGENTS.find(a => a.id === selectedPersonality) || AGENTS[0];
  const toneStep = Math.round(tone[0] / 25);
  const verbosityStep = Math.round(verbosity[0] / 25);
  const creativityStep = Math.round(creativity[0] / 25);
  const humorStep = Math.round(humor[0] / 25);
  const empathyStep = Math.round(empathy[0] / 25);
  const instructionsLength = customInstructions.length;

  // Find telegram integration
  const telegramInt = integrations.find(i => i.type === 'telegram');
  const isTelegramConnected = telegramStatus === 'connected' || telegramInt?.status === 'connected';

  return (
    <PageShell maxWidth="4xl">
      {/* Toast notification */}
      {saveToast && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="px-4 py-2.5 rounded-xl bg-[rgba(12,12,30,0.6)] backdrop-blur-xl border border-[rgba(139,92,246,0.15)] shadow-lg shadow-[#8B5CF6]/10 text-sm text-[#E8E8F0] flex items-center gap-2">
            {saveToast.includes('Saved') || saveToast.includes('Switched') || saveToast.includes('Cleared') ? (
              <Check className="w-4 h-4 text-[#ADFF2F]" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
            )}
            {saveToast}
          </div>
        </div>
      )}

      {/* Page Header with weebo ownership dot */}
      <PageHeader
        icon={Settings}
        title="Agent Settings"
        subtitle={`Configure ${currentAgent.name} — personality, memory, tools & channels`}
        badge={
          <span className="relative flex h-3 w-3" title="Owned by Weebo">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8B5CF6]" />
          </span>
        }
      />

      {/* Agent Selector Header */}
      <SectionCard padding="lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Active agent avatar */}
            <div className="relative">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-300"
                style={{
                  backgroundColor: `${currentAgent.color}20`,
                  border: `2px solid ${currentAgent.color}`,
                  color: currentAgent.color,
                  boxShadow: `0 0 20px ${currentAgent.color}30`,
                }}
              >
                {currentAgent.name[0]}
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#ADFF2F] border-2 border-[#06061a]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#E8E8F0]" style={{ fontFamily: 'Syne, sans-serif' }}>
                {currentAgent.name}
              </h2>
              <p className="text-sm text-[#B8C4D4]">{currentAgent.description}</p>
            </div>
          </div>

          {/* Agent switcher pills */}
          <div className="flex flex-wrap gap-2">
            {AGENTS.map((a) => {
              const isActive = a.id === selectedPersonality;
              return (
                <button
                  key={a.id}
                  onClick={() => handleAgentSwitch(a.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-sm font-medium transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                    isActive
                      ? 'text-white'
                      : 'text-[#B8C4D4] hover:text-[#E8E8F0] hover:bg-white/[0.03]'
                  }`}
                  style={isActive ? {
                    backgroundColor: `${a.color}20`,
                    border: `1px solid ${a.color}`,
                    color: a.color,
                  } : { border: '1px solid rgba(139,92,246,0.08)' }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: a.color, color: '#06061a' }}
                  >
                    {a.name[0]}
                  </div>
                  {a.name}
                  {isActive && (
                    <Check className="w-3.5 h-3.5" style={{ color: a.color }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-transparent border-b border-[rgba(139,92,246,0.08)] rounded-none p-0 h-auto gap-0">
          {[
            { value: 'personality', label: 'Personality', icon: Bot },
            { value: 'memory', label: 'Memory', icon: Brain },
            { value: 'tools', label: 'Tools', icon: Wrench },
            { value: 'channels', label: 'Channels', icon: Link2 },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`flex-1 sm:flex-none rounded-none border-b-2 border-transparent px-4 sm:px-6 py-3 min-h-[44px] text-sm font-medium transition-all duration-200 bg-transparent shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent ${
                activeTab === tab.value
                  ? '!border-b-[#8B5CF6] !text-[#8B5CF6]'
                  : '!text-[#B8C4D4] hover:!text-[#E8E8F0]'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-1.5 inline" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ========== PERSONALITY TAB ========== */}
        <TabsContent value="personality" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Agent Name */}
          <SectionCard title="Agent Name" subtitle="This name is used in conversations and greetings." padding="lg">
            <Input
              value={agentName}
              onChange={(e) => { isDirty.current = true; setAgentName(e.target.value); }}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl min-h-[44px] text-[#E8E8F0] max-w-md focus:border-[#8B5CF6]/40 focus:ring-[#8B5CF6]/20"
              placeholder="What should your agent be called?"
              maxLength={30}
            />
          </SectionCard>

          {/* Model Selector */}
          <SectionCard padding="lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#E8E8F0] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#8B5CF6]" />
                Primary Model
              </h2>
              <p className="text-xs text-[#B8C4D4] mt-0.5">Choose the LLM that powers your agent's responses.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {MODELS.map((m) => {
                const isActive = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { isDirty.current = true; setSelectedModel(m.id); }}
                    className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                      isActive
                        ? 'bg-[#8B5CF6]/20 border border-[#8B5CF6] text-[#8B5CF6]'
                        : 'bg-white/[0.03] border border-white/[0.08] text-[#B8C4D4] hover:border-[rgba(139,92,246,0.15)] hover:text-[#E8E8F0]'
                    }`}
                  >
                    {m.label}
                    {m.tier === 'pro' && (
                      <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
                        PRO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Personality Sliders */}
          <SectionCard padding="lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#E8E8F0] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#8B5CF6]" />
                Personality Tuning
              </h2>
              <p className="text-xs text-[#B8C4D4] mt-0.5">
                Adjust how your agent communicates. These settings shape every response.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Creativity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#E8E8F0]">Creativity</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
                    {['Precise', 'Focused', 'Balanced', 'Creative', 'Exploratory'][creativityStep]}
                  </span>
                </div>
                <Slider
                  value={creativity}
                  onValueChange={(v) => { isDirty.current = true; setCreativity(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:border-[#8B5CF6] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#B8C4D4] mt-1">
                  <span>Factual</span>
                  <span>Exploratory</span>
                </div>
              </div>

              {/* Tone */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#E8E8F0]">Tone</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
                    {TONE_LABELS[toneStep]}
                  </span>
                </div>
                <Slider
                  value={tone}
                  onValueChange={(v) => { isDirty.current = true; setTone(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:border-[#8B5CF6] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#B8C4D4] mt-1">
                  <span>Casual</span>
                  <span>Formal</span>
                </div>
              </div>

              {/* Verbosity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#E8E8F0]">Verbosity</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
                    {VERBOSITY_LABELS[verbosityStep]}
                  </span>
                </div>
                <Slider
                  value={verbosity}
                  onValueChange={(v) => { isDirty.current = true; setVerbosity(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:border-[#8B5CF6] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#B8C4D4] mt-1">
                  <span>Terse</span>
                  <span>Detailed</span>
                </div>
              </div>

              {/* Humor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#E8E8F0]">Humor</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
                    {HUMOR_LABELS[humorStep]}
                  </span>
                </div>
                <Slider
                  value={humor}
                  onValueChange={(v) => { isDirty.current = true; setHumor(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:border-[#8B5CF6] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#B8C4D4] mt-1">
                  <span>Serious</span>
                  <span>Humorous</span>
                </div>
              </div>

              {/* Empathy */}
              <div className="md:col-span-2 md:max-w-[calc(50%-1rem)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#E8E8F0]">Empathy</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6]">
                    {EMPATHY_LABELS[empathyStep]}
                  </span>
                </div>
                <Slider
                  value={empathy}
                  onValueChange={(v) => { isDirty.current = true; setEmpathy(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:bg-[#8B5CF6] [&_[data-slot=slider-thumb]]:border-[#8B5CF6] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#B8C4D4] mt-1">
                  <span>Direct</span>
                  <span>Empathetic</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Language Preference */}
          <SectionCard padding="lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#E8E8F0] flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#8B5CF6]" />
                Language Preference
              </h2>
              <p className="text-xs text-[#B8C4D4] mt-0.5">Your agent will respond primarily in this language.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'english', label: 'English' },
                { id: 'hinglish', label: 'Hinglish' },
                { id: 'hindi', label: 'Hindi' },
              ].map((lang) => {
                const isActive = language === lang.id;
                return (
                  <button
                    key={lang.id}
                    onClick={() => setLanguage(lang.id)}
                    className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                      isActive
                        ? 'bg-[#8B5CF6]/20 border border-[#8B5CF6] text-[#8B5CF6]'
                        : 'bg-white/[0.03] border border-white/[0.08] text-[#B8C4D4] hover:border-[rgba(139,92,246,0.15)] hover:text-[#E8E8F0]'
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Custom Instructions */}
          <SectionCard padding="lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#E8E8F0] flex items-center gap-2">
                <Brain className="w-5 h-5 text-[#8B5CF6]" />
                Custom Instructions
              </h2>
              <p className="text-xs text-[#B8C4D4] mt-0.5">These instructions guide your agent's behavior across all conversations.</p>
            </div>
            <div className="relative">
              <Textarea
                value={customInstructions}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    isDirty.current = true;
                    setCustomInstructions(e.target.value);
                  }
                }}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl min-h-[120px] text-[#E8E8F0] resize-none pr-16 focus:border-[#8B5CF6]/40 focus:ring-[#8B5CF6]/20"
                placeholder="Tell your agent how to behave. E.g. 'Always respond with bullet points' or 'Be encouraging and use emojis'..."
                maxLength={500}
              />
              <span className={`absolute bottom-3 right-3 text-xs font-mono ${
                instructionsLength > 450 ? 'text-[#FF2D78]' : 'text-[#B8C4D4]'
              }`}>
                {instructionsLength}/500
              </span>
            </div>
          </SectionCard>

          {/* Autonomy Level */}
          <SectionCard padding="lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#E8E8F0] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#8B5CF6]" />
                Autonomy Level
              </h2>
              <p className="text-xs text-[#B8C4D4] mt-0.5">
                How much freedom does {currentAgent.name} have to act on your behalf?
              </p>
            </div>
            <div className="space-y-2">
              {AUTONOMY_LEVELS.map((level) => {
                const isActive = autonomyLevel === level.id;
                return (
                  <button
                    key={level.id}
                    onClick={() => { isDirty.current = true; setAutonomyLevel(level.id); }}
                    className={`w-full flex items-start gap-3 p-4 min-h-[44px] rounded-xl border text-left transition-all duration-200 ${
                      isActive
                        ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/5'
                        : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
                    }`}
                  >
                    <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isActive ? 'border-[#8B5CF6]' : 'border-[#B8C4D4]/50'
                    }`}>
                      {isActive && <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <level.icon className="w-4 h-4" style={{ color: isActive ? '#8B5CF6' : '#B8C4D4' }} />
                        <span className={`text-sm font-medium ${isActive ? 'text-[#E8E8F0]' : 'text-[#B8C4D4]'}`}>
                          {level.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#B8C4D4] mt-1">{level.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Agent Assignment */}
          <SectionCard padding="lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#E8E8F0] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#8B5CF6]" />
                Agent Assignments
              </h2>
              <p className="text-xs text-[#B8C4D4] mt-0.5">
                Each agent specializes in different areas. Assignment editing coming soon.
              </p>
            </div>
            <div className="space-y-3">
              {AGENTS.map((a) => {
                const features = AGENT_ASSIGNMENTS[a.id] || [];
                return (
                  <div key={a.id} className="flex items-center justify-between p-3 min-h-[44px] rounded-xl border border-[rgba(139,92,246,0.08)]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: a.color, color: '#06061a' }}
                      >
                        {a.name[0]}
                      </div>
                      <span className="text-sm font-medium text-[#E8E8F0]">{a.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {features.map((f) => (
                        <span key={f} className="text-xs px-2.5 py-1 rounded-full border border-[rgba(139,92,246,0.08)] text-[#B8C4D4] bg-[#8B5CF6]/5">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold px-8 min-h-[44px] transition-all duration-200 rounded-xl"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ========== MEMORY TAB ========== */}
        <TabsContent value="memory" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Memory Toggle */}
          <SectionCard padding="lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-[#8B5CF6]" />
                <div>
                  <h2 className="text-base font-semibold text-[#E8E8F0]">Agent can remember things</h2>
                  <p className="text-sm text-[#B8C4D4] mt-0.5">
                    When enabled, your agent remembers your preferences, facts, and context across conversations.
                  </p>
                </div>
              </div>
              <Switch
                checked={memoryEnabled}
                onCheckedChange={setMemoryEnabled}
                className={`${memoryEnabled ? '!bg-[#8B5CF6]' : '!bg-[#1A1A2E]'} data-[state=checked]:!bg-[#8B5CF6] data-[state=unchecked]:!bg-[#1A1A2E]`}
              />
            </div>

            {memoryEnabled && memoryCount > 0 && (
              <div className="mt-4 pt-4 border-t border-[rgba(139,92,246,0.08)]">
                <p className="text-sm text-[#B8C4D4]">
                  Your agent currently has <span className="text-[#8B5CF6] font-semibold">{memoryCount}</span> {memoryCount === 1 ? 'memory' : 'memories'} stored.
                </p>
              </div>
            )}
          </SectionCard>

          {/* Memory Manager Link */}
          <button
            onClick={() => navigate('/dashboard/memory')}
            className="w-full min-h-[44px] rounded-xl overflow-hidden bg-[rgba(12,12,30,0.6)] backdrop-blur-xl border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all duration-300 p-5 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-[#E8E8F0]">Memory Manager</h3>
                <p className="text-sm text-[#B8C4D4]">View, edit, and manage individual memories</p>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-[#B8C4D4] group-hover:text-[#8B5CF6] transition-colors" />
          </button>

          {/* Clear All Memories */}
          <SectionCard padding="lg" className="!border-[#FF2D78]/20">
            <h2 className="text-base font-semibold mb-2 flex items-center gap-2 text-[#FF2D78]">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </h2>
            <p className="text-sm text-[#B8C4D4] mb-4">
              Permanently delete all memories your agent has stored. This cannot be undone.
            </p>
            <Button
              variant="outline"
              onClick={handleClearAllMemories}
              className="border-[#FF2D78]/30 text-[#FF2D78] hover:bg-[#FF2D78]/10 hover:text-[#FF2D78] min-h-[44px] rounded-xl"
              disabled={memoryCount === 0 || isClearing}
            >
              {isClearing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Clear All Memories
              {memoryCount > 0 && (
                <span className="ml-2 text-xs opacity-70">({memoryCount})</span>
              )}
            </Button>
          </SectionCard>
        </TabsContent>

        {/* ========== TOOLS TAB ========== */}
        <TabsContent value="tools" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SectionCard padding="lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#E8E8F0] flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#8B5CF6]" />
                Available Tools
              </h2>
              <p className="text-xs text-[#B8C4D4] mt-0.5">
                Enable or disable tools your agent can use during conversations.
              </p>
            </div>

            <div className="space-y-3">
              {TOOLS.map((tool) => {
                const enabled = toolStates[tool.id] ?? false;
                return (
                  <div
                    key={tool.id}
                    className={`flex items-center justify-between p-4 min-h-[44px] rounded-xl border transition-all duration-200 ${
                      enabled
                        ? 'border-[#8B5CF6]/20 bg-[#8B5CF6]/5'
                        : 'border-[rgba(139,92,246,0.08)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200"
                        style={{
                          backgroundColor: enabled ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.05)',
                        }}
                      >
                        <tool.icon
                          className="w-4 h-4 transition-colors duration-200"
                          style={{ color: enabled ? '#8B5CF6' : '#B8C4D4' }}
                        />
                      </div>
                      <div>
                        <h3 className={`text-sm font-medium transition-colors duration-200 ${enabled ? 'text-[#E8E8F0]' : 'text-[#B8C4D4]'}`}>
                          {tool.label}
                        </h3>
                        <p className="text-xs text-[#B8C4D4]">{tool.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleTool(tool.id)}
                      className={`${enabled ? '!bg-[#8B5CF6]' : '!bg-[#1A1A2E]'} data-[state=checked]:!bg-[#8B5CF6] data-[state=unchecked]:!bg-[#1A1A2E]`}
                    />
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ========== CHANNELS TAB ========== */}
        <TabsContent value="channels" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SectionCard padding="lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#E8E8F0] flex items-center gap-2">
                <Link2 className="w-5 h-5 text-[#8B5CF6]" />
                Connected Channels
              </h2>
              <p className="text-xs text-[#B8C4D4] mt-0.5">
                Manage where your agent is available.
              </p>
            </div>

            <div className="space-y-3">
              {/* Telegram */}
              <div className="flex items-center justify-between p-4 min-h-[44px] rounded-xl border border-[rgba(139,92,246,0.08)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0088CC]/10 flex items-center justify-center">
                    <Send className="w-5 h-5 text-[#0088CC]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#E8E8F0]">Telegram</h3>
                    <p className="text-xs text-[#B8C4D4]">Chat with your agent via Telegram</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {telegramStatus === 'checking' ? (
                    <span className="text-xs text-[#B8C4D4]">Checking...</span>
                  ) : isTelegramConnected ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-[#ADFF2F]">
                      <div className="w-2 h-2 rounded-full bg-[#ADFF2F] animate-pulse" />
                      Connected
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/dashboard/connections')}
                      className="border-[#0088CC]/30 text-[#0088CC] hover:bg-[#0088CC]/10 hover:text-[#0088CC] text-xs min-h-[44px] rounded-xl"
                    >
                      Setup
                    </Button>
                  )}
                </div>
              </div>

              {/* Web Chat */}
              <div className="flex items-center justify-between p-4 min-h-[44px] rounded-xl border border-[rgba(139,92,246,0.08)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#E8E8F0]">Web Chat</h3>
                    <p className="text-xs text-[#B8C4D4]">Chat via the web dashboard</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#ADFF2F]">
                  <div className="w-2 h-2 rounded-full bg-[#ADFF2F]" />
                  Always on
                </span>
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between p-4 min-h-[44px] rounded-xl border border-[rgba(139,92,246,0.08)] opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#E8E8F0]">WhatsApp</h3>
                    <p className="text-xs text-[#B8C4D4]">Chat with your agent on WhatsApp</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20">
                  Coming soon
                </span>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
