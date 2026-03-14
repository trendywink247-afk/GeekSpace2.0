// ============================================================
// Agentin Docs — Personal knowledge workspace
// CRUD for documents, folders, version history, publishing,
// AI actions, quick capture, and full-text search.
// ============================================================

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export const docsRouter = Router();

// ---- Helpers ------------------------------------------------

/** Extract plain text from JSON content (BlockNote-style blocks) */
function extractContentText(content: string): string {
  try {
    const blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) return '';
    const texts: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      if (typeof n.text === 'string') texts.push(n.text);
      if (Array.isArray(n.content)) n.content.forEach(walk);
      if (Array.isArray(n.children)) n.children.forEach(walk);
    };
    blocks.forEach(walk);
    return texts.join(' ');
  } catch {
    return typeof content === 'string' ? content : '';
  }
}

/** Count words in a string */
function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Generate a random public slug */
function generateSlug(): string {
  return randomBytes(6).toString('hex');
}

// ---- Search (must be before /:id) ---------------------------

docsRouter.get('/search', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const q = (req.query.q as string || '').trim();

  if (!q) {
    res.json({ docs: [] });
    return;
  }

  const pattern = `%${q}%`;
  const docs = db.prepare(`
    SELECT id, title, icon, folder_id, word_count, tags, pinned, archived, created_at, updated_at
    FROM documents
    WHERE user_id = ? AND archived = 0
      AND (title LIKE ? OR content_text LIKE ?)
    ORDER BY updated_at DESC
    LIMIT 50
  `).all(userId, pattern, pattern);

  res.json({ docs });
});

// ---- Folders (must be before /:id) --------------------------

docsRouter.get('/folders', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const folders = db.prepare(`
    SELECT f.*, (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id AND d.user_id = f.user_id) as doc_count
    FROM doc_folders f
    WHERE f.user_id = ?
    ORDER BY f.sort_order ASC, f.created_at ASC
  `).all(userId);

  res.json({ folders });
});

docsRouter.post('/folders', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { name, icon, parent_id } = req.body as { name?: string; icon?: string; parent_id?: string };

  if (!name?.trim()) {
    res.status(400).json({ error: 'Folder name is required' });
    return;
  }

  const id = randomBytes(8).toString('hex');
  db.prepare(`
    INSERT INTO doc_folders (id, user_id, name, icon, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, name.trim(), icon || null, parent_id || null);

  const folder = db.prepare('SELECT * FROM doc_folders WHERE id = ?').get(id);
  res.status(201).json(folder);
});

docsRouter.put('/folders/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const { name, icon, parent_id, sort_order } = req.body as {
    name?: string; icon?: string; parent_id?: string; sort_order?: number;
  };

  const existing = db.prepare('SELECT id FROM doc_folders WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    res.status(404).json({ error: 'Folder not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
  if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
  if (parent_id !== undefined) { fields.push('parent_id = ?'); values.push(parent_id || null); }
  if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id, userId);
  db.prepare(`UPDATE doc_folders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const folder = db.prepare('SELECT * FROM doc_folders WHERE id = ?').get(id);
  res.json(folder);
});

docsRouter.delete('/folders/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const result = db.prepare('DELETE FROM doc_folders WHERE id = ? AND user_id = ?').run(id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Folder not found' });
    return;
  }

  // Unlink docs from deleted folder (don't delete docs)
  db.prepare('UPDATE documents SET folder_id = NULL WHERE folder_id = ? AND user_id = ?').run(id, userId);

  res.json({ deleted: true });
});

// ---- Quick Capture ------------------------------------------

docsRouter.post('/quick-capture', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { text, title } = req.body as { text?: string; title?: string };

  if (!text?.trim()) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  const contentText = text.trim();
  const wordCount = countWords(contentText);
  // Store as a single paragraph block
  const content = JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: contentText }] }]);
  const docTitle = title?.trim() || contentText.slice(0, 60) || 'Quick Capture';

  const id = randomBytes(8).toString('hex');
  db.prepare(`
    INSERT INTO documents (id, user_id, title, content, content_text, word_count, source)
    VALUES (?, ?, ?, ?, ?, ?, 'quick-capture')
  `).run(id, userId, docTitle, content, contentText, wordCount);

  logger.info({ userId, docId: id }, 'Quick capture created');

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.status(201).json(doc);
});

// ---- Public doc view (NO auth) ------------------------------

docsRouter.get('/share/:slug', (req, res) => {
  const { slug } = req.params;

  const doc = db.prepare(`
    SELECT id, title, content, icon, cover_url, word_count, tags, created_at, updated_at
    FROM documents
    WHERE public_slug = ? AND is_published = 1
  `).get(slug);

  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  res.json(doc);
});

// ---- List docs ----------------------------------------------

docsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { folder_id, search, pinned, archived, tags } = req.query as {
    folder_id?: string; search?: string; pinned?: string; archived?: string; tags?: string;
  };

  let query = `
    SELECT id, title, icon, cover_url, folder_id, parent_id, is_published, public_slug,
           word_count, source, tags, pinned, archived, created_at, updated_at
    FROM documents WHERE user_id = ?
  `;
  const params: unknown[] = [userId];

  if (folder_id) {
    query += ' AND folder_id = ?';
    params.push(folder_id);
  }

  if (search) {
    query += ' AND (title LIKE ? OR content_text LIKE ?)';
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }

  if (pinned === '1' || pinned === 'true') {
    query += ' AND pinned = 1';
  }

  if (archived === '1' || archived === 'true') {
    query += ' AND archived = 1';
  } else {
    // By default, exclude archived
    query += ' AND archived = 0';
  }

  if (tags) {
    // Filter by tag substring in JSON tags array
    query += ' AND tags LIKE ?';
    params.push(`%${tags}%`);
  }

  query += ' ORDER BY pinned DESC, updated_at DESC';

  const docs = db.prepare(query).all(...params);
  res.json({ docs });
});

