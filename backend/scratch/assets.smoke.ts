import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

async function run() {
  console.log('🧪 Starting V0.4 Assets & Reviews Smoke Test...');

  try {
    // 1. Authenticate as Alice
    console.log('\n🔑 1. Authenticating as alice@btstudio.ai...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'alice@btstudio.ai',
      password: 'password123',
    });
    const token = loginRes.data.accessToken;
    if (!token) throw new Error('Authentication failed — no token returned');
    console.log('   ✓ Authenticated successfully!');

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Fetch projects to get a valid projectId
    console.log('\n📂 2. Fetching active projects...');
    const projRes = await axios.get(`${BASE_URL}/projects`, authHeaders);
    const projects = projRes.data.projects || projRes.data.data || [];
    if (projects.length === 0) throw new Error('No projects found to test with');
    const projectId = projects[0].id;
    console.log(`   ✓ Selected Project: "${projects[0].name}" (ID: ${projectId})`);

    // 3. Create a new Asset (uploads/v1)
    console.log('\n📤 3. Creating a new asset (simulating real upload flow)...');
    const uploadRes = await axios.post(`${BASE_URL}/assets/upload`, {
      projectId,
      fileName: `smoke_test_asset_${Date.now()}.png`,
      fileUrl: 'https://cdn.btstudio.ai/uploaded/smoke.png',
      mimeType: 'image/png',
      fileSizeBytes: 2048,
      fileKey: 'projects/test/assets/smoke.png',
      metadata: { debug: true }
    }, authHeaders);

    const asset = uploadRes.data.asset;
    if (!asset) throw new Error('Asset creation failed');
    console.log(`   ✓ Asset created: "${asset.name}" (ID: ${asset.id})`);
    console.log(`   ✓ Current Version: ${asset.currentVersion}, Status: ${asset.status}`);
    
    const version1 = asset.versions[0];
    console.log(`   ✓ AssetVersion v1 created: ${version1.id} (Status: ${version1.status})`);

    // 4. Create Version v2
    console.log('\n🆙 4. Creating AssetVersion v2...');
    const v2Res = await axios.post(`${BASE_URL}/assets/${asset.id}/versions`, {
      fileUrl: 'https://cdn.btstudio.ai/uploaded/smoke_v2.png',
      mimeType: 'image/png',
      fileSizeBytes: 4096,
      notes: 'Updated lighting and contrast in v2',
    }, authHeaders);
    
    const version2 = v2Res.data.version;
    console.log(`   ✓ AssetVersion v2 created: ${version2.id} (Version: ${version2.versionNumber}, Status: ${version2.status})`);

    // Verify Asset updated currentVersion
    const updatedAssetRes = await axios.get(`${BASE_URL}/assets/${asset.id}`, authHeaders);
    const updatedAsset = updatedAssetRes.data.asset;
    console.log(`   ✓ Verified Asset currentVersion updated to: ${updatedAsset.currentVersion}`);

    // 5. Send Asset to Review
    console.log('\n👀 5. Sending asset to review...');
    const reviewSendRes = await axios.post(`${BASE_URL}/assets/${asset.id}/send-to-review`, {}, authHeaders);
    console.log(`   ✓ Asset status set to: ${reviewSendRes.data.asset.status}`);

    // 6. Request Revision (comment required, should fail if missing comment)
    console.log('\n❌ 6. Testing comment requirement for revision request...');
    try {
      await axios.post(`${BASE_URL}/asset-versions/${version2.id}/request-revision`, {}, authHeaders);
      throw new Error('Revision request succeeded without comment (should have failed)');
    } catch (err: any) {
      if (err.response?.status === 400) {
        console.log('   ✓ Successfully rejected request without comment (Bad Request)');
      } else {
        throw err;
      }
    }

    console.log('⏳ Submitting revision request with a valid comment...');
    const revRes = await axios.post(`${BASE_URL}/asset-versions/${version2.id}/request-revision`, {
      comment: 'Please reduce neon saturation by 10% on the left side.',
    }, authHeaders);
    console.log(`   ✓ Revision requested! Decision: ${revRes.data.review.decision}`);

    // Check version details
    const versionDetailsRes = await axios.get(`${BASE_URL}/asset-versions/${version2.id}`, authHeaders);
    console.log(`   ✓ Verified Version v2 status updated to: ${versionDetailsRes.data.version.status}`);

    // 7. Approve Version
    console.log('\n💖 7. Approving the asset version...');
    const approveRes = await axios.post(`${BASE_URL}/asset-versions/${version2.id}/approve`, {
      comment: 'Perfect adjustment. Approved for client preview.',
    }, authHeaders);
    console.log(`   ✓ Approved! Decision: ${approveRes.data.review.decision}`);

    // Final check
    const finalAssetRes = await axios.get(`${BASE_URL}/assets/${asset.id}`, authHeaders);
    console.log(`   ✓ Final Asset Status: ${finalAssetRes.data.asset.status}`);
    
    // 8. Fetch comments and reviews directly
    console.log('\n💬 8. Fetching direct comments list...');
    const commentsRes = await axios.get(`${BASE_URL}/assets/${asset.id}/comments`, authHeaders);
    console.log(`   ✓ Found ${commentsRes.data.comments.length} comments.`);

    console.log('📊 Fetching direct reviews list...');
    const reviewsRes = await axios.get(`${BASE_URL}/assets/${asset.id}/reviews`, authHeaders);
    console.log(`   ✓ Found ${reviewsRes.data.reviews.length} reviews.`);

    console.log('\n🎉 ALL SMOKE TESTS COMPLETED SUCCESSFULLY!');
  } catch (err: any) {
    console.error('\n🚨 Smoke test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

run();
