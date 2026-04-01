import { useCallback, useLayoutEffect, useRef, useEffect } from 'react';
import { confirmAction } from '@/utils/alerts';

/**
 * Intercepts browser back-button navigation away from the dashboard.
 *
 * Uses a history sentinel technique (pushState + popstate listener) because
 * this app uses <BrowserRouter>, which does not provide the DataRouterContext
 * required by React Router v7's useBlocker hook. When pressing back, we
 * immediately re-push a sentinel entry so the user stays on the dashboard,
 * then show a SweetAlert2 sign-out confirmation.
 *
 * A future migration to createBrowserRouter + RouterProvider would allow
 * switching to useBlocker for a cleaner implementation.
 */
export function useLogoutBlocker(onConfirmLogout: () => void): void {
  const logoutRef = useRef(onConfirmLogout);
  
  // Update ref in useEffect to avoid "cannot update ref during render" error
  useEffect(() => {
    logoutRef.current = onConfirmLogout;
  }, [onConfirmLogout]);

  const showConfirm = useCallback(async () => {
    const confirmed = await confirmAction(
      'Leaving so soon?',
      'Do you want to sign out of your account?',
    );
    if (confirmed) {
      logoutRef.current();
    }
  }, []);

  useLayoutEffect(() => {
    // Push a sentinel history entry BEFORE the browser paints so it is always
    // in place by the time the user can interact with the dashboard. Using
    // useLayoutEffect (vs useEffect) closes the race window where a fast
    // back-press could fire before the sentinel was registered.
    window.history.pushState({ dashboardSentinel: true }, '');

    function handlePopState() {
      // Back was pressed — re-push the sentinel immediately so the user
      // stays at the current URL, then show the sign-out confirmation.
      window.history.pushState({ dashboardSentinel: true }, '');
      showConfirm();
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showConfirm]);
}
