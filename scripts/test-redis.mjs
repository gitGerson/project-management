import Redis from 'ioredis';

const host = process.env.REDIS_HOST || '127.0.0.1';
const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
const password = process.env.REDIS_PASSWORD || undefined;
const db = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0;

console.log('Testing Redis connection with settings:');
console.log(`  REDIS_CLIENT: ${process.env.REDIS_CLIENT || 'ioredis'}`);
console.log(`  REDIS_HOST:   ${host}`);
console.log(`  REDIS_PORT:   ${port}`);
console.log(`  REDIS_DB:     ${db}`);
console.log('');

const redis = new Redis({
  host,
  port,
  password,
  db,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

try {
  await redis.connect();
  console.log('✅ Connected to Redis successfully!');

  const pingResult = await redis.ping();
  console.log(`  PING -> ${pingResult}`);

  const testKey = `test:project_management:${Date.now()}`;
  const testVal = 'Redis is operational';

  await redis.set(testKey, testVal, 'EX', 10);
  const fetched = await redis.get(testKey);
  console.log(`  SET/GET check: "${fetched}"`);

  await redis.del(testKey);
  console.log('  Cleaned up test key.');

  const info = await redis.info('server');
  const versionLine = info.split('\n').find((line) => line.startsWith('redis_version:'));
  if (versionLine) {
    console.log(`  ${versionLine.trim()}`);
  }

  await redis.quit();
  console.log('\n🎉 Redis test completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Redis connection failed:');
  console.error(`   ${error.message}`);
  await redis.disconnect();
  process.exit(1);
}

