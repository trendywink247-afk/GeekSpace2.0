// ============================================================
// Chat to Project — Auto-Create Project Cards from Conversations
//
// Detects substantial conversations and turns them into
// dashboard project cards automatically or with user approval.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { RECEIPT_TEMPLATES, type ReceiptItem } from './receipts.js';

// ── Types ───────────────────────────────────────────────────

export interface DetectedProject {
  name: string;
  description: string;
  tags: string[];
  confidence: number; // 0-1, how confident we are this should be a project
  reason: string; // why we think this is a project
  suggestedActions: string[];
}

export interface ProjectFromChatResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  autoCreated: boolean; // true if auto-created, false if pending approval
  message: string;
  receipt?: ReceiptItem;
}

export interface ConversationContext {
  userId: string;
  messages: Array<{ role: string; content: string }>;
  detectedIntent?: string;
  artifactsCreated?: string[];
  actionsTaken?: string[];
}

// ── Project Detection ───────────────────────────────────────

export function detectProjectFromChat(context: ConversationContext): DetectedProject | null {
  const { messages, detectedIntent, artifactsCreated, actionsTaken } = context;

  // Combine all assistant messages to analyze
  const assistantContent = messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content)
    .join('\n\n');

  const userContent = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n\n');

  // Check for project-indicating signals
  const signals = analyzeProjectSignals(assistantContent, userContent, {
    detectedIntent,
    artifactsCreated,
    actionsTaken,
  });

  if (signals.confidence < 0.6) {
    return null; // Not confident enough
  }

  // Extract project details
  const name = extractProjectName(userContent, assistantContent);
  const description = extractProjectDescription(assistantContent);
  const tags = extractProjectTags(userContent, assistantContent);

  return {
    name,
    description,
    tags,
    confidence: signals.confidence,
    reason: signals.reason,
    suggestedActions: signals.suggestedActions,
  };
}

interface ProjectSignals {
  confidence: number;
  reason: string;
  suggestedActions: string[];
}

function analyzeProjectSignals(
  assistantContent: string,
  userContent: string,
  context: {
    detectedIntent?: string;
    artifactsCreated?: string[];
    actionsTaken?: string[];
  }
): ProjectSignals {
  let score = 0;
  const reasons: string[] = [];
  const suggestedActions: string[] = [];

  // Signal: Code/artifact was generated
  if (context.artifactsCreated && context.artifactsCreated.length > 0) {
    score += 0.4;
    reasons.push('Created code/artifact');
    suggestedActions.push('Link artifact to project');
  }

  // Signal: Multiple actions taken
  if (context.actionsTaken && context.actionsTaken.length >= 2) {
    score += 0.2;
    reasons.push('Multiple actions executed');
  }

  // Signal: Coding/planning intent
  if (context.detectedIntent === 'coding' || context.detectedIntent === 'planning') {
    score += 0.2;
    reasons.push(`Intent: ${context.detectedIntent}`);
  }

  // Signal: Substantial conversation (multiple back-and-forths)
  const combinedLength = assistantContent.length + userContent.length;
  if (combinedLength > 2000) {
    score += 0.15;
    reasons.push('Substantial discussion');
  }

  // Signal: User mentioned project-related keywords
  const projectKeywords = ['project', 'app', 'website', 'build', 'create', 'make', 'develop'];
  const hasProjectKeyword = projectKeywords.some(kw =>
    userContent.toLowerCase().includes(kw)
  );
  if (hasProjectKeyword) {
    score += 0.15;
    reasons.push('Project keywords detected');
  }

  // Signal: Contains implementation details
  if (assistantContent.includes('```') || assistantContent.includes('code')) {
    score += 0.1;
    reasons.push('Contains code');
    suggestedActions.push('Add code snippets to project');
  }

  // Signal: Action items or todos were created
  if (assistantContent.toLowerCase().includes('action item') ||
      assistantContent.toLowerCase().includes('todo') ||
      assistantContent.includes('☐')) {
    score += 0.1;
    reasons.push('Action items created');
    suggestedActions.push('Track tasks in project');
  }

  return {
    confidence: Math.min(score, 1.0),
    reason: reasons.join(', '),
    suggestedActions,
  };
}

