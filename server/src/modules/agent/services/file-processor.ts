/**
 * File Processor — Extract content from uploaded files for LLM context
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../../logger.js';
import { config } from '../../../config.js';

// ── Types ────────────────────────────────────────────────────

export interface ProcessedFile {
  originalName: string;
  mimeType: string;
  size: number;
  extractedText: string;
  description: string;
  isImage: boolean;
  base64Preview?: string;
  filePath: string;
  visionAnalysis?: string;  // Set by describeImageWithVision() for images
}

// ── Constants ────────────────────────────────────────────────

const MAX_TEXT_LENGTH = 50_000; // 50K chars max per file
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.cs', '.php', '.swift', '.kt', '.scala',
  '.html', '.css', '.scss', '.less', '.json', '.yaml', '.yml',
  '.xml', '.sql', '.sh', '.bash', '.zsh', '.fish', '.ps1',
  '.md', '.mdx', '.txt', '.csv', '.env', '.toml', '.ini', '.cfg',
  '.dockerfile', '.gitignore', '.editorconfig',
]);

// ── Processing ───────────────────────────────────────────────

export async function processUploadedFile(file: { originalname: string; mimetype: string; size: number; path: string; buffer?: Buffer }): Promise<ProcessedFile> {
  const ext = path.extname(file.originalname).toLowerCase();
  const isImage = IMAGE_TYPES.has(file.mimetype);
  
  const result: ProcessedFile = {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    extractedText: '',
    description: '',
    isImage,
    filePath: file.path,
  };
  
  try {
    if (isImage) {
      // For images: create base64 preview AND run vision analysis if Gemini available
      const buffer = file.buffer || fs.readFileSync(file.path);
      result.base64Preview = buffer.toString('base64');
      result.description = `[Image: ${file.originalname} (${formatSize(file.size)})]`;
      
      // Run vision analysis if Gemini is configured
      if (config.geminiApiKey) {
        try {
          const analysis = await describeImageWithVision(result.base64Preview, file.mimetype);
          if (analysis) {
            result.visionAnalysis = analysis;
            result.extractedText = `${result.description}\n\nVision analysis: ${analysis}`;
          } else {
            result.extractedText = result.description;
          }
        } catch (err) {
          logger.debug({ err, file: file.originalname }, 'Vision analysis failed');
          result.extractedText = result.description;
        }
      } else {
        result.extractedText = result.description;
      }
    } else if (file.mimetype === 'application/pdf') {
      // PDF: extract text
      try {
        // pdf-parse exports itself as the default CJS export; handle both shapes
        const pdfMod = await import('pdf-parse');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfParse = (pdfMod as any).default ?? pdfMod;
        const buffer = file.buffer || fs.readFileSync(file.path);
        const data = await pdfParse(buffer);
        result.extractedText = data.text.slice(0, MAX_TEXT_LENGTH);
        result.description = `[PDF: ${file.originalname} (${data.numpages} pages, ${formatSize(file.size)})]`;
      } catch (err) {
        logger.debug({ err, file: file.originalname }, 'PDF parsing failed');
        result.extractedText = `[PDF: ${file.originalname} — could not extract text]`;
        result.description = result.extractedText;
      }
    } else if (CODE_EXTENSIONS.has(ext) || file.mimetype.startsWith('text/')) {
      // Code/text files: read content directly
      const content = file.buffer
        ? file.buffer.toString('utf-8')
        : fs.readFileSync(file.path, 'utf-8');
      result.extractedText = content.slice(0, MAX_TEXT_LENGTH);
      const lang = ext.replace('.', '') || 'text';
      result.description = `[File: ${file.originalname} (${lang}, ${formatSize(file.size)})]`;
    } else {
      result.extractedText = `[File: ${file.originalname} (${file.mimetype}, ${formatSize(file.size)}) — binary file, content not extracted]`;
      result.description = result.extractedText;
    }
  } catch (err) {
    logger.warn({ err, file: file.originalname }, 'File processing failed');
    result.extractedText = `[File: ${file.originalname} — processing failed]`;
    result.description = result.extractedText;
  }
  
  return result;
}

/**
 * Build a context block from processed files for system prompt injection.
 */
export function buildFileContext(files: ProcessedFile[]): string {
  if (files.length === 0) return '';
  
  const sections = files.map((f, i) => {
    if (f.isImage) {
      return `### Attached Image ${i + 1}: ${f.originalName}\n${f.description}`;
    }
    return `### Attached File ${i + 1}: ${f.originalName}\n${f.description}\n\n\`\`\`\n${f.extractedText.slice(0, 10000)}\n\`\`\``;
  });
  
  return `\n--- USER ATTACHMENTS ---\n${sections.join('\n\n')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Describe an image using Gemini Flash 2.0 (free tier, 1M tokens/day).
 * Returns a detailed description of what's in the image.
 */
async function describeImageWithVision(base64: string, mimeType: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${config.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analyze this image comprehensively. Describe:
1. What's in it (objects, text, people, scene)
2. Any visible text (transcribe exactly)
3. Code/UI elements if it's a screenshot
4. Error messages if visible
5. Context/purpose

Be thorough but concise. If it's a code screenshot, extract the code. If it's an error, extract the error text.`
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );
    
    if (!response.ok) {
      logger.debug({ status: response.status }, 'Gemini vision API error');
      return null;
    }
    
    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
  } catch (err) {
    logger.debug({ err }, 'Vision analysis failed');
    return null;
  }
}
