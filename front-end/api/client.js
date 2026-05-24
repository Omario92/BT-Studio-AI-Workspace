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
  : (typeof process !== 'undefined' && process.env?.VITE_API_URL)
    ? process.env.VITE_API_URL
    : (typeof window !== 'undefined' && window.location.origin.includes('bt-studio-ai-workspace.vercel.app'))
      ? 'https://bt-studio-ai-backend.up.railway.app'
      : 'http://localhost:3001';

// ─── Token helpers ───────────────────────────

const TOKEN_KEY = 'bt_token';
const REFRESH_KEY = 'bt_refresh_token';

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
  getRefreshToken() {
    try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
  },
  setRefreshToken(token) {
    try { localStorage.setItem(REFRESH_KEY, token); } catch {}
  },
  clearRefreshToken() {
    try { localStorage.removeItem(REFRESH_KEY); } catch {}
  },
  async login(email, password) {
    const { data } = await apiClient.post('/api/auth/login', { email, password });
    if (data.accessToken) {
      auth.setToken(data.accessToken);
    }
    if (data.refreshToken) {
      auth.setRefreshToken(data.refreshToken);
    }
    return data;
  },
  async getMe() {
    try {
      const { data } = await apiClient.get('/api/auth/me');
      return data.user;
    } catch (err) {
      if (err.offline) {
        return {
          id: 'usr_alice',
          name: 'Alice Chen',
          email: 'alice@btstudio.ai',
          role: 'ADMIN',
          avatarUrl: null,
        };
      }
      throw err;
    }
  },
  async logout() {
    auth.clearToken();
    auth.clearRefreshToken();
  }
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
  baseUrl: API_BASE,
};

window.apiClient = apiClient;
