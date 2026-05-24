/**
 * api/assets.api.js
 * GET /api/assets/:id, /api/assets/:id/versions
 * POST /api/assets/:id/comments
 * POST /api/assets/:id/send-to-review
 * POST /api/asset-versions/:versionId/approve|reject|request-revision
 */

async function getAsset(id) {
  const { data } = await apiClient.get(`/api/assets/${id}`);
  return data.asset;
}

async function getAssetVersions(assetId) {
  const { data } = await apiClient.get(`/api/assets/${assetId}/versions`);
  return data.versions;
}

async function addComment(assetId, body) {
  const { data } = await apiClient.post(`/api/assets/${assetId}/comments`, { body });
  return data.comment;
}

async function sendToReview(assetId) {
  const { data } = await apiClient.post(`/api/assets/${assetId}/send-to-review`);
  return data.asset;
}

async function approveVersion(versionId, comment) {
  const { data } = await apiClient.post(`/api/asset-versions/${versionId}/approve`, { comment });
  return data.review;
}

async function rejectVersion(versionId, comment) {
  const { data } = await apiClient.post(`/api/asset-versions/${versionId}/reject`, { comment });
  return data.review;
}

async function requestRevision(versionId, comment) {
  const { data } = await apiClient.post(`/api/asset-versions/${versionId}/request-revision`, { comment });
  return data.review;
}

const assetsApi = {
  getAsset, getAssetVersions, addComment,
  sendToReview, approveVersion, rejectVersion, requestRevision,
};
window.assetsApi = assetsApi;
