// ============================================================
// SHIM — re-exports from media module (canonical location)
// Kept for backward-compatibility with external imports.
// ============================================================
export {
  generateImage,
  generateVideo,
  checkMediaStatus,
  generateAvatar,
  generateProjectThumbnail,
} from '../modules/media/services/media-generation.js';
export type { ImageGenerationOptions, VideoGenerationOptions } from '../modules/media/services/media-generation.js';
