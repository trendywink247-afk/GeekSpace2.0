// ============================================================
// AES-256-GCM encryption for sensitive data (API keys)
// Uses Node native crypto — no CryptoJS dependency
// Format: base64(iv:authTag:ciphertext)
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const LEGACY_SALT = 'geekspace-api-key-encryption';

function makeSalt(): Buffer {
  return createHash('sha256').update(config.encryptionKey).digest();
}

// Derive a 32-byte key from the config encryption key using scrypt
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

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Pack as: iv + authTag + ciphertext, then base64 the whole thing
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

export function decrypt(ciphertext: string): string {
  const packed = Buffer.from(ciphertext, 'base64');
  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data');
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

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

export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}
