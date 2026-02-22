# Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden GeekSpace 2.0 for production — fix P0-P2 security issues from the audit: bcrypt rounds, encryption salt, admin token enforcement, CSP headers, security logging, Redis auth, backup encryption, Docker log rotation, and npm audit.

**Architecture:** Server-side fixes in Express middleware + config + Docker infrastructure. No frontend changes. No new routes. Keep demo endpoint active.

**Tech Stack:** TypeScript, Express, Helmet, better-sqlite3, Redis, Docker Compose, Caddy

---

### Task 1: Increase bcrypt rounds from 10 to 12

**Files:**
- Modify: `server/src/routes/auth.ts`

**Step 1: Update bcrypt cost factor**

In `server/src/routes/auth.ts`, find line 21:

```typescript
const passwordHash = await bcrypt.hash(password, 10);
```

Change to:

```typescript
const passwordHash = await bcrypt.hash(password, 12);
```

**Step 2: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add server/src/routes/auth.ts
git commit -m "security: increase bcrypt cost factor from 10 to 12"
```

---

### Task 2: Replace static encryption salt with random per-deployment salt

**Files:**
- Modify: `server/src/utils/encryption.ts`

**Step 1: Replace static salt with env-derived salt**

Replace the salt section (lines 14-23) with:

```typescript
// Use a deterministic but unique salt derived from the encryption key itself.
// This ensures the same key always produces the same derived key (required for
// decrypting existing data) while avoiding a static hardcoded salt.
// The salt is the SHA-256 of the encryption key — unique per deployment.
import { createHash } from 'node:crypto';

let derivedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!derivedKey) {
    const salt = createHash('sha256').update(config.encryptionKey).digest();
    derivedKey = scryptSync(config.encryptionKey, salt, KEY_LENGTH);
  }
  return derivedKey;
}
```

Wait — this breaks decryption of existing data encrypted with the old static salt. We need a migration approach.

Actually, the safer fix: Keep the old salt for decryption, use new salt for new encryptions, and re-encrypt existing data.

**Revised approach — backwards compatible:**

Replace lines 7-23 of `encryption.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const LEGACY_SALT = 'geekspace-api-key-encryption';

// New salt: SHA-256 of the encryption key — unique per deployment
function makeSalt(): Buffer {
  return createHash('sha256').update(config.encryptionKey).digest();
}

let derivedKey: Buffer | null = null;
let legacyKey: Buffer | null = null;

function getKey(): Buffer {
  if (!derivedKey) {
    derivedKey = scryptSync(config.encryptionKey, makeSalt(), KEY_LENGTH);
  }
  return derivedKey;
}

function getLegacyKey(): Buffer {
  if (!legacyKey) {
    legacyKey = scryptSync(config.encryptionKey, LEGACY_SALT, KEY_LENGTH);
  }
  return legacyKey;
}
```

Update `decrypt` to try new key first, fall back to legacy:

```typescript
export function decrypt(ciphertext: string): string {
  const packed = Buffer.from(ciphertext, 'base64');
  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data');
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  // Try new key first, then legacy
  for (const key of [getKey(), getLegacyKey()]) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      continue;
    }
  }
  throw new Error('Decryption failed — invalid key or corrupted data');
}
```

`encrypt` continues to use `getKey()` (new salt) — all new encryptions use the stronger salt.

**Step 2: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add server/src/utils/encryption.ts
git commit -m "security: replace static encryption salt with deployment-unique hash"
```

---

### Task 3: Require ADMIN_TOKEN in production + validate ENCRYPTION_KEY format

**Files:**
- Modify: `server/src/config.ts`

**Step 1: Add validation block after config export**

After line 140 (`} as const;`), add:

```typescript
// ---- Startup validation ----
if (config.isProduction) {
  if (!config.adminToken) {
    console.warn('WARNING: ADMIN_TOKEN not set — admin API will return 503');
  }
  if (config.encryptionKey && !/^[a-f0-9]{64}$/i.test(config.encryptionKey)) {
    console.error('FATAL: ENCRYPTION_KEY must be 64 hex characters');
    process.exit(1);
  }
}
```

**Step 2: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add server/src/config.ts
git commit -m "security: validate ENCRYPTION_KEY format on startup"
```

---

### Task 4: Enable Content Security Policy in production

**Files:**
- Modify: `server/src/index.ts`

**Step 1: Replace helmet config**

Replace lines 55-57:

```typescript
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false,
}));
```

With:

```typescript
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://openrouter.ai", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
}));
```

Note: `'unsafe-inline'` for scripts/styles is needed because Vite injects inline scripts and Tailwind uses inline styles. This is the minimum viable CSP for the current app.

**Step 2: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "security: enable CSP, referrer-policy, and X-Frame-Options in production"
```

