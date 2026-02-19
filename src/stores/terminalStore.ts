import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  timestamp: number;
  type: 'input' | 'output' | 'error';
}

interface TerminalState {
  history: TerminalCommand[];
  addCommand: (cmd: Omit<TerminalCommand, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      history: [],
      addCommand: (cmd) =>
        set((state) => ({
          history: [
            ...state.history.slice(-49), // Keep last 50
            { ...cmd, id: crypto.randomUUID(), timestamp: Date.now() },
          ],
        })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'terminal-history',
      partialize: (state) => ({ history: state.history.slice(-50) }),
    }
  )
);
