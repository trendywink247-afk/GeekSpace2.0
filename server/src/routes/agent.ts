import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const agentRouter = Router();

agentRouter.get('/config', requireAuth, (req: AuthRequest, res) => {
  const config = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!config) { res.status(404).json({ error: 'Agent config not found' }); return; }
  res.json(config);
});

agentRouter.patch('/config', requireAuth, (req: AuthRequest, res) => {
  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  const allowedFields: Record<string, string> = {
    name: 'name', displayName: 'display_name', mode: 'mode', voice: 'voice',
    systemPrompt: 'system_prompt', primaryModel: 'primary_model', fallbackModel: 'fallback_model',
    creativity: 'creativity', formality: 'formality', responseSpeed: 'response_speed',
    monthlyBudgetUSD: 'monthly_budget_usd', avatarEmoji: 'avatar_emoji',
    accentColor: 'accent_color', bubbleStyle: 'bubble_style', status: 'status',
  };

  for (const [key, col] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) { fields.push(`${col} = ?`); values.push(updates[key]); }
  }

  if (fields.length) { values.push(req.userId); db.prepare(`UPDATE agent_configs SET ${fields.join(', ')} WHERE user_id = ?`).run(...values); }

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Updated agent config', ?, 'bot')`).run(uuid(), req.userId, `Changed: ${Object.keys(updates).join(', ')}`);

  const config = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!);
  res.json(config);
});

