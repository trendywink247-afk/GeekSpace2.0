import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NeuralBackground } from '../components/NeuralBackground';
import { Navigation } from '../components/Navigation';
import { HeroSection } from '../sections/HeroSection';
import { ConstellationSection } from '../sections/ConstellationSection';
import { PersonaSection } from '../sections/PersonaSection';
import { ActivitySection } from '../sections/ActivitySection';
import { EngineSection } from '../sections/EngineSection';
import { SecuritySection } from '../sections/SecuritySection';
import { ContactSection } from '../sections/ContactSection';

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
  const onBrowseDirectory = () => navigate('/explore');
  const onDesignAssistant = () => navigate('/login?redirect=design');
  const onBuildWorkflow = () => navigate('/login?redirect=automations');
  const onReviewSecurity = () => navigate('/docs');

  return (
    <div className="relative min-h-screen">
      <NeuralBackground />
      <Navigation scrollY={scrollY} onEnterDashboard={onEnterDashboard} />

      <main className="relative z-10">
        <HeroSection onEnterDashboard={onEnterDashboard} onWatchDemo={onWatchDemo} />
        <ConstellationSection onViewPortfolio={onViewPortfolio} onBrowseDirectory={onBrowseDirectory} />
        <PersonaSection onDesignAssistant={onDesignAssistant} />
        <ActivitySection />
        <EngineSection onBuildWorkflow={onBuildWorkflow} />
        <SecuritySection onReviewSecurity={onReviewSecurity} />
        <ContactSection onEnterDashboard={onEnterDashboard} />
      </main>
    </div>
  );
}
