/**
 * V0.6 smoke test — Asset → AI Workspace → Upscaler → AssetVersion.
 *
 * Run:
 *   cd backend
 *   npx tsx scratch/use-with-ai-upscale.smoke.ts
 *
 * Configure:
 *   BT_API_BASE   default http://localhost:3001
 *   BT_EMAIL      default alice@bt-studio.com (from prisma/seed.ts)
 *   BT_PASSWORD   default password
 *
 * Asserts:
 *   - /api/assets/use-with-ai accepts IMAGE_UPSCALE single mode
 *   - the AIJob reaches COMPLETED
 *   - job.result.assetVersionId is present
 *   - GET /api/assets/:id/versions returns one more version than before
 */

const API = process.env.BT_API_BASE || 'http://localhost:3001';
const EMAIL = process.env.BT_EMAIL || 'alice@bt-studio.com';
const PASSWORD = process.env.BT_PASSWORD || 'password';

async function http<T = any>(method: string, path: string, opts: {
  token?: string; body?: unknown; headers?: Record<string, string>;
} = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return data as T;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`[smoke] API=${API} user=${EMAIL}`);

  // 1. Login
  const login = await http<any>('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const token = login.token || login.accessToken || login.access_token;
  if (!token) throw new Error('No token in login response');
  console.log('[smoke] logged in');

  // 2. List projects, pick the first
  const projects = await http<any>('GET', '/api/projects', { token });
  const project = (projects.projects || projects.data || projects)[0];
  if (!project) throw new Error('No projects found — seed first');
  console.log(`[smoke] project=${project.id} ${project.name}`);

  // 3. Find an image asset in that project
  const list = await http<any>('GET', `/api/projects/${project.id}/assets`, { token });
  const allAssets: any[] = list.assets || list.data || [];
  const imageAsset = allAssets.find(a => (a.mimeType || '').startsWith('image/'));
  if (!imageAsset) throw new Error('No image asset in project. Upload one or run the seed.');
  console.log(`[smoke] asset=${imageAsset.id} ${imageAsset.name} (v${imageAsset.currentVersion})`);

  // 4. Snapshot version count
  const beforeVersions = await http<any>('GET', `/api/assets/${imageAsset.id}/versions`, { token });
  const beforeCount = (beforeVersions.versions || []).length;
  console.log(`[smoke] versions before = ${beforeCount}`);

  // 5. Trigger use-with-ai
  const trigger = await http<any>('POST', '/api/assets/use-with-ai', {
    token,
    body: {
      assetIds: [imageAsset.id],
      projectId: project.id,
      toolId: 'upscaler',
      jobType: 'IMAGE_UPSCALE',
      mode: 'single',
      params: { scale: 4, faceEnhance: true, detail: 72, denoise: 45 },
    },
  });
  const job = trigger.job;
  if (!job?.id) throw new Error(`No job in response: ${JSON.stringify(trigger)}`);
  console.log(`[smoke] job=${job.id} status=${job.status}`);

  // 6. Poll until terminal
  const deadline = Date.now() + 5 * 60 * 1000; // 5 min
  let final: any = job;
  while (Date.now() < deadline) {
    await sleep(2000);
    const polled = await http<any>('GET', `/api/jobs/${job.id}`, { token });
    final = polled.job || polled;
    process.stdout.write(`\r[smoke] poll status=${final.status} progress=${final.progress ?? 0}%   `);
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(final.status)) break;
  }
  console.log('');

  if (final.status !== 'COMPLETED') {
    throw new Error(`Job did not complete. status=${final.status} err=${final.errorMsg}`);
  }
  const result = final.result || {};
  if (!result.assetVersionId) throw new Error(`Job completed but result.assetVersionId missing: ${JSON.stringify(result)}`);
  console.log(`[smoke] COMPLETED via provider=${result.provider} mockFallback=${!!result.mockFallback}`);
  console.log(`[smoke] result.assetId=${result.assetId} assetVersionId=${result.assetVersionId}`);

  // 7. Verify version count incremented
  const afterVersions = await http<any>('GET', `/api/assets/${imageAsset.id}/versions`, { token });
  const afterCount = (afterVersions.versions || []).length;
  console.log(`[smoke] versions after = ${afterCount}`);
  if (afterCount <= beforeCount) throw new Error(`Version count did not increase (${beforeCount} → ${afterCount})`);

  console.log('[smoke] ✅ PASS — new AssetVersion created on original asset.');
}

main().catch(err => { console.error('[smoke] ❌ FAIL:', err.message || err); process.exit(1); });
