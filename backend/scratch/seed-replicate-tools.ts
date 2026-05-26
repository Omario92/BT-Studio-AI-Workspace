/**
 * Idempotent script: configure existing AI Tools to use the Replicate provider.
 *
 * Run after deploy:
 *   cd backend
 *   npx tsx scratch/seed-replicate-tools.ts
 *
 * Safe to re-run — only updates the `provider` and `config` fields on each tool;
 * does not touch name, slug, category, or descriptions.
 *
 * Models pinned by version hash so behavior is reproducible. To upgrade a model,
 * grab a new version from https://replicate.com/<model>/versions and bump the
 * `version` string below.
 */
import 'dotenv/config';
import prisma from '../src/config/database';

interface ToolReplicateConfig {
  model: string;
  version: string;
  inputMap?: Record<string, string>;
  defaults?: Record<string, unknown>;
}

const TOOL_PROVIDER_CONFIG: Record<string, ToolReplicateConfig> = {
  // Real-ESRGAN — proven, cheap, runs in ~5s on a T4
  // https://replicate.com/nightmareai/real-esrgan
  upscaler: {
    model: 'nightmareai/real-esrgan',
    version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
    inputMap: {
      image:        'fileUrl',
      scale:        'scale',
      face_enhance: 'faceEnhance',
    },
    defaults: {
      scale: 4,
      face_enhance: false,
    },
  },
};

async function main() {
  console.log('🔧 Configuring AI Tools for Replicate…');
  let updated = 0;
  let missing = 0;

  for (const [slug, config] of Object.entries(TOOL_PROVIDER_CONFIG)) {
    const existing = await prisma.aITool.findUnique({ where: { slug } });
    if (!existing) {
      console.warn(`  ⚠️  Tool "${slug}" not found — run \`npm run db:seed\` first.`);
      missing++;
      continue;
    }
    await prisma.aITool.update({
      where: { slug },
      data: {
        provider: 'replicate',
        modelId:  config.model,
        config:   config as any,
      },
    });
    console.log(`  ✓ ${slug.padEnd(15)} → replicate · ${config.model}@${config.version.slice(0, 8)}`);
    updated++;
  }

  console.log(`\nDone: ${updated} configured, ${missing} missing.`);
  if (!process.env.REPLICATE_API_TOKEN) {
    console.warn('\n⚠️  REPLICATE_API_TOKEN is not set in env — jobs will fail until you set it on Railway.');
  }
}

main()
  .catch((err) => { console.error('❌', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
