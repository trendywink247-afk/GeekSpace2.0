// ============================================================
// Test Mode Module
// Provides deterministic mocks for external dependencies in TEST_MODE
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';
import type { ChatMessage, Intent, Provider } from '../services/llm.js';

// Test state - tracks operations during test runs
interface TestState {
  lastReminderId: string | null;
  lastReminderScheduledAt: Date | null;
  lastReminderExecutedAt: Date | null;
  remindersExecuted: Array<{
    id: string;
    text: string;
    scheduledFor: string;
    executedAt: string;
    driftMs: number;
  }>;
  agentStatusChanges: Array<{
    timestamp: string;
    userId: string;
    status: 'active' | 'inactive';
  }>;
  llmCalls: Array<{
    timestamp: string;
    provider: Provider;
    intent: Intent;
    messagePreview: string;
  }>;
  telegramMessagesSent: Array<{
    timestamp: string;
    chatId: string;
    text: string;
  }>;
}

const testState: TestState = {
  lastReminderId: null,
  lastReminderScheduledAt: null,
  lastReminderExecutedAt: null,
  remindersExecuted: [],
  agentStatusChanges: [],
  llmCalls: [],
  telegramMessagesSent: [],
};

// Deterministic mock responses based on message content
const MOCK_RESPONSES: Record<string, string> = {
  default: `Hello! I'm Agentin, your AI assistant. I received your message and this is a test response.`,

  reminder: `I'll set a reminder for you. <<<ACTION {"tool":"set_reminder","params":{"text":"Check email","due_time":"2026-02-20T10:00:00Z"}} ACTION>>>`,

  code: `Here's a simple function:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

This function takes a name and returns a greeting.`,

  portfolio: `I can help you update your portfolio. <<<ACTION {"tool":"portfolio_update_bio","params":{"bio":"Passionate developer building amazing things with AI."}} ACTION>>>`,

  automation: `I'll create an automation for you. <<<ACTION {"tool":"trigger_workflow","params":{"name":"daily_summary"}} ACTION>>>`,

  complex: `This is a complex question that requires detailed analysis. In test mode, I'll provide a concise summary of the key points you should consider.`,

  hello: `Hello there! Welcome to Agentin. How can I help you today?`,

  help: `I can help you with:
- Setting reminders
- Writing code
- Managing your portfolio
- Creating automations
- Answering questions

Just let me know what you need!`,
};

/**
 * Check if test mode is enabled
 */
export function isTestMode(): boolean {
  return config.isTestMode;
}

/**
 * Get current test state (for assertions in tests)
 */
export function getTestState(): TestState {
  return { ...testState };
}

/**
 * Reset test state (call between tests)
 */
export function resetTestState(): void {
  testState.lastReminderId = null;
  testState.lastReminderScheduledAt = null;
  testState.lastReminderExecutedAt = null;
  testState.remindersExecuted = [];
  testState.agentStatusChanges = [];
  testState.llmCalls = [];
  testState.telegramMessagesSent = [];
  logger.info('Test state reset');
}

/**
 * Record a reminder being scheduled
 */
export function recordReminderScheduled(reminderId: string): void {
  testState.lastReminderId = reminderId;
  testState.lastReminderScheduledAt = new Date();
  logger.debug({ reminderId }, 'Test mode: reminder scheduled');
}

/**
 * Record a reminder being executed
 */
export function recordReminderExecuted(
  id: string,
  text: string,
  scheduledFor: string,
  driftMs: number
): void {
  testState.lastReminderExecutedAt = new Date();
  testState.remindersExecuted.push({
    id,
    text,
    scheduledFor,
    executedAt: new Date().toISOString(),
    driftMs,
  });
  logger.debug({ id, driftMs }, 'Test mode: reminder executed');
}

/**
 * Record agent status change
 */
export function recordAgentStatus(userId: string, status: 'active' | 'inactive'): void {
  testState.agentStatusChanges.push({
    timestamp: new Date().toISOString(),
    userId,
    status,
  });
}

/**
 * Record LLM call
 */
export function recordLLMCall(provider: Provider, intent: Intent, message: string): void {
  testState.llmCalls.push({
    timestamp: new Date().toISOString(),
    provider,
    intent,
    messagePreview: message.slice(0, 100),
  });
}

/**
 * Record Telegram message sent
 */
export function recordTelegramMessage(chatId: string, text: string): void {
  testState.telegramMessagesSent.push({
    timestamp: new Date().toISOString(),
    chatId,
    text: text.slice(0, 200),
  });
}

/**
 * Get deterministic mock response based on message content
 */
function getMockResponse(message: string, intent: Intent): string {
  const lower = message.toLowerCase();

  // Check for specific patterns
  if (lower.includes('remind') || intent === 'automation') {
    return MOCK_RESPONSES.reminder;
  }
  if (lower.includes('code') || lower.includes('function') || intent === 'coding') {
    return MOCK_RESPONSES.code;
  }
  if (lower.includes('portfolio') || lower.includes('bio') || lower.includes('project')) {
    return MOCK_RESPONSES.portfolio;
  }
  if (lower.includes('automation') || lower.includes('workflow') || lower.includes('trigger')) {
    return MOCK_RESPONSES.automation;
  }
  if (lower.includes('hello') || lower.includes('hi ') || lower.includes('hey')) {
    return MOCK_RESPONSES.hello;
  }
  if (lower.includes('help')) {
    return MOCK_RESPONSES.help;
  }
  if (intent === 'complex') {
    return MOCK_RESPONSES.complex;
  }

  return MOCK_RESPONSES.default;
}

/**
 * Mock LLM call - returns deterministic response without hitting external APIs
 */
export async function mockLLMCall(
  messages: ChatMessage[],
  intent: Intent,
  provider: Provider,
): Promise<{
  content: string;
  tokensIn: number;
  tokensOut: number;
}> {
  const userMessage = messages[messages.length - 1]?.content || '';
  const response = getMockResponse(userMessage, intent);

  recordLLMCall(provider, intent, userMessage);

  // Simulate realistic token counts
  const tokensIn = Math.ceil(userMessage.length / 4);
  const tokensOut = Math.ceil(response.length / 4);

  // Add small artificial delay to simulate network (10-50ms)
  await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 40));

  return {
    content: response,
    tokensIn,
    tokensOut,
  };
}

/**
 * Mock Telegram API call
 */
export function mockTelegramSend(chatId: string, text: string): { ok: boolean } {
  recordTelegramMessage(chatId, text);
  return { ok: true };
}

/**
 * Mock PicoClaw call
 */
export async function mockPicoClawCall(
  message: string,
  _systemPrompt?: string,
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  // _systemPrompt is accepted for API compatibility but not used in mock
  const response = getMockResponse(message, 'simple');

  return {
    text: response,
    tokensIn: Math.ceil(message.length / 4),
    tokensOut: Math.ceil(response.length / 4),
  };
}

/**
 * Guard function - throws if not in test mode
 */
export function requireTestMode(): void {
  if (!isTestMode()) {
    throw new Error('This endpoint is only available in TEST_MODE');
  }
}
