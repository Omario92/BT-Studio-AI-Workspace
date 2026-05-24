# BT Studio AI — API Contract

> **Base URL:** `http://localhost:3001`  
> **Auth:** `Authorization: Bearer <jwt>` on all protected routes  
> **Content-Type:** `application/json`

---

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | ✗ | Email + password → `{ token, user }` |
| POST | `/api/auth/refresh` | ✓ | Rotate JWT |
| GET | `/api/auth/me` | ✓ | Current user profile |

---

## Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/summary` | ✓ | KPIs, recent projects, assignments, activity |

### GET `/api/dashboard/summary` — Response
```json
{
  "kpi": {
    "activeProjects": 24,
    "framesGenerated7d": 1287,
    "awaitingApproval": 42,
    "gpuQueueRunning": 2,
    "gpuQueueQueued": 3
  },
  "assignments": [
    {
      "id": "...",
      "title": "Review Style Transfer — Huda KV v4",
      "dueAt": "2024-10-24T09:00:00.000Z",
      "isDone": false,
      "project": { "name": "Huda Commercial" }
    }
  ],
  "recentProjects": [
    {
      "id": "proj_huda",
      "name": "Huda Commercial",
      "client": "Beauty / KV",
      "progress": 72,
      "tone": "rose",
      "isPinned": false,
      "members": [{ "user": { "name": "Alice Chen" } }],
      "_count": { "assets": 12 }
    }
  ],
  "recentActivity": [
    {
      "id": "al1",
      "action": "approved",
      "detail": "Frame_18_v3.png on Halida Fresh Beer",
      "user": { "name": "Sarah M." },
      "project": { "name": "Halida Fresh Beer" },
      "createdAt": "2024-10-24T10:18:00.000Z"
    }
  ]
}
```

---

## Projects

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/projects` | ✓ | List all projects (paginated) |
| POST | `/api/projects` | ✓ | Create project |
| GET | `/api/projects/:id` | ✓ | Get project details |
| PATCH | `/api/projects/:id` | ✓ | Update project |
| DELETE | `/api/projects/:id` | ✓ | Archive project |
| GET | `/api/projects/:id/folders` | ✓ | Project folder tree with asset counts |
| GET | `/api/projects/:id/assets` | ✓ | Assets in project (filter by folderId, status) |
| GET | `/api/projects/:id/members` | ✓ | Project members |
| POST | `/api/projects/:id/members` | ✓ | Add member |

### Query params — GET `/api/projects`
- `page` (default 1), `limit` (default 20)
- `status`: `ACTIVE | WIP | COMPLETED | ARCHIVED`

### Query params — GET `/api/projects/:id/assets`
- `folderId`, `status`, `page`, `limit`

---

## Assets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assets/:id` | ✓ | Get asset with current version |
| DELETE | `/api/assets/:id` | ✓ | Delete asset |
| GET | `/api/assets/:id/versions` | ✓ | All versions + reviews |
| POST | `/api/assets/:id/versions` | ✓ | Create new version (AI output) |
| POST | `/api/assets/:id/comments` | ✓ | Add comment |
| POST | `/api/assets/:id/send-to-review` | ✓ | Advance status to IN_REVIEW |

### POST `/api/assets/:id/versions` — Request
```json
{
  "url": "https://cdn.btstudio.io/assets/frame_18_v4.png",
  "prompt": "Cyberpunk street, neon reflections, rain",
  "modelId": "flux-1.1-pro",
  "seed": 1234567,
  "metadata": { "width": 1920, "height": 1080 }
}
```

---

## Asset Versions (Review)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/asset-versions/:versionId/approve` | ✓ | Approve version |
| POST | `/api/asset-versions/:versionId/reject` | ✓ | Reject version (comment required) |
| POST | `/api/asset-versions/:versionId/request-revision` | ✓ | Request revision (comment required) |

### POST `.../approve` — Request
```json
{ "comment": "Looks great, shipping to client." }
```

### POST `.../reject` — Request (comment required)
```json
{ "comment": "Glass refraction is wrong — re-run with new env ref." }
```

---

## AI Jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/jobs` | ✓ | List jobs (optional: projectId, page, limit) |
| POST | `/api/jobs` | ✓ | Create + enqueue job |
| GET | `/api/jobs/:id` | ✓ | Get job status |
| POST | `/api/jobs/:id/cancel` | ✓ | Cancel QUEUED or RUNNING job |
| POST | `/api/jobs/:id/retry` | ✓ | Retry FAILED job |

### POST `/api/jobs` — Request
```json
{
  "projectId": "proj_huda",
  "folderId": "folder_generated",
  "toolId": "tool_image_gen",
  "type": "IMAGE_GENERATION",
  "name": "Frame_18_v3 cyberpunk street",
  "prompt": "Cyberpunk street, neon reflections, rain, cinematic",
  "modelId": "flux-1.1-pro",
  "params": { "width": 1920, "height": 1080, "steps": 30 }
}
```

### Job Status Response
```json
{
  "id": "job_abc123",
  "status": "RUNNING",
  "progress": 64,
  "name": "Frame_18_v3 cyberpunk street",
  "type": "IMAGE_GENERATION",
  "createdAt": "2024-10-24T10:41:00.000Z"
}
```

---

## AI Tools

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tools` | ✓ | List all tools (optional: `activeOnly=true`) |
| GET | `/api/tools/:id` | ✓ | Get tool details |

### Tool Response Shape
```json
{
  "id": "tool_image_gen",
  "name": "Image Generator",
  "desc": "Generate images from text prompts",
  "category": "IMAGE",
  "cat": "image",
  "iconKey": "imageGen",
  "badge": null,
  "sortOrder": 1
}
```

> **Note:** `cat` is the frontend-friendly lowercase string (`image`, `video`, `audio`, `spaces`, `3d`). `iconKey` maps to `window.I[iconKey]` for SVG icon lookup.

---

## Activity

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/activity` | ✓ | Global activity log |

### Query params
- `projectId`, `userId`, `action`
- `limit` (default 30), `offset` (default 0)

### Activity Entry Response
```json
{
  "id": "al1",
  "action": "approved",
  "entityType": "asset",
  "detail": "Frame_18_v3.png on Halida Fresh Beer",
  "user": { "id": "...", "name": "Sarah M." },
  "project": { "id": "proj_halida", "name": "Halida Fresh Beer" },
  "asset": { "id": "...", "name": "Frame_18_v3.png" },
  "createdAt": "2024-10-24T10:18:00.000Z"
}
```

---

## Templates

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/templates` | ✓ | List templates |
| GET | `/api/templates/:id` | ✓ | Get template |

---

## Error Format

All errors return:
```json
{
  "error": "Unauthorized",
  "message": "Token expired or missing",
  "statusCode": 401
}
```

Common codes: `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `409` Conflict, `500` Internal Server Error.

---

## Offline Behavior (Frontend)

All frontend API clients catch `{ offline: true }` errors (network failures or 5xx) and return static mock data via `{ data: MOCK_DATA, fromCache: true }`. The UI shows an amber banner when `fromCache: true`.
