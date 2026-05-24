/**
 * api/jobs.api.js
 * GET /api/jobs?projectId=, /api/jobs/:id
 * POST /api/jobs, /api/jobs/:id/cancel, /api/jobs/:id/retry
 */

// ─── Fallback mock data (mirrors workspace-home.jsx RECENT_JOBS) ─

const MOCK_RECENT_JOBS = [
  { id: 'job_frame18',  name: 'Frame_18_v3 cyberpunk street', type: 'IMAGE_GENERATION', tool: { name: 'Image Generator' }, status: 'RUNNING',   progress: 64, createdAt: new Date(Date.now() - 60000).toISOString(),         project: { name: 'Huda Commercial' } },
  { id: 'job_upscale',  name: 'KV_Hero_Image upscaled to 4K', type: 'IMAGE_UPSCALE',    tool: { name: 'Image Upscaler'   }, status: 'COMPLETED', progress: 100, createdAt: new Date(Date.now() - 3*60000).toISOString(),      project: { name: 'Huda Commercial' } },
  { id: 'job_video',    name: 'Halida 60s spot · scene 02',   type: 'VIDEO_GENERATION', tool: { name: 'Video Generator'  }, status: 'QUEUED',    progress: 0,  createdAt: new Date(Date.now() - 5*60000).toISOString(),       project: { name: 'Halida Fresh Beer' } },
  { id: 'job_retouch',  name: 'Bottle_Hero_v1 retouch',       type: 'IMAGE_EDIT',       tool: { name: 'Image Editor'     }, status: 'FAILED',    progress: 0,  createdAt: new Date(Date.now() - 8*60000).toISOString(),       project: { name: 'Halida Fresh Beer' } },
  { id: 'job_voice',    name: 'Maria_VO narration v2',         type: 'VOICE_GENERATION', tool: { name: 'Voice Generator'  }, status: 'COMPLETED', progress: 100, createdAt: new Date(Date.now() - 12*60000).toISOString(),     project: { name: 'Huda Commercial' } },
];

// ─── API functions ───────────────────────────

async function listJobs({ projectId, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (projectId) params.set('projectId', projectId);
  try {
    const { data } = await apiClient.get(`/api/jobs?${params}`);
    return { data: data.jobs, pagination: data.pagination, fromCache: false };
  } catch (err) {
    if (err.offline) {
      return {
        data: MOCK_RECENT_JOBS,
        pagination: { page: 1, limit: 20, total: MOCK_RECENT_JOBS.length, totalPages: 1 },
        fromCache: true,
      };
    }
    throw err;
  }
}

async function getJob(id) {
  const { data } = await apiClient.get(`/api/jobs/${id}`);
  return data.job;
}

async function createJob({ name, type, projectId, toolId, params }) {
  const { data } = await apiClient.post('/api/jobs', { name, type, projectId, toolId, params });
  return data.job;
}

async function cancelJob(id) {
  const { data } = await apiClient.post(`/api/jobs/${id}/cancel`);
  return data.job;
}

async function retryJob(id) {
  const { data } = await apiClient.post(`/api/jobs/${id}/retry`);
  return data.job;
}

async function createBatch({ projectId, toolId, inputs }) {
  try {
    const { data } = await apiClient.post('/api/jobs/batches', { projectId, toolId, inputs });
    return { data, fromCache: false };
  } catch (err) {
    if (err.offline) {
      const batchId = `mock_batch_${Date.now()}`;
      return { data: { batchId, totalJobs: inputs.length, mock: true }, fromCache: true };
    }
    throw err;
  }
}

async function getBatchStatus(batchId) {
  try {
    const { data } = await apiClient.get(`/api/jobs/batches/${batchId}`);
    return { data, fromCache: false };
  } catch (err) {
    if (err.offline) {
      return {
        data: {
          batchId,
          total: 30,
          completed: 22,
          failed: 4,
          running: 4,
          jobs: Array.from({ length: 30 }, (_, i) => ({
            id: `mock_job_${i}`,
            name: `Mock Batch Frame ${i}`,
            status: i < 22 ? 'COMPLETED' : i < 26 ? 'RUNNING' : 'FAILED',
            progress: i < 22 ? 100 : i < 26 ? 64 : 0,
            assets: i < 22 ? [{ id: `ast_${i}`, fileUrl: '' }] : [],
          })),
        },
        fromCache: true,
      };
    }
    throw err;
  }
}

async function retryBatch(batchId) {
  const { data } = await apiClient.post(`/api/jobs/batches/${batchId}/retry-failed`);
  return data;
}

async function cancelBatch(batchId) {
  const { data } = await apiClient.post(`/api/jobs/batches/${batchId}/cancel`);
  return data;
}

const jobsApi = { 
  listJobs, getJob, createJob, cancelJob, retryJob,
  createBatch, getBatchStatus, retryBatch, cancelBatch 
};
window.jobsApi = jobsApi;
