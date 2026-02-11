import { Router } from 'express';
import { db } from '../db/index.js';

export const directoryRouter = Router();

directoryRouter.get('/', (req, res) => {
  const search = (req.query.search as string || '').toLowerCase();
  const tag = (req.query.tag as string || '').toLowerCase();

  let query = `
    SELECT u.username, u.name, u.avatar, u.bio, u.location, u.tags,
           p.headline as tagline, p.skills, p.agent_enabled as agentEnabled
    FROM users u
    LEFT JOIN portfolios p ON u.id = p.user_id
    WHERE u.privacy_show_profile = 1
  `;
  const params: unknown[] = [];

  if (search) {
    query += ` AND (LOWER(u.name) LIKE ? OR LOWER(u.bio) LIKE ? OR LOWER(u.tags) LIKE ? OR LOWER(p.skills) LIKE ? OR LOWER(p.headline) LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  if (tag) {
    query += ` AND (LOWER(u.tags) LIKE ? OR LOWER(p.skills) LIKE ?)`;
    const t = `%${tag}%`;
    params.push(t, t);
  }

  query += ' ORDER BY u.created_at DESC';

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

  const profiles = rows.map(row => ({
    username: row.username,
    name: row.name,
    avatar: row.avatar,
    tagline: row.tagline || row.bio || '',
    tags: JSON.parse(row.tags as string || '[]'),
    location: row.location,
    skills: JSON.parse(row.skills as string || '[]'),
    agentEnabled: !!row.agentEnabled,
  }));

  res.json({ profiles, total: profiles.length });
});
