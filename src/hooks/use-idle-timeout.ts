import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Configuration options for session idle timeout detection.
 *
 * **State machine:**
 * ```
 * [Active] --idleMs--> [Warning shown, grace period ticking]
 *            ^
 *            |
 *            +--- User activity (mouse/keyboard) resets to [Active]
 *
 * [Warning shown] --warningMs--> [Logout callback fired]
 *                      ^
 *                      |
 *                      +--- User clicks 'Stay Logged In' → restart from [Active]
 * ```
 */
interface UseIdleTimeoutOptions {
  /** Milliseconds of inactivity before warning is shown. Default: 25 min */
  idleMs?: number;
  /** Additional milliseconds of grace period after warning before auto-logout. Default: 5 min */
  warningMs?: number;
  /** Callback fired when the user is logged out due to timeout or grace period expiry */
  onLogout: () => void;
}

/**
 * Tracks user activity and triggers a warning modal, then auto-logout after prolonged inactivity.
 *
 * **How it works:**
 * 1. Listen for user activity (mouse, keyboard, touch, scroll) globally
 * 2. If no activity for `idleMs`, show warning modal with countdown
 * 3. User can dismiss warning (clicks "Stay Logged In" button) to restart the timer
 * 4. If warning shown for `warningMs` without dismissal, fire `onLogout` callback
 * 5. Activity during warning countdown does NOT auto-dismiss (only dismiss button works)
 *
 * **Usage:**
 * ```tsx
 * const { showWarning, secondsLeft, dismissWarning } = useIdleTimeout({
 *   idleMs: 25 * 60 * 1000,
 *   warningMs: 5 * 60 * 1000,
 *   onLogout: () => logout(),
 * });
 *
 * return showWarning ? (
 *   <WarningModal secondsLeft={secondsLeft} onDismiss={dismissWarning} />
 * ) : null;
 * ```
 *
 * @param options - Configuration object
 * @param options.idleMs - Idle duration in ms before warning shown (default: 25 min)
 * @param options.warningMs - Grace period in ms after warning before logout (default: 5 min)
 * @param options.onLogout - Callback invoked when session expires
 * @returns Object with `showWarning` (boolean), `secondsLeft` (countdown in seconds), `dismissWarning` (reset function)
 */
export function useIdleTimeout({
  idleMs = 25 * 60 * 1000,   // 25 min idle → show warning
  warningMs = 5 * 60 * 1000, // 5 min grace → logout
  onLogout,
}: UseIdleTimeoutOptions) {
  // ─── State ────────────────────────────────────────────────────────
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // ─── Refs (not re-rendered, outlive component updates) ─────────────
  // Track the three overlapping timers:
  // 1. idleTimer: counts down until warning is shown
  // 2. logoutTimer: counts down until logout fires (starts when warning shown)
  // 3. countdownInterval: updates secondsLeft every 1s for the UI
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Absolute timestamp when logout will fire (used by countdownInterval)
  const logoutAt = useRef<number>(0);

  /**
   * Clears all three timers and resets refs.
   * Called when transitioning between states or on unmount.
   */
  const clearAllTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    idleTimer.current = null;
    logoutTimer.current = null;
    countdownInterval.current = null;
  }, []);

  /**
   * Restarts the idle detection timer.
   * Called on every activity event OR when user dismisses the warning.
   *
   * **State transition:** [Active] with idle countdown running
   */
  const startIdleTimer = useCallback(() => {
    // Clean up any previous timers
    clearAllTimers();
    setShowWarning(false);

    // ─ State 1: Waiting for idleMs to elapse ──────────────────────
    idleTimer.current = setTimeout(() => {
      // ─ State 2: Idle threshold reached, show warning ───────────
      setShowWarning(true);
      // Calculate absolute logout timestamp for countdown
      logoutAt.current = Date.now() + warningMs;
      setSecondsLeft(Math.ceil(warningMs / 1000));

      // ─ State 2a: Update countdown UI every 1 second ────────────
      countdownInterval.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((logoutAt.current - Date.now()) / 1000));
        setSecondsLeft(remaining);
        // Soft logout: countdown reached zero
        if (remaining <= 0) {
          clearAllTimers();
          onLogout();
        }
      }, 1000);

      // ─ State 2b: Hard logout after warningMs (failsafe) ─────────
      // In case the countdown interval somehow doesn't catch it in time
      logoutTimer.current = setTimeout(() => {
        clearAllTimers();
        onLogout();
      }, warningMs);
    }, idleMs);
  }, [idleMs, warningMs, onLogout, clearAllTimers]);

  /**
   * User clicked "Stay Logged In" button on the warning modal.
   * Restarts the idle timer and hides the warning.
   *
   * **State transition:** [Warning shown] → [Active]
   */
  const dismissWarning = useCallback(() => {
    startIdleTimer();
  }, [startIdleTimer]);

  /**
   * Main effect: register activity listeners and manage timer lifecycle.
   *
   * **Activity events tracked:**
   * - mousedown: mouse click or drag
   * - keydown: keyboard input
   * - touchstart: touch/swipe
   * - scroll: page scroll
   *
   * **Behavior:**
   * - Start idle timer on mount
   * - Reset idle timer on activity (ONLY if warning not showing)
   * - Once warning shows, ONLY dismissWarning() resets (user must click button)
   * - Clean up all timers and listeners on unmount
   */
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = () => {
      // Once the warning is shown, user activity does NOT auto-dismiss.
      // They must click the "Stay Logged In" button to reset the timer.
      // This prevents accidental clicks from extending the session.
      if (!showWarning) {
        startIdleTimer();
      }
    };

    // Initialize: start idle countdown on mount
    startIdleTimer();

    // Register activity listeners with passive:true for performance
    // (passive listeners don't block scrolling)
    for (const event of activityEvents) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Cleanup on unmount
    return () => {
      clearAllTimers();
      for (const event of activityEvents) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [startIdleTimer, clearAllTimers, showWarning]);

  return { showWarning, secondsLeft, dismissWarning };
}
