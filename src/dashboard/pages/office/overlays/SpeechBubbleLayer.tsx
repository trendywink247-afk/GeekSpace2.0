// src/dashboard/pages/office/overlays/SpeechBubbleLayer.tsx
// DOM overlay for ALL speech bubbles (GS-011: consolidated from canvas+DOM to pure DOM).
// Priority queue: task_failure (4) > task_complete (3) > tool (2) > social (1).


import { AGENT_COLORS, CANVAS_W, CANVAS_H } from '../constants';
import type { SpeechBubble, CanvasAgent } from '../entities/types';

interface Props {
  bubbles: SpeechBubble[];
  agents: CanvasAgent[];
  canvasWidth: number;
  canvasHeight: number;
}

function pixelToScreen(px: number, py: number, cw: number, ch: number) {
  return { left: px * (cw / CANVAS_W), top: py * (ch / CANVAS_H) - 8 };
}

/**
 * Bubble priority constants.
 * Higher number = higher priority = preempts lower-priority bubble for same agent.
 */
export const BUBBLE_PRIORITY = {
  SOCIAL: 1,
  TOOL_CALL: 2,
  TASK_COMPLETE: 3,
  TASK_FAILURE: 4,
} as const;

function deduplicateByPriority(bubbles: SpeechBubble[]): SpeechBubble[] {
  const byAgent = new Map<string, SpeechBubble>();
  for (const b of bubbles) {
    const ex = byAgent.get(b.agentId);
    const bp = b.priority ?? BUBBLE_PRIORITY.SOCIAL;
    const ep = ex?.priority ?? BUBBLE_PRIORITY.SOCIAL;
    if (!ex || bp >= ep) byAgent.set(b.agentId, b);
  }
  return Array.from(byAgent.values());
}

export function SpeechBubbleLayer({ bubbles, agents, canvasWidth, canvasHeight }: Props) {
  // Parent prunes expired bubbles every ~200ms in the behavior tick; no need for Date.now() here
  const visible = deduplicateByPriority(bubbles).slice(0, 5);
  if (visible.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`@keyframes bubbleIn { from { opacity: 0; transform: translate(-50%, -90%); } to { opacity: 1; transform: translate(-50%, -100%); } }`}</style>
      {visible.map((bubble) => {
        const agent = agents.find((a) => a.id === bubble.agentId);
        const px = bubble.pixelX ?? agent?.renderX ?? 0;
        const py = bubble.pixelY ?? agent?.renderY ?? 0;
        const pos = pixelToScreen(px, py, canvasWidth, canvasHeight);
        const color = AGENT_COLORS[bubble.agentId] ?? '#A78BFA';

        const isInteractive = bubble.interactive ?? false;
        const priority = bubble.priority ?? BUBBLE_PRIORITY.SOCIAL;
        const isUrgent = priority >= BUBBLE_PRIORITY.TASK_FAILURE;

        return (
          <div
            key={bubble.id}
            className={[
              'absolute rounded-lg px-2 py-1 text-[10px] max-w-[200px] leading-tight backdrop-blur-sm',
              isInteractive ? 'pointer-events-auto select-text' : 'pointer-events-none',
              isUrgent ? 'animate-pulse' : '',
            ].join(' ')}
            style={{
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              transform: 'translate(-50%, -100%)',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: isUrgent ? `${color}80` : `${color}30`,
              color: '#F4F6FF',
              backgroundColor: isUrgent ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.60)',
              animation: 'bubbleIn 150ms ease forwards',
              transition: 'left 50ms linear, top 50ms linear',
              zIndex: priority,
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-top mt-1 flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="align-middle" style={{ whiteSpace: 'pre-wrap' }}>{bubble.text}</span>
          </div>
        );
      })}
    </div>
  );
}