agentRouter.post('/chat', requireAuth, (req: AuthRequest, res) => {
  const { message } = req.body;
  const userId = req.userId!;

  const apiKey = db.prepare('SELECT * FROM api_keys WHERE user_id = ? AND is_default = 1').get(userId) as Record<string, unknown> | undefined;
  const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  const agentVoice = agentConfig?.voice || 'friendly';
  let reply: string;

  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('remind') || lowerMsg.includes('reminder')) {
    reply = `I can help with reminders! You can create one from the Reminders page, or tell me what you'd like to be reminded about and when.`;
  } else if (lowerMsg.includes('schedule') || lowerMsg.includes('calendar')) {
    const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ? AND completed = 0 ORDER BY datetime ASC LIMIT 5').all(userId) as Record<string, unknown>[];
    reply = reminders.length
      ? `Here's your upcoming schedule:\n${reminders.map((r, i) => `${i + 1}. ${r.text} — ${r.datetime}`).join('\n')}`
      : `Your schedule looks clear! No upcoming reminders set.`;
  } else if (lowerMsg.includes('usage') || lowerMsg.includes('cost') || lowerMsg.includes('spend')) {
    const usage = db.prepare('SELECT SUM(cost_usd) as total, COUNT(*) as calls FROM usage_events WHERE user_id = ?').get(userId) as Record<string, unknown>;
    reply = `Your usage this period: ${(usage.calls as number) || 0} API calls, total cost: $${((usage.total as number) || 0).toFixed(2)}.`;
  } else if (lowerMsg.includes('integration') || lowerMsg.includes('connect')) {
    const connected = db.prepare("SELECT name FROM integrations WHERE user_id = ? AND status = 'connected'").all(userId) as Record<string, unknown>[];
    reply = connected.length
      ? `You have ${connected.length} active integrations: ${connected.map(i => i.name).join(', ')}. Need help connecting more?`
      : `No integrations connected yet. Head to the Connections page to set some up!`;
  } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    reply = agentVoice === 'witty'
      ? `Hey ${user?.name || 'there'}! Your friendly neighborhood ${agentConfig?.name || 'Geek'} at your service. What can I do for you?`
      : agentVoice === 'professional'
      ? `Hello ${user?.name || 'there'}. How may I assist you today?`
      : `Hey ${user?.name || 'there'}! What's on your mind?`;
  } else if (lowerMsg.includes('help')) {
    reply = `Here's what I can help with:\n- Check your schedule and reminders\n- Look up your usage and costs\n- Manage integrations\n- Answer questions about your portfolio\n- General assistance\n\nJust ask!`;
  } else {
    const replies = [
      `That's a great question! Based on your profile, I'd suggest checking out the relevant section in your dashboard.`,
      `I've noted that down. Is there anything else you'd like help with?`,
      `Interesting! I can help you explore that further. Would you like me to look into specific details?`,
      `Got it! I'll keep that in mind. Let me know if you need anything else.`,
    ];
    reply = replies[Math.floor(Math.random() * replies.length)];
  }

  db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool) VALUES (?, ?, 'geekspace', 'built-in', ?, ?, 0, 'web', 'ai.chat')`).run(
    uuid(), userId, message.length, reply.length
  );

  res.json({
    reply,
    toolsUsed: lowerMsg.includes('remind') ? ['reminders.create'] : [],
    model: apiKey ? 'user-configured' : 'built-in',
    note: apiKey ? undefined : 'Add an API key in Settings to unlock full AI capabilities.',
  });
});

agentRouter.post('/command', requireAuth, (req: AuthRequest, res) => {
  const { command } = req.body;
  const cmd = (command as string).trim().toLowerCase();
  const userId = req.userId!;

  if (cmd === 'gs me') {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    if (user) {
      res.json({ output: `Name: ${user.name}\nUsername: ${user.username}\nEmail: ${user.email}\nPlan: ${(user.plan as string).charAt(0).toUpperCase() + (user.plan as string).slice(1)}\nCredits: ${user.credits}\nJoined: ${user.created_at}`, isError: false });
      return;
    }
  }

  if (cmd === 'gs reminders list') {
    const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY datetime ASC').all(userId) as Record<string, unknown>[];
    if (!reminders.length) { res.json({ output: 'No reminders set. Use: gs reminders add "text"', isError: false }); return; }
    const table = 'ID  | Reminder                    | When\n--- | --------------------------- | ------------------\n' +
      reminders.map(r => `${(r.id as string).slice(0, 4)} | ${(r.text as string).padEnd(27)} | ${r.datetime || 'no date'}${r.completed ? ' done' : ''}`).join('\n');
    res.json({ output: table, isError: false });
    return;
  }

  if (cmd.startsWith('gs reminders add ')) {
    const text = cmd.slice(17).replace(/^["']|["']$/g, '');
    const id = uuid();
    db.prepare('INSERT INTO reminders (id, user_id, text, channel, category, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(id, userId, text, 'push', 'general', 'terminal');
    db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`).run(uuid(), userId, text);
    res.json({ output: `Reminder added! ID: ${id.slice(0, 8)}\nText: ${text}`, isError: false });
    return;
  }

  if (cmd === 'gs credits') {
    const user = db.prepare('SELECT credits, plan FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    const usage = db.prepare('SELECT COUNT(*) as calls, SUM(cost_usd) as cost FROM usage_events WHERE user_id = ?').get(userId) as Record<string, unknown>;
    res.json({ output: `Credit Balance: ${user?.credits || 0}\nPlan: ${user?.plan || 'free'}\n\nUsage:\n- API Calls: ${usage?.calls || 0}\n- Total Cost: $${((usage?.cost as number) || 0).toFixed(2)}`, isError: false });
    return;
  }

  if (cmd === 'gs usage today') {
    const usage = db.prepare("SELECT COUNT(*) as calls, SUM(tokens_in) as tin, SUM(tokens_out) as tout, SUM(cost_usd) as cost FROM usage_events WHERE user_id = ? AND date(created_at) = date('now')").get(userId) as Record<string, unknown>;
    res.json({ output: `Today's Usage:\n  API Calls: ${usage?.calls || 0}\n  Tokens: ${usage?.tin || 0} in / ${usage?.tout || 0} out\n  Cost: $${((usage?.cost as number) || 0).toFixed(4)}`, isError: false });
    return;
  }

  if (cmd === 'gs usage month') {
    const usage = db.prepare("SELECT provider, COUNT(*) as calls, SUM(cost_usd) as cost FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-30 days') GROUP BY provider").all(userId) as Record<string, unknown>[];
    const total = db.prepare("SELECT SUM(cost_usd) as cost FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-30 days')").get(userId) as Record<string, unknown>;
    const lines = ['This Month:', `  Total Cost: $${((total?.cost as number) || 0).toFixed(2)}`, '  By Provider:'];
    for (const row of usage) lines.push(`    ${row.provider}: $${((row.cost as number) || 0).toFixed(2)} (${row.calls} calls)`);
    res.json({ output: lines.join('\n'), isError: false });
    return;
  }

  if (cmd === 'gs integrations') {
    const integrations = db.prepare('SELECT name, status, health, requests_today FROM integrations WHERE user_id = ?').all(userId) as Record<string, unknown>[];
    const lines = integrations.map(i => `  ${(i.name as string).padEnd(16)} - ${i.status}${i.status === 'connected' ? ` (${i.health}% health, ${i.requests_today} req today)` : ''}`);
    res.json({ output: `Integrations:\n${lines.join('\n')}`, isError: false });
    return;
  }

  if (cmd === 'gs automations') {
    const automations = db.prepare('SELECT name, trigger_type, enabled, run_count FROM automations WHERE user_id = ?').all(userId) as Record<string, unknown>[];
    if (!automations.length) { res.json({ output: 'No automations configured yet.\nUse the Automations page to create one.', isError: false }); return; }
    const lines = automations.map(a => `  ${a.name} [${a.enabled ? 'ON' : 'OFF'}] trigger: ${a.trigger_type}, runs: ${a.run_count}`);
    res.json({ output: `Automations:\n${lines.join('\n')}`, isError: false });
    return;
  }

  if (cmd === 'gs status') {
    const agent = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown>;
    res.json({ output: `Agent Status: ${agent?.status || 'unknown'}\nName: ${agent?.name || 'Geek'}\nMode: ${agent?.mode || 'builder'}\nVoice: ${agent?.voice || 'friendly'}\nModel: ${agent?.primary_model || 'default'}`, isError: false });
    return;
  }

  if (cmd === 'gs portfolio') {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    res.json({ output: `Portfolio: /portfolio/${user?.username || 'you'}`, isError: false });
    return;
  }

  if (cmd === 'gs deploy') {
    db.prepare('UPDATE portfolios SET is_public = 1 WHERE user_id = ?').run(userId);
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Deployed portfolio', 'Public', 'globe')`).run(uuid(), userId);
    res.json({ output: `Portfolio deployed!\nLive at: /portfolio/${user?.username || 'you'}`, isError: false });
    return;
  }

  if (cmd.startsWith('gs connect ')) {
    const svc = cmd.slice(11).trim();
    const integration = db.prepare('SELECT * FROM integrations WHERE user_id = ? AND (LOWER(type) = ? OR LOWER(name) = ?)').get(userId, svc, svc) as Record<string, unknown> | undefined;
    if (integration) {
      db.prepare("UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE id = ?").run(new Date().toISOString(), integration.id);
      db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Connected', ?, 'link')`).run(uuid(), userId, integration.name);
      res.json({ output: `Connected ${integration.name}! Health: 100%`, isError: false });
    } else { res.json({ output: `Integration "${svc}" not found.`, isError: true }); }
    return;
  }

  if (cmd.startsWith('gs disconnect ')) {
    const svc = cmd.slice(14).trim();
    const integration = db.prepare('SELECT * FROM integrations WHERE user_id = ? AND (LOWER(type) = ? OR LOWER(name) = ?)').get(userId, svc, svc) as Record<string, unknown> | undefined;
    if (integration) {
      db.prepare("UPDATE integrations SET status = 'disconnected', health = 0 WHERE id = ?").run(integration.id);
      res.json({ output: `Disconnected ${integration.name}.`, isError: false });
    } else { res.json({ output: `Integration "${svc}" not found.`, isError: true }); }
    return;
  }

  if (cmd.startsWith('gs profile set ')) {
    const parts = cmd.slice(15).split(' ');
    const field = parts[0];
    const value = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');
    const allowed = ['name', 'bio', 'location', 'website', 'role', 'company'];
    if (allowed.includes(field)) {
      db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(value, userId);
      res.json({ output: `Updated ${field} to: ${value}`, isError: false });
    } else { res.json({ output: `Unknown field: ${field}. Allowed: ${allowed.join(', ')}`, isError: true }); }
    return;
  }

  if (cmd === 'gs export') {
    const user = db.prepare('SELECT id, email, username, name, bio, location, plan, credits, created_at FROM users WHERE id = ?').get(userId);
    const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ?').all(userId);
    const integrations = db.prepare('SELECT * FROM integrations WHERE user_id = ?').all(userId);
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId);
    res.json({ output: JSON.stringify({ user, reminders, integrations, portfolio }, null, 2), isError: false });
    return;
  }

  if (cmd.startsWith('ai ')) {
    const query = cmd.slice(3).replace(/^["']|["']$/g, '');
    const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown>;
    const replies = [
      `Based on your data, here's what I found regarding "${query}".`,
      `I've analyzed your request about "${query}". Let me know if you'd like more details.`,
      `Regarding "${query}" - I've processed this. Would you like me to elaborate?`,
    ];
    db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool) VALUES (?, ?, 'geekspace', 'built-in', ?, ?, 0, 'terminal', 'ai.chat')`).run(uuid(), userId, query.length, 100);
    res.json({ output: `[${agentConfig?.name || 'Geek'}] ${replies[Math.floor(Math.random() * replies.length)]}`, isError: false });
    return;
  }

  if (cmd === 'help') {
    res.json({ output: `GeekSpace Terminal Commands:\n  gs me                     Show your profile\n  gs reminders list         List reminders\n  gs reminders add "text"   Create a reminder\n  gs credits                Check credit balance\n  gs usage today|month      Usage reports\n  gs integrations           List integrations\n  gs connect <service>      Connect integration\n  gs disconnect <service>   Disconnect integration\n  gs automations            List automations\n  gs status                 Agent status\n  gs portfolio              Portfolio URL\n  gs deploy                 Deploy portfolio\n  gs profile set <f> <v>    Update profile field\n  gs export                 Export all data as JSON\n  ai "prompt"               Ask your AI agent\n  clear                     Clear terminal\n  help                      Show this help`, isError: false });
    return;
  }

  if (cmd === 'clear') { res.json({ output: '', isError: false, clear: true }); return; }

  res.json({ output: `Command not found: ${command}\nType 'help' to see available commands.`, isError: true });
});

// Public chat for portfolio visitors
agentRouter.post('/chat/public/:username', (req, res) => {
  const { message } = req.body;
  const { username } = req.params;

  const user = db.prepare('SELECT id, name FROM users WHERE username = ?').get(username) as Record<string, unknown> | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(user.id as string) as Record<string, unknown> | undefined;
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(user.id as string) as Record<string, unknown> | undefined;
  const skills = JSON.parse(portfolio?.skills as string || '[]');
  const ownerName = user.name as string;
  const agentName = (agentConfig?.name || 'Assistant') as string;

  const lowerMsg = message.toLowerCase();
  let reply: string;

  if (lowerMsg.includes('skill') || lowerMsg.includes('tech') || lowerMsg.includes('stack')) {
    reply = `${ownerName} works with: ${skills.join(', ')}.`;
  } else if (lowerMsg.includes('project') || lowerMsg.includes('work')) {
    const projects = JSON.parse(portfolio?.projects as string || '[]');
    reply = projects.length
      ? `${ownerName} has ${projects.length} projects: ${projects.map((p: Record<string, unknown>) => p.name).join(', ')}.`
      : `${ownerName} hasn't published any projects yet.`;
  } else if (lowerMsg.includes('contact') || lowerMsg.includes('reach') || lowerMsg.includes('email')) {
    const social = JSON.parse(portfolio?.social as string || '{}');
    reply = social.email ? `You can reach ${ownerName} at ${social.email}.` : `Contact info isn't publicly available.`;
  } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
    reply = `Hey! I'm ${agentName}, ${ownerName}'s AI assistant. Ask me about their skills, projects, or how to get in touch.`;
  } else {
    const replies = [
      `${ownerName} specializes in ${skills.slice(0, 3).join(', ')}. Want to know more?`,
      `I can tell you about ${ownerName}'s projects, skills, or how to get in touch.`,
      `Interesting question! Let me think about how ${ownerName}'s work relates to that...`,
    ];
    reply = replies[Math.floor(Math.random() * replies.length)];
  }

  res.json({ reply, agentName, ownerName });
});
