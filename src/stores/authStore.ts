import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, OnboardingState, AgentMode } from '@/types';
import { authService } from '@/services/api';

// Extend Window interface for test helpers
declare global {
  interface Window {
    __TEST_SET_AUTH__?: (token: string) => void;
  }
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboarding: OnboardingState;

  // actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  setUser: (user: User) => void;
  saveOnboardingStep: (step: number, data: Record<string, unknown>) => Promise<void>;
  updateOnboarding: (data: Partial<OnboardingState>) => void;
  completeOnboarding: () => Promise<void>;

  // demo mode
  loginDemo: () => Promise<void>;
}

const defaultOnboarding: OnboardingState = {
  step: 0,
  completed: false,
  profile: { name: '', username: '', bio: '', headline: '', tags: [] },
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
  theme: { mode: 'dark', accentColor: '#7B61FF' },
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
        set((s) => ({ onboarding: { ...s.onboarding, completed: true, step: 6 } }));
      },

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
      }),
    },
  ),
);

// Test-only: Expose helper to set auth from E2E tests
// Available when VITE_TEST_MODE is set during build
if (import.meta.env.VITE_TEST_MODE === 'true') {
  window.__TEST_SET_AUTH__ = (token: string) => {
    useAuthStore.setState({
      token,
      isAuthenticated: true,
      onboarding: { ...defaultOnboarding, completed: true },
    });
  };
}
