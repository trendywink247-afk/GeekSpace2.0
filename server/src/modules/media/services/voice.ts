/**
 * Voice Service -- Speech-to-Text and Text-to-Speech
 *
 * **TTS (Text-to-Speech):** Fallback chain: Kokoro TTS → Piper TTS → edge-tts.
 * Kokoro and Piper run as Docker sidecars (ONNX, CPU). edge-tts (Microsoft
 * neural voices) is the zero-cost last resort. Output is OGG Opus for
 * Telegram voice note compatibility.
 *
 * **STT (Speech-to-Text):** Fallback chain: whisper.cpp (local) → Groq Whisper (cloud).
 * whisper.cpp runs as a Docker sidecar with the base.en model. Groq Whisper
 * Large v3 Turbo is the cloud fallback. API keys are round-robined from
 * `GROQ_API_KEY`, `GROQ_API_KEY2`, and `GROQ_API_KEY3`.
 *
 * The service gracefully degrades: {@link isVoiceEnabled} returns `true`
 * when any STT provider is available (local whisper or Groq API key).
 *
 * @module services/voice
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { config } from '../../../config.js';
import { logger } from '../../../logger.js';
import { cacheGet, cacheSet } from '../../../services/cache.js';

const execFileAsync = promisify(execFile);

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegramBotToken}`;

// ---- TTS Engine type (for observability) ----

export type TtsEngine = 'kokoro' | 'piper' | 'edge-tts';
export type SttEngine = 'whisper-local' | 'groq';

// ---- Availability Check ----

export function isVoiceEnabled(): boolean {
  return !!(
    config.whisperLocalEnabled ||
    config.groqApiKey ||
    (config as Record<string, unknown>).groqApiKey2 ||
    (config as Record<string, unknown>).groqApiKey3
  );
}

// ---- Sidecar health check (30s cache — same pattern as isOllamaAvailable) ----

const _healthCache = new Map<string, { ok: boolean; time: number }>();

async function isSidecarHealthy(url: string): Promise<boolean> {
  const cached = _healthCache.get(url);
  if (cached && Date.now() - cached.time < 30_000) return cached.ok;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${url}/health`, { signal: ctrl.signal });
    clearTimeout(timeout);
    const body = res.ok
      ? await res.json().catch(() => null) as { status?: string } | null
      : null;
    const ok = res.ok && body?.status === 'ok';
    _healthCache.set(url, { ok, time: Date.now() });
    return ok;
  } catch {
    _healthCache.set(url, { ok: false, time: Date.now() });
    return false;
  }
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

// ---- WAV → OGG Opus conversion ----

async function wavToOggOpus(wavBuffer: Buffer): Promise<Buffer> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tmpWav = `/tmp/tts_${id}.wav`;
  const tmpOgg = `/tmp/tts_${id}.ogg`;

  try {
    await writeFile(tmpWav, wavBuffer);
    await execFileAsync('ffmpeg', ['-i', tmpWav, '-c:a', 'libopus', '-b:a', '32k', tmpOgg, '-y', '-loglevel', 'quiet'], { timeout: 15000 });
    return await readFile(tmpOgg);
  } finally {
    unlink(tmpWav).catch(() => {});
    unlink(tmpOgg).catch(() => {});
  }
}

// ---- Kokoro TTS sidecar call ----

async function callKokoroTts(text: string, voice?: string): Promise<Buffer> {
  const response = await fetch(`${config.kokoroTtsUrl}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voice || 'af_heart', speed: 1.0 }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Kokoro TTS failed (${response.status}): ${err}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// ---- Piper TTS sidecar call ----

async function callPiperTts(text: string, voice?: string): Promise<Buffer> {
  const response = await fetch(`${config.piperTtsUrl}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voice || 'en_US-amy-medium', speed: 1.0 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Piper TTS failed (${response.status}): ${err}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// ---- Local Whisper STT sidecar call ----

async function callLocalWhisper(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'ogg';

  const form = new FormData();
  form.append('file', new Blob([audioBuffer.buffer as ArrayBuffer], { type: mimeType }), `voice.${ext}`);

  const response = await fetch(`${config.whisperLocalUrl}/transcribe`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Local Whisper failed (${response.status}): ${err}`);
  }

  const data = await response.json() as { text?: string };
  const text = (data.text || '').trim();
  if (!text) throw new Error('Local Whisper returned empty transcript');
  return text;
}

// ---- Groq Whisper STT (cloud fallback) ----

async function callGroqWhisper(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = pickGroqKey();
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'ogg';

  const form = new FormData();
  form.append('file', new Blob([audioBuffer.buffer as ArrayBuffer], { type: mimeType }), `voice.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'text');

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
  return transcript;
}

// ---- Transcribe voice — fallback chain: whisper.cpp (local) → Groq (cloud) ----

export async function transcribeVoice(
  audioBuffer: Buffer,
  mimeType: string = 'audio/ogg',
): Promise<{ text: string; engine: SttEngine }> {
  logger.info({ bytes: audioBuffer.length, mimeType }, 'voice:stt starting');

  // Try local whisper.cpp first
  if (config.whisperLocalEnabled) {
    try {
      const healthy = await isSidecarHealthy(config.whisperLocalUrl);
      if (healthy) {
        const text = await callLocalWhisper(audioBuffer, mimeType);
        logger.info({ chars: text.length, engine: 'whisper-local' }, 'voice:stt complete');
        return { text, engine: 'whisper-local' };
      }
    } catch (err) {
      logger.warn({ error: String(err) }, 'voice:stt local whisper failed, falling back to Groq');
    }
  }

  // Fallback to Groq Whisper (cloud)
  const hasGroqKey = !!(config.groqApiKey || (config as Record<string, unknown>).groqApiKey2 || (config as Record<string, unknown>).groqApiKey3);
  if (!hasGroqKey) throw new Error('No STT provider available (whisper-local down + no Groq key)');

  const text = await callGroqWhisper(audioBuffer, mimeType);
  logger.info({ chars: text.length, engine: 'groq' }, 'voice:stt complete');
  return { text, engine: 'groq' };
}

// ---- Text-to-Speech — fallback chain: Kokoro → Piper → edge-tts ----

const MAX_TTS_CHARS = 2000;

function sanitizeTtsInput(text: string): string {
  return text
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
}

// Auto-select voice based on script detection (for edge-tts fallback)
function detectEdgeTtsVoice(t: string): string {
  if (/[\u0900-\u097F]/u.test(t)) return 'hi-IN-SwaraNeural';   // Hindi Devanagari
  if (/[\u0C00-\u0C7F]/u.test(t)) return 'te-IN-ShrutiNeural';  // Telugu
  if (/[\u0B80-\u0BFF]/u.test(t)) return 'ta-IN-PallaviNeural'; // Tamil
  if (/[\u0A80-\u0AFF]/u.test(t)) return 'gu-IN-NiranjanNeural';// Gujarati
  return config.ttsVoice ?? 'en-US-AriaNeural';
}

// Detect if text is non-English (Kokoro/Piper may not support these)
function isNonLatinScript(t: string): boolean {
  return /[\u0900-\u097F]/u.test(t) ||
    /[\u0C00-\u0C7F]/u.test(t) ||
    /[\u0B80-\u0BFF]/u.test(t) ||
    /[\u0A80-\u0AFF]/u.test(t);
}

// edge-tts fallback (existing pipeline)
async function textToSpeechEdgeTts(input: string, voice: string): Promise<Buffer> {
  const bin = config.edgeTtsBin ?? '/opt/tts-venv/bin/edge-tts';
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tmpMp3 = `/tmp/tts_${id}.mp3`;
  const tmpOgg = `/tmp/tts_${id}.ogg`;

  try {
    await execFileAsync(bin, ['--voice', voice, '--text', input, '--write-media', tmpMp3], { timeout: 15000 });
    await execFileAsync('ffmpeg', ['-i', tmpMp3, '-c:a', 'libopus', '-b:a', '32k', tmpOgg, '-y', '-loglevel', 'quiet'], { timeout: 10000 });
    return await readFile(tmpOgg);
  } finally {
    unlink(tmpMp3).catch(() => {});
    unlink(tmpOgg).catch(() => {});
  }
}

export async function textToSpeech(text: string): Promise<{ audio: Buffer; engine: TtsEngine }> {
  const input = sanitizeTtsInput(text);
  if (!input) throw new Error('TTS: empty input after sanitization');

  const cacheKey = `tts:${createHash('md5').update(input).digest('hex')}`;

  // Redis cache check
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.info({ cacheKey }, 'voice:tts cache hit');
      try {
        const parsed = JSON.parse(cached) as { audioBase64: string; engine: TtsEngine };
        return { audio: Buffer.from(parsed.audioBase64, 'base64'), engine: parsed.engine };
      } catch {
        // Legacy cache entry (raw base64) — decode without engine info
        return { audio: Buffer.from(cached, 'base64'), engine: 'edge-tts' };
      }
    }
  } catch { /* non-fatal */ }

  const nonLatin = isNonLatinScript(input);

  logger.info({ chars: input.length, nonLatin }, 'voice:tts generating');

  // 1. Try Kokoro TTS (best quality, English only for now)
  if (config.kokoroTtsEnabled && !nonLatin) {
    try {
      const healthy = await isSidecarHealthy(config.kokoroTtsUrl);
      if (healthy) {
        const wav = await callKokoroTts(input);
        const audio = await wavToOggOpus(wav);
        logger.info({ bytes: audio.length, engine: 'kokoro' }, 'voice:tts complete');
        cacheSet(cacheKey, JSON.stringify({ audioBase64: audio.toString('base64'), engine: 'kokoro' }), 86400).catch(() => {});
        return { audio, engine: 'kokoro' };
      }
    } catch (err) {
      logger.warn({ error: String(err) }, 'voice:tts kokoro failed, trying piper');
    }
  }

  // 2. Try Piper TTS (fast fallback, English)
  if (config.piperTtsEnabled && !nonLatin) {
    try {
      const healthy = await isSidecarHealthy(config.piperTtsUrl);
      if (healthy) {
        const wav = await callPiperTts(input);
        const audio = await wavToOggOpus(wav);
        logger.info({ bytes: audio.length, engine: 'piper' }, 'voice:tts complete');
        cacheSet(cacheKey, JSON.stringify({ audioBase64: audio.toString('base64'), engine: 'piper' }), 86400).catch(() => {});
        return { audio, engine: 'piper' };
      }
    } catch (err) {
      logger.warn({ error: String(err) }, 'voice:tts piper failed, falling back to edge-tts');
    }
  }

  // 3. Fallback: edge-tts (always available, supports all languages)
  const edgeVoice = detectEdgeTtsVoice(input);
  const audio = await textToSpeechEdgeTts(input, edgeVoice);
  logger.info({ bytes: audio.length, engine: 'edge-tts' }, 'voice:tts complete');
  cacheSet(cacheKey, JSON.stringify({ audioBase64: audio.toString('base64'), engine: 'edge-tts' }), 86400).catch(() => {});
  return { audio, engine: 'edge-tts' };
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
// Local TTS/STT: free → 1 credit each
// Cloud STT (Groq): free (uses existing Groq quota) → 1 credit
export function voiceCreditCost(_audioDurationSec: number, _replyLength: number): number {
  return 2; // flat 2 credits per voice exchange
}

logger.info({
  voiceEnabled: isVoiceEnabled(),
  ttsVoice: config.ttsVoice ?? 'en-US-AriaNeural',
  kokoroEnabled: config.kokoroTtsEnabled,
  piperEnabled: config.piperTtsEnabled,
  whisperLocalEnabled: config.whisperLocalEnabled,
}, 'Voice service initialized');
