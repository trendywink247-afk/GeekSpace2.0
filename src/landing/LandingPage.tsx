import { useEffect, useState } from 'react';
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

function WaveDivider({ flip = false, color = '#0a0a1a' }: { flip?: boolean; color?: string }) {
  return (
    <div className={`w-full h-8 md:h-12 overflow-hidden ${flip ? 'rotate-180' : ''}`}>
      <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className="w-full h-full">
        <path d="M0,24 C240,48 480,0 720,24 C960,48 1200,0 1440,24 L1440,48 L0,48 Z" fill={color} />
      </svg>
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const onEnterDashboard = () => navigate('/login');
  const onViewPortfolio = (username: string) => navigate(`/portfolio/${username}`);
  const onWatchDemo = () => navigate('/login?demo=true');
  const onBrowseDirectory = () => navigate('/login');
  const onDesignAssistant = () => navigate('/login?redirect=design');
  const onBuildWorkflow = () => navigate('/login?redirect=automations');
  const onReviewSecurity = () => navigate('/docs');
  const onGetStarted = () => navigate('/login');

  return (
    <div
      className="relative min-h-screen bg-[#06060f]"
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
      <Navigation scrollY={scrollY} onEnterDashboard={onEnterDashboard} />

      <main className="relative z-10">
        {/* 1. Hero */}
        <HeroSection onEnterDashboard={onEnterDashboard} onWatchDemo={onWatchDemo} />
        <WaveDivider color="#0a0a1a" />
        {/* 2. ProblemSolution */}
        <ProblemSolutionSection />
        {/* 3. Persona (agents) */}
        <PersonaSection onDesignAssistant={onDesignAssistant} />
        {/* 4. PromptTemplates (interactive demo + templates) */}
        <PromptTemplatesSection />
        {/* 5. Activity */}
        <ActivitySection />
        {/* 6. Engine */}
        <EngineSection onBuildWorkflow={onBuildWorkflow} />
        {/* 7. Constellation (Day In Your Life) */}
        <ConstellationSection onViewPortfolio={onViewPortfolio} onBrowseDirectory={onBrowseDirectory} />
        {/* 8. Telegram */}
        <TelegramCTASection />
        {/* 9. Testimonials */}
        <TestimonialsSection />
        <WaveDivider flip color="#0c0c18" />
        {/* 10. Pricing */}
        <PricingPreviewSection onGetStarted={onGetStarted} />
        {/* 11. Security */}
        <SecuritySection onReviewSecurity={onReviewSecurity} />
        <WaveDivider color="#0a0a1a" />
        {/* 12. Contact */}
        <ContactSection onEnterDashboard={onEnterDashboard} />
        {/* 13. Footer */}
        <FooterSection />
      </main>
    </div>
  );
}
