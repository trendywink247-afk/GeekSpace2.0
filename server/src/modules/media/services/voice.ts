/**
 * Voice Service -- Speech-to-Text and Text-to-Speech
 *
 * **STT (Speech-to-Text):** Uses Groq's Whisper Large v3 Turbo endpoint.
 * API keys are round-robined from `GROQ_API_KEY`, `GROQ_API_KEY2`, and
 * `GROQ_API_KEY3` for load distribution. Accepts OGG/M4A audio buffers
 * (typically voice messages from Telegram) and returns the transcribed text.
 *
 * **TTS (Text-to-Speech):** Uses `edge-tts` (Microsoft neural voices) with
 * zero API cost. The output is converted to OGG Opus via `ffmpeg` for
 * Telegram voice note compatibility. Script detection auto-selects the
 * appropriate voice (Hindi, Telugu, Tamil, Bengali, Marathi, etc.).
 *
 * The service gracefully degrades: {@link isVoiceEnabled} returns `false`
 * when no Groq API key is configured, allowing callers to skip voice
 * features without errors.
 *
 * @module services/voice
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { createHash } from 'crypto';
import { config } from '../../../config.js';
import { logger } from '../../../logger.js';
import { cacheGet, cacheSet } from '../../../services/cache.js';

const execFileAsync = promisify(execFile);

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegramBotToken}`;

// ---- Availability Check ----

export function isVoiceEnabled(): boolean {
  return !!(config.groqApiKey || (config as Record<string, unknown>).groqApiKey2 || (config as Record<string, unknown>).groqApiKey3);
}

// ---- Pick a Groq key (simple round-robin from available keys) ----

let _groqVoiceIdx = 0;
function pickGroqKey(): string {
  const keys = [
    config.groqApiKey,
    (config as Record<string, unknown>).groqApiKey2 as string | undefined,
    (config as Record<string, unknown>).groqApiKey3 as string | undefined,
  ].filter(Boolean) as string[];
  if (!keys.length) throw new Error('No Groq API key configured for voice');
  const key = keys[_groqVoiceIdx % keys.length];
  _groqVoiceIdx = (_groqVoiceIdx + 1) % keys.length;
  return key;
}

// ---- Download voice file from Telegram ----

export async function downloadTelegramVoice(fileId: string): Promise<Buffer> {
  const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`, {
    signal: AbortSignal.timeout(10000),
  });
  const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string; file_size?: number } };

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error('Failed to get file path from Telegram');
  }

  const downloadUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileData.result.file_path}`;
  const audioRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(30000) });

  if (!audioRes.ok) {
    throw new Error(`Failed to download voice file: ${audioRes.status}`);
  }

  return Buffer.from(await audioRes.arrayBuffer());
}

// ---- Transcribe voice to text (Groq Whisper Large v3 Turbo) ----

/**
 * Transcribe an audio buffer to text using Groq Whisper Large v3 Turbo.
 *
 * Sends the audio as a multipart form upload to the Groq transcription
 * endpoint with a 30-second timeout. The API key is selected via
 * round-robin from configured Groq keys.
 *
 * @param audioBuffer - Raw audio data (typically from a Telegram voice message)
 * @param mimeType    - MIME type of the audio (default `"audio/ogg"`)
 * @returns The transcribed text string
 * @throws If no Groq API key is configured
 * @throws If the Groq API returns a non-OK status or an empty transcript
 */
export async function transcribeVoice(audioBuffer: Buffer, mimeType: string = 'audio/ogg'): Promise<string> {
  const apiKey = pickGroqKey();
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'ogg';

  const form = new FormData();
  form.append('file', new Blob([audioBuffer.buffer as ArrayBuffer], { type: mimeType }), `voice.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'text');

  logger.info({ bytes: audioBuffer.length, mimeType }, 'voice:stt starting');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq Whisper failed (${response.status}): ${err}`);
  }

  const transcript = (await response.text()).trim();
  if (!transcript) throw new Error('Groq Whisper returned empty transcript');

  logger.info({ chars: transcript.length }, 'voice:stt complete');
  return transcript;
}

// ---- Text-to-Speech (edge-tts -> OGG Opus via ffmpeg) ----

const MAX_TTS_CHARS = 500;

