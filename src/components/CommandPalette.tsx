// ============================================================
// Command Palette - Unified Ctrl+K command + data search interface
// Raycast-inspired: commands + live data search in one modal
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
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
  MessageSquare,
  CalendarCheck,
  Inbox,
  Mic,
  BookOpen,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import type { SearchResult } from '@/components/GlobalSearch';

const RECENT_SEARCHES_KEY = 'agentin_recent_searches';
const MAX_RECENT_SEARCHES = 10;

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
  note:         <FileText      className="w-4 h-4 text-[#00F0FF]" />,
  reminder:     <Bell          className="w-4 h-4 text-[#FFB800]" />,
  habit:        <Target        className="w-4 h-4 text-[#00FF88]" />,
  memory:       <Brain         className="w-4 h-4 text-[#BF5FFF]" />,
  conversation: <MessageSquare className="w-4 h-4 text-[#8B5CF6]" />,
};

const DATA_TYPE_LABELS: Record<string, string> = {
  note:         'Note',
  reminder:     'Reminder',
  habit:        'Habit',
  memory:       'Memory',
  conversation: 'Conversation',
};

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): void {
  try {
    const existing = getRecentSearches().filter(s => s !== query);
    const updated = [query, ...existing].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be full or unavailable
  }
}

// Group search results by type
function groupResultsByType(results: SearchResult[]): Record<string, SearchResult[]> {
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    const key = r.type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  return grouped;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [tab, setTab]           = useState<PaletteTab>('commands');
  const [search, setSearch]     = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const itemRefs  = useRef<(HTMLButtonElement | HTMLDivElement | null)[]>([]);

  // --- Data search state ---
  const [dataResults, setDataResults]     = useState<SearchResult[]>([]);
  const [dataLoading, setDataLoading]     = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

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
      id: 'chat',
      title: 'Chat with Agent',
      subtitle: 'Start a conversation',
      icon: <Bot className="w-4 h-4" />,
      shortcut: 'G C',
      action: () => { navigate('/dashboard/chat'); onClose(); },
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
      id: 'terminal',
      title: 'Open Terminal',
      subtitle: 'Command line interface',
      icon: <Terminal className="w-4 h-4" />,
      shortcut: 'G T',
      action: () => { navigate('/dashboard/terminal'); onClose(); },
      category: 'Navigation',
    },
    {
      id: 'inbox',
      title: 'Inbox',
      subtitle: 'Messages and notifications',
      icon: <Inbox className="w-4 h-4" />,
      action: () => { navigate('/dashboard/inbox'); onClose(); },
      category: 'Navigation',
    },
    {
      id: 'calendar',
      title: 'Calendar',
      subtitle: 'Schedule and events',
      icon: <CalendarCheck className="w-4 h-4" />,
      action: () => { navigate('/dashboard/calendar'); onClose(); },
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
      action: () => { navigate('/dashboard/image-gen'); onClose(); },
      category: 'Actions',
    },
    {
      id: 'generate-video',
      title: 'Generate Video',
      subtitle: 'Create AI videos',
      icon: <Video className="w-4 h-4" />,
      shortcut: 'N V',
      action: () => { navigate('/dashboard/video-gen'); onClose(); },
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
    {
      id: 'voice',
      title: 'Voice Chat',
      subtitle: 'Talk with your agent',
      icon: <Mic className="w-4 h-4" />,
      action: () => { navigate('/dashboard/chat?voice=1'); onClose(); },
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
      id: 'focus-page',
      title: 'Focus & Habits',
      subtitle: 'Track habits and goals',
      icon: <Target className="w-4 h-4" />,
      action: () => { navigate('/dashboard/focus'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'memory-page',
      title: 'Memory',
      subtitle: 'What your agent remembers',
      icon: <Brain className="w-4 h-4" />,
      action: () => { navigate('/dashboard/personal-memory'); onClose(); },
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
      title: 'Analytics',
      subtitle: 'Usage insights and stats',
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
      id: 'image-gen-page',
      title: 'Image Gallery',
      subtitle: 'AI-generated images',
      icon: <ImageIcon className="w-4 h-4" />,
      action: () => { navigate('/dashboard/gallery'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'docs-page',
      title: 'Documents',
      subtitle: 'Notes and docs workspace',
      icon: <BookOpen className="w-4 h-4" />,
      action: () => { navigate('/dashboard/docs'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'activity-page',
      title: 'Activity',
      subtitle: 'Recent activity log',
      icon: <Activity className="w-4 h-4" />,
      action: () => { navigate('/dashboard/activity'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'planner',
      title: 'Planner',
      subtitle: 'Task orchestration',
      icon: <FileText className="w-4 h-4" />,
      action: () => { navigate('/dashboard/planner'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'ai-specialist',
      title: 'AI Specialists',
      subtitle: 'Browse expert agents',
      icon: <Sparkles className="w-4 h-4" />,
      action: () => { navigate('/dashboard/tools'); onClose(); },
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
      action: () => { navigate('/dashboard/agent'); onClose(); },
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

  // Flatten search results for keyboard navigation
  const groupedData = groupResultsByType(dataResults);
  const dataTypeOrder = ['note', 'reminder', 'habit', 'memory', 'conversation'];
  const flatDataResults = dataTypeOrder
    .filter(t => groupedData[t]?.length)
    .flatMap(t => groupedData[t]);

  // Total navigable items depends on tab
  const totalItems = tab === 'commands' ? flatCommands.length : flatDataResults.length;

  const navigateToResult = useCallback((result: SearchResult) => {
    // Save to recent searches
    if (search.trim().length >= 2) {
      saveRecentSearch(search.trim());
    }
    const url = (result as SearchResult & { url?: string }).url;
    if (url) {
      navigate(url);
    } else {
      // Fallback: navigate by type
      const urlMap: Record<string, string> = {
        note:         '/dashboard/chat',
        reminder:     '/dashboard/reminders',
        habit:        '/dashboard/focus',
        memory:       '/dashboard/personal-memory',
        conversation: '/dashboard/chat',
      };
      navigate(urlMap[result.type] || '/dashboard');
    }
    onClose();
  }, [navigate, onClose, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (totalItems === 0) return;
        const nextIdx = (selectedIndex + 1) % totalItems;
        setSelectedIndex(nextIdx);
        itemRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (totalItems === 0) return;
        const prevIdx = (selectedIndex - 1 + totalItems) % totalItems;
        setSelectedIndex(prevIdx);
        itemRefs.current[prevIdx]?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'Enter':
        e.preventDefault();
        if (tab === 'commands' && flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
        } else if (tab === 'search' && flatDataResults[selectedIndex]) {
          navigateToResult(flatDataResults[selectedIndex]);
        }
        break;
      case 'Tab':
        // Switch tabs with Tab key
        e.preventDefault();
        setTab(prev => prev === 'commands' ? 'search' : 'commands');
        setSelectedIndex(0);
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
      setRecentSearches(getRecentSearches());
      // Delay focus to after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, tab]);

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
        const res   = await fetch(`/api/search?q=${encodeURIComponent(search.trim())}&limit=25`, {
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
    }, 300);
    return () => clearTimeout(timer);
  }, [search, tab]);

  if (!isOpen) return null;

  // Build a global index counter for search results so keyboard nav works across groups
  let searchItemIdx = 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] sm:pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl mx-4 bg-[#0A0A14] border border-[#00F0FF]/20 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
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
            <Command className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
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
            placeholder={tab === 'commands' ? 'Search commands...' : 'Search notes, reminders, habits, memories, conversations...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[#F4F6FF] placeholder-[#6B7280] outline-none text-base"
          />
          <div className="hidden sm:flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] bg-[#06060B] border border-[#1A1A2E] rounded text-[#6B7280]">
              TAB
            </kbd>
            <span className="text-[10px] text-[#4B5563]">switch</span>
          </div>
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs bg-[#06060B] border border-[#1A1A2E] rounded text-[#6B7280]">
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
                  <div className="px-3 py-2 text-xs font-medium text-[#8892A4] uppercase tracking-wider">
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
                            ? 'bg-[#00F0FF]/10 border-l-2 border-[#00F0FF]'
                            : 'hover:bg-[#00F0FF]/5 border-l-2 border-transparent'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'bg-[#06060B] text-[#6B7280]'
                        }`}>
                          {cmd.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <div className={`font-medium ${isSelected ? 'text-[#F4F6FF]' : 'text-[#8892A4]'}`}>
                            {cmd.title}
                          </div>
                          {cmd.subtitle && (
                            <div className="text-xs text-[#6B7280]/70">{cmd.subtitle}</div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <div className="flex items-center gap-1">
                            {cmd.shortcut.split(' ').map((key, i) => (
                              <kbd key={i} className="px-1.5 py-0.5 text-xs bg-[#06060B] border border-[#1A1A2E] rounded text-[#6B7280]">
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
          <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
            {/* Loading skeleton */}
            {dataLoading && (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-[#1A1A2E]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-[#1A1A2E] rounded w-2/3" />
                      <div className="h-2.5 bg-[#1A1A2E] rounded w-1/2" />
                    </div>
                    <div className="h-4 w-12 bg-[#1A1A2E] rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Grouped results */}
            {!dataLoading && dataResults.length > 0 && (
              <div className="p-2">
                {dataTypeOrder
                  .filter(type => groupedData[type]?.length)
                  .map(type => (
                    <div key={type} className="mb-2">
                      <div className="px-3 py-2 text-xs font-medium text-[#8892A4] uppercase tracking-wider flex items-center gap-2">
                        {DATA_TYPE_ICONS[type]}
                        {DATA_TYPE_LABELS[type] ? `${DATA_TYPE_LABELS[type]}s` : type}
                        <span className="text-[#4B5563]">({groupedData[type].length})</span>
                      </div>
                      {groupedData[type].map(r => {
                        const thisIdx = searchItemIdx++;
                        const isSelected = thisIdx === selectedIndex;
                        return (
                          <div
                            key={`${r.type}-${r.id}`}
                            ref={(el) => { itemRefs.current[thisIdx] = el; }}
                            onClick={() => navigateToResult(r)}
                            onMouseEnter={() => setSelectedIndex(thisIdx)}
                            role="option"
                            aria-selected={isSelected}
                            className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-[#00F0FF]/10 border-l-2 border-[#00F0FF]'
                                : 'hover:bg-[#00F0FF]/5 border-l-2 border-transparent'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-[#00F0FF]/20' : 'bg-[#06060B]'
                            }`}>
                              {DATA_TYPE_ICONS[r.type] ?? <Search className="w-4 h-4 text-[#6B7280]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate font-medium ${isSelected ? 'text-[#F4F6FF]' : 'text-[#E8E8F0]'}`}>
                                {r.title}
                              </p>
                              {r.snippet && r.snippet !== r.title && (
                                <p className="text-xs text-[#6B7280] truncate mt-0.5">
                                  {r.snippet.slice(0, 100)}
                                </p>
                              )}
                            </div>
                            {r.created_at && (
                              <span className="text-[10px] text-[#4B5563] flex-shrink-0 hidden sm:inline">
                                {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                {/* Reset counter so it doesn't leak between renders */}
                {(() => { searchItemIdx = 0; return null; })()}
              </div>
            )}

            {/* Empty state after search */}
            {!dataLoading && search.trim().length >= 2 && dataResults.length === 0 && (
              <div className="p-8 text-center text-[#6B7280]">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No results for &ldquo;{search}&rdquo;</p>
                <p className="text-sm mt-2 text-[#4B5563]">Try different keywords or check spelling</p>
              </div>
            )}

            {/* Hint + recent searches before typing */}
            {!dataLoading && search.trim().length < 2 && (
              <div className="p-6">
                <p className="text-sm text-[#4B5563] text-center mb-4">
                  Search notes, reminders, memories, and more...
                </p>
                <div className="flex justify-center gap-4 text-xs text-[#4B5563] mb-5">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-[#00F0FF]" /> Notes</span>
                  <span className="flex items-center gap-1"><Bell className="w-3 h-3 text-[#FFB800]" /> Reminders</span>
                  <span className="flex items-center gap-1"><Target className="w-3 h-3 text-[#00FF88]" /> Habits</span>
                  <span className="flex items-center gap-1"><Brain className="w-3 h-3 text-[#BF5FFF]" /> Memories</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-[#8B5CF6]" /> Chats</span>
                </div>

                {/* Recent searches */}
                {recentSearches.length > 0 && (
                  <div className="border-t border-[#1A1A2E] pt-4">
                    <p className="text-xs text-[#8892A4] uppercase tracking-wider mb-2 px-2">Recent searches</p>
                    <div className="flex flex-wrap gap-2 px-2">
                      {recentSearches.slice(0, 6).map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setSearch(s)}
                          className="px-3 py-1.5 text-xs text-[#8892A4] bg-[#0C0C18] border border-[#1A1A2E] rounded-lg hover:border-[#00F0FF]/30 hover:text-[#E8E8F0] transition-colors"
                        >
                          <Clock className="w-3 h-3 inline-block mr-1.5 -mt-0.5 opacity-50" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                  <kbd className="px-1.5 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">&uarr;&darr;</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">&crarr;</kbd>
                  select
                </span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">
                  {navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+K
                </kbd>
                <span>toggle</span>
              </div>
            </>
          ) : (
            <div className="flex w-full justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">&uarr;&darr;</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">&crarr;</kbd>
                  open
                </span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">ESC</kbd>
                close
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
