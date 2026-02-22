// ============================================================
// Image & Video Generation Service
// Uses free AI models from Pollinations.AI
// ============================================================

import { logger } from '../logger.js';

// Pollinations.AI endpoints (completely free, no API key needed)
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt';
const POLLINATIONS_VIDEO_URL = 'https://video.pollinations.ai/prompt';

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  seed?: number;
  nologo?: boolean;
  enhance?: boolean;
}

export interface VideoGenerationOptions {
  width?: number;
  height?: number;
  duration?: number; // in seconds
  fps?: number;
}

/**
 * Generate an image using Pollinations.AI (free)
 * Returns a URL to the generated image
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    const {
      width = 1024,
      height = 1024,
      seed = Math.floor(Math.random() * 1000000),
      nologo = true,
      enhance = true
    } = options;

    // Build URL with parameters
    const encodedPrompt = encodeURIComponent(prompt);
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      seed: String(seed),
      nologo: String(nologo),
      enhance: String(enhance)
    });

    const url = `${POLLINATIONS_IMAGE_URL}/${encodedPrompt}?${params.toString()}`;

    // Verify the image is accessible
    const checkRes = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
    
    if (!checkRes.ok) {
      throw new Error(`Image generation failed: ${checkRes.status}`);
    }

    logger.info({ prompt: prompt.slice(0, 50), width, height }, 'Image generated successfully');

    return {
      success: true,
      url
    };
  } catch (err) {
    logger.error({ err, prompt: prompt.slice(0, 50) }, 'Image generation failed');
    return {
      success: false,
      url: '',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Generate a video using Pollinations.AI (free)
 * Note: Video generation takes longer (30-120 seconds)
 */
export async function generateVideo(
  prompt: string,
  options: VideoGenerationOptions = {}
): Promise<{ success: boolean; url: string; estimatedTime?: number; error?: string }> {
  try {
    const {
      width = 1280,
      height = 720,
      duration = 5,
      fps = 24
    } = options;

    // Build URL with parameters
    const encodedPrompt = encodeURIComponent(prompt);
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      duration: String(duration),
      fps: String(fps)
    });

    const url = `${POLLINATIONS_VIDEO_URL}/${encodedPrompt}?${params.toString()}`;

    logger.info({ prompt: prompt.slice(0, 50), width, height, duration }, 'Video generation initiated');

    // Video generation is async - return the URL immediately
    // The client will need to poll or wait for the video to be ready
    return {
      success: true,
      url,
      estimatedTime: duration * 6 // rough estimate: 6x real-time
    };
  } catch (err) {
    logger.error({ err, prompt: prompt.slice(0, 50) }, 'Video generation failed');
    return {
      success: false,
      url: '',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Check if a media URL is ready (for polling video status)
 */
export async function checkMediaStatus(url: string): Promise<{ ready: boolean; contentType?: string }> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    
    if (res.ok) {
      const contentType = res.headers.get('content-type') || undefined;
      return { ready: true, contentType };
    }
    
    // 202 Accepted means still processing
    if (res.status === 202) {
      return { ready: false };
    }
    
    return { ready: false };
  } catch {
    return { ready: false };
  }
}

/**
 * Generate an avatar/profile picture
 */
export async function generateAvatar(
  description: string,
  style: 'professional' | 'creative' | 'fun' = 'professional'
): Promise<{ success: boolean; url: string; error?: string }> {
  const stylePrompts = {
    professional: 'professional headshot portrait, business attire, clean background, high quality, photorealistic',
    creative: 'artistic portrait, creative lighting, expressive, digital art style, high quality',
    fun: 'cartoon style portrait, colorful, playful, friendly, high quality illustration'
  };

  const fullPrompt = `${description}, ${stylePrompts[style]}`;
  
  return generateImage(fullPrompt, {
    width: 512,
    height: 512,
    enhance: true
  });
}

/**
 * Generate a project thumbnail/preview
 */
export async function generateProjectThumbnail(
  projectName: string,
  description: string
): Promise<{ success: boolean; url: string; error?: string }> {
  const prompt = `Project thumbnail for "${projectName}": ${description}. Clean, modern, tech-focused, dark background with colorful accents, professional presentation, high quality digital art`;
  
  return generateImage(prompt, {
    width: 1200,
    height: 630, // Open Graph aspect ratio
    enhance: true
  });
}
