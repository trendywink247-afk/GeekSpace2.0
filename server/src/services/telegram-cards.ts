// ============================================================
// Telegram Card Builder — Unified inline keyboard cards
// for reminders, habits, expenses, notes, focus sessions
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';

// ── Types ────────────────────────────────────────────────────

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface TelegramCard {
  text: string;
  parse_mode: 'Markdown' | 'MarkdownV2' | 'HTML';
  reply_markup: {
    inline_keyboard: InlineKeyboardButton[][];
  };
}

// ── Helpers ──────────────────────────────────────────────────

function formatDatetime(dt: string | number | null): string {
  if (!dt) return 'soon';
  const d = new Date(typeof dt === 'number' ? dt : dt);
  if (isNaN(d.getTime())) return 'soon';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ── Store message_id for later editing ───────────────────────

export function storeTelegramMessage(
  userId: string,
  chatId: string,
  messageId: number,
  entityType: string,
  entityId: string
): void {
  try {
    db.prepare(`
      INSERT OR REPLACE INTO telegram_messages
        (id, user_id, chat_id, message_id, entity_type, entity_id, card_state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(uuid(), userId, chatId, messageId, entityType, entityId, Date.now());
  } catch { /* non-fatal — table may not exist in tests */ }
}

// ── Reminder Card ────────────────────────────────────────────

export function buildReminderCard(reminder: { id: string; text: string; datetime?: string | number | null }): TelegramCard {
  const dt = formatDatetime(reminder.datetime ?? null);
  return {
    text: `🔔 *${escapeMarkdown(reminder.text)}*\n⏰ ${dt}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Done', callback_data: `rem_done:${reminder.id}` },
        { text: '⏰ Snooze', callback_data: `rem_snooze:${reminder.id}` },
        { text: '🗑 Delete', callback_data: `rem_delete:${reminder.id}` },
      ]],
    },
  };
}

// ── Snooze Menu Card ─────────────────────────────────────────

export function buildSnoozeMenuCard(reminderId: string, reminderText: string): TelegramCard {
  return {
    text: `⏰ Snooze *"${escapeMarkdown(reminderText)}"* for how long?`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '30 min', callback_data: `rem_snooze_confirm:${reminderId}:30` },
        { text: '1 hour', callback_data: `rem_snooze_confirm:${reminderId}:60` },
        { text: '3 hours', callback_data: `rem_snooze_confirm:${reminderId}:180` },
      ]],
    },
  };
}

// ── Habit Card ───────────────────────────────────────────────

export function buildHabitCard(habit: { id: number | string; name: string; streak?: number }): TelegramCard {
  const streakText = habit.streak ? ` 🔥 ${habit.streak} day streak` : '';
  return {
    text: `💪 *${escapeMarkdown(habit.name)}*${streakText}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Logged', callback_data: `hab_logged:${habit.id}` },
        { text: '⏭ Skip today', callback_data: `hab_skip:${habit.id}` },
      ]],
    },
  };
}

// ── Multi-Expense Card ───────────────────────────────────────

export function buildMultiExpenseCard(expenses: Array<{ id: number | string; description: string; amount: number; category: string }>, currency = '₹'): TelegramCard {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const lines = expenses.map(e => `  ${currency}${e.amount} — ${escapeMarkdown(e.description)} (${e.category})`).join('\n');
  const ids = expenses.map(e => e.id).join(',');
  return {
    text: `💸 *${expenses.length} expenses logged*\n${lines}\n\n*Total: ${currency}${total}*`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ All correct', callback_data: `exp_ok:${expenses[0].id}` },
        { text: '🗑 Delete all', callback_data: `exp_delete_multi:${ids}` },
      ]],
    },
  };
}

// ── Expense Card ─────────────────────────────────────────────

export function buildExpenseCard(expense: { id: number | string; description: string; amount: number; currency?: string }): TelegramCard {
  const curr = expense.currency || '₹';
  return {
    text: `💸 *${escapeMarkdown(expense.description)}*\n${curr}${expense.amount} tracked`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Correct', callback_data: `exp_ok:${expense.id}` },
        { text: '🗑 Delete', callback_data: `exp_delete:${expense.id}` },
      ]],
    },
  };
}

// ── Note Card ────────────────────────────────────────────────

export function buildNoteCard(note: { id: number | string; title: string }): TelegramCard {
  const truncated = note.title.length > 60 ? note.title.slice(0, 57) + '...' : note.title;
  return {
    text: `📝 *Note saved*\n"${escapeMarkdown(truncated)}"`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '📌 Pin', callback_data: `note_pin:${note.id}` },
        { text: '🗑 Delete', callback_data: `note_delete:${note.id}` },
      ]],
    },
  };
}

// ── Focus Session Card ───────────────────────────────────────

export function buildFocusCard(session: { id: number | string; goal: string; durationMin: number }): TelegramCard {
  return {
    text: `🎯 *Focus session started*\nGoal: ${escapeMarkdown(session.goal)}\nDuration: ${session.durationMin} min`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ End session', callback_data: `foc_end:${session.id}` },
        { text: '➕ +15 min', callback_data: `foc_extend:${session.id}:15` },
      ]],
    },
  };
}

// ── Completed Card (replaces buttons after action) ───────────

export function buildCompletedText(
  originalText: string,
  personaQuip: string,
  state: 'done' | 'deleted' | 'snoozed'
): string {
  const icon = { done: '✅', deleted: '🗑', snoozed: '⏰' }[state];
  // Use simple formatting — strikethrough not reliable in all Telegram clients
  return `${icon} ${originalText}\n\n${personaQuip}`;
}

// ── Markdown escape (for Telegram Markdown mode) ─────────────

function escapeMarkdown(text: string): string {
  // In Telegram's Markdown mode (not MarkdownV2), only * _ ` [ need escaping
  // But we USE * for bold, so don't escape it here — caller wraps in * already
  // Just escape the content that goes inside formatting
  return text.replace(/[_`\[]/g, '\\$&');
}
