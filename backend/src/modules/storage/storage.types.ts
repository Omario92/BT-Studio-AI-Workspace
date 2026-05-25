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
  /** Optional bulk delete. Backends without native bulk support can omit; callers fall back to a deleteObject loop. */
  deleteObjects?(fileKeys: string[]): Promise<{
    deleted: string[];
    failed: { fileKey: string; error: string }[];
  }>;
  /** Optional listing for orphan reconciliation. Returns object keys under a prefix. */
  listObjects?(prefix: string, opts?: { maxKeys?: number; continuationToken?: string }): Promise<{
    keys: string[];
    nextContinuationToken?: string;
    isTruncated: boolean;
  }>;
}
