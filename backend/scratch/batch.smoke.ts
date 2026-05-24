import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

async function run() {
  console.log('🧪 Starting Batch Execution Smoke Test...');

  try {
    // 1. Authenticate
    console.log('\n🔑 1. Authenticating...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'alice@btstudio.ai',
      password: 'password123',
    });
    const token = loginRes.data.accessToken;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Fetch projects
    const projRes = await axios.get(`${BASE_URL}/projects`, authHeaders);
    const projects = projRes.data.projects || projRes.data.data || [];
    const projectId = projects[0].id;

    // Fetch tools to get a valid toolId to satisfy foreign key constraint
    console.log('\n🛠️ Fetching available AI tools...');
    const toolsRes = await axios.get(`${BASE_URL}/tools`, authHeaders);
    const tools = toolsRes.data.tools || toolsRes.data.data || [];
    const toolId = tools.length > 0 ? tools[0].id : undefined;
    console.log(`   ✓ Selected AI Tool ID: ${toolId || 'None (using undefined)'}`);

    // 3. Dispatch a batch run
    console.log('\n🚀 2. Enqueuing multiple frames as a single batch job...');
    const batchRes = await axios.post(`${BASE_URL}/jobs/batches`, {
      projectId,
      toolId,
      inputs: [
        { name: 'Batch frame 01', params: { prompt: 'style 1 cyberpunk' } },
        { name: 'Batch frame 02', params: { prompt: 'style 2 cyberpunk' } },
        { name: 'Batch frame 03', params: { prompt: 'style 3 cyberpunk' } }
      ]
    }, authHeaders);

    const { batchId, totalJobs, jobs } = batchRes.data;
    if (!batchId) throw new Error('Batch creation failed');
    console.log(`   ✓ Batch successfully created! ID: ${batchId}`);
    console.log(`   ✓ Total frames enqueued: ${totalJobs} (Child jobs: ${jobs.length})`);

    // 4. Retrieve batch status
    console.log('\n🔍 3. Fetching batch status progress...');
    const statusRes = await axios.get(`${BASE_URL}/jobs/batches/${batchId}`, authHeaders);
    console.log(`   ✓ Batch ID: ${statusRes.data.batchId}`);
    console.log(`   ✓ Completed: ${statusRes.data.completed}, Running: ${statusRes.data.running}, Failed: ${statusRes.data.failed}, Total: ${statusRes.data.total}`);

    // 5. Test batch retry-failed route exists
    console.log('\n🔄 4. Testing failed batch retry endpoint existence...');
    const retryRes = await axios.post(`${BASE_URL}/jobs/batches/${batchId}/retry-failed`, {}, authHeaders);
    console.log(`   ✓ Batch retry status response received! Total enqueued count: ${retryRes.data.total}`);

    // 6. Test batch cancel route exists
    console.log('\n🛑 5. Testing active batch cancel endpoint existence...');
    const cancelRes = await axios.post(`${BASE_URL}/jobs/batches/${batchId}/cancel`, {}, authHeaders);
    console.log(`   ✓ Batch cancel status response received! Total cancelled count: ${cancelRes.data.total}`);

    console.log('\n🎉 ALL BATCH SMOKE TESTS PASSED SUCCESSFULLY! 🎉\n');
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
