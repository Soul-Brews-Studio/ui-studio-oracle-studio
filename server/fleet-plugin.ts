// Vite dev plugin: serves the Fleet Town state at /__fleet/state.
//
// Registered inside configureServer's body (not the returned post-hook) so it is
// installed before Vite's internal /api proxy. The path lives outside /api anyway,
// so it is never proxied to the Oracle backend — fleet data is local to this host.
//
// NOTE: kept free of any `src/` imports so loading vite.config doesn't pull React
// into the config bundle. FLEET_PATH must stay in sync with FLEET_ENDPOINT in
// src/lib/fleet.ts.
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getFleetState } from './fleet-probe';
import { capturePane, sendToPane, sendKey, closePane } from './pane-io';
import { transcriptFor } from './transcript';

const json = (res: ServerResponse, body: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
};
const readBody = (req: IncomingMessage) => new Promise<string>((resolve) => {
  let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d));
});

export function fleetTownPlugin(): Plugin {
  return {
    name: 'fleet-town-endpoint',
    configureServer(server) {
      server.middlewares.use('/__fleet/state', async (_req, res) => {
        try { json(res, await getFleetState()); }
        catch (e) {
          json(res, {
            ts: new Date().toISOString(), host: '', agents: [], teams: [], roads: [],
            counts: { working: 0, idle: 0, offline: 0, teams: 0, agents: 0 },
            error: (e as Error).message,
          });
        }
      });
      server.middlewares.use('/__fleet/pane', (req, res) => {
        try {
          const q = new URL(req.url || '', 'http://x').searchParams;
          json(res, { text: capturePane(q.get('id') || '', Number(q.get('lines')) || undefined) });
        } catch (e) { json(res, { error: (e as Error).message }, 400); }
      });
      server.middlewares.use('/__fleet/transcript', (req, res) => {
        try {
          const id = new URL(req.url || '', 'http://x').searchParams.get('id') || '';
          json(res, { text: transcriptFor(id) });
        } catch (e) { json(res, { error: (e as Error).message }, 400); }
      });
      server.middlewares.use('/__fleet/send', async (req, res) => {
        try {
          const b = JSON.parse((await readBody(req)) || '{}');
          if (b.key) sendKey(b.id || '', b.key);
          else sendToPane(b.id || '', b.text || '');
          json(res, { ok: true });
        } catch (e) { json(res, { error: (e as Error).message }, 400); }
      });
      server.middlewares.use('/__fleet/close', async (req, res) => {
        try { const b = JSON.parse((await readBody(req)) || '{}'); closePane(b.id || ''); json(res, { ok: true }); }
        catch (e) { json(res, { error: (e as Error).message }, 400); }
      });
    },
  };
}
