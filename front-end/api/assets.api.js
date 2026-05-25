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

async function uploadAsset(projectId, folderId, file, onProgress) {
  // 1. Get presigned upload URL
  console.log(`[uploadAsset] Step 1: presign — project=${projectId}, file=${file.name}`);
  const { data: presign } = await apiClient.post('/api/storage/presign-upload', {
    projectId,
    assetId: `ast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    versionNumber: 1,
    filename: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
  });

  const { uploadUrl, fileKey } = presign;

  // Self-heal: If uploadUrl contains localhost but browser is NOT on localhost, rewrite it to use production backend
  let finalUploadUrl = uploadUrl;
  if (uploadUrl.startsWith('http://localhost') && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    try {
      const urlObj = new URL(uploadUrl);
      const apiBaseUrl = apiClient.baseUrl || 'https://bt-studio-ai-backend.up.railway.app';
      const apiBaseObj = new URL(apiBaseUrl);
      urlObj.protocol = apiBaseObj.protocol;
      urlObj.host = apiBaseObj.host;
      finalUploadUrl = urlObj.toString();
      console.log(`[assetsApi] Patched local upload URL to production host: ${finalUploadUrl}`);
    } catch (e) {
      console.error('[assetsApi] Failed to patch local upload URL:', e);
    }
  }

  console.log(`[uploadAsset] Step 2: PUT upload — url=${finalUploadUrl}, key=${fileKey}`);
  // 2. Upload raw file binary via PUT
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', finalUploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded * 100) / e.total);
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        const detail = xhr.responseText ? ` — ${xhr.responseText.slice(0, 200)}` : '';
        reject(new Error(`[PUT upload] Failed with status ${xhr.status}${detail}`));
      }
    };

    xhr.onerror = () => reject(new Error('[PUT upload] Network error during file upload'));
    xhr.send(file);
  });

  // 3. Confirm completion
  console.log(`[uploadAsset] Step 3: complete-upload — key=${fileKey}`);
  const { data: completion } = await apiClient.post('/api/storage/complete-upload', { fileKey });

  // 4. Register Asset + Version v1 in database
  console.log(`[uploadAsset] Step 4: assets/upload — fileUrl=${completion.fileUrl}`);
  const { data: assetData } = await apiClient.post('/api/assets/upload', {
    projectId,
    folderId,
    fileName: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
    fileKey,
    fileUrl: completion.fileUrl,
    metadata: {},
  });

  return assetData.asset;
}

const assetsApi = {
  getAsset, getAssetVersions, addComment,
  sendToReview, approveVersion, rejectVersion, requestRevision,
  uploadAsset,
};
window.assetsApi = assetsApi;
