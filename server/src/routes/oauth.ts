// ============================================================
// OAuth Authentication - Google & GitHub Signup/Login
// ============================================================

import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

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
        callbackURL: `${config.apiUrl}/auth/google/callback`,
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
          let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

          if (user) {
            // Update Google ID if not set
            if (!user.google_id) {
              db.prepare('UPDATE users SET google_id = ?, updated_at = datetime("now") WHERE id = ?')
                .run(googleId, user.id);
            }
            logger.info({ userId: user.id }, 'User logged in via Google');
          } else {
            // Create new user
            const userId = uuid();
            const username = email.split('@')[0] + Math.random().toString(36).substring(2, 6);
            
            db.prepare(
              `INSERT INTO users (id, email, username, name, avatar, google_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
            ).run(userId, email, username, name, avatar, googleId);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            logger.info({ userId, email }, 'New user created via Google OAuth');

            // Initialize agent config
            db.prepare(
              `INSERT INTO agent_configs (id, user_id, name, mode, voice, system_prompt, created_at)
               VALUES (?, ?, 'Alex', 'builder', 'friendly', ?, datetime('now'))`
            ).run(uuid(), userId, 'You are Alex, a helpful AI assistant.');
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
        callbackURL: `${config.apiUrl}/auth/github/callback`,
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
          let user = db.prepare('SELECT * FROM users WHERE email = ? OR github_id = ?').get(email, githubId) as any;

          if (user) {
            // Update GitHub info if not set
            if (!user.github_id) {
              db.prepare('UPDATE users SET github_id = ?, github_username = ?, updated_at = datetime("now") WHERE id = ?')
                .run(githubId, githubUsername, user.id);
            }
            logger.info({ userId: user.id }, 'User logged in via GitHub');
          } else {
            // Create new user
            const userId = uuid();
            const username = githubUsername || `user${Math.random().toString(36).substring(2, 8)}`;
            
            db.prepare(
              `INSERT INTO users (id, email, username, name, avatar, github_id, github_username, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
            ).run(userId, email, username, name, avatar, githubId, githubUsername);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            logger.info({ userId, email, githubUsername }, 'New user created via GitHub OAuth');

            // Initialize agent config
            db.prepare(
              `INSERT INTO agent_configs (id, user_id, name, mode, voice, system_prompt, created_at)
               VALUES (?, ?, 'Alex', 'builder', 'friendly', ?, datetime('now'))`
            ).run(uuid(), userId, 'You are Alex, a helpful AI assistant.');

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
}, passport.authenticate('google', { failureRedirect: `${config.publicUrl}/login?error=${encodeURIComponent('Google sign-in failed')}` }),
  (req, res) => {
    const user = req.user as any;
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
}, passport.authenticate('github', { failureRedirect: `${config.publicUrl}/login?error=${encodeURIComponent('GitHub sign-in failed')}` }),
  (req, res) => {
    const user = req.user as any;
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
