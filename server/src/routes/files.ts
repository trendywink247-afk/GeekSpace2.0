// ============================================================
// File Upload Routes — Phase 106b
// Upload, list, serve, and delete user files for chat attachments.
// Supports images, PDFs, plain text, markdown, and CSV.
// ============================================================

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export const filesRouter = Router();

// ---- Constants ------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

// File extension map for sanitized filenames
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
};

// 30 days in milliseconds
const FILE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// ---- Uploads directory ----------------------------------------

const __routesDirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__routesDirname, '../../../data');

function getUploadsDir(userId: string): string {
  const dir = path.join(DATA_DIR, 'uploads', userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---- Multer config --------------------------------------------

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// ---- Helpers --------------------------------------------------

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || '';
  } catch (err) {
    logger.warn({ err }, 'PDF text extraction failed');
    return '';
  }
}

function extractTextFromBuffer(buffer: Buffer, mimeType: string): string {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv') {
    return buffer.toString('utf-8');
  }
  return '';
}

// ---- POST /api/files/upload -----------------------------------

filesRouter.post('/upload', requireAuth, (req: AuthRequest, res, next) => {
  // Wrap multer to catch its errors and return proper status codes
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.` });
        }
        return res.status(400).json({ error: err.message });
      }
      // Custom file filter error
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const fileId = uuid();
    const ext = MIME_TO_EXT[file.mimetype] || '.bin';
    const filename = `${fileId}${ext}`;
    const uploadsDir = getUploadsDir(userId);
    const filePath = path.join(uploadsDir, filename);

    // Write file to disk
    fs.writeFileSync(filePath, file.buffer);

    // Extract text content for PDFs and text files
    let extractedText: string | null = null;
    if (file.mimetype === 'application/pdf') {
      extractedText = await extractTextFromPdf(file.buffer);
    } else {
      const text = extractTextFromBuffer(file.buffer, file.mimetype);
      if (text) {
        extractedText = text;
      }
    }

    const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : null;
    const expiresAt = Date.now() + FILE_EXPIRY_MS;

    // Insert into DB
    db.prepare(`
      INSERT INTO uploaded_files (id, user_id, filename, original_name, mime_type, size_bytes, file_path, extracted_text, conversation_id, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fileId, userId, filename, file.originalname, file.mimetype, file.size, filePath, extractedText, conversationId, expiresAt);

    logger.info({ userId, fileId, mimeType: file.mimetype, sizeBytes: file.size }, 'File uploaded');

    res.status(201).json({
      id: fileId,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      extractedText: extractedText || undefined,
      conversationId: conversationId || undefined,
      expiresAt,
    });
  } catch (err) {
    logger.error({ err, userId }, 'File upload failed');
    res.status(500).json({ error: 'File upload failed' });
  }
});

// ---- GET /api/files -------------------------------------------

filesRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset)) || 0, 0);

  const now = Date.now();

  const files = db.prepare(`
    SELECT id, filename, original_name, mime_type, size_bytes, conversation_id, expires_at, created_at
    FROM uploaded_files
    WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, now, limit, offset) as Array<{
    id: string;
    filename: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    conversation_id: string | null;
    expires_at: number | null;
    created_at: number;
  }>;

  const totalRow = db.prepare(`
    SELECT COUNT(*) as count FROM uploaded_files
    WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)
  `).get(userId, now) as { count: number };

  res.json({
    files: files.map(f => ({
      id: f.id,
      filename: f.filename,
      originalName: f.original_name,
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      conversationId: f.conversation_id,
      expiresAt: f.expires_at,
      createdAt: f.created_at,
    })),
    total: totalRow.count,
    limit,
    offset,
  });
});

// ---- GET /api/files/:id — serve file --------------------------

filesRouter.get('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const now = Date.now();

  const file = db.prepare(`
    SELECT id, filename, original_name, mime_type, size_bytes, file_path, extracted_text, conversation_id, expires_at, created_at
    FROM uploaded_files
    WHERE id = ? AND user_id = ? AND (expires_at IS NULL OR expires_at > ?)
  `).get(id, userId, now) as {
    id: string;
    filename: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    file_path: string;
    extracted_text: string | null;
    conversation_id: string | null;
    expires_at: number | null;
    created_at: number;
  } | undefined;

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Check if file exists on disk
  if (!fs.existsSync(file.file_path)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  res.set('Content-Type', file.mime_type);
  res.set('Content-Disposition', `inline; filename="${file.original_name}"`);
  res.set('Content-Length', String(file.size_bytes));
  res.sendFile(file.file_path);
});

// ---- DELETE /api/files/:id ------------------------------------

filesRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  // Get file path before deleting from DB
  const file = db.prepare(
    'SELECT file_path FROM uploaded_files WHERE id = ? AND user_id = ?'
  ).get(id, userId) as { file_path: string } | undefined;

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Delete from DB
  db.prepare('DELETE FROM uploaded_files WHERE id = ? AND user_id = ?').run(id, userId);

  // Delete from disk (non-blocking, non-fatal)
  try {
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }
  } catch (err) {
    logger.warn({ err, fileId: id }, 'Failed to delete file from disk');
  }

  logger.info({ userId, fileId: id }, 'File deleted');
  res.json({ deleted: true });
});

// ---- Cleanup expired files (runs every 6 hours) ---------------

export function cleanupExpiredFiles(): void {
  try {
    const now = Date.now();
    const expired = db.prepare(
      'SELECT id, file_path FROM uploaded_files WHERE expires_at IS NOT NULL AND expires_at < ?'
    ).all(now) as Array<{ id: string; file_path: string }>;

    if (expired.length === 0) return;

    for (const file of expired) {
      try {
        if (fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
        }
      } catch { /* non-fatal */ }
      db.prepare('DELETE FROM uploaded_files WHERE id = ?').run(file.id);
    }

    logger.info({ count: expired.length }, 'Cleaned up expired uploaded files');
  } catch (err) {
    logger.error({ err }, 'Expired file cleanup failed');
  }
}

// Start cleanup interval (every 6 hours)
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Only start timer in non-test mode to avoid test hangs
if (process.env.TEST_MODE !== 'true' && process.env.TEST_MODE !== '1') {
  const timer = setInterval(cleanupExpiredFiles, CLEANUP_INTERVAL_MS);
  // Allow process to exit cleanly
  if (timer && typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }
}
