/**
 * R2 Orphan Cleanup
 * ─────────────────
 * Reconciles the storage bucket with the DB. Lists every object under a prefix,
 * compares against keys referenced by Assets / AssetVersions, and reports (or
 * deletes) anything left over.
 *
 * USAGE
 *   Dry-run (default):
 *     npx tsx scratch/r2-orphan-cleanup.ts
 *     npx tsx scratch/r2-orphan-cleanup.ts --prefix projects/ --limit 5000
 *
 *   Delete (DESTRUCTIVE — requires double confirmation):
 *     CONFIRM_R2_ORPHAN_DELETE=true npx tsx scratch/r2-orphan-cleanup.ts --delete
 *
 *   Export orphan list to a file for review:
 *     npx tsx scratch/r2-orphan-cleanup.ts --out orphans.json
 *
 * Safety
 *   • Only keys starting with projects/ tmp/ uploads/ are considered
 *   • CONFIRM_R2_ORPHAN_DELETE=true env var required for delete mode
 *   • Deletes in batches of 1000 (S3 DeleteObjects limit)
 */
import 'dotenv/config';
import fs from 'fs';
import prisma from '../src/config/database';
import { storageService } from '../src/modules/storage/storage.service';
import { extractAssetStorageKeys, SAFE_KEY_PREFIXES } from '../src/modules/assets/asset-storage-keys';

const args = new Map<string, string | true>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const eq = a.indexOf('=');
  if (eq > -1) args.set(a.slice(2, eq), a.slice(eq + 1));
  else if (i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--')) {
    args.set(a.slice(2), process.argv[++i]);
  } else {
    args.set(a.slice(2), true);
  }
}

const PREFIX = String(args.get('prefix') ?? 'projects/');
const LIMIT  = Number(args.get('limit') ?? Infinity);
const DELETE = args.has('delete');
const OUT    = args.get('out') as string | undefined;

async function collectDbReferencedKeys(): Promise<Set<string>> {
  const keys = new Set<string>();

  // 1. Assets with their versions
  const BATCH = 500;
  let skip = 0;
  for (;;) {
    const assets = await prisma.asset.findMany({
      take: BATCH,
      skip,
      include: { versions: true },
    });
    if (assets.length === 0) break;
    for (const a of assets) {
      for (const k of extractAssetStorageKeys(a)) keys.add(k);
    }
    skip += assets.length;
    if (assets.length < BATCH) break;
  }

  return keys;
}

async function listAllObjects(prefix: string, max: number): Promise<string[]> {
  if (typeof (storageService as any).listObjects !== 'function') {
    throw new Error('Active storage provider does not implement listObjects (only S3/R2 supported).');
  }

  const all: string[] = [];
  let token: string | undefined;
  for (;;) {
    const res = await (storageService as any).listObjects(prefix, {
      maxKeys: 1000,
      continuationToken: token,
    });
    all.push(...res.keys);
    if (all.length >= max) return all.slice(0, max);
    if (!res.isTruncated) return all;
    token = res.nextContinuationToken;
  }
}

async function main() {
  console.log('🔎 R2 Orphan Reconciliation');
  console.log(`   prefix:  ${PREFIX}`);
  console.log(`   limit:   ${Number.isFinite(LIMIT) ? LIMIT : 'unbounded'}`);
  console.log(`   mode:    ${DELETE ? '⚠️  DELETE' : 'dry-run'}\n`);

  // Safety: only allow listing/deleting under our own prefixes
  if (!SAFE_KEY_PREFIXES.some(p => PREFIX.startsWith(p))) {
    throw new Error(`Refusing to operate on prefix "${PREFIX}". Allowed: ${SAFE_KEY_PREFIXES.join(', ')}`);
  }

  console.log('📚 Loading DB-referenced keys…');
  const dbKeys = await collectDbReferencedKeys();
  console.log(`   ${dbKeys.size} keys referenced by DB.`);

  console.log('📦 Listing R2 objects…');
  const r2Keys = await listAllObjects(PREFIX, LIMIT);
  console.log(`   ${r2Keys.length} keys in R2 under "${PREFIX}".`);

  const orphans = r2Keys.filter(k => !dbKeys.has(k));
  console.log(`\n🟡 Orphan count: ${orphans.length}`);
  console.log('   First 50:');
  orphans.slice(0, 50).forEach(k => console.log(`     - ${k}`));

  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify({ prefix: PREFIX, dbKeyCount: dbKeys.size, r2KeyCount: r2Keys.length, orphans }, null, 2));
    console.log(`\n💾 Wrote full orphan list → ${OUT}`);
  }

  if (!DELETE) {
    console.log('\n✅ Dry-run complete. Re-run with --delete + CONFIRM_R2_ORPHAN_DELETE=true to remove orphans.');
    return;
  }

  if (process.env.CONFIRM_R2_ORPHAN_DELETE !== 'true') {
    throw new Error('--delete requires CONFIRM_R2_ORPHAN_DELETE=true in env');
  }

  if (orphans.length === 0) {
    console.log('\n✅ Nothing to delete.');
    return;
  }

  console.log(`\n🗑️  Deleting ${orphans.length} orphan(s) in chunks of 1000…`);
  if (typeof (storageService as any).deleteObjects !== 'function') {
    throw new Error('Active storage provider does not implement deleteObjects.');
  }
  const result = await (storageService as any).deleteObjects(orphans);
  console.log(`   deleted: ${result.deleted.length}`);
  console.log(`   failed:  ${result.failed.length}`);
  if (result.failed.length > 0) {
    console.log('\nFirst 10 failures:');
    result.failed.slice(0, 10).forEach((f: any) => console.log(`   - ${f.fileKey}: ${f.error}`));
  }
}

main()
  .catch((err) => { console.error('\n❌', err.message ?? err); process.exit(1); })
  .finally(() => prisma.$disconnect());
