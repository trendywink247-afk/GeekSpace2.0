/**
 * RootLayout — shared chrome rendered for every route.
 *
 * Replaces the wrapper JSX that previously lived inside <BrowserRouter> in
 * App.tsx.  The data-router renders this as the parent route element; child
 * routes are projected via <Outlet />.
 */
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useThemeStore } from '@/stores/theme-store';

/** Scroll to #hash after in-app navigations (React Router doesn't do this). */
function HashScroller() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [hash, pathname]);
  return null;
}

export function RootLayout() {
  const applyTheme = useThemeStore((s) => s.applyTheme);
  useEffect(() => { applyTheme(); }, [applyTheme]);

  return (
    <>
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
          <Outlet />
        </div>
      </ErrorBoundary>
    </>
  );
}
