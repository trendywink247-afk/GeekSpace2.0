#!/usr/bin/env node
/**
 * AGENTIN LIVE AGENTIC TEST HARNESS v1.0
 *
 * Sends realistic prompts through the LIVE agent pipeline (web API only).
 * Verifies: agent responds, correct behavior, no errors.
 *
 * USAGE:
 *   node ops/agentin-live-test-v1.mjs
 *   node ops/agentin-live-test-v1.mjs --category=reminders
 *   node ops/agentin-live-test-v1.mjs --category=habits --verbose
 *
 * Auth: Uses demo login (POST /api/auth/demo) by default.
 *       Set ALIYA_EMAIL + ALIYA_PASS to test as a real user.
 *
 * IMPORTANT: Uses web API only — does NOT send Telegram messages.
 * Default delay: 3000ms between prompts (rate-limiter safe).
 */

const API = process.env.API_BASE || 'http://localhost:3001';
const VERBOSE = process.argv.includes('--verbose');
const CATEGORY = process.argv.find(a => a.startsWith('--category='))?.split('=')[1];
const DELAY_MS = parseInt(process.env.PROMPT_DELAY_MS || '3000');

let token = null;
let totalPass = 0;
let totalFail = 0;
let totalSkip = 0;
const failures = [];

// ---- AUTH ----

async function authenticate() {
  const email = process.env.ALIYA_EMAIL;
  const pass = process.env.ALIYA_PASS;

  if (email && pass) {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!r.ok) throw new Error(`Login failed: ${r.status}`);
    const d = await r.json();
    token = d.token;
    console.log(`  Authenticated as ${email}`);
  } else {
    // Use demo login
    const r = await fetch(`${API}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r.ok) throw new Error(`Demo login failed: ${r.status}`);
    const d = await r.json();
    token = d.token;
    console.log('  Authenticated via demo login');
  }
}

// ---- CHAT ----

async function chat(message, options = {}) {
  const r = await fetch(`${API}/api/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      channel: 'web',
      personality: options.personality || 'weebo',
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) return { error: `HTTP ${r.status}`, text: '' };
  const data = await r.json();
  return { text: data.text || data.reply || '', ...data };
}

// ---- TEST RUNNER ----

async function runPrompt(label, message, verify, options = {}) {
  const padded = label.padEnd(55);
  try {
    await new Promise(r => setTimeout(r, DELAY_MS));
    const response = await chat(message, options);

    if (response.error) {
      console.log(`  FAIL  ${padded} API error: ${response.error}`);
      totalFail++;
      failures.push({ label, message, error: response.error });
      return null;
    }

    const reply = response.text || '';
    if (reply.trim().length < 3) {
      console.log(`  FAIL  ${padded} Empty response`);
      totalFail++;
      failures.push({ label, message, error: 'Empty reply' });
      return null;
    }

    const result = verify(response);
    if (result === true || result === undefined) {
      if (VERBOSE) {
        console.log(`  PASS  ${padded} "${reply.slice(0, 55)}..."`);
      } else {
        console.log(`  PASS  ${padded}`);
      }
      totalPass++;
      return response;
    } else {
      console.log(`  FAIL  ${padded} ${result}`);
      if (VERBOSE) console.log(`        Got: "${reply.slice(0, 120)}"`);
      totalFail++;
      failures.push({ label, message, error: result, reply: reply.slice(0, 200) });
      return null;
    }
  } catch (err) {
    console.log(`  FAIL  ${padded} ${err.message}`);
    totalFail++;
    failures.push({ label, message, error: err.message });
    return null;
  }
}

function hasAny(text, ...patterns) {
  const lower = (text || '').toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}

// ---- CATEGORY: REMINDERS (15 prompts) ----

