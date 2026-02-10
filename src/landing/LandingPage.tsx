import { useEffect, useState } from 'react';
import { NeuralBackground } from '../components/NeuralBackground';
import { Navigation } from '../components/Navigation';
import { HeroSection } from '../sections/HeroSection';
import { ConstellationSection } from '../sections/ConstellationSection';
import { PersonaSection } from '../sections/PersonaSection';
import { ActivitySection } from '../sections/ActivitySection';
import { EngineSection } from '../sections/EngineSection';
import { SecuritySection } from '../sections/SecuritySection';
import { ContactSection } from '../sections/ContactSection';

interface LandingPageProps {
  onEnterDashboard: () => void;
  onViewPortfolio: (username: string) => void;
}

export function LandingPage({ onEnterDashboard, onViewPortfolio }: LandingPageProps) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen">
      <NeuralBackground />
      <Navigation scrollY={scrollY} onEnterDashboard={onEnterDashboard} />
      
      <main className="relative z-10">
        <HeroSection onEnterDashboard={onEnterDashboard} />
        <ConstellationSection onViewPortfolio={onViewPortfolio} />
        <PersonaSection />
        <ActivitySection />
        <EngineSection />
        <SecuritySection />
        <ContactSection onEnterDashboard={onEnterDashboard} />
      </main>
    </div>
  );
}