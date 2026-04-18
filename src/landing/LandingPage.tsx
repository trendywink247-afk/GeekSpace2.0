import { useNavigate } from 'react-router-dom';
import { NeuralBackground } from '@/components/NeuralBackground';
import { Navigation } from '@/components/Navigation';
import { HeroSection } from './sections/HeroSection';
import { FreeToolsSection } from './sections/FreeToolsSection';
import { TrustStripSection } from './sections/TrustStripSection';
import { ProblemSolutionSection } from './sections/ProblemSolutionSection';
import { PersonaSection } from './sections/PersonaSection';
import { PromptTemplatesSection } from './sections/PromptTemplatesSection';
import { SocialProofSection } from './sections/SocialProofSection';
import { InfraSection } from './sections/InfraSection';
import { ConstellationSection } from './sections/ConstellationSection';
import { TelegramCTASection } from './sections/TelegramCtaSection';
import { PricingPreviewSection } from './sections/PricingPreviewSection';
import { ContactSection } from './sections/ContactSection';
import { FooterSection } from './sections/FooterSection';
import { StickyMobileCTA } from '@/components/StickyMobileCta';

export function LandingPage() {
  const navigate = useNavigate();

  const onEnterDashboard = () => navigate('/login');
  const onBrowseDirectory = () => navigate('/login');
  const onDesignAssistant = () => navigate('/login?redirect=design');
  const onBuildWorkflow = () => navigate('/login?redirect=automations');
  const onReviewSecurity = () => navigate('/docs');
  const onGetStarted = () => navigate('/login');

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundColor: 'var(--lp-bg, #06061a)',
        scrollBehavior: 'smooth',
      }}
    >
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <NeuralBackground />
      <Navigation onEnterDashboard={onEnterDashboard} />

      <main className="relative z-10">
        {/* 1. Hero */}
        <HeroSection onEnterDashboard={onEnterDashboard} />
        {/* 1b. Free Tools showcase */}
        <FreeToolsSection />
        {/* 1c. Trust promises */}
        <TrustStripSection />
        {/* 2. Social Proof */}
        <SocialProofSection />
        {/* 3. ProblemSolution */}
        <ProblemSolutionSection />
        {/* 4. Persona (agents) */}
        <PersonaSection onDesignAssistant={onDesignAssistant} />
        {/* 5. PromptTemplates (interactive demo + templates) */}
        <PromptTemplatesSection />
        {/* 6. Infra (Engine + Security merged) */}
        <InfraSection onBuildWorkflow={onBuildWorkflow} onReviewSecurity={onReviewSecurity} />
        {/* 7. Constellation (Day In Your Life) */}
        <ConstellationSection onBrowseDirectory={onBrowseDirectory} />
        {/* 8. Telegram */}
        <TelegramCTASection />
        {/* 9. Pricing */}
        <PricingPreviewSection onGetStarted={onGetStarted} />

        {/* Divider before Contact */}
        <div className="max-w-6xl mx-auto px-6"><hr className="border-white/[0.04]" /></div>

        {/* 10. Contact */}
        <ContactSection onEnterDashboard={onEnterDashboard} />
        {/* 11. Footer */}
        <FooterSection />

        <StickyMobileCTA onGetStarted={onGetStarted} />
      </main>
    </div>
  );
}
