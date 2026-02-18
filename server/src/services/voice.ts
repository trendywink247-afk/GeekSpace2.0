// ============================================================
// Voice Service — Speech-to-Text (Whisper) + Text-to-Speech
//
// Uses OpenAI Whisper API for transcription and TTS for replies.
// Gracefully degrades when OPENAI_API_KEY is not configured.
// ============================================================

import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../logger.js';

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegramBotToken}`;

// ---- OpenAI Client (lazy init) ----

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  if (!openai) {
    openai = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openai;
}

export function isVoiceEnabled(): boolean {
  return !!config.openaiApiKey;
}

// ---- Download voice file from Telegram ----

export async function downloadTelegramVoice(fileId: string): Promise<Buffer> {
  // Step 1: Get file path from Telegram
  const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`, {
    signal: AbortSignal.timeout(10000),
  });
  const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string; file_size?: number } };

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error('Failed to get file path from Telegram');
  }

  // Step 2: Download the actual file
  const downloadUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileData.result.file_path}`;
  const audioRes = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(30000),
  });

  if (!audioRes.ok) {
    throw new Error(`Failed to download voice file: ${audioRes.status}`);
  }

  const arrayBuffer = await audioRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---- Transcribe voice to text (Whisper) ----

export async function transcribeVoice(audioBuffer: Buffer, mimeType: string = 'audio/ogg'): Promise<string> {
  const client = getOpenAI();
  if (!client) {
    throw new Error('Voice transcription not configured (missing OPENAI_API_KEY)');
  }

  // Whisper expects a File-like object
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'ogg';
  const file = new File([new Uint8Array(audioBuffer)], `voice.${ext}`, { type: mimeType });

  const transcription = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text',
  });

  return (transcription as unknown as string).trim();
}

// ---- Text-to-Speech (generate voice reply) ----

export async function textToSpeech(text: string): Promise<Buffer> {
  const client = getOpenAI();
  if (!client) {
    throw new Error('TTS not configured (missing OPENAI_API_KEY)');
  }

  // Truncate to TTS limit (4096 chars)
  const truncated = text.length > 4096 ? text.slice(0, 4093) + '...' : text;

  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: truncated,
    response_format: 'opus', // Telegram voice notes use Opus in OGG
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---- Send voice note via Telegram ----

export async function sendTelegramVoice(
  chatId: string | number,
  audioBuffer: Buffer,
  replyToMessageId?: number,
): Promise<{ success: boolean }> {
  const formData = new FormData();
  formData.append('chat_id', String(chatId));
  formData.append('voice', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' }), 'reply.ogg');
  if (replyToMessageId) {
    formData.append('reply_to_message_id', String(replyToMessageId));
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${TELEGRAM_API}/sendVoice`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        return { success: true };
      }

      const errText = await res.text().catch(() => '');
      logger.warn({ chatId, status: res.status, error: errText, attempt }, 'Telegram sendVoice failed');

      if (res.status >= 400 && res.status < 500) {
        return { success: false };
      }
    } catch (err) {
      logger.warn({ err, chatId, attempt }, 'Telegram sendVoice attempt failed');
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return { success: false };
}

// ---- Estimate credit cost for voice operations ----

// Whisper: ~$0.006/min → ~2 credits per minute of audio
// TTS: ~$0.015/1K chars → ~3 credits per 1K chars reply
export function voiceCreditCost(audioDurationSec: number, replyLength: number): number {
  const transcriptionCredits = Math.max(2, Math.ceil((audioDurationSec / 60) * 2));
  const ttsCredits = Math.max(2, Math.ceil((replyLength / 1000) * 3));
  return transcriptionCredits + ttsCredits;
}

logger.info({ voiceEnabled: isVoiceEnabled() }, 'Voice service initialized');