// ── Project Extraction ──────────────────────────────────────

function extractProjectName(userContent: string, assistantContent: string): string {
  // Try to find an explicit project name
  const patterns = [
    /(?:project|app|website)\s+(?:called|named)\s+["']?([^"'.\n]{2,30})["']?/i,
    /(?:create|build|make)\s+(?:a|an)\s+(?:new\s+)?(?:project|app|website)\s+(?:called|named)?\s*["']?([^"'.\n]{2,30})["']?/i,
    /(?:working\s+on|building)\s+["']?([^"'.\n]{2,30})["']?/i,
  ];

  for (const pattern of patterns) {
    const match = userContent.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Try first line of user's first message as fallback
  const firstLine = userContent.split('\n')[0].slice(0, 50);
  if (firstLine.length > 10) {
    // Clean up common prefixes
    return firstLine
      .replace(/^(can\s+you\s+|help\s+me\s+|i\s+want\s+to\s+|i\s+need\s+to\s+)/i, '')
      .replace(/\?$/, '')
      .trim();
  }

  return 'New Project';
}

function extractProjectDescription(assistantContent: string): string {
  // Look for a summary or the first substantial paragraph
  const paragraphs = assistantContent.split('\n\n').filter(p => p.length > 20);

  for (const para of paragraphs) {
    // Skip code blocks
    if (para.startsWith('```')) continue;

    // Clean up markdown
    const cleaned = para
      .replace(/\*\*/g, '')
      .replace(/#{1,6}\s*/g, '')
      .slice(0, 200);

    if (cleaned.length > 30) {
      return cleaned;
    }
  }

  return 'Project created from conversation';
}

function extractProjectTags(userContent: string, assistantContent: string): string[] {
  const tags: string[] = [];
  const combined = (userContent + ' ' + assistantContent).toLowerCase();

  // Tech stack detection
  const techPatterns: Record<string, string[]> = {
    'React': ['react', 'jsx', 'tsx'],
    'TypeScript': ['typescript', 'ts', 'type script'],
    'JavaScript': ['javascript', 'js'],
    'Python': ['python', 'django', 'flask'],
    'Node.js': ['node', 'nodejs', 'node.js'],
    'CSS': ['css', 'tailwind', 'styled-components'],
    'Database': ['database', 'sql', 'sqlite', 'postgres'],
    'API': ['api', 'rest', 'graphql'],
    'Mobile': ['mobile', 'app', 'ios', 'android'],
    'Web': ['website', 'web app', 'frontend'],
    'AI': ['ai', 'ml', 'model', 'openai', 'claude'],
  };

  for (const [tag, keywords] of Object.entries(techPatterns)) {
    if (keywords.some(kw => combined.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.slice(0, 5); // Max 5 tags
}

// ── Project Creation ────────────────────────────────────────

export async function createProjectFromChat(
  userId: string,
  detected: DetectedProject,
  options: { autoCreate?: boolean; sourceChatId?: string } = {}
): Promise<ProjectFromChatResult> {
  const { autoCreate = false } = options;

  try {
    // Check if user wants auto-creation or approval
    if (!autoCreate && detected.confidence < 0.85) {
      return {
        success: true,
        autoCreated: false,
        message: `Detected potential project: "${detected.name}". Reply "yes" to create it.`,
      };
    }

    // Get existing projects
    const row = db.prepare(
      `SELECT projects FROM portfolios WHERE user_id = ?`
    ).get(userId) as { projects: string } | undefined;

    type ChatProject = { id: string; name: string; description: string; tags: string[]; liveUrl?: string; repoUrl?: string; createdFromChat?: boolean; sourceChatId?: string; createdAt: string };
    let projects: ChatProject[] = [];
    try { projects = row ? JSON.parse(row.projects) : []; } catch { projects = []; }

    // Check for duplicate names
    const existingIndex = projects.findIndex(
      p => p.name.toLowerCase() === detected.name.toLowerCase()
    );

    const projectId = existingIndex >= 0
      ? projects[existingIndex].id
      : uuid();

    const newProject = {
      id: projectId,
      name: detected.name,
      description: detected.description,
      tags: detected.tags,
      createdFromChat: true,
      sourceChatId: options.sourceChatId,
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Update existing project
      projects[existingIndex] = { ...projects[existingIndex], ...newProject };
    } else {
      // Add new project
      projects.push(newProject);
    }

    // Save to database
    db.prepare(
      `UPDATE portfolios SET projects = ? WHERE user_id = ?`
    ).run(JSON.stringify(projects), userId);

    // Log activity
    db.prepare(
      `INSERT INTO activity_log (id, user_id, action, details, icon)
       VALUES (?, ?, 'Created project from chat', ?, 'folder')`
    ).run(uuid(), userId, detected.name);

    logger.info({ userId, projectId, projectName: detected.name }, 'Project created from chat');

    return {
      success: true,
      projectId,
      projectName: detected.name,
      autoCreated: true,
      message: `Created project card: "${detected.name}" in your dashboard`,
      receipt: RECEIPT_TEMPLATES.project(detected.name),
    };

  } catch (err) {
    logger.error({ err, userId, detected }, 'Failed to create project from chat');
    return {
      success: false,
      autoCreated: false,
      message: `Failed to create project: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Conversation Analysis ───────────────────────────────────

export function shouldPromptForProject(context: ConversationContext): boolean {
  const detected = detectProjectFromChat(context);

  if (!detected) return false;

  // Only prompt if confidence is in the "maybe" range
  return detected.confidence >= 0.6 && detected.confidence < 0.85;
}

export function getProjectSuggestionText(detected: DetectedProject): string {
  const lines = [
    `💡 I noticed you're working on something interesting!`,
    ``,
    `**"${detected.name}"**`,
    detected.description.slice(0, 100) + (detected.description.length > 100 ? '...' : ''),
    ``,
  ];

  if (detected.tags.length > 0) {
    lines.push(`Tags: ${detected.tags.join(', ')}`);
    lines.push('');
  }

  lines.push(`Would you like me to create a project card for this?`);
  lines.push(`(Reply "yes" to save it to your dashboard)`);

  return lines.join('\n');
}

// ── Batch Project Creation ──────────────────────────────────

export async function createMultipleProjects(
  userId: string,
  conversations: ConversationContext[]
): Promise<ProjectFromChatResult[]> {
  const results: ProjectFromChatResult[] = [];
  const createdNames = new Set<string>();

  for (const context of conversations) {
    const detected = detectProjectFromChat(context);

    if (detected && !createdNames.has(detected.name.toLowerCase())) {
      const result = await createProjectFromChat(userId, detected, { autoCreate: true });
      results.push(result);

      if (result.success) {
        createdNames.add(detected.name.toLowerCase());
      }
    }
  }

  return results;
}

// ── Export for use in message router ───────────────────────

export interface ChatProjectMiddleware {
  onConversationComplete: (context: ConversationContext) => Promise<void>;
  onProjectDetected: (detected: DetectedProject) => Promise<boolean>; // returns true if user approved
}

export function createProjectMiddleware(
  userId: string,
  handlers: {
    onSuggest?: (detected: DetectedProject, text: string) => Promise<void>;
    onCreate?: (result: ProjectFromChatResult) => Promise<void>;
  } = {}
): ChatProjectMiddleware {
  return {
    async onConversationComplete(context: ConversationContext) {
      const detected = detectProjectFromChat(context);

      if (!detected) return;

      if (detected.confidence >= 0.85) {
        // Auto-create
        const result = await createProjectFromChat(userId, detected, { autoCreate: true });
        if (handlers.onCreate) {
          await handlers.onCreate(result);
        }
      } else if (detected.confidence >= 0.6) {
        // Suggest to user
        const suggestionText = getProjectSuggestionText(detected);
        if (handlers.onSuggest) {
          await handlers.onSuggest(detected, suggestionText);
        }
      }
    },

    async onProjectDetected(detected: DetectedProject): Promise<boolean> {
      const result = await createProjectFromChat(userId, detected, { autoCreate: false });
      if (handlers.onCreate) {
        await handlers.onCreate(result);
      }
      return result.autoCreated;
    },
  };
}
