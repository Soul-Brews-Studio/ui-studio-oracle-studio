/**
 * Host resolution — ported from maw-ui's src/lib/api.ts (local.drizzle.studio pattern).
 *
 * User visits studio.buildwithoracle.com/?host=localhost:47778 (or any host:port,
 * or full http:// / https:// URL). The host is saved to localStorage and the URL
 * is cleaned. All subsequent fetches go through apiUrl(path) which prepends the
 * saved host.
 *
 * Three accepted forms for ?host=:
 *   ?host=localhost:47778              → http://localhost:47778 (bare host:port defaults to http
 *                                         because arra-oracle-v3 serves plain HTTP by default)
 *   ?host=http://oracle-world:47778    → http://oracle-world:47778 (explicit, same result)
 *   ?host=https://mba.wg:47778         → https://mba.wg:47778 (if user has mkcert or TLS setup)
 *
 * No stored host → same-origin (useful when studio is served from the same MCP).
 */

const STORAGE_KEY = 'oracle-studio-host';
const RECENT_KEY = 'oracle-studio-host-recent';
const RECENT_LIMIT = 8;
const DEFAULT_HOST = 'http://localhost:47778';

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const urlHost = params.get('host');

// Auto-persist: ?host= in URL → save to localStorage → redirect clean
if (urlHost && typeof window !== 'undefined') {
  localStorage.setItem(STORAGE_KEY, urlHost);
  addRecentHost(urlHost);
  const url = new URL(window.location.href);
  url.searchParams.delete('host');
  window.location.replace(url.toString());
}

// Resolution: stored host > DEFAULT_HOST (localhost:47778).
// Always resolves to *some* host; users can override via ?host= in the URL.
const storedHost = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const hostParam = storedHost ?? DEFAULT_HOST;

export const isRemote = !!storedHost;
export const isDefault = !storedHost;
export const activeHost: string = hostParam;

export function getStoredHost(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
}

export function setStoredHost(host: string): void {
  localStorage.setItem(STORAGE_KEY, host);
  addRecentHost(host);
}

export function clearStoredHost(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getRecentHosts(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentHost(host: string): void {
  const recent = getRecentHosts().filter((h) => h !== host);
  recent.unshift(host);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, RECENT_LIMIT)));
}

function resolveHost(): { httpProto: string; wsProto: string; host: string } {
  if (hostParam.startsWith('https://')) {
    return {
      httpProto: 'https:',
      wsProto: 'wss:',
      host: hostParam.slice('https://'.length).replace(/\/+$/, ''),
    };
  }
  if (hostParam.startsWith('http://')) {
    return {
      httpProto: 'http:',
      wsProto: 'ws:',
      host: hostParam.slice('http://'.length).replace(/\/+$/, ''),
    };
  }
  // Bare host:port — default to http because arra-oracle-v3 serves plain HTTP.
  // Chrome's Private Network Access CORS allows this from https origins.
  return { httpProto: 'http:', wsProto: 'ws:', host: hostParam.replace(/\/+$/, '') };
}

/** Build a full URL for fetch(). Accepts an `/api/...` path and prepends the configured host. */
export function apiUrl(path: string): string {
  const r = resolveHost();
  return `${r.httpProto}//${r.host}${path}`;
}

/** WebSocket URL builder. */
export function wsUrl(path: string): string {
  const r = resolveHost();
  return `${r.wsProto}//${r.host}${path}`;
}

/** Human-readable host label for UI (`localhost:47778 (default)` or `mba.wg:47778`). */
export function hostLabel(): string {
  const r = resolveHost();
  const withoutProto = `${r.host}`;
  return isDefault ? `${withoutProto} (default)` : withoutProto;
}
