import { useState, useCallback, useEffect } from 'react';

interface UseLogoutBlockerReturn {
  showDialog: boolean;
  handleStay: () => void;
  handleSignOut: () => void;
}

/**
 * Intercepts browser back-button navigation away from the dashboard.
 *
 * Uses a history sentinel technique (pushState + popstate listener) because
 * this app uses <BrowserRouter>, which does not provide the DataRouterContext
 * required by React Router v7's useBlocker hook. When pressing back, we
 * immediately re-push a sentinel entry so the user stays on the dashboard,
 * then show a sign-out confirmation dialog.
 *
 * A future migration to createBrowserRouter + RouterProvider would allow
 * switching to useBlocker for a cleaner implementation.
 */
export function useLogoutBlocker(onConfirmLogout: () => void): UseLogoutBlockerReturn {
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    // Push a sentinel history entry so the first back-press pops to here
    // (rather than leaving the dashboard entirely).
    window.history.pushState({ dashboardSentinel: true }, '');

    function handlePopState() {
      // Back was pressed — re-push the sentinel immediately so the user
      // stays at the current URL, then show the sign-out dialog.
      window.history.pushState({ dashboardSentinel: true }, '');
      setShowDialog(true);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // Runs once on DashboardApp mount; cleaned up on unmount

  const handleStay = useCallback(() => {
    setShowDialog(false);
  }, []);

  const handleSignOut = useCallback(() => {
    setShowDialog(false);
    onConfirmLogout();
  }, [onConfirmLogout]);

  return { showDialog, handleStay, handleSignOut };
}
