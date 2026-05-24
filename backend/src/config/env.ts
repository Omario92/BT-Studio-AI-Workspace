import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  HOST: process.env.HOST ?? '0.0.0.0',

  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',

  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),

  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  STABILITY_API_KEY: process.env.STABILITY_API_KEY ?? '',
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN ?? '',

  STORAGE_DRIVER: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  STORAGE_LOCAL_PATH: process.env.STORAGE_LOCAL_PATH ?? './uploads',

  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
} as const;
