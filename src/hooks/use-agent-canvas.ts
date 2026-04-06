// Universal hook — every page imports this to trigger canvas animations
// when meaningful actions complete

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';

export type AgentId = 'weebo' | 'edith' | 'jarvis' | 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';

interface AgentCanvasOptions {
  agent: AgentId;
  page: string;
}

export function useAgentCanvas({ agent, page }: AgentCanvasOptions) {
  const token = useAuthStore((s) => s.token);

  const notifyStart = useCallback(async (action: string) => {
    try {
      await fetch('/api/agent-state/emit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: agent,
          state: 'task_started',
          content: `${action} on ${page}`,
          tool: page,
        }),
      });
    } catch { /* never block user action on canvas failure */ }
  }, [agent, page, token]);

  const notifyDone = useCallback(async (result: string) => {
    try {
      await fetch('/api/agent-state/emit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: agent,
          state: 'task_completed',
          content: result,
          tool: page,
        }),
      });
    } catch { /* never block user action on canvas failure */ }
  }, [agent, page, token]);

  const notifyFail = useCallback(async (error: string) => {
    try {
      await fetch('/api/agent-state/emit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: agent,
          state: 'task_failed',
          content: error,
          tool: page,
        }),
      });
    } catch { /* never block user action on canvas failure */ }
  }, [agent, page, token]);

  return { notifyStart, notifyDone, notifyFail };
}
