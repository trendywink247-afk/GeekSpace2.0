import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'system' | 'light' | 'dark';

function applyThemeToDOM(mode: ThemeMode) {
  const effective = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.classList.remove('dark', 'light');
  if (effective === 'dark') document.documentElement.classList.add('dark');
}

interface ThemeStore {
  mode: ThemeMode;
  accentColor: string;
  accentPresets: string[];
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
  applyTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      accentColor: '#7B61FF',
      accentPresets: [
        '#7B61FF', '#61FF7B', '#FF61DC', '#61B5FF',
        '#FFD761', '#FF6161', '#61FFD7', '#FF9B61',
      ],
      setMode: (mode) => {
        set({ mode });
        applyThemeToDOM(mode);
      },
      setAccentColor: (accentColor) => {
        set({ accentColor });
        document.documentElement.style.setProperty('--accent-dynamic', accentColor);
      },
      applyTheme: () => applyThemeToDOM(get().mode),
    }),
    { name: 'gs-theme' },
  ),
);
