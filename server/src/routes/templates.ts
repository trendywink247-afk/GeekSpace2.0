// ============================================================
// Templates API — Pre-made Website Templates
//
// Official and community templates that users can clone to
// quickly start new projects.
// ============================================================

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';

export const templatesRouter = Router();

// ---- Get all templates (public) ----
templatesRouter.get('/', (req, res) => {
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const officialOnly = req.query.official === 'true';
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);

  let query = 'SELECT * FROM templates WHERE 1=1';
  const params: unknown[] = [];

  if (officialOnly) {
    query += ' AND is_official = 1';
  }

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY is_official DESC, clone_count DESC, created_at DESC LIMIT ?';
  params.push(limit);

  const templates = db.prepare(query).all(...params) as Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    thumbnail: string;
    is_official: number;
    clone_count: number;
    created_at: string;
  }>;

  res.json({
    templates: templates.map(t => ({
      ...t,
      thumbnail: t.thumbnail || '/template-placeholder.svg',
    })),
  });
});

// ---- Get single template (public) ----
templatesRouter.get('/:id', (req, res) => {
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as {
    id: string;
    name: string;
    description: string;
    category: string;
    thumbnail: string;
    html: string;
    css: string;
    js: string;
    is_official: number;
    created_by: string;
    clone_count: number;
    created_at: string;
  } | undefined;

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  res.json({
    ...template,
    thumbnail: template.thumbnail || '/template-placeholder.svg',
  });
});

// ---- Clone template to user's artifacts (auth required) ----
templatesRouter.post('/:id/clone', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { title } = req.body as { title?: string };

  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as {
    id: string;
    name: string;
    html: string;
    css: string;
    js: string;
  } | undefined;

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  // Create new artifact from template
  const artifactId = uuid();
  const artifactTitle = title || `${template.name} (Copy)`;

  db.prepare(`
    INSERT INTO generated_artifacts (id, user_id, type, title, html, css, js, metadata)
    VALUES (?, ?, 'code', ?, ?, ?, ?, ?)
  `).run(
    artifactId,
    userId,
    artifactTitle,
    template.html,
    template.css,
    template.js,
    JSON.stringify({ cloned_from: template.id })
  );

  // Update clone count
  db.prepare('UPDATE templates SET clone_count = clone_count + 1 WHERE id = ?').run(template.id);

  // Log activity
  db.prepare(`
    INSERT INTO activity_log (id, user_id, action, details, icon)
    VALUES (?, ?, 'Cloned template', ?, 'copy')
  `).run(uuid(), userId, `Cloned "${template.name}" to "${artifactTitle}"`);

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  logger.info({ userId, templateId: template.id, artifactId }, 'Template cloned');

  res.json({
    success: true,
    artifactId,
    title: artifactTitle,
    previewUrl: `${baseUrl}/preview/${userId}/${artifactId}`,
    message: `Created "${artifactTitle}" from template`,
  });
});

