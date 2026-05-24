/**
 * api/activity.api.js
 * GET /api/activity  — global activity log
 * GET /api/dashboard/summary  — KPIs + recent items
 */

// ─── Fallback mock data (mirrors dashboard.jsx + activity.jsx) ──

const MOCK_DASHBOARD = {
  kpi: {
    activeProjects: 24,
    framesGenerated7d: 1287,
    awaitingApproval: 42,
    gpuQueueRunning: 2,
    gpuQueueQueued: 3,
  },
  assignments: [
    { id: 'a1', title: 'Review Style Transfer — Huda KV v4',     dueAt: new Date().toISOString(),                                  isDone: false, project: { name: 'Huda Commercial' } },
    { id: 'a2', title: 'Generate 50 Icon Variants — Excool',      dueAt: new Date(Date.now() + 86400000).toISOString(),             isDone: false, project: { name: 'Coolmate Excool KV' } },
    { id: 'a3', title: 'Feedback on Model 01 — pass B',           dueAt: new Date(Date.now() - 2 * 86400000).toISOString(),         isDone: false, project: { name: 'Character Model 01' } },
    { id: 'a4', title: 'Approve Storyboard — Halida 60s cut',     dueAt: new Date(Date.now() + 4 * 86400000).toISOString(),         isDone: false, project: { name: 'Halida Fresh Beer' } },
  ],
  recentProjects: [
    { id: 'proj_huda',   name: 'Huda Commercial',   client: 'Beauty / KV',     progress: 72, tone: 'rose',   _count: { assets: 12 } },
    { id: 'proj_halida', name: 'Halida Fresh Beer',  client: 'Beverage / Spot', progress: 44, tone: 'amber',  _count: { assets: 8  } },
    { id: 'proj_excool', name: 'Coolmate Excool KV', client: 'Apparel / KV',    progress: 88, tone: 'teal',   _count: { assets: 20 } },
    { id: 'proj_obagi',  name: 'Obagi Skin Lab',     client: 'Skincare / Spot', progress: 31, tone: 'violet', _count: { assets: 4  } },
  ],
  recentActivity: [
    { id: 'al1', action: 'approved',        entityType: 'asset', detail: 'Frame_18_v3.png on Halida Fresh Beer',     user: { name: 'Sarah M.'  }, project: { name: 'Halida Fresh Beer' },  createdAt: new Date(Date.now() - 12 * 60000).toISOString() },
    { id: 'al2', action: 'uploaded',        entityType: 'asset', detail: 'Environment_Ref_v1.png to Huda Commercial', user: { name: 'David Kim' }, project: { name: 'Huda Commercial' },    createdAt: new Date(Date.now() - 60 * 60000).toISOString() },
    { id: 'al3', action: 'completed batch', entityType: 'job',   detail: '32 frames · Excool sketch pack',            user: { name: 'Tom L.'    }, project: { name: 'Coolmate Excool KV' }, createdAt: new Date(Date.now() - 62 * 60000).toISOString() },
    { id: 'al4', action: 'commented on',    entityType: 'asset', detail: 'Character_Sheet_v2.jpg',                    user: { name: 'Maria R.'  }, project: { name: 'Huda Commercial' },    createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
    { id: 'al5', action: 'started',         entityType: 'job',   detail: 'AI Engine v4.0 — char-consistency model',   user: { name: 'Alice Chen'}, project: { name: 'Huda Commercial' },    createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: 'al6', action: 'regenerated',     entityType: 'asset', detail: 'KV_Hero_Image_v4.png',                      user: { name: 'Tom L.'    }, project: { name: 'Huda Commercial' },    createdAt: new Date(Date.now() - 24 * 3600000).toISOString() },
  ],
};

const MOCK_ACTIVITY = MOCK_DASHBOARD.recentActivity;

// ─── API functions ───────────────────────────

async function getDashboardSummary() {
  try {
    const { data } = await apiClient.get('/api/dashboard/summary');
    return { data, fromCache: false };
  } catch (err) {
    if (err.offline) return { data: MOCK_DASHBOARD, fromCache: true };
    throw err;
  }
}

async function getActivity({ projectId, userId, action, limit = 30, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (projectId) params.set('projectId', projectId);
  if (userId)    params.set('userId', userId);
  if (action)    params.set('action', action);
  try {
    const { data } = await apiClient.get(`/api/activity?${params}`);
    return { data: data.logs, total: data.total, fromCache: false };
  } catch (err) {
    if (err.offline) return { data: MOCK_ACTIVITY, total: MOCK_ACTIVITY.length, fromCache: true };
    throw err;
  }
}

const activityApi = { getDashboardSummary, getActivity };
window.activityApi = activityApi;
