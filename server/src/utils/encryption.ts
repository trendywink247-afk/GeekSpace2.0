// ============================================================
// AES encryption for sensitive data (API keys)
// ============================================================

import CryptoJS from 'crypto-js';
import { config } from '../config.js';

export function encrypt(plaintext: string): string {
  return CryptoJS.AES.encrypt(plaintext, config.encryptionKey).toString();
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, config.encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}
