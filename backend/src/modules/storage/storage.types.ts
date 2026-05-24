export interface StoredObject {
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface PresignedUpload {
  uploadUrl: string;
  fileKey: string;
  fields?: Record<string, string>;
}

export interface StorageProvider {
  createPresignedUpload(
    projectId: string,
    assetId: string,
    versionNumber: number,
    filename: string,
    mimeType: string,
  ): Promise<PresignedUpload>;
  createSignedDownload(fileKey: string, expiresInSeconds?: number): Promise<string>;
  putObject(fileKey: string, body: Buffer | ArrayBuffer | string, mimeType: string): Promise<StoredObject>;
  copyFromUrl(url: string, fileKey: string, mimeType: string): Promise<StoredObject>;
  deleteObject(fileKey: string): Promise<void>;
}
