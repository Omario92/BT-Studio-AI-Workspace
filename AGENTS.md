# Antigravity Coding Agents

## Rules
- Keep code clean, modular, and maintainable.
- Follow modern design aesthetics.
- Do not redesign the UI unless requested.
- Patch only the missing wiring as requested.
- Prioritize clean code and keep components focused.

## Commands
- Frontend dev server: `npm run dev` in `front-end` directory.
- Backend server: `npm run dev` or equivalent in `backend` directory.

## Recent Changes
- (2026-05-25) Fixed the Projects asset selection UI positioning, layout, and checkbox hover/selected visuals to perfectly match the Frame.io reference. Configured CSS variables and left alignment calculations so the bar moves smoothly with the sidebar. Synced styles.css, projects.jsx, and index.html.
- (2026-05-25) Implemented Frame.io-style multi-selection and bulk actions workspace for Projects browser (v6.0). Added interactive hover checkboxes to grid cards, filmstrips, and table rows with Shift-click range support, Ctrl/Cmd+A select all, and Escape to clear selection. Integrated floating bottom actions bar (bulk Delete, Copy, Move, Download, and Use with AI) linked to custom high-performance backend endpoints (`bulk-delete`, `bulk-move`, `bulk-copy`, `bulk-download`, `use-with-ai`) avoiding binary replication. Configured AI Workspace Home page to read selected assets context from localStorage and render a premium quick action card to pre-load assets into bulk AI workbenches. Synced `index.html`.
- (2026-05-25) Implemented advanced Projects Asset Filtering, Sorting, and Searching capabilities (v5.0). Expanded backend ListAssetsQuery with Prisma contains/insensitive operators and group mimeType mappings, enabled parameter forwarding in projects.api.js, and integrated a premium, highly responsive glassmorphic Filter Control Toolbar in projects.jsx. Synced index.html. (Update: Reverted UI toolbar redundant with topbar filter/search inputs, maintaining backend and client API optimizations).
- (2026-05-25) Implemented asset deletion capability. Added DELETE /api/assets/:id integration to front-end assets.api.js and updated AssetReviewModal in projects.jsx to render a dedicated, red 'Delete Asset' button with cascading UI state updates on deletion. Synced index.html.
- (2026-05-25) Prevented fatal React crash (blank screen) when clicking an asset in the process of uploading by adding isUploading safety guards and validating comments structure. Implemented client-side canvas-based WebP thumbnail generation for video uploads, and fallback native video metadata previews for legacy videos without static thumbnails in Grid, List, and Compare views. Synced index.html.
- (2026-05-25) Resolved signed URL contract mismatch by supporting both 'url' and 'fileUrl' responses, ensuring thumbnail hydration and full previews display correctly. Added "Edit in AI Workspace" button to AssetReviewModal, enabling seamless transition and preloading of selected image assets into the Workspace Image Editor. Synced index.html script blocks for projects.jsx and workspace-workbench.jsx.
- (2026-05-25) Implemented client-side image thumbnail generation (canvas WebP resizing) and dual-upload workflow (uploading original and thumbnail separately). Hydrated thumbnails dynamically in AssetGrid, AssetList, and AssetCompare, and switched the full AssetReviewModal preview to on-demand lazy-loading via backend signed URLs to optimize R2 storage usage. Removed the "Send to Review" button from the modal.
- (2026-05-25) Resolved mixed content and connection refused issues for asset images by adding a `resolveFileUrl` helper to dynamically rewrite localhost storage paths to the production backend. Synced front-end/index.html with front-end/screens/projects.jsx and verified changes.
- (2026-05-25) Wired folders plus button, AssetReviewModal selection/onSelect properties, AssetList/AssetCompare integration, and quick debug logs in projects.jsx. Verified backend route registration for folderRoutes.


## vexp <!-- vexp v2.0.17 -->

**MANDATORY: use `run_pipeline` — do NOT grep or glob the codebase.**
vexp returns pre-indexed, graph-ranked context in a single call.

### Workflow
1. `run_pipeline` with your task description — ALWAYS FIRST (replaces all other tools)
2. Make targeted changes based on the context returned
3. `run_pipeline` again only if you need more context

### Available MCP tools
- `run_pipeline` — **PRIMARY TOOL**. Runs capsule + impact + memory in 1 call.
  Auto-detects intent. Includes file content. Example: `run_pipeline({ "task": "fix auth bug" })`
- `get_skeleton` — compact file structure
- `index_status` — indexing status
- `expand_vexp_ref` — expand V-REF placeholders in v2 output

### Agentic search
- Do NOT use built-in file search, grep, or codebase indexing — always call `run_pipeline` first
- If you spawn sub-agents or background tasks, pass them the context from `run_pipeline`
  rather than letting them search the codebase independently

### Smart Features
Intent auto-detection, hybrid ranking, session memory, auto-expanding budget.

### Multi-Repo
`run_pipeline` auto-queries all indexed repos. Use `repos: ["alias"]` to scope. Run `index_status` to see aliases.
<!-- /vexp -->