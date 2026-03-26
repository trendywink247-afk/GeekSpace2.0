import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentinLogo } from '@/components/AgentinLogo';
import { ArrowRight, ArrowLeft, Check, Loader2, Clock, SkipForward, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { ProfileStep } from './steps/ProfileStep';
import { BioStep } from './steps/BioStep';
import { UseCaseStep } from './steps/UseCaseStep';
import { AgentStep } from './steps/AgentStep';
import { PortfolioStep } from './steps/PortfolioStep';
import { IntegrationsStep } from './steps/IntegrationsStep';
import { FreeTierStep } from './steps/FreeTierStep';
import { GuidedFirstTaskStep } from './steps/GuidedFirstTaskStep';
import type { AgentMode, IntegrationType } from '@/types';

const STEPS = [
  { id: 'profile', name: 'Profile', emoji: '👤', description: 'Who you are' },
  { id: 'bio', name: 'Bio', emoji: '📝', description: 'Tell your story' },
  { id: 'use-case', name: 'Focus', emoji: '🎯', description: 'Your main goal' },
  { id: 'agent', name: 'Agent', emoji: '🤖', description: 'Your AI assistant' },
  { id: 'portfolio', name: 'Portfolio', emoji: '💼', description: 'Show your work' },
  { id: 'integrations', name: 'Connect', emoji: '🔗', description: 'Link your apps' },
  { id: 'plan', name: 'Plan', emoji: '💎', description: 'Choose your tier' },
  { id: 'launch', name: 'Launch', emoji: '🚀', description: 'Ready to go' },
];

// Skip reasons for analytics
const SKIP_REASONS = [
  '\u23F0 In a hurry \u2014 remind me later',
  '\uD83E\uDD14 Not sure what to put',
  '\uD83D\uDD12 Prefer to keep it private',
  '\u23ED\uFE0F Skip all setup',
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { onboarding, updateOnboarding, saveOnboardingStep, completeOnboarding, user, fetchUser, logout } = useAuthStore();
  const [step, setStep] = useState(Math.min(onboarding.step, STEPS.length - 1));
  const [stepAnimClass, setStepAnimClass] = useState('animate-step-slide-in');
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState(2);
  const [agentApiKey, setAgentApiKey] = useState('');

  // Pre-populate profile fields from the auth store user
  useEffect(() => {
    if (user) {
      const updates: Partial<typeof onboarding.profile> = {};
      if (!onboarding.profile.username && user.username) updates.username = user.username;
      if (!onboarding.profile.name && user.name) updates.name = user.name;
      if (Object.keys(updates).length > 0) {
        updateOnboarding({ profile: { ...onboarding.profile, ...updates } });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate estimated remaining time
  useEffect(() => {
    const remainingSteps = STEPS.length - step - 1;
    const timePerStep = 0.5; // minutes
    setEstimatedTime(Math.max(0.5, remainingSteps * timePerStep));
  }, [step]);

  const animateStep = useCallback((next: number) => {
    setStepAnimClass('animate-step-slide-out');
    setTimeout(() => {
      setStep(next);
      setStepAnimClass('animate-step-slide-in');
    }, 200);
  }, []);

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setIsSaving(true);
      try {
        const stepData = getStepData(step);
        await saveOnboardingStep(step + 1, stepData);
        animateStep(step + 1);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSkip = async (skipAll = false) => {
    if (skipAll) {
      // Skip to launch step
      await saveOnboardingStep(STEPS.length - 1, {});
      animateStep(STEPS.length - 1);
    } else {
      // Skip current step only
      await saveOnboardingStep(step + 1, {});
      animateStep(step + 1);
    }
    setShowSkipModal(false);
  };

  const handleBack = () => {
    if (step > 0) animateStep(step - 1);
  };

  const handleLaunch = async (targetRoute?: string) => {
    setIsLaunching(true);
    try {
      await completeOnboarding();
      await fetchUser();
      navigate(targetRoute || '/dashboard', { replace: true });
    } finally {
      setIsLaunching(false);
    }
  };

  const getStepData = (currentStep: number): Record<string, unknown> => {
    switch (currentStep) {
      case 0:
        return { name: onboarding.profile.name, username: onboarding.profile.username, avatar: onboarding.profile.avatar };
      case 1:
        return { bio: onboarding.profile.bio, headline: onboarding.profile.headline, tags: onboarding.profile.tags };
      case 2:
        return { useCase: onboarding.useCase };
      case 3:
        return { personality: onboarding.agentPreferences.personality, agentMode: onboarding.agentPreferences.agentMode, apiKey: agentApiKey || undefined };
      case 4:
        return { skills: onboarding.portfolio.skills, headline: onboarding.portfolio.headline, about: onboarding.portfolio.about };
      case 5:
        return { integrations: onboarding.integrations };
      case 6:
        return {}; // Free tier step — no data to save
      default:
        return {};
    }
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return onboarding.profile.name.trim().length > 0 && onboarding.profile.username.trim().length > 0;
      case 1:
        return onboarding.profile.bio.length === 0 || onboarding.profile.bio.length >= 10;
      case 2:
        return onboarding.useCase.length > 0;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return true; // Free tier — handled by its own buttons
      default:
        return true;
    }
  };

  // Steps where the Next button is hidden because the step has its own navigation
  const stepHasOwnNav = step === 6 || step === 7;

  const currentStepInfo = STEPS[step];
  const progressPercent = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
          <AgentinLogo size={32} />
          <span className="text-xl sm:text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
            <span className="text-white">Agent</span><span className="text-[#8B5CF6]">in</span>
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          Set up your AI space
        </h1>
        <p className="text-[#6B7280] text-sm">
          Step {step + 1} of {STEPS.length}: {currentStepInfo.description}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 sm:mb-8">
        <style>{`
          @keyframes ob-shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>
        <div className="flex items-center justify-between text-xs text-[#6B7280] mb-2">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{estimatedTime} min remaining
          </span>
          <span>{Math.round(progressPercent)}% complete</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(6, 6, 26, 0.9)' }}>
          <div
            className="h-full transition-all duration-500 ease-out relative overflow-hidden"
            style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #06B6D4, #8B5CF6)' }}
          >
            {/* Shimmer sweep */}
            <div
              className="absolute inset-0 w-1/3"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                animation: 'ob-shimmer 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>

      {/* Progress Steps - compact dots for 8 steps */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isCompleted = i < step;

          return (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm sm:text-base transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#10B981] text-white'
                    : isActive
                      ? 'bg-[#8B5CF6] text-white ring-4 ring-[#8B5CF6]/20 scale-110'
                      : 'border border-white/[0.08] bg-white/[0.02] text-[#6B7280]'
                }`}
                title={s.name}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : s.emoji}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-2 sm:w-4 h-0.5 mx-0.5 sm:mx-1 ${
                  isCompleted ? 'bg-[#10B981]' : 'bg-white/[0.08]'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className={`p-4 sm:p-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl mb-6 shadow-xl shadow-[#8B5CF6]/10 mx-auto w-full ${stepAnimClass}`}
        style={{ boxShadow: '0 8px 32px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.05)' }}
      >
        {step === 0 && (
          <ProfileStep
            name={onboarding.profile.name}
            username={onboarding.profile.username}
            avatar={onboarding.profile.avatar}
            onNameChange={(name) => updateOnboarding({ profile: { ...onboarding.profile, name } })}
            onUsernameChange={(username) => updateOnboarding({ profile: { ...onboarding.profile, username } })}
            onAvatarChange={(avatar) => updateOnboarding({ profile: { ...onboarding.profile, avatar } })}
          />
        )}
        {step === 1 && (
          <BioStep
            bio={onboarding.profile.bio}
            headline={onboarding.profile.headline}
            tags={onboarding.profile.tags}
            name={onboarding.profile.name}
            onBioChange={(bio) => updateOnboarding({ profile: { ...onboarding.profile, bio } })}
            onHeadlineChange={(headline) => updateOnboarding({ profile: { ...onboarding.profile, headline } })}
            onTagsChange={(tags) => updateOnboarding({ profile: { ...onboarding.profile, tags } })}
          />
        )}
        {step === 2 && (
          <UseCaseStep
            selected={onboarding.useCase}
            onSelect={(useCase) => updateOnboarding({ useCase })}
          />
        )}
        {step === 3 && (
          <AgentStep
            personality={onboarding.agentPreferences.personality}
            agentMode={onboarding.agentPreferences.agentMode}
            apiKey={agentApiKey}
            onPersonalityChange={(personality) => updateOnboarding({ agentPreferences: { ...onboarding.agentPreferences, personality } })}
            onAgentModeChange={(agentMode: AgentMode) => updateOnboarding({ agentPreferences: { ...onboarding.agentPreferences, agentMode } })}
            onApiKeyChange={setAgentApiKey}
          />
        )}
        {step === 4 && (
          <PortfolioStep
            skills={onboarding.portfolio.skills}
            headline={onboarding.portfolio.headline}
            about={onboarding.portfolio.about}
            tags={onboarding.profile.tags}
            name={onboarding.profile.name}
            onSkillsChange={(skills) => updateOnboarding({ portfolio: { ...onboarding.portfolio, skills } })}
            onHeadlineChange={(headline) => updateOnboarding({ portfolio: { ...onboarding.portfolio, headline } })}
            onAboutChange={(about) => updateOnboarding({ portfolio: { ...onboarding.portfolio, about } })}
            onSkip={() => handleSkip(false)}
          />
        )}
        {step === 5 && (
          <IntegrationsStep
            selected={onboarding.integrations}
            onToggle={(integrations: IntegrationType[]) => updateOnboarding({ integrations })}
            onSkip={() => handleSkip(false)}
          />
        )}
        {step === 6 && (
          <FreeTierStep
            onContinueFree={() => animateStep(7)}
            onUpgrade={async () => {
              await completeOnboarding();
              await fetchUser();
              navigate('/dashboard/billing', { replace: true });
            }}
          />
        )}
        {step === 7 && (
          <GuidedFirstTaskStep
            useCase={onboarding.useCase}
            onSelectTask={(route) => handleLaunch(route)}
            onSkipToDashboard={() => handleLaunch('/dashboard')}
            isLaunching={isLaunching}
          />
        )}
      </div>

      {/* Skip Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl rounded-2xl p-6 max-w-xs sm:max-w-sm w-full">
            <h3 className="text-lg font-semibold text-[#E8E8F0] mb-4">Skip this step?</h3>
            <p className="text-sm text-[#6B7280] mb-4">
              You can always complete this later in your dashboard settings.
            </p>
            <div className="space-y-2 mb-4">
              {SKIP_REASONS.map((reason, i) => (
                <button
                  key={reason}
                  onClick={() => handleSkip(i === 3)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-[#06061a] border border-white/[0.08] text-sm text-[#6B7280] hover:border-[#8B5CF6]/50 hover:text-[#E8E8F0] transition-all"
                >
                  {reason}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full border-[#8B5CF6]/30 text-[#6B7280]"
              onClick={() => setShowSkipModal(false)}
            >
              Continue Setup
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="space-y-3">
        {/* Main action buttons — hidden on steps that have their own nav */}
        {!stepHasOwnNav && (
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="min-h-[48px] px-4 border-[#8B5CF6]/30 text-[#6B7280]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}

            <Button
              onClick={handleNext}
              disabled={!canAdvance() || isSaving}
              className="flex-1 min-h-[48px] hover:opacity-90 text-white font-medium"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Back button for steps with own nav */}
        {stepHasOwnNav && step > 0 && (
          <div className="flex justify-center">
            <button
              onClick={handleBack}
              className="text-sm text-[#6B7280] hover:text-[#8B5CF6] transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        )}

        {/* Skip option - only show on intermediate steps, not on steps with own nav */}
        {step > 0 && step < STEPS.length - 1 && !stepHasOwnNav && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setShowSkipModal(true)}
              className="text-sm text-[#6B7280] hover:text-[#8B5CF6] transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 rounded px-2 py-1"
            >
              <SkipForward className="w-4 h-4" />
              Skip this step
            </button>
            <span className="text-[#6B7280]/30">|</span>
            <button
              onClick={() => handleSkip(true)}
              className="text-sm text-[#6B7280] hover:text-[#ef4444] transition-colors focus-visible:ring-2 focus-visible:ring-[#ef4444]/50 rounded px-2 py-1"
            >
              Skip all setup
            </button>
          </div>
        )}

        {/* Step indicator text */}
        <p className="text-center text-xs text-[#6B7280]/50">
          {step === 0 && "Let's start with the basics"}
          {step === 1 && "This helps others understand what you do"}
          {step === 2 && "Pick your focus to tailor your AI experience"}
          {step === 3 && "Choose an AI personality that fits you"}
          {step === 4 && "Showcase your skills and projects"}
          {step === 5 && "Connect apps to supercharge your agent"}
          {step === 6 && "Agentin is free to use with generous limits"}
          {step === 7 && "Pick your first task and get started"}
        </p>

        {/* Finish later — skips all setup, goes straight to dashboard */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            onClick={async () => {
              await completeOnboarding();
              navigate('/dashboard', { replace: true });
            }}
            className="text-xs text-[#6B7280]/50 hover:text-[#6B7280] transition-colors underline underline-offset-2"
          >
            I'll finish setup later
          </button>
          {user?.name && (
            <>
              <span className="text-[#6B7280]/20">|</span>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-xs text-[#6B7280]/40 hover:text-[#6B7280] transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Not {user.name.split(' ')[0]}?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
