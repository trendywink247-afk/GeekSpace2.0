import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, OnboardingState, AgentMode } from '@/types';
import { authService } from '@/services/api';
import api from '@/services/api';

// Extend Window interface for test helpers
declare global {
  interface Window {
    __TEST_SET_AUTH__?: (token: string, user?: Record<string, unknown>) => void;
  }
}

/**
 * Zustand store shape for authentication and session state.
 *
 * Persisted fields (survive page reloads via localStorage key `gs-auth`):
 * `token`, `isAuthenticated`, `user`, `onboarding`, `compactMode`.
 */
interface AuthStore {
  /** Authenticated user profile, or null when logged out. */
  user: User | null;
  /** JWT access token stored in localStorage under `gs_token`. */
  token: string | null;
  /** True when a valid session exists. */
  isAuthenticated: boolean;
  /** True while any auth API call is in-flight. */
  isLoading: boolean;
  /** Multi-step onboarding progress (step index, profile data, preferences). */
  onboarding: OnboardingState;
  /** When true, the sidebar/chat UI renders in compact/condensed layout. */
  compactMode: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Authenticates with email + password. Stores token in localStorage and syncs timezone.
   * @throws {Error} If credentials are invalid or the API returns an error.
   */
  login: (email: string, password: string) => Promise<void>;

  /**
   * Registers a new account and logs the user in immediately.
   * @throws {Error} If signup fails (e.g. email taken, validation error).
   */
  signup: (email: string, password: string, username: string) => Promise<void>;

  /** Clears session state, removes token from localStorage, and resets onboarding. */
  logout: () => void;

  /**
   * Fetches the current user's profile from `/api/users/me` and syncs timezone.
   * Clears auth state if the request fails (e.g. expired token).
   */
  fetchUser: () => Promise<void>;

  /** Replaces the cached user profile with a new value (e.g. after profile edits). */
  setUser: (user: User) => void;

  /**
   * Persists a single onboarding step's data to the API and advances the step counter.
   * Silently allows offline use (API failure does not throw).
   * @param step - The step index that was just completed.
   * @param data - Arbitrary step-specific form data to save.
   */
  saveOnboardingStep: (step: number, data: Record<string, unknown>) => Promise<void>;

  /** Merges partial onboarding state (e.g. profile fields) without persisting to API. */
  updateOnboarding: (data: Partial<OnboardingState>) => void;

  /**
   * Marks onboarding as completed on the API and sets `completed: true` locally.
   * Silently allows offline use.
   */
  completeOnboarding: () => Promise<void>;

  /** Toggles compact layout mode for the dashboard UI. */
  setCompactMode: (enabled: boolean) => void;

  /**
   * Logs in with a demo account from the API. Falls back to a hardcoded mock user
   * if the backend is unreachable (e.g. during development without a server).
   */
  loginDemo: () => Promise<void>;
}

/**
 * Default onboarding state for new users.
 * Also used as the reset value after logout.
 */
export const defaultOnboarding: OnboardingState = {
  step: 0,
  completed: false,
  profile: { name: '', username: '', bio: '', headline: '', tags: [], avatar: '#8B5CF6' },
  useCase: '',
  agentPreferences: { personality: 'jarvis', agentMode: 'builder' as AgentMode },
  portfolio: { skills: [], headline: '', about: '' },
  integrations: [],
  visibility: 'public',
};

