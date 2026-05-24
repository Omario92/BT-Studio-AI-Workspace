# BT Studio AI — Railway Deployment Checklist

This deployment checklist guides you through provisioning and launching the full-stack BT Studio AI Workspace on Railway, ensuring the Fastify API server, PostgreSQL database, and Redis background queues are properly configured.

---

## Step 1: Provision Core Infrastructure (Railway Dashboard)
Log into your Railway account and provision the database and caching plugins required for data storage and job queuing:
1.  **Add a PostgreSQL Service:**
    *   Click **+ New** → **Database** → **Add PostgreSQL**.
    *   Railway will spin up a PostgreSQL container and automatically define the standard database connection strings.
2.  **Add a Redis Service:**
    *   Click **+ New** → **Database** → **Add Redis**.
    *   This Redis database is required by **BullMQ** to handle background generation job queues (`IMAGE_GENERATION`).

---

## Step 2: Deploy the Backend API Service
Connect your GitHub repository to Railway and build the Fastify server:
1.  **Deploy from Repo:**
    *   Click **+ New** → **GitHub Repo** → select `Omario92/BT-Studio-AI-Workspace`.
    *   Select the root directory or configure Railway path configurations if deploying from a monorepo setup (set **Root Directory** to `backend`).
2.  **Configure Build & Start Commands:**
    *   Under settings, verify that Railway uses the package manager configuration inside `backend/package.json`.
    *   **Build Command:** `npm run build` (runs `tsc --project tsconfig.json`)
    *   **Start Command:** `npx prisma db push && npm run start`
        *   *Tip:* Prepending `npx prisma db push` to the start command ensures that database schemas are synchronized with your PostgreSQL database automatically on every deploy.

---

## Step 3: Configure Service Environment Variables (Backend)
Navigate to the **Variables** tab of your deployed backend service on Railway and bind the following variables:

| Variable Name | Value / Connection String | Notes |
| :--- | :--- | :--- |
| **`PORT`** | *Automatically managed* | Do not override. Railway binds and exposes this port dynamically at runtime. |
| **`DATABASE_URL`** | `${{Postgres.DATABASE_URL}}` | Use Railway's reference syntax to link the provisioned PostgreSQL instance. |
| **`REDIS_URL`** | `${{Redis.REDIS_URL}}` | Use Railway's reference syntax to link the Redis instance for BullMQ queues. |
| **`JWT_SECRET`** | `generate-a-secure-32-character-random-string` | Used to sign access and refresh tokens for SSO. |
| **`HOST`** | `0.0.0.0` | Forces Fastify to bind correctly to all interfaces. |

---

## Step 4: Database Seeding (Optional / Initial Setup)
Once the database container is live and schemas have been pushed:
1.  **Seed Credentials:**
    Connect to your service shell via Railway CLI or run a one-off task to seed the default admin/artist accounts:
    ```bash
    cd backend
    npm run db:seed
    ```
2.  **Seeded Credentials Reference:**
    *   **Alice Chen (Admin):** `alice@btstudio.ai` / `password123`
    *   **David Kim (Artist):** `david@btstudio.ai` / `password123`
    *   **Sarah Connor (Art Director):** `sarah@btstudio.ai` / `password123`

---

## Step 5: Verify the Deployment
1.  **Check API Health:**
    Test the server's public endpoint to ensure the Fastify server has launched successfully:
    ```bash
    curl https://bt-studio-ai-backend.up.railway.app/
    ```
    *Expected JSON response:* `{ "status": "ok", "message": "BT Studio AI API Server is operational" }` (or similar root health check message).
2.  **Inspect Railway Logs:**
    *   Open the service logs in Railway.
    *   Verify the server has successfully connected to the PostgreSQL server and initialized the BullMQ Redis scheduler.
    *   Make sure there are no database connection or token configuration errors.
