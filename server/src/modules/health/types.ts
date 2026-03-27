// ============================================================
// Health module types
// ============================================================

export type ComponentStatus = Record<string, string>;

export type ServiceDetail = {
  status: 'ok' | 'degraded' | 'down' | 'not_configured';
  latencyMs: number | null;
  detail?: string;
};

export type ServiceStatus = 'up' | 'down' | 'unknown';

export interface ServiceState {
  status: ServiceStatus;
  lastCheck: string;
  lastError: string | null;
  alertSent: boolean;
  consecutiveFailures: number;
}

export interface ServiceHealthMap {
  ollama: ServiceState;
  redis: ServiceState;
}
