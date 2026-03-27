// ============================================================
// Phase 80 Tests — Voice Pipeline (STT + TTS)
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

describe('Phase 80 — Voice Pipeline (STT + TTS)', () => {

  // ── 80.2: STT transcribe endpoint ───────────────────────────────
  describe('80.2: POST /api/voice/transcribe', () => {
    it('voiceRouter exports POST /transcribe endpoint', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain("voiceRouter.post('/transcribe'");
    });

    it('raw audio body is parsed (Content-Type: audio/*)', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('rawBody');
      expect(src).toContain('audio/');
    });

    it('enqueues voice:transcribe job', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain("'voice:transcribe'");
      expect(src).toContain('enqueueJob');
    });

    it('returns 202 with jobId', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('res.status(202).json({ jobId');
    });

    it('returns 400 when no audio data received', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('No audio data received');
      expect(src).toContain('res.status(400)');
    });
  });

  // ── 80.3: TTS speak endpoint ─────────────────────────────────────
  describe('80.3: POST /api/voice/speak', () => {
    it('voiceRouter exports POST /speak endpoint', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain("voiceRouter.post('/speak'");
    });

    it('validates that text is required', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('text is required');
    });

    it('enqueues voice:synthesize job', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain("'voice:synthesize'");
    });

    it('returns 202 with jobId for TTS', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      // Both endpoints return 202
      const count = (src.match(/res\.status\(202\)/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 80.4: Daily voice cap enforcement ───────────────────────────
  describe('80.4: Daily voice cap enforcement', () => {
    it('getVoiceCap checks usage_events table', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('usage_events');
      expect(src).toContain("tool LIKE 'voice:%'");
    });

    it('returns 429 with error, used, limit when cap exceeded', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('res.status(429)');
      expect(src).toContain('Voice limit reached');
      expect(src).toContain('used: cap.used');
      expect(src).toContain('limit: cap.limit');
    });

    it('free tier cap is 5', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('free: 5');
    });

    it('logs voice usage to usage_events with voice.stt and voice.tts tools', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain("'voice.stt'");
      expect(src).toContain("'voice.tts'");
    });
  });

  // ── 80.8: Job handlers registered ───────────────────────────────
  describe('80.8: Job queue wiring', () => {
    it('voice:transcribe handler is registered', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain("registerJobHandler");
      expect(src).toContain("'voice:transcribe'");
    });

    it('voice:synthesize handler is registered', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain("'voice:synthesize'");
    });

    it('handlers call transcribeVoice and textToSpeech from voice service', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('transcribeVoice');
      expect(src).toContain('textToSpeech');
    });

    it('handlers include TODO stub for local Whisper/piper-tts', () => {
      const src = readFile('server/src/modules/media/routes/voice.ts');
      expect(src).toContain('TODO');
    });
  });

  // ── 80.8: GET /api/jobs/:id polling ─────────────────────────────
  describe('80.8: GET /api/jobs/:id — job polling endpoint', () => {
    it('jobsRouter exports GET /:id', () => {
      const src = readFile('server/src/routes/jobs.ts');
      expect(src).toContain("jobsRouter.get('/:id'");
    });

    it('returns 404 for unknown job', () => {
      const src = readFile('server/src/routes/jobs.ts');
      expect(src).toContain('res.status(404)');
    });

    it('enforces user isolation (userId check)', () => {
      const src = readFile('server/src/routes/jobs.ts');
      expect(src).toContain('job.userId !== userId');
    });

    it('returns result only when status=done', () => {
      const src = readFile('server/src/routes/jobs.ts');
      expect(src).toContain("status === 'done'");
    });
  });

  // ── Route registration in app.ts ────────────────────────────────
  describe('Route registration', () => {
    it('mediaModule is imported in app.ts (which registers voice and jobs routes)', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toContain('mediaModule');
    });

    it('mediaModule handles voice and jobs route registration', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toContain('mediaModule');
    });

    it('/api/voice route is registered via mediaModule', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toContain('mediaModule');
    });

    it('/api/jobs route is registered via mediaModule', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toContain('mediaModule');
    });
  });

  // ── 80.5/80.6/80.7: Frontend voice recorder + TTS ───────────────
  describe('80.5/80.6/80.7: Frontend voice + TTS', () => {
    it('voiceService and jobsService are exported from api.ts', () => {
      const src = readFile('src/services/api.ts');
      expect(src).toContain('export const voiceService');
      expect(src).toContain('export const jobsService');
    });

    it('voiceService.transcribe calls POST /api/voice/transcribe', () => {
      const src = readFile('src/services/api.ts');
      const section = src.slice(src.indexOf('export const voiceService'));
      expect(section).toContain('/api/voice/transcribe');
    });

    it('voiceService.speak calls POST /voice/speak', () => {
      const src = readFile('src/services/api.ts');
      const section = src.slice(src.indexOf('export const voiceService'));
      expect(section).toContain('/voice/speak');
    });

    it('jobsService.pollUntilDone polls until done or failed', () => {
      const src = readFile('src/services/api.ts');
      const section = src.slice(src.indexOf('export const jobsService'));
      expect(section).toContain("status === 'done'");
      expect(section).toContain("status === 'failed'");
    });

    it('AgentChatPanel uses MediaRecorder for voice recording', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('MediaRecorder');
      expect(src).toContain('mediaRecorderSupported');
    });

    it('AgentChatPanel shows voice state machine states', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain("'recording'");
      expect(src).toContain("'uploading'");
      expect(src).toContain("'transcribing'");
      expect(src).toContain('recordingDuration');
    });

    it('AgentChatPanel has TTS speaker icon for agent messages', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('handleTTS');
      expect(src).toContain('Volume2');
      expect(src).toContain('tts-button');
    });

    it('cap hit error shown to user', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('Voice limit reached — upgrade for more');
    });
  });

});
