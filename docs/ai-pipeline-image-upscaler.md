# Image Upscaler — End-to-End AI Pipeline

The first real **Asset → AI Workspace → Result** vertical slice. This is the
template every other tool (Editor, Remove BG, Variations, …) follows next.

## Flow

```
Projects screen
  │  select 1+ assets, click "Use with AI"
  ▼
localStorage: bt_selected_assets_for_ai = { projectId, assets[], toolId }
  │  full reload, screen switches to "workspace"
  ▼
Workspace / Upscaler Workbench
  │  reads selected asset, shows real preview
  │  user picks scale (2x/4x/8x), face_enhance
  │  click "Upscale"
  ▼
POST /api/assets/use-with-ai
  body: { assetIds, projectId, toolId: "upscaler",
          jobType: "IMAGE_UPSCALE", mode: "single",
          params: { scale, faceEnhance } }
  │  backend resolves toolId slug → DB id
  │  passes params.assetId = source asset id  ← key bit
  │  enqueues BullMQ job
  ▼
BullMQ worker → processAIJob(jobId)
  │  gets tool config from AITool.config (model + version)
  │  ReplicateProvider.invoke({ version, input: { image: fileUrl, scale, face_enhance } })
  │  status PENDING → polls every 2s until succeeded/failed
  │  storageService.copyFromUrl(replicateOutputUrl → R2)
  │  createVersion(sourceAssetId, { fileUrl: r2Url, jobId })  ← appends as v2
  ▼
Frontend Workbench polls GET /api/jobs/:id every 2s
  │  status RUNNING → progress bar
  │  status COMPLETED → render result.fileUrl in After pane
  │  status FAILED → show errorMsg
  │  "Open in project" → navigate back, project shows v2 in asset review modal
```

## Setup steps

### 1. Set env vars on Railway

```
REPLICATE_API_TOKEN=r8_xxx…                                    # required
STORAGE_DRIVER=s3                                              # already set
STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com    # already set
STORAGE_BUCKET=bt-studio-assets                                # already set
STORAGE_ACCESS_KEY_ID=…
STORAGE_SECRET_ACCESS_KEY=…
STORAGE_PUBLIC_BASE_URL=https://pub-…r2.dev
DISABLE_REDIS=false                                            # BullMQ needs Redis
REDIS_URL=${{Redis.REDIS_URL}}
```

### 2. Seed the upscaler tool with Replicate config

After backend deploy:

```bash
cd backend
npm run seed:replicate
```

This upserts `AITool[slug=upscaler]` with:
- `provider = "replicate"`
- `modelId = "nightmareai/real-esrgan"`
- `config.version = "f121d640bd286…"` (pinned for reproducibility)
- `config.inputMap = { image: "fileUrl", scale: "scale", face_enhance: "faceEnhance" }`
- `config.defaults = { scale: 4, face_enhance: false }`

Safe to re-run. To upgrade the model, edit `scratch/seed-replicate-tools.ts`
and bump the `version` hash.

### 3. Manual test

1. Login → Projects → upload an image (or pick an existing one)
2. Hover the asset card, check the selection box, click **Use with AI** → Upscaler
3. Page reloads onto the Upscaler workbench, source thumbnail matches
4. Pick scale (default 4x), leave face enhance on
5. Click **Upscale**
6. Button shows `Starting… → Queued… → Upscaling… N%` (polled every 2s)
7. After ~10–30s the After pane shows the upscaled image
8. Click **Open in project** → project page, asset has a v2 in its versions list

## Adding the next tool (Remove BG / Editor / Variations)

Same shape. Each new tool needs:

1. **AITool row** with `provider = "replicate"` (or another adapter) and a
   `config` JSON with `{ model, version, inputMap, defaults }`. Add to
   `scratch/seed-replicate-tools.ts`.
2. **Frontend Workbench component** that:
   - Reads `bt_selected_assets_for_ai` for source
   - Has tool-specific controls (prompt, mask, strength, etc.)
   - Calls `assetsApi.useWithAI([sourceId], { toolId: "<slug>", jobType, mode: "single", params: {...tool inputs} })`
   - Polls `jobsApi.getJob(id)` until terminal status
   - Renders `result.fileUrl` (and uses `result.assetId` for the back-to-project button)
3. No backend changes needed — `processAIJob` is provider-agnostic; the only
   per-tool branching is the `inputMap` in the tool config.

## Where it lives

| Layer | File | Purpose |
|---|---|---|
| Provider | `backend/src/modules/ai-tools/providers/replicate.provider.ts` | Calls Replicate API, polls, normalizes result |
| Factory  | `backend/src/modules/ai-tools/providers/provider.factory.ts`  | Maps `provider` string → provider instance |
| Job seed | `backend/scratch/seed-replicate-tools.ts` | Configures tools to use Replicate (idempotent) |
| Service  | `backend/src/modules/assets/assets.service.ts → useAssetsWithAI()` | Resolves toolId, sets params.assetId so processor appends version |
| Processor | `backend/src/modules/jobs/jobs.processor.ts → processAIJob()` | Already provider-agnostic; downloads output → R2 → createVersion |
| Workbench | `front-end/screens/workspace-workbench.jsx → UpscalerWorkbench` | UI + state machine + 2s polling |

## Cost notes

Real-ESRGAN on Replicate runs ~$0.0009 per second on a T4. A 4× upscale of a
1024px image takes ~10s → roughly **$0.01 per upscale**. Hard-cap budgets at the
account level on Replicate before opening to end users.
