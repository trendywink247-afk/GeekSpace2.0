// ============================================================
// Admin module types
// ============================================================

// ---- admin.ts types ----

export interface AdminHealthStatus {
  timestamp: string;
  db: 'ok' | 'down';
  redis: 'ok' | 'down';
  ollama: 'ok' | 'down';
  picoclaw: 'ok' | 'down' | 'not_configured';
}

export interface AdminStats {
  totalUsers: number;
  activeToday: number;
  activeAgents: number;
  tasksRunning: number;
  tasksToday: number;
  completedToday: number;
  dbSizeBytes: number | null;
  memoryUsage: NodeJS.MemoryUsage;
  suggestions: {
    total: number;
    new: number;
    accepted: number;
    shipped: number;
  };
}

export interface AdminStreamEvent {
  type: 'stats' | 'health' | 'metrics';
  data: Record<string, unknown>;
}

// ---- dev.ts types ----

export interface DevStatusResponse {
  version: string;
  gitSha: string;
  branch: string;
  uptime: number;
  nodeVersion: string;
}

export interface DevRunChecksRequest {
  command: string;
}

export interface DevRunChecksResponse {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface DevGitPushRequest {
  branch: string;
}

export interface DevCreatePRRequest {
  branchName: string;
  title: string;
  body?: string;
}

export interface DevCreatePRResponse {
  prNumber: number;
  prUrl: string;
  branch: string;
  sha: string;
}

export interface DevAuditLogResponse {
  entries: Array<{
    id: string;
    action: string;
    status: string;
    detail?: string;
    timestamp: string;
  }>;
  count: number;
}

// ---- debug-routing.ts types ----

export interface RoutingTraceFilter {
  limit?: number;
  provider?: string;
  intent?: string;
  userId?: string;
}

export interface RoutingStatsResponse {
  totalRequests: number;
  averageLatencyMs: number;
  ollamaAvailabilityRate: number;
  forcedRoutingCount: number;
  providerDistribution: Record<string, number>;
  reasonDistribution: Record<string, number>;
  intentDistribution: Record<string, number>;
}

export interface RoutingConfigResponse {
  ollama: {
    baseUrl: string;
    model: string;
    timeoutMs: number;
    available: boolean;
  };
  openrouterFree: {
    baseUrl: string;
    available: boolean;
  };
  openrouter: {
    baseUrl: string;
    available: boolean;
  };
  moonshot: {
    reasoningModel: string;
    available: boolean;
  };
  testMode: boolean;
  manualOverride: string | null;
}

// ---- routes-list.ts types ----

export interface RouteEntry {
  method: string;
  path: string;
  auth: boolean;
  description: string;
}

export interface RoutesListResponse {
  version: string;
  description: string;
  routes: RouteEntry[];
}

// ---- models.ts types ----

export interface FreeModel {
  id: string;
  displayName: string;
  provider: string;
  summary: string;
  contextLength: number;
  parameters: string | null;
  status: string;
  curated: boolean;
  isNew: boolean;
}

export interface FreeModelsResponse {
  models: FreeModel[];
  lastUpdated: string | null;
}

export interface ModelChangelogEntry {
  modelId: string;
  displayName: string;
  event: string;
  timestamp: string;
}

export interface ModelChangelogResponse {
  entries: ModelChangelogEntry[];
}
