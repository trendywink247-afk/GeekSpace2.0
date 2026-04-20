import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises BEFORE importing the module that uses it
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() }),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() }),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock fs (sync version) BEFORE importing
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

// Mock fetch. MSW's setupFiles installs its own globalThis.fetch via a
// beforeAll hook, which runs AFTER test-file top-level code — so a top-level
// vi.stubGlobal would be overwritten. Re-apply the stub in beforeEach so it
// wins on every test.
const mockFetch = vi.fn();

// Import AFTER declaring the mock (module uses fetch at call time, not import time)
const { generateImage } = await import('../../services/media-generation.js');

describe('generateImage fallback chain', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('returns Pollinations URL when Pollinations HEAD check succeeds', async () => {
    // HEAD check returns 200
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await generateImage('a red cat');
    expect(result.success).toBe(true);
    expect(result.url).toContain('image.pollinations.ai');
    expect(result.provider).toBe('pollinations');
  });

  it('falls back to HuggingFace when Pollinations returns 530', async () => {
    // Pollinations HEAD returns 530
    mockFetch.mockResolvedValueOnce({ ok: false, status: 530 });
    // HuggingFace POST returns binary blob
    const fakeBuffer = new ArrayBuffer(8);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => fakeBuffer,
      headers: { get: (_: string) => 'image/png' },
    });
    const result = await generateImage('a red cat');
    expect(result.success).toBe(true);
    expect(result.url).toContain('/api/images/cache/');
    expect(result.provider).toBe('huggingface');
  });

  it('returns failure when both Pollinations and HuggingFace fail', async () => {
    // Pollinations HEAD returns 530
    mockFetch.mockResolvedValueOnce({ ok: false, status: 530 });
    // HuggingFace POST returns 503 (model warming up / cold start)
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const result = await generateImage('a red cat');
    expect(result.success).toBe(false);
    // 503 triggers the "warming up" message (model cold-start on free HF tier)
    expect(result.error).toMatch(/warming up/i);
  });
});