async function testReminders() {
  console.log('\n  REMINDERS (15 prompts)\n');

  await runPrompt('EN: Natural tomorrow',
    'remind me to call my doctor tomorrow morning at 9am',
    r => hasAny(r.text, 'remind', 'set', '9') ? true : 'No reminder confirmation');

  await runPrompt('EN: Specific date',
    'Set a reminder for March 25th at 3pm to submit the tax returns',
    r => hasAny(r.text, 'remind', 'march', '25', '3') ? true : 'Missing date confirmation');

  await runPrompt('EN: Recurring daily',
    'Remind me everyday at 8am to take my vitamins',
    r => hasAny(r.text, 'every', 'daily', '8', 'vitamin', 'remind') ? true : 'Recurrence not acknowledged');

  await runPrompt('EN: Tonight',
    'reminder tonight at 10pm - take medication',
    r => hasAny(r.text, '10', 'tonight', 'medication', 'remind') ? true : 'Time not confirmed');

  await runPrompt('EN: In 2 hours',
    'remind me in 2 hours to check the oven',
    r => hasAny(r.text, '2 hour', 'remind', 'oven') ? true : 'Relative time not handled');

  await runPrompt('EN: End of day',
    'remind me at end of day to update the project status',
    r => hasAny(r.text, 'remind', 'end', 'day', 'project') ? true : 'EOD not handled');

  await runPrompt('HI: Basic Hinglish',
    'kal subah 9 baje doctor ka reminder set karo',
    r => hasAny(r.text, 'remind', '9', 'doctor') ? true : 'Hinglish reminder not set');

  await runPrompt('HI: Casual yaad dila',
    'bhai kal meeting hai 3 baje, yaad dila dena',
    r => hasAny(r.text, 'remind', '3', 'meeting') ? true : 'Hinglish casual not handled');

  await runPrompt('HI: Recurring',
    'har roz subah 7 baje exercise ka reminder chahiye',
    r => hasAny(r.text, 'every', 'daily', '7', 'exercise', 'remind') ? true : 'Hinglish recurring not handled');

  await runPrompt('EDGE: No time given',
    'remind me to buy groceries',
    r => r.text.length > 5 ? true : 'Should respond (ask for time or set default)');

  await runPrompt('EDGE: Very long text',
    'remind me tomorrow at 9am to: 1) Review the quarterly report 2) Call the sales team 3) Update the roadmap',
    r => hasAny(r.text, 'remind', 'tomorrow') ? true : 'Long text not handled');

  await runPrompt('VERIFY: List reminders',
    'what reminders do I have?',
    r => hasAny(r.text, 'reminder', 'no reminder', 'you have', 'here') ? true : 'List not returned');

  await runPrompt('VERIFY: Upcoming',
    'show me my reminders for this week',
    r => hasAny(r.text, 'week', 'reminder', 'no reminder', 'here') ? true : 'Week reminders not shown');

  await runPrompt('ACTION: Snooze ask',
    'snooze my next reminder by 1 hour',
    r => hasAny(r.text, 'snooze', 'hour', 'reminder', 'no reminder', "don't") ? true : 'Snooze not handled');

  await runPrompt('ACTION: Delete reminders',
    'delete all my test reminders from today',
    r => hasAny(r.text, 'delet', 'remov', 'done', 'no reminder', 'clear') ? true : 'Delete not handled');
}

// ---- CATEGORY: HABITS (12 prompts) ----

async function testHabits() {
  console.log('\n  HABITS (12 prompts)\n');

  await runPrompt('EN: Create water habit',
    'I want to track drinking 8 glasses of water every day',
    r => hasAny(r.text, 'habit', 'water', 'track', 'creat') ? true : 'Habit not created');

  await runPrompt('EN: Log habit',
    'I just finished my morning workout, log it',
    r => hasAny(r.text, 'logged', 'record', 'workout', 'done', 'habit') ? true : 'Habit not logged');

  await runPrompt('EN: Check streak',
    'what is my current streak for meditation?',
    r => hasAny(r.text, 'streak', 'day', 'meditation', 'no habit', "don't") ? true : 'Streak not returned');

  await runPrompt('HI: Create Hinglish',
    'main roz paani peena chahta hoon, iska track karo',
    r => hasAny(r.text, 'habit', 'track', 'water', 'paani', 'creat') ? true : 'Hindi habit not created');

  await runPrompt('HI: Log Hinglish',
    'aaj ka meditation ho gaya, mark kar do',
    r => hasAny(r.text, 'logged', 'done', 'meditation', 'mark', 'habit') ? true : 'Hinglish log not handled');

  await runPrompt('EN: List habits',
    'show me all my habits',
    r => hasAny(r.text, 'habit', 'here are', 'no habit') ? true : 'Habit list not returned');

  await runPrompt('EN: Habit insights',
    'how am I doing with my habits this week?',
    r => hasAny(r.text, 'habit', 'week', 'streak', 'no habit') ? true : 'Insights not returned');

  await runPrompt('EN: Delete habit',
    'remove my water tracking habit',
    r => hasAny(r.text, 'remov', 'delet', 'done', 'water', 'no habit') ? true : 'Habit not deleted');

  await runPrompt('EN: Batch log',
    'I completed all my habits for today',
    r => hasAny(r.text, 'all', 'logged', 'today', 'habit', 'great') ? true : 'Batch log not handled');

  await runPrompt('EDGE: Log for yesterday',
    'I forgot to log my workout habit for yesterday',
    r => hasAny(r.text, 'yesterday', 'logged', 'workout', 'noted', 'habit') ? true : 'Backdated log not handled');

  await runPrompt('SLASH: /habits command',
    '/habits',
    r => hasAny(r.text, 'habit', 'streak', 'no habit') ? true : 'Slash command not handled');

  await runPrompt('EN: Create with time',
    'add a habit to read for 20 minutes every night at 10pm',
    r => hasAny(r.text, 'habit', 'read', 'creat', '10') ? true : 'Timed habit not created');
}