// ---- Create doc ---------------------------------------------

docsRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { title, content, folder_id, source, tags } = req.body as {
    title?: string; content?: string; folder_id?: string; source?: string; tags?: string[];
  };

  const docContent = content || '[]';
  const contentText = extractContentText(docContent);
  const wordCount = countWords(contentText);
  const docTags = Array.isArray(tags) ? JSON.stringify(tags) : '[]';

  const id = randomBytes(8).toString('hex');
  db.prepare(`
    INSERT INTO documents (id, user_id, title, content, content_text, word_count, folder_id, source, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title || 'Untitled', docContent, contentText, wordCount, folder_id || null, source || 'web', docTags);

  logger.info({ userId, docId: id }, 'Document created');

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.status(201).json(doc);
});

// ---- Get single doc -----------------------------------------

docsRouter.get('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(id, userId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  res.json(doc);
});

// ---- Full update doc ----------------------------------------

docsRouter.put('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM documents WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const { title, content, icon, cover_url, folder_id, parent_id, tags } = req.body as {
    title?: string; content?: string; icon?: string; cover_url?: string;
    folder_id?: string; parent_id?: string; tags?: string[];
  };

  const docContent = content || '[]';
  const contentText = extractContentText(docContent);
  const wordCount = countWords(contentText);
  const docTags = Array.isArray(tags) ? JSON.stringify(tags) : '[]';

  db.prepare(`
    UPDATE documents
    SET title = ?, content = ?, content_text = ?, word_count = ?,
        icon = ?, cover_url = ?, folder_id = ?, parent_id = ?, tags = ?,
        updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    title || 'Untitled', docContent, contentText, wordCount,
    icon || null, cover_url || null, folder_id || null, parent_id || null, docTags,
    id, userId
  );

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.json(doc);
});

// ---- Partial update doc -------------------------------------

docsRouter.patch('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const updates = req.body as Record<string, unknown>;
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.pinned !== undefined) { fields.push('pinned = ?'); values.push(updates.pinned ? 1 : 0); }
  if (updates.archived !== undefined) { fields.push('archived = ?'); values.push(updates.archived ? 1 : 0); }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
  if (updates.cover_url !== undefined) { fields.push('cover_url = ?'); values.push(updates.cover_url); }
  if (updates.folder_id !== undefined) { fields.push('folder_id = ?'); values.push(updates.folder_id || null); }

  if (updates.tags !== undefined) {
    const docTags = Array.isArray(updates.tags) ? JSON.stringify(updates.tags) : '[]';
    fields.push('tags = ?');
    values.push(docTags);
  }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id, userId);
  db.prepare(`UPDATE documents SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.json(doc);
});

// ---- Delete doc ---------------------------------------------

docsRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const soft = req.query.soft === 'true';

  if (soft) {
    const existing = db.prepare('SELECT id FROM documents WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    db.prepare("UPDATE documents SET archived = 1, updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(id, userId);
    logger.info({ userId, docId: id }, 'Document soft-deleted (archived)');
    res.json({ archived: true });
    return;
  }

  const result = db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  // Clean up versions
  db.prepare('DELETE FROM document_versions WHERE document_id = ?').run(id);

  logger.info({ userId, docId: id }, 'Document deleted');
  res.json({ deleted: true });
});

// ---- Version history ----------------------------------------

docsRouter.get('/:id/versions', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM documents WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const versions = db.prepare(`
    SELECT id, document_id, word_count, saved_at
    FROM document_versions
    WHERE document_id = ?
    ORDER BY saved_at DESC
  `).all(id);

  res.json({ versions });
});

docsRouter.post('/:id/versions', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const versionId = randomBytes(8).toString('hex');
  const content = doc.content as string;
  const wordCount = doc.word_count as number;

  db.prepare(`
    INSERT INTO document_versions (id, document_id, content, word_count)
    VALUES (?, ?, ?, ?)
  `).run(versionId, id, content, wordCount);

  const version = db.prepare('SELECT * FROM document_versions WHERE id = ?').get(versionId);
  res.status(201).json(version);
});

// ---- Publishing ---------------------------------------------

docsRouter.post('/:id/publish', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const slug = (doc.public_slug as string) || generateSlug();
  db.prepare("UPDATE documents SET is_published = 1, public_slug = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(slug, id, userId);

  logger.info({ userId, docId: id, slug }, 'Document published');

  const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.json(updated);
});

docsRouter.delete('/:id/publish', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM documents WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  db.prepare("UPDATE documents SET is_published = 0, updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(id, userId);

  logger.info({ userId, docId: id }, 'Document unpublished');

  const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.json(updated);
});

// ---- AI Actions ---------------------------------------------

docsRouter.post('/:id/ai', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const { action, selection } = req.body as { action?: string; selection?: string };

  const existing = db.prepare('SELECT id FROM documents WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const validActions = ['clean-up', 'expand', 'summarize', 'make-formal', 'make-casual', 'extract-tasks', 'brainstorm', 'critique'];
  if (!action || !validActions.includes(action)) {
    res.status(400).json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
    return;
  }

  logger.info({ userId, docId: id, action }, 'AI action requested');

  res.json({
    result: `AI action '${action}' would be applied here`,
    action,
    selection: selection || null,
  });
});
