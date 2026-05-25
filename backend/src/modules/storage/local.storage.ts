import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { env } from '../../config/env';
import { StorageProvider, PresignedUpload, StoredObject } from './storage.types';

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(env.STORAGE_LOCAL_PATH);
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch (err: any) {
      console.warn(`[LocalStorageProvider] Warning: Failed to create base directory ${this.baseDir} (${err.message}). Falling back to /tmp/uploads`);
      this.baseDir = path.resolve('/tmp/uploads');
      try {
        if (!fs.existsSync(this.baseDir)) {
          fs.mkdirSync(this.baseDir, { recursive: true });
        }
      } catch (fallbackErr: any) {
        console.error(`[LocalStorageProvider] Critical: Failed to create fallback directory ${this.baseDir}:`, fallbackErr.message);
      }
    }
  }

  private getFilePath(fileKey: string): string {
    const safeKey = fileKey.replace(/\//g, path.sep);
    const fullPath = path.join(this.baseDir, safeKey);
    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return fullPath;
  }

  private getBaseUrl(): string {
    if (env.STORAGE_PUBLIC_BASE_URL) {
      return env.STORAGE_PUBLIC_BASE_URL;
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }
    if (process.env.RAILWAY_STATIC_URL) {
      return `https://${process.env.RAILWAY_STATIC_URL}`;
    }
    return `http://localhost:${env.PORT}`;
  }

  async createPresignedUpload(
    projectId: string,
    assetId: string,
    versionNumber: number,
    filename: string,
    _mimeType: string,
  ): Promise<PresignedUpload> {
    const fileKey = `projects/${projectId}/assets/${assetId}/versions/v${versionNumber}/${filename}`;
    
    // In local mode, we route the upload to our own Fastify server's custom upload handler
    const baseUrl = this.getBaseUrl();
    const uploadUrl = `${baseUrl}/api/storage/local-upload?fileKey=${encodeURIComponent(fileKey)}`;

    return {
      uploadUrl,
      fileKey,
      fields: { fileKey }
    };
  }

  async createSignedDownload(fileKey: string, _expiresInSeconds?: number): Promise<string> {
    // Simply returns local file route that our Fastify server serves or a direct path
    const baseUrl = this.getBaseUrl();
    return `${baseUrl}/api/storage/files/${fileKey}`;
  }

  async putObject(fileKey: string, body: Buffer | ArrayBuffer | string, _mimeType: string): Promise<StoredObject> {
    const filePath = this.getFilePath(fileKey);
    let buffer: Buffer;

    if (Buffer.isBuffer(body)) {
      buffer = body;
    } else if (body instanceof ArrayBuffer) {
      buffer = Buffer.from(body);
    } else {
      buffer = Buffer.from(body, 'utf-8');
    }

    await fs.promises.writeFile(filePath, buffer);
    const stats = await fs.promises.stat(filePath);
    const baseUrl = this.getBaseUrl();

    return {
      fileKey,
      fileUrl: `${baseUrl}/api/storage/files/${fileKey}`,
      mimeType: _mimeType,
      fileSizeBytes: stats.size
    };
  }

  async copyFromUrl(url: string, fileKey: string, mimeType: string): Promise<StoredObject> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    return this.putObject(fileKey, buffer, mimeType);
  }

  async deleteObject(fileKey: string): Promise<void> {
    const filePath = this.getFilePath(fileKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async deleteObjects(fileKeys: string[]): Promise<{
    deleted: string[];
    failed: { fileKey: string; error: string }[];
  }> {
    const deleted: string[] = [];
    const failed: { fileKey: string; error: string }[] = [];
    for (const key of fileKeys) {
      try {
        await this.deleteObject(key);
        deleted.push(key);
      } catch (err: any) {
        failed.push({ fileKey: key, error: err.message ?? String(err) });
      }
    }
    return { deleted, failed };
  }
}
