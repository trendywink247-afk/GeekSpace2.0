// ============================================================
// Output Generator — Package Conversations into Artifacts
//
// Turns chat into output: PDFs, docs, plans, drafts, templates.
// Mic drop line: "Want me to package this into a doc?"
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { RECEIPT_TEMPLATES } from './receipts.js';
import type { ReceiptItem } from './receipts.js';

// ── Types ───────────────────────────────────────────────────

export type OutputFormat = 'pdf' | 'markdown' | 'html' | 'json' | 'todo' | 'plan';

export interface OutputRequest {
  userId: string;
  format: OutputFormat;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface OutputResult {
  success: boolean;
  outputId: string;
  format: OutputFormat;
  title: string;
  downloadUrl?: string;
  content?: string; // For inline display
  receipt?: ReceiptItem;
  message: string;
}

export interface ChatSummary {
  topic: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  resources: Array<{ title: string; url: string }>;
}

// ── Output Generator ────────────────────────────────────────

export async function generateOutput(request: OutputRequest): Promise<OutputResult> {
  const { userId, format, title, content, metadata } = request;
  const outputId = uuid();

  try {
    // Generate the formatted output
    const generated = await formatContent(format, title, content, metadata);

    // Store in database
    db.prepare(
      `INSERT INTO generated_outputs (id, user_id, format, title, content, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(outputId, userId, format, title, generated, JSON.stringify(metadata || {}));

    // Create download URL for file formats
    const downloadUrl = ['pdf', 'html', 'markdown', 'json'].includes(format)
      ? `/api/outputs/${outputId}/download`
      : undefined;

    // Build receipt
    const receipt = RECEIPT_TEMPLATES.export(
      format.toUpperCase(),
      `${title}.${getFileExtension(format)}`
    );

    logger.info({ userId, format, outputId, title }, 'Output generated');

    return {
      success: true,
      outputId,
      format,
      title,
      downloadUrl,
      content: format === 'todo' || format === 'plan' ? generated : undefined,
      receipt,
      message: `Created ${format} output: "${title}"`,
    };
  } catch (err) {
    logger.error({ err, userId, format, title }, 'Output generation failed');
    return {
      success: false,
      outputId: '',
      format,
      title,
      message: `Failed to generate ${format}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Content Formatters ─────────────────────────────────────

async function formatContent(
  format: OutputFormat,
  title: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  switch (format) {
    case 'pdf':
      return generatePDFContent(title, content, metadata);
    case 'markdown':
      return generateMarkdownContent(title, content, metadata);
    case 'html':
      return generateHTMLContent(title, content, metadata);
    case 'json':
      return generateJSONContent(title, content, metadata);
    case 'todo':
      return generateTodoList(title, content, metadata);
    case 'plan':
      return generatePlan(title, content, metadata);
    default:
      return content;
  }
}

function generatePDFContent(title: string, content: string, metadata?: Record<string, unknown>): string {
  // Returns HTML that can be converted to PDF by the client or a PDF service
  const date = new Date().toLocaleDateString();
  const topic = String(metadata?.topic || 'Chat Summary');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { color: #111; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 30px; }
    .content { white-space: pre-wrap; }
    .section { margin: 20px 0; }
    .tag { background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; }
    @media print {
      body { padding: 20px; }
      h1 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <span class="tag">${escapeHtml(topic)}</span>
    <span>Generated: ${date}</span>
  </div>
  <div class="content">${escapeHtml(content)}</div>
  ${metadata?.actionItems ? `
  <div class="section">
    <h2>Action Items</h2>
    <ul>
      ${(metadata.actionItems as string[]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  </div>
  ` : ''}
</body>
</html>`;
}

function generateMarkdownContent(title: string, content: string, metadata?: Record<string, unknown>): string {
  const date = new Date().toLocaleDateString();
  const lines = [
    `# ${title}`,
    '',
    `*Generated: ${date}*`,
    '',
    '## Summary',
    '',
    content,
    '',
  ];

  if (metadata?.actionItems) {
    lines.push('## Action Items', '');
    (metadata.actionItems as string[]).forEach((item, i) => {
      lines.push(`${i + 1}. [ ] ${item}`);
    });
    lines.push('');
  }

  if (metadata?.keyPoints) {
    lines.push('## Key Points', '');
    (metadata.keyPoints as string[]).forEach(point => {
      lines.push(`- ${point}`);
    });
    lines.push('');
  }

  if (metadata?.resources) {
    lines.push('## Resources', '');
    (metadata.resources as Array<{ title: string; url: string }>).forEach(res => {
      lines.push(`- [${res.title}](${res.url})`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

function generateHTMLContent(title: string, content: string, metadata?: Record<string, unknown>): string {
  // Similar to PDF but with interactive elements
  return generatePDFContent(title, content, metadata);
}

function generateJSONContent(title: string, content: string, metadata?: Record<string, unknown>): string {
  return JSON.stringify({
    title,
    content,
    metadata,
    generatedAt: new Date().toISOString(),
    version: '1.0',
  }, null, 2);
}

function generateTodoList(title: string, content: string, metadata?: Record<string, unknown>): string {
  const actionItems = (metadata?.actionItems as string[]) || extractActionItems(content);

  if (actionItems.length === 0) {
    return 'No action items found in this conversation.';
  }

  const lines = [
    `📋 ${title}`,
    '',
    ...actionItems.map((item, i) => `${i + 1}. ☐ ${item}`),
    '',
    '---',
    `Created: ${new Date().toLocaleString()}`,
  ];

  return lines.join('\n');
}

function generatePlan(title: string, content: string, metadata?: Record<string, unknown>): string {
  const steps = (metadata?.steps as string[]) || extractSteps(content);
  const phases = (metadata?.phases as string[]) || [];

  const lines = [
    `📋 ${title}`,
    '',
    '## Overview',
    content.slice(0, 500),
    '',
  ];

  if (phases.length > 0) {
    phases.forEach((phase, i) => {
      lines.push(`### Phase ${i + 1}: ${phase}`, '');
    });
  }

  if (steps.length > 0) {
    lines.push('## Steps', '');
    steps.forEach((step, i) => {
      const status = i === 0 ? '▶️' : '⏳';
      lines.push(`${i + 1}. ${status} ${step}`);
    });
    lines.push('');
  }

  lines.push('---', `Created: ${new Date().toLocaleString()}`);

  return lines.join('\n');
}

// ── Smart Extractors ───────────────────────────────────────

function extractActionItems(content: string): string[] {
  const lines = content.split('\n');
  const items: string[] = [];

  for (const line of lines) {
    // Match patterns like "- [ ] task" or "1. task" or "action item: task"
    const match = line.match(/^\s*(?:[-*]\s*(?:\[ \])?|\d+\.\s*|action:?)\s*(.+)/i);
    if (match && match[1].length > 3) {
      items.push(match[1].trim());
    }
  }

  // If no structured items found, look for imperative sentences
  if (items.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(Create|Build|Set up|Make|Write|Send|Schedule|Call|Review|Update)/i.test(trimmed)) {
        items.push(trimmed);
      }
    }
  }

  return items.slice(0, 20); // Limit to 20 items
}

function extractSteps(content: string): string[] {
  const lines = content.split('\n');
  const steps: string[] = [];

  for (const line of lines) {
    // Match numbered steps or bullet points with step keywords
    const match = line.match(/^\s*(?:\d+\.\s*|Step\s*\d+:?\s*|[-*]\s*)\s*(.+)/i);
    if (match && match[1].length > 5) {
      steps.push(match[1].trim());
    }
  }

  return steps.slice(0, 30); // Limit to 30 steps
}

// ── Chat Summary Generator ─────────────────────────────────

export async function summarizeChat(
  userId: string,
  messages: Array<{ role: string; content: string }>
): Promise<ChatSummary> {
  // Extract summary from conversation
  const fullText = messages.map(m => m.content).join('\n\n');

  // Simple extraction (in production, this could call an LLM)
  const topic = extractTopic(fullText);
  const keyPoints = extractKeyPoints(fullText);
  const actionItems = extractActionItems(fullText);
  const decisions = extractDecisions(fullText);
  const resources = extractResources(fullText);

  return {
    topic,
    keyPoints,
    actionItems,
    decisions,
    resources,
  };
}

function extractTopic(text: string): string {
  // Look for the first sentence or first line that's substantial
  const lines = text.split('\n').filter(l => l.trim().length > 10);
  return lines[0]?.slice(0, 100) || 'Chat Summary';
}

function extractKeyPoints(text: string): string[] {
  const lines = text.split('\n');
  const points: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for emphasized statements or key information
    if (/^(Key point|Important|Note|Remember|Key:)/i.test(trimmed) ||
        /\*\*[^*]+\*\*/.test(trimmed)) {
      points.push(trimmed.replace(/\*\*/g, ''));
    }
  }

  return points.slice(0, 10);
}

function extractDecisions(text: string): string[] {
  const lines = text.split('\n');
  const decisions: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(Decision|We decided|Let's|I will|Going with|Choose)/i.test(trimmed)) {
      decisions.push(trimmed);
    }
  }

  return decisions.slice(0, 10);
}

function extractResources(text: string): Array<{ title: string; url: string }> {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];

  return urls.slice(0, 10).map((url, i) => ({
    title: `Resource ${i + 1}`,
    url: url.replace(/[.,;]$/, ''),
  }));
}

// ── Helpers ─────────────────────────────────────────────────

function getFileExtension(format: OutputFormat): string {
  const map: Record<OutputFormat, string> = {
    pdf: 'html', // PDF is generated from HTML
    markdown: 'md',
    html: 'html',
    json: 'json',
    todo: 'txt',
    plan: 'txt',
  };
  return map[format];
}

function escapeHtml(text: string): string {
  const div = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return text.replace(/[&<>"']/g, c => div[c as keyof typeof div]);
}

// ── Convenience Functions ───────────────────────────────────

export async function packageAsTodo(
  userId: string,
  title: string,
  content: string,
  actionItems?: string[]
): Promise<OutputResult> {
  return generateOutput({
    userId,
    format: 'todo',
    title,
    content,
    metadata: actionItems ? { actionItems } : undefined,
  });
}

export async function packageAsPlan(
  userId: string,
  title: string,
  content: string,
  steps?: string[]
): Promise<OutputResult> {
  return generateOutput({
    userId,
    format: 'plan',
    title,
    content,
    metadata: steps ? { steps } : undefined,
  });
}

export async function packageAsPDF(
  userId: string,
  title: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<OutputResult> {
  return generateOutput({
    userId,
    format: 'pdf',
    title,
    content,
    metadata,
  });
}

// ── Database Schema (for reference) ─────────────────────────
// CREATE TABLE IF NOT EXISTS generated_outputs (
//   id TEXT PRIMARY KEY,
//   user_id TEXT NOT NULL,
//   format TEXT NOT NULL,
//   title TEXT NOT NULL,
//   content TEXT NOT NULL,
//   metadata TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (user_id) REFERENCES users(id)
// );
