// One-time script: add srikar, abhi, guest demo accounts to existing DB
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const require = createRequire(import.meta.url);
const Database = require('/root/GeekSpace2.0/server/node_modules/better-sqlite3');
const bcrypt = require('/root/GeekSpace2.0/server/node_modules/bcryptjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
// NOTE: The live server uses /app/data/geekspace.db (Docker volume mount)
// not server/data/geekspace.db (which is the local dev DB)
const dbPath = process.env.DB_PATH || '/app/data/geekspace.db';
const db = new Database(dbPath);

const newPass = bcrypt.hashSync('P@ssw0rd2026', 10);

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, email, username, password_hash, name, avatar, bio, location, website, role, company, tags, plan, credits, onboarding_completed)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAgent = db.prepare(`
  INSERT OR IGNORE INTO agent_configs (id, user_id, name, display_name, mode, voice, system_prompt)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertSub = db.prepare(`
  INSERT OR IGNORE INTO subscriptions (id, user_id, plan, monthly_credits, credits_remaining, credits_used_this_cycle, billing_interval_days, price_usd, price_inr, currency)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertFeature = db.prepare(`
  INSERT OR IGNORE INTO features (user_id, social_discovery, portfolio_chat, automation_builder, website_builder, n8n_integration, manychat_integration)
  VALUES (?, 1, 1, 1, 0, 1, 0)
`);

// Add all three accounts in a transaction
const run = db.transaction(() => {
  // srikar
  insertUser.run('demo-9', 'srikar@geekspace.demo', 'srikar', newPass, 'Srikar', 'SK',
    'Exploring the future of AI-powered productivity.',
    'Hyderabad, IN', '', 'Developer', 'GeekSpace',
    '["AI","Productivity","Full-stack"]', 'monthly', 95000, 1);
  insertAgent.run('agent-9', 'demo-9', 'Nexus', "Srikar's AI", 'builder', 'friendly',
    "You are Srikar's personal AI assistant. You help with coding, productivity, and general tasks.");
  insertSub.run(randomUUID(), 'demo-9', 'monthly', 100000, 95000, 5000, 30, 10, 999, 'INR');
  insertFeature.run('demo-9');

  // abhi
  insertUser.run('demo-10', 'abhi@geekspace.demo', 'abhi', newPass, 'Abhi', 'AB',
    'Building smarter systems one line at a time.',
    'Bangalore, IN', '', 'Engineer', 'GeekSpace',
    '["Backend","Cloud","Python"]', 'monthly', 92000, 1);
  insertAgent.run('agent-10', 'demo-10', 'Pulse', "Abhi's AI", 'builder', 'friendly',
    "You are Abhi's personal AI assistant. You help with engineering, cloud, and general tasks.");
  insertSub.run(randomUUID(), 'demo-10', 'monthly', 100000, 92000, 8000, 30, 10, 999, 'INR');
  insertFeature.run('demo-10');

  // guest
  insertUser.run('demo-11', 'guest@geekspace.demo', 'guest', newPass, 'Guest', 'GU',
    'Exploring GeekSpace as a guest.',
    '', '', 'Guest', '',
    '[]', 'free', 5000, 1);
  insertAgent.run('agent-11', 'demo-11', 'Scout', 'Guest AI', 'minimal', 'friendly',
    "You are a helpful AI assistant for a GeekSpace guest user.");
  insertSub.run(randomUUID(), 'demo-11', 'free', 5000, 5000, 0, 30, 0, 0, 'USD');
  insertFeature.run('demo-11');
});

run();
db.close();

console.log('Done! Added accounts: srikar, abhi, guest');
console.log('Password for all: P@ssw0rd2026');
console.log('Emails: srikar@geekspace.demo, abhi@geekspace.demo, guest@geekspace.demo');
