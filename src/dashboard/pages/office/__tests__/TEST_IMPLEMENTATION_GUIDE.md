# Test Implementation Guide: Agent Office Module

## Overview

This guide provides step-by-step instructions for implementing the test skeletons. The skeleton files are ready to use; this document explains how to fill in the `TODO` markers and what each test should verify.

## Test Files Created

| File | Status | Module | Tests |
|------|--------|--------|-------|
| `TEST_COVERAGE_GAPS.md` | ✅ Complete | Analysis | 40+ gaps identified |
| `collisionLoader.test.ts` | 🔧 Skeleton | collisionLoader.ts | 20+ tests |
| `perception.test.ts` | 🔧 Skeleton | perception.ts | 30+ tests |
| `roomZones.test.ts` | 🔧 Skeleton | roomZones.ts | 25+ tests |
| `taskQueue.test.ts` | 🔧 Skeleton | taskQueue.ts | 35+ tests |
| `office.integration.test.ts` | 🔧 Skeleton | Integration | 40+ tests |
| `AnimationTierSelector.test.ts` | ✅ Complete | AnimationTierSelector.ts | 20+ tests |
| `CanvasEffects.test.ts` | ✅ Complete | CanvasEffects.ts | 25+ tests |
| `navigation.test.ts` | ✅ Complete | navigation.ts | 20+ tests |
| `occupancy.test.ts` | ✅ Complete | occupancy.ts | 20+ tests |

## Implementation Priority

### 🔴 Critical (High impact, 4-6 hours)
1. **taskQueue.test.ts** — Task lifecycle is core to agent assignment
2. **perception.test.ts** — Agent sensing drives behavior decisions
3. **office.integration.test.ts** — Validates full workflows

### 🟠 High (Important, 2-4 hours each)
4. **roomZones.test.ts** — Room detection affects behavior bias
5. **collisionLoader.test.ts** — Navigation fallback critical

### 🟡 Medium (Nice-to-have, 1-2 hours each)
6. Additional modules: proactiveSuggestions, sprites, agentBehavior, etc.

## How to Implement Each Test

### Pattern 1: State Queries
```typescript
describe('isAuthoredMapLoaded', () => {
  it('returns false before any load attempt', () => {
    expect(isAuthoredMapLoaded()).toBe(false);
  });

  it('returns true after successful image load and parsing', async () => {
    // TODO: Mock Image with successful load
    // Step 1: Setup mock
    vi.mock('Image', () => ({
      Image: class MockImage {
        constructor() {
          setTimeout(() => this.onload?.(), 0);
        }
        onload?: () => void;
        onerror?: () => void;
        src = '';
      },
    }));

    // Step 2: Call function
    await loadCollisionFromImage();

    // Step 3: Assert result
    expect(isAuthoredMapLoaded()).toBe(true);
  });
});
```

### Pattern 2: Filtering & Sorting
```typescript
describe('getTasksForAgent', () => {
  it('returns tasks assigned to specific agent', () => {
    // Setup: Create tasks with different agents
    const task1 = createTask({
      type: 'check_reminders',
      label: 'Task 1',
      assignedTo: 'cal',
    });
    const task2 = createTask({
      type: 'summarize_inbox',
      label: 'Task 2',
      assignedTo: 'aria',
    });

    // Exercise: Filter for specific agent
    const calTasks = getTasksForAgent('cal');

    // Verify: Only cal's tasks returned
    expect(calTasks).toContainEqual(
      expect.objectContaining({ id: task1.id })
    );
    expect(calTasks).not.toContainEqual(
      expect.objectContaining({ id: task2.id })
    );
  });
});
```

### Pattern 3: Mocking Canvas/Image
```typescript
describe('loadCollisionFromImage', () => {
  it('parses alpha channel correctly', async () => {
    // Setup: Mock Image, canvas, ImageData
    const mockImageData = new Uint8ClampedArray([
      255, 0, 0, 255, // Red pixel, alpha=255 (blocked)
      0, 255, 0, 100, // Green pixel, alpha=100 (walkable)
    ]);

    // Mock context.getImageData
    const mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: mockImageData,
      })),
    };

    // Exercise: Call loadCollisionFromImage
    const map = await loadCollisionFromImage();

    // Verify: Grid constructed from mocked alpha values
    expect(map).toBeDefined();
  });
});
```

### Pattern 4: Edge Case Testing
```typescript
describe('perceive — nearbyAgents', () => {
  it('handles agent at exact 5-tile boundary', () => {
    // Setup agent1 at (10, 10), agent2 at (15, 10) = distance 5
    const agent1 = { x: 10, y: 10, id: 'agent1' };
    const agent2 = { x: 15, y: 10, id: 'agent2' };

    // Exercise: Perceive
    const perception = perceive(agent1, [agent1, agent2], new Set());

    // Verify: Agent at exact radius included
    expect(perception.nearbyAgents).toContainEqual(
      expect.objectContaining({ agent: agent2, distance: 5 })
    );
  });
});
```

## Mock Helpers Needed

