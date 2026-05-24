# BT Studio AI — Frontend ↔ Backend Sync Plan

> **Goal:** Replace all frontend static mock data with live API calls, with graceful offline fallback. No UI redesign. No new screens unless required.

---

## Architecture Overview

```
front-end/
├── index.html              ← monolithic entry, loads API clients + screen components
├── api/
│   ├── client.js           ← base HTTP client (auth, error handling, offline detection)
│   ├── projects.api.js     ← /api/projects
│   ├── assets.api.js       ← /api/assets, /api/asset-versions
│   ├── jobs.api.js         ← /api/jobs
│   ├── tools.api.js        ← /api/tools
│   └── activity.api.js     ← /api/activity, /api/dashboard/summary
└── screens/
    ├── dashboard.jsx        ← uses activityApi.getDashboardSummary()
    ├── workspace-home.jsx   ← uses toolsApi.listTools(), jobsApi.listJobs()
    └── activity.jsx         ← uses activityApi.getActivity()
```

---

## API Client Pattern

All API modules follow the same contract:

```javascript
// Returns { data, fromCache: false } on success
// Returns { data: MOCK_DATA, fromCache: true } when offline
// Throws on non-network errors (4xx)
async function listProjects(params) {
  try {
    const { data } = await apiClient.get('/api/projects', params);
    return { data: data.projects, fromCache: false };
  } catch (err) {
    if (err.offline) return { data: MOCK_PROJECTS, fromCache: true };
    throw err;
  }
}
```

The base client (`api/client.js`) detects offline state:
- Network errors → sets `err.offline = true`
- 5xx responses → sets `err.offline = true`
- 4xx responses → throws normally (shown as user-facing error)

---

## Screen-by-Screen Sync Status

### ✅ Dashboard (`screens/dashboard.jsx`)
- **API call:** `activityApi.getDashboardSummary()`
- **Data replaced:** KPI numbers, recent projects, pinned projects, assignments, activity feed
- **Offline fallback:** `MOCK_KPI`, `MOCK_RECENT_PROJECTS`, `MOCK_PINNED`, `MOCK_ASSIGNMENTS`, `MOCK_ACTIVITY`
- **Offline indicator:** Amber banner "Showing mock data — backend offline"
- **Dynamic fields:** Assignment count in subtitle, due date labels computed from `dueAt` ISO timestamps

### ✅ Workspace Home (`screens/workspace-home.jsx`)
- **API calls:**
  - `toolsApi.listTools()` → replaces static `TOOLS` global
  - `jobsApi.listJobs({ limit: 5 })` → replaces `RECENT_JOBS`
- **Icon re-attachment:** API returns `iconKey` string; frontend maps `I[iconKey]` to the SVG element
- **Status normalization:** API `RUNNING` → UI `generating`, API `QUEUED` → UI `queued`
- **Offline fallback:** Static `TOOLS` global, `RECENT_JOBS` static array

### ✅ Activity Log (`screens/activity.jsx`)
- **API call:** `activityApi.getActivity({ limit: 30 })`
- **Data replaced:** Timeline entries
- **Shape mapping:** API `{ user, action, detail, createdAt, project }` → UI `{ u, act, obj, proj, t, icon }`
- **Offline fallback:** Static `TIMELINE` array
- **Event count:** Live count from `timeline.length` (was hardcoded "9 events")
- **Day separator:** Now uses `new Date()` (was hardcoded "OCT 24, 2024")

---

## Screens Still Using Static Data

These screens are not yet wired to the API. Wiring them is deferred until after the backend is confirmed stable.

| Screen | Static Data | API Endpoint When Ready |
|--------|-------------|------------------------|
| Projects view | `TREE`, `ASSETS` in index.html | `GET /api/projects/:id/folders`, `GET /api/projects/:id/assets` |
| Template Library | `TEMPLATES` in index.html | `GET /api/templates` |
| Batch Mode | Hardcoded cells | `POST /api/jobs` (type: BATCH_GENERATION) |
| Image Gen Workbench | No live data needed yet | `POST /api/jobs` (type: IMAGE_GENERATION) |
| Review Panel | Hardcoded version list | `GET /api/assets/:id/versions`, `POST /api/asset-versions/:id/approve` etc. |

