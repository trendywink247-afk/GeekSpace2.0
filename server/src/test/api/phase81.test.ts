// ============================================================
// Phase 81 Tests — Image Generation Pipeline
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../..');

function readFile(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('Phase 81 — Image Generation Pipeline', () => {

  // ── 81.2: POST /api/image/generate endpoint ──────────────────
  describe('81.2: POST /api/image/generate', () => {
    it('imageAsyncRouter exports POST /generate endpoint', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain("imageAsyncRouter.post('/generate'");
    });

    it('validates prompt is required', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('prompt is required');
      expect(src).toContain('res.status(400)');
    });

    it('enqueues image:generate job', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain("'image:generate'");
      expect(src).toContain('enqueueJob');
    });

    it('returns 202 with jobId', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('res.status(202).json({ jobId');
    });
  });

  // ── 81.3: Daily image cap enforcement ────────────────────────
  describe('81.3: Daily image cap enforcement', () => {
    it('getImageCap checks usage_events table', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('usage_events');
      expect(src).toContain("tool = 'image.generate'");
    });

    it('returns 429 with error, used, limit when cap exceeded', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('res.status(429)');
      expect(src).toContain('Image limit reached');
      expect(src).toContain('used: cap.used');
      expect(src).toContain('limit: cap.limit');
    });

    it('free tier cap is 5', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('free: 5');
    });

    it('premium tier cap is 20', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('pro: 20');
    });

    it('logImageUsage inserts into usage_events with image.generate tool', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain("'image.generate'");
      expect(src).toContain('logImageUsage');
    });
  });

  // ── 81.4: Image delivery endpoints ───────────────────────────
  describe('81.4: Image delivery', () => {
    it('imageAsyncRouter exports GET /gallery', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain("imageAsyncRouter.get('/gallery'");
    });

    it('gallery queries user_images table ordered by created_at DESC LIMIT 30', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('user_images');
      expect(src).toContain('LIMIT 30');
      expect(src).toContain('created_at DESC');
    });

    it('imageAsyncRouter exports GET /file/:id', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain("imageAsyncRouter.get('/file/:id'");
    });

    it('file endpoint returns 404 for unknown image', () => {
      const src = readFile('server/src/routes/image.ts');
      const count = (src.match(/res\.status\(404\)/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('file endpoint redirects to image URL', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('res.redirect(302');
    });
  });

  // ── 81.8: Job queue wiring ────────────────────────────────────
  describe('81.8: Job queue wiring', () => {
    it('image:generate handler is registered', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('registerJobHandler');
      expect(src).toContain("'image:generate'");
    });

    it('handler calls generateImage from media-generation service', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('generateImage');
    });

    it('handler saves result to user_images table', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('INSERT INTO user_images');
    });

    it('handler includes TODO stub for local Stable Diffusion / Ollama', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('TODO');
    });

    it('handler returns imageUrl and imageId in result', () => {
      const src = readFile('server/src/routes/image.ts');
      expect(src).toContain('imageUrl');
      expect(src).toContain('imageId');
    });
  });

  // ── Route registration in app.ts ────────────────────────────
  describe('Route registration', () => {
    it('imageAsyncRouter is imported in app.ts', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toContain("from './routes/image.js'");
    });

    it('/api/image route is registered', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toContain("app.use('/api/image', imageAsyncRouter)");
    });
  });

  // ── 81.5/81.6/81.7/81.8: Frontend ──────────────────────────
  describe('81.5/81.6/81.7/81.8: Frontend image pipeline', () => {
    it('imageAsyncService is exported from api.ts', () => {
      const src = readFile('src/services/api.ts');
      expect(src).toContain('export const imageAsyncService');
    });

    it('imageAsyncService.generate calls POST /api/image/generate', () => {
      const src = readFile('src/services/api.ts');
      const section = src.slice(src.indexOf('export const imageAsyncService'));
      expect(section).toContain('/api/image/generate');
    });

    it('imageAsyncService.generate throws IMAGE_CAP error on 429', () => {
      const src = readFile('src/services/api.ts');
      const section = src.slice(src.indexOf('export const imageAsyncService'));
      expect(section).toContain('IMAGE_CAP');
      expect(section).toContain('429');
    });

    it('imageAsyncService.gallery calls GET /image/gallery', () => {
      const src = readFile('src/services/api.ts');
      const section = src.slice(src.indexOf('export const imageAsyncService'));
      expect(section).toContain('/image/gallery');
    });

    it('AgentChatPanel detects /image [prompt] command', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain("raw.startsWith('/image ')");
    });

    it('AgentChatPanel calls imageAsyncService.generate', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('imageAsyncService');
      expect(src).toContain('imageAsyncService.generate');
    });

    it('AgentChatPanel shows image generation spinner', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('🎨 Generating image');
    });

    it('AgentChatPanel renders inline image with download link', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('msg.imageUrl');
      expect(src).toContain('imageUrl');
    });

    it('AgentChatPanel shows image cap error', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('IMAGE_CAP');
      expect(src).toContain('imageCapError');
    });

    it('ImageGalleryPage component exists', () => {
      const src = readFile('src/dashboard/pages/ImageGalleryPage.tsx');
      expect(src).toContain('ImageGalleryPage');
      // B6: unified to use imageService.list (GET /api/images) instead of the
      // old /image/gallery endpoint so generated images appear in the gallery
      expect(src).toContain('imageService');
    });

    it('gallery route is registered in DashboardApp', () => {
      const src = readFile('src/dashboard/DashboardApp.tsx');
      expect(src).toContain("'gallery'");
      expect(src).toContain('ImageGalleryPage');
    });
  });

});
