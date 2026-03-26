import { useState, useCallback } from 'react';

/**
 * @fileoverview Free trial quota management hook with localStorage persistence.
 *
 * Tracks logo generation usage against a 3-generation free limit.
 * State is persisted to localStorage and survives page reloads.
 * Corrupted data is silently reset to default state.
 */

/**
 * @constant {string} FREE_TRIAL_KEY - localStorage key for free trial state persistence
 */
export const FREE_TRIAL_KEY = 'gs-free-trial';

/**
 * @constant {number} LOGO_GEN_LIMIT - Maximum logo generations allowed in free trial
 */
const LOGO_GEN_LIMIT = 3;

/**
 * Internal state object for free trial tracking.
 * @typedef {Object} FreeTrialState
 * @property {number} logoGensUsed - Number of logo generations used so far
 * @property {number} firstUsedAt - Unix timestamp of first usage, 0 if never used
 */
interface FreeTrialState {
  logoGensUsed: number;
  firstUsedAt: number;
}

/**
 * Reads free trial state from localStorage with graceful fallback on corruption.
 *
 * **Validation Logic:**
 * - Checks both `logoGensUsed` and `firstUsedAt` are numbers
 * - If JSON is invalid or keys are wrong type, silently resets to default
 * - Never throws; always returns a valid state
 *
 * @returns {FreeTrialState} Current state or default { logoGensUsed: 0, firstUsedAt: 0 }
 * @private
 */
function readState(): FreeTrialState {
  try {
    const raw = localStorage.getItem(FREE_TRIAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Type-check after parsing to prevent type errors from corrupted data
      return {
        logoGensUsed: typeof parsed.logoGensUsed === 'number' ? parsed.logoGensUsed : 0,
        firstUsedAt: typeof parsed.firstUsedAt === 'number' ? parsed.firstUsedAt : 0,
      };
    }
  } catch {
    // Corrupted JSON or other localStorage errors — silent reset
  }
  return { logoGensUsed: 0, firstUsedAt: 0 };
}

/**
 * Writes free trial state to localStorage as JSON.
 * Silently fails if localStorage is unavailable (e.g., in private browsing).
 *
 * @param {FreeTrialState} state - State to persist
 * @private
 */
function writeState(state: FreeTrialState): void {
  try {
    localStorage.setItem(FREE_TRIAL_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
    // Silently fail — in-memory state will still work this session
  }
}

/**
 * Manages free-trial usage limits stored in localStorage.
 *
 * **Behavior:**
 * - Reads persisted state on mount via `readState()` lazy initializer
 * - Increments `logoGensUsed` and sets `firstUsedAt` on first call to `trackLogoGen`
 * - Persists updates to localStorage after each change
 * - Calculates `isLogoLimited` and `remainingLogoGens` on each render
 *
 * **Reset (e.g., after upgrade):**
 * ```typescript
 * localStorage.removeItem('gs-free-trial');
 * // Component remounts with fresh state
 * ```
 *
 * @returns {Object} State and methods
 * @returns {number} logoGensUsed - Number of generations already used
 * @returns {number} logoGenLimit - Total allowed (3)
 * @returns {boolean} isLogoLimited - true if user has hit the limit
 * @returns {number} remainingLogoGens - How many uses left (0 if limited)
 * @returns {Function} trackLogoGen - Call after generating a logo to record usage
 *
 * @example
 * ```tsx
 * const { isLogoLimited, remainingLogoGens, trackLogoGen } = useFreeTrial();
 *
 * if (isLogoLimited) {
 *   return <UpgradePrompt />;
 * }
 *
 * const handleGenerate = async () => {
 *   const logo = await generateLogo();
 *   trackLogoGen();  // Increment usage and persist
 * };
 * ```
 */
export function useFreeTrial() {
  // Lazy initialize state from localStorage on first render
  const [state, setState] = useState<FreeTrialState>(readState);

  /**
   * Records one logo generation and persists to localStorage.
   * Sets `firstUsedAt` on first ever call (if not already set).
   */
  const trackLogoGen = useCallback(() => {
    setState((prev) => {
      const next: FreeTrialState = {
        logoGensUsed: prev.logoGensUsed + 1,
        // Set firstUsedAt on first usage, keep existing value on subsequent calls
        firstUsedAt: prev.firstUsedAt || Date.now(),
      };
      writeState(next);  // Persist to localStorage
      return next;
    });
  }, []);

  return {
    logoGensUsed: state.logoGensUsed,
    logoGenLimit: LOGO_GEN_LIMIT,
    isLogoLimited: state.logoGensUsed >= LOGO_GEN_LIMIT,
    trackLogoGen,
    remainingLogoGens: Math.max(0, LOGO_GEN_LIMIT - state.logoGensUsed),
  };
}
