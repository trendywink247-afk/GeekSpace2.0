// ============================================================
// OAuth Authentication - Google & GitHub Signup/Login
// ============================================================

import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { config } from '../../../config.js';
import { logger } from '../../../logger.js';
import { generateToken } from '../../../middleware/auth.js';

const router = Router();

// Provision all default rows a new user needs — mirrors regular signup in auth.ts
function provisionNewUser(userId: string, username: string, displayName: string) {
  // Default agent config
  db.prepare(
    `INSERT INTO agent_configs (id, user_id, name, display_name, mode, voice, system_prompt)
     VALUES (?, ?, 'Geek', ?, 'builder', 'friendly', 'You are a helpful personal AI assistant.')`
  ).run(uuid(), userId, `${displayName}'s AI`);

  // Default features row
  db.prepare('INSERT INTO features (user_id) VALUES (?)').run(userId);

  // Default free subscription
  db.prepare('INSERT INTO subscriptions (id, user_id) VALUES (?, ?)').run(uuid(), userId);

  // Default portfolio
  db.prepare('INSERT INTO portfolios (user_id, username) VALUES (?, ?)').run(userId, username);

  // Default Pico agent
  try {
    db.prepare('INSERT INTO pico_agents (id, user_id, slot, name) VALUES (?, ?, 1, ?)').run(uuid(), userId, 'Weebo');
  } catch { /* table may not exist in older DBs */ }

  // Default integrations
  const insInt = db.prepare(
    'INSERT INTO integrations (id, user_id, type, name, description, status, health, requests_today, last_sync, features, permissions) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)'
  );
  const defaultIntegrations: [string, string, string, string][] = [
    ['telegram', 'Telegram', 'Send messages, reminders, and receive notifications via Telegram bot', '["Send messages","Receive reminders","Bot commands"]'],
    ['google-calendar', 'Google Calendar', 'Sync events, schedule reminders, and check availability', '["Event sync","Reminders","Availability check"]'],
    ['location', 'Location Services', 'Share location for contextual reminders', '["Location queries","Geofenced reminders"]'],
    ['github', 'GitHub', 'Sync repositories, track issues, and showcase projects', '["Repo sync","Issue tracking","Portfolio showcase"]'],
    ['twitter', 'Twitter/X', 'Share updates and connect your social presence', '["Auto-share","Social sync","Profile link"]'],
    ['linkedin', 'LinkedIn', 'Professional profile sync and networking', '["Profile sync","Network updates"]'],
    ['n8n', 'n8n', 'Workflow automation engine for advanced integrations', '["Custom workflows","Triggers","Webhooks"]'],
    ['whatsapp', 'WhatsApp', 'Chat with your AI agent via WhatsApp', '["Messages","Voice notes","Media"]'],
  ];
  for (const [type, name, desc, feats] of defaultIntegrations) {
    insInt.run(uuid(), userId, type, name, desc, 'disconnected', '', feats, '[]');
  }

  // Activity log
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Signed up', 'Welcome to Agentin!', 'user-plus')`).run(uuid(), userId);
}

// Generate a cool unique username like "swift_tiger_42"
function generateCoolUsername(): string {
  const adjectives = [
    'swift', 'bright', 'bold', 'cosmic', 'neon', 'cyber', 'turbo', 'ultra',
    'hyper', 'solar', 'lunar', 'nova', 'pixel', 'alpha', 'omega', 'delta',
    'quantum', 'sonic', 'atomic', 'blaze', 'frost', 'storm', 'shadow', 'echo',
    'flux', 'apex', 'zenith', 'vortex', 'stellar', 'radiant',
  ];
  const nouns = [
    'fox', 'wolf', 'hawk', 'bear', 'tiger', 'panda', 'eagle', 'shark',
    'phoenix', 'dragon', 'raven', 'falcon', 'lynx', 'jaguar', 'viper',
    'comet', 'orbit', 'pulse', 'spark', 'byte', 'node', 'core', 'wave',
    'cipher', 'vector', 'quasar', 'nebula', 'prism', 'zenon', 'nexus',
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100-999
  const candidate = `${adj}_${noun}_${num}`;
  // Ensure uniqueness against existing usernames
  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(candidate);
  if (exists) return `${adj}_${noun}_${Math.floor(Math.random() * 9000) + 1000}`;
  return candidate;
}

// Serialize user for session
passport.serializeUser((user: Express.User, done) => {
  const u = user as { id: string };
  done(null, u.id);
});

passport.deserializeUser((id: string, done) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    done(null, user as Express.User);
  } catch (err) {
    done(err);
  }
});

