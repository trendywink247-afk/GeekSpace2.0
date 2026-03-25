import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { ConnectPage } from './pages/ConnectPage';
import { InvitePage } from './pages/InvitePage';
import OAuthCallbackPage from './onboarding/OAuthCallbackPage';
const LogoStudioPage = lazy(() => import('./logo-studio/LogoStudioPage').then(m => ({ default: m.LogoStudioPage })));
const ImageToolsPage = lazy(() => import('./image-tools/ImageToolsPage').then(m => ({ default: m.ImageToolsPage })));
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { ErrorBoundary } from './components/ErrorBoundary';

/** Scroll to #hash on navigation (React Router doesn't do this for SPAs) */
function HashScroller() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    // Small delay to let the page render before scrolling
    const timer = setTimeout(() => {
      const el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [hash, pathname]);
  return null;
}

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboarding.completed);
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => { applyTheme(); }, [applyTheme]);

  return (
    <BrowserRouter>
      <HashScroller />
      {/* Skip to main content — accessibility for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-md focus:bg-[#8B5CF6] focus:text-[#05050A] focus:font-semibold focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>
      <ErrorBoundary>
      <div className="min-h-screen bg-[#05050A] text-[#F4F6FF] overflow-x-hidden">
        <Routes>
          {/* Auth-aware public routes — redirect to dashboard if already signed in */}
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/portfolio/:username" element={<PortfolioView />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/connect/:token" element={<ConnectPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/logo-studio" element={
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <LogoStudioPage />
            </Suspense>
          } />
          <Route path="/image-tools" element={
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ImageToolsPage />
            </Suspense>
          } />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

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
      </ErrorBoundary>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0C0C18',
            border: '1px solid rgba(139,92,246,0.2)',
            color: '#F4F6FF',
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
