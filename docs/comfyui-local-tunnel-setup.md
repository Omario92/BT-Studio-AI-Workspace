# ComfyUI on local PC → BT Studio (via Cloudflared / localtunnel)

This setup lets the backend on Railway call a ComfyUI instance running on
your local GPU, exposed over an HTTPS tunnel. The backend acts as the only
network client — the browser never talks to ComfyUI directly.

```
Browser → Backend (Railway) → tunnel URL → ComfyUI on your PC
```

## 1. Run ComfyUI locally

```
cd ComfyUI
python main.py --listen 127.0.0.1 --port 8188
```

Open <http://127.0.0.1:8188> in a browser to confirm it loads.

## 2. Expose it with a tunnel

Pick one:

**Cloudflared quick tunnel** (recommended — stable HTTPS, no signup):

```
cloudflared tunnel --url http://127.0.0.1:8188
```

Copy the printed `https://<random>.trycloudflare.com` URL.

**npx localtunnel** (fallback):

```
npx localtunnel --port 8188
```

Copy the printed `https://<random>.loca.lt` URL. localtunnel sometimes
shows an interstitial page on first GET; cloudflared does not.

## 3. Export the upscale workflow

In ComfyUI:

1. Build (or import) the upscale graph you want to run.
2. Click the gear icon → **Enable Dev mode Options**.
3. Use **Save (API Format)** → minify the resulting JSON to a single line.

The graph must contain:
- a `LoadImage` node — its `inputs.image` will be replaced with the uploaded source filename.
- a `SaveImage` node — its `inputs.filename_prefix` will be set per-job.

If you have multiple `LoadImage` nodes, set
`COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID` to the right node id. Same for
`SaveImage` via `COMFYUI_UPSCALE_SAVE_IMAGE_NODE_ID`.

## 4. Railway env vars

```
AI_PROVIDER_PRIORITY=comfyui,mock
COMFYUI_BASE_URL=https://<your-tunnel-url>
COMFYUI_TIMEOUT_MS=300000

# Paste the minified API JSON here
COMFYUI_DEFAULT_WORKFLOW_UPSCALE={"3":{"inputs":{...},"class_type":"LoadImage"}, ...}

# Optional — only if auto-scan picks the wrong node
COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID=
COMFYUI_UPSCALE_SAVE_IMAGE_NODE_ID=

# Optional — only if your tunnel front needs an auth header
# COMFYUI_API_KEY=  # sets Authorization: Bearer <key>
# COMFYUI_AUTH_HEADER=X-Tunnel-Secret: my-shared-secret
```

Make sure the AITool row for slug=`upscaler` has `provider='comfyui'` (or
leave blank and rely on `AI_PROVIDER_PRIORITY`).

## 5. Redeploy & verify

```
# Backend
git push       # triggers Railway deploy

# Local smoke (optional, exercises ComfyUI directly)
cd backend
npx tsx scratch/comfyui-upscale.smoke.ts
```

## 6. End-to-end test from the UI

1. Open the deployed app in a browser.
2. **Projects** → upload an image (any size) → select it.
3. Click **Use with AI**.
4. **AI Workspace → Image Upscaler** — the source card should be preloaded.
5. Click **Upscale**.
6. Watch the job:
   - `currentJob.provider === "comfyui"` in the backend log.
   - The output appears in the After pane.
   - `Created new AssetVersion` chip appears.
7. **Open in Project** — the modal shows v2 alongside v1.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `IMAGE_UPSCALE requires sourceFileKey or sourceFileUrl` | Asset has no `metadata.fileKey` and no `fileUrl`. Re-upload via the new upload flow. |
| `No LoadImage node found in ComfyUI upscale workflow` | Your workflow JSON doesn't have a `LoadImage` node, or auto-scan picked the wrong one. Set `COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID`. |
| Job stuck PENDING then `FAILED` | Tunnel went down or ComfyUI crashed. `GET <COMFYUI_BASE_URL>/system_stats` from Railway shell to confirm reachability. |
| `COMFYUI_DEFAULT_WORKFLOW_UPSCALE is not set` | Set the minified API-format JSON on Railway. |
| Output is the same stock image | You're on an old build that hit `COMFYUI_NOT_CONFIGURED`'s old stub. Pull latest — the provider now returns FAILED+notConfigured and the chain falls back to mock. |
