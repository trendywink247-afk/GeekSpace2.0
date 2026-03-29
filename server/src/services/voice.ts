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
  type TtsEngine,
  type SttEngine,
} from '../modules/media/services/voice.js';