---

### Task 5: Add security event logging

**Files:**
- Create: `server/src/services/security-log.ts`
- Modify: `server/src/db/index.ts` (add migration for security_events table)
- Modify: `server/src/routes/auth.ts` (log login failures and successes)
- Modify: `server/src/routes/admin.ts` (log admin access)

**Step 1: Create security log service**

Create `server/src/services/security-log.ts`:

```typescript
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'signup'
  | 'token_expired'
  | 'token_invalid'
  | 'admin_access'
  | 'admin_denied'
  | 'rate_limited';

export function logSecurityEvent(
  event: SecurityEventType,
  ip: string,
  details?: Record<string, unknown>,
): void {
  try {
    db.prepare(
      `INSERT INTO security_events (event, ip, details, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
    ).run(event, ip, details ? JSON.stringify(details) : null);
  } catch {
    // Non-fatal — log to pino and continue
    logger.warn({ event, ip }, 'Failed to write security event');
  }
}
```

**Step 2: Add migration in db/index.ts**

In the migrations array (find the last migration), add:

```typescript
{
  name: 'add_security_events',
  sql: `CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_security_events_event ON security_events(event);
  CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);`,
},
```

**Step 3: Log in auth routes**

In `server/src/routes/auth.ts`, add import:

```typescript
import { logSecurityEvent } from '../services/security-log.js';
```

After the login success activity log (line 113), add:

```typescript
logSecurityEvent('login_success', req.ip || '', { email: user.email as string, userId: user.id as string });
```

After the login failure response (line 107 — the 401 return), add before the return:

```typescript
logSecurityEvent('login_failure', req.ip || '', { email });
```

After the signup success (line 74 area), add:

```typescript
logSecurityEvent('signup', req.ip || '', { email, username });
```

**Step 4: Log in admin routes**

In `server/src/routes/admin.ts`, add import:

```typescript
import { logSecurityEvent } from '../services/security-log.js';
```

In `requireAdminToken`, after the 401 response (line 41), add before return:

```typescript
logSecurityEvent('admin_denied', req.ip || '', { path: req.path });
```

At the top of any admin handler (e.g., in the `hasValidToken` success path), add:

```typescript
logSecurityEvent('admin_access', req.ip || '', { path: req.path });
```

**Step 5: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 6: Commit**

```bash
git add server/src/services/security-log.ts server/src/db/index.ts server/src/routes/auth.ts server/src/routes/admin.ts
git commit -m "security: add security_events table and log auth + admin events"
```

---

### Task 6: Add Redis authentication

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `.env`

**Step 1: Add password to Redis command**

In `docker-compose.yml`, replace Redis command (line 86):

```yaml
command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
```

With:

```yaml
command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD:-geekspace-redis-2026}
```

**Step 2: Update REDIS_URL in geekspace service environment**

Replace line 18:

```yaml
- REDIS_URL=redis://redis:6379
```

With:

```yaml
- REDIS_URL=redis://:${REDIS_PASSWORD:-geekspace-redis-2026}@redis:6379
```

**Step 3: Update .env.example**

After the existing `REDIS_URL` line, add:

```
# Redis password (used in Docker compose — match with REDIS_URL)
REDIS_PASSWORD=
```

**Step 4: Update .env**

Add `REDIS_PASSWORD=geekspace-redis-2026` (or a stronger password) to `.env`.

Update `REDIS_URL` in `.env` to include the password: `redis://:geekspace-redis-2026@redis:6379`

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "security: add Redis authentication via requirepass"
```

---

### Task 7: Add Docker log rotation

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add logging config to all services**

Add to the `geekspace` service (after `deploy:` block):

```yaml
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
```

Add the same block to `redis` and `picoclaw` services.

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "infra: add Docker log rotation (50MB x 5 files per service)"
```

---

### Task 8: Create encrypted backup script

**Files:**
- Create: `scripts/backup-db.sh`

**Step 1: Create backup script**

