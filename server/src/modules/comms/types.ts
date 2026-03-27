// ============================================================
// Comms module types
// ============================================================

// ── Briefings (/api/briefings) ───────────────────────────────

/** A single daily briefing entry. */
export interface Briefing {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

/** Response payload from GET /api/briefings. */
export interface BriefingListResponse {
  briefings: Briefing[];
}

/** Response payload from POST /api/briefings/trigger. */
export interface BriefingTriggerResponse {
  content: string;
}

// ── Suggestions (/api/suggestions) ───────────────────────────

/** Status values for a suggestion. */
export type SuggestionStatus = 'new' | 'reviewed' | 'planned' | 'implemented' | 'declined';

/** A single suggestion entry. */
export interface Suggestion {
  id: string;
  userId: string;
  title: string;
  body: string;
  tags: string[];
  status: SuggestionStatus;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt: string;
}

/** Body for POST /api/suggestions (create). */
export interface SuggestionCreateBody {
  title: string;
  body: string;
  tags?: string[];
}

/** Body for PATCH /api/suggestions/:id (edit). */
export interface SuggestionEditBody {
  title: string;
  body: string;
}

/** Body for POST /api/suggestions/:id/vote. */
export interface SuggestionVoteBody {
  vote: 1 | -1;
}

/** Response payload from POST /api/suggestions/:id/vote. */
export interface SuggestionVoteResponse {
  upvotes: number;
  downvotes: number;
}

/** Paginated response from GET /api/suggestions/mine. */
export interface SuggestionListResponse {
  suggestions: Suggestion[];
  total: number;
  page: number;
  limit: number;
}

/** A suggestion cluster with aggregated scores. */
export interface SuggestionCluster {
  id: string;
  canonicalSummary: string;
  name: string | null;
  tags: string[];
  suggestionIds: string[];
  demandScore: number | null;
  impactScore: number | null;
  effortScore: number | null;
  riskScore: number | null;
  overallScore: number | null;
  rationale: string | null;
  total_votes: number;
  createdAt: string;
  updatedAt: string;
}

/** Response payload from GET /api/suggestions/clusters. */
export interface SuggestionClusterListResponse {
  clusters: SuggestionCluster[];
}

/** A suggestion status-change event. */
export interface SuggestionEvent {
  id: string;
  suggestionId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  changedAt: string;
}

/** Response payload from GET /api/suggestions/:id/events. */
export interface SuggestionEventListResponse {
  events: SuggestionEvent[];
}

/** A single reward ledger entry. */
export interface RewardEntry {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

/** Response payload from GET /api/suggestions/rewards/mine. */
export interface RewardListResponse {
  rewards: RewardEntry[];
}

// ── Recipes (/api/recipes) ───────────────────────────────────

/** A recipe definition. */
export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: string;
  config_schema: Record<string, unknown>;
}

/** Body for POST /api/recipes/:id/install. */
export interface RecipeInstallBody {
  config?: Record<string, unknown>;
}

/** A recipe list item with installation status. */
export interface RecipeListItem extends Recipe {
  installed: boolean;
  installedAt: string | null;
}
