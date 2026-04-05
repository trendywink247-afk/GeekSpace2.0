import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell, PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
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
  ChevronRight,
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

// ─── Agent definitions ───────────────────────────────────────────────────────

interface AgentDef {
  id: AgentPersonality;
  name: string;
  color: string;
  description: string;
}

const AGENTS: AgentDef[] = [
  { id: 'weebo', name: 'Weebo', color: 'var(--ag-weebo)', description: 'Balanced all-rounder' },
  { id: 'edith', name: 'Edith', color: 'var(--ag-edith)', description: 'Strategic & focused' },
  { id: 'jarvis', name: 'Jarvis', color: 'var(--ag-jarvis)', description: 'Professional & efficient' },
];

// ─── Model definitions ───────────────────────────────────────────────────────

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

// ─── Tool definitions ────────────────────────────────────────────────────────

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

// ─── Slider labels ───────────────────────────────────────────────────────────

const TONE_LABELS = ['Very Formal', 'Formal', 'Balanced', 'Casual', 'Very Casual'];
const VERBOSITY_LABELS = ['Terse', 'Brief', 'Balanced', 'Detailed', 'Very Detailed'];
const CREATIVITY_LABELS = ['Precise', 'Focused', 'Balanced', 'Creative', 'Exploratory'];
const HUMOR_LABELS = ['Serious', 'Neutral', 'Balanced', 'Witty', 'Very Humorous'];
const EMPATHY_LABELS = ['Direct', 'Factual', 'Balanced', 'Warm', 'Very Empathetic'];

// ─── Autonomy levels ─────────────────────────────────────────────────────────

const AUTONOMY_LEVELS = [
  { id: 'ask', label: 'Ask me first', icon: Shield, description: 'Agent proposes actions and waits for your approval before executing.' },
  { id: 'assisted', label: 'Assisted', icon: Bot, description: 'Agent acts on routine tasks, asks for important ones.' },
  { id: 'auto', label: 'Just do it', icon: Sparkles, description: 'Agent executes without asking. You can always undo.' },
] as const;

// ─── Agent feature assignments ───────────────────────────────────────────────

const AGENT_ASSIGNMENTS: Record<string, string[]> = {
  weebo: ['Creative', 'Social', 'Chat'],
  edith: ['Code', 'Systems', 'Terminal'],
  jarvis: ['Calendar', 'Reminders', 'Email'],
};

// ─── Motion variants ─────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const EASE_SMOOTH = [0.4, 0, 0.2, 1] as [number, number, number, number];

const itemVariants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: EASE_SMOOTH },
  },
};

// ─── Shared style helpers ────────────────────────────────────────────────────

/**
 * Dark-mode glass card: shadows over borders for depth.
 * Three-layer shadow: white ring (structural) + depth lift + violet glow.
 */
const GLASS_CARD_STYLE: React.CSSProperties = {
  background: 'var(--ag-bg-surface)',
  backdropFilter: 'blur(var(--ag-glass-blur))',
  WebkitBackdropFilter: 'blur(var(--ag-glass-blur))',
  boxShadow:
    '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.28), var(--ag-glow-sm)',
  borderRadius: 16,
};