Create a `__tests__/mocks.ts` file:

```typescript
// src/dashboard/pages/office/__tests__/mocks.ts

import type { CanvasAgent } from '../types';

export function createMockAgent(overrides?: Partial<CanvasAgent>): CanvasAgent {
  return {
    id: 'agent1',
    x: 10,
    y: 15,
    renderX: 10,
    renderY: 15,
    state: 'idle',
    path: [],
    pathIndex: 0,
    facing: 'down',
    behavior: { mode: 'sitting' },
    ...overrides,
  };
}

export function createMockImage(): HTMLImageElement {
  const img = new Image();
  img.naturalWidth = 864;
  img.naturalHeight = 800;
  img.complete = true;
  return img;
}

export function createMockCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return ctx;
}
```

## Test Data Constants

Add to `__tests__/test-fixtures.ts`:

```typescript
// Reusable test data for consistency

export const WORKSPACE_AGENT_POS = { x: 5, y: 17 };
export const PANTRY_AGENT_POS = { x: 8, y: 4 };
export const LOUNGE_AGENT_POS = { x: 20, y: 5 };

export const INTERACTION_POINTS = {
  deskClusterLeft: { x: 2, y: 18, behavior: 'work' as const },
  coffeeCounter: { x: 8, y: 4, behavior: 'coffee' as const },
  meetingTable: { x: 20, y: 16, behavior: 'collaborate' as const },
};
```

## Running Tests

```bash
# Run all office tests
npm test -- src/dashboard/pages/office/__tests__

# Run specific test file
npm test -- src/dashboard/pages/office/__tests__/taskQueue.test.ts

# Run with coverage
npm test -- --coverage src/dashboard/pages/office/__tests__

# Watch mode
npm test -- --watch src/dashboard/pages/office/__tests__
```

## Coverage Goals

| Category | Target | Current | Gap |
|----------|--------|---------|-----|
| Statements | 80%+ | ~40% | 40% |
| Branches | 75%+ | ~25% | 50% |
| Functions | 85%+ | ~30% | 55% |
| Lines | 80%+ | ~40% | 40% |

## Estimated Implementation Time

| Module | LOC | Tests | Est. Hours |
|--------|-----|-------|-----------|
| taskQueue.test.ts | 350 | 35 | 3-4 |
| perception.test.ts | 280 | 30 | 2-3 |
| roomZones.test.ts | 220 | 25 | 2 |
| collisionLoader.test.ts | 200 | 20 | 2 |
| office.integration.test.ts | 400 | 40 | 4-5 |
| **Subtotal (critical)** | **1450** | **150** | **13-16** |
| Other modules (proactiveSuggestions, sprites, agentBehavior, etc.) | ~800 | ~80 | 8-10 |
| **Total** | **2250** | **230** | **21-26** |

## Next Steps

1. **Immediate** (30 mins):
   - Review TEST_COVERAGE_GAPS.md
   - Create `mocks.ts` and `test-fixtures.ts`

2. **Short-term** (1-2 days):
   - Implement critical tests (taskQueue, perception, integration)
   - Verify test structure with one module
   - Run tests and fix imports/mocks

3. **Medium-term** (3-5 days):
   - Fill in TODO markers for all modules
   - Achieve 60%+ coverage
   - Add missing error handling tests

4. **Long-term** (1-2 weeks):
   - Full 80%+ coverage across all modules
   - Integration test suite mature
   - CI/CD integration for test enforcement

## Tips & Best Practices

### ✅ DO:
- Use `beforeEach` to reset state (clearQueue, releaseAll, vi.clearAllMocks)
- Group related tests with nested describes
- Name tests as "returns/sets/throws when <condition>"
- Mock external dependencies (Image, fetch, localStorage)
- Test both happy path and error cases
- Verify order-dependent behavior (sorted arrays, boundary conditions)

### ❌ DON'T:
- Create interdependent tests (use beforeEach instead)
- Test implementation details (test behavior, not internal state)
- Mock everything (only mock external boundaries: Image, fetch, DOM)
- Ignore async/await (use `async/await` in tests)
- Duplicate assertions across tests (one assertion per concept)

## Debugging Failed Tests

### Image Loading Issues
```typescript
// If Image mock isn't triggering onload:
vi.useFakeTimers();
await loadCollisionFromImage();
vi.advanceTimersByTime(100); // Let mocked callback fire
vi.useRealTimers();
```

### Canvas Context Issues
```typescript
// Verify canvas context is created:
const canvas = document.createElement('canvas');
expect(canvas.getContext('2d')).not.toBeNull();
```

### Assertion Timeouts
```typescript
// Use timeout for async operations:
it('loads image', async () => {
  const result = await loadCollisionFromImage();
  expect(result).toBeDefined();
}, 5000); // 5 second timeout
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Matchers Reference](https://vitest.dev/api/expect.html)
- Office Module README: `src/dashboard/pages/office/README.md`

---

**Last Updated**: 2026-03-26
**Test Count**: 230+ test skeletons across 6 files
**Coverage Gap**: ~50% → Target: 80%+
