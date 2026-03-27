/**
 * PersonaEngine -- Persona-voiced Responses for Button Interactions
 *
 * Generates personality-consistent confirmation messages when users
 * tap inline action buttons in Telegram (done, delete, snooze,
 * habit_logged, expense_ok, etc.).
 *
 * Each persona (weebo, edith, aria, forge, ...) has a bank of
 * pre-written templates per action type stored in
 * {@link PERSONA_TEMPLATES}. A template is picked randomly and
 * hydrated with context variables (`{title}`, `{mins}`, `{streak}`).
 *
 * For edge cases -- milestone streaks (7-day, 30-day), double-tap
 * on already-completed items, and focus session endings -- the engine
 * falls back to an LLM call for a richer, contextual response.
 *
 * @module services/persona-engine
 */

import { logger } from '../logger.js';

// ── Types ────────────────────────────────────────────────────

export type ButtonAction =
  | 'done' | 'delete' | 'snooze'
  | 'habit_logged' | 'habit_skip'
  | 'expense_ok' | 'expense_edit' | 'expense_delete'
  | 'note_pin' | 'note_delete'
  | 'focus_end' | 'focus_extend'
  | 'already_done' | 'already_deleted';

export type ButtonContext = {
  entityType: 'reminder' | 'habit' | 'expense' | 'note' | 'focus';
  entityTitle: string;
  alreadyDone: boolean;
  snoozeMinutes?: number;
  streakCount?: number;
  persona: string;
};

type PersonaTemplates = Record<string, string[]>;

// ── Template Data ────────────────────────────────────────────

