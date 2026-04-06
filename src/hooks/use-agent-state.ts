import { useState, useRef, useCallback, useEffect } from 'react';
import type { ToolStep as SSEToolStep } from '@/components/ToolStepIndicator';

/** Generate default content for SSE tool step events */
function getDefaultContent(type: string, tool?: string, agentName?: string, targetAgent?: string): string {
  switch (type) {
    case 'thinking': return 'Analyzing your request...';
    case 'tool_call': return `Running ${tool || 'tool'}...`;
    case 'tool_result': return `${tool || 'Tool'} complete`;
    case 'delegating': return `Delegating to ${targetAgent || 'another agent'}`;
    case 'comm_sent': return `${agentName || 'Agent'} sent a message`;
    case 'task_started': return 'Working on task...';
    case 'task_completed': return 'Task completed';
    case 'task_failed': return 'Task failed';
    case 'responding': return 'Composing response...';
    case 'done': return 'Finished';
    default: return 'Processing...';
  }
}

export function useAgentState() {
  // SSE tool step tracking (agent-state-bus)
  const [sseToolSteps, setSSEToolSteps] = useState<SSEToolStep[]>([]);
  const [sseActive, setSSEActive] = useState(false);
  const [activeDelegation, setActiveDelegation] = useState<{
    from: string; to: string; reason?: string; status: 'delegating' | 'working' | 'done';
  } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseStepTimersRef = useRef<Map<string, number>>(new Map());

  const connectAgentStateSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const token = localStorage.getItem('gs_token');
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
    const sseUrl = `${apiBase}/agent-state/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;
    es.onopen = () => { setSSEActive(true); };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          agentId: string; agentName: string; state: string;
          tool?: string; content?: string; targetAgent?: string;
          taskId?: string; timestamp: string;
        };
        const stepId = `sse-${data.state}-${data.tool || ''}-${Date.now()}`;
        const typeMap: Record<string, SSEToolStep['type']> = {
          thinking: 'thinking', tool_call: 'tool_call', tool_result: 'tool_result',
          responding: 'responding', done: 'done', delegating: 'delegating',
          comm_sent: 'comm_sent', task_started: 'task_started',
          task_completed: 'task_completed', task_failed: 'task_failed',
        };
        const stepType = typeMap[data.state];
        if (!stepType) return;
        if (stepType === 'tool_result' || stepType === 'task_completed') {
          setSSEToolSteps((prev) => {
            const mt = stepType === 'tool_result' ? 'tool_call' : 'task_started';
            const idx = prev.findIndex((s) => s.status === 'active' && s.type === mt && s.tool === data.tool);
            if (idx >= 0) {
              const u = [...prev];
              const st = sseStepTimersRef.current.get(u[idx].id) || Date.now();
              u[idx] = { ...u[idx], status: 'done', content: data.content || u[idx].content, durationMs: Date.now() - st };
              return u;
            }
            return [...prev, { id: stepId, type: stepType, tool: data.tool, content: data.content || `${data.tool || 'Task'} complete`, status: 'done' as const, timestamp: data.timestamp }];
          });
          return;
        }
        if (stepType === 'task_failed') {
          setSSEToolSteps((prev) => {
            const idx = prev.findIndex((s) => s.status === 'active' && s.type === 'task_started');
            if (idx >= 0) {
              const u = [...prev];
              const st = sseStepTimersRef.current.get(u[idx].id) || Date.now();
              u[idx] = { ...u[idx], status: 'error', content: data.content || 'Task failed', durationMs: Date.now() - st };
              return u;
            }
            return [...prev, { id: stepId, type: stepType, content: data.content || 'Task failed', status: 'error' as const, timestamp: data.timestamp }];
          });
          return;
        }
        if (stepType === 'done') {
          setSSEToolSteps((prev) => prev.map((s) => s.status === 'active' ? { ...s, status: 'done' as const } : s));
          // Clear delegation indicator when agent is done
          setActiveDelegation((prev) => prev ? { ...prev, status: 'done' } : null);
          setTimeout(() => setActiveDelegation(null), 2000);
          return;
        }
        // Track delegation events for live indicator
        if (stepType === 'delegating' && data.targetAgent) {
          setActiveDelegation({ from: data.agentId, to: data.targetAgent, reason: data.content, status: 'delegating' });
        }
        if (stepType === 'comm_sent' && data.targetAgent) {
          setActiveDelegation((prev) => prev ? { ...prev, status: 'working' } : null);
        }
        if (stepType === 'responding') {
          setSSEToolSteps((prev) => prev.map((s) => s.status === 'active' && s.type === 'thinking' ? { ...s, status: 'done' as const } : s));
          return;
        }
        const defaultContent = data.content || getDefaultContent(stepType, data.tool, data.agentName, data.targetAgent);
        const newStep: SSEToolStep = { id: stepId, type: stepType, tool: data.tool, content: defaultContent, status: 'active', timestamp: data.timestamp };
        sseStepTimersRef.current.set(stepId, Date.now());
        if (stepType === 'thinking') {
          setSSEToolSteps((prev) => {
            const has = prev.some((s) => s.type === 'thinking' && s.status === 'active');
            if (has) return prev.map((s) => s.type === 'thinking' && s.status === 'active' ? { ...s, content: newStep.content } : s);
            return [...prev, newStep];
          });
          return;
        }
        if (stepType === 'tool_call') {
          setSSEToolSteps((prev) => [...prev.map((s) => s.type === 'thinking' && s.status === 'active' ? { ...s, status: 'done' as const } : s), newStep]);
          return;
        }
        setSSEToolSteps((prev) => [...prev, newStep]);
      } catch { /* ignore malformed SSE data */ }
    };
    es.onerror = () => { setSSEActive(false); };
  }, []);

  const disconnectAgentStateSSE = useCallback(() => {
    if (eventSourceRef.current) { 
      eventSourceRef.current.close(); 
      eventSourceRef.current = null; 
    }
    setSSEActive(false);
    sseStepTimersRef.current.clear();
  }, []);

  const clearSSEToolSteps = useCallback(() => {
    setSSEToolSteps([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      sseStepTimersRef.current.clear();
    };
  }, []);

  return {
    sseToolSteps,
    sseActive,
    activeDelegation,
    connectAgentStateSSE,
    disconnectAgentStateSSE,
    clearSSEToolSteps,
  };
}