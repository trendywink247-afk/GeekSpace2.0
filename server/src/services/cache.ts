import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../logger.js';

let client: Redis | null = null;

function getClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;  // only connect if REDIS_URL explicitly set
  if (!client) {
    client = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    client.on('error', (err: Error) => {
      logger.warn({ err }, 'Redis error (non-fatal)');
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
