/**
 * api/projects.api.js
 * GET /api/projects, /api/projects/:id, /api/projects/:id/folders,
 *     /api/projects/:id/assets
 *
 * Each function returns { data, fromCache: false } on success,
 * or { data: FALLBACK, fromCache: true } when the backend is offline.
 */

// ─── Fallback mock data (mirrors dashboard.jsx + projects.jsx) ───

const MOCK_PROJECTS = [
  { id: 'proj_huda',   name: 'Huda Commercial',   client: 'Beauty / KV',     progress: 72, tone: 'rose',   status: 'ACTIVE',   isPinned: false, _count: { assets: 12, jobs: 5 } },
  { id: 'proj_halida', name: 'Halida Fresh Beer',  client: 'Beverage / Spot', progress: 44, tone: 'amber',  status: 'ACTIVE',   isPinned: false, _count: { assets: 8,  jobs: 3 } },
  { id: 'proj_excool', name: 'Coolmate Excool KV', client: 'Apparel / KV',    progress: 88, tone: 'teal',   status: 'ACTIVE',   isPinned: false, _count: { assets: 20, jobs: 7 } },
  { id: 'proj_obagi',  name: 'Obagi Skin Lab',     client: 'Skincare / Spot', progress: 31, tone: 'violet', status: 'WIP',      isPinned: false, _count: { assets: 4,  jobs: 1 } },
  { id: 'proj_render', name: 'Product Render V3',  client: 'Internal · R&D',  progress: 64, tone: 'blue',   status: 'WIP',      isPinned: true,  _count: { assets: 6,  jobs: 2 } },
  { id: 'proj_char',   name: 'Character Model 01', client: 'Anim · Pre-prod', progress: 22, tone: 'green',  status: 'WIP',      isPinned: true,  _count: { assets: 3,  jobs: 1 } },
];

const MOCK_FOLDERS = [
  { id: 'f1', name: 'Brief',        depth: 1, children: [], _count: { assets: 2 } },
  { id: 'f2', name: 'Script',       depth: 1, children: [], _count: { assets: 0 } },
  { id: 'f3', name: 'Sketches',     depth: 1, children: [], _count: { assets: 4 } },
  { id: 'f4', name: 'References',   depth: 1, children: [], _count: { assets: 3 } },
  { id: 'f5', name: 'Generated',    depth: 1, children: [], _count: { assets: 5 } },
  { id: 'f6', name: 'Final Output', depth: 1, children: [], _count: { assets: 1 } },
];

const MOCK_ASSETS = [
  { id: 'a1', name: 'KV_Hero_Image_v4.png',    status: 'APPROVED',          currentVersion: 4, mimeType: 'image/png', _count: { comments: 2 } },
  { id: 'a2', name: 'Character_Sheet_v2.jpg',  status: 'IN_REVIEW',         currentVersion: 2, mimeType: 'image/jpeg',_count: { comments: 2 } },
  { id: 'a3', name: 'Frame_18_v3.png',         status: 'APPROVED',          currentVersion: 3, mimeType: 'image/png', _count: { comments: 0 } },
  { id: 'a4', name: 'Environment_Ref_v1.png',  status: 'WIP',               currentVersion: 1, mimeType: 'image/png', _count: { comments: 0 } },
  { id: 'a5', name: 'Product_Render_v3.png',   status: 'WIP',               currentVersion: 3, mimeType: 'image/png', _count: { comments: 1 } },
  { id: 'a6', name: 'Bottle_Hero_v1.png',      status: 'GENERATING',        currentVersion: 1, mimeType: 'image/png', _count: { comments: 0 } },
  { id: 'a7', name: 'Frame_20_v2.png',         status: 'REVISION_REQUESTED',currentVersion: 2, mimeType: 'image/png', _count: { comments: 1 } },
];

// ─── API functions ───────────────────────────

async function listProjects({ page = 1, limit = 20 } = {}) {
  try {
    const { data } = await apiClient.get(`/api/projects?page=${page}&limit=${limit}`);
    return { data: data.projects, pagination: data.pagination, fromCache: false };
  } catch (err) {
    if (err.offline) {
      return {
        data: MOCK_PROJECTS,
        pagination: { page: 1, limit: 20, total: MOCK_PROJECTS.length, totalPages: 1 },
        fromCache: true,
      };
    }
    throw err;
  }
}

async function getProject(id) {
  try {
    const { data } = await apiClient.get(`/api/projects/${id}`);
    return { data: data.project, fromCache: false };
  } catch (err) {
    if (err.offline) {
      const project = MOCK_PROJECTS.find(p => p.id === id) ?? MOCK_PROJECTS[0];
      return { data: { ...project, folders: MOCK_FOLDERS, members: [] }, fromCache: true };
    }
    throw err;
  }
}

async function getProjectFolders(projectId) {
  try {
    const { data } = await apiClient.get(`/api/projects/${projectId}/folders`);
    return { data: data.folders, fromCache: false };
  } catch (err) {
    if (err.offline) return { data: MOCK_FOLDERS, fromCache: true };
    throw err;
  }
}

async function getProjectAssets(projectId, { folderId, status, search, type, sortBy, sortOrder, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (folderId)  params.set('folderId', folderId);
  if (status)    params.set('status', status);
  if (search)    params.set('search', search);
  if (type)      params.set('type', type);
  if (sortBy)    params.set('sortBy', sortBy);
  if (sortOrder) params.set('sortOrder', sortOrder);
  try {
    const { data } = await apiClient.get(`/api/projects/${projectId}/assets?${params}`);
    return { data: data.assets, pagination: data.pagination, fromCache: false };
  } catch (err) {
    if (err.offline) {
      return {
        data: MOCK_ASSETS,
        pagination: { page: 1, limit: 50, total: MOCK_ASSETS.length, totalPages: 1 },
        fromCache: true,
      };
    }
    throw err;
  }
}

async function createFolder(projectId, { name, parentId } = {}) {
  const { data } = await apiClient.post(`/api/projects/${projectId}/folders`, { name, parentId });
  return { data: data.folder, fromCache: false };
}

async function renameFolder(folderId, { name }) {
  const { data } = await apiClient.patch(`/api/folders/${folderId}`, { name });
  return { data: data.folder, fromCache: false };
}

async function deleteFolder(folderId, { force = false } = {}) {
  await apiClient.delete(`/api/folders/${folderId}?force=${force}`);
  return { fromCache: false };
}

const projectsApi = {
  listProjects, getProject, getProjectFolders, getProjectAssets,
  createFolder, renameFolder, deleteFolder,
};
window.projectsApi = projectsApi;
