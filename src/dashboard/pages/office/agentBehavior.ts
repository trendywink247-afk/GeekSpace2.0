// src/dashboard/pages/office/agentBehavior.ts
// Pure TypeScript module — manages idle agent behaviors (wandering, socializing,
// fidgeting). Called every canvas tick (200ms) by OfficeStage. Zero AI cost.

import type { CanvasAgent, AgentId, SpeechBubble } from './types';
import {
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  AGENT_COLORS,
} from './constants';
import type { CoreAgentId, SpecialistId } from './types';

// ── Hotspots — places agents wander to ─────────────────────────────────────

interface Hotspot {
  name: string;
  x: number;
  y: number;
}

// Main office (left side, cols 0-27)
const OFFICE_HOTSPOTS: Hotspot[] = [
  { name: 'coffee', x: 22, y: 14 },
  { name: 'whiteboard', x: 2, y: 12 },
  { name: 'couch', x: 20, y: 17 },
  { name: 'plant', x: 1, y: 17 },
  { name: 'water', x: 24, y: 8 },
  { name: 'bookshelf', x: 8, y: 15 },
  { name: 'window', x: 0, y: 8 },
  { name: 'snacks', x: 18, y: 15 },
];

// Specialist lab (right side, cols 30-45)
const LAB_HOTSPOTS: Hotspot[] = [
  { name: 'lab_bench', x: 36, y: 14 },
  { name: 'lab_screen', x: 42, y: 6 },
  { name: 'lab_plant', x: 44, y: 16 },
];

// ── Social chat phrases (random, no AI cost) ───────────────────────────────

const CASUAL_PHRASES = [
  'Nice work!', 'Coffee?', "How's that task?", 'Almost done!',
  'Check this out', 'Good morning!', "Let's sync", 'Ship it!',
  'Looks great', 'Need help?', 'On it!', 'High five!',
  'Bug fixed!', 'Deployed!', 'Code review?', 'Meeting soon',
  'Love it!', 'Great idea!', "Let's go!", 'Team work!',
];

// ── Agent behavior state ────────────────────────────────────────────────────

type FidgetType = 'none' | 'typing' | 'looking' | 'stretching';
type BehaviorMode = 'sitting' | 'wandering' | 'socializing' | 'returning' | 'working';

interface BehaviorState {
  mode: BehaviorMode;
  targetHotspot: Hotspot | null;
  socialTarget: AgentId | null;
  timer: number;           // ticks until next action
  fidgetTimer: number;     // ticks until next fidget
  fidgetType: FidgetType;
  speed: number;           // pixels per tick (normal=3, fast=6, slow=1.5)
  socialStep: number;      // which step of social interaction (0-5)
}

const behaviorStates = new Map<AgentId, BehaviorState>();

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeBubble(agentId: AgentId, text: string): SpeechBubble {
  const now = Date.now();
  return {
    id: `social-${now}-${Math.random().toString(36).slice(2, 5)}`,
    agentId,
    text,
    color: AGENT_COLORS[agentId] || '#00F0FF',
    createdAt: now,
    expiresAt: now + 3000,
  };
}

function getHomePosition(agent: CanvasAgent): { x: number; y: number } {
  if (agent.isSpecialist) {
    const pos = SPECIALIST_POSITIONS[agent.id as SpecialistId];
    if (pos) {
      return { x: pos.x, y: pos.y > 2 ? pos.y - 1 : pos.y + 2 };
    }
  } else {
    const pos = CORE_DESK_POSITIONS[agent.id as CoreAgentId];
    if (pos) {
      return { x: pos.x + 1, y: pos.y > 2 ? pos.y - 1 : pos.y + 2 };
    }
  }
  return { x: agent.x, y: agent.y };
}

// ── Initialize behavior for an agent ────────────────────────────────────────

export function initBehavior(agent: CanvasAgent): void {
  behaviorStates.set(agent.id, {
    mode: 'sitting',
    targetHotspot: null,
    socialTarget: null,
    timer: randomInt(20, 60),      // 4-12 seconds until first action
    fidgetTimer: randomInt(10, 30),
    fidgetType: 'none',
    speed: 3,
    socialStep: 0,
  });
}

// ── Cancel idle behavior — snap agent back to desk ──────────────────────────
// Called when an agent receives a real task (state changes to thinking, etc.)

export function cancelIdleBehavior(agentId: AgentId): void {
  const bState = behaviorStates.get(agentId);
  if (!bState) return;
  bState.mode = 'sitting';
  bState.targetHotspot = null;
  bState.socialTarget = null;
  bState.socialStep = 0;
  bState.timer = randomInt(30, 80);
  bState.fidgetType = 'none';
}

// ── Main tick function — call every 200ms ───────────────────────────────────
// Returns: new bubbles to display, whether any agent positions changed

