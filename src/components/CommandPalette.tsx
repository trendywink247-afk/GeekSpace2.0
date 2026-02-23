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
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

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

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
      id: 'artifacts',
      title: 'Artifacts',
      subtitle: 'Generated code projects',
      icon: <Code className="w-4 h-4" />,
      action: () => { navigate('/dashboard/artifacts'); onClose(); },
      category: 'Pages',
    },
    {
      id: 'templates',
      title: 'Templates',
      subtitle: 'Browse templates',
      icon: <FileText className="w-4 h-4" />,
      action: () => { navigate('/dashboard/templates'); onClose(); },
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
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flatCommands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatCommands.length) % flatCommands.length);
        break;
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
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl mx-4 glass-card-v2 border border-[#00F0FF]/20 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[#00F0FF]/10">
          <Search className="w-5 h-5 text-[#6B7280]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[#E8E8F0] placeholder-[#6B7280] outline-none text-base"
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs bg-[#06060B] rounded text-[#6B7280]">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
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

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#00F0FF]/10 text-xs text-[#6B7280]">
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
