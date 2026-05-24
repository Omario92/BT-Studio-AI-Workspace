# BT Studio AI — Database Model

> **ORM:** Prisma  
> **Database:** PostgreSQL  
> **Schema:** `backend/prisma/schema.prisma`

---

## Enums

### Role
Controls access within the system.

| Value | Description |
|-------|-------------|
| `ADMIN` | Full system access |
| `PRODUCER` | Project management, approvals |
| `ARTIST` | Asset creation, uploads |
| `ART_DIRECTOR` | Reviews, revisions, approvals |
| `AI_ENGINEER` | Job management, tool config |
| `REVIEWER` | Review-only access |
| `VIEWER` | Read-only |

### ProjectStatus
| Value | Description |
|-------|-------------|
| `ACTIVE` | In production |
| `WIP` | Work in progress |
| `COMPLETED` | Delivered |
| `ARCHIVED` | Inactive |

### AssetStatus
| Value | Description |
|-------|-------------|
| `DRAFT` | Initial state |
| `IN_REVIEW` | Submitted for review |
| `REVISION_REQUESTED` | Reviewer requested changes |
| `APPROVED` | Approved by reviewer |
| `REJECTED` | Rejected — do not ship |
| `FINAL` | Locked final version |
| `ARCHIVED` | No longer active |
| `GENERATING` | AI job in progress |
| `FAILED` | Generation failed |

### JobStatus
| Value | Description |
|-------|-------------|
| `QUEUED` | Waiting in BullMQ queue |
| `RUNNING` | Worker processing |
| `COMPLETED` | Output saved to asset |
| `FAILED` | Worker threw error |
| `CANCELLED` | Manually cancelled |

### JobType
`IMAGE_GENERATION`, `IMAGE_UPSCALE`, `IMAGE_EDIT`, `VARIATION`, `REMOVE_BACKGROUND`, `RELIGHT`, `VIDEO_GENERATION`, `VOICE_GENERATION`, `BATCH_GENERATION`, `CUSTOM`

### ToolCategory
| Prisma Value | Frontend `cat` |
|---|---|
| `IMAGE` | `image` |
| `VIDEO` | `video` |
| `AUDIO` | `audio` |
| `SPACES` | `spaces` |
| `THREE_D` | `3d` |

### ReviewDecision
`APPROVED`, `REJECTED`, `REVISION_REQUESTED`

---

## Models

### User
```
id           String        @id @default(cuid())
email        String        @unique
name         String
passwordHash String
role         Role          @default(ARTIST)
avatarUrl    String?
createdAt    DateTime      @default(now())
updatedAt    DateTime      @updatedAt
```
Relations: `projects` (ProjectMember[]), `assignedTasks` (Assignment[]), `activityLogs` (ActivityLog[]), `reviews` (Review[]), `comments` (Comment[])

---

### Project
```
id          String         @id @default(cuid())
name        String
client      String?
status      ProjectStatus  @default(ACTIVE)
progress    Int            @default(0)
tone        String?        -- UI color hint: rose, amber, teal, violet, blue, green
isPinned    Boolean        @default(false)
createdAt   DateTime       @default(now())
updatedAt   DateTime       @updatedAt
```
Relations: `members` (ProjectMember[]), `folders` (Folder[]), `assets` (Asset[]), `jobs` (AIJob[]), `assignments` (Assignment[]), `activityLogs` (ActivityLog[])

---

### ProjectMember
```
id        String   @id @default(cuid())
projectId String
userId    String
role      Role     @default(ARTIST)
joinedAt  DateTime @default(now())
@@unique([projectId, userId])
```

---

### Folder
```
id        String   @id @default(cuid())
projectId String
parentId  String?  -- null = root folder
name      String
sortOrder Int      @default(0)
createdAt DateTime @default(now())
```
Relations: `children` (Folder[]), `assets` (Asset[])

Default folders created per project: `Brief`, `Script`, `Sketches`, `References`, `Generated`, `Final Output`

---

### Asset
```
id             String      @id @default(cuid())
projectId      String
folderId       String?
name           String
status         AssetStatus @default(DRAFT)
currentVersion Int         @default(1)
url            String?     -- URL of the current/latest version file
thumbnailUrl   String?
mimeType       String?
createdById    String
createdAt      DateTime    @default(now())
updatedAt      DateTime    @updatedAt
```
Relations: `versions` (AssetVersion[]), `comments` (Comment[]), `activityLogs` (ActivityLog[])

