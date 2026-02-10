import { useState } from 'react';
import { LandingPage } from './landing/LandingPage';
import { DashboardApp } from './dashboard/DashboardApp';
import { PortfolioView } from './portfolio/PortfolioView';

type ViewType = 'landing' | 'dashboard' | 'portfolio';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [portfolioUsername, setPortfolioUsername] = useState<string>('alex');

  const navigateTo = (view: ViewType, username?: string) => {
    if (username) setPortfolioUsername(username);
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F4F6FF]">
      {currentView === 'landing' && (
        <LandingPage 
          onEnterDashboard={() => navigateTo('dashboard')} 
          onViewPortfolio={(username) => navigateTo('portfolio', username)}
        />
      )}
      {currentView === 'dashboard' && (
        <DashboardApp 
          onBackToLanding={() => navigateTo('landing')}
          onViewPortfolio={(username) => navigateTo('portfolio', username)}
        />
      )}
      {currentView === 'portfolio' && (
        <PortfolioView 
          username={portfolioUsername}
          onBack={() => navigateTo('landing')}
          onEnterDashboard={() => navigateTo('dashboard')}
        />
      )}
    </div>
  );
}

export default App;