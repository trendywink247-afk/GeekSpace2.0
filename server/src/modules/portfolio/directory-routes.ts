import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { validateQuery } from '../../middleware/validate.js';

export const directoryRouter = Router();

const directoryQuerySchema = z.object({
  search: z.string().max(200).optional().default(''),
  tag: z.string().max(100).optional().default(''),
});

/** Escape LIKE wildcards so user input is treated as literal text */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

directoryRouter.get('/', validateQuery(directoryQuerySchema), (req, res) => {
  const search = (req.query.search as string).toLowerCase();
  const tag = (req.query.tag as string).toLowerCase();

  let query = `
    SELECT u.username, u.name, u.avatar, u.bio, u.location, u.tags,
           p.headline as tagline, p.skills, p.agent_enabled as agentEnabled
    FROM users u
    LEFT JOIN portfolios p ON u.id = p.user_id
    WHERE u.privacy_show_profile = 1
  `;
  const params: unknown[] = [];

  if (search) {
    query += ` AND (LOWER(u.name) LIKE ? ESCAPE '\\' OR LOWER(u.bio) LIKE ? ESCAPE '\\' OR LOWER(u.tags) LIKE ? ESCAPE '\\' OR LOWER(p.skills) LIKE ? ESCAPE '\\' OR LOWER(p.headline) LIKE ? ESCAPE '\\')`;
    const s = `%${escapeLike(search)}%`;
    params.push(s, s, s, s, s);
  }

  if (tag) {
    query += ` AND (LOWER(u.tags) LIKE ? ESCAPE '\\' OR LOWER(p.skills) LIKE ? ESCAPE '\\')`;
    const t = `%${escapeLike(tag)}%`;
    params.push(t, t);
  }

  query += ' ORDER BY u.created_at DESC';

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

  const parseJsonArray = (val: unknown): unknown[] => {
    try { return JSON.parse(val as string || '[]') as unknown[]; } catch { return []; }
  };

  const profiles = rows.map(row => ({
    username: row.username,
    name: row.name,
    avatar: row.avatar,
    tagline: row.tagline || row.bio || '',
    tags: parseJsonArray(row.tags),
    location: row.location,
    skills: parseJsonArray(row.skills),
    agentEnabled: !!row.agentEnabled,
  }));

  res.json({ profiles, total: profiles.length });
});
