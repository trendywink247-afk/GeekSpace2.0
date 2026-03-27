// ============================================================
// Media module types
// ============================================================

// ── Images ──────────────────────────────────────────────────

export interface GeneratedImage {
  id: string;
  userId: string;
  prompt: string;
  model: string;
  imageUrl: string;
  width: number;
  height: number;
  source: 'pollinations' | 'huggingface' | 'openrouter' | string;
  createdAt: string;
  expiresAt: string;
}

export interface ImageGenerateRequest {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  nologo?: boolean;
  enhance?: boolean;
  style?: string;
  referenceImageUrl?: string;
}

export interface ImageListResponse {
  images: GeneratedImage[];
  count: number;
  max: number;
}

export interface ImageGenerateResponse {
  id: string;
  imageUrl: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
  source: string;
  expiresAt: string;
}

// ── Videos ──────────────────────────────────────────────────

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GeneratedVideo {
  id: string;
  userId: string;
  prompt: string;
  model: string;
  videoUrl: string;
  width: number;
  height: number;
  duration: number;
  status: VideoStatus;
  source: string;
  createdAt: string;
  expiresAt: string;
}

export interface VideoGenerateRequest {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  style?: string;
}

export interface VideoListResponse {
  videos: GeneratedVideo[];
  count: number;
  max: number;
}

export interface VideoGenerateResponse {
  id: string;
  videoUrl?: string;
  prompt: string;
  model: string;
  status: VideoStatus;
  expiresAt: string;
}

// ── Voice (STT / TTS) ──────────────────────────────────────

export interface VoiceJob {
  jobId: string;
  type: 'voice:transcribe' | 'voice:synthesize';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: VoiceTranscribeResult | VoiceSynthesizeResult;
}

export interface VoiceTranscribeResult {
  text: string;
  durationSec: number;
  language?: string;
}

export interface VoiceSynthesizeResult {
  audioUrl: string;
  durationSec: number;
  voice: string;
}

export interface VoiceCapStatus {
  used: number;
  limit: number;
  allowed: boolean;
}
