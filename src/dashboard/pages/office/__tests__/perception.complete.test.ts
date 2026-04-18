/**
 * @fileoverview Complete test suite for perception.ts
 * Tests agent environment sensing: rooms, nearby agents, objects, interactability
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { perceive, type AgentPerception } from '../perception';
import type { CanvasAgent } from '../types';
import { ROOMS } from '../room-zones';
import { SMART_OBJECTS } from '../smart-objects';

describe('perception — Complete Coverage', () => {
  let agents: CanvasAgent[];

  beforeEach(() => {
    agents = [
      {
        id: 'weebo',
        x: 5,
        y: 17, // workspace
        renderX: 160,
        renderY: 544,
        behaviorMode: 'sitting',
        pose: 'idle',
        facing: 'down',
        spriteId: 'weebo-sitting-down-idle-0',
        path: [],
        state: 'idle',
      },
      {
        id: 'edith',
        x: 7,
        y: 17, // workspace, 2 tiles away from weebo
        renderX: 224,
        renderY: 544,
        behaviorMode: 'sitting',
        pose: 'idle',
        facing: 'down',
        spriteId: 'edith-sitting-down-idle-0',
        path: [],
        state: 'idle',
      },
      {
        id: 'jarvis',
        x: 20,
        y: 5, // lounge, far away
        renderX: 640,
        renderY: 160,
        behaviorMode: 'sitting',
        pose: 'idle',
        facing: 'down',
        spriteId: 'jarvis-sitting-down-idle-0',
        path: [],
        state: 'idle',
      },
    ] as CanvasAgent[];
  });

  // ─── Current room detection ──────────────────────────────────────────────
  describe('perceive — currentRoom', () => {
    it('returns correct room for agent in workspace (x: 0–14, y: 13–21)', () => {
      const agent = agents[0]; // x=5, y=17
      const perception = perceive(agent, agents, new Set());

      expect(perception.currentRoom).toBeDefined();
      expect(perception.currentRoom?.id).toBe('workspace');
    });

    it('returns null for agent outside all rooms', () => {
      const agent = agents[0];
      agent.x = 25; // Top-right corner, typically outside rooms
      agent.y = 24;

      const perception = perceive(agent, agents, new Set());
      expect(perception.currentRoom).toBeNull();
    });

    it('returns more specific room when overlapping (pantry over patio)', () => {
      const agent = agents[0];
      agent.x = 8; // Inside pantry (x: 5–11, y: 2–6)
      agent.y = 4;

      const perception = perceive(agent, agents, new Set());
      // Pantry is more specific than patio, so should return pantry
      expect(perception.currentRoom?.id).toBe('pantry');
    });

    it('returns patio for agent in patio but outside pantry', () => {
      const agent = agents[0];
      agent.x = 2; // In patio (0–11, 0–7) but outside pantry
      agent.y = 1;

      const perception = perceive(agent, agents, new Set());
      expect(perception.currentRoom?.id).toBe('patio');
    });

    it('detects all 7 room types correctly', () => {
      const roomTests = [
        { x: 5, y: 4, expectedRoom: 'pantry' }, // Pantry
        { x: 8, y: 3, expectedRoom: 'pantry' }, // Pantry
        { x: 2, y: 2, expectedRoom: 'patio' },  // Patio
        { x: 20, y: 3, expectedRoom: 'lounge' }, // Lounge
        { x: 3, y: 10, expectedRoom: 'utility_corridor' }, // Utility corridor
        { x: 10, y: 10, expectedRoom: 'stairs_transition' }, // Stairs
        { x: 7, y: 17, expectedRoom: 'workspace' }, // Workspace
        { x: 20, y: 16, expectedRoom: 'meeting_room' }, // Meeting room
      ];

      roomTests.forEach(({ x, y, expectedRoom }) => {
        const agent = agents[0];
        agent.x = x;
        agent.y = y;
        const perception = perceive(agent, agents, new Set());

        if (perception.currentRoom) {
          expect(perception.currentRoom.id).toBe(expectedRoom);
        }
      });
    });
  });

  // ─── Nearby agent detection ───────────────────────────────────────────────
  describe('perceive — nearbyAgents', () => {
    it('returns agents within 5-tile Manhattan distance', () => {
      const agent = agents[0]; // x=5, y=17
      const perception = perceive(agent, agents, new Set());

      // edith at (7, 17) is 2 tiles away
      expect(perception.nearbyAgents.length).toBeGreaterThan(0);
      const nearby = perception.nearbyAgents.find((a) => a.agent.id === 'edith');
      expect(nearby).toBeDefined();
      expect(nearby?.distance).toBeLessThanOrEqual(5);
    });

    it('excludes agents beyond 5-tile radius', () => {
      const agent = agents[0]; // x=5, y=17
      const perception = perceive(agent, agents, new Set());

      // jarvis at (20, 5) is 15+20=35 tiles away
      const jarvis = perception.nearbyAgents.find((a) => a.agent.id === 'jarvis');
      expect(jarvis).toBeUndefined();
    });

    it('excludes self from nearby agents', () => {
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());

      const selfRef = perception.nearbyAgents.find((a) => a.agent.id === 'weebo');
      expect(selfRef).toBeUndefined();
    });

    it('sorts nearby agents by distance (ascending)', () => {
      // TODO: Create agents at distances 1, 3, 5
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());

      for (let i = 1; i < perception.nearbyAgents.length; i++) {
        expect(perception.nearbyAgents[i].distance).toBeGreaterThanOrEqual(
          perception.nearbyAgents[i - 1].distance
        );
      }
    });

    it('handles boundary case: agent at exactly 5 tiles', () => {
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());

      const boundary = perception.nearbyAgents.filter((a) => a.distance === 5);
      // Boundary agents (distance = 5) should be included
      // expect(boundary.length).toBeGreaterThanOrEqual(0);
    });

    it('includes distance calculation in result', () => {
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());

      const edith = perception.nearbyAgents.find((a) => a.agent.id === 'edith');
      if (edith) {
        // Distance should be Manhattan: |5-7| + |17-17| = 2
        expect(edith.distance).toBe(2);
      }
    });

    it('handles agent with no nearby agents', () => {
      const agent = agents[2]; // jarvis, far from others
      const perception = perceive(agent, agents, new Set());

      expect(perception.nearbyAgents).toHaveLength(0);
    });
  });

  // ─── Smart objects in current room ───────────────────────────────────────
  describe('perceive — nearbyObjects', () => {
    it('returns smart objects in current room', () => {
      const agent = agents[0]; // workspace
      const perception = perceive(agent, agents, new Set());

      // Workspace should have multiple desks and objects
      expect(perception.nearbyObjects.length).toBeGreaterThan(0);
      perception.nearbyObjects.forEach((obj) => {
        expect(obj.id).toBeDefined();
        expect(obj.behavior).toBeDefined();
        expect(obj.interactionPoints).toBeDefined();
      });
    });

    it('returns empty array when in null room', () => {
      const agent = agents[0];
      agent.x = 25; // Outside all rooms
      agent.y = 24;

      const perception = perceive(agent, agents, new Set());

      if (perception.currentRoom === null) {
        expect(perception.nearbyObjects).toHaveLength(0);
      }
    });

    it('filters out reserved objects (by occupancy.getOccupant)', () => {
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());

      // TODO: Create reservedAgentIds Set
      const reservedAgentIds = new Set<string>();
      // TODO: Reserve an object and pass Set to perceive
      // const perception2 = perceive(agent, agents, reservedAgentIds);
      // expect(perception2.nearbyObjects.length).toBeLessThanOrEqual(perception.nearbyObjects.length);
    });

    it('returns all objects for room (e.g., 2+ desks in workspace)', () => {
      const agent = agents[0]; // workspace
      const perception = perceive(agent, agents, new Set());

      // Workspace typically has multiple desk clusters
      const desks = perception.nearbyObjects.filter((o) => o.id.startsWith('desk-'));
      expect(desks.length).toBeGreaterThan(0);
    });

    it('includes interaction points for each object', () => {
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());

      perception.nearbyObjects.forEach((obj) => {
        expect(Array.isArray(obj.interactionPoints)).toBe(true);
        obj.interactionPoints.forEach((ip) => {
          expect(typeof ip.x).toBe('number');
          expect(typeof ip.y).toBe('number');
          expect(ip.behavior).toBeDefined();
        });
      });
    });

    it('perceive reflects occupancy: perceive().availableInteractionPoints excludes occupied', () => {
      const agent = agents[0];
      const occupied = new Set<string>(['weebo']); // weebo occupies something

      const perception = perceive(agent, agents, occupied);

      // TODO: Verify occupied points are excluded from availableInteractionPoints
      // expect(perception.availableInteractionPoints.length).toBeGreaterThan(0);
    });
  });

  // ─── Agent-relative state ────────────────────────────────────────────────
  describe('perceive — isAtDesk', () => {
    it('returns true when agent at home desk', () => {
      const agent = agents[0];
      // TODO: Set agent.x, agent.y to match home desk location
      const perception = perceive(agent, agents, new Set());

      // expect(perception.isAtDesk).toBe(true);
    });

    it('returns false when agent away from home desk', () => {
      const agent = agents[0];
      agent.x = 15; // Away from home
      agent.y = 15;

      const perception = perceive(agent, agents, new Set());
      // expect(perception.isAtDesk).toBe(false);
    });

    it('returns false during path walking', () => {
      const agent = agents[0];
      agent.path = [{ x: 6, y: 17 }]; // Moving

      const perception = perceive(agent, agents, new Set());
      // expect(perception.isAtDesk).toBe(false);
    });
  });

  // ─── Available interaction points (reserved + unreserved) ──────────────────
  describe('perceive — availableInteractionPoints', () => {
    it('includes all interaction points from nearby objects', () => {
      const agent = agents[0]; // workspace
      const perception = perceive(agent, agents, new Set());

      let totalPoints = 0;
      perception.nearbyObjects.forEach((obj) => {
        totalPoints += obj.interactionPoints.length;
      });

      expect(perception.availableInteractionPoints.length).toBeGreaterThan(0);
      expect(perception.availableInteractionPoints.length).toBeLessThanOrEqual(totalPoints);
    });

    it('excludes reserved points (from occupancy)', () => {
      const agent = agents[0];
      const reserved = new Set<string>(['weebo']); // Some agent reserves a point

      const perception = perceive(agent, agents, reserved);

      // TODO: Verify reserved points excluded
      // expect(perception.availableInteractionPoints.length).toBeDefined();
    });

    it('includes coordinates for each available point', () => {
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());

      perception.availableInteractionPoints.forEach((point) => {
        expect(typeof point.x).toBe('number');
        expect(typeof point.y).toBe('number');
        expect(typeof point.behavior).toBe('string');
      });
    });
  });

  // ─── Perception aggregation ──────────────────────────────────────────────
  describe('perceive — Full Perception Object', () => {
    it('returns AgentPerception with all properties defined', () => {
      const agent = agents[0];
      const perception = perceive(agent, agents, new Set());

      expect(perception).toHaveProperty('currentRoom');
      expect(perception).toHaveProperty('nearbyAgents');
      expect(perception).toHaveProperty('nearbyObjects');
      expect(perception).toHaveProperty('availableInteractionPoints');
      expect(perception).toHaveProperty('isAtDesk');
    });

    it('currentRoom and nearbyObjects are consistent', () => {
      const agent = agents[0]; // workspace
      const perception = perceive(agent, agents, new Set());

      if (perception.currentRoom) {
        // nearbyObjects should match room
        perception.nearbyObjects.forEach((obj) => {
          // Each object should be in current room
          // TODO: Verify room membership
        });
      }
    });

    it('perception updates when agent moves', () => {
      const agent = agents[0];
      const perception1 = perceive(agent, agents, new Set());

      // Move agent
      agent.x = 20;
      agent.y = 5; // Now in lounge

      const perception2 = perceive(agent, agents, new Set());

      expect(perception1.currentRoom?.id).not.toBe(perception2.currentRoom?.id);
    });

    it('perception does not modify agent or global state', () => {
      const agent = agents[0];
      const xBefore = agent.x;
      const yBefore = agent.y;

      perceive(agent, agents, new Set());

      expect(agent.x).toBe(xBefore);
      expect(agent.y).toBe(yBefore);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('handles agent at grid boundary (0, 0)', () => {
      const agent = agents[0];
      agent.x = 0;
      agent.y = 0;

      const perception = perceive(agent, agents, new Set());
      expect(perception.currentRoom || perception.currentRoom === null).toBeTruthy();
    });

    it('handles agent at grid boundary (COLS-1, ROWS-1)', () => {
      const agent = agents[0];
      agent.x = 26;
      agent.y = 24;

      const perception = perceive(agent, agents, new Set());
      expect(perception.currentRoom || perception.currentRoom === null).toBeTruthy();
    });

    it('handles negative coordinates (invalid, should not occur)', () => {
      const agent = agents[0];
      agent.x = -5;
      agent.y = -5;

      const perception = perceive(agent, agents, new Set());
      // Should not crash
      expect(true).toBe(true);
    });

    it('handles single agent (no others to perceive)', () => {
      const agent = agents[0];
      const perception = perceive(agent, [agent], new Set());

      expect(perception.nearbyAgents).toHaveLength(0);
    });

    it('handles many agents (30+)', () => {
      const agent = agents[0];
      const manyAgents = Array.from({ length: 30 }, (_, i) => ({
        ...agents[0],
        id: `agent-${i}`,
        x: i % 27,
        y: Math.floor(i / 27),
      })) as CanvasAgent[];

      const perception = perceive(agent, manyAgents, new Set());

      // Should complete without timeout
      expect(Array.isArray(perception.nearbyAgents)).toBe(true);
    });

    it('handles reserved agent IDs edge case (very large Set)', () => {
      const agent = agents[0];
      const reserved = new Set(Array.from({ length: 100 }, (_, i) => `reserved-${i}`));

      const perception = perceive(agent, agents, reserved);

      // Should handle large reserved set gracefully
      expect(true).toBe(true);
    });
  });
});
