import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { ProfileStep } from './steps/ProfileStep';
import { BioStep } from './steps/BioStep';
import { AgentStep } from './steps/AgentStep';
import { PortfolioStep } from './steps/PortfolioStep';
import { IntegrationsStep } from './steps/IntegrationsStep';
import { ReviewStep } from './steps/ReviewStep';
import type { AgentMode, IntegrationType } from '@/types';

const STEPS = ['Profile', 'Bio', 'Agent', 'Portfolio', 'Integrations', 'Review'];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { onboarding, updateOnboarding, saveOnboardingStep, completeOnboarding } = useAuthStore();
  const [step, setStep] = useState(Math.min(onboarding.step, 5));
  const [stepAnimClass, setStepAnimClass] = useState('animate-step-slide-in');
  const [isLaunching, setIsLaunching] = useState(false);

  const animateStep = (next: number) => {
    setStepAnimClass('animate-step-slide-out');
    setTimeout(() => {
      setStep(next);
      setStepAnimClass('animate-step-slide-in');
    }, 200);
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      // Save current step data to server
      const stepData = getStepData(step);
      await saveOnboardingStep(step + 1, stepData);
      animateStep(step + 1);
    }
  };

  const handleSkip = async () => {
    // For optional steps, advance without saving data
    await saveOnboardingStep(step + 1, {});
    animateStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) animateStep(step - 1);
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    await completeOnboarding();
    navigate('/dashboard', { replace: true });
  };

  const getStepData = (currentStep: number): Record<string, unknown> => {
    switch (currentStep) {
      case 0:
        return { name: onboarding.profile.name, username: onboarding.profile.username };
      case 1:
        return { bio: onboarding.profile.bio, headline: onboarding.profile.headline };
      case 2:
        return { personality: onboarding.agentPreferences.personality, agentMode: onboarding.agentPreferences.agentMode };
      case 3:
        return { skills: onboarding.portfolio.skills, headline: onboarding.portfolio.headline, about: onboarding.portfolio.about };
      default:
        return {};
    }
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return onboarding.profile.name.trim().length > 0 && onboarding.profile.username.trim().length > 0;
      case 1:
        // Bio is encouraged but only enforce min length if they started typing
        return onboarding.profile.bio.length === 0 || onboarding.profile.bio.length >= 10;
      default:
        return true;
    }
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="w-8 h-8 text-[#7B61FF]" />
          <span className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            GeekSpace
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Set up your AI space
        </h1>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-1.5 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
              i < step ? 'bg-[#61FF7B] text-[#05050A]' :
              i === step ? 'bg-[#7B61FF] text-white' :
              'bg-[#0B0B10] border border-[#7B61FF]/30 text-[#A7ACB8]'
            }`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 sm:w-10 h-0.5 transition-all duration-500 ${i < step ? 'bg-[#61FF7B]' : 'bg-[#7B61FF]/20'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className={`p-8 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20 mb-6 ${stepAnimClass}`}>
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
            onSkillsChange={(skills) => updateOnboarding({ portfolio: { ...onboarding.portfolio, skills } })}
            onHeadlineChange={(headline) => updateOnboarding({ portfolio: { ...onboarding.portfolio, headline } })}
            onAboutChange={(about) => updateOnboarding({ portfolio: { ...onboarding.portfolio, about } })}
            onSkip={handleSkip}
          />
        )}
        {step === 4 && (
          <IntegrationsStep
            selected={onboarding.integrations}
            onToggle={(integrations: IntegrationType[]) => updateOnboarding({ integrations })}
            onSkip={handleSkip}
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

      {/* Navigation buttons */}
      {step < 5 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
            className="border-[#7B61FF]/30 text-[#A7ACB8]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <span className="text-sm text-[#A7ACB8]">
            Step {step + 1} of {STEPS.length}
          </span>
          <Button
            onClick={handleNext}
            disabled={!canAdvance()}
            className="bg-[#7B61FF] hover:bg-[#6B51EF]"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Back button on review step */}
      {step === 5 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            className="border-[#7B61FF]/30 text-[#A7ACB8]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <span className="text-sm text-[#A7ACB8]">
            Step {step + 1} of {STEPS.length}
          </span>
          <div />
        </div>
      )}
    </div>
  );
}