const demoUser: User = {
  id: 'demo-1',
  email: 'alex@example.com',
  username: 'alex',
  name: 'Alex Chen',
  avatar: 'AC',
  bio: 'Full-stack developer and AI enthusiast.',
  location: 'San Francisco, CA',
  website: 'alexchen.dev',
  tags: ['AI Engineer', 'Full-stack', 'Open Source'],
  theme: { mode: 'dark', accentColor: '#8B5CF6' },
  plan: 'pro',
  createdAt: '2026-01-15T00:00:00Z',
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      onboarding: { ...defaultOnboarding },
      compactMode: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await authService.login(email, password);
          localStorage.setItem('gs_token', data.token);
          const u = data.user as unknown as { onboardingCompleted?: boolean; onboardingStep?: number };
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
            onboarding: { ...defaultOnboarding, completed: !!u.onboardingCompleted, step: u.onboardingStep ?? 0 },
          });
          // Sync timezone on login
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) void api.patch('/users/me/timezone', { timezone: tz });
          } catch { /* ignore */ }
        } catch (err: unknown) {
          set({ isLoading: false });
          const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid credentials';
          throw new Error(message);
        }
      },

      signup: async (email, password, username) => {
        set({ isLoading: true });
        try {
          const { data } = await authService.signup(email, password, username);
          localStorage.setItem('gs_token', data.token);
          set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          set({ isLoading: false });
          const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Signup failed';
          throw new Error(message);
        }
      },

      logout: () => {
        authService.logout();
        set({ user: null, token: null, isAuthenticated: false, onboarding: { ...defaultOnboarding } });
      },

      fetchUser: async () => {
        set({ isLoading: true });
        try {
          const { data } = await authService.me();
          set((s) => ({
            user: data,
            isAuthenticated: true,
            isLoading: false,
            onboarding: {
              ...s.onboarding,
              completed: !!(data as unknown as { onboardingCompleted?: boolean }).onboardingCompleted,
              step: (data as unknown as { onboardingStep?: number }).onboardingStep ?? 0,
            },
          }));
          // Fire-and-forget: sync detected browser timezone to server (for reminders/briefings)
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) void api.patch('/users/me/timezone', { timezone: tz });
          } catch { /* ignore timezone sync errors */ }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      setUser: (user) => set({ user }),

      saveOnboardingStep: async (step, data) => {
        try {
          await authService.saveOnboardingStep(step, data);
        } catch { /* allow offline */ }
        set((s) => ({ onboarding: { ...s.onboarding, step } }));
      },

      updateOnboarding: (data) =>
        set((s) => ({ onboarding: { ...s.onboarding, ...data } })),

      completeOnboarding: async () => {
        try {
          await authService.completeOnboarding();
        } catch { /* allow offline */ }
        set((s) => ({ onboarding: { ...s.onboarding, completed: true, step: 8 } }));
      },

      setCompactMode: (enabled) => set({ compactMode: enabled }),

      // Demo mode: call real API, fallback to mock if backend unreachable
      loginDemo: async () => {
        set({ isLoading: true });
        try {
          const { data } = await authService.loginDemo();
          localStorage.setItem('gs_token', data.token);
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
            onboarding: { ...defaultOnboarding, completed: true },
          });
        } catch {
          // Fallback to local mock when backend is unreachable
          set({
            user: demoUser,
            token: 'demo-token',
            isAuthenticated: true,
            isLoading: false,
            onboarding: { ...defaultOnboarding, completed: true },
          });
        }
      },
    }),
    {
      name: 'gs-auth',
      partialize: (state) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        onboarding: state.onboarding,
        compactMode: state.compactMode,
      }),
    },
  ),
);

// Test-only: Expose helper to set auth from E2E tests
// Available when VITE_TEST_MODE is set during build
if (import.meta.env.VITE_TEST_MODE === 'true') {
  window.__TEST_SET_AUTH__ = (token: string, user?: Record<string, unknown>) => {
    const newState = {
      token,
      user: user ? (user as unknown as User) : null,
      isAuthenticated: true,
      isLoading: false,
      onboarding: { ...defaultOnboarding, completed: true },
    };
    // Set state in Zustand
    useAuthStore.setState(newState);
    // Also directly update localStorage to ensure persist works
    let existingData: Record<string, unknown> = {};
    try { existingData = JSON.parse(localStorage.getItem('gs-auth') || '{}') as Record<string, unknown>; } catch { /* corrupted — start fresh */ }
    const existingState = (existingData.state ?? {}) as Record<string, unknown>;
    localStorage.setItem('gs-auth', JSON.stringify({ ...existingData, state: { ...existingState, ...newState } }));
  };
}
