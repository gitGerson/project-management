import Redis from 'ioredis';
import { redisConfig } from '@/config/redis';

// Global singleton declaration to preserve Redis connection across Fast Refresh in Next.js development
declare global {
  var __redisClient: Redis | undefined;
}

export const redis: Redis =
  global.__redisClient ||
  new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password || undefined,
    db: redisConfig.db,
    keyPrefix: redisConfig.keyPrefix,
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__redisClient = redis;
}

/**
 * Test Redis connectivity
 */
export async function testRedisConnection(): Promise<{
  connected: boolean;
  message: string;
  ping?: string;
  details?: Record<string, unknown>;
}> {
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const pingResponse = await redis.ping();
    return {
      connected: true,
      message: 'Redis connection successful!',
      ping: pingResponse,
      details: {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        status: redis.status,
      },
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      connected: false,
      message: `Redis connection failed: ${err.message}`,
      details: {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
      },
    };
  }
}

export default redis;

