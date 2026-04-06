import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'system' | 'light' | 'dark';

function applyThemeToDOM(mode: ThemeMode) {
  const effective = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(effective);
  document.documentElement.setAttribute('data-theme', effective);
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
      accentColor: '#8B5CF6',
      accentPresets: [
        '#8B5CF6', '#ef4444', '#8B5CF6', '#00B4FF',
        '#F59E0B', '#F59E0B', '#10B981', '#FF6B2B',
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