export const PERSONA_TEMPLATES: Record<string, PersonaTemplates> = {

  weebo: {
    done: [
      "Nailed it! '{title}' is checked off ✨",
      "Done and dusted! You're on fire today 🔥",
      "'{title}' — crushed! What's next? 💪",
    ],
    delete: [
      "Gone! '{title}' has left the chat 👋",
      "Poof! Deleted. It never existed 😄",
      "'{title}'? What '{title}'? 🙈",
    ],
    snooze: [
      "Okay okay, {mins} mins more. But you better do it! 😤",
      "Procrastinating? Bold move. Snoozed {mins} min ⏰",
      "Fine, {mins} mins. Don't make me ask again! 🫵",
    ],
    habit_logged: [
      "'{title}' logged! {streak} days and counting 🔥",
      "Consistency is your superpower! '{title}' done ⚡",
      "Day {streak}! '{title}' checked. Keep the streak alive!",
    ],
    habit_skip: [
      "Rest day, valid. Don't skip twice in a row though! 😬",
      "Okay, skipping '{title}' today. Tomorrow for sure?",
      "We'll let this one slide. Just this once 👀",
    ],
    expense_ok: [
      "'{title}' logged! Your wallet feels lighter 😅",
      "Categorised! Money tracked, chaos controlled ✅",
      "'{title}' sorted. Future you will thank you 🙌",
    ],
    expense_delete: [
      "Deleted! That expense never happened 💸",
      "Gone! Your bank account is still crying though 😂",
      "Poof! '{title}' erased from history 🫧",
    ],
    note_pin: [
      "Pinned! This note is VIP now 📌",
      "Pinned to the top! Important stuff ⭐",
      "'{title}' — pinned and proud 📌",
    ],
    note_delete: [
      "Note deleted! Gone with the wind 🌬️",
      "Poof! '{title}' has been erased ✨",
      "Deleted! Your notes are so much cleaner now 🧹",
    ],
    focus_end: [
      "Focus session complete! Great work 🎯",
      "Session done — you showed up! 💪",
      "Focus mode off. You earned a break ☕",
    ],
    focus_extend: [
      "In the zone! Extended {mins} more minutes 🎯",
      "Extending {mins} min — don't let anyone interrupt! 🚫",
      "More focus time locked in! You're unstoppable 💫",
    ],
    already_done: [
      "Haha, you already crushed this one! Double-doneing? 😄",
      "Already done! What are you, an overachiever? 🏆",
      "Already checked this off! You're way ahead 🚀",
    ],
    already_deleted: [
      "Can't delete what's already gone baba! 👻",
      "It's already in the bin! Delete inception 🗑️",
      "Deleted... twice? You really don't want this one 😂",
    ],
  },

  edith: {
    done: [
      "Done. '{title}' closed.",
      "'{title}' — marked complete.",
      "Handled. '{title}' off the list.",
    ],
    delete: [
      "Deleted. '{title}' removed.",
      "Gone. As requested.",
      "'{title}' purged.",
    ],
    snooze: [
      "Snoozed {mins} min. Don't make this a habit.",
      "{mins} minutes. Use them.",
      "Snoozed. I'm watching the clock.",
    ],
    habit_logged: [
      "'{title}'. Day {streak}. Keep going.",
      "Logged. {streak} days straight.",
      "'{title}' — consistent. Good.",
    ],
    habit_skip: [
      "Skipped. One day won't kill the streak. Two will.",
      "Rest noted. Resume tomorrow.",
      "Skip approved. Don't abuse it.",
    ],
    expense_ok: [
      "'{title}' categorised.",
      "Logged. Stay within budget.",
      "Recorded. Tracked.",
    ],
    expense_delete: [
      "Deleted. Never happened.",
      "Expense removed.",
      "'{title}' — gone from the record.",
    ],
    note_pin: [
      "'{title}' pinned.",
      "Pinned. Presumably important.",
      "Top of the stack.",
    ],
    note_delete: [
      "Deleted.",
      "Note removed. Clean slate.",
      "'{title}' — gone.",
    ],
    focus_end: [
      "Session complete.",
      "Focus ended. Results?",
      "Done. Back to the world.",
    ],
    focus_extend: [
      "Extending {mins} min. Make it count.",
      "{mins} more minutes. No interruptions.",
      "Extended. Stay locked in.",
    ],
    already_done: [
      "Already done. Move on.",
      "This was handled. Check your list.",
      "Done. Already. You're welcome.",
    ],
    already_deleted: [
      "Already deleted. Nothing to do.",
      "It's gone. Has been for a while.",
      "Can't delete twice. It's gone.",
    ],
  },

  aria: {
    done: [
      "'{title}' — complete! That feeling of checking something off 🌟",
      "Done! One less thing between you and your best day ✨",
      "Checked off! You showed up for yourself today 💫",
    ],
    delete: [
      "Released '{title}' into the void 🌌",
      "Gone. Sometimes letting go is the move 🍃",
      "Deleted — making space for what actually matters ✨",
    ],
    snooze: [
      "Giving '{title}' {mins} more minutes of grace ⏳",
      "Snoozed {mins} min — but it'll come back for you 🌀",
      "Paused, not forgotten. {mins} minutes ⏰",
    ],
    habit_logged: [
      "Day {streak} of '{title}'! You're building something real 🌱",
      "'{title}' — logged with love. {streak}-day streak! 💫",
      "{streak} days of '{title}'. This is becoming who you are ✨",
    ],
    habit_skip: [
      "Rest is part of the rhythm too 🌙",
      "Skipping '{title}' today — your body knows what it needs",
      "One missed day doesn't erase the days of showing up 🌿",
    ],
    expense_ok: [
      "'{title}' noted — every rupee, intentional 💫",
      "Logged! Awareness is the first step to abundance ✨",
      "'{title}' tracked. You're in control of your story 🌟",
    ],
    expense_delete: [
      "'{title}' — let go. Clean slate 🌊",
      "Removed. Sometimes numbers don't tell the full story 🍃",
      "Deleted with grace ✨",
    ],
    note_pin: [
      "'{title}' — pinned because it matters 📌✨",
      "Kept close to the top, where it belongs 🌟",
      "Pinned! The important things deserve to be seen 💫",
    ],
    note_delete: [
      "Released '{title}' — making space for new thoughts 🌿",
      "Gone but not forgotten. The idea lives on 🌱",
      "Deleted with intention ✨",
    ],
    focus_end: [
      "Your focus session is a gift to yourself 🌟",
      "Session complete — what you built matters ✨",
      "Breathe. You did the work 🌿",
    ],
    focus_extend: [
      "In your element! {mins} more minutes of deep work 🌊",
      "Extended — the muse is speaking, don't stop now ✨",
      "{mins} more minutes. This is your time 🌟",
    ],
    already_done: [
      "This one's already crossed off — you're ahead of the game ✨",
      "Already done! Past you was on top of it 🌟",
      "Done before you even had to think about it 💫",
    ],
    already_deleted: [
      "Already released this one ✨",
      "Gone — you already let it go 🍃",
      "This was already freed from the list 🌿",
    ],
  },

  forge: {
    done: ["'{title}' — closed. ✓", "Task complete. Ship it.", "Done. Next."],
    delete: ["Removed from the queue.", "'{title}' — deprecated and deleted.", "Purged. Clean."],
    snooze: ["Snoozed {mins} min. Rescheduled.", "Queued for {mins} more minutes.", "Deferred {mins} min. Don't forget."],
    habit_logged: ["'{title}' — committed. Day {streak}.", "Streak: {streak}. Keep shipping.", "Logged. {streak}-day run continues."],
    habit_skip: ["Skipped. Resume tomorrow.", "One skip logged. Rebuild tomorrow.", "Off today. Back on tomorrow."],
    expense_ok: ["'{title}' — recorded.", "Expense logged. Budget updated.", "Tracked. Moving on."],
    expense_delete: ["Entry removed.", "Expense purged.", "'{title}' — deleted from ledger."],
    note_pin: ["Pinned to top.", "'{title}' — prioritised.", "Flagged as important."],
    note_delete: ["Removed from index.", "'{title}' — deleted.", "Note purged."],
    focus_end: ["Session complete. Output?", "Focus done. Ship the result.", "Ended. What did you build?"],
    focus_extend: ["Extended {mins} min. Stay in flow.", "Focus timer +{mins}. No breaks.", "{mins} more. Keep building."],
    already_done: ["Already marked complete. Check your tasks.", "Done. Was done. Still done.", "Idempotent operation. Already complete."],
    already_deleted: ["Already removed. Nothing to delete.", "Gone. Was gone. Still gone.", "Delete called twice. First one worked."],
  },

  nova: {
    done: ["'{title}' — done done! That's the energy 🙌", "Checked! You ate that task up 🔥", "'{title}' — finished! No cap, you're killing it ✅"],
    delete: ["Deleted! Bye bye '{title}' 👋", "Removed! It's giving declutter energy 🧹", "Gone! Main character doesn't need that ✨"],
    snooze: ["Snoozed {mins} min — slay now or slay later 💅", "Okay, {mins} more minutes. You got this though!", "We're pressing pause for {mins}. Come back iconic."],
    habit_logged: ["'{title}' — logged! Day {streak} streak is immaculate 🔥", "Consistency is so sexy fr. Day {streak}! 💅", "{streak}-day streak! '{title}' lowkey becoming your whole identity 🌟"],
    habit_skip: ["Rest day! Self-care is also a habit 🌙", "Skipping today, but we're back tomorrow right? 🫶", "Rest era activated. '{title}' can wait one day 💆"],
    expense_ok: ["'{title}' logged! Financially aware, love that 💸", "Tracked! Budget-conscious era is the vibe ✨", "Expense noted! You know where the money's going 💰"],
    expense_delete: ["Deleted! That spend is cancelled 🚫", "Removed! It didn't happen anymore 🙈", "Gone! Your budget is cleaner now 🧹"],
    note_pin: ["Pinned! VIP note right there 📌", "To the top! This note understood the assignment 🌟", "Pinned! Main character note energy ✨"],
    note_delete: ["Deleted! Unbothered and note-free 🌬️", "Gone! Decluttered and thriving 🌿", "Removed! New era, no old notes 🔄"],
    focus_end: ["Focus session? Smashed it! 🔥", "Done focusing! Now you get to relax 🌟", "Session complete! Productive era lives on 💅"],
    focus_extend: ["In your bag! {mins} more minutes of beast mode 🔥", "Extended {mins} min — we're not leaving until it's done 💪", "More focus time! You're literally so dedicated rn 🌟"],
    already_done: ["Already done bestie! Overachiever behaviour 🏆", "Babe this was already checked off 😄", "Already done! We love someone ahead of schedule 🌟"],
    already_deleted: ["Already deleted! Can't double delete babe 😂", "It's already gone! The bin said no more 🗑️", "Already deleted! Twice as gone 👻"],
  },
};

