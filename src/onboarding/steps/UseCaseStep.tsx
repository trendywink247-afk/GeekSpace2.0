/* eslint-disable react-refresh/only-export-components */
import { Briefcase, Code, Image, Inbox, Timer, Terminal } from 'lucide-react';

/** All valid use-case identifiers a user can select during onboarding. */
type UseCase = 'productivity' | 'creative' | 'communication' | 'business' | 'personal' | 'developer';

/**
 * Configuration for a single use-case option card.
 * @property id - Use-case identifier stored in agent preferences.
 * @property label - Display name shown on the card.
 * @property description - One-line summary of what this use-case covers.
 * @property icon - Lucide icon rendered in the card icon slot.
 * @property color - Hex accent color for the icon and selection ring.
 * @property focusArea - Dashboard area to emphasize when this use-case is active (e.g. 'workflows').
 */
interface UseCaseOption {
  id: UseCase;
  label: string;
  description: string;
  icon: typeof Briefcase;
  color: string;
  focusArea: string;
}

const USE_CASE_OPTIONS: UseCaseOption[] = [
  {
    id: 'productivity',
    label: 'Productivity',
    description: 'Workflows, task management, and automation',
    icon: Timer,
    color: '#00F0FF',
    focusArea: 'workflows',
  },
  {
    id: 'creative',
    label: 'Creative',
    description: 'Image generation, writing, and content',
    icon: Image,
    color: '#BF5FFF',
    focusArea: 'image-gen',
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Inbox management, emails, and messaging',
    icon: Inbox,
    color: '#00FF88',
    focusArea: 'inbox',
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Documents, workflows, and scheduling',
    icon: Briefcase,
    color: '#F59E0B',
    focusArea: 'docs',
  },
  {
    id: 'personal',
    label: 'Personal',
    description: 'Reminders, habits, and daily planning',
    icon: Timer,
    color: '#EC4899',
    focusArea: 'reminders',
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Terminal, health checks, and code tools',
    icon: Terminal,
    color: '#10B981',
    focusArea: 'terminal',
  },
];

interface UseCaseStepProps {
  /** Currently selected use-case ID, or empty string if none chosen yet. */
  selected: string;
  /** Called with the chosen use-case ID when the user clicks a card. */
  onSelect: (useCase: string) => void;
}

/**
 * Onboarding step that lets the user pick their primary use-case for Agentin.
 * Selection is visually highlighted and persisted via `onSelect`.
 * @component
 */
export function UseCaseStep({ selected, onSelect }: UseCaseStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="gs-icon-pill gs-icon-pill-violet">
          <Code className="w-5 h-5" />
        </div>
        <div>
          <p className="gs-section-label">Step 2</p>
          <h2 className="text-xl font-semibold font-heading text-[var(--ag-text-primary,#F4F6FF)]">
            What will you use Agentin for?
          </h2>
        </div>
      </div>
      <p className="text-[var(--ag-text-muted,#9CA3AF)] text-sm">
        Pick your main use case so your AI can tailor suggestions and shortcuts.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {USE_CASE_OPTIONS.map((uc) => {
          const isSelected = selected === uc.id;
          const Icon = uc.icon;
          return (
            <button
              key={uc.id}
              type="button"
              onClick={() => onSelect(uc.id)}
              className={[
                'gs-card flex items-start gap-3 p-4 text-left transition-all',
                'focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50',
                isSelected
                  ? 'border-[#8B5CF6]/60 bg-[#8B5CF6]/[0.08]'
                  : 'hover:border-white/[0.12]',
              ].join(' ')}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${uc.color}15` }}
              >
                <Icon className="w-5 h-5" style={{ color: uc.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--ag-text-primary,#F4F6FF)]">{uc.label}</div>
                <div className="text-xs text-[var(--ag-text-muted,#9CA3AF)] mt-0.5">{uc.description}</div>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-[#8B5CF6] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Maps a use-case ID to the `focus_area` string stored in the agent's config.
 * Defaults to `'workflows'` for unrecognized values.
 * @param useCase - One of the six valid UseCase IDs (or any string).
 * @returns The corresponding focus area slug (e.g. 'image-gen', 'inbox').
 */
export function useCaseToFocusArea(useCase: string): string {
  const match = USE_CASE_OPTIONS.find((uc) => uc.id === useCase);
  return match?.focusArea ?? 'workflows';
}
