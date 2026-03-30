/* eslint-disable react-refresh/only-export-components */
// ============================================================
// Quick Actions Widget - One-click common tasks
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Image as ImageIcon, 
  Video, 
  Mail,
  Terminal, 
  FileText,
  Sparkles,
  Clock,
  Mic,
  Zap,
  Bot,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
  shortcut?: string;
}

interface QuickActionsWidgetProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function QuickActionsWidget({ collapsed = false, onToggleCollapse }: QuickActionsWidgetProps) {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const handleQuickAction = async (actionId: string, action: () => void) => {
    setIsGenerating(actionId);
    try {
      await action();
    } finally {
      setIsGenerating(null);
    }
  };

  const actions: QuickAction[] = [
    {
      id: 'reminder',
      label: 'Add Reminder',
      icon: <Clock className="w-4 h-4" />,
      color: '#FFB800',
      shortcut: 'R',
      onClick: () => navigate('/dashboard/reminders?action=create'),
    },
    {
      id: 'image',
      label: 'Generate Image',
      icon: <ImageIcon className="w-4 h-4" />,
      color: '#FF2D78',
      shortcut: 'I',
      onClick: () => navigate('/dashboard/agent?tool=image'),
    },
    {
      id: 'video',
      label: 'Generate Video',
      icon: <Video className="w-4 h-4" />,
      color: '#8B5CF6',
      shortcut: 'V',
      onClick: () => navigate('/dashboard/agent?tool=video'),
    },
    {
      id: 'terminal',
      label: 'Open Terminal',
      icon: <Terminal className="w-4 h-4" />,
      color: '#00FF88',
      shortcut: 'T',
      onClick: () => navigate('/dashboard/terminal'),
    },
    {
      id: 'portfolio',
      label: 'Edit Portfolio',
      icon: <FileText className="w-4 h-4" />,
      color: '#0088cc',
      shortcut: 'P',
      onClick: () => navigate('/dashboard/portfolio'),
    },
    {
      id: 'automation',
      label: 'New Automation',
      icon: <Zap className="w-4 h-4" />,
      color: '#ff6d5a',
      shortcut: 'A',
      onClick: () => navigate('/dashboard/automations?action=create'),
    },
    {
      id: 'voice',
      label: 'Voice Note',
      icon: <Mic className="w-4 h-4" />,
      color: '#FF3366',
      onClick: () => navigate('/dashboard/agent?input=voice'),
    },
    {
      id: 'email',
      label: 'Send Email',
      icon: <Mail className="w-4 h-4" />,
      color: '#4285f4',
      onClick: () => navigate('/dashboard/agent?tool=email'),
    },
  ];

  const visibleActions = showAll ? actions : actions.slice(0, 4);

  if (collapsed) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={onToggleCollapse}
          className="w-14 h-14 rounded-full bg-[#8B5CF6] hover:bg-[#00D4B0] shadow-lg shadow-[#8B5CF6]/30"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card-v2 border border-[#8B5CF6]/20 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <h3 className="font-semibold text-[#E8E8F0]">Quick Actions</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-[#6B7280] hover:text-[#8B5CF6] transition-colors"
          >
            {showAll ? 'Show Less' : 'Show All'}
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-[#6B7280] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className={`grid gap-2 transition-all duration-300 ${showAll ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {visibleActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleQuickAction(action.id, action.onClick)}
            disabled={isGenerating === action.id}
            className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-[#06060B] border border-[#8B5CF6]/10 hover:border-[#8B5CF6]/40 transition-all min-h-[80px]"
          >
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${action.color}20` }}
            >
              {isGenerating === action.id ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: action.color }} />
              ) : (
                <span style={{ color: action.color }}>{action.icon}</span>
              )}
            </div>
            <span className="text-xs text-[#6B7280] group-hover:text-[#E8E8F0] transition-colors">
              {action.label}
            </span>
            {action.shortcut && (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-[#0C0C18] rounded text-[#6B7280]">
                {action.shortcut}
              </kbd>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[#8B5CF6]/10">
        <button
          onClick={() => navigate('/dashboard/agent')}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] text-sm font-medium transition-colors"
        >
          <Bot className="w-4 h-4" />
          Chat with Agent
        </button>
      </div>
    </div>
  );
}

// Hook for keyboard shortcuts
export function useQuickActionsShortcuts() {
  const navigate = useNavigate();
  
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only trigger if not in an input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'r':
          e.preventDefault();
          navigate('/dashboard/reminders?action=create');
          break;
        case 'i':
          e.preventDefault();
          navigate('/dashboard/agent?tool=image');
          break;
        case 'v':
          e.preventDefault();
          navigate('/dashboard/agent?tool=video');
          break;
        case 't':
          e.preventDefault();
          navigate('/dashboard/terminal');
          break;
        case 'p':
          e.preventDefault();
          navigate('/dashboard/portfolio');
          break;
        case 'a':
          e.preventDefault();
          navigate('/dashboard/automations?action=create');
          break;
      }
    }
  };

  return { handleKeyDown };
}
