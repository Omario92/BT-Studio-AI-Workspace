# BT Studio AI Workspace

AI-powered creative production platform for advertising studios. Manage projects, generate and review creative assets, run AI batch jobs, and ship work faster — all in one place.

**Frontend:** Vercel · **Backend:** Railway · **Storage:** Cloudflare R2

---

## What It Does

| Area | Capabilities |
|---|---|
| **Project Management** | Projects → Folders → Assets with version history |
| **AI Workspace** | Image generation, editing, upscaling, variation via OpenAI / Stability / Replicate / RunPod / ComfyUI |
| **Batch Jobs** | Queue async generation jobs via BullMQ; poll status until complete |
| **Asset Review** | Approve / reject / request-revision workflow with comments per version |
| **Team** | Role-based access (Admin · Artist · Art Director · Reviewer) |
| **Storage** | Direct S3-presigned upload → Cloudflare R2 (local filesystem in dev) |
| **Activity** | Full audit log per project |
| **Archive** | Optional Google Drive secondary backup |

---

## Repository Structure

```
BT-Studio-AI-Workspace/
├── backend/                    # Fastify API (TypeScript · Prisma · BullMQ)
│   ├── src/
│   │   ├── server.ts           # App entry point — registers all routes/plugins
│   │   ├── config/             # env.ts · database.ts · redis.ts
│   │   ├── plugins/            # auth (JWT) · cors · swagger
│   │   ├── modules/
│   │   │   ├── auth/           # Register · Login · Refresh · /me
│   │   │   ├── projects/       # CRUD · Members · Activity
│   │   │   ├── folders/        # Create · Rename · Delete (with asset guard)
│   │   │   ├── assets/         # CRUD · Upload · Status workflow · Comments
│   │   │   ├── jobs/           # BullMQ queue · Processor · Status polling
│   │   │   ├── ai-tools/       # Tool registry · Provider adapters
│   │   │   ├── storage/        # Local / S3-R2 adapter · Signed URLs · Archive
│   │   │   ├── activity/       # Activity log
│   │   │   ├── dashboard/      # Dashboard aggregation
│   │   │   └── templates/      # Creative templates
│   │   └── utils/              # errors.ts · logger.ts
│   ├── prisma/
│   │   ├── schema.prisma       # Full data model
│   │   ├── seed.ts             # Dev seed (3 users, sample projects)
│   │   └── migrations/
│   ├── scratch/                # Standalone smoke-test scripts
│   ├── Dockerfile
│   ├── docker-compose.yml      # Postgres + Redis + API
│   └── .env.example
├── front-end/                  # Vanilla HTML/CSS/JS — deployed to Vercel
│   ├── index.html              # Single-file app shell + design system
│   ├── app.jsx                 # Router / screen switcher
│   ├── screens/                # Dashboard · Projects · Workspace · Batch · etc.
│   ├── components/             # Sidebar · Topbar · Icons · Placeholders
│   ├── api/                    # client.js · projects.api.js · assets.api.js · …
│   └── styles.css
└── docs/                       # Architecture, deployment, and integration docs
```

---

## Quick Start — Local Development

### Prerequisites

- Node.js ≥ 18
- Docker Desktop (for the one-command option)
- Git

### Option A — Docker (recommended, no setup)

```bash
git clone https://github.com/Omario92/BT-Studio-AI-Workspace.git
cd BT-Studio-AI-Workspace/backend

cp .env.example .env        # adjust JWT_SECRET at minimum

docker compose up -d        # starts Postgres + Redis + API
docker compose logs -f api  # watch boot logs
```

API: `http://localhost:3001`  
Swagger docs: `http://localhost:3001/docs`

Seed the database (first run only):

```bash
docker compose exec api npm run db:seed
```

### Option B — Local Node (requires Postgres + Redis already running)

```bash
cd backend
npm install
cp .env.example .env   # set DATABASE_URL, REDIS_URL, JWT_SECRET

npm run db:migrate     # create tables
npm run db:seed        # seed dev data
npm run dev            # hot-reload dev server
```

### Frontend

The frontend is a static HTML/JS app — open `front-end/index.html` directly in a browser, or serve it with any static server:

```bash
npx serve front-end
# → http://localhost:3000
```

The API base URL is auto-detected:
- `localhost` → `http://localhost:3001`
- Vercel (`bt-studio-ai-workspace.vercel.app`) → Railway backend

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random 64-char string for signing tokens |

