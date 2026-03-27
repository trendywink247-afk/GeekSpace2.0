// ============================================================
// Media module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// ── Routes (co-located in module) ────────────────────────────
export { imagesRouter, cleanupExpiredImages } from './routes/images.js';
export { imageAsyncRouter } from './routes/image.js';
export { videosRouter } from './routes/videos.js';
export { voiceRouter } from './routes/voice.js';

// ── Services ────────────────────────────────────────────────
export {
  generateImage,
  generateVideo,
  checkMediaStatus,
  generateAvatar,
  generateProjectThumbnail,
} from './services/media-generation.js';
export type { ImageGenerationOptions, VideoGenerationOptions } from './services/media-generation.js';

export {
  isVoiceEnabled,
  downloadTelegramVoice,
  transcribeVoice,
  textToSpeech,
  sendTelegramVoice,
  voiceCreditCost,
} from './services/voice.js';

// ── Types ───────────────────────────────────────────────────
export type {
  GeneratedImage,
  GeneratedVideo,
  VideoStatus,
  ImageGenerateRequest,
  ImageGenerateResponse,
  ImageListResponse,
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoListResponse,
  VoiceJob,
  VoiceTranscribeResult,
  VoiceSynthesizeResult,
  VoiceCapStatus,
} from './types.js';

// ── Module registration ─────────────────────────────────────

import { imagesRouter } from './routes/images.js';
import { imageAsyncRouter } from './routes/image.js';
import { videosRouter } from './routes/videos.js';
import { voiceRouter } from './routes/voice.js';

export const mediaModule: AppModule = {
  name: 'media',

  registerRoutes(app: Application) {
    app.use('/api/images', imagesRouter);
    app.use('/api/videos', videosRouter);
    app.use('/api/voice', voiceRouter);
    app.use('/api/image', imageAsyncRouter);
  },
};
