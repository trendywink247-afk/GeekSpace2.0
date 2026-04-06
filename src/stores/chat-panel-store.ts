import { create } from 'zustand';

/**
 * Tiny store that lets any component anywhere in the dashboard tree request
 * that the slide-out AgentChatPanel opens with an optional pre-filled message.
 *
 * `DashboardApp` subscribes to `nonce` and forwards `pendingMessage` to its
 * existing `openChat()` callback (introduced in PR #210), then calls
 * `consume()` to clear it. The `nonce` field is incremented on every request
 * so re-sending the same string still triggers the effect.
 *
 * Example:
 *   useChatPanelStore.getState().requestOpen('hello agent');
 */
interface ChatPanelStore {
  pendingMessage: string | null;
  /** Bumped on every requestOpen so identical messages still re-trigger effects. */
  nonce: number;
  requestOpen: (message?: string) => void;
  consume: () => void;
}

export const useChatPanelStore = create<ChatPanelStore>((set) => ({
  pendingMessage: null,
  nonce: 0,
  requestOpen: (message) =>
    set((s) => ({
      pendingMessage: message?.trim() || null,
      nonce: s.nonce + 1,
    })),
  consume: () => set({ pendingMessage: null }),
}));
