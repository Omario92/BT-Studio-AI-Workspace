# Project Screen — Manual Smoke Test

Quick end-to-end check that the Projects screen works after deploy.

## Prerequisites
- Frontend deployed to Vercel
- Backend deployed to Railway with `STORAGE_DRIVER=s3` + R2 creds
- Seed user `alice@btstudio.ai` / `password123` exists

## Steps

1. **Login** at the production URL → enter Alice's credentials
2. **Go to Projects** in the sidebar
3. **Select a project** — e.g. *Character Model 01*
4. **Create a folder**
   - Click the **+** icon next to "PROJECT FILES" in the sidebar
   - Modal should open with a visible white card (not just a dim overlay)
   - Enter name "Test Folder", press Enter
   - Confirm folder appears in the tree at root level (not nested)
   - Confirm it becomes the active folder
5. **Upload an asset**
   - Select "Generated" folder
   - Click **Upload** → pick an image (PNG/JPG/WebP)
   - Confirm progress bar fills to 100%
   - Confirm new asset card appears in the grid (status: DRAFT)
6. **Open asset for review**
   - Click the new asset card
   - Confirm review modal opens with: full image preview, metadata, versions, comments
   - Confirm primary action button = **"Send to Review"** (status is DRAFT)
7. **Send to Review**
   - Click **"Send to Review"**
   - Confirm status chip changes to IN_REVIEW
   - Confirm the action buttons change to Approve / Request revision / Reject
8. **Add a comment**
   - Type "Looks good, ship it." in the comment input
   - Press Enter (or click Post)
   - Confirm comment appears in the list with your name and timestamp
9. **Approve**
   - Click **Approve**
   - Confirm a review entry appears in the Reviews section
   - Confirm status chip changes to APPROVED
   - Close modal → asset card in grid shows APPROVED chip
10. **Rename folder** (optional)
    - Currently no inline rename — requires `PATCH /api/folders/:id` from API
11. **Delete folder** (optional)
    - Currently no UI button — requires `DELETE /api/folders/:id?force=true` from API

## Expected API calls (Network tab)

On open asset:
```
GET /api/assets/:id
GET /api/assets/:id/versions
GET /api/assets/:id/reviews
GET /api/assets/:id/comments
```

On Send to Review:
```
POST /api/assets/:id/send-to-review
```

On Approve / Reject / Request revision:
```
POST /api/asset-versions/:versionId/approve
POST /api/asset-versions/:versionId/reject
POST /api/asset-versions/:versionId/request-revision
```

On Create folder:
```
POST /api/projects/:id/folders   { "name": "...", "parentId": null }
GET  /api/projects/:id/folders   (refetch for canonical tree)
```

## What should NOT happen
- No `localhost` URLs in upload presign response
- No `PUT /api/storage/local-upload` calls (S3 driver bypasses it)
- No 500s in Network tab
- No invisible modals (white card must be visible behind dim overlay)
