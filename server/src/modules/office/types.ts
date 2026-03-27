// ============================================================
// Office module types
// ============================================================

// ── Office dashboard ────────────────────────────────────────

export interface OfficeState {
  tasks: unknown[];
  taskStats: Record<string, number>;
  comms: unknown[];
  commStats: Record<string, number>;
  agentStates: Record<string, unknown>;
  recentEvents: unknown[];
  canDelegate: boolean;
}

// ── Docs ────────────────────────────────────────────────────

export interface DocSummary {
  id: string;
  userId: string;
  title: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Files ───────────────────────────────────────────────────

export interface FileMeta {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

// ── Sandbox ─────────────────────────────────────────────────

export interface SandboxInfo {
  id: string;
  userId: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  language: string;
  createdAt: string;
}

// ── Skills ──────────────────────────────────────────────────

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  tier: 'free' | 'pro';
  installed: boolean;
}

// ── Logo AI ─────────────────────────────────────────────────

export interface LogoRequest {
  prompt: string;
  category?: string;
  type?: string;
  style?: string;
}

export interface LogoResult {
  id: string;
  imageUrl: string;
  svgUrl?: string;
  prompt: string;
  createdAt: string;
}
