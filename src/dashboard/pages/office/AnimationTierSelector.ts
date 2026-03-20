export type AnimationTier = 1 | 2 | 3;

interface TierContext {
  isFirstVisit: boolean;
  isMultiAgent: boolean;
  toolCallCount: number;
  thinkingStartTime: number; // 0 if not thinking
}

export function selectAnimationTier(ctx: TierContext): AnimationTier {
  if (ctx.isFirstVisit) return 3;
  if (ctx.isMultiAgent || ctx.toolCallCount >= 2) return 2;
  if (ctx.thinkingStartTime > 0 && Date.now() - ctx.thinkingStartTime > 10_000) return 3;
  return 1;
}

const requestToolCounts = new Map<string, number>();

export function trackToolCall(requestId: string | undefined): number {
  if (!requestId) return 0;
  const count = (requestToolCounts.get(requestId) ?? 0) + 1;
  requestToolCounts.set(requestId, count);
  return count;
}

export function clearRequest(requestId: string | undefined): void {
  if (requestId) requestToolCounts.delete(requestId);
}

export function isFirstVisit(): boolean {
  return !localStorage.getItem('office_visited');
}

export function markVisited(): void {
  localStorage.setItem('office_visited', 'true');
}
