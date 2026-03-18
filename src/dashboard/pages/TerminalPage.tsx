import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Terminal as TerminalIcon, Copy, Check, Trash2, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { agentService, reminderService, dashboardService, usageService, memoryService } from '@/services/api';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

const welcomeMessage = `Agentin Terminal v2.0.0
Powered by Agentin AI Engine
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
  ai "prompt"              - Ask the AI agent (streaming)
  /habits                  - Show habits & streaks
  /reminders               - Show upcoming reminders
  /briefing                - Daily briefing & stats
  /memory <query>          - Search your memories
  /note <text>             - Save a quick note via AI
  /stats                   - Show usage stats
  /clear                   - Clear terminal output
  /help                    - Show this help message
  clear                    - Clear terminal
  help                     - Show this help message
`;

// Valid commands for Tab autocomplete
const VALID_COMMANDS = [
  'gs me',
  'gs reminders list',
  'gs reminders add',
  'gs schedule today',
  'gs schedule tomorrow',
  'gs portfolio',
  'gs status',
  'gs credits',
  'gs usage today',
  'gs usage month',
  'gs integrations',
  'gs automations',
  'gs deploy',
  'ai ',
  '/habits',
  '/reminders',
  '/briefing',
  '/memory ',
  '/note ',
  '/stats',
  '/clear',
  '/help',
  'clear',
  'help',
];

interface Command {
  id: string;
  input: string;
  output: string;
  timestamp: Date;
  isError?: boolean;
  isLoading?: boolean;
}

