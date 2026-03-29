import { Rocket, Check } from 'lucide-react';
import type { OnboardingState } from '@/types';

interface ReviewStepProps {
  onboarding: OnboardingState;
  onLaunch: () => void;
  isLaunching: boolean;
}

export function ReviewStep({ onboarding, onLaunch, isLaunching }: ReviewStepProps) {
  const { profile, agentPreferences, portfolio, integrations } = onboarding;

  const sections = [
    {
      label: 'Profile',
      items: [
        { key: 'Name', value: profile.name || '--' },
        { key: 'Username', value: profile.username ? `${profile.username}.agentin.chat` : '--' },
      ],
    },
    {
      label: 'Bio & Headline',
      items: [
        { key: 'Headline', value: profile.headline || '--' },
        { key: 'Bio', value: profile.bio ? (profile.bio.length > 60 ? profile.bio.slice(0, 60) + '...' : profile.bio) : '--' },
        { key: 'Tags', value: profile.tags.length ? profile.tags.join(', ') : '--' },
      ],
    },
    {
      label: 'Agent',
      items: [
        { key: 'Personality', value: agentPreferences.personality.charAt(0).toUpperCase() + agentPreferences.personality.slice(1) },
        { key: 'Mode', value: agentPreferences.agentMode.charAt(0).toUpperCase() + agentPreferences.agentMode.slice(1) },
      ],
    },
    {
      label: 'Portfolio',
      items: [
        { key: 'Skills', value: portfolio.skills.length ? portfolio.skills.join(', ') : 'Not set yet' },
        { key: 'Headline', value: portfolio.headline || 'Not set yet' },
      ],
    },
    {
      label: 'Integrations',
      items: [
        { key: 'Connected', value: integrations.length ? integrations.join(', ') : 'None yet' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="gs-icon-pill gs-icon-pill-violet">
          <Rocket className="w-5 h-5" />
        </div>
        <div>
          <p className="gs-section-label">Final Step</p>
          <h2 className="text-xl font-semibold font-heading text-[var(--ag-text-primary,#F4F6FF)]">
            Review & Launch
          </h2>
        </div>
      </div>
      <p className="text-[var(--ag-text-muted,#9CA3AF)] text-sm">
        Everything looks good! Here's a summary of your setup.
      </p>

      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.label} className="gs-card p-4">
            <p className="gs-section-label mb-2">{section.label}</p>
            <div className="space-y-1.5">
              {section.items.map((item) => (
                <div key={item.key} className="flex justify-between text-sm">
                  <span className="text-[var(--ag-text-muted,#9CA3AF)]">{item.key}</span>
                  <span className="text-[var(--ag-text-primary,#F4F6FF)] text-right max-w-[60%] truncate">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="gs-card p-4 border-emerald-500/20 bg-emerald-500/[0.05]">
        <div className="flex items-center gap-3">
          <div className="gs-icon-pill gs-icon-pill-emerald flex-shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-sm text-[var(--ag-text-primary,#F4F6FF)]">
            You can update any of these settings later from your dashboard.
          </p>
        </div>
      </div>

      <button
        onClick={onLaunch}
        disabled={isLaunching}
        className="gs-btn-primary w-full h-12 min-h-[44px] text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {isLaunching ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Rocket className="w-5 h-5" />
            Launch My Space
          </>
        )}
      </button>
    </div>
  );
}
