/**
 * api/tools.api.js
 * GET /api/tools  — returns all active AI tools
 *
 * Falls back to TOOLS defined in workspace-tools.jsx when offline.
 * The API response shape is mapped to match the frontend TOOLS format.
 */

// ─── Map DB ToolCategory → frontend cat key ──

const CATEGORY_MAP = {
  IMAGE:   'image',
  VIDEO:   'video',
  AUDIO:   'audio',
  SPACES:  'spaces',
  THREE_D: '3d',
};

function mapTool(t) {
  return {
    id:    t.slug,
    cat:   CATEGORY_MAP[t.category] ?? t.category?.toLowerCase() ?? 'image',
    name:  t.name,
    desc:  t.description ?? '',
    icon:  null,           // icon resolved in frontend from t.icon key
    iconKey: t.icon,       // raw icon key for lookup in I object
    badge: t.badge ? { kind: t.badgeKind ?? 'new', text: t.badge } : null,
    _dbId: t.id,           // keep DB id for job creation
  };
}

async function listTools({ activeOnly = true } = {}) {
  const query = activeOnly ? '' : '?all=true';
  try {
    const { data } = await apiClient.get(`/api/tools${query}`);
    const mapped = data.tools.map(mapTool);
    return { data: mapped, fromCache: false };
  } catch (err) {
    if (err.offline) {
      // Fall back to static TOOLS defined in workspace-tools.jsx
      const fallback = (typeof TOOLS !== 'undefined') ? TOOLS : [];
      return { data: fallback, fromCache: true };
    }
    throw err;
  }
}

async function getTool(id) {
  const { data } = await apiClient.get(`/api/tools/${id}`);
  return mapTool(data.tool);
}

const toolsApi = { listTools, getTool };
window.toolsApi = toolsApi;
