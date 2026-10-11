export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
}

export const redisConfig: RedisConnectionConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
  keyPrefix: process.env.REDIS_PREFIX || '',
  maxRetriesPerRequest: 3,
};

export default redisConfig;

