import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LandingPage } from './landing/LandingPage';
import { DashboardApp } from './dashboard/DashboardApp';
import { PortfolioView } from './portfolio/PortfolioView';
import { OnboardingPage } from './onboarding/OnboardingPage';
import { ExplorePage } from './explore/ExplorePage';
import { LoginPage } from './onboarding/LoginPage';
import { ForgotPasswordPage } from './onboarding/ForgotPasswordPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { StatusPage } from './pages/StatusPage';
import { DocsPage } from './pages/DocsPage';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboarding.completed);
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => { applyTheme(); }, [applyTheme]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#05050A] text-[#F4F6FF]">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/portfolio/:username" element={<PortfolioView />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/docs" element={<DocsPage />} />

          {/* Onboarding — only show if logged in but not completed */}
          <Route
            path="/onboarding"
            element={
              isAuthenticated && !onboardingCompleted
                ? <OnboardingPage />
                : <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
            }
          />

          {/* Dashboard — protected */}
          <Route
            path="/dashboard/*"
            element={
              isAuthenticated
                ? (onboardingCompleted ? <DashboardApp /> : <Navigate to="/onboarding" replace />)
                : <Navigate to="/login" replace />
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0C0C18',
            border: '1px solid rgba(0,240,255,0.2)',
            color: '#F4F6FF',
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
