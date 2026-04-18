/**
 * @fileoverview Test suite for agentBehavior.ts
 * Tests behavior state machine, social interactions, and animation sequencing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAgentBehaviorMode,
  getAgentPose,
  tickBehavior,
  reserveSmartObject,
  releaseSmartObject,
  startSocializing,
  stopSocializing,
  type BehaviorState,
} from '../agent-behavior';
import type { CanvasAgent, AgentId } from '../types';

describe('agentBehavior', () => {
  let agents: CanvasAgent[];

  beforeEach(() => {
    // TODO: Initialize agents with default behavior state
    // agents = [
    //   { id: 'weebo', x: 10, y: 15, state: 'idle', path: [] },
    //   { id: 'edith', x: 12, y: 16, state: 'idle', path: [] },
    // ];
    agents = [];
  });

  afterEach(() => {
    // Cleanup reservations
    // releaseSmartObject('weebo');
    // releaseSmartObject('edith');
  });

  // ─── Behavior mode queries ───────────────────────────────────────────
  describe('getAgentBehaviorMode', () => {
    it('returns "sitting" when agent at desk with no path', () => {
      // TODO: Create agent with x=10, y=15, path=[], state='idle'
      const agent = agents[0];
      if (!agent) return;
      const mode = getAgentBehaviorMode(agent);
      // expect(mode).toBe('sitting');
    });

    it('returns "wandering" when agent has active path', () => {
      // TODO: Create agent with path.length > 0
      const agent = agents[0];
      if (!agent) return;
      // agent.path = [{x: 11, y: 15}, {x: 12, y: 15}];
      const mode = getAgentBehaviorMode(agent);
      // expect(mode).toBe('wandering');
    });

    it('returns "working" when SSE event triggered (state="busy")', () => {
      // TODO: Agent with state='busy' (from SSE)
      const agent = agents[0];
      if (!agent) return;
      const mode = getAgentBehaviorMode(agent);
      // expect(mode).toMatch(/working|busy/);
    });

    it('returns "socializing" when interacting with nearby agent', () => {
      // TODO: Two agents within 2 tiles, startSocializing called
      const agent = agents[0];
      if (!agent) return;
      // startSocializing(agent.id, 'edith');
      const mode = getAgentBehaviorMode(agent);
      // expect(mode).toBe('socializing');
    });

    it('returns "returning" when walking back to home desk', () => {
      // TODO: Agent at non-home location with path back to home
      const agent = agents[0];
      if (!agent) return;
      const mode = getAgentBehaviorMode(agent);
      // expect(mode).toBe('returning');
    });

    it('returns "group-meeting" when 3+ agents at meeting table', () => {
      // TODO: Create 3 agents at meeting_room table
      const agent = agents[0];
      if (!agent) return;
      const mode = getAgentBehaviorMode(agent);
      // expect(mode).toBe('group-meeting');
    });
  });

  // ─── Animation pose (frame selection) ──────────────────────────────
  describe('getAgentPose', () => {
    it('returns "idle" pose when agent at rest', () => {
      // TODO: Create idle agent
      const agent = agents[0];
      if (!agent) return;
      const pose = getAgentPose(agent);
      // expect(pose).toMatch(/idle|typing|looking|stretching/);
    });

    it('returns "walking" pose when moving along path', () => {
      // TODO: Create walking agent
      const agent = agents[0];
      if (!agent) return;
      // agent.path = [{x: 11, y: 15}];
      const pose = getAgentPose(agent);
      // expect(pose).toBe('walking');
    });

    it('returns "talking" pose when socializing', () => {
      // TODO: Create socializing agent
      const agent = agents[0];
      if (!agent) return;
      const pose = getAgentPose(agent);
      // expect(pose).toBe('talking');
    });

    it('returns fidget type ("typing", "looking", "stretching") for idle variants', () => {
      // TODO: Agent at desk with different fidget states
      const agent = agents[0];
      if (!agent) return;
      const pose = getAgentPose(agent);
      expect(['typing', 'looking', 'stretching', 'idle']).toContain(pose);
    });
  });

  // ─── Behavior state transitions ──────────────────────────────────────
  describe('tickBehavior — State Transitions', () => {
    it('transitions from sitting to wandering when timer expires', () => {
      // TODO: Agent sitting with timer = 0
      // Call tickBehavior
      // Expect mode changes to wandering, target set to smart object
      // expect(getAgentBehaviorMode(agent)).toBe('wandering');
    });

    it('transitions from wandering to sitting when reaching target', () => {
      // TODO: Agent walking to coffee machine, reaches it
      // Call tickBehavior
      // Expect mode changes to sitting
      // expect(getAgentBehaviorMode(agent)).toBe('sitting');
    });

    it('chooses random smart object when wandering (coffee, desk, couch, etc)', () => {
      // TODO: Multiple smart objects available
      // Call tickBehavior on wandering agent
      // Verify targetPoint set to one of available objects
      // expect(agent.targetPoint).toBeDefined();
    });

    it('respects room boundaries (does not wander outside current room)', () => {
      // TODO: Agent in workspace, should not target lounge objects
      // Call tickBehavior repeatedly
      // Verify agent stays in workspace
    });

    it('transitions to socializing when nearby agent detected', () => {
      // TODO: Two agents within 3 tiles of each other
      // Call tickBehavior on both
      // Expect both transition to socializing mode
      // expect(getAgentBehaviorMode(agent1)).toBe('socializing');
    });

    it('transitions from socializing to returning when social duration expires', () => {
      // TODO: Socializing agents with socialTimer = 0
      // Call tickBehavior
      // Expect transition back to wandering/returning
    });

    it('cancels wandering if smart object becomes occupied', () => {
      // TODO: Agent walking to desk, desk reserved by another agent
      // Call tickBehavior
      // Expect agent to pick new target
    });
  });

  // ─── Social interaction sequencing ───────────────────────────────────
  describe('Social Interactions', () => {
    it('initiates social greeting (phase 0: approach)', () => {
      // TODO: Agent1 sees Agent2 nearby
      // Call tickBehavior
      // Expect both agents face each other (facing directions align)
      // expect(agent1.facing).toBe('right'); // toward agent2
      // expect(agent2.facing).toBe('left');  // toward agent1
    });

    it('exchanges speech bubbles during social (phase 1-3: talking)', () => {
      // TODO: Agents in social mode, phase > 0
      // Call tickBehavior
      // Expect speechBubble on each agent
      // expect(agent1.speechBubble).toBeDefined();
    });

    it('selects phrase based on interaction type', () => {
      // TODO: Two agents at coffee machine (coffee behavior)
      // Expect phrase from COFFEE_PHRASES (e.g., "Need coffee", "Morning brew!")
      // const phrase = agent1.speechBubble?.text;
      // expect(['Need coffee', 'Morning brew!', ...]).toContain(phrase);
    });

    it('gradually increases social distance in farewell (phase 4)', () => {
      // TODO: Social interaction ending
      // Agents should move apart
      // expect(distanceBetween(agent1, agent2)).toBeGreaterThan(initialDistance);
    });

    it('completes social when agents separate or timer expires', () => {
      // TODO: Agents walk away from each other
      // Call tickBehavior
      // Expect transition back to wandering/sitting
      // expect(getAgentBehaviorMode(agent1)).not.toBe('socializing');
    });

    it('nearby agents (3+) trigger group-meeting mode at meeting table', () => {
      // TODO: Create 3 agents at meeting_room table
      // Call tickBehavior
      // Expect all 3 transition to group-meeting
      // expect(getAgentBehaviorMode(agent1)).toBe('group-meeting');
    });

    it('group-meeting agents face center of table (synchronized)', () => {
      // TODO: 3 agents in group meeting
      // Expect facing directions point toward table center
      // expect(agent1.facing).toBe('right'); // or 'down', toward center
    });

    it('group-meeting completes when agent leaves or timer expires', () => {
      // TODO: One agent walks away from table
      // Call tickBehavior
      // Expect mode changes back to wandering
    });
  });

  // ─── Fidget animations (idle variants) ───────────────────────────────
  describe('Fidget Animations', () => {
    it('cycles through fidget types (typing, looking, stretching) while sitting', () => {
      // TODO: Agent sitting with fidgetTimer ticking down
      // As timer passes thresholds, fidgetType should change
      const fidgetSequence: string[] = [];
      // for (i = 0; i < 10; i++) {
      //   tickBehavior(agent, allAgents, recentWorkers);
      //   fidgetSequence.push(agent.fidgetType);
      // }
      // expect(fidgetSequence).toContain('typing');
      // expect(fidgetSequence).toContain('looking');
    });

    it('fidget type changes reflect animation frame (0–15 for 16-frame sprite sheet)', () => {
      // TODO: fidgetType='typing' should select frames 0–3 (typing frames)
      // fidgetType='looking' should select frames 4–7
      // fidgetType='stretching' should select frames 8–11
      // Verify pose reflects current fidgetType
    });

    it('resets fidget timer after each animation', () => {
      // TODO: fidgetTimer starts at N, ticks down to 0
      // Call tickBehavior when timer = 0
      // Expect timer reset to new random value
    });

    it('"working" state skips fidgets (typing animation disabled)', () => {
      // TODO: Agent in working mode (state='busy')
      // Should not cycle through fidgets, instead show "thinking" pose
    });
  });

  // ─── Speed personality ───────────────────────────────────────────────
  describe('Speed Personality Modifiers', () => {
    it('applies per-agent speed multiplier (0.85–1.2)', () => {
      // TODO: Agent speed = 0.9 (slower)
      // Expected move distance per tick = baseSpeed * 0.9
      // Agent speed = 1.15 (faster)
      // Expected move distance per tick = baseSpeed * 1.15
    });

    it('affects walking animation frame rate', () => {
      // Slower agent: fewer animation frames per sec (slower walk cycle)
      // Faster agent: more animation frames per sec (quicker walk cycle)
      // TODO: Measure frame progression
    });

    it('affects social timer duration (faster agents socialize longer)', () => {
      // TODO: Agent with high speed (1.15) socializes longer
      // Agent with low speed (0.85) socializes shorter
    });
  });

  // ─── Facing direction updates ────────────────────────────────────────
  describe('Facing Direction', () => {
    it('updates facing to match movement direction', () => {
      // Agent walking right: expect facing='right'
      // Agent walking left: expect facing='left'
      // Agent walking down: expect facing='down'
      // Agent walking up: expect facing='up'
      // TODO: Create agent with path going right
      // Call tickBehavior
      // expect(agent.facing).toBe('right');
    });

    it('updates facing when socializing (both agents face each other)', () => {
      // Agent1 left of Agent2: Agent1 faces right, Agent2 faces left
      // TODO: Create agent pair with startSocializing
      // Call tickBehavior
      // expect(agent1.facing).toBe('right');
      // expect(agent2.facing).toBe('left');
    });

    it('maintains last facing direction when idle', () => {
      // Agent at desk facing right
      // Even if no movement, facing stays right
      // TODO: Agent with facing='right', path=[]
      // Call tickBehavior
      // expect(agent.facing).toBe('right');
    });
  });

  // ─── Smart object reservation ────────────────────────────────────────
  describe('Smart Object Reservations', () => {
    it('reserves smart object when agent targets it', () => {
      // TODO: Agent picks coffee machine as target
      // Call tickBehavior
      // Expect occupancy.reservePoint called for coffee machine position
    });

    it('releases smart object when agent leaves', () => {
      // TODO: Agent at coffee machine, then starts wandering
      // Call tickBehavior
      // Expect occupancy.releasePoint called
    });

    it('prevents two agents from reserving same object', () => {
      // TODO: Agent1 reserves coffee machine
      // Agent2 targets same coffee machine (should pick another)
      // Call tickBehavior on Agent2
      // Expect Agent2 picks different object
    });

    it('picks closest available object when preferred is taken', () => {
      // TODO: Agent wants coffee, but all coffee machines reserved
      // Should pick couch or other nearby object
      const agent = agents[0];
      if (!agent) return;
      // Call tickBehavior
      // Verify targetPoint set to available object
      // expect(agent.targetPoint).toBeDefined();
    });
  });

  // ─── Pathfinding integration ────────────────────────────────────────
  describe('Pathfinding Integration', () => {
    it('generates path to target smart object on each decision tick', () => {
      // TODO: Agent targets coffee machine at (8, 3)
      // Call tickBehavior
      // Expect agent.path generated via BFS
      // expect(agent.path.length).toBeGreaterThan(0);
    });

    it('respects collision map (path avoids blocked tiles)', () => {
      // TODO: Create path that would cross blocked tile
      // Call tickBehavior
      // Verify final path avoids block
    });

    it('updates path if blocked by moving agent', () => {
      // TODO: Agent1 walking to desk, Agent2 blocks path
      // Call tickBehavior
      // Expect path recalculated to avoid Agent2
    });

    it('completes path without overshooting target', () => {
      // TODO: Agent walking to (10, 15)
      // Call tickBehavior until arrival
      // Expect agent stops at (10, 15), doesn't walk past
      // expect(agent.x).toBe(10);
      // expect(agent.y).toBe(15);
    });
  });

  // ─── Perception-driven decisions ────────────────────────────────────
  describe('Perception-Driven Behavior', () => {
    it('detects nearby agents (within 5 tiles) for socializing', () => {
      // TODO: Agent1 at (10, 15), Agent2 at (12, 16) — distance 3
      // Call tickBehavior on Agent1
      // Expect detection of Agent2, potential social initiation
    });

    it('ignores distant agents (> 5 tiles)', () => {
      // TODO: Agent1 at (10, 15), Agent2 at (20, 20) — distance 15
      // Call tickBehavior
      // Expect no social interaction
    });

    it('prioritizes interactions with agents in same room', () => {
      // TODO: Two agents in workspace, one in meeting room
      // Should socialize with same-room agent
    });

    it('chooses smart object based on room (coffee in pantry, desk in workspace)', () => {
      // TODO: Agent in workspace should not wander to lounge couch
      // Expect only workspace-appropriate targets picked
    });
  });

  // ─── Edge cases and error handling ───────────────────────────────────
  describe('Edge Cases', () => {
    it('handles agent at out-of-bounds coordinate gracefully', () => {
      // TODO: Create agent with x=-5, y=100
      // Call tickBehavior
      // Should not crash, should snap to nearest walkable
    });

    it('handles missing social target (agent disappeared)', () => {
      // TODO: Agent socializing with target, remove target from agents array
      // Call tickBehavior
      // Should not crash, should return to wandering
    });

    it('handles empty smart objects list (none available)', () => {
      // TODO: No smart objects in current room
      // Call tickBehavior on wandering agent
      // Should pick new room or stay in current room idle
    });

    it('handles simultaneous state changes (mode, facing, path, animation)', () => {
      // TODO: In single tickBehavior call, many things happen
      // Expect all updates to be consistent (no stale state)
    });

    it('maintains state after many ticks (no memory leaks)', () => {
      // TODO: Call tickBehavior 1000 times
      // Verify memory stable, no growing buffers
    });
  });
});
