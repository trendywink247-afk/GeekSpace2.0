/**
 * File Upload Middleware — Multer configuration for chat file attachments
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directory exists
const UPLOAD_DIR = '/tmp/agentin-uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 5;

const ALLOWED_MIMES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  // Text/Code
  'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/markdown',
  'text/csv', 'text/xml', 'text/x-python', 'text/x-java',
  'application/json', 'application/xml', 'application/javascript',
  'application/typescript', 'application/x-yaml',
  // Archives (for reference, not extraction)
  'application/zip',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  // Allow known MIME types or common code file extensions
  const ext = path.extname(file.originalname).toLowerCase();
  const codeExts = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
    '.c', '.cpp', '.h', '.cs', '.php', '.swift', '.kt', '.scala',
    '.sql', '.sh', '.bash', '.yml', '.yaml', '.toml', '.ini',
    '.env', '.md', '.mdx', '.txt', '.csv', '.json', '.xml',
  ]);
  
  if (ALLOWED_MIMES.has(file.mimetype) || codeExts.has(ext)) {
    cb(null, true);
  } else {
    cb(null, false); // Silently skip unsupported files
  }
};

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter,
});

export { UPLOAD_DIR, MAX_FILE_SIZE, MAX_FILES };
