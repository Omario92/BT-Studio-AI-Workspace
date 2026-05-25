# Storage Delete Sync — R2 / S3 Cleanup

## Why the frontend cannot delete R2 objects

Deleting a file from Cloudflare R2 requires the S3 `DeleteObject` /
`DeleteObjects` API, which requires the bucket's access key + secret.
Exposing those credentials to the browser would let any visitor wipe
any object. **The backend is the only place allowed to delete R2/S3
objects.**

## Asset delete flow (single)

```
DELETE /api/assets/:id?force=true
```

1. Loads the asset with all its versions.
2. Walks every `metadata.fileKey`, `metadata.thumbnailFileKey`, version
   `params.fileKey`, etc. — collected by
   [`asset-storage-keys.ts`](../backend/src/modules/assets/asset-storage-keys.ts).
3. Calls `storageService.deleteObjects(keys)`. NotFound errors are
   treated as success (the object was already gone).
4. **If any storage delete fails AND `force=false`**: throws `500`,
   keeps the DB row, returns `failedFileKeys` so the operator can
   investigate.
5. **If `force=true`** OR all storage deletes succeed: removes the DB
   asset (cascades to versions, reviews, comments) and writes an
   `ActivityLog` entry with the deleted/failed key lists.

Response:

```json
{
  "deletedId":       "ast_abc",
  "deletedFileKeys": ["projects/p1/assets/a1/versions/v1/file.png", ...],
  "failedFileKeys":  []
}
```

## Bulk delete flow

```
POST /api/assets/bulk-delete
{
  "assetIds": ["ast_a", "ast_b"],
  "force":    false
}
```

Per-asset: collects keys → deletes from R2 → deletes DB row.
Errors per asset are collected but do **not** abort the batch.

Response:

```json
{
  "deletedIds":      ["ast_a"],
  "deletedFileKeys": ["projects/p1/.../file.png"],
  "failed": [
    {
      "assetId":         "ast_b",
      "reason":          "storage cleanup failed for 1 object(s)",
      "failedFileKeys":  ["projects/p1/.../bad.png"]
    }
  ]
}
```

## Safety rules — what is and isn't deletable

`extractAssetStorageKeys()` only emits keys that:

- Are non-empty strings
- Do **not** start with `http://` or `https://` (those are URLs, not keys)
- Start with one of: `projects/`, `tmp/`, `uploads/`

A misconfigured `fileKey: "https://cdn.example.com/foo.png"` will be
ignored, not deleted. This prevents the system from accidentally
trying to delete external URLs as if they were bucket keys.

## Orphan cleanup (existing 6k orphans)

After deploying this change, every **new** delete cleans up R2. But
files orphaned by the old behavior need a one-time reconciliation.

### Step 1 — Dry-run (safe, prints summary + optional file dump)

```bash
cd backend
npm run r2:orphan:dry-run
# or with options:
npx tsx scratch/r2-orphan-cleanup.ts --prefix projects/ --limit 10000 --out orphans.json
```

What it does:

1. Loads every `Asset.metadata.fileKey` etc. that the DB references.
2. Lists every object in R2 under `--prefix` (default `projects/`).
3. Computes `r2Keys − dbKeys = orphans`.
4. Prints the first 50; writes the full list to `--out` if supplied.

### Step 2 — Review

Open `orphans.json`. Spot-check ~20 keys against the DB / Prisma Studio
to confirm they really aren't referenced anywhere. If anything looks
suspicious, **stop**.

### Step 3 — Delete (DESTRUCTIVE)

```bash
CONFIRM_R2_ORPHAN_DELETE=true npm run r2:orphan:delete
```

The env var is a hard gate — without it, the script refuses to delete.
Deletions happen in batches of 1000 (S3 `DeleteObjects` limit). Result:

```
deleted: 5973
failed:  27
```

Re-run dry-run to verify the orphan count is now ~0.

## What to do if storage delete fails for one asset

```
DELETE /api/assets/ast_xyz   → 500
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Asset DB delete blocked: storage cleanup failed for 1 object(s). …"
  }
}
```

Options:

- **Investigate** — check R2 dashboard, network, credentials. Re-try.
- **Accept the orphan** — `DELETE /api/assets/ast_xyz?force=true` removes
  the DB row. The orphan key will be cleaned up next time the orphan
  script runs.
