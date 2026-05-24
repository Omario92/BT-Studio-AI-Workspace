# Frontend & Backend Production Deployment

This document provides a guide to the dynamic environmental configuration, deployment setup, and production pipeline of the BT Studio AI Workspace application.

---

## 1. Dynamic API Resolution (`api/client.js`)

To ensure a seamless deployment experience across local development environments and multi-stage cloud hosting (Vercel + Railway), the frontend uses a highly resilient, multi-tiered dynamic API resolution strategy.

In `front-end/api/client.js`, the base backend URL is calculated instantly on load:

```javascript
const API_BASE = (typeof window !== 'undefined' && window.__BT_API_BASE__)
  ? window.__BT_API_BASE__
  : (typeof process !== 'undefined' && process.env?.VITE_API_URL)
    ? process.env.VITE_API_URL
    : (typeof window !== 'undefined' && window.location.origin.includes('bt-studio-ai-workspace.vercel.app'))
      ? 'https://bt-studio-ai-backend.up.railway.app'
      : 'http://localhost:3001';
```

### The Resolution Chain:
1. **Dynamic Injection (`window.__BT_API_BASE__`)**: If the index page injects a global runtime variable, the app respects it first.
2. **Build-Time Variable (`process.env.VITE_API_URL`)**: Standard bundler variable injected at build time by Vite or similar deployment setups.
3. **Origin-Based Fallback (`window.location.origin`)**: If the current URL indicates a Vercel-deployed production URL (`*vercel.app`), the client automatically points requests to the production Railway backend (`https://bt-studio-ai-backend.up.railway.app`). This makes frontend builds **completely zero-config**!
4. **Local Fallback**: Reverts to `http://localhost:3001` for simple local sandbox execution.

---

## 2. Persistent Authentication & Token Recovery
Authentication credentials are robustly maintained using browser persistent storage:
* **Storage**: Access and Refresh tokens are persisted securely in `localStorage` inside keys `bt_token` and `bt_refresh_token` upon successful login.
* **Frictionless Sessions**: On page reload, the client auto-injects the token into the `Authorization: Bearer <token>` header of every outgoing request.
* **Offline Mock Handshake**: If the backend becomes unreachable, instead of displaying blank pages or generic errors, the API client catches the network failure, flags `{ offline: true }`, and transparently yields offline simulated user data (`usr_alice`), guaranteeing a resilient mockup experience during maintenance.

---

## 3. Production Environment Variables

### Backend Configuration (Railway)
Ensure the following variables are declared within the Railway Service Environment settings:

| Category | Variable Name | Description | Example / Fallback |
| :--- | :--- | :--- | :--- |
| **System** | `PORT` | Auto-allocated by Railway. | `3001` |
| **Database** | `DATABASE_URL` | Deployed PostgreSQL database URL. | `postgresql://...` |
| **Queue** | `REDIS_URL` | Deployed Redis container connection. | `redis://...` |
| **Storage** | `STORAGE_DRIVER` | Active driver mode (`s3` or `local`). | `s3` |
| **S3 / R2** | `AWS_ACCESS_KEY_ID` | Access key for Cloudflare R2 / AWS S3. | `access_key_123` |
| | `AWS_SECRET_ACCESS_KEY` | Secret access key. | `secret_key_abc` |
| | `S3_BUCKET_NAME` | Primary hot storage bucket name. | `bt-studio-assets` |
| | `S3_ENDPOINT` | Direct S3 endpoint (required for R2). | `https://<id>.r2.cloudflarestorage.com` |
| | `AWS_REGION` | S3 Region target. | `auto` / `us-east-1` |
| **GDrive Archive** | `GDRIVE_CLIENT_EMAIL` | Service Account email for backups. | `backups@gdrive.iam.gserviceaccount.com` |
| | `GDRIVE_PRIVATE_KEY` | PEM private key for Google Auth. | `-----BEGIN PRIVATE KEY-----\nMII...` |
| | `GDRIVE_SHARED_DRIVE_ID` | Optional Shared Drive ID layout. | `drive_id_9988` |
| **AI Providers** | `RUNPOD_API_KEY` | RunPod API validation token. | `rpd_secret...` |
| | `RUNPOD_ENDPOINT_ID` | Serverless RunPod runner ID. | `endpoint_99` |
| | `COMFYUI_BASE_URL` | Deployed ComfyUI server domain. | `https://comfy.btstudio.ai` |

---

## 4. Step-by-Step Deployment Guide

### Deploying the Backend on Railway
1. Push the main codebase to your GitHub repository.
2. Link the repository to your Railway Account.
3. Configure a **PostgreSQL Database** service and a **Redis** service on your Railway project board.
4. Attach the main `backend` directory as a service. Set the Build Command to `npm run build` and the Start Command to `npm run start`.
5. Enter all S3 and AI Provider variables into the environment tab of the service.
6. Trigger deployment. Database schema initialization runs automatically via Prisma integration on container startup.

### Deploying the Frontend on Vercel
1. Link the repository to your Vercel Account.
2. Add a new project selecting the repository, pointing the Root Directory to `front-end`.
3. Set the framework preset to `Vite` (or `Other` if using the generic vanilla build).
4. Add the environment variable `VITE_API_URL` pointing to the public Railway Backend URL (e.g., `https://bt-studio-ai-backend.up.railway.app`).
5. Click **Deploy**. Vercel will build the frontend assets and distribute them worldwide instantly.
