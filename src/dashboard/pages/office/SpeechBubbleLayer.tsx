// src/dashboard/pages/office/SpeechBubbleLayer.tsx
import { useEffect, useState } from 'react';
import {
  CORE_DESK_POSITIONS,
  SPECIALIST_POSITIONS,
  CELL,
  AGENT_COLORS,
  CANVAS_W,
  CANVAS_H,
} from './constants';
import type { SpeechBubble, AgentId, CoreAgentId, SpecialistId } from './types';

interface Props {
  bubbles: SpeechBubble[];
  canvasWidth: number;
  canvasHeight: number;
}

function getAgentGridPos(agentId: AgentId): { x: number; y: number } {
  if (agentId in CORE_DESK_POSITIONS) {
    return CORE_DESK_POSITIONS[agentId as CoreAgentId];
  }
  if (agentId in SPECIALIST_POSITIONS) {
    return SPECIALIST_POSITIONS[agentId as SpecialistId];
  }
  return { x: 0, y: 0 };
}

function gridToScreen(
  gridX: number,
  gridY: number,
  containerW: number,
  containerH: number,
): { left: number; top: number } {
  const scaleX = containerW / CANVAS_W;
  const scaleY = containerH / CANVAS_H;
  return {
    left: gridX * CELL * scaleX + (CELL * scaleX) / 2,
    top: gridY * CELL * scaleY - 8,
  };
}

export function SpeechBubbleLayer({ bubbles, canvasWidth, canvasHeight }: Props) {
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
        const grid = getAgentGridPos(bubble.agentId);
        const pos = gridToScreen(grid.x, grid.y, canvasWidth, canvasHeight);
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
              transition: 'opacity 150ms ease-in',
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
