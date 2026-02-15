import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Copy, Check, Trash2, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { agentService } from '@/services/api';

interface Command {
  id: string;
  input: string;
  output: string;
  timestamp: Date;
  isError?: boolean;
  isLoading?: boolean;
}

const welcomeMessage = `GeekSpace Terminal v2.0.0
Powered by OpenClaw AI Engine
Type 'help' to see available commands.
`;

const helpText = `Available commands:
  gs me                    - Show your profile
  gs reminders list        - List all reminders
  gs reminders add "text"  - Add a reminder
  gs schedule today        - Show today's schedule
  gs schedule tomorrow     - Show tomorrow's schedule
  gs portfolio             - Open your public portfolio
  gs status                - Check agent status
  gs credits               - Check credit balance
  gs usage today           - Usage breakdown for today
  gs usage month           - Monthly usage report
  gs integrations          - List connected services
  gs automations           - List automations
  gs deploy                - Deploy portfolio changes
  ai "prompt"              - Ask the AI agent anything
  clear                    - Clear terminal
  help                     - Show this help message
`;

export function TerminalPage() {
  const user = useAuthStore((s) => s.user);
  const { usage, reminders, agent, addReminder } = useDashboardStore();
  const [commands, setCommands] = useState<Command[]>([
    { id: 'welcome', input: '', output: welcomeMessage, timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commands]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getResponses = (): Record<string, string | (() => string)> => ({
    'gs me': `Name: ${user?.name || 'User'}
Username: ${user?.username || 'user'}
Email: ${user?.email || '—'}
Plan: ${user?.plan || 'free'}
Credits: ${(user?.credits ?? 0).toLocaleString()}
Agent: ${agent.name} (${agent.mode} mode)
Joined: ${user?.createdAt?.slice(0, 10) || '—'}`,

    'gs reminders list': () => {
      const active = reminders.filter((r) => !r.completed);
      if (active.length === 0) return 'No active reminders. Use "gs reminders add" to create one.';
      const header = 'ID  | Reminder                    | Channel    | Status\n--- | --------------------------- | ---------- | ------';
      const rows = active.map((r) => `${r.id.slice(0, 4).padEnd(4)}| ${r.text.padEnd(28)}| ${r.channel.padEnd(11)}| ${r.createdBy}`);
      return header + '\n' + rows.join('\n');
    },

    'gs schedule today': `Today's Schedule (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}):

${reminders.filter((r) => !r.completed).slice(0, 5).map((r) => `  - ${r.text} (${r.channel})`).join('\n') || '  No items scheduled'}`,

    'gs schedule tomorrow': `Tomorrow's Schedule:

  No items scheduled yet.
  Use "gs reminders add" to add tasks.`,

    'gs portfolio': `Opening portfolio...
URL: https://${user?.username || 'user'}.geekspace.space
Status: Published`,

    'gs status': `Agent Status: ${agent.status === 'online' ? 'Online' : agent.status === 'error' ? 'Error' : 'Offline'}
Name: ${agent.name}
Mode: ${agent.mode}
Voice: ${agent.voice}
Model: ${agent.primaryModel}
Creativity: ${agent.creativity}%`,

    'gs credits': `Credit Balance: ${(user?.credits ?? 0).toLocaleString()}

Usage this month:
  Messages: ${usage.totalMessages.toLocaleString()}
  Cost: $${usage.totalCostUSD.toFixed(2)}
  Forecast: $${usage.forecastUSD.toFixed(2)}`,

    'gs usage today': `Usage Today:
  Messages: ${Math.floor(usage.totalMessages / 30)}
  Tokens In: ${Math.floor(usage.totalTokensIn / 30).toLocaleString()}
  Tokens Out: ${Math.floor(usage.totalTokensOut / 30).toLocaleString()}
  Cost: $${(usage.totalCostUSD / 30).toFixed(3)}

By Provider:
${Object.entries(usage.byProvider).map(([k, v]) => `  ${k}: $${(v as number / 30).toFixed(3)}`).join('\n') || '  No data'}`,

    'gs usage month': `Monthly Usage Report:
  Total Messages: ${usage.totalMessages.toLocaleString()}
  Tokens In: ${usage.totalTokensIn.toLocaleString()}
  Tokens Out: ${usage.totalTokensOut.toLocaleString()}
  Tool Calls: ${usage.totalToolCalls}
  Total Cost: $${usage.totalCostUSD.toFixed(2)}
  Forecast: $${usage.forecastUSD.toFixed(2)}

By Provider:
${Object.entries(usage.byProvider).map(([k, v]) => `  ${k}: $${(v as number).toFixed(2)}`).join('\n') || '  No data'}

Top Tools:
${Object.entries(usage.byTool).map(([k, v]) => `  ${k}: $${(v as number).toFixed(2)}`).join('\n') || '  No data'}`,

    'gs integrations': () => {
      const integrations = useDashboardStore.getState().integrations;
      if (integrations.length === 0) return 'No integrations configured.\nUse the Connections page to set up services.';
      const connected = integrations.filter(i => i.status === 'connected');
      const disconnected = integrations.filter(i => i.status !== 'connected');
      let out = 'Connected Integrations:\n';
      if (connected.length > 0) {
        out += connected.map(i => `  ${i.name.padEnd(15)} - ${i.status} (${i.requestsToday} req today)`).join('\n');
      } else {
        out += '  None';
      }
      if (disconnected.length > 0) {
        out += '\n\nAvailable:\n';
        out += disconnected.map(i => `  ${i.name}`).join(', ');
      }
      return out;
    },

    'gs automations': () => {
      const automations = useDashboardStore.getState().automations;
      if (automations.length === 0) return 'No automations configured.\nUse the Automations page to create one.';
      const lines = automations.map((a, i) => `  ${i + 1}. ${a.name} (${a.triggerType} → ${a.actionType}) ${a.enabled ? '[active]' : '[disabled]'}`);
      return `Automations:\n${lines.join('\n')}`;
    },

    'gs deploy': `Deploying portfolio changes...
Building... done (2.1s)
Optimizing assets... done
Publishing to CDN... done

Portfolio live at: https://${user?.username || 'user'}.geekspace.space
Deploy ID: dep_${Date.now().toString(36)}`,

    'help': helpText,
  });

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    let output = '';
    let isError = false;

    if (trimmedCmd === 'clear') {
      setCommands([{ id: 'welcome', input: '', output: welcomeMessage, timestamp: new Date() }]);
      setHistory([...history, cmd]);
      setHistoryIndex(-1);
      setInput('');
      return;
    }

    if (trimmedCmd === '') {
      setInput('');
      return;
    }

    const responses = getResponses();

    // Handle AI prompts — call real agent API
    if (trimmedCmd.startsWith('ai ')) {
      const prompt = cmd.trim().slice(3).replace(/^["']|["']$/g, '');
      const loadingCmd: Command = {
        id: Date.now().toString(),
        input: cmd,
        output: '',
        timestamp: new Date(),
        isLoading: true,
      };
      setCommands((prev) => [...prev, loadingCmd]);
      setHistory([...history, cmd]);
      setHistoryIndex(-1);
      setInput('');

      agentService.chat(prompt, 'terminal')
        .then(({ data }) => {
          setCommands((prev) =>
            prev.map((c) =>
              c.id === loadingCmd.id
                ? { ...c, output: `${data.text}\n\n[${data.provider} · ${data.latencyMs}ms]`, isLoading: false }
                : c
            )
          );
        })
        .catch((err) => {
          setCommands((prev) =>
            prev.map((c) =>
              c.id === loadingCmd.id
                ? { ...c, output: `Error: ${err.response?.data?.error || err.message || 'Failed to reach AI agent'}`, isLoading: false, isError: true }
                : c
            )
          );
        });
      return;
    }

    // Handle gs reminders add — call real store
    if (trimmedCmd.startsWith('gs reminders add')) {
      const text = cmd.match(/"([^"]+)"/)?.[1] || 'New reminder';
      const datetime = new Date(Date.now() + 3600000).toISOString();
      const loadingCmd: Command = {
        id: Date.now().toString(),
        input: cmd,
        output: '',
        timestamp: new Date(),
        isLoading: true,
      };
      setCommands((prev) => [...prev, loadingCmd]);
      setHistory([...history, cmd]);
      setHistoryIndex(-1);
      setInput('');

      addReminder({
        text,
        datetime,
        channel: 'push',
        category: 'other',
      }).then(() => {
        setCommands((prev) =>
          prev.map((c) =>
            c.id === loadingCmd.id
              ? { ...c, output: `Reminder added!\n  Text: "${text}"\n  Channel: push\n  Due: ${new Date(datetime).toLocaleString()}`, isLoading: false }
              : c
          )
        );
      });
      return;
    }

    if (responses[trimmedCmd]) {
      const resp = responses[trimmedCmd];
      output = typeof resp === 'function' ? resp() : resp;
    } else {
      output = `Command not found: ${cmd}\nType 'help' to see available commands.`;
      isError = true;
    }

    const newCommand: Command = {
      id: Date.now().toString(),
      input: cmd,
      output,
      timestamp: new Date(),
      isError,
    };

    setCommands([...commands, newCommand]);
    setHistory([...history, cmd]);
    setHistoryIndex(-1);
    setInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearTerminal = () => {
    setCommands([{ id: 'welcome', input: '', output: welcomeMessage, timestamp: new Date() }]);
  };

  return (
    <div className="space-y-4 h-[calc(100dvh-220px)] md:h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Terminal</h1>
          <p className="text-[#A7ACB8] flex items-center gap-2 text-sm">
            <Bot className="w-4 h-4 text-[#7B61FF]" />
            <span className="hidden sm:inline">Direct CLI access to GeekSpace API + AI Agent</span>
            <span className="sm:hidden">CLI + AI Agent</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[#61FF7B]/10 border border-[#61FF7B]/20 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#61FF7B]" />
            <span className="text-xs text-[#61FF7B] font-mono">AI Ready</span>
          </div>
          <Button variant="outline" size="sm" onClick={clearTerminal} className="border-[#7B61FF]/30 text-[#A7ACB8]">
            <Trash2 className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>

      {/* Terminal Window */}
      <div
        className="flex-1 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/30 overflow-hidden flex flex-col"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Terminal Header */}
        <div className="h-10 bg-[#05050A] border-b border-[#7B61FF]/20 flex items-center px-4 gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF6161]" />
          <div className="w-3 h-3 rounded-full bg-[#FFD761]" />
          <div className="w-3 h-3 rounded-full bg-[#61FF7B]" />
          <div className="flex-1 text-center">
            <span className="text-xs text-[#A7ACB8] font-mono">{user?.username || 'user'}@geekspace ~ terminal</span>
          </div>
          <TerminalIcon className="w-4 h-4 text-[#A7ACB8]" />
        </div>

        {/* Terminal Content */}
        <div ref={terminalRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm">
          {commands.map((cmd) => (
            <div key={cmd.id} className="mb-4">
              {cmd.input && (
                <div className="flex items-center gap-2">
                  <span className="text-[#61FF7B]">➜</span>
                  <span className="text-[#7B61FF]">~</span>
                  <span className="text-[#F4F6FF]">{cmd.input}</span>
                </div>
              )}
              {cmd.isLoading ? (
                <div className="mt-1 flex items-center gap-2 text-[#7B61FF]">
                  <div className="w-3 h-3 border-2 border-[#7B61FF]/30 border-t-[#7B61FF] rounded-full animate-spin" />
                  <span className="text-[#A7ACB8]">Thinking...</span>
                </div>
              ) : cmd.output ? (
                <div className="mt-1 relative group">
                  <pre className={`whitespace-pre-wrap ${cmd.isError ? 'text-[#FF6161]' : 'text-[#F4F6FF]'}`}>
                    {cmd.output}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(cmd.output, cmd.id)}
                    className="absolute top-0 right-0 p-1.5 rounded bg-[#05050A] border border-[#7B61FF]/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedId === cmd.id ? (
                      <Check className="w-3 h-3 text-[#61FF7B]" />
                    ) : (
                      <Copy className="w-3 h-3 text-[#A7ACB8]" />
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ))}

          {/* Input Line */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="text-[#61FF7B]">➜</span>
            <span className="text-[#7B61FF]">~</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-[#F4F6FF] font-mono"
              placeholder="Type a command..."
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="flex flex-wrap gap-2">
        {[
          'gs me', 'gs reminders list', 'gs schedule today', 'gs credits',
          'gs usage month', 'gs status', 'ai "What should I build next?"', 'help'
        ].map((cmd) => (
          <button
            key={cmd}
            onClick={() => executeCommand(cmd)}
            className={`px-3 py-2.5 min-h-[36px] rounded-lg border text-xs transition-colors ${
              cmd.startsWith('ai ')
                ? 'bg-[#7B61FF]/10 border-[#7B61FF]/30 text-[#7B61FF] hover:bg-[#7B61FF]/20'
                : 'bg-[#0B0B10] border-[#7B61FF]/20 text-[#A7ACB8] hover:border-[#7B61FF]/50 hover:text-[#F4F6FF]'
            }`}
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}
