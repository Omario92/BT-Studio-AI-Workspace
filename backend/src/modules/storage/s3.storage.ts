import axios from 'axios';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { StorageProvider, PresignedUpload, StoredObject } from './storage.types';

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.STORAGE_BUCKET;
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: env.STORAGE_ENDPOINT ? true : false,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      },
    });
  }

  async createPresignedUpload(
    projectId: string,
    assetId: string,
    versionNumber: number,
    filename: string,
    mimeType: string,
  ): Promise<PresignedUpload> {
    const fileKey = `projects/${projectId}/assets/${assetId}/versions/v${versionNumber}/${filename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return { uploadUrl, fileKey };
  }

  async createSignedDownload(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    if (env.STORAGE_PUBLIC_BASE_URL) {
      return `${env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${fileKey}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async putObject(fileKey: string, body: Buffer | ArrayBuffer | string, mimeType: string): Promise<StoredObject> {
    let buffer: Buffer;

    if (Buffer.isBuffer(body)) {
      buffer = body;
    } else if (body instanceof ArrayBuffer) {
      buffer = Buffer.from(body);
    } else {
      buffer = Buffer.from(body, 'utf-8');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.client.send(command);

    const fileUrl = env.STORAGE_PUBLIC_BASE_URL
      ? `${env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${fileKey}`
      : await this.createSignedDownload(fileKey);

    return {
      fileKey,
      fileUrl,
      mimeType,
      fileSizeBytes: buffer.length,
    };
  }

  async copyFromUrl(url: string, fileKey: string, mimeType: string): Promise<StoredObject> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    return this.putObject(fileKey, buffer, mimeType);
  }

  async deleteObject(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });
    await this.client.send(command);
  }
}
