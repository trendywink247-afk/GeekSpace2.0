/**
 * Route guard components used by the data-router (src/router.tsx).
 *
 * Each component reads Zustand auth state at render time and either renders
 * the target page or issues a <Navigate /> redirect — identical semantics to
 * the inline JSX conditionals that previously lived in the <Route element={}> props.
 *
 * Keeping these in a dedicated file satisfies the react-refresh/only-export-components
 * lint rule (router.tsx exports a non-component constant; this file exports only components).
 */
import { Navigate } from 'react-router-dom';
import { DashboardApp } from './dashboard/DashboardApp';
import { LandingPage } from './landing/LandingPage';
import { LoginPage } from './onboarding/LoginPage';
import { OnboardingPage } from './onboarding/OnboardingPage';
import { useAuthStore } from './stores/auth-store';

// ---------------------------------------------------------------------------
// Auth guard wrappers
// ---------------------------------------------------------------------------

/** / — redirect authenticated users to /dashboard */
export function HomeRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

/** /login — redirect authenticated users to /dashboard */
export function LoginRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}

/** /onboarding — only reachable when signed in but onboarding incomplete */
export function OnboardingRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboarding.completed);
  if (isAuthenticated && !onboardingCompleted) return <OnboardingPage />;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

/** /dashboard/* — protected; requires auth + completed onboarding */
export function DashboardRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboarding.completed);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <DashboardApp />;
}

// ---------------------------------------------------------------------------
// Data-router error boundary element
// Shown when a loader/action throws or the router itself errors.
// React rendering errors are still caught by the <ErrorBoundary> class
// component inside RootLayout.
// ---------------------------------------------------------------------------

export function RouteErrorFallback() {
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
