import Redis from 'ioredis';
import { config } from '../config.js';

let client: Redis | null = null;

function getClient(): Redis | null {
  if (!config.redisUrl) return null;
  if (!client) {
    client = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    client.on('error', (err: Error) => {
      console.warn('[cache] Redis error (non-fatal):', err.message);
    });
  }
  return client;
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await getClient()?.get(key) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await getClient()?.set(key, value, 'EX', ttlSeconds);
  } catch {
    // Redis failure is non-fatal — serve from DB
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getClient()?.del(key);
  } catch {}
}