// ---- CATEGORY: MEMORY (10 prompts) ----

async function testMemory() {
  console.log('\n  MEMORY (10 prompts)\n');

  await runPrompt('EN: Store preference',
    'remember that I prefer TypeScript over JavaScript',
    r => hasAny(r.text, 'remember', 'noted', 'saved', 'typescript') ? true : 'Preference not stored');

  await runPrompt('EN: Store person',
    "my manager's name is Priya and she loves data-driven decisions",
    r => hasAny(r.text, 'remember', 'noted', 'priya', 'manager') ? true : 'Person not stored');

  await runPrompt('EN: Store location',
    'I live in Hyderabad, India and work from home',
    r => hasAny(r.text, 'noted', 'hyderabad', 'remember', 'location') ? true : 'Location not stored');

  await runPrompt('HI: Store Hinglish',
    'yaad rakhna ki mujhe chai sirf adrak wali pasand hai',
    r => hasAny(r.text, 'noted', 'chai', 'remember', 'adrak', 'got it') ? true : 'Hindi memory not stored');

  await runPrompt('EN: Retrieve memory',
    'what do you remember about my preferences?',
    r => hasAny(r.text, 'typescript', 'prefer', 'remember', 'recall') ? true : 'Memory not retrieved');

  await runPrompt('EN: Retrieve person',
    'what do you know about Priya?',
    r => hasAny(r.text, 'priya', 'manager', 'remember', 'know') ? true : 'Person memory not retrieved');

  await runPrompt('EN: Ask unknown',
    'what kind of music do I like?',
    r => hasAny(r.text, "don't know", 'no memory', 'music', "haven't", 'not sure', 'tell me') ? true : 'Unknown memory not handled');

  await runPrompt('EN: Store multiple',
    "I'm 28 years old, I work as a product manager, and my hobby is photography",
    r => hasAny(r.text, 'noted', 'remember', '28', 'product', 'photo') ? true : 'Multiple facts not stored');

  await runPrompt('EN: Contextual recall',
    'you know what I said earlier about TypeScript?',
    r => hasAny(r.text, 'typescript', 'javascript', 'prefer', 'mention', 'yes') ? true : 'Contextual recall not working');

  await runPrompt('EN: Forget',
    'forget what I said about Priya',
    r => hasAny(r.text, 'forgot', 'remov', 'delet', 'memory', 'done', 'ok') ? true : 'Memory deletion not handled');
}

// ---- CATEGORY: PERSONALITIES (8 prompts) ----

async function testPersonalities() {
  console.log('\n  PERSONALITIES (8 prompts)\n');

  await runPrompt('WEEBO: Friendly',
    "hey what's up?",
    r => r.text.length > 10 ? true : 'No response',
    { personality: 'weebo' });

  await runPrompt('EDITH: Professional',
    'summarize my recent activity',
    r => r.text.length > 10 ? true : 'No response',
    { personality: 'edith' });

  await runPrompt('JARVIS: Assistant',
    'what can you help me with today?',
    r => r.text.length > 10 ? true : 'No response',
    { personality: 'jarvis' });

  await runPrompt('@NOVA: Named routing',
    '@Nova what are the latest AI trends?',
    r => r.text.length > 10 ? true : 'Named agent not responding');

  await runPrompt('@ARIA: Named routing',
    'hey Aria can you write me a short poem?',
    r => r.text.length > 20 ? true : 'Aria not responding');

  await runPrompt('FORGE: Code review',
    'Forge: review this code snippet: const x = 1 + "1"',
    r => hasAny(r.text, 'string', 'coercion', 'type', 'code', 'concat') ? true : 'Forge not responding');

  await runPrompt('HINGLISH: Auto-detect',
    'yaar mujhe kuch motivate karo aaj ka din acha nahi hai',
    r => r.text.length > 10 ? true : 'Hinglish not handled');

  await runPrompt('STYLE: Concise mode',
    'what is machine learning? (one sentence)',
    r => r.text.length < 500 ? true : 'Concise mode too verbose');
}