const GLASS_CARD_HOVER_SHADOW =
  '0 0 0 1px rgba(255,255,255,0.09), 0 8px 32px rgba(0,0,0,0.35), var(--ag-glow-md)';

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Glass card wrapper with shadow-over-border and hover lift. */
function GlassCard({
  children,
  className = '',
  style,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const dangerStyle: React.CSSProperties = danger
    ? { boxShadow: '0 0 0 1px rgba(255,45,120,0.2), 0 4px 24px rgba(0,0,0,0.28)' }
    : {};

  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative w-full text-left ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        ...GLASS_CARD_STYLE,
        ...(hovered ? { boxShadow: GLASS_CARD_HOVER_SHADOW } : {}),
        ...(danger ? dangerStyle : {}),
        ...style,
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
}

/** Slider row with label and value badge. */
function SliderRow({
  label,
  value,
  onChange,
  valueBadge,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number[];
  onChange: (v: number[]) => void;
  valueBadge: string;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--ag-text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {label}
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-lg"
          style={{
            background: 'rgba(167,139,250,0.12)',
            color: 'var(--ag-text-accent)',
            boxShadow: '0 0 0 1px rgba(167,139,250,0.2)',
          }}
        >
          {valueBadge}
        </span>
      </div>
      <Slider
        value={value}
        onValueChange={onChange}
        max={100}
        step={25}
        className="w-full [&_[data-slot=slider-range]]:bg-[var(--ag-cyan)] [&_[data-slot=slider-thumb]]:bg-[var(--ag-cyan)] [&_[data-slot=slider-thumb]]:border-[var(--ag-cyan)] [&_[data-slot=slider-track]]:bg-[var(--ag-bg-elevated)]"
      />
      <div className="flex justify-between text-xs text-[var(--ag-text-muted)] mt-1.5">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AgentSettingsPage() {
  const navigate = useNavigate();
  const { agent, updateAgent, integrations, loadIntegrations } = useDashboardStore();
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'agent-settings' });
  const isDirty = useRef(false);

  // Personality state
  const [selectedPersonality, setSelectedPersonality] = useState<AgentPersonality>(agent.personality || 'weebo');
  const [personalities, setPersonalities] = useState<Record<string, Personality>>({});
  const [agentName, setAgentName] = useState(agent.name || 'Weebo');
  const [tone, setTone] = useState([agent.formality ?? 50]);
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

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleAgentSwitch = useCallback(async (id: AgentPersonality) => {
    const prev = selectedPersonality;
    setSelectedPersonality(id);
    const agentDef = AGENTS.find(a => a.id === id);
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

  // ─── Derived values ───────────────────────────────────────────────────────

  const currentAgent = AGENTS.find(a => a.id === selectedPersonality) || AGENTS[0];
  const toneStep = Math.round(tone[0] / 25);
  const verbosityStep = Math.round(verbosity[0] / 25);
  const creativityStep = Math.round(creativity[0] / 25);
  const humorStep = Math.round(humor[0] / 25);
  const empathyStep = Math.round(empathy[0] / 25);
  const instructionsLength = customInstructions.length;

  const telegramInt = integrations.find(i => i.type === 'telegram');
  const isTelegramConnected = telegramStatus === 'connected' || telegramInt?.status === 'connected';

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

        {/* ── Toast ─────────────────────────────────────────────────────── */}
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
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.4), var(--ag-glow-md)',
                }}
              >
                {saveToast.includes('Saved') || saveToast.includes('Switched') || saveToast.includes('Cleared') ? (
                  <Check className="w-4 h-4 text-[var(--ag-lime)] flex-shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                )}
                <span>{saveToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Page header ───────────────────────────────────────────────── */}
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

        {/* ── Agent hero card ───────────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="p-5 rounded-2xl"
          style={GLASS_CARD_STYLE}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            {/* Active agent info */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <motion.div
                  key={selectedPersonality}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{
                    background: `color-mix(in srgb, ${currentAgent.color} 15%, transparent)`,
                    boxShadow: `0 0 0 2px ${currentAgent.color}, 0 0 24px color-mix(in srgb, ${currentAgent.color} 30%, transparent)`,
                    color: currentAgent.color,
                  }}
                >
                  {currentAgent.name[0]}
                </motion.div>
                {/* Online indicator — concentric: outer w-4 h-4 rounded-full with p-0.5 inner */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--ag-bg-base)', boxShadow: '0 0 0 2px var(--ag-bg-base)' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--ag-lime)]" />
                </div>
              </div>
              <div>
                <motion.h2
                  key={selectedPersonality + '-name'}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="text-2xl font-bold text-[var(--ag-text-primary)] font-heading"
                  style={{ textWrap: 'balance' } as React.CSSProperties}
                >
                  {currentAgent.name}
                </motion.h2>
                <p className="text-sm text-[var(--ag-text-secondary)] mt-0.5">
                  {currentAgent.description}
                </p>
              </div>
            </div>

            {/* Agent switcher — segmented control style */}
            {/* Outer container rounded-[22px] p-1.5 → pills rounded-2xl (16px) = 22-6=16 ✓ */}
            <div
              className="flex gap-1.5 p-1.5 rounded-[22px]"
              style={{
                background: 'rgba(255,255,255,0.03)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset',
              }}
            >
              {AGENTS.map((a) => {
                const isActive = a.id === selectedPersonality;
                return (
                  <motion.button
                    key={a.id}
                    onClick={() => handleAgentSwitch(a.id)}
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="relative flex items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                    style={{
                      color: isActive ? currentAgent.color : 'var(--ag-text-secondary)',
                      transition: 'color 200ms ease',
                    }}
                  >
                    {/* Animated active background */}
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          layoutId="agent-pill-bg"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
                          className="absolute inset-0 rounded-2xl"
                          style={{
                            background: `color-mix(in srgb, ${a.color} 14%, transparent)`,
                            boxShadow: `0 0 0 1px color-mix(in srgb, ${a.color} 45%, transparent)`,
                          }}
                        />
                      )}
                    </AnimatePresence>
                    {/* Agent avatar dot — concentric: outer rounded-full p-0 inner rounded-full */}
                    <div
                      className="relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{
                        background: a.color,
                        color: 'var(--ag-bg-base)',
                        WebkitFontSmoothing: 'antialiased',
                      }}
                    >
                      {a.name[0]}
                    </div>
                    <span className="relative z-10">{a.name}</span>
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.span
                          key="check"
                          initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                          className="relative z-10"
                        >
                          <Check className="w-3.5 h-3.5" style={{ color: a.color }} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>

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
                    style={{
                      color: isActive ? 'var(--ag-text-primary)' : 'var(--ag-text-secondary)',
                    }}
                  >
                    {/* Animated active tab background — concentric: outer rounded-2xl p-1.5 → inner rounded-xl (16-6=10≈12) */}
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

          {/* ══ PERSONALITY TAB ══════════════════════════════════════════ */}
          <TabsContent value="personality" asChild>
            <AnimatePresence mode="wait">
              {activeTab === 'personality' && (
                <motion.div
                  key="personality"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-5 space-y-4"
                >
                  {/* Agent Name */}
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-4">
                          <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading">
                            Agent Name
                          </h2>
                          <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                            This name is used in conversations and greetings.
                          </p>
                        </div>
                        {/* Input outer rounded-2xl p-5 → input inner rounded-xl (12px) = separate surface, correct */}
                        <Input
                          value={agentName}
                          onChange={(e) => { isDirty.current = true; setAgentName(e.target.value); }}
                          className="max-w-sm min-h-[44px] rounded-xl text-[var(--ag-text-primary)] focus:ring-[var(--ag-violet)]/20"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
                            border: 'none',
                          }}
                          placeholder="What should your agent be called?"
                          maxLength={30}
                        />
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Model Selector */}
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                              Primary Model
                            </h2>
                            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                              Choose the LLM that powers your agent's responses.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {MODELS.map((m) => {
                            const isActive = selectedModel === m.id;
                            return (
                              <motion.button
                                key={m.id}
                                onClick={() => { isDirty.current = true; setSelectedModel(m.id); }}
                                whileTap={{ scale: 0.96 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className="px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                                style={{
                                  color: isActive ? 'var(--ag-violet)' : 'var(--ag-text-secondary)',
                                  background: isActive
                                    ? 'rgba(139,92,246,0.12)'
                                    : 'rgba(255,255,255,0.03)',
                                  boxShadow: isActive
                                    ? '0 0 0 1px var(--ag-border-active), var(--ag-glow-sm)'
                                    : '0 0 0 1px rgba(255,255,255,0.07)',
                                  transition: 'all 200ms ease',
                                }}
                              >
                                {m.label}
                                {m.tier === 'pro' && (
                                  <span
                                    className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{
                                      background: 'rgba(139,92,246,0.15)',
                                      color: 'var(--ag-violet)',
                                      boxShadow: '0 0 0 1px rgba(139,92,246,0.25)',
                                    }}
                                  >
                                    PRO
                                  </span>
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Personality Sliders */}
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-5 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                              Personality Tuning
                            </h2>
                            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                              Adjust how your agent communicates.
                            </p>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                          <SliderRow
                            label="Creativity"
                            value={creativity}
                            onChange={(v) => { isDirty.current = true; setCreativity(v); }}
                            valueBadge={CREATIVITY_LABELS[creativityStep]}
                            leftLabel="Factual"
                            rightLabel="Exploratory"
                          />
                          <SliderRow
                            label="Tone"
                            value={tone}
                            onChange={(v) => { isDirty.current = true; setTone(v); }}
                            valueBadge={TONE_LABELS[toneStep]}
                            leftLabel="Casual"
                            rightLabel="Formal"
                          />
                          <SliderRow
                            label="Verbosity"
                            value={verbosity}
                            onChange={(v) => { isDirty.current = true; setVerbosity(v); }}
                            valueBadge={VERBOSITY_LABELS[verbosityStep]}
                            leftLabel="Terse"
                            rightLabel="Detailed"
                          />
                          <SliderRow
                            label="Humor"
                            value={humor}
                            onChange={(v) => { isDirty.current = true; setHumor(v); }}
                            valueBadge={HUMOR_LABELS[humorStep]}
                            leftLabel="Serious"
                            rightLabel="Humorous"
                          />
                          <div className="md:col-span-2 md:max-w-[calc(50%-1rem)]">
                            <SliderRow
                              label="Empathy"
                              value={empathy}
                              onChange={(v) => { isDirty.current = true; setEmpathy(v); }}
                              valueBadge={EMPATHY_LABELS[empathyStep]}
                              leftLabel="Direct"
                              rightLabel="Empathetic"
                            />
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Language */}
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                              Language Preference
                            </h2>
                            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                              Your agent will respond primarily in this language.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'english', label: 'English' },
                            { id: 'hinglish', label: 'Hinglish' },
                            { id: 'hindi', label: 'Hindi' },
                          ].map((lang) => {
                            const isActive = language === lang.id;
                            return (
                              <motion.button
                                key={lang.id}
                                onClick={() => setLanguage(lang.id)}
                                whileTap={{ scale: 0.96 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className="px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                                style={{
                                  color: isActive ? 'var(--ag-violet)' : 'var(--ag-text-secondary)',
                                  background: isActive ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
                                  boxShadow: isActive
                                    ? '0 0 0 1px var(--ag-border-active)'
                                    : '0 0 0 1px rgba(255,255,255,0.07)',
                                  transition: 'all 200ms ease',
                                }}
                              >
                                {lang.label}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Custom Instructions */}
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                              Custom Instructions
                            </h2>
                            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                              These instructions guide your agent's behavior across all conversations.
                            </p>
                          </div>
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
                            className="min-h-[120px] rounded-xl text-[var(--ag-text-primary)] resize-none pr-14 focus:ring-[var(--ag-violet)]/20"
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              boxShadow: '0 0 0 1px rgba(255,255,255,0.07)',
                              border: 'none',
                            }}
                            placeholder="Tell your agent how to behave. E.g. 'Always respond with bullet points' or 'Be encouraging and use emojis'..."
                            maxLength={500}
                          />
                          <span
                            className="absolute bottom-3 right-3 text-xs font-mono"
                            style={{
                              fontVariantNumeric: 'tabular-nums',
                              color: instructionsLength > 450 ? 'var(--ag-pink)' : 'var(--ag-text-muted)',
                            }}
                          >
                            {instructionsLength}/500
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Autonomy Level */}
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                              Autonomy Level
                            </h2>
                            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                              How much freedom does {currentAgent.name} have to act on your behalf?
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {AUTONOMY_LEVELS.map((level) => {
                            const isActive = autonomyLevel === level.id;
                            return (
                              <motion.button
                                key={level.id}
                                onClick={() => { isDirty.current = true; setAutonomyLevel(level.id); }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className="w-full flex items-start gap-3 p-4 min-h-[44px] rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                                style={{
                                  background: isActive ? 'rgba(167,139,250,0.07)' : 'rgba(255,255,255,0.02)',
                                  boxShadow: isActive
                                    ? '0 0 0 1px var(--ag-border-active)'
                                    : '0 0 0 1px rgba(255,255,255,0.06)',
                                  transition: 'all 200ms ease',
                                }}
                              >
                                {/* Radio indicator — concentric: outer w-5 h-5 rounded-full p-[3px] → inner w-2.5 h-2.5 rounded-full */}
                                <div
                                  className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{
                                    boxShadow: isActive
                                      ? '0 0 0 2px var(--ag-cyan)'
                                      : '0 0 0 2px rgba(156,163,175,0.4)',
                                    transition: 'box-shadow 200ms ease',
                                  }}
                                >
                                  <AnimatePresence initial={false}>
                                    {isActive && (
                                      <motion.div
                                        key="dot"
                                        initial={{ scale: 0.25, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.25, opacity: 0 }}
                                        transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ background: 'var(--ag-cyan)' }}
                                      />
                                    )}
                                  </AnimatePresence>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <level.icon
                                      className="w-4 h-4 flex-shrink-0"
                                      style={{ color: isActive ? 'var(--ag-cyan)' : 'var(--ag-text-muted)' }}
                                    />
                                    <span
                                      className="text-sm font-semibold"
                                      style={{ color: isActive ? 'var(--ag-text-primary)' : 'var(--ag-text-secondary)' }}
                                    >
                                      {level.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[var(--ag-text-secondary)] mt-1 leading-relaxed" style={{ textWrap: 'pretty' } as React.CSSProperties}>
                                    {level.description}
                                  </p>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Agent Assignments */}
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                              Agent Assignments
                            </h2>
                            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                              Each agent specializes in different areas.
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {AGENTS.map((a) => {
                            const features = AGENT_ASSIGNMENTS[a.id] || [];
                            return (
                              <div
                                key={a.id}
                                className="flex items-center justify-between p-3.5 rounded-xl"
                                style={{
                                  background: 'rgba(255,255,255,0.02)',
                                  boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                                }}
                              >
                                <div className="flex items-center gap-2.5">
                                  {/* Concentric: agent dot as avatar, fully circular */}
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                    style={{ background: a.color, color: 'var(--ag-bg-base)', WebkitFontSmoothing: 'antialiased' }}
                                  >
                                    {a.name[0]}
                                  </div>
                                  <span className="text-sm font-medium text-[var(--ag-text-primary)]">
                                    {a.name}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 justify-end">
                                  {features.map((f) => (
                                    <span
                                      key={f}
                                      className="text-xs px-2.5 py-1 rounded-lg text-[var(--ag-text-secondary)]"
                                      style={{
                                        background: 'rgba(139,92,246,0.06)',
                                        boxShadow: '0 0 0 1px rgba(139,92,246,0.12)',
                                      }}
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Save Button */}
                  <motion.div variants={itemVariants} className="flex justify-end pb-2">
                    <motion.div whileTap={{ scale: 0.96 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
                      <Button
                        size="lg"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="min-h-[44px] rounded-xl font-semibold px-8 text-white focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                        style={{
                          background: 'linear-gradient(135deg, var(--ag-violet) 0%, var(--ag-amber) 100%)',
                          boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 4px 16px rgba(139,92,246,0.35)',
                          transition: 'opacity 200ms ease, box-shadow 200ms ease',
                        }}
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ══ MEMORY TAB ═══════════════════════════════════════════════ */}
          <TabsContent value="memory" asChild>
            <AnimatePresence mode="wait">
              {activeTab === 'memory' && (
                <motion.div
                  key="memory"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-5 space-y-4"
                >
                  {/* Memory toggle */}
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Icon — concentric: outer rounded-2xl p-2.5 (10px) → inner icon = rounded-xl (12px)... icon itself is just SVG */}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              background: 'rgba(167,139,250,0.1)',
                              boxShadow: '0 0 0 1px rgba(167,139,250,0.2)',
                            }}
                          >
                            <Brain className="w-5 h-5 text-[var(--ag-cyan)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <h2 className="text-base font-semibold text-[var(--ag-text-primary)]">
                                  Agent can remember things
                                </h2>
                                <p className="text-sm text-[var(--ag-text-secondary)] mt-1 leading-relaxed" style={{ textWrap: 'pretty' } as React.CSSProperties}>
                                  When enabled, your agent remembers your preferences, facts, and context across conversations.
                                </p>
                              </div>
                              <Switch
                                checked={memoryEnabled}
                                onCheckedChange={setMemoryEnabled}
                                className={`flex-shrink-0 ${memoryEnabled ? '!bg-[var(--ag-cyan)]' : '!bg-[var(--ag-bg-elevated)]'} data-[state=checked]:!bg-[var(--ag-cyan)]`}
                              />
                            </div>
                            <AnimatePresence>
                              {memoryEnabled && memoryCount > 0 && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                  className="text-sm text-[var(--ag-text-secondary)] mt-3 pt-3 overflow-hidden"
                                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                                >
                                  Your agent has{' '}
                                  <span className="text-[var(--ag-cyan)] font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {memoryCount}
                                  </span>{' '}
                                  {memoryCount === 1 ? 'memory' : 'memories'} stored.
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Memory Manager link */}
                  <motion.div variants={itemVariants}>
                    <GlassCard onClick={() => navigate('/dashboard/memory')}>
                      <div className="p-5 flex items-center justify-between gap-4 group">
                        <div className="flex items-center gap-3">
                          {/* Concentric: outer rounded-2xl p-5 (20px) → icon wrapper rounded-xl separate surface */}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              background: 'rgba(139,92,246,0.1)',
                              boxShadow: '0 0 0 1px rgba(139,92,246,0.2)',
                            }}
                          >
                            <Brain className="w-5 h-5 text-[var(--ag-violet)]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[var(--ag-text-primary)]">
                              Memory Manager
                            </h3>
                            <p className="text-sm text-[var(--ag-text-secondary)]">
                              View, edit, and manage individual memories
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--ag-text-muted)] flex-shrink-0" />
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Danger zone */}
                  <motion.div variants={itemVariants}>
                    <GlassCard danger>
                      <div className="p-5">
                        <h2 className="text-base font-semibold mb-1.5 flex items-center gap-2" style={{ color: 'var(--ag-pink)' }}>
                          <Trash2 className="w-4 h-4" />
                          Danger Zone
                        </h2>
                        <p className="text-sm text-[var(--ag-text-secondary)] mb-4">
                          Permanently delete all memories your agent has stored. This cannot be undone.
                        </p>
                        <motion.div whileTap={{ scale: 0.96 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="inline-block">
                          <Button
                            variant="outline"
                            onClick={handleClearAllMemories}
                            disabled={memoryCount === 0 || isClearing}
                            className="min-h-[44px] rounded-xl"
                            style={{
                              color: 'var(--ag-pink)',
                              boxShadow: '0 0 0 1px rgba(255,45,120,0.3)',
                              background: 'rgba(255,45,120,0.06)',
                              border: 'none',
                            }}
                          >
                            {isClearing ? (
                              <div className="w-4 h-4 border-2 border-[var(--ag-pink)]/30 border-t-[var(--ag-pink)] rounded-full animate-spin mr-2" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Clear All Memories
                            {memoryCount > 0 && (
                              <span className="ml-2 text-xs opacity-60" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                ({memoryCount})
                              </span>
                            )}
                          </Button>
                        </motion.div>
                      </div>
                    </GlassCard>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ══ TOOLS TAB ════════════════════════════════════════════════ */}
          <TabsContent value="tools" asChild>
            <AnimatePresence mode="wait">
              {activeTab === 'tools' && (
                <motion.div
                  key="tools"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-5 space-y-4"
                >
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                              Available Tools
                            </h2>
                            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                              Enable or disable tools your agent can use during conversations.
                            </p>
                          </div>
                        </div>
                        {/* Tool rows — each row is a separate stagger item inside the card */}
                        <motion.div
                          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                          className="space-y-2.5"
                        >
                          {TOOLS.map((tool) => {
                            const enabled = toolStates[tool.id] ?? false;
                            return (
                              <motion.div
                                key={tool.id}
                                variants={itemVariants}
                                className="flex items-center justify-between p-4 rounded-xl"
                                style={{
                                  background: enabled ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)',
                                  boxShadow: enabled
                                    ? '0 0 0 1px rgba(167,139,250,0.18)'
                                    : '0 0 0 1px rgba(255,255,255,0.06)',
                                  transition: 'all 200ms ease',
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Icon container — concentric: row p-4 → icon rounded-xl (12px) separate surface at this spacing */}
                                  <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                      background: enabled ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                                      transition: 'background 200ms ease',
                                    }}
                                  >
                                    <tool.icon
                                      className="w-4 h-4"
                                      style={{
                                        color: enabled ? 'var(--ag-cyan)' : 'var(--ag-text-muted)',
                                        transition: 'color 200ms ease',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <h3
                                      className="text-sm font-medium"
                                      style={{
                                        color: enabled ? 'var(--ag-text-primary)' : 'var(--ag-text-secondary)',
                                        transition: 'color 200ms ease',
                                      }}
                                    >
                                      {tool.label}
                                    </h3>
                                    <p className="text-xs text-[var(--ag-text-muted)]">
                                      {tool.description}
                                    </p>
                                  </div>
                                </div>
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={() => toggleTool(tool.id)}
                                  className={`flex-shrink-0 ${enabled ? '!bg-[var(--ag-cyan)]' : '!bg-[var(--ag-bg-elevated)]'} data-[state=checked]:!bg-[var(--ag-cyan)]`}
                                />
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </div>
                    </GlassCard>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ══ CHANNELS TAB ═════════════════════════════════════════════ */}
          <TabsContent value="channels" asChild>
            <AnimatePresence mode="wait">
              {activeTab === 'channels' && (
                <motion.div
                  key="channels"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-5 space-y-4"
                >
                  <motion.div variants={itemVariants}>
                    <GlassCard>
                      <div className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                              Connected Channels
                            </h2>
                            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                              Manage where your agent is available.
                            </p>
                          </div>
                        </div>
                        <motion.div
                          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                          className="space-y-2.5"
                        >
                          {/* Telegram */}
                          <motion.div
                            variants={itemVariants}
                            className="flex items-center justify-between p-4 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.02)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(0,136,204,0.12)', boxShadow: '0 0 0 1px rgba(0,136,204,0.2)' }}
                              >
                                <Send className="w-5 h-5" style={{ color: '#0088CC' }} />
                              </div>
                              <div>
                                <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">Telegram</h3>
                                <p className="text-xs text-[var(--ag-text-muted)]">Chat with your agent via Telegram</p>
                              </div>
                            </div>
                            {telegramStatus === 'checking' ? (
                              <span className="text-xs text-[var(--ag-text-muted)]">Checking…</span>
                            ) : isTelegramConnected ? (
                              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ag-lime)]">
                                <div className="w-2 h-2 rounded-full bg-[var(--ag-lime)] animate-pulse" />
                                Connected
                              </span>
                            ) : (
                              <motion.div whileTap={{ scale: 0.96 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate('/dashboard/connections')}
                                  className="min-h-[44px] rounded-xl text-xs"
                                  style={{
                                    color: '#0088CC',
                                    border: 'none',
                                    boxShadow: '0 0 0 1px rgba(0,136,204,0.3)',
                                    background: 'rgba(0,136,204,0.08)',
                                  }}
                                >
                                  Setup
                                </Button>
                              </motion.div>
                            )}
                          </motion.div>

                          {/* Web Chat */}
                          <motion.div
                            variants={itemVariants}
                            className="flex items-center justify-between p-4 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.02)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(167,139,250,0.12)', boxShadow: '0 0 0 1px rgba(167,139,250,0.2)' }}
                              >
                                <MessageCircle className="w-5 h-5 text-[var(--ag-cyan)]" />
                              </div>
                              <div>
                                <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">Web Chat</h3>
                                <p className="text-xs text-[var(--ag-text-muted)]">Chat via the web dashboard</p>
                              </div>
                            </div>
                            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ag-lime)]">
                              <div className="w-2 h-2 rounded-full bg-[var(--ag-lime)]" />
                              Always on
                            </span>
                          </motion.div>

                          {/* WhatsApp — coming soon */}
                          <motion.div
                            variants={itemVariants}
                            className="flex items-center justify-between p-4 rounded-xl opacity-50"
                            style={{ background: 'rgba(255,255,255,0.01)', boxShadow: '0 0 0 1px rgba(255,255,255,0.05)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(37,211,102,0.1)', boxShadow: '0 0 0 1px rgba(37,211,102,0.18)' }}
                              >
                                <MessageCircle className="w-5 h-5" style={{ color: '#25D366' }} />
                              </div>
                              <div>
                                <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">WhatsApp</h3>
                                <p className="text-xs text-[var(--ag-text-muted)]">Chat with your agent on WhatsApp</p>
                              </div>
                            </div>
                            <span
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                              style={{
                                background: 'rgba(139,92,246,0.1)',
                                color: 'var(--ag-violet)',
                                boxShadow: '0 0 0 1px rgba(139,92,246,0.2)',
                              }}
                            >
                              Soon
                            </span>
                          </motion.div>
                        </motion.div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Integrations link */}
                  <motion.div variants={itemVariants}>
                    <GlassCard onClick={() => navigate('/dashboard/connections')}>
                      <div className="p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(167,139,250,0.1)', boxShadow: '0 0 0 1px rgba(167,139,250,0.2)' }}
                          >
                            <ExternalLink className="w-5 h-5 text-[var(--ag-violet)]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[var(--ag-text-primary)]">Manage Integrations</h3>
                            <p className="text-sm text-[var(--ag-text-secondary)]">Add and configure all channel connections</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--ag-text-muted)] flex-shrink-0" />
                      </div>
                    </GlassCard>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </PageShell>
    </DashboardPageWrapper>
  );
}
