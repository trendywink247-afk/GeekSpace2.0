/**
 * Media Domain — Barrel Export
 *
 * Re-exports for image generation, video generation, voice (STT/TTS),
 * and media processing services.
 *
 * @module media
 * @see docs/MICROSERVICES_ROADMAP.md — Wave 1 extraction candidate
 */

// ── Routes ──────────────────────────────────────────────────────────
export { imagesRouter, cleanupExpiredImages } from '../../routes/images.js';
export { imageAsyncRouter } from '../../routes/image.js';
export { voiceRouter } from '../../routes/voice.js';

// ── Services ────────────────────────────────────────────────────────
export {
  generateImage,
  generateVideo,
  checkMediaStatus,
  generateAvatar,
  generateProjectThumbnail,
} from '../../services/media-generation.js';
export type { ImageGenerationOptions, VideoGenerationOptions } from '../../services/media-generation.js';

export {
  isVoiceEnabled,
  downloadTelegramVoice,
  transcribeVoice,
  textToSpeech,
  sendTelegramVoice,
  voiceCreditCost,
} from '../../services/voice.js';
