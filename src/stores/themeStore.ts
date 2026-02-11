import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeStore {
  mode: 'system' | 'light' | 'dark';
  accentColor: string;
  accentPresets: string[];
  setMode: (mode: 'system' | 'light' | 'dark') => void;
  setAccentColor: (color: string) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'dark',
      accentColor: '#7B61FF',
      accentPresets: [
        '#7B61FF', // Purple (default)
        '#61FF7B', // Green
        '#FF61DC', // Pink
        '#61B5FF', // Blue
        '#FFD761', // Yellow
        '#FF6161', // Red
        '#61FFD7', // Teal
        '#FF9B61', // Orange
      ],
      setMode: (mode) => set({ mode }),
      setAccentColor: (accentColor) => {
        set({ accentColor });
        // Update CSS custom property for dynamic accent
        document.documentElement.style.setProperty('--accent-dynamic', accentColor);
      },
    }),
    { name: 'gs-theme' },
  ),
);
