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
  // Track mounted IDs for fade-in
  const [mounted, setMounted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set(bubbles.map((b) => b.id));
    setMounted(ids);
  }, [bubbles]);

  if (bubbles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {bubbles.slice(0, 3).map((bubble) => {
        // Use the agent's live renderX/renderY for smooth following
        const agent = agents.find(a => a.id === bubble.agentId);
        const px = agent?.renderX ?? (bubble.pixelX ?? 0);
        const py = agent?.renderY ?? (bubble.pixelY ?? 0);
        const pos = pixelToScreen(px, py, canvasWidth, canvasHeight);
        const color = AGENT_COLORS[bubble.agentId] ?? '#00F0FF';
        const truncated =
          bubble.text.length > 60 ? bubble.text.slice(0, 57) + '...' : bubble.text;
        const isMounted = mounted.has(bubble.id);

        return (
          <div
            key={bubble.id}
            className="absolute rounded-xl px-3 py-1.5 text-xs max-w-[180px] bg-black/70 backdrop-blur-sm"
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
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
              style={{ backgroundColor: color }}
            />
            <span className="align-middle">{truncated}</span>
          </div>
        );
      })}
    </div>
  );
}