// Google Strategy
if (config.googleClientId && config.googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: `${config.apiUrl}/api/oauth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const avatar = profile.photos?.[0]?.value;
          const googleId = profile.id;

          if (!email) {
            return done(new Error('No email provided by Google'));
          }

          // Check if user exists
          let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown>;

          if (user) {
            // Update Google ID if not set
            if (!user.google_id) {
              db.prepare(`UPDATE users SET google_id = ?, updated_at = datetime('now') WHERE id = ?`)
                .run(googleId, user.id);
            }
            logger.info({ userId: user.id }, 'User logged in via Google');
          } else {
            // Create new user
            const userId = uuid();
            const username = generateCoolUsername();

            db.prepare(
              `INSERT INTO users (id, email, username, password_hash, name, avatar, google_id, created_at, updated_at)
               VALUES (?, ?, ?, 'oauth:google:no-password', ?, ?, ?, datetime('now'), datetime('now'))`
            ).run(userId, email, username, name, avatar, googleId);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
            logger.info({ userId, email }, 'New user created via Google OAuth');

            // Provision all default rows (features, portfolio, integrations, etc.)
            provisionNewUser(userId, username, name || username);
          }

          done(null, user);
        } catch (err) {
          logger.error({ err }, 'Google OAuth error');
          done(err as Error);
        }
      }
    )
  );
}

// GitHub Strategy
if (config.githubClientId && config.githubClientSecret) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: config.githubClientId,
        clientSecret: config.githubClientSecret,
        callbackURL: `${config.apiUrl}/api/oauth/github/callback`,
        scope: ['user:email', 'read:user'],
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: {
          id: string;
          username?: string;
          displayName?: string;
          emails?: Array<{ value: string }>;
          photos?: Array<{ value: string }>;
        },
        done: (err: Error | null, user?: unknown) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
          const name = profile.displayName || profile.username;
          const avatar = profile.photos?.[0]?.value;
          const githubId = profile.id;
          const githubUsername = profile.username;

          // Check if user exists
          let user = db.prepare('SELECT * FROM users WHERE email = ? OR github_id = ?').get(email, githubId) as Record<string, unknown>;

          if (user) {
            // Update GitHub info if not set
            if (!user.github_id) {
              db.prepare(`UPDATE users SET github_id = ?, github_username = ?, updated_at = datetime('now') WHERE id = ?`)
                .run(githubId, githubUsername, user.id);
            }
            logger.info({ userId: user.id }, 'User logged in via GitHub');
          } else {
            // Create new user
            const userId = uuid();
            const username = githubUsername || generateCoolUsername();

            db.prepare(
              `INSERT INTO users (id, email, username, password_hash, name, avatar, github_id, github_username, created_at, updated_at)
               VALUES (?, ?, ?, 'oauth:github:no-password', ?, ?, ?, ?, datetime('now'), datetime('now'))`
            ).run(userId, email, username, name, avatar, githubId, githubUsername);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
            logger.info({ userId, email, githubUsername }, 'New user created via GitHub OAuth');

            // Provision all default rows (features, portfolio, integrations, etc.)
            provisionNewUser(userId, username, name || username);

            // Auto-import GitHub repos to portfolio if available
            if (accessToken) {
              try {
                const reposRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=6', {
                  headers: { Authorization: `token ${accessToken}` }
                });
                if (reposRes.ok) {
                  const repos = await reposRes.json();
                  // Store repos for later portfolio import
                  db.prepare(
                    'INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value'
                  ).run(userId, 'pending_github_repos', JSON.stringify(repos));
                }
              } catch (err) {
                logger.warn({ err, userId }, 'Failed to fetch GitHub repos');
              }
            }
          }

          done(null, user);
        } catch (err) {
          logger.error({ err }, 'GitHub OAuth error');
          done(err as Error);
        }
      }
    )
  );
}

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', (req, res, next) => {
  // User denied OAuth consent — redirect to login with a human-readable error message
  if (req.query.error) {
    logger.info({ oauthError: req.query.error }, 'Google OAuth cancelled by user');
    return res.redirect(`${config.publicUrl}/login?error=${encodeURIComponent('Google sign-in was cancelled')}`);
  }
  next();
}, passport.authenticate('google', { session: false, failureRedirect: `${config.publicUrl}/login?error=${encodeURIComponent('Google sign-in failed')}` }),
  (req, res) => {
    const user = req.user as { id: string };
    const token = generateToken(user.id);
    res.redirect(`${config.publicUrl}/oauth/callback?token=${token}`);
  }
);

// GitHub OAuth routes
router.get('/github', passport.authenticate('github', { scope: ['user:email', 'read:user'] }));

router.get('/github/callback', (req, res, next) => {
  // User denied OAuth consent — redirect to login with a human-readable error message
  if (req.query.error) {
    logger.info({ oauthError: req.query.error }, 'GitHub OAuth cancelled by user');
    return res.redirect(`${config.publicUrl}/login?error=${encodeURIComponent('GitHub sign-in was cancelled')}`);
  }
  next();
}, passport.authenticate('github', { session: false, failureRedirect: `${config.publicUrl}/login?error=${encodeURIComponent('GitHub sign-in failed')}` }),
  (req, res) => {
    const user = req.user as { id: string };
    const token = generateToken(user.id);
    res.redirect(`${config.publicUrl}/oauth/callback?token=${token}`);
  }
);

// Get OAuth status (which providers are configured)
router.get('/status', (req, res) => {
  res.json({
    google: !!config.googleClientId,
    github: !!config.githubClientId,
  });
});

export { router as oauthRouter };
