import { env } from '../../config/env';
import { StorageProvider } from './storage.types';
import { LocalStorageProvider } from './local.storage';
import { S3StorageProvider } from './s3.storage';

let activeProvider: StorageProvider;

if (env.STORAGE_DRIVER === 's3') {
  activeProvider = new S3StorageProvider();
} else {
  activeProvider = new LocalStorageProvider();
}

export const storageService = activeProvider;