/**
 * Convert text to an OGG Opus audio buffer using edge-tts + ffmpeg.
 *
 * The input is sanitised (action blocks, markdown, special characters
 * stripped) and truncated to 500 characters. A Microsoft neural voice
 * is auto-selected based on detected script (Devanagari, Telugu, Tamil,
 * etc.), falling back to the configured English voice.
 *
 * The pipeline: edge-tts generates an MP3 temp file, then ffmpeg
 * converts it to OGG Opus for Telegram voice note compatibility.
 * Temp files are cleaned up in a `finally` block.
 *
 * Results are cached by content hash to avoid regenerating identical
 * audio within the cache TTL.
 *
 * @param text - The text to synthesise (max 500 chars after sanitisation)
 * @returns An OGG Opus audio buffer ready to send as a voice note
 * @throws If the sanitised input is empty
 * @throws If edge-tts or ffmpeg fails
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  const input = text
    .replace(/<<<ACTION[\s\S]*?ACTION>>>/g, '')  // strip tool action blocks
    .replace(/"/g, '')
    .replace(/'/g, '')
    .replace(/\n/g, ' ')
    .replace(/\*+/g, '')          // strip markdown bold
    .replace(/#+ /g, '')          // strip markdown headers
    .replace(/\/(\w)/g, '$1')     // /remind → remind, /start → start
    .replace(/\//g, ' ')          // remaining / → space
    .replace(/ {2,}/g, ' ')       // collapse multiple spaces
    .trim()
    .slice(0, MAX_TTS_CHARS);

  if (!input) throw new Error('TTS: empty input after sanitization');

  // Auto-select voice based on script detected in the reply text.
  // Falls back to configured voice (default en-US-AriaNeural) for English/unknown.
  function detectVoice(t: string): string {
    if (/[\u0900-\u097F]/u.test(t)) return 'hi-IN-SwaraNeural';   // Hindi Devanagari
    if (/[\u0C00-\u0C7F]/u.test(t)) return 'te-IN-ShrutiNeural';  // Telugu
    if (/[\u0B80-\u0BFF]/u.test(t)) return 'ta-IN-PallaviNeural'; // Tamil
    if (/[\u0A80-\u0AFF]/u.test(t)) return 'gu-IN-NiranjanNeural';// Gujarati (if supported)
    return config.ttsVoice ?? 'en-US-AriaNeural';
  }
  const voice = detectVoice(input);
  const cacheKey = `tts:${createHash('md5').update(input + voice).digest('hex')}`;

  // Redis cache check
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.info({ cacheKey }, 'voice:tts cache hit');
      return Buffer.from(cached, 'base64');
    }
  } catch { /* non-fatal */ }

  const bin = config.edgeTtsBin ?? '/opt/tts-venv/bin/edge-tts';
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tmpMp3 = `/tmp/tts_${id}.mp3`;
  const tmpOgg = `/tmp/tts_${id}.ogg`;

  logger.info({ chars: input.length, voice }, 'voice:tts generating');

  try {
    await execFileAsync(bin, ['--voice', voice, '--text', input, '--write-media', tmpMp3], { timeout: 15000 });
    await execFileAsync('ffmpeg', ['-i', tmpMp3, '-c:a', 'libopus', '-b:a', '32k', tmpOgg, '-y', '-loglevel', 'quiet'], { timeout: 10000 });

    const audio = await readFile(tmpOgg);
    logger.info({ bytes: audio.length }, 'voice:tts complete');

    // Cache for 24h (fire-and-forget)
    cacheSet(cacheKey, audio.toString('base64'), 86400).catch(() => {});

    return audio;
  } finally {
    unlink(tmpMp3).catch(() => {});
    unlink(tmpOgg).catch(() => {});
  }
}

// ---- Send voice note via Telegram ----

export async function sendTelegramVoice(
  chatId: string | number,
  audioBuffer: Buffer,
  replyToMessageId?: number,
  caption?: string,
): Promise<{ success: boolean }> {
  const formData = new FormData();
  formData.append('chat_id', String(chatId));
  formData.append('voice', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' }), 'reply.ogg');
  if (replyToMessageId) {
    formData.append('reply_to_message_id', String(replyToMessageId));
  }
  if (caption) {
    formData.append('caption', caption.slice(0, 1024));
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${TELEGRAM_API}/sendVoice`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) return { success: true };

      const errText = await res.text().catch(() => '');
      logger.warn({ chatId, status: res.status, error: errText, attempt }, 'voice:sendVoice failed');

      if (res.status >= 400 && res.status < 500) return { success: false };
    } catch (err) {
      logger.warn({ err, chatId, attempt }, 'voice:sendVoice attempt failed');
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return { success: false };
}

// ---- Estimate credit cost ----
// Groq Whisper: free (uses existing Groq quota) → 1 credit
// TTS: free (edge-tts) → 1 credit
export function voiceCreditCost(_audioDurationSec: number, _replyLength: number): number {
  return 2; // flat 2 credits per voice exchange
}

logger.info({ voiceEnabled: isVoiceEnabled(), ttsVoice: config.ttsVoice ?? 'en-US-AriaNeural' }, 'Voice service initialized');
