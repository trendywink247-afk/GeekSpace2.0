import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Hexagon } from 'lucide-react';
import { NeuralBackground } from '@/components/NeuralBackground';
import { Navigation } from '@/components/Navigation';
import { HeroSection } from './sections/HeroSection';
import { ConstellationSection } from './sections/ConstellationSection';
import { PersonaSection } from './sections/PersonaSection';
import { ActivitySection } from './sections/ActivitySection';
import { EngineSection } from './sections/EngineSection';
import { SecuritySection } from './sections/SecuritySection';
import { ContactSection } from './sections/ContactSection';
import { PromptTemplatesSection } from './sections/PromptTemplatesSection';

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const onEnterDashboard = () => navigate(isAuthenticated ? '/dashboard' : '/login');
  const onViewPortfolio = (username: string) => navigate(`/portfolio/${username}`);
  const onWatchDemo = () => navigate('/login?demo=true');
  const onBrowseDirectory = () => navigate('/explore');
  const onDesignAssistant = () => navigate('/login?redirect=design');
  const onBuildWorkflow = () => navigate('/login?redirect=automations');
  const onReviewSecurity = () => navigate('/docs');

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05050A] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0C0C18] via-[#05050A] to-[#0A0A0F]" />
        <div className="relative z-10 w-full max-w-sm mx-auto px-6 text-center">
          <div className="bg-[#0C0C18] border border-white/10 rounded-2xl p-8 space-y-6">
            <div className="w-14 h-14 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center mx-auto">
              <Hexagon className="w-7 h-7 text-[#00F0FF]" />
            </div>
            <div>
              <p className="text-white/50 text-sm mb-1">Signed in as</p>
              <p className="text-white font-semibold">{user?.name || user?.username}</p>
              <p className="text-white/40 text-sm">{user?.email}</p>
            </div>
            <p className="text-white/60 text-sm">Do you want to sign out?</p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => { logout(); navigate('/login', { replace: true }); }}
                variant="outline"
                className="w-full border-[#FF2D78]/40 text-[#FF2D78] hover:bg-[#FF2D78]/10 hover:border-[#FF2D78]"
              >
                Yes, sign out
              </Button>
              <Button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/20"
              >
                Back to dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <NeuralBackground />
      <Navigation scrollY={scrollY} onEnterDashboard={onEnterDashboard} />

      <main className="relative z-10">
        <HeroSection onEnterDashboard={onEnterDashboard} onWatchDemo={onWatchDemo} />
        <PromptTemplatesSection />
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
