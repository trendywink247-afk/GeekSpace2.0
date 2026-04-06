// AgentConfigTab.tsx — Agent Config tab content with self-contained state
import { useState, useEffect } from 'react';
import type { PicoAgentFull } from '@/services/api';
import { picoService } from '@/services/api';
import { getAgentColor, TOOL_OPTIONS, parseAssignedTools } from './helpers';
import { SectionCard } from '@/components/agentin';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Check, Loader2, Save } from 'lucide-react';

interface AgentConfigTabProps {
  agents: PicoAgentFull[];
  selectedAgentId: string;
  onSelectAgentId: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error') => void;
  onRefresh: () => Promise<void>;
}

export function AgentConfigTab({ agents, selectedAgentId, onSelectAgentId, onShowToast, onRefresh }: AgentConfigTabProps) {
  const [configDirty, setConfigDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [cfgPersonality, setCfgPersonality] = useState('weebo');
  const [cfgMode, setCfgMode] = useState('builder');
  const [cfgVoice, setCfgVoice] = useState('friendly');
  const [cfgCreativity, setCfgCreativity] = useState([70]);
  const [cfgFormality, setCfgFormality] = useState([50]);
  const [cfgModelPref, setCfgModelPref] = useState('auto');
  const [cfgSystemPrompt, setCfgSystemPrompt] = useState('');
  const [cfgCustomCommands, setCfgCustomCommands] = useState('');
  const [cfgAssignedTools, setCfgAssignedTools] = useState<string[]>([]);
  const [cfgEnabled, setCfgEnabled] = useState(true);

  // Load config when selected agent changes
  useEffect(() => {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;
    setCfgPersonality(agent.personality || 'weebo');
    setCfgMode(agent.mode || 'builder');
    setCfgVoice(agent.voice || 'friendly');
    setCfgCreativity([agent.creativity ?? 70]);
    setCfgFormality([agent.formality ?? 50]);
    setCfgModelPref(agent.model_preference || 'auto');
    setCfgSystemPrompt(agent.system_prompt || '');
    setCfgCustomCommands(agent.custom_commands || '');
    setCfgAssignedTools(parseAssignedTools(agent.assigned_tools));
    setCfgEnabled(agent.enabled !== 0);
    setConfigDirty(false);
  }, [selectedAgentId, agents]);

  const handleSaveConfig = async () => {
    if (!selectedAgentId) return;
    setSavingConfig(true);
    try {
      await picoService.updateAgent(selectedAgentId, {
        mode: cfgMode,
        voice: cfgVoice,
        creativity: cfgCreativity[0],
        formality: cfgFormality[0],
        model_preference: cfgModelPref,
        system_prompt: cfgSystemPrompt,
        custom_commands: cfgCustomCommands,
        assigned_tools: cfgAssignedTools,
        enabled: cfgEnabled,
      });
      onShowToast('Agent config saved', 'success');
      setConfigDirty(false);
      await onRefresh();
    } catch {
      onShowToast('Failed to save config', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const dirty = () => setConfigDirty(true);
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const activeCount = agents.filter(a => a.enabled).length;

  return (
    <div className="space-y-6">
      {/* Agent selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-[var(--ag-text-muted)] shrink-0">Configure agent:</label>
        <Select value={selectedAgentId} onValueChange={onSelectAgentId}>
          <SelectTrigger className="bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] max-w-[300px]">
            <SelectValue placeholder="Select an agent..." />
          </SelectTrigger>
          <SelectContent className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.08)]">
            {agents.map(a => (
              <SelectItem key={a.id} value={a.id} className="text-[var(--ag-text-primary)]">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: `${getAgentColor(a.personality)}20`, color: getAgentColor(a.personality) }}
                  >
                    {a.personality === 'edith' ? 'E' : a.personality === 'jarvis' ? 'J' : 'W'}
                  </span>
                  {a.name} (Slot {a.slot})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedAgent ? (
        <div className="text-center py-16">
          <Bot className="w-12 h-12 text-[var(--ag-violet)]/30 mx-auto mb-3" />
          <p className="text-[var(--ag-text-muted)]">Select an agent above to configure.</p>
        </div>
      ) : (
        <>
          {/* Personality */}
          <SectionCard title="Personality" padding="lg">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { id: 'weebo', name: 'Weebo', desc: 'Enthusiastic helper, excited to assist', letter: 'W', color: 'var(--ag-cyan)' },
                { id: 'jarvis', name: 'Jarvis', desc: 'Professional butler, polished and reliable', letter: 'J', color: '#ADFF2F' },
                { id: 'edith', name: 'Edith', desc: 'Sharp CTO, direct and efficient', letter: 'E', color: 'var(--ag-violet)' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => { setCfgPersonality(p.id); dirty(); }}
                  className="p-4 rounded-xl border-2 transition-all text-left border-[rgba(139,92,246,0.08)] bg-[var(--ag-bg-deep)] hover:border-[rgba(139,92,246,0.15)]"
                  style={cfgPersonality === p.id ? { borderColor: p.color, backgroundColor: `${p.color}15` } : undefined}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: `${p.color}20`, border: `2px solid ${p.color}`, color: p.color }}
                    >
                      {p.letter}
                    </span>
                    {cfgPersonality === p.id && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: p.color }}>
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-[var(--ag-text-primary)] mb-1">{p.name}</h3>
                  <p className="text-sm text-[var(--ag-text-muted)]">{p.desc}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Mode */}
          <SectionCard title="Mode" padding="lg">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { id: 'minimal', name: 'Minimal', desc: 'Simple responses, reminders & Q&A', color: 'var(--ag-cyan)' },
                { id: 'builder', name: 'Builder', desc: 'Code gen, portfolio updates, full toolset', color: '#00FF88' },
                { id: 'operator', name: 'Operator', desc: 'Full automation, API calls, workflows', color: '#FFB800' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => { setCfgMode(m.id); dirty(); }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    cfgMode === m.id
                      ? 'border-[var(--ag-violet)] bg-[#8B5CF6]/10'
                      : 'border-[rgba(139,92,246,0.08)] bg-[var(--ag-bg-deep)] hover:border-[rgba(139,92,246,0.15)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${m.color}20` }}>
                      <span className="text-sm font-bold" style={{ color: m.color }}>{m.id[0].toUpperCase()}</span>
                    </span>
                    {cfgMode === m.id && (
                      <div className="w-6 h-6 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-[var(--ag-text-primary)] mb-1">{m.name}</h3>
                  <p className="text-sm text-[var(--ag-text-muted)]">{m.desc}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Model Preference */}
          <SectionCard title="Model Preference" padding="lg">
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'auto', label: 'Auto', desc: 'Best engine for each task' },
                { value: 'local', label: 'Local', desc: 'Always run locally (Ollama)' },
                { value: 'cloud', label: 'Cloud', desc: 'Cloud models via OpenRouter' },
                { value: 'premium', label: 'Premium', desc: 'Top-tier models (more credits)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setCfgModelPref(opt.value); dirty(); }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    cfgModelPref === opt.value
                      ? 'border-[var(--ag-violet)] bg-[#8B5CF6]/10'
                      : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
                  }`}
                >
                  <div className="text-sm font-medium text-[var(--ag-text-primary)]">{opt.label}</div>
                  <div className="text-xs text-[var(--ag-text-muted)]">{opt.desc}</div>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Voice & Tone */}
          <SectionCard title="Voice & Tone" padding="lg">
            <div className="space-y-2">
              {[
                { id: 'professional', name: 'Professional', desc: 'Formal and polished' },
                { id: 'friendly', name: 'Friendly', desc: 'Warm and approachable' },
                { id: 'witty', name: 'Witty', desc: 'Clever with personality' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => { setCfgVoice(v.id); dirty(); }}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between ${
                    cfgVoice === v.id
                      ? 'border-[var(--ag-violet)] bg-[#8B5CF6]/10'
                      : 'border-[rgba(139,92,246,0.08)] bg-[var(--ag-bg-deep)] hover:border-[rgba(139,92,246,0.15)]'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium text-[var(--ag-text-primary)]">{v.name}</div>
                    <div className="text-sm text-[var(--ag-text-muted)]">{v.desc}</div>
                  </div>
                  {cfgVoice === v.id && (
                    <div className="w-5 h-5 rounded-full bg-[#8B5CF6] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Sliders */}
          <SectionCard padding="lg" className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="slider-creativity" className="text-sm text-[var(--ag-text-muted)]">Creativity</label>
                <span className="text-sm text-[var(--ag-text-primary)] font-mono">{cfgCreativity[0]}%</span>
              </div>
              <Slider
                id="slider-creativity"
                value={cfgCreativity}
                onValueChange={(v) => { setCfgCreativity(v); dirty(); }}
                max={100}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[var(--ag-text-muted)] mt-1">
                <span>Conservative</span><span>Creative</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="slider-formality" className="text-sm text-[var(--ag-text-muted)]">Formality</label>
                <span className="text-sm text-[var(--ag-text-primary)] font-mono">{cfgFormality[0]}%</span>
              </div>
              <Slider
                id="slider-formality"
                value={cfgFormality}
                onValueChange={(v) => { setCfgFormality(v); dirty(); }}
                max={100}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[var(--ag-text-muted)] mt-1">
                <span>Casual</span><span>Formal</span>
              </div>
            </div>
          </SectionCard>

          {/* System Prompt & Custom Commands */}
          <SectionCard padding="lg" className="space-y-4">
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] block mb-2">System Prompt</label>
              <Textarea
                value={cfgSystemPrompt}
                onChange={(e) => { setCfgSystemPrompt(e.target.value); dirty(); }}
                className="bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] min-h-[120px] resize-none"
                placeholder="Custom instructions for this agent..."
              />
            </div>
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] block mb-2">Custom Commands</label>
              <Textarea
                value={cfgCustomCommands}
                onChange={(e) => { setCfgCustomCommands(e.target.value); dirty(); }}
                className="bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] min-h-[100px] resize-none"
                placeholder="Tell this agent how to behave, what to prioritize..."
              />
            </div>
          </SectionCard>

          {/* Assigned Tools */}
          <SectionCard title="Assigned Tools" padding="lg">
            <div className="grid grid-cols-2 gap-3">
              {TOOL_OPTIONS.map(tool => {
                const isActive = cfgAssignedTools.includes(tool.id);
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setCfgAssignedTools(prev =>
                        isActive ? prev.filter(t => t !== tool.id) : [...prev, tool.id]
                      );
                      dirty();
                    }}
                    className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                      isActive
                        ? 'border-[var(--ag-violet)] bg-[#8B5CF6]/10'
                        : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
                    }`}
                  >
                    <tool.icon className="w-5 h-5" style={{ color: isActive ? tool.color : '#6B7280' }} />
                    <span className={`text-sm font-medium ${isActive ? 'text-[var(--ag-text-primary)]' : 'text-[var(--ag-text-muted)]'}`}>
                      {tool.label}
                    </span>
                    {isActive && <Check className="w-4 h-4 text-[var(--ag-violet)] ml-auto" />}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Enable/Disable + Save */}
          <SectionCard padding="lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={cfgEnabled}
                  onCheckedChange={(v) => {
                    if (!v && cfgEnabled && activeCount <= 1) {
                      onShowToast('At least one Weebo must remain active', 'error');
                      return;
                    }
                    setCfgEnabled(v);
                    dirty();
                  }}
                  disabled={cfgEnabled && activeCount <= 1}
                  className="data-[state=checked]:bg-[#00FF88] data-[state=unchecked]:bg-[#FF6161]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--ag-text-primary)]">
                    Agent {cfgEnabled ? 'Enabled' : 'Disabled'}
                  </div>
                  <div className="text-xs text-[var(--ag-text-muted)]">
                    {cfgEnabled && activeCount <= 1
                      ? 'Last active agent — cannot be disabled'
                      : cfgEnabled
                      ? 'This agent will process tasks'
                      : 'This agent is paused and will not process tasks'}
                  </div>
                </div>
              </div>
              <Button
                onClick={handleSaveConfig}
                disabled={!configDirty || savingConfig}
                className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-w-[100px] min-h-[44px]"
              >
                {savingConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
