import IORedis from 'ioredis';
import { env } from './env';

const isRedisDisabled = process.env.DISABLE_REDIS === 'true';

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  lazyConnect: isRedisDisabled, // do not auto-connect if disabled
});

redis.on('error', (err) => {
  if (!isRedisDisabled) {
    console.error('[Redis] Connection error:', err.message);
  }
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

export default redis;
