// ============================================================
// GeekOS module types
// ============================================================

/** Plan-based agent limits for GeekOS bridge */
export type PlanTier = 'free' | 'pilot' | 'intro' | 'monthly' | 'halfyear' | 'yearly';

/** A user agent registered in the GeekOS bridge */
export interface UserAgent {
  id: string;
  user_id: string;
  name: string;
  personality_base: string;
  plugins?: string;
  character_json?: string;
  is_default: boolean;
  is_active: boolean;
  eliza_agent_id?: string;
  created_at: string;
  updated_at?: string;
}

/** GeekOS runtime status response */
export interface GeekosStatus {
  geekos: 'running' | 'error' | 'offline';
  agentCount?: number;
  agents?: Array<{ name?: string; id?: string }>;
  error?: string;
}

/** Gate API key row (public-facing REST API) */
export interface GateApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  label?: string;
  is_active: boolean;
  created_at: string;
}

/** Standard Gate API envelope — success variant */
export interface GateOkResponse<T = unknown> {
  success: true;
  data: T;
}

/** Standard Gate API envelope — error variant */
export interface GateErrResponse {
  success: false;
  error: string;
}

/** Union envelope returned by all Gate endpoints */
export type GateResponse<T = unknown> = GateOkResponse<T> | GateErrResponse;

/** LLM proxy — OpenAI-compatible chat completion (subset) */
export interface LlmProxyChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
