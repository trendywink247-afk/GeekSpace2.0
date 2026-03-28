// ============================================================
// Telegram Bot Onboarding Service
//
// Complete onboarding flow with Quick Setup and Custom Setup paths
// Includes demo mode with 3 scenarios and action chips
// ============================================================

import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { sendTelegramMessage, sendTelegramButtons } from './telegram.js';

// Onboarding states
type OnboardingState =
  | 'welcome'
  | 'quick_goal' | 'quick_style' | 'quick_firstwin' | 'quick_superpower'
  | 'custom_mode' | 'custom_preferences' | 'custom_tools' | 'custom_confirm'
  | 'demo_select' | 'demo_scenario_1' | 'demo_scenario_2' | 'demo_scenario_3'
  | 'complete';

interface OnboardingData {
  goal?: string;
  style?: string;
  firstWin?: string;
  memory?: boolean;
  channel?: string;
  mode?: string;
  preference?: string;
  tools?: string[];
}

interface OnboardingSession {
  id: string;
  user_id: string | null;
  telegram_chat_id: string;
  state: OnboardingState;
  path: 'quick' | 'custom' | 'demo' | null;
  step: number;
  data: OnboardingData;
}

// ---- Database Operations ----

export function getOrCreateOnboarding(chatId: string): OnboardingSession {
  let session = db.prepare(
    'SELECT * FROM telegram_onboarding WHERE telegram_chat_id = ?'
  ).get(chatId) as OnboardingSession | undefined;

  if (!session) {
    const id = uuid();
    db.prepare(`
      INSERT INTO telegram_onboarding (id, telegram_chat_id, state, path, step, data)
      VALUES (?, ?, 'welcome', NULL, 0, '{}')
    `).run(id, chatId);

    session = {
      id,
      user_id: null,
      telegram_chat_id: chatId,
      state: 'welcome',
      path: null,
      step: 0,
      data: {}
    };
  } else {
    try { session.data = JSON.parse(session.data as unknown as string); } catch { session.data = {}; }
  }

  return session;
}

export function updateOnboarding(
  chatId: string,
  updates: Partial<Pick<OnboardingSession, 'state' | 'path' | 'step' | 'data'>>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.state) { sets.push('state = ?'); values.push(updates.state); }
  if (updates.path) { sets.push('path = ?'); values.push(updates.path); }
  if (updates.step !== undefined) { sets.push('step = ?'); values.push(updates.step); }
  if (updates.data) { sets.push('data = ?'); values.push(JSON.stringify(updates.data)); }

  sets.push('updated_at = datetime("now")');
  values.push(chatId);

  db.prepare(`UPDATE telegram_onboarding SET ${sets.join(', ')} WHERE telegram_chat_id = ?`)
    .run(...values);
}

export function linkOnboardingToUser(chatId: string, userId: string): void {
  db.prepare('UPDATE telegram_onboarding SET user_id = ? WHERE telegram_chat_id = ?')
    .run(userId, chatId);
}

export function deleteOnboarding(chatId: string): void {
  db.prepare('DELETE FROM telegram_onboarding WHERE telegram_chat_id = ?').run(chatId);
}

// ---- Welcome Step ----

