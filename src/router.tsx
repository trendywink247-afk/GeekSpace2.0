/**
 * Data-router configuration for GeekSpace 2.0.
 *
 * Migrated from <BrowserRouter><Routes>…</Routes></BrowserRouter> (JSX-tree
 * style) to createBrowserRouter + RouterProvider (data-router mode).
 *
 * Benefits:
 *  • Unlocks loader/action APIs for future data-fetching patterns
 *  • Enables the official useBlocker hook (e.g. for logout confirmation)
 *  • Silences React Router v7 future-flag warnings
 *
 * Route paths, components, lazy-loading, and auth guards are preserved 1:1.
 */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { RootLayout } from './RootLayout';
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
import { useAuthStore } from './stores/auth-store';

// ---------------------------------------------------------------------------
// Lazy pages
// ---------------------------------------------------------------------------
const LogoStudioPage = lazy(() =>
  import('./logo-studio/LogoStudioPage').then((m) => ({ default: m.LogoStudioPage }))
);
const ImageToolsPage = lazy(() =>
  import('./image-tools/ImageToolsPage').then((m) => ({ default: m.ImageToolsPage }))
);

const LazySpinner = (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ---------------------------------------------------------------------------
// Auth-guard route elements
//
// These thin wrapper components replicate the inline auth conditionals that
// previously lived in the JSX-tree <Route element={…}> props.  They call
// Zustand store hooks at render time — no loaders needed.
// ---------------------------------------------------------------------------

/** / — redirect authenticated users to /dashboard */
function HomeRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

/** /login — redirect authenticated users to /dashboard */
function LoginRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}

/** /onboarding — only reachable when signed-in but onboarding incomplete */
function OnboardingRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboarding.completed);
  if (isAuthenticated && !onboardingCompleted) return <OnboardingPage />;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

/** /dashboard/* — protected; requires auth + completed onboarding */
function DashboardRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboarding.completed);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <DashboardApp />;
}

// ---------------------------------------------------------------------------
// Top-level error element (data-router error boundary)
//
// Shown when a loader/action throws or the router itself errors.  React
// rendering errors are still caught by the <ErrorBoundary> class component
// inside RootLayout.
// ---------------------------------------------------------------------------
function RouteErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen p-8 bg-[#05050A]">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-[#FF2D78]/10 border border-[#FF2D78]/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">⚡</span>
        </div>
        <p
          className="text-[#E8E8F0] text-base font-semibold mb-2"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Something went wrong
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="px-6 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-[#A78BFA] border border-[#A78BFA]/30 hover:bg-[#A78BFA]/10 transition-colors"
        >
          Go home
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export const router = createBrowserRouter([
  {
    // Root layout — renders shared chrome (HashScroller, skip link,
    // ErrorBoundary, outer div) then projects child routes via <Outlet />.
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      // Auth-aware public routes
      { index: true,                   element: <HomeRoute /> },
      { path: 'explore',               element: <ExplorePage /> },
      { path: 'login',                 element: <LoginRoute /> },
      { path: 'forgot-password',       element: <ForgotPasswordPage /> },
      { path: 'portfolio/:username',   element: <PortfolioView /> },
      { path: 'privacy',               element: <PrivacyPage /> },
      { path: 'terms',                 element: <TermsPage /> },
      { path: 'status',                element: <StatusPage /> },
      { path: 'docs',                  element: <DocsPage /> },
      { path: 'connect/:token',        element: <ConnectPage /> },
      { path: 'invite',                element: <InvitePage /> },
      { path: 'oauth/callback',        element: <OAuthCallbackPage /> },

      // Lazy pages — keep Suspense wrapper identical to the original
      {
        path: 'logo-studio',
        element: (
          <Suspense fallback={LazySpinner}>
            <LogoStudioPage />
          </Suspense>
        ),
      },
      {
        path: 'image-tools',
        element: (
          <Suspense fallback={LazySpinner}>
            <ImageToolsPage />
          </Suspense>
        ),
      },

      // Onboarding — only reachable when signed in but onboarding incomplete
      { path: 'onboarding', element: <OnboardingRoute /> },

      // Dashboard — protected
      { path: 'dashboard/*', element: <DashboardRoute /> },

      // Fallback — redirect everything unknown to home
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