// ---- CATEGORY: MULTI-AGENT (6 prompts) ----

async function testMultiAgent() {
  console.log('\n  MULTI-AGENT (6 prompts)\n');

  await runPrompt('LAUNCH: English',
    'launch mode: analyze my productivity and suggest improvements',
    r => r.text.length > 50 ? true : 'Launch mode not activating');

  await runPrompt('LAUNCH: Hinglish',
    'sab agents ko bulao, mera is week ka plan banao',
    r => r.text.length > 50 ? true : 'Hinglish launch mode not triggering');

  await runPrompt('RESEARCH: Web search',
    'search the web for top AI tools in 2026',
    r => hasAny(r.text, '2026', 'ai', 'tool', 'found', 'search', 'here') ? true : 'Web search not triggering');

  await runPrompt('CODE: Analysis',
    'Forge: analyze and improve this function: function add(a,b) { return a+b }',
    r => hasAny(r.text, 'function', 'type', 'typescript', 'improve', 'add') ? true : 'Code analysis not working');

  await runPrompt('COMPLEX: Multi-perspective',
    'should I quit my job to start a startup? give me all perspectives',
    r => r.text.length > 100 ? true : 'Complex question not handled');

  await runPrompt('CROSS-DOMAIN: Trip + reminders',
    'help me plan a trip to Goa AND set reminders for packing',
    r => hasAny(r.text, 'goa', 'remind', 'pack', 'trip', 'plan') ? true : 'Cross-domain not handled');
}

// ---- CATEGORY: CREATIVE (8 prompts) ----

async function testCreative() {
  console.log('\n  CREATIVE (8 prompts)\n');

  await runPrompt('IMAGE: Generate basic',
    'generate an image of a mountain sunset in anime style',
    r => hasAny(r.text, 'generat', 'image', 'anime', 'mountain', 'creat') ? true : 'Image gen not triggered');

  await runPrompt('IMAGE: Hinglish',
    'ek sundar photo banao ek chai ki dukaan barsaat mein',
    r => hasAny(r.text, 'generat', 'image', 'photo', 'chai', 'creat') ? true : 'Hinglish image not working');

  await runPrompt('WRITE: Email draft',
    'write a professional email to my team about the Q2 roadmap delay',
    r => hasAny(r.text, 'subject', 'dear', 'team', 'roadmap', 'delay') ? true : 'Email not drafted');

  await runPrompt('WRITE: Code generation',
    'write a JavaScript function to sort an array of objects by a key',
    r => hasAny(r.text, 'function', 'sort', 'array', 'return') ? true : 'Code not generated');

  await runPrompt('WRITE: Creative poem',
    'write a short 4-line poem about Hyderabad',
    r => hasAny(r.text, 'hyderabad', 'city', 'pearl', 'biryani') ? true : 'Poem not written');

  await runPrompt('WRITE: Translate',
    'translate this to Hindi: Good morning, how are you today?',
    r => r.text.length > 10 ? true : 'Translation not working');

  await runPrompt('WRITE: Tweet composer',
    'write 3 tweet options about launching my AI product next week',
    r => hasAny(r.text, 'tweet', 'launch', '#', '1', 'product') ? true : 'Tweets not composed');

  await runPrompt('WRITE: Summary',
    'summarize: Artificial intelligence has transformed how businesses operate in 2026. Companies now use AI for customer service, content creation, code generation, and decision making. The market is valued at over $500 billion.',
    r => hasAny(r.text, 'ai', 'business', 'billion', 'summar') ? true : 'Summary not generated');
}

// ---- CATEGORY: PROACTIVE / SYSTEM (8 prompts) ----