export function tickBehaviors(
  agents: CanvasAgent[],
  _tick: number,
): { updatedAgents: CanvasAgent[]; newBubbles: SpeechBubble[] } {
  const newBubbles: SpeechBubble[] = [];
  let changed = false;

  const updatedAgents = agents.map(agent => {
    // Skip agents actively working (not idle)
    if (agent.state !== 'idle' && agent.state !== 'done') return agent;
    // Skip dormant specialists
    if (agent.isDormant) return agent;

    let bState = behaviorStates.get(agent.id);
    if (!bState) {
      initBehavior(agent);
      bState = behaviorStates.get(agent.id)!;
    }

    // Decrease timers
    bState.timer--;
    bState.fidgetTimer--;

    const updated = { ...agent };

    switch (bState.mode) {
      case 'sitting': {
        // Desk fidgeting
        if (bState.fidgetTimer <= 0) {
          const fidgets: FidgetType[] = ['typing', 'looking', 'stretching', 'none'];
          bState.fidgetType = fidgets[randomInt(0, fidgets.length - 1)];
          bState.fidgetTimer = randomInt(8, 25); // 1.6-5 seconds
        }

        // Time to wander or socialize?
        if (bState.timer <= 0) {
          const roll = Math.random();
          if (roll < 0.4) {
            // Wander to hotspot
            const spots = agent.isSpecialist ? LAB_HOTSPOTS : OFFICE_HOTSPOTS;
            const spot = spots[randomInt(0, spots.length - 1)];
            bState.mode = 'wandering';
            bState.targetHotspot = spot;
            bState.speed = 2.5 + Math.random() * 1.5;
            bState.timer = randomInt(15, 40); // time to linger at hotspot
            updated.targetX = spot.x;
            updated.targetY = spot.y;
            changed = true;
          } else if (roll < 0.7) {
            // Social visit — find a nearby non-dormant idle agent
            const nearby = agents.filter(a =>
              a.id !== agent.id && !a.isDormant
              && (a.state === 'idle' || a.state === 'done')
              && Math.abs(a.x - agent.x) < 15
              && Math.abs(a.y - agent.y) < 10,
            );
            if (nearby.length > 0) {
              const target = nearby[randomInt(0, nearby.length - 1)];
              bState.mode = 'socializing';
              bState.socialTarget = target.id;
              bState.socialStep = 0;
              bState.speed = 3;
              bState.timer = 15; // cooldown between social steps
              // Walk to near the target
              updated.targetX = target.x + (agent.x > target.x ? 1 : -1);
              updated.targetY = target.y;
              changed = true;
            } else {
              bState.timer = randomInt(15, 40);
            }
          } else {
            // Just reset timer — stay sitting a bit longer
            bState.timer = randomInt(15, 50);
          }
        }
        break;
      }

      case 'wandering': {
        // Arrived at hotspot?
        if (agent.x === agent.targetX && agent.y === agent.targetY) {
          // Linger at hotspot then return home
          if (bState.timer <= 0) {
            bState.mode = 'returning';
            const home = getHomePosition(agent);
            updated.targetX = home.x;
            updated.targetY = home.y;
            bState.speed = 1.5 + Math.random();
            changed = true;
          }
        }
        break;
      }

      case 'socializing': {
        // Near social target?
        const target = agents.find(a => a.id === bState!.socialTarget);
        if (!target) {
          // Target gone — head home
          bState.mode = 'returning';
          const home = getHomePosition(agent);
          updated.targetX = home.x;
          updated.targetY = home.y;
          changed = true;
          break;
        }

        const dist = Math.abs(agent.x - target.x) + Math.abs(agent.y - target.y);
        if (dist <= 2) {
          // Exchange messages based on socialStep
          if (bState.socialStep === 0 && bState.timer <= 0) {
            // First message from visitor
            bState.socialStep = 1;
            newBubbles.push(makeBubble(agent.id, CASUAL_PHRASES[randomInt(0, CASUAL_PHRASES.length - 1)]));
            bState.timer = 10; // pause 2 seconds
          } else if (bState.socialStep === 1 && bState.timer <= 0) {
            // Response from target
            bState.socialStep = 2;
            newBubbles.push(makeBubble(target.id, CASUAL_PHRASES[randomInt(0, CASUAL_PHRASES.length - 1)]));
            bState.timer = 10;
          } else if (bState.socialStep === 2 && bState.timer <= 0) {
            // Final message
            bState.socialStep = 3;
            newBubbles.push(makeBubble(agent.id, CASUAL_PHRASES[randomInt(0, CASUAL_PHRASES.length - 1)]));
            bState.timer = 8;
          } else if (bState.socialStep >= 3 && bState.timer <= 0) {
            // Done socializing — return to desk
            bState.mode = 'returning';
            const home = getHomePosition(agent);
            updated.targetX = home.x;
            updated.targetY = home.y;
            bState.speed = 2;
            bState.socialTarget = null;
            bState.socialStep = 0;
            changed = true;
          }
        }
        break;
      }

      case 'returning': {
        // Arrived home?
        if (agent.x === agent.targetX && agent.y === agent.targetY) {
          bState.mode = 'sitting';
          bState.timer = randomInt(20, 60); // 4-12s before next action
          bState.fidgetTimer = randomInt(5, 15);
          bState.targetHotspot = null;
          changed = true;
        }
        break;
      }

      // 'working' mode — no-op, handled by real task system
      default:
        break;
    }

    return updated;
  });

  return { updatedAgents: changed ? updatedAgents : agents, newBubbles };
}

// ── Query functions for the renderer ────────────────────────────────────────

export function getAgentFidget(agentId: AgentId): FidgetType {
  return behaviorStates.get(agentId)?.fidgetType ?? 'none';
}

export function getAgentBehaviorMode(agentId: AgentId): BehaviorMode {
  return behaviorStates.get(agentId)?.mode ?? 'sitting';
}

// ── Reset all behaviors (e.g., on unmount) ──────────────────────────────────

export function resetAllBehaviors(): void {
  behaviorStates.clear();
}
