/* eslint-disable react-refresh/only-export-components */
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
 * Auth-guard wrapper components live in src/route-guards.tsx (separate file
 * required by react-refresh/only-export-components — this file exports a
 * non-component constant).
 */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { RootLayout } from './RootLayout';
import { ExplorePage } from './explore/ExplorePage';
import { ForgotPasswordPage } from './onboarding/ForgotPasswordPage';
import { PortfolioView } from './portfolio/PortfolioView';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { StatusPage } from './pages/StatusPage';
import { DocsPage } from './pages/DocsPage';
import { ConnectPage } from './pages/ConnectPage';
import { InvitePage } from './pages/InvitePage';
import OAuthCallbackPage from './onboarding/OAuthCallbackPage';
import {
  HomeRoute,
  LoginRoute,
  OnboardingRoute,
  DashboardRoute,
  RouteErrorFallback,
} from './route-guards';

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
