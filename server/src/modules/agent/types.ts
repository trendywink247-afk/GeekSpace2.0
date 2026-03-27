// ============================================================
// Agent module types
// ============================================================

export interface AgentConfig {
  id: string;
  user_id: string;
  personality?: string;
  temperature?: number;
  model?: string;
  provider?: string;
  system_prompt?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  model?: string;
  provider?: string;
  stream?: boolean;
}

export interface ChatResponse {
  reply: string;
  conversationId: string;
  model: string;
  provider: string;
  creditsUsed?: number;
}

export interface PicoAgent {
  id: string;
  user_id: string;
  name: string;
  role: string;
  system_prompt: string;
  model?: string;
  status: 'idle' | 'working' | 'error';
  created_at: string;
}

export interface PicoTask {
  id: string;
  agent_id: string;
  user_id: string;
  description: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  result?: string;
  created_at: string;
  completed_at?: string;
}

export interface AgentState {
  agentId: string;
  status: string;
  currentTask?: string;
  lastUpdate: number;
}

export interface AgentComm {
  id: string;
  from_agent: string;
  to_agent: string;
  message: string;
  type: 'delegation' | 'response' | 'broadcast';
  acknowledged: boolean;
  created_at: string;
}

export interface WorkflowStatus {
  id: string;
  user_id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  steps_completed: number;
  total_steps: number;
}
