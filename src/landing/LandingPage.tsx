import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
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
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out',
      offset: 80,
    });
  }, []);

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
    <div className="relative min-h-screen">
      <NeuralBackground />
      <Navigation scrollY={scrollY} onEnterDashboard={onEnterDashboard} />

      <main className="relative z-10">
        {/* 1. Hero */}
        <HeroSection onEnterDashboard={onEnterDashboard} onWatchDemo={onWatchDemo} />
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
        {/* 10. Pricing */}
        <PricingPreviewSection onGetStarted={onGetStarted} />
        {/* 11. Security */}
        <SecuritySection onReviewSecurity={onReviewSecurity} />
        {/* 12. Contact */}
        <ContactSection onEnterDashboard={onEnterDashboard} />
        {/* 13. Footer */}
        <FooterSection />
      </main>
    </div>
  );
}
