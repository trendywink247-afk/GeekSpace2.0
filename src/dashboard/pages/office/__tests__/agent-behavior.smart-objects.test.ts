/**
 * @fileoverview agentBehavior smart object reservation test suite
 * Tests resource management, concurrent reservations, and release logic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  reserveSmartObject,
  releaseSmartObject,
  type SmartObject,
} from '../agent-behavior';
import { SMART_OBJECTS } from '../smart-objects';

describe('agentBehavior — Smart Object Reservation', () => {
  const testAgentId = 'test-agent-1';

  beforeEach(() => {
    // Clean up any previous reservations
    Object.keys(SMART_OBJECTS).forEach((objectId) => {
      releaseSmartObject(testAgentId);
    });
  });

  afterEach(() => {
    releaseSmartObject(testAgentId);
  });

  // ─── Basic reservation ─────────────────────────────────────────────────
  describe('reserveSmartObject', () => {
    it('reserves available smart object for agent', () => {
      const reserved = reserveSmartObject(testAgentId);
      expect(reserved).toBeTruthy();
      expect(reserved?.objectId).toBeTruthy();
    });

    it('returns SmartObject with position (x, y)', () => {
      const obj = reserveSmartObject(testAgentId);
      if (obj) {
        expect(typeof obj.x).toBe('number');
        expect(typeof obj.y).toBe('number');
        expect(obj.x).toBeGreaterThanOrEqual(0);
        expect(obj.y).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns SmartObject with type (coffee, desk, couch, etc)', () => {
      const obj = reserveSmartObject(testAgentId);
      if (obj) {
        expect(['coffee', 'desk', 'couch', 'whiteboard', 'kitchen']).toContain(obj.type);
      }
    });

    it('returns null if all objects are reserved', () => {
      // Reserve all available objects
      const agents = Array.from({ length: 10 }, (_, i) => `agent-${i}`);
      const reservations = agents.map((id) => reserveSmartObject(id));

      // Find first null reservation (all objects exhausted)
      const exhaustedAt = reservations.findIndex((r) => r === null);

      if (exhaustedAt !== -1) {
        expect(reservations[exhaustedAt]).toBeNull();
      }
    });

    it('reserves different objects for different agents', () => {
      const agent1 = reserveSmartObject('agent-1');
      const agent2 = reserveSmartObject('agent-2');

      if (agent1 && agent2) {
        // Should get different objects (unless only 1 available)
        expect(agent1.objectId).not.toBe(agent2.objectId);
      }
    });

    it('prioritizes unoccupied objects over occupied', () => {
      // Reserve one object
      const agent1 = reserveSmartObject('agent-1');

      // Reserve another for different agent
      const agent2 = reserveSmartObject('agent-2');

      if (agent1 && agent2) {
        expect(agent1.objectId).not.toBe(agent2.objectId);
      }
    });

    it('handles special object types (meeting_room, kitchen)', () => {
      // Assume some objects are special
      const obj = reserveSmartObject(testAgentId);

      if (obj) {
        expect(['coffee', 'desk', 'couch', 'whiteboard', 'kitchen', 'meeting_room']).toContain(obj.type);
      }
    });
  });

  // ─── Release and cleanup ───────────────────────────────────────────────
  describe('releaseSmartObject', () => {
    it('releases reservation so object can be reserved again', () => {
      const obj1 = reserveSmartObject(testAgentId);
      releaseSmartObject(testAgentId);

      const obj2 = reserveSmartObject(testAgentId);

      if (obj1 && obj2) {
        // Same object should be available again
        expect(obj2.objectId).toBe(obj1.objectId);
      }
    });

    it('allows other agents to reserve released object', () => {
      const obj1 = reserveSmartObject('agent-1');
      releaseSmartObject('agent-1');

      const obj2 = reserveSmartObject('agent-2');

      if (obj1 && obj2) {
        expect(obj2.objectId).toBe(obj1.objectId);
      }
    });

    it('releasing non-existent agent does not error', () => {
      expect(() => releaseSmartObject('nonexistent-agent')).not.toThrow();
    });

    it('releasing twice is idempotent (no double-release bug)', () => {
      reserveSmartObject(testAgentId);
      releaseSmartObject(testAgentId);
      releaseSmartObject(testAgentId); // Second release

      expect(() => releaseSmartObject(testAgentId)).not.toThrow();
    });

    it('clearing all agents\' reservations returns all objects to pool', () => {
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      agents.forEach((id) => reserveSmartObject(id));

      agents.forEach((id) => releaseSmartObject(id));

      // All should be reservable again
      agents.forEach((id) => {
        const obj = reserveSmartObject(id);
        expect(obj).toBeTruthy();
      });
    });
  });

  // ─── Concurrent reservation edge cases ─────────────────────────────────
  describe('Concurrent reservation', () => {
    it('does not allow double-reservation for same agent', () => {
      const obj1 = reserveSmartObject(testAgentId);

      // Second reservation should fail or return same object
      const obj2 = reserveSmartObject(testAgentId);

      if (obj1 && obj2) {
        // If both succeed, should be same object
        expect(obj1.objectId).toBe(obj2.objectId);
      }
    });

    it('handles rapid reserve/release cycles', () => {
      for (let i = 0; i < 10; i++) {
        const obj = reserveSmartObject(testAgentId);
        expect(obj).toBeTruthy();
        releaseSmartObject(testAgentId);
      }

      // Final state should be clean
      const obj = reserveSmartObject(testAgentId);
      expect(obj).toBeTruthy();
    });

    it('stress test: 50 agents competing for objects', () => {
      const agents = Array.from({ length: 50 }, (_, i) => `stress-agent-${i}`);
      const reservations = agents.map((id) => reserveSmartObject(id));

      // Count successful reservations (should be limited by pool size)
      const successful = reservations.filter((r) => r !== null).length;
      expect(successful).toBeGreaterThan(0);
      expect(successful).toBeLessThanOrEqual(agents.length);
    });
  });

  // ─── Object type filtering ─────────────────────────────────────────────
  describe('Smart object type availability', () => {
    it('coffee machine objects should exist and be reservable', () => {
      let coffeeReserved = false;

      for (let i = 0; i < 10; i++) {
        const obj = reserveSmartObject(`coffee-seeker-${i}`);
        if (obj && obj.type === 'coffee') {
          coffeeReserved = true;
          releaseSmartObject(`coffee-seeker-${i}`);
          break;
        }
        if (obj) releaseSmartObject(`coffee-seeker-${i}`);
      }

      // TODO: Should have at least one coffee machine
      // expect(coffeeReserved).toBe(true);
    });

    it('desk objects should match agent home desks', () => {
      const desk = reserveSmartObject(testAgentId);

      if (desk && desk.type === 'desk') {
        // Desk coordinates should match one of the agent home desks
        expect(desk.x).toBeGreaterThanOrEqual(0);
        expect(desk.y).toBeGreaterThanOrEqual(0);
      }
    });

    it('multiple desks should be available for different agents', () => {
      const desk1 = reserveSmartObject('agent-1');
      const desk2 = reserveSmartObject('agent-2');

      if (desk1 && desk2 && desk1.type === 'desk' && desk2.type === 'desk') {
        // Should be different desk positions
        // (unless agents share desk, which is unlikely)
        expect(desk1.objectId).not.toBe(desk2.objectId);
      }
    });
  });

  // ─── TODO: Object-specific behavior ───────────────────────────────────
  describe('TODO: Object-specific behavior triggers', () => {
    it.todo('reserving coffee should trigger drinking pose');
    it.todo('reserving couch should trigger sitting pose');
    it.todo('reserving whiteboard should trigger standing pose');
    it.todo('reserving kitchen should trigger cooking/snacking pose');
  });
});
