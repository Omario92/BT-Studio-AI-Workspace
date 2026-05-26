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

async function getAssetReviews(assetId) {
  const { data } = await apiClient.get(`/api/assets/${assetId}/reviews`);
  return data.reviews;
}

async function getAssetComments(assetId) {
  const { data } = await apiClient.get(`/api/assets/${assetId}/comments`);
  return data.comments;
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

// ─── Delete (single + bulk) ──────────────────
// Backend deletes the asset AND its R2/S3 files. Response now includes
// deletedFileKeys / failedFileKeys so the UI can warn if storage cleanup
// partially failed.
async function deleteAsset(id, { force = false } = {}) {
  const qs = force ? '?force=true' : '';
  const { data } = await apiClient.delete(`/api/assets/${id}${qs}`);
  // data may be null (204) for old clients; normalize.
  return data ?? { deletedId: id, deletedFileKeys: [], failedFileKeys: [] };
}

async function bulkDelete(assetIds, { force = false } = {}) {
  const { data } = await apiClient.post('/api/assets/bulk-delete', { assetIds, force });
  return data; // { deletedIds, deletedFileKeys, failed }
}

async function getSignedUrl(fileKey) {
  if (!fileKey) return null;

  const { data } = await apiClient.get(
    `/api/storage/signed-url?fileKey=${encodeURIComponent(fileKey)}`
  );

  return data.url || data.fileUrl || null;
}

async function createLocalImageThumbnail(file) {
  if (!file.type.startsWith('image/')) {
    return { localThumbnailUrl: null, thumbnailBlob: null, thumbnailFileName: null };
  }

  const localThumbnailUrl = URL.createObjectURL(file);

  try {
    const blob = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 480;
        const MAX_HEIGHT = 320;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/webp', 0.85);
      };
      img.onerror = () => reject(new Error('Image loading failed'));
      img.src = localThumbnailUrl;
    });

    const originalName = file.name;
    const dotIdx = originalName.lastIndexOf('.');
    const baseName = dotIdx !== -1 ? originalName.slice(0, dotIdx) : originalName;
    const thumbnailFileName = `thumb_${baseName}.webp`;

    return {
      localThumbnailUrl,
      thumbnailBlob: blob,
      thumbnailFileName,
    };
  } catch (err) {
    console.warn('[createLocalImageThumbnail] Failed, fallback to original object URL:', err);
    return {
      localThumbnailUrl,
      thumbnailBlob: null,
      thumbnailFileName: null,
    };
  }
}

async function createLocalVideoThumbnail(file) {
  if (!file.type.startsWith('video/')) {
    return { localThumbnailUrl: null, thumbnailBlob: null, thumbnailFileName: null };
  }

  const localVideoUrl = URL.createObjectURL(file);

  try {
    const blob = await new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = localVideoUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      // Seek to 1 second to avoid black frames
      video.currentTime = 1;

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = video.videoWidth;
          let height = video.videoHeight;

          const MAX_WIDTH = 480;
          const MAX_HEIGHT = 320;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get 2D canvas context'));
            return;
          }
          ctx.drawImage(video, 0, 0, width, height);

          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas toBlob failed'));
          }, 'image/webp', 0.85);
        } catch (e) {
          reject(e);
        }
      };

      video.onerror = () => reject(new Error('Video loading failed'));

      // 5-second safety timeout
      setTimeout(() => {
        reject(new Error('Video thumbnail generation timed out'));
      }, 5000);
    });

    const originalName = file.name;
    const dotIdx = originalName.lastIndexOf('.');
    const baseName = dotIdx !== -1 ? originalName.slice(0, dotIdx) : originalName;
    const thumbnailFileName = `thumb_${baseName}.webp`;

    const localThumbnailUrl = URL.createObjectURL(blob);

    return {
      localThumbnailUrl,
      thumbnailBlob: blob,
      thumbnailFileName,
    };
  } catch (err) {
    console.warn('[createLocalVideoThumbnail] Failed, proceed without video thumbnail:', err);
    return {
      localThumbnailUrl: null,
      thumbnailBlob: null,
      thumbnailFileName: null,
    };
  }
}

