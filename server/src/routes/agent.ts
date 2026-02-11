import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const agentRouter = Router();

const agentConfig = {
  id: 'agent-1',
  userId: 'demo-1',
  name: 'Geek',
  displayName: "Alex's AI",
  mode: 'builder',
  voice: 'friendly',
  systemPrompt: "You are Alex's personal AI assistant.",
  primaryModel: 'geekspace-default',
  fallbackModel: 'ollama-qwen2.5',
  creativity: 70,
  formality: 50,
  monthlyBudgetUSD: 5,
  status: 'online',
};

agentRouter.get('/config', requireAuth, (_req, res) => {
  res.json(agentConfig);
});

agentRouter.patch('/config', requireAuth, (req, res) => {
  Object.assign(agentConfig, req.body);
  res.json(agentConfig);
});

agentRouter.post('/chat', requireAuth, (req, res) => {
  const { message } = req.body;
  // Stub: In production, this calls OpenClaw
  const replies = [
    "I've noted that down. Anything else you need?",
    "Sure, I can help with that! Let me check...",
    "Based on your schedule, you have a free slot at 3 PM.",
    "Your current spend this month is $3.20. You're within budget.",
  ];
  res.json({
    reply: replies[Math.floor(Math.random() * replies.length)],
    toolsUsed: message.includes('remind') ? ['reminders.create'] : [],
  });
});

agentRouter.post('/command', requireAuth, (req, res) => {
  const { command } = req.body;
  const cmd = (command as string).trim().toLowerCase();

  const responses: Record<string, string> = {
    'gs me': 'Name: Alex Chen\nUsername: alex\nEmail: alex@example.com\nPlan: Pro ($50/year)\nCredits: 12,450\nAgent Style: Builder\nJoined: 2026-01-15',
    'gs reminders list': 'ID  | Reminder                    | When\n--- | --------------------------- | ------------------\n1   | Call mom                    | Feb 12, 09:00 AM\n2   | Submit project report       | Feb 12, 05:00 PM (weekly)\n3   | Pay rent                    | Feb 15, 09:00 AM (monthly)',
    'gs schedule today': "Today's Schedule (Feb 11, 2026):\n\n10:00 AM - Team Standup\n02:00 PM - Client Meeting\n04:00 PM - Code Review",
    'gs schedule tomorrow': "Tomorrow's Schedule (Feb 12, 2026):\n\n09:00 AM - Call mom (reminder)\n10:00 AM - Product Planning\n02:00 PM - Design Review\n05:00 PM - Submit project report (reminder)",
    'gs portfolio': 'Opening portfolio... https://alex.geekspace.space',
    'gs status': 'Agent Status: Online\nModel: OpenClaw v2.1\nResponse Time: ~1.2s\nUptime: 99.99%\nLast Activity: 2 minutes ago',
    'gs credits': 'Credit Balance: 12,450\nMonthly Allowance: 15,000\nResets: Mar 1, 2026\n\nUsage this month:\n- API calls: 8,432\n- Messages: 1,247\n- Reminders: 89',
    'usage today': 'Today\'s Usage:\n  Messages: 47\n  API Calls: 234\n  Tokens: 12,400 in / 4,300 out\n  Cost: $0.12',
    'usage month': 'This Month:\n  Total Cost: $3.20\n  Forecast: ~$4.10\n  By Provider:\n    OpenAI: $1.80\n    Qwen: $0.90\n    Anthropic: $0.50',
    'integrations list': 'Connected:\n  Telegram     - 98% health - 124 req today\n  Calendar     - 100% health - 56 req today\nPaused:\n  Location     - Paused\nDisconnected:\n  GitHub, Twitter/X, LinkedIn',
    'automations list': 'No automations configured yet.\nUse: automations create <name>',
    'portfolio publish': 'Portfolio published at alex.geekspace.space\nLast updated: just now',
  };

  if (responses[cmd]) {
    res.json({ output: responses[cmd], isError: false });
  } else if (cmd.startsWith('ai ')) {
    const query = cmd.slice(3);
    res.json({ output: `Agent thinking about: "${query}"...\nDone! I've processed your request.`, isError: false });
  } else if (cmd.startsWith('gs reminders add')) {
    res.json({ output: 'Reminder added successfully! ID: ' + Date.now(), isError: false });
  } else if (cmd.startsWith('automations trigger')) {
    res.json({ output: 'Automation triggered successfully.', isError: false });
  } else {
    res.json({ output: `Command not found: ${command}\nType 'help' to see available commands.`, isError: true });
  }
});