// ---- Create template (admin only) ----
templatesRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Check if user is admin (you may want to add proper admin check)
  const isAdmin = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as { plan: string } | undefined;
  if (!isAdmin || (isAdmin.plan !== 'yearly' && isAdmin.plan !== 'halfyear')) {
    // For now, allow any paid user to create templates
    // In production, add proper admin role check
  }

  const { name, description, category, thumbnail, html, css, js, isOfficial } = req.body as {
    name: string;
    description?: string;
    category?: string;
    thumbnail?: string;
    html?: string;
    css?: string;
    js?: string;
    isOfficial?: boolean;
  };

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const templateId = uuid();
  db.prepare(`
    INSERT INTO templates (id, name, description, category, thumbnail, html, css, js, is_official, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    templateId,
    name,
    description || '',
    category || 'other',
    thumbnail || '',
    html || '',
    css || '',
    js || '',
    isOfficial ? 1 : 0,
    userId
  );

  logger.info({ userId, templateId }, 'Template created');

  res.status(201).json({
    success: true,
    templateId,
    message: `Template "${name}" created`,
  });
});

// ---- Get categories ----
templatesRouter.get('/categories/list', (_req, res) => {
  const categories = [
    { id: 'portfolio', name: 'Portfolio', icon: 'briefcase' },
    { id: 'landing', name: 'Landing Page', icon: 'rocket' },
    { id: 'dashboard', name: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'blog', name: 'Blog', icon: 'file-text' },
    { id: 'ecommerce', name: 'E-commerce', icon: 'shopping-cart' },
    { id: 'personal', name: 'Personal', icon: 'user' },
    { id: 'business', name: 'Business', icon: 'building' },
    { id: 'other', name: 'Other', icon: 'folder' },
  ];

  res.json({ categories });
});

// ---- Seed / upsert default templates ----
export function seedDefaultTemplates(): void {

  const templates = [
    {
      id: 'tpl-minimal-portfolio',
      name: 'Minimal Portfolio',
      description: 'Clean, minimal portfolio with focus on your work',
      category: 'portfolio',
      thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%237B61FF'/%3E%3Cstop offset='1' stop-color='%2300D9FF'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='%231a1a2e' width='400' height='225'/%3E%3Crect x='30' y='30' width='120' height='12' rx='6' fill='url(%23g)' opacity='.8'/%3E%3Crect x='30' y='55' width='200' height='8' rx='4' fill='%23333'/%3E%3Crect x='30' y='90' width='100' height='100' rx='8' fill='%23222'/%3E%3Crect x='145' y='90' width='100' height='100' rx='8' fill='%23222'/%3E%3Crect x='260' y='90' width='100' height='100' rx='8' fill='%23222'/%3E%3C/svg%3E",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Portfolio</title>
</head>
<body>
  <header>
    <h1>Hello, I'm <span class="accent">Creator</span></h1>
    <p class="tagline">Designer & Developer</p>
  </header>
  <main>
    <section class="about">
      <h2>About</h2>
      <p>I create beautiful digital experiences.</p>
    </section>
    <section class="work">
      <h2>Work</h2>
      <div class="projects">
        <div class="project">Project 1</div>
        <div class="project">Project 2</div>
        <div class="project">Project 3</div>
      </div>
    </section>
  </main>
  <footer>
    <p>© 2026</p>
  </footer>
</body>
</html>`,
      css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}
