// ============================================================
// Memory module types
// ============================================================

export interface MemoryEntry {
  id: number;
  user_id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  access_count: number;
  created_at: number;
  updated_at: number;
}

export interface UserMemory {
  id: number;
  user_id: string;
  key: string;
  value: string;
  source: string;
  confidence: number;
  last_used: number;
  created_at: number;
  updated_at: number;
}

export interface ConversationEntry {
  id: number;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  model?: string;
  summary?: string;
  tags?: string;
  request_id?: string;
  created_at: number;
}

export interface SemanticResult {
  id: string;
  score: number;
  key: string;
  value: string;
  source: string;
  userId: string;
}

export interface MeiliDocument {
  id: string;
  user_id: string;
  type: 'note' | 'memory' | 'reminder' | 'habit' | 'conversation';
  title: string;
  content: string;
  created_at: number;
  updated_at?: number;
}

export interface MemoryEntity {
  id: number;
  user_id: string;
  name: string;
  type: string;
  properties?: Record<string, unknown>;
  first_seen_at: number;
  last_seen_at: number;
  mention_count: number;
  importance_score: number;
}

export interface MemoryRelation {
  id: number;
  user_id: string;
  from_entity_id: number;
  to_entity_id: number;
  relation_type: string;
  strength: number;
  last_reinforced_at: number;
}
