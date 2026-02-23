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
  background: string | null;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
  applyTheme: () => void;
  setBackground: (background: string | null) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      accentColor: '#00F0FF',
      accentPresets: [
        '#00F0FF', '#FF2D78', '#8B5CF6', '#00B4FF',
        '#FFB800', '#FF3366', '#00FF88', '#FF6B2B',
      ],
      background: null,
      setMode: (mode) => {
        set({ mode });
        applyThemeToDOM(mode);
      },
      setAccentColor: (accentColor) => {
        set({ accentColor });
        document.documentElement.style.setProperty('--accent-dynamic', accentColor);
      },
      applyTheme: () => applyThemeToDOM(get().mode),
      setBackground: (background) => set({ background }),
    }),
    { name: 'gs-theme' },
  ),
);