async function uploadAsset(projectId, folderId, file, onProgress) {
  const assetId = `ast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // 1. Create local thumbnail
  let thumbData = { localThumbnailUrl: null, thumbnailBlob: null, thumbnailFileName: null };
  if (file.type.startsWith('image/')) {
    thumbData = await createLocalImageThumbnail(file);
  } else if (file.type.startsWith('video/')) {
    thumbData = await createLocalVideoThumbnail(file);
  }

  // 2. Get presigned upload URL for main file
  console.log(`[uploadAsset] Step 1: presign main — project=${projectId}, file=${file.name}`);
  const { data: presign } = await apiClient.post('/api/storage/presign-upload', {
    projectId,
    assetId,
    versionNumber: 1,
    filename: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
  });

  const { uploadUrl, fileKey } = presign;

  const resolveUploadUrl = (url) => {
    if (url.startsWith('http://localhost') && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
      try {
        const urlObj = new URL(url);
        const apiBaseUrl = apiClient.baseUrl || 'https://bt-studio-ai-backend.up.railway.app';
        const apiBaseObj = new URL(apiBaseUrl);
        urlObj.protocol = apiBaseObj.protocol;
        urlObj.host = apiBaseObj.host;
        return urlObj.toString();
      } catch (e) {
        console.error('[assetsApi] Failed to patch local upload URL:', e);
      }
    }
    return url;
  };

  const finalUploadUrl = resolveUploadUrl(uploadUrl);

  // 3. Upload main file binary via PUT
  console.log(`[uploadAsset] Step 2: PUT main upload — url=${finalUploadUrl}`);
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', finalUploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
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
        reject(new Error(`[PUT upload] Main failed with status ${xhr.status}${detail}`));
      }
    };

    xhr.onerror = () => reject(new Error('[PUT upload] Network error during main file upload'));
    xhr.send(file);
  });

  // Complete main upload
  console.log(`[uploadAsset] Step 2.1: complete-upload — key=${fileKey}`);
  const { data: completion } = await apiClient.post('/api/storage/complete-upload', { fileKey });

  // 4. Upload thumbnail if available
  let thumbnailFileKey = null;
  let thumbnailUrl = null;

  if (thumbData.thumbnailBlob) {
    try {
      console.log(`[uploadAsset] Step 3: presign thumbnail — filename=${thumbData.thumbnailFileName}`);
      const { data: thumbPresign } = await apiClient.post('/api/storage/presign-upload', {
        projectId,
        assetId,
        versionNumber: 1,
        filename: thumbData.thumbnailFileName,
        mimeType: thumbData.thumbnailBlob.type,
        fileSizeBytes: thumbData.thumbnailBlob.size,
      });

      const finalThumbUploadUrl = resolveUploadUrl(thumbPresign.uploadUrl);

      console.log(`[uploadAsset] Step 3.1: PUT thumbnail upload — url=${finalThumbUploadUrl}`);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', finalThumbUploadUrl, true);
        xhr.setRequestHeader('Content-Type', thumbData.thumbnailBlob.type);

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`[PUT upload] Thumbnail failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('[PUT upload] Network error during thumbnail upload'));
        xhr.send(thumbData.thumbnailBlob);
      });

      console.log(`[uploadAsset] Step 3.2: complete-upload thumbnail — key=${thumbPresign.fileKey}`);
      const { data: thumbCompletion } = await apiClient.post('/api/storage/complete-upload', { fileKey: thumbPresign.fileKey });

      thumbnailFileKey = thumbPresign.fileKey;
      thumbnailUrl = thumbCompletion.fileUrl;
      console.log(`[uploadAsset] Thumbnail successfully uploaded to Cloudflare R2: ${thumbnailUrl}`);
    } catch (err) {
      console.error('[uploadAsset] Thumbnail upload failed, proceeding without R2 thumbnail:', err);
    }
  }

  // 5. Register Asset in database with both main and thumbnail keys in metadata
  console.log(`[uploadAsset] Step 4: assets/upload — fileUrl=${completion.fileUrl}`);
  const { data: assetData } = await apiClient.post('/api/assets/upload', {
    projectId,
    folderId,
    fileName: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
    fileKey,
    fileUrl: completion.fileUrl,
    metadata: {
      fileKey,
      thumbnailFileKey,
      thumbnailUrl,
      originalFileName: file.name,
    },
  });

  return {
    ...assetData.asset,
    localThumbnailUrl: thumbData.localThumbnailUrl,
    thumbnailUrl: thumbData.localThumbnailUrl || thumbnailUrl,
  };
}

// deleteAsset() + bulkDelete() are defined above (with R2 cleanup support).
// Kept here as a section anchor only.

async function bulkMove(assetIds, targetFolderId) {
  const { data } = await apiClient.post('/api/assets/bulk-move', { assetIds, targetFolderId });
  return data.assets;
}

async function bulkCopy(assetIds, targetFolderId) {
  const { data } = await apiClient.post('/api/assets/bulk-copy', { assetIds, targetFolderId });
  return data.assets;
}

async function bulkDownload(assetIds) {
  const { data } = await apiClient.post('/api/assets/bulk-download', { assetIds });
  return data.files;
}

async function useWithAI(assetIds, { projectId, toolId, jobType, mode, params }) {
  const { data } = await apiClient.post('/api/assets/use-with-ai', {
    assetIds, projectId, toolId, jobType, mode,
    ...(params ? { params } : {}),
  });
  return data;
}

async function renameAsset(assetId, data) {
  const res = await apiClient.patch(`/api/assets/${assetId}`, data);
  return res.data?.asset || res.data;
}

async function bulkDuplicate(assetIds) {
  const res = await apiClient.post("/api/assets/bulk-duplicate", { assetIds });
  return res.data;
}

const assetsApi = {
  getAsset, getAssetVersions, getAssetReviews, getAssetComments,
  addComment, sendToReview, approveVersion, rejectVersion, requestRevision,
  uploadAsset, getSignedUrl, deleteAsset,
  bulkDelete, bulkMove, bulkCopy, bulkDownload, useWithAI,
  renameAsset, bulkDuplicate,
};
window.assetsApi = assetsApi;

