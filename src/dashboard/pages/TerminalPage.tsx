import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Copy, Check, Trash2, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';

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
  const { usage, reminders, agent } = useDashboardStore();
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
    'gs me': `Name: ${user?.name || 'Alex Chen'}
Username: ${user?.username || 'alex'}
Email: ${user?.email || 'alex@example.com'}
Plan: ${user?.plan || 'Pro'} ($50/year)
Credits: 12,450
Agent: ${agent.name} (${agent.mode} mode)
Joined: ${user?.createdAt?.slice(0, 10) || '2026-01-15'}`,

    'gs reminders list': () => {
      const active = reminders.filter((r) => !r.completed);
      if (active.length === 0) return 'No active reminders. Use "gs reminders add" to create one.';
      const header = 'ID  | Reminder                    | Channel    | Status\n--- | --------------------------- | ---------- | ------';
      const rows = active.map((r) => `${r.id.padEnd(4)}| ${r.text.padEnd(28)}| ${r.channel.padEnd(11)}| ${r.createdBy}`);
      return header + '\n' + rows.join('\n');
    },

    'gs schedule today': `Today's Schedule (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}):

10:00 AM - Team Standup
02:00 PM - Client Meeting
04:00 PM - Code Review

Reminders:
${reminders.filter((r) => !r.completed).slice(0, 3).map((r) => `  - ${r.text} (${r.channel})`).join('\n')}`,

    'gs schedule tomorrow': `Tomorrow's Schedule:

09:00 AM - Product Planning
10:00 AM - Design Review
02:00 PM - Sprint Retrospective
05:00 PM - Submit project report`,

    'gs portfolio': `Opening portfolio...
URL: https://${user?.username || 'alex'}.geekspace.space
Status: Published
Last updated: 2 hours ago`,

    'gs status': `Agent Status: ${agent.status === 'online' ? '\x1b[32mOnline\x1b[0m' : 'Offline'}
Name: ${agent.name}
Mode: ${agent.mode}
Voice: ${agent.voice}
Model: ${agent.primaryModel}
Creativity: ${agent.creativity}%
Uptime: 99.99%
Last Activity: 2 minutes ago`,

    'gs credits': `Credit Balance: 12,450
Monthly Allowance: 15,000
Resets: Mar 1, 2026

Usage this month:
  API calls: ${usage.totalMessages.toLocaleString()}
  Cost: $${usage.totalCostUSD.toFixed(2)}
  Forecast: $${usage.forecastUSD.toFixed(2)}`,

    'gs usage today': `Usage Today:
  Messages: ${Math.floor(usage.totalMessages / 30)}
  Tokens In: ${Math.floor(usage.totalTokensIn / 30).toLocaleString()}
  Tokens Out: ${Math.floor(usage.totalTokensOut / 30).toLocaleString()}
  Cost: $${(usage.totalCostUSD / 30).toFixed(3)}

By Provider:
${Object.entries(usage.byProvider).map(([k, v]) => `  ${k}: $${(v as number / 30).toFixed(3)}`).join('\n')}`,

    'gs usage month': `Monthly Usage Report:
  Total Messages: ${usage.totalMessages.toLocaleString()}
  Tokens In: ${usage.totalTokensIn.toLocaleString()}
  Tokens Out: ${usage.totalTokensOut.toLocaleString()}
  Tool Calls: ${usage.totalToolCalls}
  Total Cost: $${usage.totalCostUSD.toFixed(2)}
  Forecast: $${usage.forecastUSD.toFixed(2)}

By Provider:
${Object.entries(usage.byProvider).map(([k, v]) => `  ${k}: $${(v as number).toFixed(2)}`).join('\n')}

Top Tools:
${Object.entries(usage.byTool).map(([k, v]) => `  ${k}: $${(v as number).toFixed(2)}`).join('\n')}`,

    'gs integrations': `Connected Integrations:
  Telegram     - Connected (webhook active)
  GitHub       - Connected (repo sync)
  Google Cal   - Pending setup

Available:
  Twitter, LinkedIn, Figma, Notion, n8n, ManyChat
  Use "gs connect <service>" to set up`,

    'gs automations': `Active Automations:
  1. Portfolio auto-update (daily)
  2. Morning briefing (weekdays 8am)
  3. GitHub commit summary (on push)

Use "gs automations create" to add new`,

    'gs deploy': `Deploying portfolio changes...
Building... done (2.1s)
Optimizing assets... done
Publishing to CDN... done

Portfolio live at: https://${user?.username || 'alex'}.geekspace.space
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

    // Handle AI prompts
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

      // Simulate AI response
      setTimeout(() => {
        const aiResponses = [
          `Based on my analysis, here's what I think about "${prompt}":\n\nThis is an interesting question. Let me break it down for you. The key factors to consider are context, scalability, and user experience. I'd recommend starting with a prototype and iterating from there.`,
          `Great question! Here's my take on "${prompt}":\n\nI've considered multiple approaches and the most efficient solution would involve leveraging your existing infrastructure. Would you like me to elaborate on any specific aspect?`,
          `Regarding "${prompt}":\n\nI've processed this through the knowledge base. Here are the top insights:\n1. Consider the edge cases first\n2. Optimize for the 80% use case\n3. Keep the architecture simple\n\nWant me to go deeper on any of these?`,
        ];
        const response = aiResponses[Math.floor(Math.random() * aiResponses.length)];
        setCommands((prev) =>
          prev.map((c) =>
            c.id === loadingCmd.id ? { ...c, output: response, isLoading: false } : c
          )
        );
      }, 1500);
      return;
    }

    if (trimmedCmd.startsWith('gs reminders add')) {
      const text = cmd.match(/"([^"]+)"/)?.[1] || 'New reminder';
      output = `Reminder added successfully!\n  ID: ${Date.now().toString().slice(-4)}\n  Text: "${text}"\n  Channel: push`;
    } else if (responses[trimmedCmd]) {
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
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Terminal</h1>
          <p className="text-[#A7ACB8] flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#7B61FF]" />
            Direct CLI access to GeekSpace API + AI Agent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[#61FF7B]/10 border border-[#61FF7B]/20 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#61FF7B]" />
            <span className="text-xs text-[#61FF7B] font-mono">AI Ready</span>
          </div>
          <Button variant="outline" size="sm" onClick={clearTerminal} className="border-[#7B61FF]/30 text-[#A7ACB8]">
            <Trash2 className="w-4 h-4 mr-2" />Clear
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
            <span className="text-xs text-[#A7ACB8] font-mono">{user?.username || 'alex'}@geekspace ~ terminal</span>
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
            className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
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
