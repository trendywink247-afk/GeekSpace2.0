import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { v4 as uuid } from 'uuid';

// ── Entity CRUD ──────────────────────────────────────────────

export function upsertEntity(
  userId: string,
  name: string,
  type: string,
  properties: Record<string, unknown> = {}
): string {
  const now = Date.now();
  const existing = db.prepare(
    'SELECT id, properties, mention_count FROM memory_entities WHERE user_id = ? AND lower(name) = lower(?)'
  ).get(userId, name) as { id: string; properties: string; mention_count: number } | undefined;

  if (existing) {
    const merged = { ...JSON.parse(existing.properties || '{}'), ...properties };
    db.prepare(`
      UPDATE memory_entities SET properties = ?, last_seen_at = ?, mention_count = mention_count + 1,
      importance_score = MIN(1.0, importance_score + 0.05) WHERE id = ?
    `).run(JSON.stringify(merged), now, existing.id);
    return existing.id;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO memory_entities (id, user_id, name, type, properties, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, name, type, JSON.stringify(properties), now, now);
  return id;
}

// ── Relation CRUD ────────────────────────────────────────────

export function addRelation(
  userId: string,
  fromEntityId: string,
  toEntityId: string,
  relationType: string
): void {
  const existing = db.prepare(
    'SELECT id FROM memory_relations WHERE from_entity_id = ? AND to_entity_id = ? AND relation_type = ?'
  ).get(fromEntityId, toEntityId, relationType);

  if (existing) {
    db.prepare('UPDATE memory_relations SET strength = MIN(1.0, strength + 0.1), last_reinforced_at = ? WHERE id = ?')
      .run(Date.now(), (existing as any).id);
  } else {
    db.prepare(`
      INSERT INTO memory_relations (id, user_id, from_entity_id, to_entity_id, relation_type, last_reinforced_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), userId, fromEntityId, toEntityId, relationType, Date.now());
  }
}

// ── Entity Recall ────────────────────────────────────────────

export function recallEntity(userId: string, name: string): {
  entity: any;
  relations: any[];
  mentions: number;
} | null {
  const entity = db.prepare(
    'SELECT * FROM memory_entities WHERE user_id = ? AND lower(name) = lower(?)'
  ).get(userId, name) as any;
  if (!entity) return null;

  const relations = db.prepare(`
    SELECT r.*, e.name as related_name, e.type as related_type
    FROM memory_relations r
    JOIN memory_entities e ON (e.id = r.to_entity_id OR e.id = r.from_entity_id) AND e.id != ?
    WHERE (r.from_entity_id = ? OR r.to_entity_id = ?) AND r.user_id = ?
  `).all(entity.id, entity.id, entity.id, userId) as any[];

  return {
    entity: { ...entity, properties: JSON.parse(entity.properties || '{}') },
    relations,
    mentions: entity.mention_count,
  };
}

// ── Lightweight Entity Extraction (regex-based, no LLM) ─────

const PERSON_PATTERNS = [
  /(?:with|meet|call|email|message|talk to|spoke to|meeting with|1:1 with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|told|asked|mentioned|suggested|thinks|wants)/g,
  /(?:from|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
];

const COMPANY_PATTERNS = [
  /(?:at|from|join|left|work at|interview at)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/g,
];

const PLACE_PATTERNS = [
  /(?:in|at|visit|go to|from|travel to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
];

// Known non-entity words to skip
const SKIP_WORDS = new Set([
  'I', 'You', 'We', 'They', 'He', 'She', 'It', 'The', 'This', 'That',
  'My', 'Your', 'Our', 'Today', 'Tomorrow', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March',
  'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
  'December', 'Done', 'Yes', 'No', 'OK', 'Thanks', 'Please', 'Hello', 'Hi',
  'Good', 'Morning', 'Evening', 'Night', 'Reminder', 'Note', 'Focus',
]);

export function extractEntitiesFromText(text: string): Array<{ name: string; type: string }> {
  const entities: Array<{ name: string; type: string }> = [];
  const seen = new Set<string>();

  function addEntity(name: string, type: string) {
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 40) return;
    if (SKIP_WORDS.has(clean) || SKIP_WORDS.has(clean.split(' ')[0])) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    entities.push({ name: clean, type });
  }

  for (const pattern of PERSON_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      addEntity(m[1], 'person');
    }
  }
  for (const pattern of COMPANY_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      addEntity(m[1], 'company');
    }
  }
  for (const pattern of PLACE_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      addEntity(m[1], 'place');
    }
  }

  return entities;
}

// ── Process message for entities ─────────────────────────────

export function processMessageEntities(userId: string, message: string): void {
  try {
    const entities = extractEntitiesFromText(message);
    const entityIds: string[] = [];
    for (const e of entities) {
      const id = upsertEntity(userId, e.name, e.type);
      entityIds.push(id);
    }
    // Create relations between co-occurring entities
    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        addRelation(userId, entityIds[i], entityIds[j], 'related_to');
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Entity extraction failed (non-fatal)');
  }
}

// ── Get all entities for user ────────────────────────────────

export function getUserEntities(userId: string, limit = 20): any[] {
  return db.prepare(`
    SELECT * FROM memory_entities WHERE user_id = ?
    ORDER BY importance_score DESC, mention_count DESC LIMIT ?
  `).all(userId, limit);
}