async function testProactive() {
  console.log('\n  PROACTIVE & SYSTEM (8 prompts)\n');

  await runPrompt('BRIEF: Morning briefing',
    'give me my morning briefing',
    r => hasAny(r.text, 'today', 'reminder', 'habit', 'brief', 'morning', 'good') ? true : 'Briefing not generated');

  await runPrompt('BRIEF: Evening summary',
    'what did I accomplish today?',
    r => hasAny(r.text, 'today', 'accomplish', 'habit', 'reminder', 'nothing', 'so far') ? true : 'Summary not generated');

  await runPrompt('EXPENSE: Track',
    'I spent 500 rupees on food today',
    r => hasAny(r.text, '500', 'expense', 'track', 'food', 'record') ? true : 'Expense not tracked');

  await runPrompt('NOTE: Save',
    'save this as a note: Great product idea - AI meal planner that learns from habits',
    r => hasAny(r.text, 'note', 'saved', 'idea', 'meal', 'creat') ? true : 'Note not saved');

  await runPrompt('NOTE: Retrieve',
    'what notes do I have about product ideas?',
    r => hasAny(r.text, 'note', 'idea', 'found', 'no note', 'meal') ? true : 'Note retrieval not working');

  await runPrompt('FOCUS: Start session',
    'start a 25-minute focus session on writing',
    r => hasAny(r.text, 'focus', '25', 'session', 'writing', 'start') ? true : 'Focus not started');

  await runPrompt('SEARCH: Global',
    '/search doctor',
    r => hasAny(r.text, 'doctor', 'found', 'no result', 'result', 'search') ? true : 'Search not working');

  await runPrompt('HEALTH: Status check',
    'is everything working okay with your systems?',
    r => hasAny(r.text, 'running', 'working', 'ok', 'system', 'health', 'good', 'fine') ? true : 'Health not reported');
}

// ---- MAIN ----

const CATEGORIES = {
  reminders: testReminders,
  habits: testHabits,
  memory: testMemory,
  personalities: testPersonalities,
  multi_agent: testMultiAgent,
  creative: testCreative,
  proactive: testProactive,
};

async function main() {
  console.log('');
  console.log('  ========================================');
  console.log('  AGENTIN LIVE AGENTIC TEST HARNESS v1.0');
  console.log(`  Delay: ${DELAY_MS}ms | Web API only`);
  console.log('  ========================================');
  console.log('');

  await authenticate();

  const toRun = CATEGORY ? [CATEGORY] : Object.keys(CATEGORIES);

  for (const cat of toRun) {
    if (!CATEGORIES[cat]) {
      console.log(`  Unknown category: ${cat}`);
      continue;
    }
    await CATEGORIES[cat]();
  }

  // Final report
  const total = totalPass + totalFail;
  const pct = total > 0 ? Math.round((100 * totalPass) / total) : 0;

  console.log('');
  console.log('  ========================================');
  console.log(`  RESULTS: ${totalPass}/${total} PASS (${pct}%)`);
  console.log('  ========================================');

  if (failures.length > 0) {
    console.log('');
    console.log('  FAILURES:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.label}]`);
      console.log(`     Prompt: "${f.message.slice(0, 80)}"`);
      console.log(`     Error:  ${f.error}`);
      if (f.reply) console.log(`     Got:    "${f.reply.slice(0, 100)}"`);
    });
  }

  // Write report
  const fs = await import('fs');
  const report =
    `# Agentin Live Test Report\n` +
    `${new Date().toISOString()}\n\n` +
    `**Score: ${totalPass}/${total} (${pct}%)**\n\n` +
    `Delay: ${DELAY_MS}ms | Categories: ${toRun.join(', ')}\n\n` +
    (failures.length
      ? `## Failures\n${failures.map(f => `- **${f.label}**: ${f.error}`).join('\n')}\n`
      : 'All tests passed!\n');

  fs.writeFileSync('ops/reports/live-test-report.md', report);
  console.log('');
  console.log('  Report: ops/reports/live-test-report.md');

  if (pct < 80) {
    console.log('  LAUNCH BLOCKED: Pass rate below 80%');
    process.exit(1);
  } else if (pct < 95) {
    console.log('  LAUNCH CAUTION: Pass rate below 95%');
  } else {
    console.log('  LAUNCH READY: 95%+ pass rate');
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
