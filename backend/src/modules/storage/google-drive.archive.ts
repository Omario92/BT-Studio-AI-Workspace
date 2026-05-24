import axios from 'axios';
import { googleDriveArchiveProvider } from './google-drive.storage';
import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import logger from '../../utils/logger';
import fs from 'fs';
import path from 'path';

export async function archiveAssetVersionToDrive(versionId: string, userId: string) {
  if (!googleDriveArchiveProvider.isEnabled()) {
    throw Errors.BadRequest('Google Drive archiving is currently disabled or unconfigured');
  }

  // 1. Fetch version and asset details
  const version = await prisma.assetVersion.findUnique({
    where: { id: versionId },
    include: {
      asset: {
        include: {
          project: true,
          folder: true,
        },
      },
    },
  });

  if (!version) throw Errors.NotFound('Asset version not found');
  if (!version.fileUrl) throw Errors.BadRequest('This version has no associated file URL to archive');

  logger.info({ versionId, fileUrl: version.fileUrl }, 'Archiving asset version to Google Drive');

  // 2. Fetch the file buffer
  let fileBuffer: Buffer;
  
  if (version.fileUrl.startsWith('http://localhost') && version.fileUrl.includes('/api/storage/files/')) {
    // Local dev file optimization — read straight from disk instead of HTTP
    const fileKey = version.fileUrl.split('/api/storage/files/')[1];
    const baseDir = path.resolve(process.env.STORAGE_LOCAL_PATH || './uploads');
    const safeKey = fileKey.replace(/\//g, path.sep);
    const filePath = path.join(baseDir, safeKey);
    
    if (!fs.existsSync(filePath)) {
      throw Errors.NotFound('Local asset file not found on disk');
    }
    fileBuffer = await fs.promises.readFile(filePath);
  } else {
    // Public download copy
    const response = await axios.get(version.fileUrl, { responseType: 'arraybuffer' });
    fileBuffer = Buffer.from(response.data);
  }

  // 3. Resolve parent folder on Google Drive
  const projectName = version.asset.project.name;
  const categoryFolder = version.asset.folder?.name || 'Generated';
  const driveFolderId = await googleDriveArchiveProvider.getProjectFolderId(projectName, categoryFolder);

  // 4. Upload to Google Drive
  const filename = `${version.asset.name.split('.')[0]}_v${version.versionNumber}${path.extname(version.asset.name)}`;
  const mimeType = version.mimeType || 'image/png';
  
  // Convert buffer to readable stream for drive api upload
  const { Readable } = await import('stream');
  const stream = Readable.from(fileBuffer);

  const driveFile = await googleDriveArchiveProvider.uploadFile(
    driveFolderId,
    filename,
    stream,
    mimeType
  );

  logger.info({ driveFileId: driveFile.id }, 'Successfully uploaded asset version to Google Drive');

  // 5. Update Version Metadata with Google Drive details
  const existingMeta = (version.params as Record<string, any>) || {};
  const updatedMeta = {
    ...existingMeta,
    googleDriveFileId: driveFile.id,
    googleDriveWebViewLink: driveFile.webViewLink,
    archivedAt: new Date().toISOString(),
  };

  const updatedVersion = await prisma.assetVersion.update({
    where: { id: versionId },
    data: {
      params: updatedMeta as any,
    },
  });

  // 6. Log Activity
  await prisma.activityLog.create({
    data: {
      action: 'archived version',
      entityType: 'asset',
      entityId: version.assetId,
      detail: `v${version.versionNumber} archived to Drive`,
      userId,
      projectId: version.asset.projectId,
      assetId: version.assetId,
    },
  });

  return {
    success: true,
    googleDriveFileId: driveFile.id,
    googleDriveWebViewLink: driveFile.webViewLink,
    version: updatedVersion,
  };
}

export async function archiveProjectToDrive(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assets: {
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1, // Only archive the latest/current version of each asset
          },
        },
      },
    },
  });

  if (!project) throw Errors.NotFound('Project not found');

  logger.info({ projectId }, 'Archiving entire project to Google Drive');

  const results = [];
  for (const asset of project.assets) {
    if (asset.versions.length > 0) {
      const latestVersion = asset.versions[0];
      try {
        const res = await archiveAssetVersionToDrive(latestVersion.id, userId);
        results.push({ assetId: asset.id, ...res });
      } catch (err: any) {
        logger.error({ assetId: asset.id, err: err.message }, 'Failed to archive asset during project archiving');
        results.push({ assetId: asset.id, success: false, error: err.message });
      }
    }
  }

  return {
    success: true,
    totalAssets: project.assets.length,
    archivedCount: results.filter(r => r.success).length,
    details: results,
  };
}
