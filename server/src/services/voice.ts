// ============================================================
// SHIM — re-exports from media module (canonical location)
// Kept for backward-compatibility with external imports.
// ============================================================
export {
  isVoiceEnabled,
  downloadTelegramVoice,
  transcribeVoice,
  textToSpeech,
  sendTelegramVoice,
  voiceCreditCost,
} from '../modules/media/services/voice.js';
