// src/dashboard/pages/office/types.ts

export type AgentId = 'weebo' | 'edith' | 'jarvis' | 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';
export type CoreAgentId = 'weebo' | 'edith' | 'jarvis';
export type SpecialistId = 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';

export type AgentStateType =
  | 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result'
  | 'responding' | 'done'
  | 'delegating' | 'comm_sent' | 'comm_received'
  | 'task_started' | 'task_completed' | 'task_failed';

export interface SSEEvent {
  agentId: string;
  agentName: string;
  state: AgentStateType;
  tool?: string;
  content?: string;
  targetAgent?: string;
  taskId?: string;
  commId?: string;
  requestId?: string;
  isMultiAgent?: boolean;
  timestamp: string;
}

export interface CanvasAgent {
  id: AgentId;
  name: string;
  color: string;
  emoji: string;
  role: string;
  x: number;           // grid column
  y: number;           // grid row
  targetX: number;     // BFS target column
  targetY: number;     // BFS target row
  renderX: number;     // smooth pixel X for rendering (interpolated)
  renderY: number;     // smooth pixel Y for rendering (interpolated)
  speed: number;       // pixels per tick (varies per agent personality)
  state: AgentStateType;
  isSpecialist: boolean;
  isDormant: boolean;   // specialists only: greyed out when inactive
  parentAgent?: CoreAgentId; // specialists only: which core agent owns them
  lastContent?: string;
  lastTool?: string;
  facing?: 'down' | 'up' | 'left' | 'right';
  path: Array<{ x: number; y: number }>;  // full BFS path to destination
  pathIndex: number;   // current step in path
}

export interface ParticleBeam {
  id: string;
  fromAgentId: AgentId;
  toAgentId: AgentId;
  color: string;
  createdAt: number;    // Date.now()
  duration: number;     // ms
}

export interface SpeechBubble {
  id: string;
  agentId: AgentId;
  text: string;
  color: string;
  createdAt: number;
  expiresAt: number;    // createdAt + 4000
  pixelX?: number;      // smooth pixel X (from agent.renderX) — follows agent movement
  pixelY?: number;      // smooth pixel Y (from agent.renderY) — follows agent movement
}

export interface DoorState {
  isOpen: boolean;
  frame: number;        // 0-5 animation frame
  agentPassing?: AgentId;
}

export type ConnectionMode = 'live' | 'reconnecting' | 'polling';
export type ControlTab = 'tasks' | 'comms' | 'metrics' | 'timeline';

export interface TimelineEntry {
  id: string;
  type: 'reply' | 'tool_call' | 'insight' | 'reminder' | 'automation' | 'multi_agent' | 'habit' | 'comm';
  agentId?: AgentId;
  agentName?: string;
  agentColor?: string;
  action: string;
  details?: string;
  icon?: string;
  timestamp: string;
  actions?: Array<{ label: string; action: string; color: string }>;
  relatedAgents?: AgentId[];
}

export interface InsightCard {
  id: string;
  agentId: AgentId;
  agentName: string;
  text: string;
  category: 'spending' | 'habits' | 'calendar' | 'general';
  timestamp: string;
  dismissed: boolean;
}

export interface OfficeMetrics {
  creditsUsedToday: number;
  messagesToday: number;
  toolCallsToday: number;
  providerBreakdown: Record<string, number>;
}

export type SidebarTab = 'timeline' | 'tasks' | 'metrics';
