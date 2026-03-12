// ============================================================
// Command Palette - Searchable command interface (Ctrl+K)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Home,
  Settings,
  FileText,
  Terminal,
  Image as ImageIcon,
  Video,
  Zap,
  Bell,
  User,
  CreditCard,
  BarChart3,
  Bot,
  Layout,
  Code,
  Mail,
  LogOut,
  Command,
  Sparkles,
  Clock,
  Target,
  Brain,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import type { SearchResult } from '@/components/GlobalSearch';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaletteTab = 'commands' | 'search';

const DATA_TYPE_ICONS: Record<string, React.ReactNode> = {
  note:     <FileText className="w-4 h-4 text-[#00F0FF]" />,
  reminder: <Bell     className="w-4 h-4 text-[#FFB800]" />,
  habit:    <Target   className="w-4 h-4 text-[#00FF88]" />,
  memory:   <Brain    className="w-4 h-4 text-[#BF5FFF]" />,
};

const DATA_TYPE_LABELS: Record<string, string> = {
  note:     'Note',
  reminder: 'Reminder',
  habit:    'Habit',
  memory:   'Memory',
};

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [tab, setTab]           = useState<PaletteTab>('commands');
  const [search, setSearch]     = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const itemRefs  = useRef<(HTMLButtonElement | null)[]>([]);

  // --- Data search state ---
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'home',
      title: 'Go to Dashboard',
      subtitle: 'Overview and stats',
      icon: <Home className="w-4 h-4" />,
      shortcut: 'G D',
      action: () => { navigate('/dashboard'); onClose(); },
      category: 'Navigation',
    },
    {
      id: 'portfolio',
      title: 'Edit Portfolio',
      subtitle: 'Manage your public profile',
      icon: <Layout className="w-4 h-4" />,
      shortcut: 'G P',
      action: () => { navigate('/dashboard/portfolio'); onClose(); },
      category: 'Navigation',
    },
    {
      id: 'agent',
      title: 'Chat with Agent',
      subtitle: 'Start a conversation',
      icon: <Bot className="w-4 h-4" />,
      shortcut: 'G A',
      action: () => { navigate('/dashboard/agent'); onClose(); },
      category: 'Navigation',
    },
    {
      id: 'terminal',
      title: 'Open Terminal',
      subtitle: 'Command line interface',
      icon: <Terminal className="w-4 h-4" />,
      shortcut: 'G T',
      action: () => { navigate('/dashboard/terminal'); onClose(); },
      category: 'Navigation',
    },

    // Actions
    {
      id: 'reminder',
      title: 'Add Reminder',
      subtitle: 'Create a new reminder',
      icon: <Clock className="w-4 h-4" />,
      shortcut: 'N R',
      action: () => { navigate('/dashboard/reminders?action=create'); onClose(); },
      category: 'Actions',
    },
    {
      id: 'generate-image',
      title: 'Generate Image',
      subtitle: 'Create AI images',
      icon: <ImageIcon className="w-4 h-4" />,
      shortcut: 'N I',
      action: () => { navigate('/dashboard/agent?tool=image'); onClose(); },
      category: 'Actions',
    },
    {
      id: 'generate-video',
      title: 'Generate Video',
      subtitle: 'Create AI videos',
      icon: <Video className="w-4 h-4" />,
      shortcut: 'N V',
      action: () => { navigate('/dashboard/agent?tool=video'); onClose(); },
      category: 'Actions',
    },
    {
      id: 'automation',
      title: 'New Automation',
      subtitle: 'Create a workflow',
      icon: <Zap className="w-4 h-4" />,
      shortcut: 'N A',
      action: () => { navigate('/dashboard/automations?action=create'); onClose(); },
      category: 'Actions',
    },

    // Pages
    {
      id: 'reminders-page',
      title: 'Reminders',
      subtitle: 'View all reminders',
      icon: <Bell className="w-4 h-4" />,
      action: () => { navigate('/dashboard/reminders'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'connections',
      title: 'Connections',
      subtitle: 'Manage integrations',
      icon: <Mail className="w-4 h-4" />,
      action: () => { navigate('/dashboard/connections'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'analytics',
      title: 'Usage Analytics',
      subtitle: 'View statistics',
      icon: <BarChart3 className="w-4 h-4" />,
      action: () => { navigate('/dashboard/analytics'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'billing',
      title: 'Billing',
      subtitle: 'Manage subscription',
      icon: <CreditCard className="w-4 h-4" />,
      action: () => { navigate('/dashboard/billing'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'website-builder',
      title: 'Website Builder',
      subtitle: 'Projects and templates',
      icon: <Code className="w-4 h-4" />,
      action: () => { navigate('/dashboard/website-builder'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'image-gen',
      title: 'Image Generator',
      subtitle: 'Create AI images',
      icon: <ImageIcon className="w-4 h-4" />,
      action: () => { navigate('/dashboard/image-gen'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'video-gen',
      title: 'Video Generator',
      subtitle: 'Create AI videos',
      icon: <Video className="w-4 h-4" />,
      action: () => { navigate('/dashboard/video-gen'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'planner',
      title: 'Planner',
      subtitle: 'Weebo task orchestration',
      icon: <FileText className="w-4 h-4" />,
      action: () => { navigate('/dashboard/planner'); onClose(); },
      category: 'Pages',
    },

    // Settings
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'App preferences',
      icon: <Settings className="w-4 h-4" />,
      shortcut: 'G S',
      action: () => { navigate('/dashboard/settings'); onClose(); },
      category: 'Settings',
    },
    {
      id: 'agent-settings',
      title: 'Agent Settings',
      subtitle: 'Configure your AI',
      icon: <Sparkles className="w-4 h-4" />,
      action: () => { navigate('/dashboard/agent-settings'); onClose(); },
      category: 'Settings',
    },
    {
      id: 'profile',
      title: 'Profile',
      subtitle: 'Edit your profile',
      icon: <User className="w-4 h-4" />,
      action: () => { navigate('/dashboard/settings?tab=profile'); onClose(); },
      category: 'Settings',
    },
    {
      id: 'logout',
      title: 'Logout',
      subtitle: 'Sign out of your account',
      icon: <LogOut className="w-4 h-4" />,
      action: () => { logout(); onClose(); },
      category: 'Settings',
    },
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(search.toLowerCase()) ||
      cmd.subtitle?.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const flatCommands = Object.values(groupedCommands).flat();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIdx = (selectedIndex + 1) % flatCommands.length;
        setSelectedIndex(nextIdx);
        itemRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIdx = (selectedIndex - 1 + flatCommands.length) % flatCommands.length;
        setSelectedIndex(prevIdx);
        itemRefs.current[prevIdx]?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setDataResults([]);
      setTab('commands');
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Debounced data search when on 'search' tab
  useEffect(() => {
    if (tab !== 'search' || search.trim().length < 2) {
      if (tab === 'search') setDataResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setDataLoading(true);
      try {
        const token = localStorage.getItem('gs_token') ?? '';
        const res   = await fetch(`/api/search?q=${encodeURIComponent(search.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { results: SearchResult[] };
        setDataResults(data.results ?? []);
      } catch {
        setDataResults([]);
      } finally {
        setDataLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, tab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl mx-4 glass-card-v2 border border-[#00F0FF]/20 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Tab strip */}
        <div className="flex border-b border-[#00F0FF]/10">
          <button
            onClick={() => { setTab('commands'); setSearch(''); }}
            className={`flex-1 py-2.5 text-xs font-medium tracking-wide transition-colors ${
              tab === 'commands'
                ? 'text-[#00F0FF] border-b-2 border-[#00F0FF]'
                : 'text-[#6B7280] hover:text-[#E8E8F0]'
            }`}
          >
            Commands
          </button>
          <button
            onClick={() => { setTab('search'); setSearch(''); setDataResults([]); }}
            className={`flex-1 py-2.5 text-xs font-medium tracking-wide transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'search'
                ? 'text-[#00F0FF] border-b-2 border-[#00F0FF]'
                : 'text-[#6B7280] hover:text-[#E8E8F0]'
            }`}
          >
            <Search className="w-3 h-3" />
            Search Data
          </button>
        </div>

        {/* Header input */}
        <div className="flex items-center gap-3 p-4 border-b border-[#00F0FF]/10">
          <Search className="w-5 h-5 text-[#6B7280]" />
          <input
            ref={inputRef}
            type="text"
            placeholder={tab === 'commands' ? 'Search commands...' : 'Search notes, reminders, habits, memories...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[#E8E8F0] placeholder-[#6B7280] outline-none text-base"
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs bg-[#06060B] rounded text-[#6B7280]">
            ESC
          </kbd>
        </div>

        {/* Commands tab body */}
        {tab === 'commands' && (
          <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
            {flatCommands.length === 0 ? (
              <div className="p-8 text-center text-[#6B7280]">
                <Command className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No commands found</p>
                <p className="text-sm mt-1">Try a different search</p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category} className="mb-2">
                  <div className="px-3 py-2 text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    {category}
                  </div>
                  {items.map((cmd) => {
                    const globalIdx = flatCommands.findIndex((c) => c.id === cmd.id);
                    const isSelected = globalIdx === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        ref={(el) => { itemRefs.current[globalIdx] = el; }}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-[#00F0FF]/20 border border-[#00F0FF]/30'
                            : 'hover:bg-[#00F0FF]/10'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-[#00F0FF]/30 text-[#00F0FF]' : 'bg-[#06060B] text-[#6B7280]'
                        }`}>
                          {cmd.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <div className={`font-medium ${isSelected ? 'text-[#E8E8F0]' : 'text-[#6B7280]'}`}>
                            {cmd.title}
                          </div>
                          {cmd.subtitle && (
                            <div className="text-xs text-[#6B7280]/70">{cmd.subtitle}</div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <div className="flex items-center gap-1">
                            {cmd.shortcut.split(' ').map((key, i) => (
                              <kbd key={i} className="px-1.5 py-0.5 text-xs bg-[#06060B] rounded text-[#6B7280]">
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* Search Data tab body */}
        {tab === 'search' && (
          <div className="max-h-[55vh] overflow-y-auto">
            {dataLoading && (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!dataLoading && dataResults.length > 0 && (
              <div className="divide-y divide-[#1A1A2E] p-2">
                {dataResults.map(r => (
                  <div
                    key={`${r.type}-${r.id}`}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-[#00F0FF]/10 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#06060B] flex items-center justify-center flex-shrink-0">
                      {DATA_TYPE_ICONS[r.type] ?? <Search className="w-4 h-4 text-[#6B7280]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#E8E8F0] truncate font-medium">{r.title}</p>
                      {r.snippet && r.snippet !== r.title && (
                        <p className="text-xs text-[#6B7280] truncate mt-0.5">
                          {r.snippet.slice(0, 80)}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[#4B5563] uppercase tracking-wide flex-shrink-0 border border-[#2A2A3A] px-1.5 py-0.5 rounded">
                      {DATA_TYPE_LABELS[r.type] ?? r.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!dataLoading && search.trim().length >= 2 && dataResults.length === 0 && (
              <div className="p-8 text-center text-[#6B7280]">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No results for &ldquo;{search}&rdquo;</p>
              </div>
            )}
            {!dataLoading && search.trim().length < 2 && (
              <div className="p-6 text-center">
                <p className="text-sm text-[#4B5563]">Type 2+ characters to search across all your data</p>
                <div className="flex justify-center gap-4 mt-4 text-xs text-[#4B5563]">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-[#00F0FF]" /> Notes</span>
                  <span className="flex items-center gap-1"><Bell className="w-3 h-3 text-[#FFB800]" /> Reminders</span>
                  <span className="flex items-center gap-1"><Target className="w-3 h-3 text-[#00FF88]" /> Habits</span>
                  <span className="flex items-center gap-1"><Brain className="w-3 h-3 text-[#BF5FFF]" /> Memories</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#00F0FF]/10 text-xs text-[#6B7280]">
          {tab === 'commands' ? (
            <>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#06060B] rounded">↑↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#06060B] rounded">↵</kbd>
                  to select
                </span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#06060B] rounded">ESC</kbd>
                to close
              </div>
            </>
          ) : (
            <div className="flex w-full justify-between">
              <span>Live search across all data sources</span>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#06060B] rounded">ESC</kbd>
                to close
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to manage command palette state
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
