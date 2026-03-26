/**
 * Numeric animation tier level: 1 = minimal, 2 = spotlight, 3 = cinematic.
 */
export type AnimationTier = 1 | 2 | 3;

/**
 * Context needed to select the appropriate animation tier.
 * @property isFirstVisit - True if this is the user's first visit to the office page
 * @property isMultiAgent - True if multiple agents are currently active/communicating
 * @property toolCallCount - Number of tools invoked in the current request (0+ means something is running)
 * @property thinkingStartTime - Unix timestamp when thinking started, or 0 if not thinking
 */
interface TierContext {
  isFirstVisit: boolean;
  isMultiAgent: boolean;
  toolCallCount: number;
  thinkingStartTime: number; // 0 if not thinking
}

/**
 * Selects the appropriate animation tier based on the current request context.
 *
 * **Tier Selection Decision Tree:**
 * ```
 * Tier 3 (Cinematic) — Full zoom + spotlight + hold effect
 *   ↑ First-time visitors (maximize impact)
 *   ↑ Long thinking (> 10 seconds) — reward patience with dramatic effect
 *
 * Tier 2 (Spotlight) — Agent highlight + dim background
 *   ↑ Multi-agent coordination (show active delegation)
 *   ↑ Complex requests (2+ tool calls) — acknowledge complexity
 *
 * Tier 1 (Minimal) — Subtle highlight only
 *   ↑ Simple single-agent requests
 *   ↑ Quick responses (most common case)
 * ```
 *
 * **Rationale:**
 * - First-time visitors see cinematic effect (memorable onboarding)
 * - Long thinking gets rewarded (shows the agent was working hard)
 * - Multi-agent & complex requests deserve attention (non-trivial computation)
 * - Simple requests stay subtle (avoid animation fatigue on repeated actions)
 *
 * **Priority Order:** isFirstVisit > isMultiAgent/toolCallCount > thinkingTime > default
 *
 * @param ctx - Context describing the current visit and agent activity.
 * @returns The animation tier (1, 2, or 3) to apply to the canvas.
 *
 * @example
 * ```typescript
 * const tier = selectAnimationTier({
 *   isFirstVisit: false,
 *   isMultiAgent: true,
 *   toolCallCount: 3,
 *   thinkingStartTime: Date.now() - 15000,
 * });
 * // Returns 2 (spotlight) because isMultiAgent=true and toolCallCount >= 2
 * ```
 */
export function selectAnimationTier(ctx: TierContext): AnimationTier {
  // Rule 1: First-time visitors always get cinematic (memorable experience)
  if (ctx.isFirstVisit) return 3;
  // Rule 2: Multi-agent or complex requests get spotlight (show importance)
  if (ctx.isMultiAgent || ctx.toolCallCount >= 2) return 2;
  // Rule 3: Long thinking (> 10s) gets cinematic (reward patience)
  if (ctx.thinkingStartTime > 0 && Date.now() - ctx.thinkingStartTime > 10_000) return 3;
  // Rule 4: Everything else is minimal (avoid animation fatigue)
  return 1;
}

const requestToolCounts = new Map<string, number>();

/**
 * Increments and returns the tool-call count for a given request.
 * @param requestId - The identifier of the active request, or undefined to no-op.
 * @returns The updated tool-call count, or 0 if no requestId was provided.
 */
export function trackToolCall(requestId: string | undefined): number {
  if (!requestId) return 0;
  const count = (requestToolCounts.get(requestId) ?? 0) + 1;
  requestToolCounts.set(requestId, count);
  return count;
}

/**
 * Removes the tool-call tracking entry for a completed request.
 * @param requestId - The identifier of the request to clear, or undefined to no-op.
 */
export function clearRequest(requestId: string | undefined): void {
  if (requestId) requestToolCounts.delete(requestId);
}

/**
 * Checks whether the user has not yet visited the office page.
 * @returns True if no visit record exists in localStorage, false otherwise.
 */
export function isFirstVisit(): boolean {
  return !localStorage.getItem('office_visited');
}

/**
 * Persists a visit record to localStorage so subsequent visits are not treated as first-time.
 */
export function markVisited(): void {
  localStorage.setItem('office_visited', 'true');
}