header { margin-bottom: 60px; }
h1 { font-size: 3rem; margin-bottom: 10px; }
.accent { color: #7B61FF; }
.tagline { font-size: 1.25rem; color: #666; }
section { margin-bottom: 40px; }
h2 { margin-bottom: 20px; font-size: 1.5rem; }
.projects { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
.project {
  background: #f5f5f5;
  padding: 40px 20px;
  text-align: center;
  border-radius: 8px;
  transition: transform 0.2s;
}
.project:hover { transform: translateY(-4px); }
footer { margin-top: 60px; text-align: center; color: #999; }`,
      js: `// Minimal portfolio - no JS needed
console.log('Portfolio loaded');`,
    },
    {
      id: 'tpl-coming-soon',
      name: 'Coming Soon',
      description: 'Animated coming soon page with countdown',
      category: 'landing',
      thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%231a1a2e'/%3E%3Cstop offset='1' stop-color='%2316213e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='400' height='225'/%3E%3Crect x='100' y='40' width='200' height='16' rx='8' fill='%237B61FF' opacity='.9'/%3E%3Crect x='120' y='70' width='160' height='8' rx='4' fill='%23555'/%3E%3Crect x='80' y='100' width='55' height='50' rx='8' fill='%23222'/%3E%3Crect x='145' y='100' width='55' height='50' rx='8' fill='%23222'/%3E%3Crect x='210' y='100' width='55' height='50' rx='8' fill='%23222'/%3E%3Crect x='275' y='100' width='55' height='50' rx='8' fill='%23222'/%3E%3Crect x='110' y='175' width='130' height='30' rx='8' fill='%237B61FF' opacity='.4'/%3E%3C/svg%3E",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coming Soon</title>
</head>
<body>
  <div class="container">
    <h1>Coming Soon</h1>
    <p class="subtitle">Something amazing is in the works</p>
    <div class="countdown">
      <div class="time">
        <span id="days">00</span>
        <label>Days</label>
      </div>
      <div class="time">
        <span id="hours">00</span>
        <label>Hours</label>
      </div>
      <div class="time">
        <span id="minutes">00</span>
        <label>Minutes</label>
      </div>
      <div class="time">
        <span id="seconds">00</span>
        <label>Seconds</label>
      </div>
    </div>
    <form class="notify">
      <input type="email" placeholder="Enter your email" required>
      <button type="submit">Notify Me</button>
    </form>
  </div>
</body>
</html>`,
      css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}
.container { text-align: center; padding: 40px; }
h1 { font-size: 4rem; margin-bottom: 10px; background: linear-gradient(90deg, #7B61FF, #00D9FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { font-size: 1.25rem; color: #888; margin-bottom: 40px; }
.countdown { display: flex; gap: 30px; justify-content: center; margin-bottom: 40px; }
.time { text-align: center; }
.time span { display: block; font-size: 3rem; font-weight: bold; font-variant-numeric: tabular-nums; }
.time label { font-size: 0.875rem; color: #888; text-transform: uppercase; }
.notify { display: flex; gap: 10px; justify-content: center; max-width: 400px; margin: 0 auto; }
.notify input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #333;
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  color: #fff;
  font-size: 1rem;
}
.notify button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: #7B61FF;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}
.notify button:hover { background: #6344FF; }`,
      js: `// Countdown to 30 days from now
const target = new Date();
target.setDate(target.getDate() + 30);

function updateCountdown() {
  const now = new Date().getTime();
  const diff = target - now;

  document.getElementById('days').textContent = String(Math.floor(diff / (1000 * 60 * 60 * 24))).padStart(2, '0');
  document.getElementById('hours').textContent = String(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0');
  document.getElementById('minutes').textContent = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
  document.getElementById('seconds').textContent = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');
}

setInterval(updateCountdown, 1000);
updateCountdown();

// Form handling
document.querySelector('.notify').addEventListener('submit', (e) => {
  e.preventDefault();
  alert('Thanks! We will notify you when we launch.');
});`,
    },
    {
      id: 'tpl-dashboard',
      name: 'Simple Dashboard',
      description: 'Clean admin dashboard with stats and charts',
      category: 'dashboard',
      thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Crect fill='%23f5f5f5' width='400' height='225'/%3E%3Crect fill='%231a1a2e' width='80' height='225'/%3E%3Crect x='10' y='20' width='60' height='10' rx='5' fill='%237B61FF' opacity='.6'/%3E%3Crect x='10' y='45' width='55' height='6' rx='3' fill='%23444'/%3E%3Crect x='10' y='60' width='55' height='6' rx='3' fill='%23444'/%3E%3Crect x='10' y='75' width='55' height='6' rx='3' fill='%23444'/%3E%3Crect x='100' y='20' width='130' height='70' rx='8' fill='%23fff' stroke='%23eee' stroke-width='1'/%3E%3Crect x='250' y='20' width='130' height='70' rx='8' fill='%23fff' stroke='%23eee' stroke-width='1'/%3E%3Crect x='100' y='110' width='130' height='70' rx='8' fill='%23fff' stroke='%23eee' stroke-width='1'/%3E%3Crect x='250' y='110' width='130' height='70' rx='8' fill='%23fff' stroke='%23eee' stroke-width='1'/%3E%3C/svg%3E",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
</head>
<body>
  <div class="dashboard">
    <aside class="sidebar">
      <h2>Dashboard</h2>
      <nav>
        <a href="#" class="active">Overview</a>
        <a href="#">Analytics</a>
        <a href="#">Users</a>
        <a href="#">Settings</a>
      </nav>
    </aside>
    <main>
      <header>
        <h1>Overview</h1>
        <div class="user">Admin</div>
      </header>
      <div class="stats">
        <div class="stat-card">
          <h3>Total Users</h3>
          <p class="value">1,234</p>
          <span class="change positive">+12%</span>
        </div>
        <div class="stat-card">
          <h3>Revenue</h3>
          <p class="value">$12,345</p>
          <span class="change positive">+8%</span>
        </div>
        <div class="stat-card">
          <h3>Orders</h3>
          <p class="value">567</p>
          <span class="change negative">-3%</span>
        </div>
        <div class="stat-card">
          <h3>Active Now</h3>
          <p class="value">89</p>
          <span class="change positive">+23%</span>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`,
      css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}
.dashboard { display: flex; min-height: 100vh; }
.sidebar {
  width: 240px;
  background: #1a1a2e;
  color: #fff;
  padding: 24px;
}
.sidebar h2 { margin-bottom: 24px; font-size: 1.5rem; }
.sidebar nav { display: flex; flex-direction: column; gap: 8px; }
.sidebar a {
  padding: 12px 16px;
  color: #888;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s;
}
.sidebar a:hover, .sidebar a.active { background: rgba(123, 97, 255, 0.2); color: #7B61FF; }
main { flex: 1; padding: 24px; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
header h1 { font-size: 1.75rem; }
.user {
  padding: 8px 16px;
  background: #fff;
  border-radius: 20px;
  font-size: 0.875rem;
}
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.stat-card {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.stat-card h3 { font-size: 0.875rem; color: #666; margin-bottom: 8px; }
.stat-card .value { font-size: 2rem; font-weight: bold; margin-bottom: 8px; }
.change { font-size: 0.875rem; font-weight: 500; }
.change.positive { color: #10b981; }
.change.negative { color: #ef4444; }`,
      js: `// Dashboard interactivity
console.log('Dashboard loaded');

// Simulate real-time updates
setInterval(() => {
  const activeUsers = document.querySelector('.stat-card:last-child .value');
  if (activeUsers) {
    const current = parseInt(activeUsers.textContent.replace(',', ''));
    const change = Math.floor(Math.random() * 5) - 2;
    activeUsers.textContent = (current + change).toLocaleString();
  }
}, 5000);`,
    },
    {
      id: 'tpl-blog-starter',
      name: 'Blog Starter',
      description: 'Minimal blog layout with responsive typography and dark theme',
      category: 'blog',
      thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Crect fill='%230d1117' width='400' height='225'/%3E%3Crect x='60' y='25' width='280' height='14' rx='7' fill='%2358a6ff' opacity='.7'/%3E%3Crect x='80' y='55' width='240' height='6' rx='3' fill='%23333'/%3E%3Crect x='60' y='80' width='280' height='90' rx='8' fill='%23161b22'/%3E%3Crect x='75' y='95' width='180' height='8' rx='4' fill='%23444'/%3E%3Crect x='75' y='112' width='250' height='5' rx='2' fill='%23333'/%3E%3Crect x='75' y='124' width='230' height='5' rx='2' fill='%23333'/%3E%3Crect x='75' y='136' width='200' height='5' rx='2' fill='%23333'/%3E%3Crect x='75' y='152' width='60' height='8' rx='4' fill='%2358a6ff' opacity='.5'/%3E%3C/svg%3E",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Blog</title>
</head>
<body>
  <header>
    <h1>My Blog</h1>
    <p class="subtitle">Thoughts on code, design, and everything in between</p>
  </header>
  <main>
    <article>
      <span class="date">Feb 20, 2026</span>
      <h2>Getting Started with Web Development</h2>
      <p>The web platform has never been more powerful. With modern CSS, vanilla JavaScript, and the right tools, you can build incredible things without heavy frameworks...</p>
      <a href="#" class="read-more">Read more &rarr;</a>
    </article>
    <article>
      <span class="date">Feb 15, 2026</span>
      <h2>Design Principles That Matter</h2>
      <p>Good design is invisible. It guides users effortlessly through your product, making complex tasks feel simple and intuitive...</p>
      <a href="#" class="read-more">Read more &rarr;</a>
    </article>
    <article>
      <span class="date">Feb 10, 2026</span>
      <h2>The Art of Clean Code</h2>
      <p>Writing clean code isn't just about aesthetics. It's about communication — making your intent clear to the next person who reads your code...</p>
      <a href="#" class="read-more">Read more &rarr;</a>
    </article>
  </main>
  <footer>
    <p>&copy; 2026 My Blog. Built with simplicity.</p>
  </footer>
</body>
</html>`,
      css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: Georgia, 'Times New Roman', serif;
  line-height: 1.8;
  color: #c9d1d9;
  background: #0d1117;
  max-width: 680px;
  margin: 0 auto;
  padding: 60px 20px;
}
header { margin-bottom: 60px; text-align: center; }
h1 { font-size: 2.5rem; color: #58a6ff; margin-bottom: 8px; }
.subtitle { color: #8b949e; font-style: italic; }
article {
  padding: 30px;
  margin-bottom: 24px;
  background: #161b22;
  border-radius: 12px;
  border: 1px solid #21262d;
}
article .date { font-size: 0.8rem; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; }
article h2 { font-size: 1.5rem; color: #f0f6fc; margin: 8px 0 12px; }
article p { color: #8b949e; margin-bottom: 16px; }
.read-more { color: #58a6ff; text-decoration: none; font-size: 0.9rem; }
.read-more:hover { text-decoration: underline; }
footer { text-align: center; margin-top: 60px; color: #484f58; font-size: 0.85rem; }`,
      js: `// Blog interactivity
document.querySelectorAll('.read-more').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Full article would open here!');
  });
});`,
    },
    {
      id: 'tpl-pricing-page',
      name: 'SaaS Pricing',
      description: 'Modern pricing page with plan comparison cards',
      category: 'business',
      thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%230f0c29'/%3E%3Cstop offset='1' stop-color='%23302b63'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='400' height='225'/%3E%3Crect x='120' y='20' width='160' height='14' rx='7' fill='%23fff' opacity='.8'/%3E%3Crect x='140' y='45' width='120' height='6' rx='3' fill='%23888'/%3E%3Crect x='20' y='70' width='110' height='135' rx='10' fill='%23fff' opacity='.08' stroke='%23fff' stroke-opacity='.15'/%3E%3Crect x='145' y='65' width='110' height='140' rx='10' fill='%237B61FF' opacity='.25' stroke='%237B61FF' stroke-opacity='.5'/%3E%3Crect x='270' y='70' width='110' height='135' rx='10' fill='%23fff' opacity='.08' stroke='%23fff' stroke-opacity='.15'/%3E%3C/svg%3E",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing</title>
</head>
<body>
  <div class="container">
    <h1>Simple, Transparent Pricing</h1>
    <p class="subtitle">Choose the plan that fits your needs. Upgrade or downgrade anytime.</p>
    <div class="plans">
      <div class="plan">
        <h3>Starter</h3>
        <div class="price"><span class="amount">$9</span>/mo</div>
        <ul>
          <li>5 Projects</li>
          <li>10GB Storage</li>
          <li>Basic Analytics</li>
          <li>Email Support</li>
        </ul>
        <button class="btn">Get Started</button>
      </div>
      <div class="plan featured">
        <div class="badge">Most Popular</div>
        <h3>Professional</h3>
        <div class="price"><span class="amount">$29</span>/mo</div>
        <ul>
          <li>Unlimited Projects</li>
          <li>100GB Storage</li>
          <li>Advanced Analytics</li>
          <li>Priority Support</li>
          <li>Custom Domains</li>
        </ul>
        <button class="btn primary">Get Started</button>
      </div>
      <div class="plan">
        <h3>Enterprise</h3>
        <div class="price"><span class="amount">$99</span>/mo</div>
        <ul>
          <li>Everything in Pro</li>
          <li>Unlimited Storage</li>
          <li>Dedicated Manager</li>
          <li>SLA Guarantee</li>
          <li>SSO & SAML</li>
        </ul>
        <button class="btn">Contact Sales</button>
      </div>
    </div>
  </div>
</body>
</html>`,
      css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  color: #fff;
  padding: 40px 20px;
}
.container { text-align: center; max-width: 1000px; width: 100%; }
h1 { font-size: 2.5rem; margin-bottom: 12px; }
.subtitle { color: #999; font-size: 1.1rem; margin-bottom: 48px; }
.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; align-items: start; }
.plan {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 36px 28px;
  text-align: left;
  position: relative;
}
.plan.featured {
  background: rgba(123,97,255,0.15);
  border-color: #7B61FF;
  transform: scale(1.05);
}
.badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #7B61FF;
  color: #fff;
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.plan h3 { font-size: 1.25rem; margin-bottom: 12px; }
.price { margin-bottom: 24px; }
.amount { font-size: 3rem; font-weight: 700; }
ul { list-style: none; margin-bottom: 28px; }
li { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: #bbb; font-size: 0.95rem; }
li::before { content: "\\2713 "; color: #7B61FF; margin-right: 8px; }
.btn {
  width: 100%;
  padding: 14px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 10px;
  background: transparent;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn:hover { background: rgba(255,255,255,0.1); }
.btn.primary { background: #7B61FF; border-color: #7B61FF; }
.btn.primary:hover { background: #6344FF; }`,
      js: `// Pricing page interactivity
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const plan = btn.closest('.plan').querySelector('h3').textContent;
    alert('Selected plan: ' + plan + '! Checkout would open here.');
  });
});`,
    },
  ];

  const insert = db.prepare(`
    INSERT OR REPLACE INTO templates (id, name, description, category, thumbnail, html, css, js, is_official, clone_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, COALESCE((SELECT clone_count FROM templates WHERE id = ?), 0))
  `);

  for (const tpl of templates) {
    try {
      insert.run(tpl.id, tpl.name, tpl.description, tpl.category, tpl.thumbnail || '', tpl.html, tpl.css, tpl.js, tpl.id);
    } catch {
      // Template may already exist
    }
  }

  logger.info({ count: templates.length }, 'Default templates seeded');
}