export function TerminalPage() {
  const user = useAuthStore((s) => s.user);
  const { usage, reminders, agent, addReminder } = useDashboardStore();
  const { history: terminalHistory, addCommand, updateLastOutput, clearHistory } = useTerminalStore();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [welcomeShown, setWelcomeShown] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build commands array from store history
  const commands: Command[] = useMemo(() => [
    ...(welcomeShown || terminalHistory.length > 0 ? [] : [{ id: 'welcome', input: '', output: welcomeMessage, timestamp: new Date(), isError: false }]),
    ...terminalHistory.map(cmd => ({
      id: cmd.id,
      input: cmd.type === 'input' ? cmd.command : '',
      output: cmd.output,
      timestamp: new Date(cmd.timestamp),
      isError: cmd.type === 'error',
      isLoading: false,
    })),
  ], [terminalHistory, welcomeShown]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commands]);

  useEffect(() => {
    inputRef.current?.focus();
    // Mark welcome as shown after initial render if we have history
    if (terminalHistory.length > 0) {
      setWelcomeShown(true);
    }
  }, [terminalHistory.length]);

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
URL: https://${user?.username || 'user'}.agentin.chat
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

    'gs usage today': (() => {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      // Estimate today's share by dividing monthly totals by days in the month
      const dailyFactor = 1 / daysInMonth;
      return `Usage Today (est. based on ${dayOfMonth}/${daysInMonth} days):
  Messages: ${Math.floor(usage.totalMessages * dailyFactor)}
  Tokens In: ${Math.floor(usage.totalTokensIn * dailyFactor).toLocaleString()}
  Tokens Out: ${Math.floor(usage.totalTokensOut * dailyFactor).toLocaleString()}
  Cost: $${(usage.totalCostUSD * dailyFactor).toFixed(3)}

By Provider:
${Object.entries(usage.byProvider).map(([k, v]) => `  ${k}: $${((v as number) * dailyFactor).toFixed(3)}`).join('\n') || '  No data'}`;
    })(),

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

    'gs deploy': `Portfolio auto-deploys on save. No manual deploy needed.
View your portfolio: https://${user?.username || 'user'}.agentin.chat

Tip: Edit your portfolio at /dashboard/portfolio
Deploy ID: dep_${Date.now().toString(36)}`,

    'help': helpText,
  });

  // Stream AI response using SSE
  const streamAiResponse = useCallback(async (cmd: string, prompt: string) => {
    addCommand({ command: cmd, output: '[Weebo]: ...', type: 'output' });

    try {
      const response = await agentService.chatStream(prompt, 'terminal');
      if (!response.ok || !response.body) {
        throw new Error(`Stream error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              updateLastOutput(`[Weebo]: ${accumulated}\u258B`);
            }
          } catch {
            /* ignore parse errors for non-JSON SSE lines */
          }
        }
      }

      // Final update — remove cursor block
      if (accumulated) {
        updateLastOutput(`[Weebo]: ${accumulated}`);
      } else {
        updateLastOutput('[Weebo]: (no response)');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach AI agent';
      addCommand({ command: cmd, output: `Error: ${msg}`, type: 'error' });
    }
  }, [addCommand, updateLastOutput]);

  // Execute slash commands that call real API endpoints
  const executeSlashCommand = useCallback(async (cmd: string, trimmedCmd: string): Promise<boolean> => {
    // /clear
    if (trimmedCmd === '/clear') {
      clearHistory();
      setWelcomeShown(false);
      return true;
    }

    // /help
    if (trimmedCmd === '/help') {
      addCommand({ command: cmd, output: helpText, type: 'output' });
      return true;
    }

    // /habits — GET /api/habits
    if (trimmedCmd === '/habits') {
      addCommand({ command: cmd, output: 'Fetching habits...', type: 'output' });
      try {
        const token = localStorage.getItem('gs_token');
        const res = await fetch(`${API_URL}/habits`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const data = await res.json();
        const habits = data.habits as Array<{ name: string; icon?: string; frequency?: string; current_streak?: number }>;
        if (!habits || habits.length === 0) {
          updateLastOutput('No habits found. Create one from the Habits page.');
        } else {
          const header = 'Habit                | Freq     | Streak\n' +
                         '-------------------- | -------- | ------';
          const rows = habits.map(h =>
            `${h.icon || '-'} ${(h.name || '').padEnd(18)}| ${(h.frequency || 'daily').padEnd(9)}| ${h.current_streak ?? 0}`
          );
          updateLastOutput(header + '\n' + rows.join('\n'));
        }
      } catch {
        updateLastOutput('Error: Failed to fetch habits');
      }
      return true;
    }

    // /reminders — GET /api/reminders
    if (trimmedCmd === '/reminders') {
      addCommand({ command: cmd, output: 'Fetching reminders...', type: 'output' });
      try {
        const { data } = await reminderService.list({ status: 'active' });
        const remList = Array.isArray(data) ? data : [];
        if (remList.length === 0) {
          updateLastOutput('No upcoming reminders.');
        } else {
          const header = 'Reminder                     | Due                 | Priority\n' +
                         '---------------------------- | ------------------- | --------';
          const rows = remList.slice(0, 15).map(r => {
            const due = r.datetime ? new Date(r.datetime).toLocaleString() : '—';
            return `${(r.text || '').slice(0, 28).padEnd(29)}| ${due.padEnd(20)}| ${r.priority || 'normal'}`;
          });
          updateLastOutput(header + '\n' + rows.join('\n') + (remList.length > 15 ? `\n... and ${remList.length - 15} more` : ''));
        }
      } catch {
        updateLastOutput('Error: Failed to fetch reminders');
      }
      return true;
    }

    // /briefing — GET /api/dashboard/overview
    if (trimmedCmd === '/briefing') {
      addCommand({ command: cmd, output: 'Loading briefing...', type: 'output' });
      try {
        const { data } = await dashboardService.overview();
        const d = data as { greeting?: string; stats?: Record<string, number>; upcomingReminders?: Array<{ text: string }>; recentActivity?: Array<{ description: string }> };
        let out = d.greeting ? `${d.greeting}\n\n` : 'Good day!\n\n';
        if (d.stats) {
          out += 'Stats:\n';
          for (const [k, v] of Object.entries(d.stats)) {
            out += `  ${k}: ${v}\n`;
          }
        }
        if (d.upcomingReminders && d.upcomingReminders.length > 0) {
          out += '\nUpcoming:\n';
          d.upcomingReminders.slice(0, 5).forEach(r => { out += `  - ${r.text}\n`; });
        }
        if (d.recentActivity && d.recentActivity.length > 0) {
          out += '\nRecent Activity:\n';
          d.recentActivity.slice(0, 5).forEach(a => { out += `  - ${a.description}\n`; });
        }
        updateLastOutput(out.trimEnd());
      } catch {
        updateLastOutput('Error: Failed to load briefing');
      }
      return true;
    }

    // /memory <query> — GET /api/agent/memory?search=<query>
    if (trimmedCmd.startsWith('/memory')) {
      const query = cmd.trim().slice(7).trim();
      if (!query) {
        addCommand({ command: cmd, output: 'Usage: /memory <search query>', type: 'error' });
        return true;
      }
      addCommand({ command: cmd, output: `Searching memories for "${query}"...`, type: 'output' });
      try {
        const { data } = await memoryService.list(undefined, query);
        const memories = Array.isArray(data) ? data : [];
        if (memories.length === 0) {
          updateLastOutput(`No memories found for "${query}".`);
        } else {
          const rows = memories.slice(0, 10).map((m, i) =>
            `  ${i + 1}. [${m.category || 'general'}] ${m.key}: ${m.value}`
          );
          updateLastOutput(`Found ${memories.length} memor${memories.length === 1 ? 'y' : 'ies'}:\n${rows.join('\n')}`);
        }
      } catch {
        updateLastOutput('Error: Failed to search memories');
      }
      return true;
    }

    // /note <text> — POST /api/agent/chat with "save this note: <text>"
    if (trimmedCmd.startsWith('/note')) {
      const noteText = cmd.trim().slice(5).trim();
      if (!noteText) {
        addCommand({ command: cmd, output: 'Usage: /note <text to save>', type: 'error' });
        return true;
      }
      addCommand({ command: cmd, output: 'Saving note...', type: 'output' });
      try {
        await agentService.chat(`save this note: ${noteText}`, 'terminal');
        updateLastOutput(`Note saved: "${noteText}"`);
      } catch {
        updateLastOutput('Error: Failed to save note');
      }
      return true;
    }

    // /stats — GET /api/usage/summary
    if (trimmedCmd === '/stats') {
      addCommand({ command: cmd, output: 'Fetching stats...', type: 'output' });
      try {
        const { data } = await usageService.summary('month');
        const s = data;
        let out = 'Usage Stats (this month):\n';
        out += `  Messages: ${s.totalMessages?.toLocaleString() ?? 0}\n`;
        out += `  Tokens In: ${s.totalTokensIn?.toLocaleString() ?? 0}\n`;
        out += `  Tokens Out: ${s.totalTokensOut?.toLocaleString() ?? 0}\n`;
        out += `  Tool Calls: ${s.totalToolCalls ?? 0}\n`;
        out += `  Cost: $${s.totalCostUSD?.toFixed(2) ?? '0.00'}\n`;
        out += `  Forecast: $${s.forecastUSD?.toFixed(2) ?? '0.00'}`;
        if (s.byProvider && Object.keys(s.byProvider).length > 0) {
          out += '\n\nBy Provider:\n';
          for (const [k, v] of Object.entries(s.byProvider)) {
            out += `  ${k}: $${(v as number).toFixed(2)}\n`;
          }
        }
        updateLastOutput(out.trimEnd());
      } catch {
        updateLastOutput('Error: Failed to fetch stats');
      }
      return true;
    }

    return false;
  }, [addCommand, updateLastOutput, clearHistory]);

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();

    if (trimmedCmd === 'clear' || trimmedCmd === '/clear') {
      clearHistory();
      setWelcomeShown(false);
      setHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);
      setInput('');
      return;
    }

    if (trimmedCmd === '') {
      setInput('');
      return;
    }

    // Slash commands -- async API calls
    if (trimmedCmd.startsWith('/')) {
      setHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);
      setInput('');
      executeSlashCommand(cmd, trimmedCmd);
      return;
    }

    const responses = getResponses();

    // Handle AI prompts -- streaming via SSE
    if (trimmedCmd.startsWith('ai ')) {
      const prompt = cmd.trim().slice(3).replace(/^["']|["']$/g, '');
      addCommand({ command: cmd, output: '', type: 'input' });
      setHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);
      setInput('');
      streamAiResponse(cmd, prompt);
      return;
    }

    // Handle gs reminders add -- call real store
    if (trimmedCmd.startsWith('gs reminders add')) {
      const text = cmd.match(/"([^"]+)"/)?.[1] || 'New reminder';
      const datetime = new Date(Date.now() + 3600000).toISOString();
      addCommand({ command: cmd, output: 'Adding reminder...', type: 'input' });
      setHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);
      setInput('');

      addReminder({
        text,
        datetime,
        channel: 'push',
        category: 'other',
      }).then(() => {
        addCommand({
          command: cmd,
          output: `Reminder added!\n  Text: "${text}"\n  Channel: push\n  Due: ${new Date(datetime).toLocaleString()}`,
          type: 'output'
        });
      });
      return;
    }

    let output = '';
    let isError = false;

    if (responses[trimmedCmd]) {
      const resp = responses[trimmedCmd];
      output = typeof resp === 'function' ? resp() : resp;
    } else {
      output = `Command not found: ${cmd}\nType 'help' or '/help' to see available commands.`;
      isError = true;
    }

    addCommand({ command: cmd, output, type: isError ? 'error' : 'output' });
    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      const trimmed = input.toLowerCase();
      if (trimmed.length === 0) return;

      // If suggestions are visible, cycle through them
      if (autocompleteSuggestions.length > 0) {
        const nextIdx = (autocompleteIndex + 1) % autocompleteSuggestions.length;
        setAutocompleteIndex(nextIdx);
        setInput(autocompleteSuggestions[nextIdx]);
        return;
      }

      // Find matching commands
      const matches = VALID_COMMANDS.filter((cmd) => cmd.startsWith(trimmed) && cmd !== trimmed);
      if (matches.length === 1) {
        // Single match: complete it
        setInput(matches[0]);
        setAutocompleteSuggestions([]);
      } else if (matches.length > 1) {
        // Multiple matches: show suggestions
        setAutocompleteSuggestions(matches);
        setAutocompleteIndex(0);
        setInput(matches[0]);
      }
      return;
    }

    // Clear suggestions on any other key
    if (autocompleteSuggestions.length > 0 && e.key !== 'Shift') {
      setAutocompleteSuggestions([]);
      setAutocompleteIndex(0);
    }

    // ArrowUp: navigate history backwards
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    // ArrowDown: navigate history forwards
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
    clearHistory();
    setWelcomeShown(false);
  };

  return (
    <div className="space-y-6 h-[calc(100dvh-220px)] md:h-[calc(100vh-140px)] flex flex-col pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Terminal</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#8B5CF6]">Powered by Edith</span>
          </div>
          <p className="text-[#9CA3AF] flex items-center gap-2 text-sm">
            <Bot className="w-4 h-4 text-[#00F0FF]" />
            <span className="hidden md:inline">Direct CLI access to Agentin API + AI Agent</span>
            <span className="md:hidden">CLI + AI Agent</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/20 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#00FF88]" />
            <span className="text-xs text-[#00FF88] font-mono">AI Ready</span>
          </div>
          <Button variant="outline" size="sm" onClick={clearTerminal} className="border-[#00F0FF]/30 text-[#9CA3AF] min-h-[44px]" aria-label="Clear terminal">
            <Trash2 className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Clear</span>
          </Button>
        </div>
      </div>

      {/* Terminal Window */}
      <div
        className="flex-1 rounded-2xl glass-card-v2 border border-[#00F0FF]/30 overflow-hidden flex flex-col"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Terminal Header */}
        <div className="h-10 bg-[#06060B] border-b border-[#00F0FF]/20 flex items-center px-4 gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF6161]" />
          <div className="w-3 h-3 rounded-full bg-[#FFB800]" />
          <div className="w-3 h-3 rounded-full bg-[#00FF88]" />
          <div className="flex-1 text-center">
            <span className="text-xs text-[#9CA3AF] font-mono">{user?.username || 'user'}@agentin ~ terminal</span>
          </div>
          <TerminalIcon className="w-4 h-4 text-[#9CA3AF]" />
        </div>

        {/* Terminal Content */}
        <div ref={terminalRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-[#06060B]">
          {commands.map((cmd) => (
            <div key={cmd.id} className="mb-4">
              {cmd.input && (
                <div className="flex items-center gap-2">
                  <span className="text-[#00FF88]">➜</span>
                  <span className="text-[#00F0FF]">~</span>
                  <span className="text-[#E8E8F0]">{cmd.input}</span>
                </div>
              )}
              {cmd.isLoading ? (
                <div className="mt-1 flex items-center gap-2 text-[#00F0FF]">
                  <div className="w-3 h-3 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin" />
                  <span className="text-[#9CA3AF]">Thinking...</span>
                </div>
              ) : cmd.output ? (
                <div className="mt-1 relative group">
                  <pre className={`whitespace-pre-wrap ${cmd.isError ? 'text-[#FF6161]' : 'text-[#00FF88]/90'}`}>
                    {cmd.output}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(cmd.output, cmd.id)}
                    className="absolute top-0 right-0 p-1.5 rounded bg-[#06060B] border border-[#00F0FF]/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Copy output"
                  >
                    {copiedId === cmd.id ? (
                      <Check className="w-3 h-3 text-[#00FF88]" />
                    ) : (
                      <Copy className="w-3 h-3 text-[#9CA3AF]" />
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ))}

          {/* Input Line */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="text-[#00FF88]">➜</span>
            <span className="text-[#00F0FF]">~</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setAutocompleteSuggestions([]); }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-[#E8E8F0] font-mono"
              placeholder="Type a command or ask Jarvis for help..."
              autoComplete="off"
              spellCheck={false}
            />
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-[10px] text-[#00F0FF] font-mono whitespace-nowrap select-none">
              <Bot className="w-3 h-3" />
              AI Help
            </span>
          </form>

          {/* Tab autocomplete suggestions */}
          {autocompleteSuggestions.length > 1 && (
            <div className="mt-1 ml-6 flex flex-wrap gap-1.5">
              {autocompleteSuggestions.map((s, i) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); setAutocompleteSuggestions([]); inputRef.current?.focus(); }}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                    i === autocompleteIndex
                      ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40'
                      : 'text-[#9CA3AF] hover:text-[#E8E8F0] border border-transparent'
                  }`}
                >
                  {s}
                </button>
              ))}
              <span className="text-[10px] text-[#9CA3AF]/50 self-center ml-1">Tab to cycle</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Commands */}
      <div className="flex flex-wrap gap-2 items-center">
        {[
          'gs me', '/briefing', '/habits', '/reminders', '/stats',
          'ai "What should I build next?"', '/help'
        ].map((cmd) => (
          <button
            key={cmd}
            onClick={() => executeCommand(cmd)}
            className={`px-3 py-2.5 min-h-[44px] rounded-lg border text-xs transition-colors ${
              cmd.startsWith('ai ') || cmd.startsWith('/')
                ? 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF] hover:bg-[#00F0FF]/20'
                : 'bg-[#0C0C18] border-[#00F0FF]/20 text-[#9CA3AF] hover:border-[#00F0FF]/50 hover:text-[#E8E8F0]'
            }`}
          >
            {cmd}
          </button>
        ))}
        <span className="text-[10px] text-[#9CA3AF]/50 ml-auto hidden sm:inline">
          <kbd className="px-1 py-0.5 rounded bg-[#1A1A2E] border border-[#00F0FF]/15 text-[#00F0FF] font-mono">Tab</kbd> autocomplete
          <span className="mx-1.5">|</span>
          <kbd className="px-1 py-0.5 rounded bg-[#1A1A2E] border border-[#00F0FF]/15 text-[#00F0FF] font-mono">&uarr;&darr;</kbd> history
        </span>
      </div>
    </div>
  );
}
