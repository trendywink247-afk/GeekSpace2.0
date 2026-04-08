// ============================================================
// Media services (images, video, voice, jobs) — extracted from api.ts
// ============================================================

import api from './api-client.js';

// ----- Images (Image Generator) --------------------------------

export interface UserImage {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  width: number;
  height: number;
  source: 'generated' | 'edited' | 'uploaded';
  created_at: string;
  expires_at: string;
}

export interface ImageModel {
  id: string;
  name: string;
  description: string;
  cost: string;
  credits: number;
  tier: 'auto' | 'free' | 'standard' | 'premium';
}

export const imageService = {
  list: () =>
    api.get<{ images: UserImage[]; count: number; max: number }>('/images'),

  get: (id: string) =>
    api.get<UserImage>(`/images/${id}`),

  generate: (prompt: string, model?: string, width?: number, height?: number) =>
    api.post<UserImage>('/images/generate', { prompt, model, width, height }),

  edit: (prompt: string, referenceUrl?: string, model?: string) =>
    api.post<UserImage>('/images/edit', { prompt, reference_url: referenceUrl, model }),

  delete: (id: string) =>
    api.delete<{ deleted: boolean }>(`/images/${id}`),

  getModels: () =>
    api.get<{ models: ImageModel[] }>('/images/models/available'),

  getModelStatus: () =>
    api.get<{ statuses: Record<string, 'ok' | 'down' | 'unknown'> }>('/images/models/status'),
};

// ----- Videos (Video Generator) --------------------------------

export interface UserVideo {
  id: string;
  prompt: string;
  model: string;
  video_url: string;
  width: number;
  height: number;
  duration: number;
  status: 'processing' | 'ready';
  source: 'generated';
  created_at: string;
  expires_at: string;
}

export interface VideoModel {
  id: string;
  name: string;
  description: string;
  cost: string;
  credits: number;
  tier: 'auto' | 'free' | 'standard' | 'premium';
}

// ── Director Mode types ───────────────────────────────────────

export interface DirectorShot {
  index: number;
  prompt: string;
  cameraMove: string;
}

export interface DirectorPacket {
  title: string;
  genre: string;
  styleGuide: string;
  transitions: string;
  shotlist: DirectorShot[];
}

export interface DirectorClip {
  success: boolean;
  url: string;
  error?: string;
  requestId?: string;
  durationMs?: number;
}

export interface DirectorJob {
  id: string;
  idea: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  packet: DirectorPacket | null;
  clips: DirectorClip[];
  error: string | null;
  credits_used: number;
  created_at: string;
  updated_at: string;
}

export const videoService = {
  list: () =>
    api.get<{ videos: UserVideo[]; count: number; max: number }>('/videos'),

  get: (id: string) =>
    api.get<UserVideo>(`/videos/${id}`),

  generate: (prompt: string, model?: string, width?: number, height?: number, duration?: number) =>
    api.post<UserVideo & { estimated_time: number }>('/videos/generate', { prompt, model, width, height, duration }),

  checkStatus: (id: string) =>
    api.get<{ status: string; video_url: string }>(`/videos/${id}/status`),

  delete: (id: string) =>
    api.delete<{ deleted: boolean }>(`/videos/${id}`),

  getModels: () =>
    api.get<{ models: VideoModel[] }>('/videos/models/available'),

  // 55.13: Seedance Director Mode
  directorCreate: (idea: string, width?: number, height?: number) =>
    api.post<{ jobId: string; status: string; message: string }>('/videos/director/create', { idea, width, height }),

  // 65.13: Expand idea with AI before creating a Director job
  directorExpandIdea: (idea: string) =>
    api.post<{ expanded: string }>('/videos/director/expand-idea', { idea }),

  directorList: () =>
    api.get<{ jobs: DirectorJob[] }>('/videos/director'),

  directorGet: (jobId: string) =>
    api.get<DirectorJob>(`/videos/director/${jobId}`),

  // 57.13: Stitch clips into one video
  directorStitch: (jobId: string) =>
    api.post<{ stitched: boolean; stitchedUrl: string | null; clipUrls: string[]; softStitch: boolean; cached?: boolean }>(`/videos/director/${jobId}/stitch`),

  // 60.13: Retry a single failed clip
  directorRetryClip: (jobId: string, clipIndex: number) =>
    api.post<{ message: string; clipIndex: number }>(`/videos/director/${jobId}/retry-clip/${clipIndex}`),

  getModelStatus: () =>
    api.get<{ statuses: Record<string, 'ok' | 'down' | 'unknown'> }>('/videos/models/status'),
};