---

## Data Shape Mapping Reference

### Dashboard — Project Card
| API field | UI field | Notes |
|-----------|----------|-------|
| `p.id` | `p.id` | Used as React key |
| `p.name` | `p.name` | Display name |
| `p.client` | `p.client` | Subtitle |
| `p.progress` | `p.progress` | Progress bar width |
| `p.tone` | `p.tone` | Placeholder color |
| `p.members[].user.name` | Avatar initials | Slice to 2 chars |
| `p.isPinned` | Used for pinned section | Filter `recentProjects` |

### Dashboard — Assignment Row
| API field | UI field | Notes |
|-----------|----------|-------|
| `a.title` | Displayed name | Falls back to `a.name` |
| `a.dueAt` | Computed via `dueLabel(a.dueAt)` | Returns `{ text, cls }` |
| `a.isDone` | Filtered out if `true` | `openAssignments` filter |

### Activity Log — Timeline Entry
| API field | UI field | Notes |
|-----------|----------|-------|
| `entry.user.name` | `e.u` (full name) + `e.i` (initials) | |
| `entry.action` | `e.act` | e.g. "approved", "uploaded" |
| `entry.detail` or `entry.asset.name` | `e.obj` | Asset/job name |
| `entry.project.name` | `e.proj` | Project moniker |
| `entry.createdAt` | `e.t` | Formatted as `HH:MM AM/PM` |
| action contains "approv" | `e.icon = "green"` | Dot color |
| action contains "reject" | `e.icon = "red"` | |
| action contains "comment" | `e.icon = "amber"` | + sets `e.comment` from `detail` |
| action contains "upload" | `e.icon = "blue"` | |

### AI Tools — Tool Card
| API field | UI field | Notes |
|-----------|----------|-------|
| `t.category` (enum) | `t.cat` (lowercase string) | Mapped in `tools.api.js` via `CATEGORY_MAP` |
| `t.iconKey` | `I[t.iconKey]` | Re-attached in `WorkspaceHome` effect |
| `t.badge`, `t.badgeKind` | `t.badge.text`, `t.badge.kind` | Normalized in `mapTool()` |

### Jobs — Recent Jobs Rail
| API field | UI field | Notes |
|-----------|----------|-------|
| `j.status` (RUNNING/QUEUED) | Normalized to `generating`/`queued` | For `statusToChip()` |
| `j.type` | `cat` inferred | VIDEO→video, VOICE→audio, else image |
| `j.tool.name` or `j.tool` | `toolName` | Handles both API and mock shapes |
| `j.progress` or `j.pct` | Progress bar width | |
| `j.createdAt` | `timeStr` computed | Falls back to `j.time` from mock |

---

## Next Steps (Post-Stabilization)

1. **Wire Projects screen** — `GET /api/projects/:id/folders` to populate the file tree; `GET /api/projects/:id/assets` for the asset grid
2. **Wire Template Library** — `GET /api/templates` with pagination
3. **Wire Review Panel** — `GET /api/assets/:id/versions` + approve/reject/request-revision actions
4. **Wire Image Gen submit** — `POST /api/jobs` → poll `GET /api/jobs/:id` for progress
5. **Wire Batch Mode** — `POST /api/jobs` with `type: BATCH_GENERATION`, display grid from `GET /api/jobs/:id`
6. **Real-time updates** — Add SSE or WebSocket endpoint for job progress; update `WorkspaceHome` rail live

---

## Environment Configuration

```bash
# frontend — set window.__BT_API_BASE__ before api/client.js loads
# In index.html (dev):
<script>window.__BT_API_BASE__ = 'http://localhost:3001';</script>

# backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
PORT=3001
```

---

## Testing Offline Mode

1. Stop the backend (`Ctrl+C` on `npm run dev`)
2. Open `front-end/index.html` in browser
3. Navigate to Dashboard, Workspace, Activity Log
4. Confirm amber banner appears and all mock data renders correctly
5. Restart backend → hard refresh → confirm live data loads and banner disappears
