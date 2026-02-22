import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft, Check, Loader2, Zap, Clock, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { ProfileStep } from './steps/ProfileStep';
import { BioStep } from './steps/BioStep';
import { AgentStep } from './steps/AgentStep';
import { PortfolioStep } from './steps/PortfolioStep';
import { IntegrationsStep } from './steps/IntegrationsStep';
import { ReviewStep } from './steps/ReviewStep';
import type { AgentMode, IntegrationType } from '@/types';

const STEPS = [
  { id: 'profile', name: 'Profile', emoji: '👤', description: 'Who you are' },
  { id: 'bio', name: 'Bio', emoji: '📝', description: 'Tell your story' },
  { id: 'agent', name: 'Agent', emoji: '🤖', description: 'Your AI assistant' },
  { id: 'portfolio', name: 'Portfolio', emoji: '💼', description: 'Show your work' },
  { id: 'integrations', name: 'Connect', emoji: '🔗', description: 'Link your apps' },
  { id: 'review', name: 'Launch', emoji: '🚀', description: 'Ready to go' },
];

// Skip reasons for analytics
const SKIP_REASONS = [
  '⏰ In a hurry — remind me later',
  '🤔 Not sure what to put',
  '🔒 Prefer to keep it private',
  '⏭️ Skip all setup',
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { onboarding, updateOnboarding, saveOnboardingStep, completeOnboarding, user, fetchUser } = useAuthStore();
  const [step, setStep] = useState(Math.min(onboarding.step, 5));
  const [stepAnimClass, setStepAnimClass] = useState('animate-step-slide-in');
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState(2);

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
      // Skip to review step
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

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      await completeOnboarding();
      await fetchUser();
      navigate('/dashboard', { replace: true });
    } finally {
      setIsLaunching(false);
    }
  };

  const getStepData = (currentStep: number): Record<string, unknown> => {
    switch (currentStep) {
      case 0:
        return { name: onboarding.profile.name, username: onboarding.profile.username };
      case 1:
        return { bio: onboarding.profile.bio, headline: onboarding.profile.headline, tags: onboarding.profile.tags };
      case 2:
        return { personality: onboarding.agentPreferences.personality, agentMode: onboarding.agentPreferences.agentMode };
      case 3:
        return { skills: onboarding.portfolio.skills, headline: onboarding.portfolio.headline, about: onboarding.portfolio.about };
      case 4:
        return { integrations: onboarding.integrations };
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
        return true;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const currentStepInfo = STEPS[step];
  const progressPercent = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            GeekSpace
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Set up your AI space
        </h1>
        <p className="text-[#A7ACB8] text-sm">
          Step {step + 1} of {STEPS.length}: {currentStepInfo.description}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between text-xs text-[#A7ACB8] mb-2">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{estimatedTime} min remaining
          </span>
          <span>{Math.round(progressPercent)}% complete</span>
        </div>
        <div className="h-2 bg-[#0B0B10] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#7B61FF] to-[#FF61DC] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Progress Steps - Icons */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isCompleted = i < step;
          const isUpcoming = i > step;
          
          return (
            <div key={s.id} className="flex items-center">
              <div 
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-[#61FF7B] text-[#0B0B10]' 
                    : isActive 
                      ? 'bg-[#7B61FF] text-white ring-4 ring-[#7B61FF]/20 scale-110' 
                      : 'bg-[#0B0B10] border border-[#7B61FF]/20 text-[#A7ACB8]'
                }`}
                title={s.name}
              >
                {isCompleted ? <Check className="w-5 h-5 sm:w-6 sm:h-6" /> : s.emoji}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-4 sm:w-8 h-0.5 mx-1 sm:mx-2 ${
                  isCompleted ? 'bg-[#61FF7B]' : 'bg-[#7B61FF]/20'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className={`p-4 sm:p-8 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20 mb-6 shadow-xl shadow-[#7B61FF]/5 ${stepAnimClass}`}>
        {step === 0 && (
          <ProfileStep
            name={onboarding.profile.name}
            username={onboarding.profile.username}
            onNameChange={(name) => updateOnboarding({ profile: { ...onboarding.profile, name } })}
            onUsernameChange={(username) => updateOnboarding({ profile: { ...onboarding.profile, username } })}
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
          <AgentStep
            personality={onboarding.agentPreferences.personality}
            agentMode={onboarding.agentPreferences.agentMode}
            onPersonalityChange={(personality) => updateOnboarding({ agentPreferences: { ...onboarding.agentPreferences, personality } })}
            onAgentModeChange={(agentMode: AgentMode) => updateOnboarding({ agentPreferences: { ...onboarding.agentPreferences, agentMode } })}
          />
        )}
        {step === 3 && (
          <PortfolioStep
            skills={onboarding.portfolio.skills}
            headline={onboarding.portfolio.headline}
            about={onboarding.portfolio.about}
            tags={onboarding.profile.tags}
            name={onboarding.profile.name}
            onSkillsChange={(skills) => updateOnboarding({ portfolio: { ...onboarding.portfolio, skills } })}
            onHeadlineChange={(headline) => updateOnboarding({ portfolio: { ...onboarding.portfolio, headline } })}
            onAboutChange={(about) => updateOnboarding({ portfolio: { ...onboarding.portfolio, about } })}
          />
        )}
        {step === 4 && (
          <IntegrationsStep
            selected={onboarding.integrations}
            onToggle={(integrations: IntegrationType[]) => updateOnboarding({ integrations })}
          />
        )}
        {step === 5 && (
          <ReviewStep
            onboarding={onboarding}
            onLaunch={handleLaunch}
            isLaunching={isLaunching}
          />
        )}
      </div>

      {/* Skip Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0B10] border border-[#7B61FF]/20 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-[#F4F6FF] mb-4">Skip this step?</h3>
            <p className="text-sm text-[#A7ACB8] mb-4">
              You can always complete this later in your dashboard settings.
            </p>
            <div className="space-y-2 mb-4">
              {SKIP_REASONS.map((reason, i) => (
                <button
                  key={i}
                  onClick={() => handleSkip(i === 3)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/20 text-sm text-[#A7ACB8] hover:border-[#7B61FF]/50 hover:text-[#F4F6FF] transition-all"
                >
                  {reason}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full border-[#7B61FF]/30 text-[#A7ACB8]"
              onClick={() => setShowSkipModal(false)}
            >
              Continue Setup
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="space-y-3">
        {/* Main action buttons */}
        <div className="flex items-center gap-3">
          {step > 0 && step < STEPS.length - 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="min-h-[48px] px-4 border-[#7B61FF]/30 text-[#A7ACB8]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}

          {step < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canAdvance() || isSaving}
              className="flex-1 min-h-[48px] bg-gradient-to-r from-[#7B61FF] to-[#6B51EF] hover:opacity-90 text-white font-medium"
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
          ) : (
            <Button
              onClick={handleLaunch}
              disabled={isLaunching}
              className="flex-1 min-h-[48px] bg-gradient-to-r from-[#61FF7B] to-[#51EF6B] text-[#0B0B10] hover:opacity-90 font-bold"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Launch My Agent
                </>
              )}
            </Button>
          )}
        </div>

        {/* Skip option - only show on intermediate steps */}
        {step > 0 && step < STEPS.length - 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setShowSkipModal(true)}
              className="text-sm text-[#A7ACB8] hover:text-[#7B61FF] transition-colors flex items-center gap-1"
            >
              <SkipForward className="w-4 h-4" />
              Skip this step
            </button>
            <span className="text-[#A7ACB8]/30">|</span>
            <button
              onClick={() => handleSkip(true)}
              className="text-sm text-[#A7ACB8] hover:text-[#FF6161] transition-colors"
            >
              Skip all setup
            </button>
          </div>
        )}

        {/* Step indicator text */}
        <p className="text-center text-xs text-[#A7ACB8]/50">
          {step === 0 && "Let's start with the basics"}
          {step === 1 && "This helps others understand what you do"}
          {step === 2 && "Choose an AI personality that fits you"}
          {step === 3 && "Showcase your skills and projects"}
          {step === 4 && "Connect apps to supercharge your agent"}
          {step === 5 && "Review everything before launching"}
        </p>
      </div>
    </div>
  );
}
