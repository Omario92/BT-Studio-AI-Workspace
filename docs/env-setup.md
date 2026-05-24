# BT Studio AI — Environment Setup Guide

This document describes how to configure the environment variables and dependencies for both the frontend and backend of the BT Studio AI Workspace application.

---

## 1. Backend Configuration (`backend/.env`)

The backend is built with Fastify, Prisma, and BullMQ (powered by Redis). It expects a `.env` file in the `backend/` directory for configuration during local development.

An `.env.example` file is provided as a template:

```bash
# ─── Server Configuration ────────────────────────────────────
PORT=3000
HOST=0.0.0.0

# ─── Database Configuration (PostgreSQL) ─────────────────────
# Replace with your local or cloud PostgreSQL connection string
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/bt_studio?schema=public"

# ─── Redis Configuration (Required for BullMQ queues) ────────
# Standard local Redis instance or cloud Redis URI
REDIS_URL="redis://127.0.0.1:6379"

# ─── JWT Authentication Configuration ────────────────────────
# A secure, randomized secret key to sign and verify SSO tokens
JWT_SECRET="super-secret-bt-studio-jwt-key-change-in-production"
```

### Steps to Initialize the Backend Local Environment
1.  **Duplicate the Template:**
    Copy `.env.example` to `.env` inside the `backend/` directory.
2.  **Configure Databases:**
    Ensure you have active PostgreSQL and Redis instances running. You can launch local instances quickly using Docker Compose:
    ```bash
    cd backend
    docker-compose up -d
    ```
3.  **Run Migrations:**
    Push the Prisma schema to your PostgreSQL database and generate the Prisma Client:
    ```bash
    npm run db:generate
    npm run db:push
    ```
4.  **Seed the Database:**
    Populate the database with seeded mock user roles (`alice@btstudio.ai`, `david@btstudio.ai`, `sarah@btstudio.ai` - all passwords are `password123`):
    ```bash
    npm run db:seed
    ```

---

## 2. Frontend Configuration

The frontend is designed to run in two modes:
1.  **Connected Production Mode (Default):**
    If no override variable is set, the frontend defaults to the Railway deployment URL:
    `https://bt-studio-ai-backend.up.railway.app`
2.  **Local Development Override:**
    To redirect the frontend to a local backend instance, set the `window.__BT_API_BASE__` property in a script tag within `front-end/index.html` *before* the API clients are imported:

    ```html
    <!-- API URL Hook (uncomment for local development overrides) -->
    <script>
      window.__BT_API_BASE__ = 'http://localhost:3000';
    </script>
    ```

---

## 3. Launching Locally for Full-Stack Testing

To verify the integration locally, run the applications concurrently:

### Terminal A: Backend Dev Server
```bash
cd backend
npm run dev
```
*Expected log output:* `Server listening at http://0.0.0.0:3000`

### Terminal B: Local Frontend Serving
You can serve the `front-end/` folder using any static file server (such as `npx serve`, Python's `http.server`, or VS Code Live Server).
For example:
```bash
cd front-end
npx serve -l 5000
```
Open `http://localhost:5000` in your web browser, enter `alice@btstudio.ai` / `password123`, and explore the fully synced workspace!
