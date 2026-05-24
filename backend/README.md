# BT Studio AI Workspace — Backend API

Scalable REST API for the BT Studio AI creative production platform.

**Stack:** Node.js · Fastify · TypeScript · PostgreSQL · Prisma · BullMQ · Redis · Docker

---

## Architecture

```
bt-studio-backend/
├── src/
│   ├── server.ts                 # Fastify entry point
│   ├── config/
│   │   ├── env.ts                # Typed env vars
│   │   ├── database.ts           # Prisma client singleton
│   │   └── redis.ts              # IORedis / BullMQ connection
│   ├── plugins/
│   │   ├── auth.ts               # JWT plugin + role decorators
│   │   ├── cors.ts               # CORS
│   │   └── swagger.ts            # OpenAPI / Swagger UI
│   ├── modules/
│   │   ├── auth/                 # Register · Login · Refresh · /me
│   │   ├── projects/             # CRUD · Members · Activity
│   │   ├── assets/               # CRUD · Status workflow · Comments
│   │   ├── jobs/                 # BullMQ queue · Processor · Polling
│   │   └── ai-tools/             # Tool registry · Provider adapters
│   └── utils/
│       ├── errors.ts             # AppError + global handler
│       └── logger.ts             # Pino logger
├── prisma/
│   ├── schema.prisma             # Full data model
│   └── seed.ts                   # Dev seed data
├── Dockerfile                    # Multi-stage build
├── docker-compose.yml            # Postgres + Redis + API
└── .env.example
```

---

## Quick Start

### 1. Clone & install

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL, REDIS_URL, JWT_SECRET
```

### 3. Start with Docker (recommended)

```bash
# Start all services (Postgres + Redis + API)
docker compose up -d

# Watch logs
docker compose logs -f api

# API is live at:  http://localhost:3001
# Swagger docs at: http://localhost:3001/docs
```

### 4. Local dev (without Docker)

You need PostgreSQL and Redis running locally first.

```bash
# Run migrations
npm run db:migrate

# Seed dev data
npm run db:seed

# Start dev server with hot reload
npm run dev
```

---

## Database Commands

| Command | Description |
|---|---|
| `npm run db:migrate` | Create & apply a new migration |
| `npm run db:push` | Sync schema without migration file (dev only) |
| `npm run db:seed` | Load dev seed data |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio (GUI) |

---

## API Reference

All routes prefixed with `/api`. Full interactive docs at `/docs`.

### Auth `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register new user |
| POST | `/login` | — | Login → returns JWT pair |
| POST | `/refresh` | — | Refresh access token |
| GET | `/me` | ✅ | Get current user profile |

### Projects `/api/projects`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | List accessible projects |
| POST | `/` | ✅ | Create project |
| GET | `/:id` | ✅ | Get project + folders |
| PATCH | `/:id` | ✅ | Update project |
| DELETE | `/:id` | ✅ Owner | Delete project |
| GET | `/:id/activity` | ✅ | Project activity log |
| GET | `/:id/assets` | ✅ | List project assets |
| POST | `/:id/assets` | ✅ | Add asset to project |

### Assets `/api/assets`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:id` | ✅ | Get asset + comments |
| PATCH | `/:id/status` | ✅ | Update status (approve/reject/etc) |
| POST | `/:id/version-bump` | ✅ | Increment version |
| POST | `/:id/comments` | ✅ | Add comment |
| DELETE | `/:id` | ✅ Creator | Delete asset |

### Jobs `/api/jobs`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | ✅ | Create + enqueue AI job |
| GET | `/` | ✅ | List jobs (by projectId) |
| GET | `/:id` | ✅ | Poll job status + result |
| POST | `/:id/cancel` | ✅ | Cancel pending/running job |
| GET | `/queue-stats` | ✅ Admin | Live BullMQ queue stats |

### AI Tools `/api/tools`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | List active tools |
| GET | `/:id` | ✅ | Get tool details |
| POST | `/` | ✅ Admin | Register new tool |
| PATCH | `/:id` | ✅ Admin | Update tool config |
| DELETE | `/:id` | ✅ Admin | Remove tool |
| GET | `/provider-status` | ✅ Admin | Check API key config |
| POST | `/:slug/invoke` | ✅ | Direct (sync) tool invocation |

---

## Roles

| Role | Permissions |
|---|---|
| `ADMIN` | Full access — manage tools, users, view queue stats |
| `ARTIST` | Create/manage own projects, submit jobs, manage assets |
| `REVIEWER` | View projects, approve/reject assets, add comments |

---

## Adding a New AI Provider

1. Add API key to `.env` and `src/config/env.ts`
2. Create `src/modules/ai-tools/adapters/<provider>.ts`
3. Add a `case` in `invokeToolDirect()` in `tools.service.ts`
4. Add a `case` in `processAIJob()` in `jobs.processor.ts` for async/batch support
5. Seed the tool in `prisma/seed.ts` or via `POST /api/tools`

---

## Default Seed Credentials

After running `npm run db:seed`:

| Email | Password | Role |
|---|---|---|
| admin@btstudio.ai | password123 | ADMIN |
| david@btstudio.ai | password123 | ARTIST |
| sarah@btstudio.ai | password123 | REVIEWER |

---

## Production Checklist

- [ ] Change `JWT_SECRET` to a cryptographically random 64-char string
- [ ] Set `NODE_ENV=production`
- [ ] Use managed Postgres (RDS, Supabase, Neon) + set `DATABASE_URL`
- [ ] Use managed Redis (Upstash, ElastiCache) + set `REDIS_URL`
- [ ] Add real AI provider API keys
- [ ] Set `CORS_ORIGINS` to your frontend domain
- [ ] Enable SSL/TLS in front of the API (Nginx, Caddy, or cloud load balancer)
- [ ] Set up log aggregation (CloudWatch, Datadog, Logtail)
- [ ] Run `prisma migrate deploy` on deploy (not `db push`)
