// ============================================================
// Docs Workspace — shared types, constants, pure helpers
// ============================================================

export interface Doc {
  id: string;
  title: string;
  content_text: string;
  icon: string | null;
  folder_id: string | null;
  is_published: number;
  word_count: number;
  source: string;
  tags: string;
  pinned: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface DocFolder {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  doc_count: number;
}

export type ViewFilter = 'recent' | 'pinned' | 'archived' | 'all';
export type AIAction = 'improve' | 'expand' | 'summarize' | 'translate' | 'rephrase' | 'fix';

export const AI_ACTION_PROMPTS: Record<AIAction, (text: string) => string> = {
  improve:   (t) => `Improve this text while preserving its meaning. Return ONLY the improved text with no commentary:\n\n${t}`,
  expand:    (t) => `Expand this text with more detail and depth. Return ONLY the expanded text with no commentary:\n\n${t}`,
  summarize: (t) => `Summarize this in 1-3 concise sentences. Return ONLY the summary with no commentary:\n\n${t}`,
  translate: (t) => `If this text is in English, translate it to Hindi. If it's in Hindi or Hinglish, translate to English. Return ONLY the translation with no commentary:\n\n${t}`,
  rephrase:  (t) => `Rephrase this in a more engaging and compelling way. Return ONLY the rephrased text with no commentary:\n\n${t}`,
  fix:       (t) => `Fix all grammar, spelling, and punctuation errors. Return ONLY the corrected text with no commentary:\n\n${t}`,
};

/** Format a date string relative to now */
export function formatDate(d: string): string {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  if (diff < 86_400_000)  return 'Today';
  if (diff < 172_800_000) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/** Safely parse a JSON tags string into a string array */
export function parseTags(tags: string): string[] {
  try { return JSON.parse(tags) as string[]; } catch { return []; }
}
