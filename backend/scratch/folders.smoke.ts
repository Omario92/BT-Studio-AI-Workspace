/**
 * smoke test: folders — create, list, rename, delete
 * Run: npx ts-node scratch/folders.smoke.ts
 */
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';
const HOST_URL = 'http://localhost:3001';

async function run() {
  console.log('🧪 Starting Folders Smoke Test...');

  try {
    // 1. Health check
    console.log('\n🏥 1. Health check...');
    const healthRes = await axios.get(`${HOST_URL}/health`);
    console.log(`   ✓ status=${healthRes.data.status}`);

    // 2. Authenticate
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

    // 4. List existing folders
    console.log('\n📁 4. Listing folders...');
    const foldRes = await axios.get(`${BASE_URL}/projects/${projectId}/folders`, auth);
    const existing = foldRes.data.folders || [];
    console.log(`   ✓ ${existing.length} folder(s) found`);

    // 5. Create a new folder
    console.log('\n➕ 5. Creating folder...');
    const createRes = await axios.post(`${BASE_URL}/projects/${projectId}/folders`, {
      name: `SmokeTest_${Date.now()}`,
    }, auth);
    const newFolder = createRes.data.folder;
    if (!newFolder?.id) throw new Error('Folder not returned from create');
    console.log(`   ✓ Created: "${newFolder.name}" (${newFolder.id})`);

    // 6. List folders again — new folder should appear
    console.log('\n📋 6. Listing folders after create...');
    const foldRes2 = await axios.get(`${BASE_URL}/projects/${projectId}/folders`, auth);
    const updated = foldRes2.data.folders || [];
    const found = updated.find((f: any) => f.id === newFolder.id);
    if (!found) throw new Error('New folder not found in list');
    console.log(`   ✓ New folder visible (${updated.length} total)`);

    // 7. Rename the folder
    console.log('\n✏️  7. Renaming folder...');
    const renameRes = await axios.patch(`${BASE_URL}/folders/${newFolder.id}`, {
      name: 'SmokeTest_Renamed',
    }, auth);
    if (renameRes.data.folder.name !== 'SmokeTest_Renamed') throw new Error('Rename mismatch');
    console.log(`   ✓ Renamed to "${renameRes.data.folder.name}"`);

    // 8. Delete the folder
    console.log('\n🗑️  8. Deleting folder...');
    const deleteRes = await axios.delete(`${BASE_URL}/folders/${newFolder.id}`, auth);
    if (deleteRes.status !== 204) throw new Error(`Expected 204, got ${deleteRes.status}`);
    console.log('   ✓ Deleted (204 No Content)');

    console.log('\n🎉 ALL FOLDER SMOKE TESTS PASSED!\n');
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