```bash
#!/usr/bin/env bash
# Encrypted database backup script for GeekSpace
# Usage: ./scripts/backup-db.sh [backup_dir]
# Requires: GPG_PASSPHRASE env var for encryption

set -euo pipefail

BACKUP_DIR="${1:-/root/backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_VOLUME_PATH="/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db"
BACKUP_FILE="${BACKUP_DIR}/geekspace-${TIMESTAMP}.db"
ENCRYPTED_FILE="${BACKUP_FILE}.gpg"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Copy database (SQLite is safe to copy in WAL mode when not mid-transaction)
echo "[backup] Copying database..."
cp "$DB_VOLUME_PATH" "$BACKUP_FILE"

# Encrypt with GPG symmetric encryption
if [ -n "${GPG_PASSPHRASE:-}" ]; then
  echo "[backup] Encrypting..."
  echo "$GPG_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 "$BACKUP_FILE"
  rm -f "$BACKUP_FILE"
  echo "[backup] Encrypted backup: $ENCRYPTED_FILE"
else
  echo "[backup] WARNING: GPG_PASSPHRASE not set — backup is unencrypted"
  echo "[backup] Unencrypted backup: $BACKUP_FILE"
fi

# Clean old backups
echo "[backup] Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "geekspace-*.db*" -mtime +${RETENTION_DAYS} -delete

echo "[backup] Done."
```

**Step 2: Make executable**

```bash
chmod +x scripts/backup-db.sh
```

**Step 3: Add to crontab**

```bash
# Daily at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * GPG_PASSPHRASE='<your-passphrase>' /root/GeekSpace2.0/scripts/backup-db.sh >> /var/log/geekspace-backup.log 2>&1") | crontab -
```

**Step 4: Commit**

```bash
git add scripts/backup-db.sh
git commit -m "infra: add encrypted database backup script with GPG + 30-day retention"
```

---

### Task 9: Run npm audit fix + update Caddy security headers

**Files:**
- Modify: `server/package.json` (via npm audit fix)
- Modify: `/etc/caddy/Caddyfile`

**Step 1: Run npm audit fix in server**

```bash
cd /root/GeekSpace2.0/server && npm audit fix 2>&1
```

**Step 2: Run npm audit fix in frontend**

```bash
cd /root/GeekSpace2.0 && npm audit fix 2>&1
```

**Step 3: Update Caddy security headers**

Add security headers to `ai.geekspace.space` block in `/etc/caddy/Caddyfile`:

```
ai.geekspace.space {
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
    handle /api/* {
        reverse_proxy localhost:3001
    }
    handle /assets/* {
        root * /var/www/geekspace
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }
    handle {
        root * /var/www/geekspace
        header Cache-Control "no-cache"
        try_files {path} /index.html
        file_server
    }
}
```

**Step 4: Reload Caddy**

```bash
systemctl reload caddy
```

**Step 5: Commit if package changes**

```bash
cd /root/GeekSpace2.0
git add server/package.json server/package-lock.json package.json package-lock.json
git commit -m "security: npm audit fix + Caddy security headers"
```

---

### Task 10: Build, deploy, and push

**Step 1: Build server**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 2: Build frontend**

```bash
cd /root/GeekSpace2.0 && npm run build
```

**Step 3: Deploy frontend**

```bash
cp -r dist/* /var/www/geekspace/
```

**Step 4: Restart Docker**

```bash
cd /root/GeekSpace2.0 && fuser -k 3001/tcp; docker compose up -d --build
```

**Step 5: Smoke test**

```bash
sleep 5 && curl -s http://localhost:3001/api/health | python3 -m json.tool
```

**Step 6: Verify security headers**

```bash
curl -sI https://ai.geekspace.space | grep -iE 'x-frame|x-content|referrer|permissions|content-security'
```

**Step 7: Push**

```bash
git push origin live-production
git checkout main && git merge live-production --no-edit && git push origin main && git checkout live-production
```

---

## Summary

| Task | What | Severity |
|------|------|----------|
| 1 | Bcrypt rounds 10→12 | P0 |
| 2 | Encryption salt — static→deployment-unique | P0 |
| 3 | Validate ENCRYPTION_KEY format on startup | P0 |
| 4 | Enable CSP + Referrer-Policy + X-Frame-Options | P1 |
| 5 | Security event logging table + auth/admin logging | P1 |
| 6 | Redis authentication (requirepass) | P2 |
| 7 | Docker log rotation | P2 |
| 8 | Encrypted DB backup script + cron | P2 |
| 9 | npm audit fix + Caddy security headers | P2 |
| 10 | Build, deploy, push | Ship |
