import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Command {
  id: string;
  input: string;
  output: string;
  timestamp: Date;
  isError?: boolean;
}

const welcomeMessage = `GeekSpace Terminal v1.0.0
Type 'help' to see available commands.
`;

const helpText = `Available commands:
  gs me                    - Show your profile
  gs reminders list        - List all reminders
  gs reminders add "text" --at "time"  - Add a reminder
  gs schedule today        - Show today's schedule
  gs schedule tomorrow     - Show tomorrow's schedule
  gs portfolio             - Open your public portfolio
  gs status                - Check agent status
  gs credits               - Check credit balance
  clear                    - Clear terminal
  help                     - Show this help message
`;

const mockResponses: Record<string, string> = {
  'gs me': `Name: Alex Chen
Username: alex
Email: alex@example.com
Plan: Pro ($50/year)
Credits: 12,450
Agent Style: Builder
Joined: 2026-01-15`,
  'gs reminders list': `ID  | Reminder                    | When
--- | --------------------------- | ------------------
1   | Call mom                    | Feb 12, 09:00 AM
2   | Submit project report       | Feb 12, 05:00 PM (weekly)
3   | Pay rent                    | Feb 15, 09:00 AM (monthly)`,
  'gs schedule today': `Today's Schedule (Feb 11, 2026):

10:00 AM - Team Standup
02:00 PM - Client Meeting
04:00 PM - Code Review`,
  'gs schedule tomorrow': `Tomorrow's Schedule (Feb 12, 2026):

09:00 AM - Call mom (reminder)
10:00 AM - Product Planning
02:00 PM - Design Review
05:00 PM - Submit project report (reminder)`,
  'gs portfolio': `Opening portfolio... https://alex.geekspace.space`,
  'gs status': `Agent Status: Online
Model: OpenClaw v2.1
Response Time: ~1.2s
Uptime: 99.99%
Last Activity: 2 minutes ago`,
  'gs credits': `Credit Balance: 12,450
Monthly Allowance: 15,000
Resets: Mar 1, 2026

Usage this month:
- API calls: 8,432
- Messages: 1,247
- Reminders: 89`,
  'help': helpText,
};

export function TerminalPage() {
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

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    let output = '';
    let isError = false;

    if (trimmedCmd === 'clear') {
      setCommands([{ id: 'welcome', input: '', output: welcomeMessage, timestamp: new Date() }]);
      return;
    }

    if (trimmedCmd === '') {
      output = '';
    } else if (mockResponses[trimmedCmd]) {
      output = mockResponses[trimmedCmd];
    } else if (trimmedCmd.startsWith('gs reminders add')) {
      output = 'Reminder added successfully! ID: 4';
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
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Terminal
          </h1>
          <p className="text-[#A7ACB8]">
            Direct CLI access to GeekSpace API
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearTerminal}
            className="border-[#7B61FF]/30 text-[#A7ACB8]"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
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
            <span className="text-xs text-[#A7ACB8] font-mono">alex@geekspace ~ terminal</span>
          </div>
          <TerminalIcon className="w-4 h-4 text-[#A7ACB8]" />
        </div>

        {/* Terminal Content */}
        <div 
          ref={terminalRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm"
        >
          {commands.map((cmd) => (
            <div key={cmd.id} className="mb-4">
              {cmd.input && (
                <div className="flex items-center gap-2 text-[#7B61FF]">
                  <span className="text-[#61FF7B]">➜</span>
                  <span className="text-[#7B61FF]">~</span>
                  <span>{cmd.input}</span>
                </div>
              )}
              {cmd.output && (
                <div className="mt-1 relative group">
                  <pre 
                    className={`whitespace-pre-wrap ${cmd.isError ? 'text-[#FF6161]' : 'text-[#F4F6FF]'}`}
                  >
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
              )}
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
        {['gs me', 'gs reminders list', 'gs schedule today', 'gs credits', 'help'].map((cmd) => (
          <button
            key={cmd}
            onClick={() => executeCommand(cmd)}
            className="px-3 py-1.5 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 text-xs text-[#A7ACB8] hover:border-[#7B61FF]/50 hover:text-[#F4F6FF] transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}