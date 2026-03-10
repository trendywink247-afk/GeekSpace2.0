import { useState, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Intercepts back/forward navigation away from the dashboard.
 * Returns state and handlers to drive a "sign out?" confirmation dialog.
 */

function leavingDashboard({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) {
  return (
    currentLocation.pathname.startsWith('/dashboard') &&
    !nextLocation.pathname.startsWith('/dashboard')
  );
}

interface UseLogoutBlockerReturn {
  showDialog: boolean;
  handleStay: () => void;
  handleSignOut: () => void;
}

export function useLogoutBlocker(onConfirmLogout: () => void): UseLogoutBlockerReturn {
  const [showDialog, setShowDialog] = useState(false);

  const blocker = useBlocker(leavingDashboard);

  if (blocker.state === 'blocked' && !showDialog) {
    setShowDialog(true);
  }

  const handleStay = useCallback(() => {
    setShowDialog(false);
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  const handleSignOut = useCallback(() => {
    if (blocker.state !== 'blocked') return;
    setShowDialog(false);
    blocker.proceed();
    onConfirmLogout();
  }, [blocker, onConfirmLogout]);

  return { showDialog, handleStay, handleSignOut };
}
