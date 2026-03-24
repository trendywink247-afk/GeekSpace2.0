import { useNavigate } from 'react-router-dom';
import { NeuralBackground } from '@/components/NeuralBackground';
import { Navigation } from '@/components/Navigation';
import { HeroSection } from './sections/HeroSection';
import { ProblemSolutionSection } from './sections/ProblemSolutionSection';
import { PersonaSection } from './sections/PersonaSection';
import { PromptTemplatesSection } from './sections/PromptTemplatesSection';
import { ActivitySection } from './sections/ActivitySection';
import { EngineSection } from './sections/EngineSection';
import { ConstellationSection } from './sections/ConstellationSection';
import { TelegramCTASection } from './sections/TelegramCTASection';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { PricingPreviewSection } from './sections/PricingPreviewSection';
import { SecuritySection } from './sections/SecuritySection';
import { ContactSection } from './sections/ContactSection';
import { FooterSection } from './sections/FooterSection';

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
      className="relative min-h-screen bg-[#06061a]"
      style={{
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
        {/* 2. ProblemSolution */}
        <div className="bg-[#0a0a24]"><ProblemSolutionSection /></div>
        {/* 3. Persona (agents) */}
        <PersonaSection onDesignAssistant={onDesignAssistant} />
        {/* 4. PromptTemplates (interactive demo + templates) */}
        <div className="bg-[#0a0a24]"><PromptTemplatesSection /></div>
        {/* 5. Activity */}
        <ActivitySection />
        {/* 6. Engine */}
        <div className="bg-[#0a0a24]"><EngineSection onBuildWorkflow={onBuildWorkflow} /></div>
        {/* 7. Constellation (Day In Your Life) */}
        <ConstellationSection onBrowseDirectory={onBrowseDirectory} />
        {/* 8. Telegram */}
        <div className="bg-[#0a0a24]"><TelegramCTASection /></div>

        {/* Divider before Testimonials */}
        <div className="max-w-6xl mx-auto px-6"><hr className="border-white/[0.04]" /></div>

        {/* 9. Testimonials */}
        <TestimonialsSection />
        {/* 10. Security */}
        <div className="bg-[#0a0a24]"><SecuritySection onReviewSecurity={onReviewSecurity} /></div>
        {/* 11. Pricing */}
        <PricingPreviewSection onGetStarted={onGetStarted} />

        {/* Divider before Contact */}
        <div className="max-w-6xl mx-auto px-6"><hr className="border-white/[0.04]" /></div>

        {/* 12. Contact */}
        <ContactSection onEnterDashboard={onEnterDashboard} />
        {/* 13. Footer */}
        <FooterSection />
      </main>
    </div>
  );
}
