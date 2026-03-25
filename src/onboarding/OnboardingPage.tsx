import { OnboardingWizard } from './OnboardingWizard';

export function OnboardingPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-6 sm:py-0 bg-[#06061a] overflow-hidden">
      {/* Aurora gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vw] rounded-full bg-[#8B5CF6]/[0.07] blur-[120px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[60vw] h-[60vw] rounded-full bg-[#F59E0B]/[0.05] blur-[100px]" />
        <div className="absolute top-1/4 right-1/3 w-[40vw] h-[40vw] rounded-full bg-[#10B981]/[0.04] blur-[80px]" />
      </div>
      <OnboardingWizard />
    </div>
  );
}
