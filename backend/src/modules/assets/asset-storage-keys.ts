/**
 * Extract every R2/S3 storage object key referenced by an asset (and its versions).
 *
 * Safety rules:
 * - Reject anything that looks like a URL (http:// or https://) — those are
 *   full download URLs, not bucket keys.
 * - Only emit keys under the app-owned prefixes (projects/, tmp/, uploads/)
 *   so a misconfigured field can't accidentally schedule deletion of an
 *   external resource.
 */

const SAFE_PREFIXES = ['projects/', 'tmp/', 'uploads/'];

/** Looks like an object key we own and are safe to delete. */
function isOwnedKey(value: any): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith('http://') || v.startsWith('https://')) return false;
  return SAFE_PREFIXES.some(p => v.startsWith(p));
}

/** Deep-walk an arbitrary object and collect any owned storage keys. */
function scan(obj: any, out: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;

  for (const field of ['fileKey', 'thumbnailFileKey', 'previewFileKey', 'sourceFileKey', 'outputFileKey']) {
    const v = (obj as any)[field];
    if (isOwnedKey(v)) out.add(v.trim());
  }

  // Recurse into nested containers (metadata/params can be deeply nested)
  if (obj.metadata) scan(obj.metadata, out);
  if (obj.params)   scan(obj.params,   out);
}

/**
 * Walk an Asset (and any included versions) and return the set of unique
 * storage keys safe to delete from the object store.
 */
export function extractAssetStorageKeys(asset: any): string[] {
  const keys = new Set<string>();

  scan(asset, keys);

  if (Array.isArray(asset?.versions)) {
    for (const version of asset.versions) {
      scan(version, keys);
    }
  }

  return Array.from(keys);
}

export function uniqueStorageKeys(keys: string[]): string[] {
  return Array.from(new Set(keys.map(k => k.trim()).filter(Boolean)));
}

export const SAFE_KEY_PREFIXES = SAFE_PREFIXES;
