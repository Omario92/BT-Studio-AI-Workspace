import { google } from 'googleapis';
import logger from '../../utils/logger';
import { env } from '../../config/env';
import fs from 'fs';
import path from 'path';

export class GoogleDriveArchiveProvider {
  private drive: any = null;
  private enabled = false;

  constructor() {
    if (!env.GOOGLE_DRIVE_ENABLED) {
      logger.info('Google Drive archive provider is disabled via GOOGLE_DRIVE_ENABLED env');
      return;
    }

    try {
      let credentials;
      if (env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON.trim()) {
        credentials = JSON.parse(env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);
      } else {
        const credentialsPath = path.resolve('google-drive-key.json');
        if (fs.existsSync(credentialsPath)) {
          credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        }
      }

      if (!credentials) {
        logger.warn('Google Drive service account credentials missing — Drive archiving disabled.');
        return;
      }

      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });

      this.drive = google.drive({ version: 'v3', auth });
      this.enabled = true;
      logger.info('Google Drive archive provider successfully initialized!');
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to initialize Google Drive provider');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Create folder inside a parent folder
  private async getOrCreateFolder(name: string, parentId?: string): Promise<string> {
    if (!this.enabled || !this.drive) throw new Error('Google Drive is not enabled');

    let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and trashed = false`;
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    } else if (env.GOOGLE_DRIVE_SHARED_DRIVE_ID) {
      q += ` and '${env.GOOGLE_DRIVE_SHARED_DRIVE_ID}' in parents`;
    }

    const res = await this.drive.files.list({
      q,
      spaces: 'drive',
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files;
    if (files && files.length > 0) {
      return files[0].id;
    }

    // Create if not found
    const metadata: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentId) {
      metadata.parents = [parentId];
    } else if (env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID) {
      metadata.parents = [env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID];
    }

    const folderRes = await this.drive.files.create({
      resource: metadata,
      fields: 'id',
      supportsAllDrives: true,
    });

    return folderRes.data.id;
  }

  // Set up project folder structure:
  // BT Studio AI Workspace / Projects / {ProjectName} / {CategoryFolder}
  async getProjectFolderId(projectName: string, categoryFolder: string): Promise<string> {
    const rootId = await this.getOrCreateFolder('BT Studio AI Workspace');
    const projectsId = await this.getOrCreateFolder('Projects', rootId);
    const pId = await this.getOrCreateFolder(projectName, projectsId);
    return this.getOrCreateFolder(categoryFolder, pId);
  }

  // Upload file stream or buffer to Drive
  async uploadFile(
    folderId: string,
    filename: string,
    body: any, // Buffer, Readable stream, etc.
    mimeType: string,
  ): Promise<{ id: string; webViewLink: string }> {
    if (!this.enabled || !this.drive) throw new Error('Google Drive is not enabled');

    // Create file
    const fileMetadata = {
      name: filename,
      parents: [folderId],
    };

    const media = {
      mimeType,
      body,
    };

    const file = await this.drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    return {
      id: file.data.id,
      webViewLink: file.data.webViewLink,
    };
  }
}
export const googleDriveArchiveProvider = new GoogleDriveArchiveProvider();
