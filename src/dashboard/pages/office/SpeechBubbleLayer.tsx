// src/dashboard/pages/office/SpeechBubbleLayer.tsx
import { useEffect, useState } from 'react';
import {
  AGENT_COLORS,
  CANVAS_W,
  CANVAS_H,
} from './constants';
import type { SpeechBubble, CanvasAgent } from './types';

interface Props {
  bubbles: SpeechBubble[];
  agents: CanvasAgent[];
  canvasWidth: number;
  canvasHeight: number;
}

function pixelToScreen(
  pixelX: number,
  pixelY: number,
  containerW: number,
  containerH: number,
): { left: number; top: number } {
  const scaleX = containerW / CANVAS_W;
  const scaleY = containerH / CANVAS_H;
  return {
    left: pixelX * scaleX,
    top: pixelY * scaleY - 8,
  };
}

export function SpeechBubbleLayer({ bubbles, agents, canvasWidth, canvasHeight }: Props) {
  // Only render interactive (DOM) bubbles — canvas bubbles are drawn by the renderer
  const interactiveBubbles = bubbles.filter(b => b.interactive);

  // Track mounted IDs for fade-in
  const [mounted, setMounted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set(interactiveBubbles.map((b) => b.id));
    setMounted(ids); // eslint-disable-line react-hooks/set-state-in-effect
  }, [interactiveBubbles]);

  if (interactiveBubbles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {interactiveBubbles.slice(0, 3).map((bubble) => {
        // Use the agent's live renderX/renderY for smooth following
        const agent = agents.find(a => a.id === bubble.agentId);
        const px = agent?.renderX ?? (bubble.pixelX ?? 0);
        const py = agent?.renderY ?? (bubble.pixelY ?? 0);
        const pos = pixelToScreen(px, py, canvasWidth, canvasHeight);
        const color = AGENT_COLORS[bubble.agentId] ?? '#A78BFA';
        const isMounted = mounted.has(bubble.id);

        return (
          <div
            key={bubble.id}
            className="absolute rounded-lg px-2 py-1 text-[10px] max-w-[200px] leading-tight bg-black/60 backdrop-blur-sm pointer-events-auto select-text"
            style={{
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              transform: 'translate(-50%, -100%)',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: `${color}30`,
              color: '#F4F6FF',
              opacity: isMounted ? 1 : 0,
              transition: 'opacity 150ms ease-in, left 33ms linear, top 33ms linear',
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-top mt-1"
              style={{ backgroundColor: color }}
            />
            <span className="align-middle" style={{ whiteSpace: 'pre-wrap' }}>{bubble.text}</span>
          </div>
        );
      })}
    </div>
  );
}
