/**
 * @fileoverview Test suite for perception.ts
 * Tests agent environment sensing and perception state building
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { perceive, type AgentPerception } from '../world/perception';
import type { CanvasAgent } from '../entities/types';

describe('perception', () => {
  let agents: CanvasAgent[];

  beforeEach(() => {
    // TODO: Create mock agents with position and state
    agents = [
      // Agent at (10, 15) — workspace
      // Agent at (12, 16) — 2 tiles away (nearby)
      // Agent at (20, 20) — 10+ tiles away (far)
    ];
  });

  // ─── Room detection ────────────────────────────────────────────────────
  describe('perceive — currentRoom', () => {
    it('returns correct room for agent in workspace', () => {
      // TODO: Setup agent at (5, 17) — workspace bounds
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception.currentRoom?.id).toBe('workspace');
    });

    it('returns null for agent in uncovered area (no room)', () => {
      // TODO: Setup agent outside all room bounds
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception.currentRoom).toBe(null);
    });

    it('returns overlapping room (pantry inside patio)', () => {
      // TODO: Setup agent at (6, 3) — inside both pantry and patio
      // Should return pantry (more specific, appears first in ROOMS array)
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception.currentRoom?.id).toBe('pantry');
    });

    it('tests all 7 room types', () => {
      const roomIds = ['patio', 'pantry', 'lounge', 'utility_corridor', 'stairs_transition', 'workspace', 'meeting_room'];
      // TODO: For each room, place agent inside and verify detection
      roomIds.forEach((roomId) => {
        // TODO: Test perception for agent in this room
      });
    });
  });

  // ─── Nearby agent detection ────────────────────────────────────────────
  describe('perceive — nearbyAgents', () => {
    it('returns agents within 5-tile Manhattan distance', () => {
      // TODO: Agent1 at (10, 15), Agent2 at (12, 16) — distance 3
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception.nearbyAgents.length).toBeGreaterThan(0);
      expect(perception.nearbyAgents[0].distance).toBeLessThanOrEqual(5);
    });

    it('excludes agents beyond 5-tile radius', () => {
      // TODO: Agent1 at (10, 15), Agent2 at (20, 20) — distance 15
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      const tooFar = perception.nearbyAgents.filter((a) => a.distance > 5);
      expect(tooFar).toHaveLength(0);
    });

    it('excludes self from nearby agents', () => {
      // TODO: Agent should not appear in its own nearbyAgents
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      const selfReferences = perception.nearbyAgents.filter((a) => a.agent.id === agent.id);
      expect(selfReferences).toHaveLength(0);
    });

    it('sorts nearby agents by distance (ascending)', () => {
      // TODO: Place agents at distances 1, 3, 5
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      for (let i = 1; i < perception.nearbyAgents.length; i++) {
        expect(perception.nearbyAgents[i].distance).toBeGreaterThanOrEqual(
          perception.nearbyAgents[i - 1].distance
        );
      }
    });

    it('handles agent with no nearby agents', () => {
      // TODO: Place agent far from all others
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception.nearbyAgents).toHaveLength(0);
    });

    it('handles agent at exact 5-tile boundary', () => {
      // TODO: Place agent at distance exactly 5
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      const boundary = perception.nearbyAgents.filter((a) => a.distance === 5);
      expect(boundary.length).toBeGreaterThan(0);
    });
  });

  // ─── Nearby objects (smart furniture) ───────────────────────────────────
  describe('perceive — nearbyObjects', () => {
    it('returns smart objects in current room', () => {
      // TODO: Agent in workspace should see desk-cluster-left, desk-cluster-right
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception.nearbyObjects.length).toBeGreaterThan(0);
    });

    it('returns empty array when in null room', () => {
      // TODO: Agent outside all rooms
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      if (perception.currentRoom === null) {
        expect(perception.nearbyObjects).toHaveLength(0);
      }
    });

    it('returns all objects for room (e.g., 2 desks in workspace)', () => {
      // TODO: Workspace has desk-cluster-left and desk-cluster-right
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      if (perception.currentRoom?.id === 'workspace') {
        expect(perception.nearbyObjects.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ─── Available interaction points ──────────────────────────────────────
  describe('perceive — availableInteractionPoints', () => {
    it('returns unoccupied interaction points sorted by distance', () => {
      // TODO: Setup agent, check points are sorted by distance
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      // Verify sorted ascending by distance
      for (let i = 1; i < perception.availableInteractionPoints.length; i++) {
        expect(perception.availableInteractionPoints[i].distance).toBeGreaterThanOrEqual(
          perception.availableInteractionPoints[i - 1].distance
        );
      }
    });

    it('excludes occupied interaction points', () => {
      // TODO: Reserve a point, then perceive should not include it
      // Use occupancy.reservePoint(x, y, agentId)
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      // TODO: Verify none of the available points are occupied
    });

    it('excludes non-walkable interaction points', () => {
      // TODO: Use isWalkable() check; verify all returned points are walkable
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      perception.availableInteractionPoints.forEach((ip) => {
        // TODO: Verify isWalkable(ip.x, ip.y) === true
      });
    });

    it('includes objectId reference for each interaction point', () => {
      // TODO: Verify each point has objectId (e.g., 'coffee-counter', 'desk-cluster-left')
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      perception.availableInteractionPoints.forEach((ip) => {
        expect(ip.objectId).toBeDefined();
        expect(typeof ip.objectId).toBe('string');
      });
    });

    it('handles no available interaction points (all occupied)', () => {
      // TODO: Reserve all points, then perceive should return empty array
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      // TODO: After reserving all, perception.availableInteractionPoints.length === 0
    });
  });

  // ─── At desk detection ─────────────────────────────────────────────────
  describe('perceive — isAtDesk', () => {
    it('returns true when agent state is idle and path is empty', () => {
      // TODO: Setup agent with state='idle', path=[]
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      if (agent.state === 'idle' && agent.path.length === 0) {
        expect(perception.isAtDesk).toBe(true);
      }
    });

    it('returns true when agent state is idle and pathIndex >= path.length', () => {
      // TODO: Setup agent with state='idle', path length 5, pathIndex 5+
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      if (agent.state === 'idle' && agent.pathIndex >= agent.path.length) {
        expect(perception.isAtDesk).toBe(true);
      }
    });

    it('returns false when agent state is not idle', () => {
      // TODO: Setup agent with state='walking'
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      if (agent.state !== 'idle') {
        expect(perception.isAtDesk).toBe(false);
      }
    });

    it('returns false when agent is mid-path (pathIndex < path.length)', () => {
      // TODO: Setup agent with path and pathIndex < path.length
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      if (agent.pathIndex < agent.path.length) {
        expect(perception.isAtDesk).toBe(false);
      }
    });
  });

  // ─── Recently worked tracking ──────────────────────────────────────────
  describe('perceive — recentlyWorked', () => {
    it('returns true when agent is in recentWorkers set', () => {
      // TODO: Pass agent.id in recentWorkers set
      const agent = agents[0];
      const recentWorkers = new Set([agent.id]);
      const perception = perceive(agent, agents, recentWorkers);
      expect(perception.recentlyWorked).toBe(true);
    });

    it('returns false when agent is not in recentWorkers set', () => {
      // TODO: Pass empty recentWorkers set
      const agent = agents[0];
      const recentWorkers = new Set<string>();
      const perception = perceive(agent, agents, recentWorkers);
      expect(perception.recentlyWorked).toBe(false);
    });

    it('ignores other agents in recentWorkers (only checks self)', () => {
      // TODO: Pass another agent's ID in recentWorkers
      const agent = agents[0];
      const otherAgent = agents[1];
      const recentWorkers = new Set([otherAgent?.id ?? '']);
      const perception = perceive(agent, agents, recentWorkers);
      expect(perception.recentlyWorked).toBe(false);
    });
  });

  // ─── Integration: full perception snapshot ──────────────────────────────
  describe('perceive — full snapshot', () => {
    it('returns AgentPerception with all required fields', () => {
      // TODO: Verify structure
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception).toHaveProperty('agent');
      expect(perception).toHaveProperty('currentRoom');
      expect(perception).toHaveProperty('nearbyAgents');
      expect(perception).toHaveProperty('nearbyObjects');
      expect(perception).toHaveProperty('availableInteractionPoints');
      expect(perception).toHaveProperty('isAtDesk');
      expect(perception).toHaveProperty('recentlyWorked');
    });

    it('perception.agent references the input agent', () => {
      // TODO: Verify perception.agent === input agent
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception.agent).toBe(agent);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────
  describe('perceive — edge cases', () => {
    it('handles single agent (self) in agents array', () => {
      // TODO: Only one agent (self), should have no nearby agents
      const agent = agents[0];
      const perception = perceive(agent, [agent], new Set());
      expect(perception.nearbyAgents).toHaveLength(0);
    });

    it('handles many agents (100+)', () => {
      // TODO: Create large agents array, verify performance and correctness
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception.nearbyAgents.length).toBeLessThanOrEqual(agents.length - 1);
    });

    it('handles agent at grid boundary (0, 0)', () => {
      // TODO: Place agent at (0, 0)
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      // Should not crash, may have no room or may be in patio
      expect(perception).toBeDefined();
    });

    it('handles agent at grid boundary (COLS-1, ROWS-1)', () => {
      // TODO: Place agent at (26, 24)
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());
      expect(perception).toBeDefined();
    });
  });
});
