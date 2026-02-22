import { Rocket, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="flex items-center gap-3 mb-6">
        <Rocket className="w-6 h-6 text-[#00FFD4]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
          Review & Launch
        </h2>
      </div>
      <p className="text-[#6B7280] text-sm">
        Everything looks good! Here's a summary of your setup.
      </p>

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.label} className="p-4 rounded-xl bg-[#030304] border border-[#00FFD4]/20">
            <h3 className="text-sm font-medium text-[#00FFD4] mb-2">{section.label}</h3>
            <div className="space-y-1">
              {section.items.map((item) => (
                <div key={item.key} className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">{item.key}</span>
                  <span className="text-[#E8E8F0] text-right max-w-[60%] truncate">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-[#00FF88]/10 border border-[#00FF88]/30">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-[#00FF88]" />
          <p className="text-sm text-[#E8E8F0]">
            You can update any of these settings later from your dashboard.
          </p>
        </div>
      </div>

      <Button
        onClick={onLaunch}
        disabled={isLaunching}
        className="w-full h-12 min-h-[44px] bg-[#00FFD4] hover:bg-[#00D4B0] text-base font-semibold pulse-glow"
      >
        {isLaunching ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Rocket className="w-5 h-5 mr-2" />
            Launch My Space
          </>
        )}
      </Button>
    </div>
  );
}