### Storage (choose one)

**Local (default — dev only):**
```env
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./uploads
```

**Cloudflare R2 / S3 (recommended for production):**
```env
STORAGE_DRIVER=s3
STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
STORAGE_BUCKET=bt-studio-assets
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=<key>
STORAGE_SECRET_ACCESS_KEY=<secret>
STORAGE_PUBLIC_BASE_URL=https://pub-<token>.r2.dev
```

### Optional

| Variable | Default | Description |
|---|---|---|
| `DISABLE_REDIS` | `false` | Set `true` to skip BullMQ worker (no Redis needed) |
| `REDIS_URL` | `redis://localhost:6379` | Redis for BullMQ job queues |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `OPENAI_API_KEY` | — | For OpenAI image generation |
| `STABILITY_API_KEY` | — | For Stability AI |
| `REPLICATE_API_TOKEN` | — | For Replicate models |
| `RUNPOD_API_KEY` | — | For RunPod GPU jobs |
| `COMFYUI_BASE_URL` | — | For self-hosted ComfyUI |
| `GOOGLE_DRIVE_ENABLED` | `false` | Enable Drive archive |
| `STORAGE_MAX_FILE_SIZE_MB` | `100` | Upload size limit |

---

## API Reference

All routes require `Authorization: Bearer <token>` except auth endpoints.  
Full interactive docs available at `/docs` (Swagger UI).

### Auth — `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | `/register` | Create account |
| POST | `/login` | Login → JWT pair |
| POST | `/refresh` | Refresh access token |
| GET | `/me` | Current user profile |

### Projects — `/api/projects`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List accessible projects |
| POST | `/` | Create project (auto-creates default folders) |
| GET | `/:id` | Project detail + folders |
| PATCH | `/:id` | Update project |
| DELETE | `/:id` | Delete (owner only) |
| GET | `/:id/folders` | List root-level folders |
| POST | `/:id/folders` | Create folder |
| GET | `/:id/assets` | List assets (filterable by `folderId`, `status`) |
| GET | `/:id/activity` | Activity log |

### Folders — `/api/folders`

| Method | Path | Description |
|---|---|---|
| PATCH | `/:folderId` | Rename folder |
| DELETE | `/:folderId?force=true` | Delete folder (blocked if assets exist unless `force=true`) |

### Assets — `/api/assets`

| Method | Path | Description |
|---|---|---|
| POST | `/upload` | Register uploaded asset + create version 1 |
| GET | `/:id` | Get asset with comments |
| PATCH | `/:id/status` | Update status |
| POST | `/:id/comments` | Add comment |
| POST | `/:id/send-to-review` | Submit for review |
| DELETE | `/:id` | Delete (creator only) |

### Storage — `/api/storage`

| Method | Path | Description |
|---|---|---|
| POST | `/presign-upload` | Get signed PUT URL (local or S3/R2) |
| POST | `/complete-upload` | Confirm upload, get download URL |
| GET | `/signed-url?fileKey=…` | Signed download URL (slash-safe) |
| DELETE | `/object?fileKey=…` | Delete object (slash-safe) |

### Jobs — `/api/jobs`

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create + enqueue AI job |
| GET | `/` | List jobs by project |
| GET | `/:id` | Poll job status + result |
| POST | `/:id/cancel` | Cancel queued/running job |

### Tools — `/api/tools`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List active AI tools |
| POST | `/:slug/invoke` | Direct (synchronous) tool call |
| GET | `/provider-status` | API key health check (Admin) |

---

## Upload Flow

```
Browser → POST /api/storage/presign-upload
        ← { uploadUrl, fileKey }

Browser → PUT <uploadUrl>   (direct to R2 / local handler)
        ← 200

Browser → POST /api/storage/complete-upload { fileKey }
        ← { fileKey, fileUrl }

Browser → POST /api/assets/upload { projectId, folderId, fileName, mimeType, fileSizeBytes, fileKey, fileUrl }
        ← { asset }
```

In production, `uploadUrl` is an R2 presigned `PUT` URL — the file goes directly from the browser to Cloudflare, never through the backend.

---

## Deployment

### Backend → Railway

