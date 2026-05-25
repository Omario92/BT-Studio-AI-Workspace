/**
 * smoke test: full upload flow — presign → PUT → complete → asset → verify
 * Run: npx ts-node scratch/upload.smoke.ts
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3001/api';
const HOST_URL = 'http://localhost:3001';

// 1×1 white PNG (minimal valid PNG)
const MOCK_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
  '0000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
  'hex'
);

async function run() {
  console.log('🧪 Starting Upload Smoke Test...');

  try {
    // 1. Health
    console.log('\n🏥 1. Health check...');
    const health = await axios.get(`${HOST_URL}/health`);
    console.log(`   ✓ ${health.data.status}`);

    // 2. Auth
    console.log('\n🔑 2. Authenticating...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'alice@btstudio.ai',
      password: 'password123',
    });
    const token = loginRes.data.accessToken;
    if (!token) throw new Error('No token returned');
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    console.log('   ✓ Authenticated');

    // 3. List projects
    console.log('\n📂 3. Fetching projects...');
    const projRes = await axios.get(`${BASE_URL}/projects`, auth);
    const projects = projRes.data.projects || [];
    if (projects.length === 0) throw new Error('No projects found');
    const projectId = projects[0].id;
    console.log(`   ✓ Project: "${projects[0].name}" (${projectId})`);

    // 4. Get a folder to upload into (use first folder)
    const foldRes = await axios.get(`${BASE_URL}/projects/${projectId}/folders`, auth);
    const folders = foldRes.data.folders || [];
    const folderId = folders[0]?.id ?? null;
    console.log(`   ✓ Folder: ${folderId ?? '(root)'}`);

    // 5. Presign upload
    console.log('\n📦 4. Presigning upload...');
    const assetId = `ast_smoke_${Date.now()}`;
    const filename = 'smoke_upload_test.png';
    const mimeType = 'image/png';

    const presignRes = await axios.post(`${BASE_URL}/storage/presign-upload`, {
      projectId,
      assetId,
      versionNumber: 1,
      filename,
      mimeType,
      fileSizeBytes: MOCK_PNG.length,
    }, auth);

    const { uploadUrl, fileKey } = presignRes.data;
    if (!uploadUrl || !fileKey) throw new Error('No uploadUrl / fileKey');
    console.log(`   ✓ uploadUrl=${uploadUrl.slice(0, 80)}...`);
    console.log(`   ✓ fileKey=${fileKey}`);

    // 6. PUT upload
    console.log('\n📤 5. Uploading file...');
    const putRes = await axios.put(uploadUrl, MOCK_PNG, {
      headers: { 'Content-Type': mimeType },
    });
    console.log(`   ✓ PUT status=${putRes.status}`);

    // 7. Complete upload
    console.log('\n🏁 6. Completing upload...');
    const completeRes = await axios.post(`${BASE_URL}/storage/complete-upload`, { fileKey }, auth);
    const fileUrl = completeRes.data.fileUrl;
    if (!fileUrl) throw new Error('No fileUrl returned');
    console.log(`   ✓ fileUrl=${fileUrl}`);

    // 8. Create asset record
    console.log('\n🗂️  7. Registering asset...');
    const assetRes = await axios.post(`${BASE_URL}/assets/upload`, {
      projectId,
      folderId,
      fileName: filename,
      mimeType,
      fileSizeBytes: MOCK_PNG.length,
      fileKey,
      fileUrl,
      metadata: {},
    }, auth);
    const asset = assetRes.data.asset;
    if (!asset?.id) throw new Error('No asset id returned');
    console.log(`   ✓ Asset created: "${asset.name}" (${asset.id})`);

    // 9. Verify asset appears in project
    console.log('\n🔍 8. Verifying asset in project...');
    const assetsRes = await axios.get(
      `${BASE_URL}/projects/${projectId}/assets?limit=50`,
      auth
    );
    const assets = assetsRes.data.assets || [];
    const found = assets.find((a: any) => a.id === asset.id);
    if (!found) throw new Error('Asset not found in project asset list');
    console.log(`   ✓ Asset visible in project (${assets.length} total)`);

    console.log('\n🎉 ALL UPLOAD SMOKE TESTS PASSED!\n');
  } catch (err: any) {
    console.error('\n❌ Test failed:');
    if (err.response) {
      console.error(`  status=${err.response.status}`, err.response.data);
    } else {
      console.error(' ', err.message);
    }
    process.exit(1);
  }
}

run();
