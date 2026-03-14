import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { randomBytes } from 'crypto';

const app = createApp();

describe('Docs Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    // Clean up docs-related tables
    try { db.prepare('DELETE FROM document_versions').run(); } catch { /* ignore */ }
    try { db.prepare('DELETE FROM documents').run(); } catch { /* ignore */ }
    try { db.prepare('DELETE FROM doc_folders').run(); } catch { /* ignore */ }
    resetDatabase();
  });

  // ── CRUD ──────────────────────────────────────────────────

  describe('POST /api/docs', () => {
    it('should create a new document', async () => {
      const user = createTestUser();

      const response = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({
          title: 'My First Doc',
          content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }]),
          tags: ['notes', 'test'],
        })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title', 'My First Doc');
      expect(response.body).toHaveProperty('content_text', 'Hello world');
      expect(response.body).toHaveProperty('word_count', 2);
      expect(response.body).toHaveProperty('source', 'web');
      expect(JSON.parse(response.body.tags)).toEqual(['notes', 'test']);

      cleanupTestUser(user.id);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/docs')
        .send({ title: 'Unauthed doc' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/docs', () => {
    it('should list user docs', async () => {
      const user = createTestUser();

      // Create two docs
      await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Doc A' })
        .expect(201);

      await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Doc B' })
        .expect(201);

      const response = await request(app)
        .get('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body.docs).toBeInstanceOf(Array);
      expect(response.body.docs.length).toBe(2);

      cleanupTestUser(user.id);
    });

    it('should filter by pinned', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Pinned Doc' })
        .expect(201);

      await request(app)
        .patch(`/api/docs/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ pinned: true })
        .expect(200);

      await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Normal Doc' })
        .expect(201);

      const response = await request(app)
        .get('/api/docs?pinned=1')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body.docs.length).toBe(1);
      expect(response.body.docs[0].title).toBe('Pinned Doc');

      cleanupTestUser(user.id);
    });

    it('should filter by archived', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Archived Doc' })
        .expect(201);

      await request(app)
        .patch(`/api/docs/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ archived: true })
        .expect(200);

      // Default: excludes archived
      const defaultRes = await request(app)
        .get('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(defaultRes.body.docs.length).toBe(0);

      // Explicit archived=1: includes only archived
      const archivedRes = await request(app)
        .get('/api/docs?archived=1')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(archivedRes.body.docs.length).toBe(1);

      cleanupTestUser(user.id);
    });
  });

  describe('GET /api/docs/:id', () => {
    it('should return a single document', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Detail Doc' })
        .expect(201);

      const response = await request(app)
        .get(`/api/docs/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body).toHaveProperty('id', createRes.body.id);
      expect(response.body).toHaveProperty('title', 'Detail Doc');

      cleanupTestUser(user.id);
    });

    it('should return 404 for non-existent doc', async () => {
      const user = createTestUser();

      await request(app)
        .get('/api/docs/nonexistent')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(404);

      cleanupTestUser(user.id);
    });
  });

  describe('PUT /api/docs/:id', () => {
    it('should fully update a document', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Original Title' })
        .expect(201);

      const newContent = JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'Updated content with more words here' }] }]);

      const response = await request(app)
        .put(`/api/docs/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({
          title: 'Updated Title',
          content: newContent,
          tags: ['updated'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('title', 'Updated Title');
      expect(response.body).toHaveProperty('content_text', 'Updated content with more words here');
      expect(response.body.word_count).toBe(6);
      expect(JSON.parse(response.body.tags)).toEqual(['updated']);

      cleanupTestUser(user.id);
    });
  });

  describe('PATCH /api/docs/:id', () => {
    it('should partially update a document', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Patch Me' })
        .expect(201);

      const response = await request(app)
        .patch(`/api/docs/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Patched Title', pinned: true })
        .expect(200);

      expect(response.body).toHaveProperty('title', 'Patched Title');
      expect(response.body).toHaveProperty('pinned', 1);

      cleanupTestUser(user.id);
    });

    it('should return 400 with no fields', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Empty Patch' })
        .expect(201);

      await request(app)
        .patch(`/api/docs/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({})
        .expect(400);

      cleanupTestUser(user.id);
    });
  });

  describe('DELETE /api/docs/:id', () => {
    it('should hard delete a document', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Delete Me' })
        .expect(201);

      const response = await request(app)
        .delete(`/api/docs/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body).toHaveProperty('deleted', true);

      // Verify it's gone
      await request(app)
        .get(`/api/docs/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(404);

      cleanupTestUser(user.id);
    });

    it('should soft delete with ?soft=true', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Soft Delete Me' })
        .expect(201);

      const response = await request(app)
        .delete(`/api/docs/${createRes.body.id}?soft=true`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body).toHaveProperty('archived', true);

      // Should still be visible when filtering by archived
      const getRes = await request(app)
        .get('/api/docs?archived=1')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(getRes.body.docs.length).toBe(1);

      cleanupTestUser(user.id);
    });

    it('should return 404 for non-existent doc', async () => {
      const user = createTestUser();

      await request(app)
        .delete('/api/docs/nonexistent')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(404);

      cleanupTestUser(user.id);
    });
  });

  // ── Search ────────────────────────────────────────────────

  describe('GET /api/docs/search', () => {
    it('should search docs by title and content', async () => {
      const user = createTestUser();

      await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({
          title: 'Recipe Collection',
          content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'pasta carbonara ingredients' }] }]),
        })
        .expect(201);

      await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Meeting Notes' })
        .expect(201);

      // Search by title
      const titleSearch = await request(app)
        .get('/api/docs/search?q=Recipe')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(titleSearch.body.docs.length).toBe(1);

      // Search by content
      const contentSearch = await request(app)
        .get('/api/docs/search?q=carbonara')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(contentSearch.body.docs.length).toBe(1);

      // Empty query
      const emptySearch = await request(app)
        .get('/api/docs/search?q=')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(emptySearch.body.docs).toEqual([]);

      cleanupTestUser(user.id);
    });
  });

  // ── Folders ───────────────────────────────────────────────

  describe('Folders CRUD', () => {
    it('should create, list, update, and delete folders', async () => {
      const user = createTestUser();

      // Create
      const createRes = await request(app)
        .post('/api/docs/folders')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ name: 'Work Notes' })
        .expect(201);

      expect(createRes.body).toHaveProperty('id');
      expect(createRes.body).toHaveProperty('name', 'Work Notes');

      // List
      const listRes = await request(app)
        .get('/api/docs/folders')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(listRes.body.folders.length).toBe(1);
      expect(listRes.body.folders[0]).toHaveProperty('doc_count', 0);

      // Update
      const updateRes = await request(app)
        .put(`/api/docs/folders/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ name: 'Personal Notes' })
        .expect(200);

      expect(updateRes.body).toHaveProperty('name', 'Personal Notes');

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/docs/folders/${createRes.body.id}`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(deleteRes.body).toHaveProperty('deleted', true);

      cleanupTestUser(user.id);
    });

    it('should reject folder creation without name', async () => {
      const user = createTestUser();

      await request(app)
        .post('/api/docs/folders')
        .set('Authorization', makeAuthHeader(user.id))
        .send({})
        .expect(400);

      cleanupTestUser(user.id);
    });

    it('should show doc count in folders', async () => {
      const user = createTestUser();

      const folderRes = await request(app)
        .post('/api/docs/folders')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ name: 'Counted Folder' })
        .expect(201);

      await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Doc in folder', folder_id: folderRes.body.id })
        .expect(201);

      const listRes = await request(app)
        .get('/api/docs/folders')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(listRes.body.folders[0].doc_count).toBe(1);

      cleanupTestUser(user.id);
    });
  });

  // ── Version History ───────────────────────────────────────

  describe('Version History', () => {
    it('should save and list versions', async () => {
      const user = createTestUser();

      const docRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({
          title: 'Versioned Doc',
          content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'version 1' }] }]),
        })
        .expect(201);

      // Save version
      const versionRes = await request(app)
        .post(`/api/docs/${docRes.body.id}/versions`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(201);

      expect(versionRes.body).toHaveProperty('id');
      expect(versionRes.body).toHaveProperty('document_id', docRes.body.id);
      expect(versionRes.body).toHaveProperty('word_count', 2);

      // List versions
      const listRes = await request(app)
        .get(`/api/docs/${docRes.body.id}/versions`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(listRes.body.versions.length).toBe(1);

      cleanupTestUser(user.id);
    });

    it('should return 404 for non-existent doc versions', async () => {
      const user = createTestUser();

      await request(app)
        .get('/api/docs/nonexistent/versions')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(404);

      cleanupTestUser(user.id);
    });
  });

  // ── Publishing ────────────────────────────────────────────

  describe('Publishing', () => {
    it('should publish a doc and access without auth', async () => {
      const user = createTestUser();

      const docRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({
          title: 'Public Doc',
          content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'shared content' }] }]),
        })
        .expect(201);

      // Publish
      const publishRes = await request(app)
        .post(`/api/docs/${docRes.body.id}/publish`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(publishRes.body).toHaveProperty('is_published', 1);
      expect(publishRes.body).toHaveProperty('public_slug');
      const slug = publishRes.body.public_slug;

      // Access without auth
      const publicRes = await request(app)
        .get(`/api/docs/share/${slug}`)
        .expect(200);

      expect(publicRes.body).toHaveProperty('title', 'Public Doc');
      expect(publicRes.body).not.toHaveProperty('user_id'); // should not leak user_id

      cleanupTestUser(user.id);
    });

    it('should unpublish a doc', async () => {
      const user = createTestUser();

      const docRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Unpublish Me' })
        .expect(201);

      // Publish first
      const publishRes = await request(app)
        .post(`/api/docs/${docRes.body.id}/publish`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      const slug = publishRes.body.public_slug;

      // Unpublish
      const unpublishRes = await request(app)
        .delete(`/api/docs/${docRes.body.id}/publish`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(unpublishRes.body).toHaveProperty('is_published', 0);

      // Public access should now fail
      await request(app)
        .get(`/api/docs/share/${slug}`)
        .expect(404);

      cleanupTestUser(user.id);
    });

    it('should return 404 for non-existent slug', async () => {
      await request(app)
        .get('/api/docs/share/nonexistent-slug')
        .expect(404);
    });
  });

  // ── Quick Capture ─────────────────────────────────────────

  describe('POST /api/docs/quick-capture', () => {
    it('should create a doc from quick text', async () => {
      const user = createTestUser();

      const response = await request(app)
        .post('/api/docs/quick-capture')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ text: 'Quick idea for the project' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('source', 'quick-capture');
      expect(response.body).toHaveProperty('content_text', 'Quick idea for the project');
      expect(response.body.word_count).toBe(5);

      cleanupTestUser(user.id);
    });

    it('should use custom title if provided', async () => {
      const user = createTestUser();

      const response = await request(app)
        .post('/api/docs/quick-capture')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ text: 'Some note', title: 'My Custom Title' })
        .expect(201);

      expect(response.body).toHaveProperty('title', 'My Custom Title');

      cleanupTestUser(user.id);
    });

    it('should reject empty text', async () => {
      const user = createTestUser();

      await request(app)
        .post('/api/docs/quick-capture')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ text: '' })
        .expect(400);

      cleanupTestUser(user.id);
    });
  });

  // ── AI Actions ────────────────────────────────────────────

  describe('POST /api/docs/:id/ai', () => {
    it('should return expected shape for valid action', async () => {
      const user = createTestUser();

      const docRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'AI Doc' })
        .expect(201);

      const response = await request(app)
        .post(`/api/docs/${docRes.body.id}/ai`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ action: 'summarize', selection: 'some selected text' })
        .expect(200);

      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('action', 'summarize');
      expect(response.body).toHaveProperty('selection', 'some selected text');
      expect(response.body.result).toContain("AI action 'summarize'");

      cleanupTestUser(user.id);
    });

    it('should reject invalid action', async () => {
      const user = createTestUser();

      const docRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'AI Doc Bad' })
        .expect(201);

      await request(app)
        .post(`/api/docs/${docRes.body.id}/ai`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ action: 'invalid-action' })
        .expect(400);

      cleanupTestUser(user.id);
    });

    it('should support all valid actions', async () => {
      const user = createTestUser();

      const docRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Multi Action Doc' })
        .expect(201);

      const actions = ['clean-up', 'expand', 'summarize', 'make-formal', 'make-casual', 'extract-tasks', 'brainstorm', 'critique'];
      for (const action of actions) {
        const res = await request(app)
          .post(`/api/docs/${docRes.body.id}/ai`)
          .set('Authorization', makeAuthHeader(user.id))
          .send({ action })
          .expect(200);

        expect(res.body.action).toBe(action);
      }

      cleanupTestUser(user.id);
    });
  });

  // ── Auth Isolation ────────────────────────────────────────

  describe('Auth isolation', () => {
    it("user A cannot see user B's docs", async () => {
      const userA = createTestUser();
      const userB = createTestUser();

      // User A creates a doc
      const docRes = await request(app)
        .post('/api/docs')
        .set('Authorization', makeAuthHeader(userA.id))
        .send({ title: 'Private A Doc' })
        .expect(201);

      // User B tries to access it
      await request(app)
        .get(`/api/docs/${docRes.body.id}`)
        .set('Authorization', makeAuthHeader(userB.id))
        .expect(404);

      // User B's list should be empty
      const listRes = await request(app)
        .get('/api/docs')
        .set('Authorization', makeAuthHeader(userB.id))
        .expect(200);
      expect(listRes.body.docs.length).toBe(0);

      // User B cannot update user A's doc
      await request(app)
        .put(`/api/docs/${docRes.body.id}`)
        .set('Authorization', makeAuthHeader(userB.id))
        .send({ title: 'Hijacked' })
        .expect(404);

      // User B cannot delete user A's doc
      await request(app)
        .delete(`/api/docs/${docRes.body.id}`)
        .set('Authorization', makeAuthHeader(userB.id))
        .expect(404);

      cleanupTestUser(userA.id);
      cleanupTestUser(userB.id);
    });

    it("user A cannot access user B's folders", async () => {
      const userA = createTestUser();
      const userB = createTestUser();

      const folderRes = await request(app)
        .post('/api/docs/folders')
        .set('Authorization', makeAuthHeader(userA.id))
        .send({ name: 'A Private Folder' })
        .expect(201);

      // User B cannot update
      await request(app)
        .put(`/api/docs/folders/${folderRes.body.id}`)
        .set('Authorization', makeAuthHeader(userB.id))
        .send({ name: 'Hijacked' })
        .expect(404);

      // User B cannot delete
      await request(app)
        .delete(`/api/docs/folders/${folderRes.body.id}`)
        .set('Authorization', makeAuthHeader(userB.id))
        .expect(404);

      cleanupTestUser(userA.id);
      cleanupTestUser(userB.id);
    });
  });
});
