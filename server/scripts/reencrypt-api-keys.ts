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
 * Transactional semantics (strict by default):
 *   On any row where the ciphertext cannot be opened by the OLD key, the
 *   NEW key, or the legacy-salt derivation of the OLD key, the transaction
 *   rolls back and the script exits non-zero. The ops script MUST be able
 *   to trust "success" to mean "every row is now encrypted under NEW"
 *   before flipping the env file, otherwise the runtime would later fail
 *   to decrypt a row that was half-re-encrypted.
 *
 *   Set `ALLOW_UNDECRYPTABLE=1` to opt into tolerate-mode: undecryptable
 *   rows are logged + skipped, re-encrypted rows commit as normal. Use
 *   this only when the operator has already reconciled the orphaned rows
 *   out-of-band (and knows the runtime could not have decrypted them
 *   before rotation either, so leaving them is no-worse-than-before).
 *
 * Usage (on the VPS, from a root shell inside `ops/rotate-app-secrets.sh`):
 *
 *   OLD_ENCRYPTION_KEY=<hex64> ENCRYPTION_KEY=<hex64> \
 *     DB_PATH=/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db \
 *     node --experimental-strip-types server/scripts/reencrypt-api-keys.ts
 *
 * Flags (env):
 *   DRY_RUN=1                  — run the full pass in a transaction that
 *                                always rolls back, so nothing is written
 *   ALLOW_UNDECRYPTABLE=1      — tolerate orphaned rows (see above)
 */

import Database from 'better-sqlite3';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Must match server/src/utils/encryption.ts exactly. Rows encrypted before
// the salt migration still decrypt via this derivation at runtime, so the
// rotation must do the same or it will misclassify valid rows as orphaned.
const LEGACY_SALT = 'geekspace-api-key-encryption';

interface DerivedKeys {
  primary: Buffer;
  legacy: Buffer;
}

function deriveKeys(encryptionKey: string): DerivedKeys {
  const primarySalt = createHash('sha256').update(encryptionKey).digest();
  return {
    primary: scryptSync(encryptionKey, primarySalt, KEY_LENGTH),
    legacy: scryptSync(encryptionKey, LEGACY_SALT, KEY_LENGTH),
  };
}

function tryDecryptWith(ciphertext: string, key: Buffer): string | null {
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

function tryDecryptAny(ciphertext: string, keys: Buffer[]): string | null {
  for (const key of keys) {
    const pt = tryDecryptWith(ciphertext, key);
    if (pt !== null) return pt;
  }
  return null;
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
const allowUndecryptable = process.env.ALLOW_UNDECRYPTABLE === '1';

if (oldKeyHex === newKeyHex) {
  console.error('ERROR: OLD_ENCRYPTION_KEY and ENCRYPTION_KEY are identical — nothing to rotate.');
  process.exit(2);
}

const oldKeys = deriveKeys(oldKeyHex);
const newKeys = deriveKeys(newKeyHex);

// Read candidates: current-salt OLD, legacy-salt OLD, current-salt NEW.
// We never try legacy-salt NEW on purpose — the new key is freshly minted
// and has never been used under the legacy salt.
const decryptCandidates = [oldKeys.primary, oldKeys.legacy, newKeys.primary];

console.log('=== reencrypt-api-keys ===');
console.log(`db:                    ${dbPath}`);
console.log(`dry-run:               ${dryRun}`);
console.log(`allow-undecryptable:   ${allowUndecryptable}`);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const rows = db
  .prepare<[], { id: string; key_encrypted: string }>('SELECT id, key_encrypted FROM api_keys')
  .all();

console.log(`rows:                  ${rows.length}`);

let reencrypted = 0;
let alreadyNew = 0;
const undecryptableIds: string[] = [];

const update = db.prepare('UPDATE api_keys SET key_encrypted = ? WHERE id = ?');

class DryRunRollback extends Error {
  constructor() {
    super('dry-run rollback sentinel');
    this.name = 'DryRunRollback';
  }
}

const work = db.transaction(() => {
  for (const row of rows) {
    // Fast path: already encrypted under the new key (idempotent resume).
    if (tryDecryptWith(row.key_encrypted, newKeys.primary) !== null) {
      alreadyNew++;
      continue;
    }

    // Decrypt via current-salt OLD or legacy-salt OLD.
    const plaintext = tryDecryptAny(row.key_encrypted, [oldKeys.primary, oldKeys.legacy]);
    if (plaintext !== null) {
      update.run(encrypt(plaintext, newKeys.primary), row.id);
      reencrypted++;
      continue;
    }

    undecryptableIds.push(row.id);
    if (!allowUndecryptable) {
      // Strict default: fail the whole transaction. Writes roll back so the
      // env flip afterwards cannot race a partially-rotated DB.
      throw new Error(
        `UNDECRYPTABLE row id=${row.id} — ciphertext does not open under current-OLD, legacy-OLD, or current-NEW. ` +
          `Re-run with ALLOW_UNDECRYPTABLE=1 only after reconciling orphaned rows.`,
      );
    }
    console.warn(`WARN: leaving undecryptable row id=${row.id} untouched`);
  }

  if (dryRun) {
    throw new DryRunRollback();
  }
});

let committed = true;
try {
  work();
} catch (err) {
  committed = false;
  if (err instanceof DryRunRollback) {
    // Expected — dry-run always rolls back.
  } else {
    console.error('FATAL:', err instanceof Error ? err.message : err);
    db.close();
    process.exit(1);
  }
}

db.close();

console.log('=== summary ===');
console.log(`reencrypted:     ${reencrypted}`);
console.log(`already-new:     ${alreadyNew}`);
console.log(`undecryptable:   ${undecryptableIds.length}`);
if (undecryptableIds.length > 0) {
  console.log(`undecryptable-ids: ${undecryptableIds.join(',')}`);
}
if (dryRun) {
  console.log('DRY RUN — transaction rolled back, no writes committed');
} else if (committed) {
  console.log('writes committed');
} else {
  console.log('writes rolled back');
}
