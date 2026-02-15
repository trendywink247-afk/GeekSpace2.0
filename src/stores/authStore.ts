import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, OnboardingState, AgentMode, IntegrationType } from '@/types';
import { authService } from '@/services/api';

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
  setOnboardingStep: (step: number) => void;
  updateOnboarding: (data: Partial<OnboardingState>) => void;
  completeOnboarding: () => Promise<void>;

  // demo mode
  loginDemo: () => Promise<void>;
}

const defaultOnboarding: OnboardingState = {
  step: 0,
  completed: false,
  profile: { name: '', username: '', bio: '', tags: [] },
  agentMode: 'builder' as AgentMode,
  integrations: [] as IntegrationType[],
  visibility: 'public',
  apiKeyChoice: 'geekspace',
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
    (set, get) => ({
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
          set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
        } catch {
          set({ isLoading: false });
          throw new Error('Invalid credentials');
        }
      },

      signup: async (email, password, username) => {
        set({ isLoading: true });
        try {
          const { data } = await authService.signup(email, password, username);
          localStorage.setItem('gs_token', data.token);
          set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
        } catch {
          set({ isLoading: false });
          throw new Error('Signup failed');
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
          set({ user: data, isAuthenticated: true, isLoading: false });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      setUser: (user) => set({ user }),

      setOnboardingStep: (step) =>
        set((s) => ({ onboarding: { ...s.onboarding, step } })),

      updateOnboarding: (data) =>
        set((s) => ({ onboarding: { ...s.onboarding, ...data } })),

      completeOnboarding: async () => {
        const state = get();
        try {
          await authService.completeOnboarding(state.onboarding);
          set((s) => ({ onboarding: { ...s.onboarding, completed: true } }));
        } catch {
          // Allow offline completion in demo mode
          set((s) => ({ onboarding: { ...s.onboarding, completed: true } }));
        }
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
