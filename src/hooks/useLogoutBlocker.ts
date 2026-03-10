import { useState, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Intercepts back/forward navigation away from the dashboard.
 * Returns state and handlers to drive a "sign out?" confirmation dialog.
 */
export function useLogoutBlocker(onConfirmLogout: () => void) {
  const [showDialog, setShowDialog] = useState(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const leavingDashboard =
      currentLocation.pathname.startsWith('/dashboard') &&
      !nextLocation.pathname.startsWith('/dashboard');
    return leavingDashboard;
  });

  if (blocker.state === 'blocked' && !showDialog) {
    setShowDialog(true);
  }

  const handleStay = useCallback(() => {
    setShowDialog(false);
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  const handleSignOut = useCallback(() => {
    setShowDialog(false);
    if (blocker.state === 'blocked') blocker.proceed();
    onConfirmLogout();
  }, [blocker, onConfirmLogout]);

  return { showDialog, handleStay, handleSignOut };
}