> **Immutability rule:** Every AI generation, edit, or upscale creates a new `AssetVersion` record. The `Asset` record is never overwritten — `currentVersion` is incremented and `url` is updated to the latest output.

---

### AssetVersion
```
id            String      @id @default(cuid())
assetId       String
versionNumber Int
url           String
prompt        String?
modelId       String?
seed          BigInt?
metadata      Json?       -- { width, height, steps, cfg, etc. }
status        AssetStatus @default(DRAFT)
createdById   String
createdAt     DateTime    @default(now())
@@unique([assetId, versionNumber])
```
Relations: `reviews` (Review[])

---

### Review
```
id         String         @id @default(cuid())
versionId  String
reviewerId String
decision   ReviewDecision
comment    String?        -- required when REJECTED or REVISION_REQUESTED
createdAt  DateTime       @default(now())
```

> **Business rules:**
> - `REJECTED` and `REVISION_REQUESTED` require a non-empty `comment` (enforced in service layer, throws `400 Bad Request` otherwise)
> - `APPROVED` comment is optional
> - Every review creates an `ActivityLog` entry atomically

---

### Comment
```
id        String   @id @default(cuid())
assetId   String
authorId  String
body      String
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

---

### Assignment
```
id          String    @id @default(cuid())
title       String
projectId   String?
assigneeId  String
dueAt       DateTime?
isDone      Boolean   @default(false)
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
```

---

### AIJob
```
id          String    @id @default(cuid())
projectId   String
folderId    String?
toolId      String?
type        JobType
name        String
status      JobStatus @default(QUEUED)
progress    Int       @default(0)
prompt      String?
modelId     String?
params      Json?
outputUrl   String?
errorMsg    String?
createdById String
startedAt   DateTime?
completedAt DateTime?
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
```
Relations: `activityLogs` (ActivityLog[])

Queue name: `ai-jobs` (BullMQ + Redis). Worker payload: `{ jobId: string }`.

---

### AITool
```
id          String       @id @default(cuid())
name        String       @unique
desc        String
category    ToolCategory
icon        String?      -- SVG string (populated at runtime)
iconKey     String?      -- Key into window.I map (e.g. "imageGen")
badge       String?      -- Badge label text (e.g. "NEW", "BETA")
badgeKind   String?      -- Badge style (e.g. "new", "beta")
sortOrder   Int          @default(0)
isActive    Boolean      @default(true)
createdAt   DateTime     @default(now())
updatedAt   DateTime     @updatedAt
```

---

### ActivityLog
```
id         String   @id @default(cuid())
userId     String?
projectId  String?
assetId    String?
jobId      String?
action     String   -- e.g. "approved", "uploaded", "completed batch"
entityType String?  -- "asset" | "job" | "project"
entityId   String?
detail     String?
createdAt  DateTime @default(now())
```

---

### Template
```
id          String   @id @default(cuid())
name        String   @unique
desc        String?
category    String
presets     Int      @default(1)
lockable    Boolean  @default(false)
tags        String[]
tone        String?
uses        String?  -- e.g. "Used in 4 projects"
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```

---

## Entity Relationship Summary

```
User ──< ProjectMember >── Project ──< Folder ──< Asset ──< AssetVersion ──< Review
                              │                      │
                              └──< AIJob             └──< Comment
                              │
                              └──< Assignment
                              │
                              └──< ActivityLog
```

---

## Seed Data (`backend/prisma/seed.ts`)

| Entity | Count | Notes |
|--------|-------|-------|
| Users | 5 | Alice (ADMIN), David (ARTIST), Sarah (ART_DIRECTOR), Tom (AI_ENGINEER), Maria (REVIEWER) |
| Projects | 6 | Huda, Halida, Excool, Obagi, Product Render V3 (pinned), Character Model 01 (pinned) |
| Folders | 36 | 6 default folders × 6 projects |
| Assets | 7 | With historical AssetVersion records |
| Reviews | 3 | Approved, Revision Requested |
| AI Tools | 30 | Full workspace tool set |
| Templates | 8 | Across Image, Video, Audio, 3D categories |
| Jobs | 5 | Sample jobs in mixed statuses |
| Assignments | 4 | Assigned to Alice |
| Activity Logs | 9 | Matching the UI prototype timeline |

Run seed: `cd backend && npm run db:seed`