// ----- Voice (STT + TTS) — Phase 80 -------------------------

export const voiceService = {
  /**
   * Transcribe an audio blob. Returns a jobId immediately.
   * Poll /api/jobs/:jobId until status='done' for {text, duration_seconds}.
   */
  transcribe: async (audioBlob: Blob): Promise<{ jobId: string }> => {
    const response = await fetch('/api/voice/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob.type || 'audio/webm',
        Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
      },
      body: audioBlob,
    });
    if (response.status === 429) {
      const data = await response.json() as { error: string; used: number; limit: number };
      throw Object.assign(new Error(data.error), { code: 'VOICE_CAP', used: data.used, limit: data.limit });
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || 'Transcription request failed');
    }
    return response.json() as Promise<{ jobId: string }>;
  },

  /**
   * Synthesize speech from text. Returns a jobId immediately.
   * Poll /api/jobs/:jobId until status='done' for {audioBase64, mimeType}.
   */
  speak: (text: string, voice?: string): Promise<{ jobId: string }> =>
    api.post<{ jobId: string }>('/voice/speak', { text, voice }).then(r => r.data),
};

// ----- Jobs (async polling) — Phase 80 ----------------------

export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface JobResult {
  id: string;
  type: string;
  status: JobStatus;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const jobsService = {
  /** Poll an async job by ID. */
  get: (jobId: string) => api.get<JobResult>(`/jobs/${jobId}`).then(r => r.data),

  /**
   * Poll until done or failed (max attempts, configurable interval).
   * Throws if job fails or max attempts exceeded.
   */
  poll: async (jobId: string, maxAttempts = 60): Promise<JobResult> => {
    for (let i = 0; i < maxAttempts; i++) {
      const result = await jobsService.get(jobId);
      if (result.status === 'done' || result.status === 'failed') return result;
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Job polling timed out');
  },

  /** Alias for poll — polls until done or failed. */
  pollUntilDone: async (jobId: string, maxAttempts = 60, intervalMs = 1000): Promise<JobResult> => {
    for (let i = 0; i < maxAttempts; i++) {
      const result = await jobsService.get(jobId);
      if (result.status === 'done' || result.status === 'failed') return result;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Job polling timed out');
  },
};

// ----- Image Async (job-queue based) — Phase 81 -------------

export interface ImageGalleryItem {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  width: number;
  height: number;
  source: string;
  created_at: string;
  is_favorite: boolean;
  tags: string[];
}

export const imageAsyncService = {
  generate: (prompt: string, model?: string, width?: number, height?: number) =>
    api.post<{ jobId: string; message: string }>('/images/generate-async', { prompt, model, width, height }),

  gallery: (params?: { page?: number; limit?: number; search?: string; model?: string; favorites?: boolean }) =>
    api.get<{ images: ImageGalleryItem[]; total: number; page: number; limit: number }>('/images/gallery', { params }),

  toggleFavorite: (id: string) =>
    api.post<{ is_favorite: boolean }>(`/images/${id}/favorite`),

  addTags: (id: string, tags: string[]) =>
    api.post<{ tags: string[] }>(`/images/${id}/tags`, { tags }),

  bulkDelete: (ids: string[]) =>
    api.delete<{ deleted: number }>('/images/bulk', { data: { ids } }),
};
