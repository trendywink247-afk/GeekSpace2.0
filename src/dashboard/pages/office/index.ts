/**
 * @fileoverview Agent Office Module — Pixel-art office canvas with 9 animated agents,
 * real-time state updates via SSE, and interactive smart objects.
 *
 * See {@link ./README.md} for comprehensive architecture documentation.
 *
 * Main components:
 * - OfficePage: Full office canvas with sidebar (tasks, comms, metrics)
 * - OfficeHomePage: Home view with office intro and quick links
 *
 * Core subsystems:
 * - OfficeCanvasRenderer: Pure canvas 30fps pixel-art rendering
 * - OfficeStage: Canvas tick loop (200ms) for agent updates and behavior
 * - AgentBehavior: Perception-driven state machine (walking, socializing, working)
 * - Navigation: Centralized BFS pathfinding and collision checks
 * - Occupancy: Smart object interaction point reservation system
 * - Sprites: 16×24 pixel-art sprite rendering with palette substitution
 *
 * Data flow:
 * User message → Backend processes → Agent state changes → SSE event fired
 *   ↓ useOfficeData (streaming)
 * CanvasAgent state updated → Canvas re-renders → Agent animates on canvas
 */

/**
 * Main Agent Office component with full canvas, sidebar, and real-time SSE streaming.
 * Displays pixel-art office with 9 agents, task board, comms timeline, and metrics.
 * @component
 * @returns Full office interface with canvas and control panels
 *
 * @example
 * ```tsx
 * import { OfficePage } from '@/dashboard/pages/office';
 *
 * export function Dashboard() {
 *   return <OfficePage />;
 * }
 * ```
 */
export { OfficePage } from './pages/OfficePage';

/**
 * Office homepage view with intro, feature highlights, and quick navigation.
 * Shown to first-time users or as a landing page option.
 * @component
 * @returns Office intro page with onboarding elements
 */
export { OfficeHomePage } from './pages/OfficeHomePage';
