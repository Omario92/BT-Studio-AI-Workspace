# BT Studio AI — Frontend-Backend Integration & Connection Architecture

This document summarizes the connection architecture, data flows, and offline fallback strategies used to connect the static high-fidelity BT Studio AI Workspace prototype to the scalable Fastify & Prisma-powered backend on Railway.

---

## 1. Connection Architecture

The application is structured as a premium single-page web app. The frontend communicates with the backend via a base HTTP client that coordinates requests, authentication, and offline failover.

### Base Endpoint Configuration
*   **Production API URL:** `https://bt-studio-ai-backend.up.railway.app`
*   **Local Development API URL:** `http://localhost:3000` (or `http://localhost:3001` depending on custom backend ports)
*   **Resolution Strategy:**
    *   The frontend reads `window.__BT_API_BASE__` if defined.
    *   If not defined, it defaults to the production Railway URL (`https://bt-studio-ai-backend.up.railway.app`).

### Token-Based Authentication Flow
All requests are authorized using standard HTTP headers containing JSON Web Tokens (JWT).
1.  **Tokens Storage:** Access tokens and refresh tokens are stored securely in `localStorage` under `bt_token` and `bt_refresh_token` keys.
2.  **Authorization Header:** Every request made via `apiClient` automatically appends `Authorization: Bearer <accessToken>` when a token is present.
3.  **Active Route Guard:**
    *   When the application mounts, `App` reads the active token.
    *   If no token exists, the user is redirected immediately to the SSO login view.
    *   If a token exists, the frontend calls `GET /api/auth/me` to fetch user identity, roles (e.g. `ADMIN`, `ARTIST`, `ART_DIRECTOR`), and profile details.
    *   On token expiration or verification failure, tokens are cleaned up and the user is redirected back to the login screen.

---

## 2. API Client & Fallback Engine

The core design of the full-stack MVP emphasizes robustness. Even if the backend API is unreachable or suffers from internal errors, the frontend gracefully falls back to static high-fidelity mock data to maintain a working prototype experience.

### Base Client Wrapper (`front-end/api/client.js`)
The API Client intercepts and formats network requests:
*   **Offline/Error Detection:**
    *   Any standard network exceptions (e.g. DNS failure, connection refused) are intercepted.
    *   5xx Server Errors are marked as offline triggers (`offline: true`).
    *   4xx Client Errors (like `401 Unauthorized` or `400 Bad Request`) are treated as normal business errors and passed up to the caller to render error messages on forms.
*   **Fallback Pattern:**
    All feature API modules (e.g. `projects.api.js`, `activity.api.js`, `jobs.api.js`) wrap their fetch requests in try/catch blocks that intercept the `{ offline: true }` exception:
    ```javascript
    async function listProjects() {
      try {
        const { data } = await apiClient.get('/api/projects');
        return { data: data.projects, fromCache: false };
      } catch (err) {
        if (err.offline) {
          return { data: MOCK_PROJECTS, fromCache: true }; // offline fallback
        }
        throw err; // bubble up authentic 4xx errors
      }
    }
    ```

---

## 3. Screen Synchronization Details

### SSO Login Screen (`front-end/screens/login.jsx`)
*   **Endpoint:** `POST /api/auth/login`
*   **Actions:** Sends credentials (e.g., seeded `alice@btstudio.ai` / `password123`) to exchange for `accessToken` and `refreshToken`.
*   **Loading/Error States:** Displays dynamic spin indicators during request flight, and renders validation banners on `401 Unauthorized` responses.

### Dashboard Screen (`front-end/screens/dashboard.jsx`)
*   **Endpoint:** `GET /api/dashboard/summary`
*   **Data Rendered:** Live KPI grid (Active Projects, Generated Frames, Awaiting Approval, GPU Queue size), interactive recent projects list, open assignments, and timeline activity.
*   **Offline Warning Banner:** An amber status banner is rendered at the top of the dashboard whenever the fallback cache is in use, informing reviewers that they are seeing mock data due to connection issues.

### Projects View Screen (`front-end/screens/projects.jsx`)
*   **Endpoints:**
    *   `GET /api/projects` (List projects)
    *   `GET /api/projects/:id` (Fetch single project detail)
    *   `GET /api/projects/:id/folders` (Fetch folders nested under project)
    *   `GET /api/projects/:id/assets` (Fetch asset files located inside selected folders)
*   **Interactions:** The tree navigation dynamically loads folders and triggers file grids. Action headers allow toggling between Grid, List, and Split Compare view layouts.

### AI Workspace Hub (`front-end/screens/workspace-home.jsx` / `workspace.jsx`)
*   **Endpoints:**
    *   `GET /api/tools` (Live AI tools available on cluster)
    *   `GET /api/jobs` (Recent generation tasks history)
    *   `POST /api/jobs` (Enqueue a new `IMAGE_GENERATION` task)
    *   `GET /api/jobs/:id` (Poll for background progress updates)
*   **BullMQ Job Flow:**
    1.  Clicking **Regenerate** triggers a `POST` request to spawn an asynchronous image generation job.
    2.  The task is queued via Redis in the Fastify backend, and handled by an asynchronous worker that increments job progress.
    3.  The frontend starts a reactive polling interval (`1500ms`) to query the status of the job.
    4.  A progress bar and state badge (QUEUED → RUNNING → COMPLETED) are rendered live in the Output Preview canvas.
    5.  Upon successful completion, the canvas stage renders the completed asset output.
