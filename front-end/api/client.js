/**
 * api/client.js
 * ─────────────────────────────────────────────────────────────
 * Base HTTP client for BT Studio AI Workspace.
 *
 * - Reads token from localStorage (set on login)
 * - Throws { status, message, code } on API errors
 * - Returns { data, ok: true } on success
 * - If the backend is unreachable (network error or 5xx),
 *   throws { offline: true } so callers can fall back to mock data
 * ─────────────────────────────────────────────────────────────
 */

const API_BASE = (typeof window !== 'undefined' && window.__BT_API_BASE__)
  ? window.__BT_API_BASE__
  : 'https://bt-studio-ai-backend.up.railway.app';

// ─── Token helpers ───────────────────────────

const TOKEN_KEY = 'bt_token';

const auth = {
  getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  },
  clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  },
};

// ─── Core fetch wrapper ──────────────────────

async function request(method, path, body = undefined, options = {}) {
  const token = auth.getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options.signal,
    });
  } catch (networkErr) {
    // Server unreachable → callers fall back to mock data
    throw { offline: true, message: 'Backend offline or unreachable' };
  }

  if (res.status === 204) return { ok: true, data: null };

  let json;
  try { json = await res.json(); } catch { json = {}; }

  if (!res.ok) {
    const err = json?.error ?? {};
    throw {
      status: res.status,
      code: err.code ?? 'API_ERROR',
      message: err.message ?? `HTTP ${res.status}`,
      offline: res.status >= 500,
    };
  }

  return { ok: true, data: json };
}

// ─── Convenience methods ─────────────────────

const apiClient = {
  get:    (path, opts)       => request('GET',    path, undefined, opts),
  post:   (path, body, opts) => request('POST',   path, body,      opts),
  patch:  (path, body, opts) => request('PATCH',  path, body,      opts),
  put:    (path, body, opts) => request('PUT',    path, body,      opts),
  delete: (path, opts)       => request('DELETE', path, undefined, opts),
  auth,
};

window.apiClient = apiClient;
