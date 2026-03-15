/**
 * Phase 106b Tests — File Upload API
 * Tests: upload, list, get, delete, auth guards, type validation, size limits, user isolation, expiry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';

const app = createApp();

describe('Files API — Phase 106b', () => {
  let authHeader: string;
  let authHeader2: string;
  let userId1: string;
  let userId2: string;

  beforeEach(() => {
    resetDatabase();
    const u1 = createTestUser();
    const u2 = createTestUser();
    userId1 = u1.id;
    userId2 = u2.id;
    authHeader = makeAuthHeader(u1.id);
    authHeader2 = makeAuthHeader(u2.id);
  });

  afterEach(() => {
    // Clean up any test upload files
    const dataDir = path.resolve(__dirname, '../../../../data/uploads');
    try {
      if (fs.existsSync(path.join(dataDir, userId1))) {
        fs.rmSync(path.join(dataDir, userId1), { recursive: true, force: true });
      }
      if (fs.existsSync(path.join(dataDir, userId2))) {
        fs.rmSync(path.join(dataDir, userId2), { recursive: true, force: true });
      }
    } catch { /* ignore cleanup errors */ }
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('POST /api/files/upload requires auth', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('hello'), 'test.txt');
    expect(res.status).toBe(401);
  });

  it('GET /api/files requires auth', async () => {
    const res = await request(app).get('/api/files');
    expect(res.status).toBe(401);
  });

  it('GET /api/files/:id requires auth', async () => {
    const res = await request(app).get('/api/files/some-id');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/files/:id requires auth', async () => {
    const res = await request(app).delete('/api/files/some-id');
    expect(res.status).toBe(401);
  });

  // ── Upload ──────────────────────────────────────────────────

  it('Upload image returns 201 with file metadata', async () => {
    // Create a minimal valid PNG (1x1 pixel)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', pngBuffer, { filename: 'test-image.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('filename');
    expect(res.body.originalName).toBe('test-image.png');
    expect(res.body.mimeType).toBe('image/png');
    expect(res.body.sizeBytes).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('Upload plain text extracts text content', async () => {
    const textContent = 'Hello, this is a test file with some content.';
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from(textContent), { filename: 'readme.txt', contentType: 'text/plain' });

    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe('text/plain');
    expect(res.body.extractedText).toBe(textContent);
  });

  it('Upload CSV extracts text content', async () => {
    const csvContent = 'name,age\nAlice,30\nBob,25';
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from(csvContent), { filename: 'data.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe('text/csv');
    expect(res.body.extractedText).toBe(csvContent);
  });

  it('Upload with no file returns 400', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('Upload disallowed type (.exe) returns 400', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('MZ fake exe'), { filename: 'malware.exe', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not allowed');
  });

  it('Upload disallowed type (application/javascript) returns 400', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('alert("xss")'), { filename: 'script.js', contentType: 'application/javascript' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not allowed');
  });

  it('Upload oversized file (>10MB) returns 413', async () => {
    // Create a buffer slightly over 10MB
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 'A');

    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', oversizedBuffer, { filename: 'big.txt', contentType: 'text/plain' });

    expect(res.status).toBe(413);
    expect(res.body.error).toContain('too large');
  });

  // ── List ────────────────────────────────────────────────────

  it('GET /api/files returns empty list for new user', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(res.body.files.length).toBe(0);
    expect(res.body.total).toBe(0);
  });

  it('List files returns only own files (user isolation)', async () => {
    // User 1 uploads a file
    await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('user1 file'), { filename: 'u1.txt', contentType: 'text/plain' });

    // User 2 uploads a file
    await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader2)
      .attach('file', Buffer.from('user2 file'), { filename: 'u2.txt', contentType: 'text/plain' });

    // User 1 sees only their file
    const res1 = await request(app)
      .get('/api/files')
      .set('Authorization', authHeader);
    expect(res1.status).toBe(200);
    expect(res1.body.files.length).toBe(1);
    expect(res1.body.files[0].originalName).toBe('u1.txt');

    // User 2 sees only their file
    const res2 = await request(app)
      .get('/api/files')
      .set('Authorization', authHeader2);
    expect(res2.status).toBe(200);
    expect(res2.body.files.length).toBe(1);
    expect(res2.body.files[0].originalName).toBe('u2.txt');
  });

  it('Expired files not returned in list', async () => {
    // Upload a file
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('will expire'), { filename: 'expiring.txt', contentType: 'text/plain' });

    expect(uploadRes.status).toBe(201);
    const fileId = uploadRes.body.id;

    // Manually set expires_at to the past
    db.prepare('UPDATE uploaded_files SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, fileId);

    // Should not appear in the list
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.files.length).toBe(0);
  });

  // ── Get single file ─────────────────────────────────────────

  it('GET /api/files/:id returns 404 for non-existent file', async () => {
    const res = await request(app)
      .get('/api/files/nonexistent-id')
      .set('Authorization', authHeader);
    expect(res.status).toBe(404);
  });

  it('GET /api/files/:id returns 404 for other users file', async () => {
    // User 1 uploads a file
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('private'), { filename: 'secret.txt', contentType: 'text/plain' });

    const fileId = uploadRes.body.id;

    // User 2 tries to access it
    const res = await request(app)
      .get(`/api/files/${fileId}`)
      .set('Authorization', authHeader2);
    expect(res.status).toBe(404);
  });

  // ── Delete ──────────────────────────────────────────────────

  it('Delete file removes from DB', async () => {
    // Upload a file
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('deleteme'), { filename: 'delete.txt', contentType: 'text/plain' });

    const fileId = uploadRes.body.id;

    // Delete it
    const deleteRes = await request(app)
      .delete(`/api/files/${fileId}`)
      .set('Authorization', authHeader);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);

    // Verify it's gone from DB
    const row = db.prepare('SELECT id FROM uploaded_files WHERE id = ?').get(fileId);
    expect(row).toBeUndefined();

    // Verify it's gone from list
    const listRes = await request(app)
      .get('/api/files')
      .set('Authorization', authHeader);
    expect(listRes.body.files.length).toBe(0);
  });

  it('Delete returns 404 for non-existent file', async () => {
    const res = await request(app)
      .delete('/api/files/nonexistent-id')
      .set('Authorization', authHeader);
    expect(res.status).toBe(404);
  });

  it('Cannot delete another users file', async () => {
    // User 1 uploads
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('u1 only'), { filename: 'mine.txt', contentType: 'text/plain' });

    const fileId = uploadRes.body.id;

    // User 2 tries to delete
    const res = await request(app)
      .delete(`/api/files/${fileId}`)
      .set('Authorization', authHeader2);
    expect(res.status).toBe(404);

    // Verify file still exists for user 1
    const row = db.prepare('SELECT id FROM uploaded_files WHERE id = ?').get(fileId);
    expect(row).toBeDefined();
  });

  // ── Upload accepted MIME types ──────────────────────────────

  it('Accepts JPEG upload', async () => {
    // Minimal JPEG (actually just a fake, but multer checks mimetype from the Content-Type header)
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe('image/jpeg');
  });

  it('Accepts WebP upload', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('RIFF....WEBP'), { filename: 'image.webp', contentType: 'image/webp' });
    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe('image/webp');
  });

  it('Accepts GIF upload', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('GIF89a'), { filename: 'anim.gif', contentType: 'image/gif' });
    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe('image/gif');
  });

  it('Accepts markdown upload and extracts text', async () => {
    const md = '# Hello\n\nThis is **markdown**.';
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from(md), { filename: 'notes.md', contentType: 'text/markdown' });
    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe('text/markdown');
    expect(res.body.extractedText).toBe(md);
  });

  // ── Pagination ──────────────────────────────────────────────

  it('List files supports pagination', async () => {
    // Upload 3 files
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/files/upload')
        .set('Authorization', authHeader)
        .attach('file', Buffer.from(`file ${i}`), { filename: `file${i}.txt`, contentType: 'text/plain' });
    }

    // Get first page (limit=2)
    const page1 = await request(app)
      .get('/api/files?limit=2&offset=0')
      .set('Authorization', authHeader);
    expect(page1.status).toBe(200);
    expect(page1.body.files.length).toBe(2);
    expect(page1.body.total).toBe(3);

    // Get second page
    const page2 = await request(app)
      .get('/api/files?limit=2&offset=2')
      .set('Authorization', authHeader);
    expect(page2.status).toBe(200);
    expect(page2.body.files.length).toBe(1);
    expect(page2.body.total).toBe(3);
  });

  // ── conversationId association ──────────────────────────────

  it('Upload with conversationId stores association', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', authHeader)
      .field('conversationId', 'conv-123')
      .attach('file', Buffer.from('linked file'), { filename: 'linked.txt', contentType: 'text/plain' });

    expect(res.status).toBe(201);
    expect(res.body.conversationId).toBe('conv-123');

    // Verify in DB
    const row = db.prepare('SELECT conversation_id FROM uploaded_files WHERE id = ?').get(res.body.id) as { conversation_id: string };
    expect(row.conversation_id).toBe('conv-123');
  });
});
