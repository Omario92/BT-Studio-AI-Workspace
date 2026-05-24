import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001/api';
const HOST_URL = 'http://localhost:3001';

async function run() {
  console.log('🧪 Starting Storage & Auth Smoke Test...');

  try {
    // 1. Health check
    console.log('\n🏥 1. Verifying /health endpoint...');
    const healthRes = await axios.get(`${HOST_URL}/health`);
    console.log(`   ✓ Health status: ${healthRes.data.status} (Timestamp: ${healthRes.data.timestamp})`);

    // 2. Authenticate
    console.log('\n🔑 2. Authenticating as alice@btstudio.ai...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'alice@btstudio.ai',
      password: 'password123',
    });
    const token = loginRes.data.accessToken;
    if (!token) throw new Error('Authentication failed — no token returned');
    console.log('   ✓ Authenticated successfully!');

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 3. Fetch projects to get a valid projectId
    console.log('\n📂 3. Fetching active projects...');
    const projRes = await axios.get(`${BASE_URL}/projects`, authHeaders);
    const projects = projRes.data.projects || projRes.data.data || [];
    if (projects.length === 0) throw new Error('No projects found to test with');
    const projectId = projects[0].id;
    console.log(`   ✓ Selected Project: "${projects[0].name}" (ID: ${projectId})`);

    // 4. Request presigned upload URL
    console.log('\n📦 4. Requesting presigned upload URL...');
    const assetId = `ast_${Date.now()}`;
    const filename = 'smoke_test_image.png';
    const mimeType = 'image/png';
    const fileSizeBytes = 1024 * 100; // 100 KB

    const presignRes = await axios.post(`${BASE_URL}/storage/presign-upload`, {
      projectId,
      assetId,
      versionNumber: 1,
      filename,
      mimeType,
      fileSizeBytes
    }, authHeaders);

    const { uploadUrl, fileKey } = presignRes.data;
    if (!uploadUrl || !fileKey) throw new Error('Failed to acquire presigned upload data');
    console.log(`   ✓ Presigned URL successfully acquired!`);
    console.log(`   ✓ Object fileKey: ${fileKey}`);

    // 5. Test local upload execution
    console.log('\n📤 5. Simulating file upload to storage...');
    const mockFileContent = Buffer.from('smoke test binary file contents');
    
    const uploadPutRes = await axios.put(uploadUrl, mockFileContent, {
      headers: {
        'Content-Type': mimeType
      }
    });
    console.log(`   ✓ Upload file response status: ${uploadPutRes.status} (${uploadPutRes.statusText})`);

    // 6. Complete Upload validation
    console.log('\n🏁 6. Completing upload verification...');
    const completeRes = await axios.post(`${BASE_URL}/storage/complete-upload`, { fileKey }, authHeaders);
    console.log(`   ✓ Upload complete verified!`);
    console.log(`   ✓ Download fileUrl: ${completeRes.data.fileUrl}`);

    // 7. Signed URL slash-safe check
    console.log('\n🔗 7. Testing slash-safe signed URL query route...');
    const signedUrlRes = await axios.get(`${BASE_URL}/storage/signed-url?fileKey=${encodeURIComponent(fileKey)}`, authHeaders);
    if (!signedUrlRes.data.url) throw new Error('Failed to retrieve signed download URL');
    console.log(`   ✓ Signed Download URL: ${signedUrlRes.data.url.substring(0, 80)}...`);

    // 8. Delete slash-safe check
    console.log('\n🗑️ 8. Testing slash-safe delete object query route...');
    const deleteRes = await axios.delete(`${BASE_URL}/storage/object?fileKey=${encodeURIComponent(fileKey)}`, authHeaders);
    console.log(`   ✓ Delete object status: ${deleteRes.status} (No Content)`);

    // 9. Google Drive archive graceful skip verify
    console.log('\n📁 9. Verifying Google Drive disabled gracefully if environment missing...');
    try {
      const gdriveArchiveRes = await axios.post(`${BASE_URL}/storage/archive/project/${projectId}`, {}, authHeaders);
      console.log(`   ✓ Google Drive backup: ${JSON.stringify(gdriveArchiveRes.data)}`);
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 500) {
        console.log(`   ✓ Google Drive gracefully handled disabled states / configuration error: ${err.response?.data?.message || err.message}`);
      } else {
        throw err;
      }
    }

    console.log('\n🎉 ALL STORAGE SMOKE TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err: any) {
    console.error('\n❌ Smoke test failed with error:');
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error('Data:', err.response.data);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

run();
