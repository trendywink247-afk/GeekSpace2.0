/**
 * Offline re-encryption utility for `api_keys.key_encrypted`.
 *
 * Drives Phase 3 of the AGE-18 rotation plan (AGE-25). Re-encrypts every row
 * in `api_keys` from the OLD encryption key to the NEW one inside a single
 * SQLite transaction.
 *
 * Self-contained — does NOT import `config.ts`. Both keys are supplied via
 * env so the script can run against a database whose live runtime key is
 * still the old one. This is the intended sequence: re-encrypt first, then
 * flip `/root/.agentin-secrets` → `ENCRYPTION_KEY` to the new value, then
 * restart the app.
 *
 * Usage (on the VPS, from a root shell inside `ops/rotate-app-secrets.sh`):
 *
 *   OLD_ENCRYPTION_KEY=<hex64> ENCRYPTION_KEY=<hex64> \
 *     DB_PATH=/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db \
 *     node --experimental-strip-types server/scripts/reencrypt-api-keys.ts
 *
 * Flags (env):
 *   DRY_RUN=1          — decrypt + re-encrypt in memory, never write
 *   STRICT=1           — fail on any row that neither the old nor the new key can decrypt
 *                       (default: warn and leave the row alone so a partial run is resumable)
 */

import Database from 'better-sqlite3';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(encryptionKey: string): Buffer {
  const salt = createHash('sha256').update(encryptionKey).digest();
  return scryptSync(encryptionKey, salt, KEY_LENGTH);
}

function tryDecrypt(ciphertext: string, key: Buffer): string | null {
  try {
    const packed = Buffer.from(ciphertext, 'base64');
    if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: ${name} is required`);
    process.exit(2);
  }
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    console.error(`ERROR: ${name} must be 64 hex chars (32 bytes). Got ${value.length} chars.`);
    process.exit(2);
  }
  return value;
}

const oldKeyHex = requireEnv('OLD_ENCRYPTION_KEY');
const newKeyHex = requireEnv('ENCRYPTION_KEY');
const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error('ERROR: DB_PATH is required (absolute path to the SQLite file)');
  process.exit(2);
}

const dryRun = process.env.DRY_RUN === '1';
const strict = process.env.STRICT === '1';

if (oldKeyHex === newKeyHex) {
  console.error('ERROR: OLD_ENCRYPTION_KEY and ENCRYPTION_KEY are identical — nothing to rotate.');
  process.exit(2);
}

const oldKey = deriveKey(oldKeyHex);
const newKey = deriveKey(newKeyHex);

console.log('=== reencrypt-api-keys ===');
console.log(`db:        ${dbPath}`);
console.log(`dry-run:   ${dryRun}`);
console.log(`strict:    ${strict}`);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const rows = db
  .prepare<[], { id: string; key_encrypted: string }>('SELECT id, key_encrypted FROM api_keys')
  .all();

console.log(`rows:      ${rows.length}`);

let reencrypted = 0;
let alreadyNew = 0;
let undecryptable = 0;

const update = db.prepare('UPDATE api_keys SET key_encrypted = ? WHERE id = ?');

const work = db.transaction(() => {
  for (const row of rows) {
    const withOld = tryDecrypt(row.key_encrypted, oldKey);
    if (withOld !== null) {
      const next = encrypt(withOld, newKey);
      if (!dryRun) update.run(next, row.id);
      reencrypted++;
      continue;
    }

    const withNew = tryDecrypt(row.key_encrypted, newKey);
    if (withNew !== null) {
      alreadyNew++;
      continue;
    }

    undecryptable++;
    const msg = `UNDECRYPTABLE row id=${row.id} — neither OLD nor NEW key opens this ciphertext`;
    if (strict) {
      throw new Error(msg);
    }
    console.warn(`WARN: ${msg} (leaving untouched)`);
  }
});

try {
  work();
} catch (err) {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  db.close();
  process.exit(1);
}

db.close();

console.log('=== summary ===');
console.log(`reencrypted:     ${reencrypted}`);
console.log(`already-new:     ${alreadyNew}`);
console.log(`undecryptable:   ${undecryptable}`);
console.log(dryRun ? 'DRY RUN — no writes committed' : 'writes committed');

if (undecryptable > 0 && !strict) {
  process.exit(3);
}
