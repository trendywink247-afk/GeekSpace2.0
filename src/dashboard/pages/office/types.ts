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
  state: AgentStateType;
  isSpecialist: boolean;
  isDormant: boolean;   // specialists only: greyed out when inactive
  parentAgent?: CoreAgentId; // specialists only: which core agent owns them
  lastContent?: string;
  lastTool?: string;
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
}

export interface DoorState {
  isOpen: boolean;
  frame: number;        // 0-5 animation frame
  agentPassing?: AgentId;
}

export type ConnectionMode = 'live' | 'reconnecting' | 'polling';
export type ControlTab = 'tasks' | 'comms' | 'metrics' | 'timeline';
