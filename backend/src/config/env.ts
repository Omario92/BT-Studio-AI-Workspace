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
  STORAGE_PUBLIC_BASE_URL: process.env.STORAGE_PUBLIC_BASE_URL ?? '',
  STORAGE_BUCKET: process.env.STORAGE_BUCKET ?? 'bt-studio-assets',
  STORAGE_REGION: process.env.STORAGE_REGION ?? 'auto',
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT ?? '',
  STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID ?? '',
  STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
  STORAGE_MAX_FILE_SIZE_MB: parseInt(process.env.STORAGE_MAX_FILE_SIZE_MB ?? '100', 10),

  GOOGLE_DRIVE_ENABLED: (process.env.GOOGLE_DRIVE_ENABLED === 'true'),
  GOOGLE_DRIVE_SHARED_DRIVE_ID: process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID ?? '',
  GOOGLE_DRIVE_ARCHIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID ?? '',
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ?? '',

  RUNPOD_API_KEY: process.env.RUNPOD_API_KEY ?? '',
  RUNPOD_ENDPOINT_ID: process.env.RUNPOD_ENDPOINT_ID ?? '',
  RUNPOD_BASE_URL: process.env.RUNPOD_BASE_URL ?? 'https://api.runpod.ai/v2',

  COMFYUI_BASE_URL: process.env.COMFYUI_BASE_URL ?? '',
  COMFYUI_API_KEY: process.env.COMFYUI_API_KEY ?? '',
  COMFYUI_DEFAULT_WORKFLOW_IMAGE_GENERATION: process.env.COMFYUI_DEFAULT_WORKFLOW_IMAGE_GENERATION ?? '',
  COMFYUI_DEFAULT_WORKFLOW_UPSCALE: process.env.COMFYUI_DEFAULT_WORKFLOW_UPSCALE ?? '',
  COMFYUI_DEFAULT_WORKFLOW_IMAGE_EDIT: process.env.COMFYUI_DEFAULT_WORKFLOW_IMAGE_EDIT ?? '',
  // Upscale-specific ComfyUI injection knobs
  COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID: process.env.COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID ?? '',
  COMFYUI_UPSCALE_SAVE_IMAGE_NODE_ID: process.env.COMFYUI_UPSCALE_SAVE_IMAGE_NODE_ID ?? '',
  COMFYUI_UPSCALE_FILENAME_PREFIX: process.env.COMFYUI_UPSCALE_FILENAME_PREFIX ?? 'bt_upscale',
  COMFYUI_TIMEOUT_MS: parseInt(process.env.COMFYUI_TIMEOUT_MS ?? '300000', 10),
  COMFYUI_AUTH_HEADER: process.env.COMFYUI_AUTH_HEADER ?? '',

  // comfy-dispatcher (external HTTP service auto-deploying RunPod ComfyUI pods)
  DISPATCHER_BASE_URL: process.env.DISPATCHER_BASE_URL ?? '',
  DISPATCHER_API_KEY: process.env.DISPATCHER_API_KEY ?? '',
  DISPATCHER_CALLBACK_URL: process.env.DISPATCHER_CALLBACK_URL ?? '',
  COMFYUI_UPSCALE_WORKFLOW_PATH: process.env.COMFYUI_UPSCALE_WORKFLOW_PATH ?? '',
  COMFYUI_UPSCALE_WORKFLOW_JSON: process.env.COMFYUI_UPSCALE_WORKFLOW_JSON ?? '',
  AI_PROVIDER_PRIORITY: process.env.AI_PROVIDER_PRIORITY ?? 'dispatcher,comfyui,mock',

  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
} as const;
