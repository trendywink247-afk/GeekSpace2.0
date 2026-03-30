import { Rocket, MessageSquare, Image, ListChecks, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A task card displayed on the GuidedFirstTaskStep screen.
 * @property id - Unique identifier (used as React key).
 * @property label - Short task name shown in the card title.
 * @property description - One-line description shown below the title.
 * @property icon - Lucide icon component rendered in the card icon slot.
 * @property color - Hex color for the icon background tint and icon fill.
 * @property prompt - Optional pre-filled chat prompt sent when the user selects this task.
 * @property route - Dashboard route navigated to on selection (e.g. '/dashboard/chat').
 */
interface SuggestedTask {
  id: string;
  label: string;
  description: string;
  icon: typeof MessageSquare;
  color: string;
  prompt?: string;
  route: string;
}

const TASKS_BY_USE_CASE: Record<string, SuggestedTask[]> = {
  creative: [
    {
      id: 'generate-image',
      label: 'Generate an image',
      description: 'Try creating artwork with a simple prompt',
      icon: Image,
      color: '#BF5FFF',
      prompt: 'Generate a futuristic cityscape at sunset',
      route: '/dashboard/image-gen',
    },
    {
      id: 'chat-creative',
      label: 'Start a creative chat',
      description: 'Brainstorm ideas with your AI agent',
      icon: MessageSquare,
      color: '#8B5CF6',
      route: '/dashboard/chat',
    },
  ],
  productivity: [
    {
      id: 'create-workflow',
      label: 'Create your first workflow',
      description: 'Automate a repetitive task',
      icon: ListChecks,
      color: '#8B5CF6',
      route: '/dashboard/workflows',
    },
    {
      id: 'set-reminder',
      label: 'Set a reminder',
      description: 'Never forget an important task',
      icon: MessageSquare,
      color: '#F59E0B',
      prompt: 'Remind me to review my tasks tomorrow at 9am',
      route: '/dashboard/chat',
    },
  ],
  communication: [
    {
      id: 'check-inbox',
      label: 'Check your inbox',
      description: 'See what your agent has gathered',
      icon: MessageSquare,
      color: '#00FF88',
      route: '/dashboard/inbox',
    },
  ],
  business: [
    {
      id: 'explore-docs',
      label: 'Create a document',
      description: 'Draft a business document with AI help',
      icon: ListChecks,
      color: '#F59E0B',
      route: '/dashboard/docs',
    },
  ],
  personal: [
    {
      id: 'set-reminder',
      label: 'Set a daily reminder',
      description: 'Build a habit with scheduled nudges',
      icon: MessageSquare,
      color: '#EC4899',
      prompt: 'Remind me to exercise every morning at 7am',
      route: '/dashboard/chat',
    },
  ],
  developer: [
    {
      id: 'open-terminal',
      label: 'Open the terminal',
      description: 'Run commands with AI assistance',
      icon: Terminal,
      color: '#10B981',
      route: '/dashboard/terminal',
    },
    {
      id: 'check-health',
      label: 'Check system health',
      description: 'View your infrastructure status',
      icon: ListChecks,
      color: '#8B5CF6',
      route: '/dashboard/health',
    },
  ],
};

const DEFAULT_TASKS: SuggestedTask[] = [
  {
    id: 'send-message',
    label: 'Send your first message',
    description: 'Say hello to your AI agent and see what it can do',
    icon: MessageSquare,
    color: '#8B5CF6',
    prompt: 'Hey! What can you help me with?',
    route: '/dashboard/chat',
  },
];

interface GuidedFirstTaskStepProps {
  /** Use-case ID selected in the previous step (e.g. 'creative', 'developer'). */
  useCase: string;
  /** Called with the destination route when the user clicks a task card. */
  onSelectTask: (route: string) => void;
  /** Called when the user clicks "Take me to my dashboard" to skip task selection. */
  onSkipToDashboard: () => void;
  /** When true, shows a spinner on the primary button (async navigation in progress). */
  isLaunching: boolean;
}

/**
 * Final onboarding step that suggests 1–3 starter tasks based on the user's chosen use-case.
 * Always includes a "Send your first message" fallback task regardless of use-case.
 * @component
 */
export function GuidedFirstTaskStep({ useCase, onSelectTask, onSkipToDashboard, isLaunching }: GuidedFirstTaskStepProps) {
  const tasks = TASKS_BY_USE_CASE[useCase] ?? DEFAULT_TASKS;
  // Always include the default "send message" task if not already present
  const allTasks = tasks.some((t) => t.id === 'send-message')
    ? tasks
    : [...tasks, ...DEFAULT_TASKS];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Rocket className="w-6 h-6 text-[#8B5CF6]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
          You're all set!
        </h2>
      </div>
      <p className="text-[#6B7280] text-sm">
        Your AI space is ready. Pick a first task to try, or head straight to your dashboard.
      </p>

      <div className="space-y-3">
        {allTasks.map((task) => {
          const Icon = task.icon;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task.route)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-[#8B5CF6]/20 bg-[#06060B] hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/5 transition-all text-left focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${task.color}15` }}
              >
                <Icon className="w-5 h-5" style={{ color: task.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#E8E8F0]">{task.label}</div>
                <div className="text-xs text-[#6B7280] mt-0.5">{task.description}</div>
              </div>
              <svg className="w-4 h-4 text-[#6B7280] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Ready confirmation */}
      <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-[#E8E8F0]">
            You can change all your settings later from the dashboard.
          </p>
        </div>
      </div>

      <Button
        onClick={onSkipToDashboard}
        disabled={isLaunching}
        className="w-full h-12 min-h-[44px] bg-[#8B5CF6] hover:bg-[#7C3AED] text-base font-semibold"
      >
        {isLaunching ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Rocket className="w-5 h-5 mr-2" />
            Take me to my dashboard
          </>
        )}
      </Button>
    </div>
  );
}