// ── Template Picker ──────────────────────────────────────────

function pickTemplate(persona: string, action: string, ctx: ButtonContext): string {
  const templates = PERSONA_TEMPLATES[persona] ?? PERSONA_TEMPLATES['weebo'];
  const variants = templates[action] ?? templates['done'] ?? ["Done."];
  const raw = variants[Math.floor(Math.random() * variants.length)];

  return raw
    .replace(/\{title\}/g, ctx.entityTitle ?? 'that')
    .replace(/\{mins\}/g, String(ctx.snoozeMinutes ?? 60))
    .replace(/\{streak\}/g, String(ctx.streakCount ?? 1));
}

// ── LLM Fallback (edge cases only) ──────────────────────────

const PERSONA_VOICES: Record<string, string> = {
  weebo: 'Warm, enthusiastic, playful. Uses exclamation marks. Casual friend energy.',
  edith: 'Decisive, dry wit, minimal words. CTO energy. No exclamation spam.',
  aria: 'Creative, expressive, warm. Slightly poetic. Uses metaphors.',
  forge: 'Technical, builder mindset. Concise. No fluff. Direct.',
  nova: 'Upbeat, social, trending. Light modern slang. Positive energy.',
};

async function getLLMPersonaResponse(
  userId: string,
  action: ButtonAction,
  ctx: ButtonContext
): Promise<string> {
  try {
    const { routeChat } = await import('./llm.js');
    const personaVoice = PERSONA_VOICES[ctx.persona] ?? PERSONA_VOICES['weebo'];

    const prompt = `You are responding as an AI assistant with this personality: ${personaVoice}

The user just triggered: ${action} on their ${ctx.entityType} titled "${ctx.entityTitle}"
${ctx.alreadyDone ? 'IMPORTANT: This item was ALREADY in the completed/deleted state before they clicked.' : ''}
${ctx.streakCount ? `Current streak: ${ctx.streakCount} days` : ''}

Write a single short response (max 100 characters) in the persona's voice.
No markdown. No quotes. Just the message text.`;

    const result = await routeChat(
      [{ role: 'user', content: prompt }],
      { userId }
    );
    const text = typeof result === 'string' ? result : result?.reply ?? '';
    return text.trim().slice(0, 120) || pickTemplate(ctx.persona, action, ctx);
  } catch {
    return pickTemplate(ctx.persona, action, ctx);
  }
}

