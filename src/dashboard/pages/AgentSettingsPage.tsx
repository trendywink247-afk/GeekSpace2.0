import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboardStore';
import { agentService, memoryService, integrationService } from '@/services/api';
import type { Personality, AgentPersonality } from '@/types';

// ---- Agent definitions ----

interface AgentDef {
  id: AgentPersonality;
  name: string;
  color: string;
  description: string;
}

const AGENTS: AgentDef[] = [
  { id: 'weebo', name: 'Weebo', color: '#00F0FF', description: 'Balanced all-rounder' },
  { id: 'edith', name: 'Edith', color: '#8B5CF6', description: 'Strategic & focused' },
  { id: 'jarvis', name: 'Jarvis', color: '#ADFF2F', description: 'Professional & efficient' },
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

  // Memory state
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryCount, setMemoryCount] = useState(0);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
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

  // Sync from store when agent data loads
  useEffect(() => {
    if (isDirty.current) return;
    if (agent.id) {
      setSelectedPersonality(agent.personality || 'weebo');
      setAgentName(agent.name || 'Weebo');
      setTone([agent.formality ?? 50]);
      setVerbosity([agent.verbosity ?? 50]);
      setCreativity([agent.creativity ?? 50]);
      setHumor([agent.humor ?? 50]);
      setEmpathy([agent.empathy ?? 50]);
      setCustomInstructions(agent.systemPrompt || '');
    }
  }, [agent.id, agent.personality, agent.name, agent.formality, agent.verbosity, agent.creativity, agent.humor, agent.empathy, agent.systemPrompt]);

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
      });
      isDirty.current = false;
      setSaveToast('Saved!');
      setTimeout(() => setSaveToast(''), 2500);
    } catch {
      setSaveToast('Save failed. Try again.');
      setTimeout(() => setSaveToast(''), 2500);
    } finally {
      setIsSaving(false);
    }
  }, [agentName, tone, verbosity, creativity, humor, empathy, customInstructions, updateAgent]);

  const handleClearAllMemories = useCallback(async () => {
    setIsClearing(true);
    try {
      const { data } = await memoryService.clearAll();
      setMemoryCount(0);
      setClearConfirmOpen(false);
      setSaveToast(`Cleared ${data.deleted} memories`);
      setTimeout(() => setSaveToast(''), 2500);
    } catch {
      setSaveToast('Failed to clear memories');
      setTimeout(() => setSaveToast(''), 2500);
    } finally {
      setIsClearing(false);
    }
  }, []);

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
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-6">
      {/* Toast notification */}
      {saveToast && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="px-4 py-2.5 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/40 shadow-lg shadow-[#00F0FF]/10 text-sm text-[#E8E8F0] flex items-center gap-2">
            {saveToast.includes('Saved') || saveToast.includes('Switched') || saveToast.includes('Cleared') ? (
              <Check className="w-4 h-4 text-[#ADFF2F]" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#00F0FF]" />
            )}
            {saveToast}
          </div>
        </div>
      )}

      {/* Agent Selector Header */}
      <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
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
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#ADFF2F] border-2 border-[#0C0C18]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F4F6FF]" style={{ fontFamily: 'Syne, sans-serif' }}>
                {currentAgent.name}
              </h1>
              <p className="text-sm text-[#8892A4]">{currentAgent.description}</p>
            </div>
          </div>

          {/* Agent switcher pills */}
          <div className="flex gap-2">
            {AGENTS.map((a) => {
              const isActive = a.id === selectedPersonality;
              return (
                <button
                  key={a.id}
                  onClick={() => handleAgentSwitch(a.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
                    isActive
                      ? 'text-white'
                      : 'text-[#8892A4] hover:text-[#F4F6FF] bg-[#06060B] hover:bg-[#12121F]'
                  }`}
                  style={isActive ? {
                    backgroundColor: `${a.color}20`,
                    border: `1px solid ${a.color}`,
                    color: a.color,
                  } : { border: '1px solid rgba(0,240,255,0.1)' }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: a.color, color: '#05050A' }}
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
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-transparent border-b border-[#00F0FF]/10 rounded-none p-0 h-auto gap-0">
          {[
            { value: 'personality', label: 'Personality', icon: Bot },
            { value: 'memory', label: 'Memory', icon: Brain },
            { value: 'tools', label: 'Tools', icon: Wrench },
            { value: 'channels', label: 'Channels', icon: Link2 },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`flex-1 sm:flex-none rounded-none border-b-2 border-transparent px-4 sm:px-6 py-3 text-sm font-medium transition-all duration-200 bg-transparent shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent ${
                activeTab === tab.value
                  ? '!border-b-[#00F0FF] !text-[#00F0FF]'
                  : '!text-[#8892A4] hover:!text-[#F4F6FF]'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-1.5 inline" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ========== PERSONALITY TAB ========== */}
        <TabsContent value="personality" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Agent Name */}
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#F4F6FF]">
              <Bot className="w-5 h-5 text-[#00F0FF]" />
              Agent Name
            </h2>
            <Input
              value={agentName}
              onChange={(e) => { isDirty.current = true; setAgentName(e.target.value); }}
              className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] max-w-md"
              placeholder="What should your agent be called?"
              maxLength={30}
            />
            <p className="text-xs text-[#8892A4] mt-2">
              This name is used in conversations and greetings.
            </p>
          </div>

          {/* Personality Sliders */}
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-[#F4F6FF]">
              <Sparkles className="w-5 h-5 text-[#00F0FF]" />
              Personality Tuning
            </h2>
            <p className="text-xs text-[#8892A4] mb-6">
              Adjust how your agent communicates. These settings shape every response.
            </p>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Creativity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#F4F6FF]">Creativity</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
                    {['Precise', 'Focused', 'Balanced', 'Creative', 'Exploratory'][creativityStep]}
                  </span>
                </div>
                <Slider
                  value={creativity}
                  onValueChange={(v) => { isDirty.current = true; setCreativity(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:border-[#00F0FF] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#8892A4] mt-1">
                  <span>Factual</span>
                  <span>Exploratory</span>
                </div>
              </div>

              {/* Tone */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#F4F6FF]">Tone</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
                    {TONE_LABELS[toneStep]}
                  </span>
                </div>
                <Slider
                  value={tone}
                  onValueChange={(v) => { isDirty.current = true; setTone(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:border-[#00F0FF] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#8892A4] mt-1">
                  <span>Casual</span>
                  <span>Formal</span>
                </div>
              </div>

              {/* Verbosity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#F4F6FF]">Verbosity</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
                    {VERBOSITY_LABELS[verbosityStep]}
                  </span>
                </div>
                <Slider
                  value={verbosity}
                  onValueChange={(v) => { isDirty.current = true; setVerbosity(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:border-[#00F0FF] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#8892A4] mt-1">
                  <span>Terse</span>
                  <span>Detailed</span>
                </div>
              </div>

              {/* Humor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#F4F6FF]">Humor</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
                    {HUMOR_LABELS[humorStep]}
                  </span>
                </div>
                <Slider
                  value={humor}
                  onValueChange={(v) => { isDirty.current = true; setHumor(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:border-[#00F0FF] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#8892A4] mt-1">
                  <span>Serious</span>
                  <span>Humorous</span>
                </div>
              </div>

              {/* Empathy */}
              <div className="md:col-span-2 md:max-w-[calc(50%-1rem)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#F4F6FF]">Empathy</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
                    {EMPATHY_LABELS[empathyStep]}
                  </span>
                </div>
                <Slider
                  value={empathy}
                  onValueChange={(v) => { isDirty.current = true; setEmpathy(v); }}
                  max={100}
                  step={25}
                  className="w-full [&_[data-slot=slider-range]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:bg-[#00F0FF] [&_[data-slot=slider-thumb]]:border-[#00F0FF] [&_[data-slot=slider-track]]:bg-[#1A1A2E]"
                />
                <div className="flex justify-between text-xs text-[#8892A4] mt-1">
                  <span>Direct</span>
                  <span>Empathetic</span>
                </div>
              </div>
            </div>
          </div>

          {/* Language Preference */}
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#F4F6FF]">
              <Globe className="w-5 h-5 text-[#00F0FF]" />
              Language Preference
            </h2>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] max-w-xs">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent className="bg-[#0C0C18] border-[#00F0FF]/30">
                <SelectItem value="english" className="text-[#E8E8F0] focus:bg-[#00F0FF]/10 focus:text-[#00F0FF]">English</SelectItem>
                <SelectItem value="hinglish" className="text-[#E8E8F0] focus:bg-[#00F0FF]/10 focus:text-[#00F0FF]">Hinglish</SelectItem>
                <SelectItem value="hindi" className="text-[#E8E8F0] focus:bg-[#00F0FF]/10 focus:text-[#00F0FF]">Hindi</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#8892A4] mt-2">
              Your agent will respond primarily in this language.
            </p>
          </div>

          {/* Custom Instructions */}
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#F4F6FF]">
              <Brain className="w-5 h-5 text-[#00F0FF]" />
              Custom Instructions
            </h2>
            <div className="relative">
              <Textarea
                value={customInstructions}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    isDirty.current = true;
                    setCustomInstructions(e.target.value);
                  }
                }}
                className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] min-h-[120px] resize-none pr-16"
                placeholder="Tell your agent how to behave. E.g. 'Always respond with bullet points' or 'Be encouraging and use emojis'..."
                maxLength={500}
              />
              <span className={`absolute bottom-3 right-3 text-xs font-mono ${
                instructionsLength > 450 ? 'text-[#FF2D78]' : 'text-[#8892A4]'
              }`}>
                {instructionsLength}/500
              </span>
            </div>
            <p className="text-xs text-[#8892A4] mt-2">
              These instructions guide your agent's behavior across all conversations.
            </p>
          </div>

          {/* Autonomy Level */}
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#F4F6FF]">
              <Shield className="w-5 h-5 text-[#00F0FF]" />
              Autonomy Level
            </h2>
            <p className="text-xs text-[#8892A4] mb-4">
              How much freedom does {currentAgent.name} have to act on your behalf?
            </p>
            <div className="space-y-2">
              {AUTONOMY_LEVELS.map((level) => {
                const isActive = autonomyLevel === level.id;
                return (
                  <button
                    key={level.id}
                    onClick={() => { isDirty.current = true; setAutonomyLevel(level.id); }}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                      isActive
                        ? 'border-[#00F0FF]/40 bg-[#00F0FF]/5'
                        : 'border-[#1A1A2E] bg-[#06060B] hover:border-[#00F0FF]/20'
                    }`}
                  >
                    <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isActive ? 'border-[#00F0FF]' : 'border-[#8892A4]/50'
                    }`}>
                      {isActive && <div className="w-2 h-2 rounded-full bg-[#00F0FF]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <level.icon className="w-4 h-4" style={{ color: isActive ? '#00F0FF' : '#8892A4' }} />
                        <span className={`text-sm font-medium ${isActive ? 'text-[#F4F6FF]' : 'text-[#8892A4]'}`}>
                          {level.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#8892A4] mt-1">{level.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agent Assignment */}
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#F4F6FF]">
              <Users className="w-5 h-5 text-[#00F0FF]" />
              Agent Assignments
            </h2>
            <p className="text-xs text-[#8892A4] mb-4">
              Each agent specializes in different areas. Assignment editing coming soon.
            </p>
            <div className="space-y-3">
              {AGENTS.map((a) => {
                const features = AGENT_ASSIGNMENTS[a.id] || [];
                return (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-[#1A1A2E] bg-[#06060B]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: a.color, color: '#05050A' }}
                      >
                        {a.name[0]}
                      </div>
                      <span className="text-sm font-medium text-[#F4F6FF]">{a.name}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {features.map((f) => (
                        <span key={f} className="text-xs px-2.5 py-1 rounded-full border border-[#00F0FF]/20 text-[#8892A4] bg-[#00F0FF]/5">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#00F0FF] hover:bg-[#00D4E0] text-[#05050A] font-semibold px-8 transition-all duration-200"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#05050A]/30 border-t-[#05050A] rounded-full animate-spin mr-2" />
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
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-[#00F0FF]" />
                <div>
                  <h2 className="text-lg font-semibold text-[#F4F6FF]">Agent can remember things</h2>
                  <p className="text-sm text-[#8892A4] mt-0.5">
                    When enabled, your agent remembers your preferences, facts, and context across conversations.
                  </p>
                </div>
              </div>
              <Switch
                checked={memoryEnabled}
                onCheckedChange={setMemoryEnabled}
                className={`${memoryEnabled ? '!bg-[#00F0FF]' : '!bg-[#1A1A2E]'} data-[state=checked]:!bg-[#00F0FF] data-[state=unchecked]:!bg-[#1A1A2E]`}
              />
            </div>

            {memoryEnabled && memoryCount > 0 && (
              <div className="mt-4 pt-4 border-t border-[#00F0FF]/10">
                <p className="text-sm text-[#8892A4]">
                  Your agent currently has <span className="text-[#00F0FF] font-semibold">{memoryCount}</span> {memoryCount === 1 ? 'memory' : 'memories'} stored.
                </p>
              </div>
            )}
          </div>

          {/* Memory Manager Link */}
          <button
            onClick={() => navigate('/dashboard/memory')}
            className="w-full p-5 rounded-2xl glass-card-v2 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all duration-200 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-[#F4F6FF]">Memory Manager</h3>
                <p className="text-sm text-[#8892A4]">View, edit, and manage individual memories</p>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-[#8892A4] group-hover:text-[#00F0FF] transition-colors" />
          </button>

          {/* Clear All Memories */}
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#FF2D78]/20">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-[#FF2D78]">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </h2>
            <p className="text-sm text-[#8892A4] mb-4">
              Permanently delete all memories your agent has stored. This cannot be undone.
            </p>
            {!clearConfirmOpen ? (
              <Button
                variant="outline"
                onClick={() => setClearConfirmOpen(true)}
                className="border-[#FF2D78]/30 text-[#FF2D78] hover:bg-[#FF2D78]/10 hover:text-[#FF2D78]"
                disabled={memoryCount === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Memories
                {memoryCount > 0 && (
                  <span className="ml-2 text-xs opacity-70">({memoryCount})</span>
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FF2D78]/5 border border-[#FF2D78]/20">
                <p className="text-sm text-[#F4F6FF] flex-1">
                  Are you sure? This will delete <strong>{memoryCount}</strong> {memoryCount === 1 ? 'memory' : 'memories'} permanently.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClearConfirmOpen(false)}
                  className="border-[#8892A4]/30 text-[#8892A4] hover:bg-[#8892A4]/10"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleClearAllMemories}
                  disabled={isClearing}
                  className="bg-[#FF2D78] hover:bg-[#FF2D78]/80 text-white"
                >
                  {isClearing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Yes, Clear All'
                  )}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========== TOOLS TAB ========== */}
        <TabsContent value="tools" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2 text-[#F4F6FF]">
              <Wrench className="w-5 h-5 text-[#00F0FF]" />
              Available Tools
            </h2>
            <p className="text-sm text-[#8892A4] mb-6">
              Enable or disable tools your agent can use during conversations.
            </p>

            <div className="space-y-3">
              {TOOLS.map((tool) => {
                const enabled = toolStates[tool.id] ?? false;
                return (
                  <div
                    key={tool.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                      enabled
                        ? 'border-[#00F0FF]/20 bg-[#00F0FF]/5'
                        : 'border-[#1A1A2E] bg-[#06060B]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200"
                        style={{
                          backgroundColor: enabled ? 'rgba(0,240,255,0.1)' : 'rgba(26,26,46,0.5)',
                        }}
                      >
                        <tool.icon
                          className="w-4.5 h-4.5 transition-colors duration-200"
                          style={{ color: enabled ? '#00F0FF' : '#8892A4' }}
                        />
                      </div>
                      <div>
                        <h3 className={`text-sm font-medium transition-colors duration-200 ${enabled ? 'text-[#F4F6FF]' : 'text-[#8892A4]'}`}>
                          {tool.label}
                        </h3>
                        <p className="text-xs text-[#8892A4]">{tool.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleTool(tool.id)}
                      className={`${enabled ? '!bg-[#00F0FF]' : '!bg-[#1A1A2E]'} data-[state=checked]:!bg-[#00F0FF] data-[state=unchecked]:!bg-[#1A1A2E]`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ========== CHANNELS TAB ========== */}
        <TabsContent value="channels" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2 text-[#F4F6FF]">
              <Link2 className="w-5 h-5 text-[#00F0FF]" />
              Connected Channels
            </h2>
            <p className="text-sm text-[#8892A4] mb-6">
              Manage where your agent is available.
            </p>

            <div className="space-y-3">
              {/* Telegram */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[#00F0FF]/20 bg-[#06060B]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0088CC]/10 flex items-center justify-center">
                    <Send className="w-5 h-5 text-[#0088CC]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#F4F6FF]">Telegram</h3>
                    <p className="text-xs text-[#8892A4]">Chat with your agent via Telegram</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {telegramStatus === 'checking' ? (
                    <span className="text-xs text-[#8892A4]">Checking...</span>
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
                      className="border-[#0088CC]/30 text-[#0088CC] hover:bg-[#0088CC]/10 hover:text-[#0088CC] text-xs"
                    >
                      Setup
                    </Button>
                  )}
                </div>
              </div>

              {/* Web Chat */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[#00F0FF]/20 bg-[#06060B]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-[#00F0FF]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#F4F6FF]">Web Chat</h3>
                    <p className="text-xs text-[#8892A4]">Chat via the web dashboard</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#ADFF2F]">
                  <div className="w-2 h-2 rounded-full bg-[#ADFF2F]" />
                  Always on
                </span>
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[#1A1A2E] bg-[#06060B] opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#F4F6FF]">WhatsApp</h3>
                    <p className="text-xs text-[#8892A4]">Chat with your agent on WhatsApp</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20">
                  Coming soon
                </span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
