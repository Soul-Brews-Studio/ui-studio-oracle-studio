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
import { getFleetState } from './fleet-probe';

const FLEET_PATH = '/__fleet/state';

export function fleetTownPlugin(): Plugin {
  return {
    name: 'fleet-town-endpoint',
    configureServer(server) {
      server.middlewares.use(FLEET_PATH, async (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.setHeader('cache-control', 'no-store');
        try {
          res.end(JSON.stringify(await getFleetState()));
        } catch (e) {
          // 200 + error field — the page degrades gracefully instead of throwing.
          res.end(JSON.stringify({
            ts: new Date().toISOString(), host: '', agents: [], teams: [], roads: [],
            counts: { working: 0, idle: 0, offline: 0, teams: 0, agents: 0 },
            error: (e as Error).message,
          }));
        }
      });
    },
  };
}
