import { useState, useCallback } from 'react';

export const FREE_TRIAL_KEY = 'gs-free-trial';

const LOGO_GEN_LIMIT = 3;

interface FreeTrialState {
  logoGensUsed: number;
  firstUsedAt: number;
}

function readState(): FreeTrialState {
  try {
    const raw = localStorage.getItem(FREE_TRIAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        logoGensUsed: typeof parsed.logoGensUsed === 'number' ? parsed.logoGensUsed : 0,
        firstUsedAt: typeof parsed.firstUsedAt === 'number' ? parsed.firstUsedAt : 0,
      };
    }
  } catch {
    // corrupted data — reset silently
  }
  return { logoGensUsed: 0, firstUsedAt: 0 };
}

function writeState(state: FreeTrialState): void {
  localStorage.setItem(FREE_TRIAL_KEY, JSON.stringify(state));
}

export function useFreeTrial() {
  const [state, setState] = useState<FreeTrialState>(readState);

  const trackLogoGen = useCallback(() => {
    setState((prev) => {
      const next: FreeTrialState = {
        logoGensUsed: prev.logoGensUsed + 1,
        firstUsedAt: prev.firstUsedAt || Date.now(),
      };
      writeState(next);
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