export async function sendWelcome(chatId: string): Promise<void> {
  const text = `Welcome 👋 I can be your Personal AI or your Work AI.

Want a quick setup (30 seconds) or custom setup?`;

  const buttons = [
    [{ text: '⚡ Quick Setup (30s)', callback_data: 'onboard_quick' }],
    [{ text: '🛠 Custom Setup', callback_data: 'onboard_custom' }],
    [{ text: '🎮 Try Demo First', callback_data: 'onboard_demo' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'welcome' });
}

// ---- Quick Setup Flow ----

export async function quickSetupGoal(chatId: string): Promise<void> {
  const text = `⚡ Quick Setup — Step 1/4

What are you using me for today?`;

  const buttons = [
    [{ text: '🎯 Personal growth', callback_data: 'goal_personal' }],
    [{ text: '💼 Work productivity', callback_data: 'goal_work' }],
    [{ text: '📚 Study / learning', callback_data: 'goal_study' }],
    [{ text: '🎨 Content / social', callback_data: 'goal_content' }],
    [{ text: '🛠 Support / troubleshooting', callback_data: 'goal_support' }],
    [{ text: '✨ Surprise me', callback_data: 'goal_surprise' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'quick_goal', path: 'quick', step: 1 });
}

export async function quickSetupStyle(chatId: string, data: OnboardingData): Promise<void> {
  const _goalText = data.goal === 'surprise' ? 'surprise' : `for ${data.goal}`;

  const text = `⚡ Quick Setup — Step 2/4

Pick your vibe — you can change it anytime.`;

  const buttons = [
    [{ text: '🍏 Clean (Apple)', callback_data: 'style_clean' }],
    [{ text: '⚡ Futuristic (Cyber)', callback_data: 'style_futuristic' }],
    [{ text: '🔥 Hybrid (Best of both)', callback_data: 'style_hybrid' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'quick_style', step: 2, data });
}

export async function quickSetupFirstWin(chatId: string, data: OnboardingData): Promise<void> {
  const text = `⚡ Quick Setup — Step 3/4

Nice. Let's get your first win now. Choose one:`;

  const buttons = [
    [{ text: '✅ Make a plan from my idea', callback_data: 'win_plan' }],
    [{ text: '🧾 Draft a message/email', callback_data: 'win_draft' }],
    [{ text: '⏰ Set a reminder', callback_data: 'win_reminder' }],
    [{ text: '📌 Create a checklist', callback_data: 'win_checklist' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'quick_firstwin', step: 3, data });
}

export async function quickSetupSuperpower(chatId: string, data: OnboardingData): Promise<void> {
  const text = `⚡ Quick Setup — Step 4/4

Want me to remember your goal and continue outside the website?`;

  const buttons = [
    [{ text: '🧠 Turn on Memory', callback_data: 'superpower_memory' }],
    [{ text: '📲 Connect WhatsApp', callback_data: 'superpower_whatsapp' }],
    [{ text: '✈️ Connect Telegram', callback_data: 'superpower_telegram' }],
    [{ text: 'Not now', callback_data: 'superpower_skip' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'quick_superpower', step: 4, data });
}

// ---- Custom Setup Flow ----

export async function customSetupMode(chatId: string): Promise<void> {
  const text = `🛠 Custom Setup — Step 1/4

Choose your mode:`;

  const buttons = [
    [{ text: '🎯 Personal OS', callback_data: 'mode_personal' }],
    [{ text: '💼 Team / Work OS', callback_data: 'mode_team' }],
    [{ text: '🧠 Learning Coach', callback_data: 'mode_learning' }],
    [{ text: '🎬 Creator Studio', callback_data: 'mode_creator' }],
    [{ text: '🛠 Tech Support Agent', callback_data: 'mode_support' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'custom_mode', path: 'custom', step: 1 });
}

export async function customSetupPreferences(chatId: string, data: OnboardingData): Promise<void> {
  const text = `🛠 Custom Setup — Step 2/4

How do you like replies?`;

  const buttons = [
    [{ text: 'Short & direct', callback_data: 'pref_short' }],
    [{ text: 'Balanced', callback_data: 'pref_balanced' }],
    [{ text: 'Detailed', callback_data: 'pref_detailed' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'custom_preferences', step: 2, data });
}

export async function customSetupTools(chatId: string, data: OnboardingData): Promise<void> {
  const text = `🛠 Custom Setup — Step 3/4

What should I be able to do?
(Tap to toggle, then Confirm)`;

  const buttons = [
    [{ text: '☑️ Reminders', callback_data: 'tool_reminders' }],
    [{ text: '☑️ Notes / memory', callback_data: 'tool_memory' }],
    [{ text: '☑️ Automations', callback_data: 'tool_automations' }],
    [{ text: '☑️ WhatsApp/Telegram', callback_data: 'tool_channels' }],
    [{ text: '☐ Calendar (later)', callback_data: 'tool_calendar' }],
    [{ text: '✅ Confirm tools →', callback_data: 'tools_confirm' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'custom_tools', step: 3, data });
}

export async function customSetupConfirm(chatId: string, data: OnboardingData): Promise<void> {
  const tools = data.tools || ['Reminders', 'Notes / memory', 'Automations starter pack'];

  const text = `🛠 Custom Setup — Step 4/4

Ready. I'll set up your workspace with these features:
${tools.map(t => `✅ ${t}`).join('\n')}
${data.memory ? '\n✅ Memory enabled' : ''}`;

  const buttons = [
    [{ text: '✅ Create my agent', callback_data: 'confirm_create' }],
    [{ text: '✏️ Edit', callback_data: 'confirm_edit' }],
    [{ text: '❌ Cancel', callback_data: 'confirm_cancel' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'custom_confirm', step: 4, data });
}

// ---- Demo Mode ----

export async function demoSelectScenario(chatId: string): Promise<void> {
  const text = `🎮 Demo Mode

Which scenario would you like to try?`;

  const buttons = [
    [{ text: '💡 Idea → Plan → Saved', callback_data: 'demo_1' }],
    [{ text: '💬 Chat → WhatsApp follow-up', callback_data: 'demo_2' }],
    [{ text: '🛠 Customer support fix', callback_data: 'demo_3' }]
  ];

  await sendTelegramButtons(chatId, text, buttons);
  updateOnboarding(chatId, { state: 'demo_select', path: 'demo' });
}

// Demo Scenario 1: Idea → Plan → Saved
export async function demoScenario1(chatId: string): Promise<void> {
  await sendTelegramMessage(chatId, `🎮 Demo: Idea → Plan → Saved\n\n"Give me any messy idea. I'll turn it into a clean plan and save it to your dashboard."`);

  await new Promise(r => setTimeout(r, 500));

  // Simulate user input suggestion
  await sendTelegramButtons(chatId, `Try this example:`, [
    [{ text: '💡 "Help me launch a project in 7 days"', callback_data: 'demo1_run' }]
  ]);

  updateOnboarding(chatId, { state: 'demo_scenario_1' });
}

export async function demoScenario1Run(chatId: string): Promise<void> {
  // Simulate agent thinking
  await sendTelegramMessage(chatId, `⏳ Analyzing your idea...`);
  await new Promise(r => setTimeout(r, 1500));

  const plan = `📋 *7-Day Launch Plan*

*Days 1-2: Foundation*
• Define core value proposition
• Set up landing page
• Create waitlist signup

*Days 3-4: Build*
• MVP feature set
• Basic onboarding flow
• Payment integration

*Days 5-6: Test*
• Beta with 5 users
• Gather feedback
• Fix critical bugs

*Day 7: Launch*
• Post on Product Hunt
• Email waitlist
• Social announcement

⚠️ *Risks & Mitigation:*
• Scope creep → Strict 48hr features only
• No users → Start marketing Day 1
• Tech issues → Have rollback ready`;

  await sendTelegramMessage(chatId, plan);
  await new Promise(r => setTimeout(r, 500));

  // Show tool receipts
  const receipts = `✅ *Project card created*
✅ *Tasks generated*
✅ *Reminders scheduled* (if chosen)`;

  await sendTelegramMessage(chatId, receipts);
  await new Promise(r => setTimeout(r, 300));

  // Context-aware action chips (limited frequency)
  await sendActionChips(chatId, 'plan');
}

// Demo Scenario 2: Chat → WhatsApp follow-up
export async function demoScenario2(chatId: string): Promise<void> {
  await sendTelegramMessage(chatId, `🎮 Demo: Chat → WhatsApp Follow-up\n\n"Want this agent to ping you on WhatsApp like a real assistant?"`);

  await new Promise(r => setTimeout(r, 500));

  await sendTelegramButtons(chatId, `Connect your channels:`, [
    [{ text: '📲 Connect WhatsApp', callback_data: 'demo2_whatsapp' }],
    [{ text: '✈️ Connect Telegram', callback_data: 'demo2_telegram' }]
  ]);

  updateOnboarding(chatId, { state: 'demo_scenario_2' });
}

export async function demoScenario2Connect(chatId: string, channel: string): Promise<void> {
  await sendTelegramMessage(chatId, `✅ *${channel} connected*\n✅ *Test ping sent*`);
  await new Promise(r => setTimeout(r, 500));

  await sendTelegramMessage(chatId, `Done. Type: "Remind me tomorrow 9AM" here — and I'll deliver it on ${channel} too.`);

  await new Promise(r => setTimeout(r, 300));

  await sendTelegramButtons(chatId, `Try it now:`, [
    [{ text: '⏰ "Remind me tomorrow 9AM"', callback_data: 'demo2_remind' }],
    [{ text: '⏰ "Remind me in 1 hour"', callback_data: 'demo2_remind1h' }]
  ]);
}

// Demo Scenario 3: Customer support
export async function demoScenario3(chatId: string): Promise<void> {
  await sendTelegramMessage(chatId, `🎮 Demo: Customer Support That Actually Helps\n\n"Paste an error. I'll generate a fix checklist + create a support ticket draft."`);

  await new Promise(r => setTimeout(r, 500));

  await sendTelegramButtons(chatId, `Try this example:`, [
    [{ text: '🐛 "My site is slow and API errors"', callback_data: 'demo3_run' }]
  ]);

  updateOnboarding(chatId, { state: 'demo_scenario_3' });
}

export async function demoScenario3Run(chatId: string): Promise<void> {
  await sendTelegramMessage(chatId, `⏳ Analyzing the issue...`);
  await new Promise(r => setTimeout(r, 1500));

  const analysis = `🔍 *Issue Analysis*

*Top 5 Checks:*
1. Server response time (>200ms = problem)
2. Database query optimization
3. API rate limiting status
4. CDN/cache configuration
5. Recent deployment changes

*Likely Causes:*
• Database connection pool exhausted
• N+1 query problem in recent code
• Third-party API timeout cascading

*What Logs to Collect:*
• /var/log/nginx/error.log
• Application slow query log
• External API response times`;

  await sendTelegramMessage(chatId, analysis);
  await new Promise(r => setTimeout(r, 500));

  // Context-aware action chips (limited frequency)
  await sendActionChips(chatId, 'research');
}

// ---- Completion ----

export async function completeOnboarding(chatId: string, data: OnboardingData, path: string): Promise<void> {
  const tagline = path === 'quick'
    ? '⚡ Your quick setup is complete!'
    : path === 'custom'
    ? '🛠 Your custom workspace is ready!'
    : '🎮 Demo complete — ready to create your own agent?';

  const text = `${tagline}

*ChatGPT gives answers. Your agent delivers outcomes.*

Type anything to get started, or use these shortcuts:
• /help — See what I can do
• /remind — Set a reminder
• /plan — Create a plan
• /connect — Link WhatsApp/Telegram`;

  await sendTelegramMessage(chatId, text);

  // Only show action chips once after onboarding completes
  await sendActionChips(chatId, 'onboarding_complete');

  deleteOnboarding(chatId);
}

// ---- Action Chips (shown intelligently, NOT on every message) ----

// Track last chip send time per chat to prevent spam
const lastChipSent: Map<string, number> = new Map();
const CHIP_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between chip displays

export async function sendActionChips(chatId: string, context?: string): Promise<void> {
  // Check cooldown to prevent button spam
  const now = Date.now();
  const lastSent = lastChipSent.get(chatId) || 0;
  if (now - lastSent < CHIP_COOLDOWN_MS) {
    return; // Don't spam buttons
  }

  // Define context-appropriate chips
  const chipSets: Record<string, Array<Array<{ text: string; callback_data: string }>>> = {
    plan: [
      [{ text: '✅ Save to Dashboard', callback_data: 'chip_save' }],
      [{ text: '⏰ Add Reminders', callback_data: 'chip_remind' }],
      [{ text: '🔁 Refine Plan', callback_data: 'chip_improve' }],
    ],
    draft: [
      [{ text: '✅ Save Draft', callback_data: 'chip_save' }],
      [{ text: '🧾 Export', callback_data: 'chip_export' }],
      [{ text: '🔁 Improve', callback_data: 'chip_improve' }],
    ],
    reminder: [
      [{ text: '✅ Confirm', callback_data: 'chip_confirm' }],
      [{ text: '❌ Cancel', callback_data: 'chip_cancel' }],
    ],
    research: [
      [{ text: '✅ Save Summary', callback_data: 'chip_save' }],
      [{ text: '🧾 Export Notes', callback_data: 'chip_export' }],
    ],
    code: [
      [{ text: '✅ Save Project', callback_data: 'chip_save' }],
      [{ text: '🚀 Deploy', callback_data: 'chip_deploy' }],
      [{ text: '🔁 Optimize', callback_data: 'chip_improve' }],
    ],
    onboarding_complete: [
      [{ text: '⚡ Quick Actions', callback_data: 'chip_quick' }],
    ]
  };

  // Get relevant chips or default to empty (no buttons)
  const chips = context ? chipSets[context] : undefined;
  if (!chips || chips.length === 0) {
    return; // No buttons for this context
  }

  lastChipSent.set(chatId, now);
  await sendTelegramButtons(chatId, `Quick actions:`, chips.slice(0, 3));
}

// ---- Handle Callbacks ----

export async function handleOnboardingCallback(
  chatId: string,
  data: string,
  _messageText?: string
): Promise<boolean> {
  const session = getOrCreateOnboarding(chatId);

  // Welcome buttons
  if (data === 'onboard_quick') {
    await quickSetupGoal(chatId);
    return true;
  }
  if (data === 'onboard_custom') {
    await customSetupMode(chatId);
    return true;
  }
  if (data === 'onboard_demo') {
    await demoSelectScenario(chatId);
    return true;
  }

  // Quick setup flow
  if (data.startsWith('goal_')) {
    session.data.goal = data.replace('goal_', '');
    await quickSetupStyle(chatId, session.data);
    return true;
  }
  if (data.startsWith('style_')) {
    session.data.style = data.replace('style_', '');
    await quickSetupFirstWin(chatId, session.data);
    return true;
  }
  if (data.startsWith('win_')) {
    session.data.firstWin = data.replace('win_', '');
    await quickSetupSuperpower(chatId, session.data);
    return true;
  }
  if (data.startsWith('superpower_')) {
    if (data === 'superpower_memory') session.data.memory = true;
    if (data === 'superpower_whatsapp') session.data.channel = 'whatsapp';
    if (data === 'superpower_telegram') session.data.channel = 'telegram';

    if (data === 'superpower_memory') {
      await sendTelegramMessage(chatId, `🧠 Cool — I'll only store what you approve. You can delete anytime.`);
      await new Promise(r => setTimeout(r, 500));
    }

    await completeOnboarding(chatId, session.data, 'quick');
    return true;
  }

  // Custom setup flow
  if (data.startsWith('mode_')) {
    session.data.mode = data.replace('mode_', '');
    await customSetupPreferences(chatId, session.data);
    return true;
  }
  if (data.startsWith('pref_')) {
    session.data.preference = data.replace('pref_', '');
    await customSetupTools(chatId, session.data);
    return true;
  }
  if (data.startsWith('tool_')) {
    if (!session.data.tools) session.data.tools = [];
    const tool = data.replace('tool_', '');

    if (data === 'tools_confirm') {
      await customSetupConfirm(chatId, session.data);
    } else {
      // Toggle tool
      const idx = session.data.tools.indexOf(tool);
      if (idx > -1) session.data.tools.splice(idx, 1);
      else session.data.tools.push(tool);

      // Update message to show toggled state
      await customSetupTools(chatId, session.data);
    }
    return true;
  }
  if (data === 'confirm_create') {
    await completeOnboarding(chatId, session.data, 'custom');
    return true;
  }
  if (data === 'confirm_edit') {
    await customSetupMode(chatId);
    return true;
  }
  if (data === 'confirm_cancel') {
    await sendTelegramMessage(chatId, 'Setup cancelled. Type /start to try again.');
    deleteOnboarding(chatId);
    return true;
  }

  // Demo flow
  if (data.startsWith('demo_')) {
    if (data === 'demo_1') await demoScenario1(chatId);
    if (data === 'demo_2') await demoScenario2(chatId);
    if (data === 'demo_3') await demoScenario3(chatId);
    return true;
  }
  if (data === 'demo1_run') {
    await demoScenario1Run(chatId);
    return true;
  }
  if (data === 'demo2_whatsapp') {
    await demoScenario2Connect(chatId, 'WhatsApp');
    return true;
  }
  if (data === 'demo2_telegram') {
    await demoScenario2Connect(chatId, 'Telegram');
    return true;
  }
  if (data.startsWith('demo2_remind')) {
    const when = data === 'demo2_remind1h' ? 'in 1 hour' : 'tomorrow 9AM';
    await sendTelegramMessage(chatId, `✅ Reminder set: "${when}"`);
    await new Promise(r => setTimeout(r, 300));
    await sendTelegramMessage(chatId, `You'll receive this on WhatsApp too!\n\n🎮 Demo complete. Ready to create your own agent?`);
    await sendTelegramButtons(chatId, `Get started:`, [
      [{ text: '⚡ Quick Setup', callback_data: 'onboard_quick' }],
      [{ text: '🛠 Custom Setup', callback_data: 'onboard_custom' }]
    ]);
    return true;
  }
  if (data === 'demo3_run') {
    await demoScenario3Run(chatId);
    return true;
  }

  // Action chips
  if (data.startsWith('action_') || data.startsWith('chip_')) {
    // These would be handled by the main message router
    // Just acknowledge for now
    await sendTelegramMessage(chatId, `✅ Action received! (Full implementation in main chat handler)`);
    return true;
  }

  return false; // Not an onboarding callback
}

// ---- Start Onboarding Command ----

export async function startOnboarding(chatId: string, userId?: string): Promise<void> {
  // Clean up any existing session
  deleteOnboarding(chatId);

  // Create new session
  const _session = getOrCreateOnboarding(chatId);
  if (userId) {
    linkOnboardingToUser(chatId, userId);
  }

  await sendWelcome(chatId);
}