1. Create a new Railway project
2. Add **PostgreSQL** and **Redis** services
3. Deploy the `backend/` directory from this repo
4. Set **Build Command:** `npm run build`
5. Set **Start Command:** `npx prisma db push && npm run start`
6. Add environment variables (see table above); use Railway's reference syntax:
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}`
   - `REDIS_URL` → `${{Redis.REDIS_URL}}`

For Cloudflare R2 storage (strongly recommended — local storage is not persistent on Railway), add the `STORAGE_DRIVER=s3` env vars.

> Full checklist: [`docs/railway-deployment-checklist.md`](docs/railway-deployment-checklist.md)

### Frontend → Vercel

1. Import the repo in Vercel
2. Set **Root Directory** to `front-end`
3. No build step — deploy as static files
4. Set `window.__BT_API_BASE__` or rely on the hostname auto-detection in `api/client.js`

> Full guide: [`docs/frontend-production-deploy.md`](docs/frontend-production-deploy.md)

---

## Database

Managed by Prisma. Core models:

```
User → Project (owner + ProjectMember)
Project → Folder (tree, depth-tracked)
Folder → Asset
Asset → AssetVersion (immutable — never overwritten)
AssetVersion → Review (approve / reject / revision-requested)
Asset → Comment
Project → AIJob → AssetVersion
Project → ActivityLog
```

### Dev Commands

```bash
npm run db:migrate     # create + apply migration
npm run db:push        # sync schema without migration (dev only)
npm run db:seed        # load seed data
npm run db:generate    # regenerate Prisma client after schema change
npm run db:studio      # open Prisma Studio GUI
```

### Default Seed Credentials

| Email | Password | Role |
|---|---|---|
| `alice@btstudio.ai` | `password123` | ADMIN |
| `david@btstudio.ai` | `password123` | ARTIST |
| `sarah@btstudio.ai` | `password123` | REVIEWER |

---

## Adding an AI Provider

1. Add API key to `.env` and `src/config/env.ts`
2. Create `src/modules/ai-tools/adapters/<provider>.ts`
3. Add a `case` in `invokeToolDirect()` in `tools.service.ts`
4. Add a `case` in `processAIJob()` in `jobs.processor.ts` for async/batch support
5. Seed the tool in `prisma/seed.ts` or via `POST /api/tools`

---

## Smoke Tests

Runnable scripts in `backend/scratch/` for quick end-to-end verification:

```bash
# Full upload flow: presign → PUT → complete → register asset
npx ts-node scratch/upload.smoke.ts

# Folder flow: create → list → rename → delete
npx ts-node scratch/folders.smoke.ts

# Storage: signed URLs, local upload, delete
npx ts-node scratch/storage.smoke.ts

# Batch jobs
npx ts-node scratch/batch.smoke.ts
```

All scripts require the backend running at `http://localhost:3001` with seed data loaded.

---

## Documentation

| Doc | Description |
|---|---|
| [`docs/api-contract.md`](docs/api-contract.md) | Full request/response shapes |
| [`docs/storage-architecture.md`](docs/storage-architecture.md) | Local / S3 / R2 adapter internals |
| [`docs/database-model.md`](docs/database-model.md) | Prisma schema walkthrough |
| [`docs/railway-deployment-checklist.md`](docs/railway-deployment-checklist.md) | Step-by-step Railway deploy |
| [`docs/frontend-production-deploy.md`](docs/frontend-production-deploy.md) | Vercel deploy + API wiring |
| [`docs/batch-jobs.md`](docs/batch-jobs.md) | BullMQ queue architecture |
| [`docs/runpod-comfyui-provider.md`](docs/runpod-comfyui-provider.md) | Self-hosted GPU setup |
| [`docs/env-setup.md`](docs/env-setup.md) | Env var reference |
| [`docs/TESTING.md`](docs/TESTING.md) | Testing strategy |
| [`backend/README.md`](backend/README.md) | Backend-specific reference |

---

## Tech Stack

| Layer | Tech |
|---|---|
| **API** | Fastify 4 · TypeScript 5 · Node.js 18+ |
| **Database** | PostgreSQL · Prisma 5 |
| **Queue** | BullMQ · Redis (IORedis) |
| **Auth** | JWT (access + refresh) · bcryptjs |
| **Storage** | AWS SDK v3 (Cloudflare R2 / S3 / MinIO) |
| **Frontend** | Vanilla JS · React (CDN) · Geist font |
| **Docs** | Swagger UI (`/docs`) · Fastify Swagger |
| **Deploy** | Railway (backend) · Vercel (frontend) |
| **Container** | Docker · Docker Compose |

---

## License

Private — BT Studio internal tooling.
