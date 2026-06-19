// Persistent production server for the Fleet Town (MVP-2).
//
// Unlike the Vite dev plugin, this is an always-on Bun server that serves the
// built studio bundle (dist/) + the live /__fleet/state endpoint. It is meant to
// run behind Caddy (basic-auth + HTTPS) and bind to localhost only.
//
// Town is deliberately ISOLATED from the memory backbone: only the two SPA-gate
// endpoints (/api/health, /api/auth/status) are forwarded to the Oracle API; every
// other /api/* path is refused, so exposing the town never exposes Oracle memory.
//
//   bun server/fleet-server.ts            # FLEET_PORT=8788 by default
import { join, normalize } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { getFleetState } from './fleet-probe';
import { capturePane, sendToPane, sendKey, closePane } from './pane-io';
import { transcriptFor } from './transcript';
import { listRoles, spawnAgent } from './agents';
import { handlePush, startNotifyLoop } from './push';
import { getEnvStatus, startEnvProbe } from './env-probe';
import { getUsageSnapshot, startUsage } from './usage';

const DIST = join(import.meta.dir, '..', 'dist');
const PORT = Number(process.env.FLEET_PORT || 8788);
const HOST = process.env.FLEET_HOST || '127.0.0.1';
const ORACLE = process.env.ORACLE_API_URL || 'http://localhost:47778';
const API_ALLOW = new Set(['/api/health', '/api/auth/status']);

// The studio's host resolver (src/api/host.ts) defaults /api to http://localhost:47778
// (the VIEWER's machine), which fails on a remote origin and trips BackendGate. Seed
// localStorage with the page origin BEFORE the app bundle evaluates so /api resolves
// same-origin → our forwarded /api/health passes the gate (the rest of /api stays 404'd).
const SEED = `<script>try{var k='oracle-studio-host';if(!localStorage.getItem(k))localStorage.setItem(k,location.origin);}catch(e){}</script>`;
// PWA: make /town installable + register the service worker (push display).
// The apple-mobile-web-app-* metas make iOS launch it in STANDALONE mode from the
// Home Screen — required for the Push API (window.PushManager) to be exposed there.
const PWA = [
  `<link rel="manifest" href="/manifest.webmanifest">`,
  `<meta name="theme-color" content="#6a7a30">`,
  `<link rel="apple-touch-icon" href="/icon-192.png">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`,
  `<meta name="apple-mobile-web-app-title" content="Fleet Town">`,
  `<script>if('serviceWorker'in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>`,
].join('');
const INDEX_HTML = (await Bun.file(join(DIST, 'index.html')).text()).replace('<head>', '<head>' + SEED + PWA);

const EMPTY = {
  ts: '', host: '', agents: [], teams: [], roads: [],
  counts: { working: 0, idle: 0, offline: 0, teams: 0, agents: 0, waiting: 0 },
};

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p.startsWith('/__fleet/push/')) {
      try {
        const r = await handlePush(req, p);
        if (r) return r;
      } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    }

    if (p === '/__fleet/state') {
      try {
        return Response.json(await getFleetState(), { headers: { 'cache-control': 'no-store' } });
      } catch (e) {
        return Response.json({ ...EMPTY, ts: new Date().toISOString(), error: (e as Error).message });
      }
    }

    if (p === '/__fleet/env') {
      return Response.json(getEnvStatus(), { headers: { 'cache-control': 'no-store' } });
    }

    if (p === '/__fleet/usage') {
      return Response.json(getUsageSnapshot(), { headers: { 'cache-control': 'no-store' } });
    }

    if (p === '/__fleet/pane') {
      try {
        const lines = Number(url.searchParams.get('lines')) || undefined;
        return Response.json({ text: capturePane(url.searchParams.get('id') || '', lines) });
      } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    }
    if (p === '/__fleet/transcript') {
      try { return Response.json({ text: transcriptFor(url.searchParams.get('id') || '') }); }
      catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    }
    if (p === '/__fleet/send' && req.method === 'POST') {
      try {
        const b = (await req.json()) as { id?: string; text?: string; key?: string };
        if (b.key) sendKey(b.id || '', b.key);
        else sendToPane(b.id || '', b.text || '');
        return Response.json({ ok: true });
      } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    }
    if (p === '/__fleet/roles') {
      try { return Response.json({ roles: listRoles() }); }
      catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    }
    if (p === '/__fleet/new' && req.method === 'POST') {
      try {
        const b = (await req.json()) as { role?: string; slug?: string };
        const out = spawnAgent(b.role || '', b.slug || '');
        return Response.json({ ok: true, output: out });
      } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    }
    if (p === '/__fleet/close' && req.method === 'POST') {
      try {
        const b = (await req.json()) as { id?: string };
        closePane(b.id || '');
        return Response.json({ ok: true });
      } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    }

    if (p.startsWith('/api/')) {
      if (API_ALLOW.has(p)) {
        return fetch(ORACLE + p + url.search, { method: req.method, headers: req.headers });
      }
      return Response.json({ error: 'not exposed on the town server' }, { status: 404 });
    }

    // Static dist with SPA fallback so client-side routing (/town) resolves.
    const safe = normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
    const file = join(DIST, safe);
    if (file.startsWith(DIST) && p !== '/' && existsSync(file) && statSync(file).isFile()) {
      return new Response(Bun.file(file));
    }
    // SPA entry — serve the origin-seeded index.html (see SEED above).
    return new Response(INDEX_HTML, { headers: { 'content-type': 'text/html;charset=utf-8' } });
  },
});

console.log(`fleet-server listening on http://${server.hostname}:${server.port} (dist=${DIST})`);

// Watch the fleet and push notifications (team-idle / agent-waiting) to PWA subscribers.
startNotifyLoop(() => getFleetState());
// Poll staging-env health (server/env-targets.json) for the /town Staging district.
startEnvProbe();
// Per-account auth + token usage (server/auth-plans.json) for the /usage view.
startUsage();