// ── Main Export ───────────────────────────────────────────────

/**
 * Generate a persona-voiced response for a button action.
 *
 * For standard cases, picks a random template from
 * {@link PERSONA_TEMPLATES} matching the user's active persona and
 * the button action, then hydrates it with context variables.
 * For edge cases (milestone streaks, double-taps, focus endings),
 * delegates to the LLM for a more contextual reply.
 *
 * @param userId - Authenticated user ID (used for LLM fallback context)
 * @param action - The button action that was tapped (e.g. `"done"`, `"snooze"`)
 * @param ctx    - Contextual data: entity type/title, persona, streak count, etc.
 * @returns A short persona-voiced confirmation string suitable for
 *          Telegram inline reply
 */
export async function getPersonaResponse(
  userId: string,
  action: ButtonAction,
  ctx: ButtonContext
): Promise<string> {
  // Edge cases get LLM treatment for richer responses
  const isEdgeCase = ctx.alreadyDone
    || (action === 'habit_logged' && ctx.streakCount && ctx.streakCount % 7 === 0)
    || (action === 'habit_logged' && ctx.streakCount === 30)
    || action === 'focus_end';

  if (isEdgeCase) {
    // Map to already_done/already_deleted for double-tap
    const effectiveAction = ctx.alreadyDone
      ? (action === 'delete' || action === 'expense_delete' || action === 'note_delete'
          ? 'already_deleted' : 'already_done')
      : action;
    return getLLMPersonaResponse(userId, effectiveAction as ButtonAction, ctx);
  }

  return pickTemplate(ctx.persona, action, ctx);
}
