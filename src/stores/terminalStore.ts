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
  updateLastOutput: (output: string) => void;
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
      updateLastOutput: (output) =>
        set((state) => {
          if (state.history.length === 0) return state;
          const updated = [...state.history];
          updated[updated.length - 1] = { ...updated[updated.length - 1], output };
          return { history: updated };
        }),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'terminal-history',
      partialize: (state) => ({ history: state.history.slice(-50) }),
    }
  )
);
