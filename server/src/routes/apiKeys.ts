import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, apiKeyCreateSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { encrypt } from '../utils/encryption.js';

export const apiKeysRouter = Router();

apiKeysRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const keys = db.prepare('SELECT id, user_id, provider, label, masked_key, is_default, created_at FROM api_keys WHERE user_id = ?').all(req.userId!);
  res.json(keys);
});

apiKeysRouter.post('/', requireAuth, validateBody(apiKeyCreateSchema), (req: AuthRequest, res) => {
  const { provider, label, key } = req.body;

  const id = uuid();
  const maskedKey = key.slice(0, 3) + '...' + key.slice(-4);
  const existingKeys = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?').get(req.userId!) as Record<string, unknown>;
  const isDefault = (existingKeys.count as number) === 0 ? 1 : 0;

  const encryptedKey = encrypt(key);
  db.prepare('INSERT INTO api_keys (id, user_id, provider, label, key_encrypted, masked_key, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, req.userId, provider, label || '', encryptedKey, maskedKey, isDefault
  );

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Added API key', ?, 'key')`).run(uuid(), req.userId, `${provider} key added`);

  res.status(201).json({ id, userId: req.userId, provider, label: label || '', maskedKey, isDefault: !!isDefault, createdAt: new Date().toISOString() });
});

apiKeysRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true });
});

// 56.5: Rotate (re-key) an existing API key entry — update value without delete+re-add
apiKeysRouter.post('/:id/rotate', requireAuth, (req: AuthRequest, res) => {
  const { key } = req.body as { key?: string };
  if (!key || typeof key !== 'string' || key.trim().length < 8) {
    res.status(400).json({ error: 'New key value is required (min 8 chars)' });
    return;
  }
  const existing = db.prepare('SELECT id, provider FROM api_keys WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId!) as { id: string; provider: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }
  const trimmedKey = key.trim();
  const maskedKey = trimmedKey.slice(0, 3) + '...' + trimmedKey.slice(-4);
  const encryptedKey = encrypt(trimmedKey);
  db.prepare('UPDATE api_keys SET key_encrypted = ?, masked_key = ? WHERE id = ? AND user_id = ?')
    .run(encryptedKey, maskedKey, req.params.id, req.userId!);
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Rotated API key', ?, 'key')`)
    .run(uuid(), req.userId, `${existing.provider} key rotated`);
  res.json({ success: true, maskedKey });
});

apiKeysRouter.patch('/:id/default', requireAuth, (req: AuthRequest, res) => {
  db.prepare('UPDATE api_keys SET is_default = 0 WHERE user_id = ?').run(req.userId);
  db.prepare('UPDATE api_keys SET is_default = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  const key = db.prepare('SELECT id, user_id, provider, label, masked_key, is_default, created_at FROM api_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  res.json(key);
});
