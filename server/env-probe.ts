// Staging-env health probe for Fleet Town. Reads server/env-targets.json (edit it
// to add/remove targets — no code change) and GETs each on a loop, exposing a
// cached status snapshot at /__fleet/env. Read-only: it only does health GETs,
// never mutates a target. Health rule (per owner): any HTTP reply = up; 5xx =
// degraded; no reply / timeout = down.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

interface Target { name: string; kind: string; url: string; label?: string }
export interface EnvStatus {
  name: string; kind: string; label: string; url: string;
  status: 'up' | 'degraded' | 'down'; code: number; ms: number; checkedAt: string;
}

const FILE = join(import.meta.dir, 'env-targets.json');
function targets(): Target[] {
  try { return JSON.parse(readFileSync(FILE, 'utf8')) as Target[]; }
  catch (e) { console.error('[env] bad env-targets.json', (e as Error).message); return []; }
}

let snapshot: EnvStatus[] = [];
export const getEnvStatus = (): EnvStatus[] => snapshot;

async function probe(t: Target): Promise<EnvStatus> {
  const started = Date.now();
  let status: EnvStatus['status'] = 'down';
  let code = 0;
  try {
    const res = await fetch(t.url, { method: 'GET', signal: AbortSignal.timeout(6000) });
    code = res.status;
    status = code >= 500 ? 'degraded' : 'up'; // responded → up; server error → degraded
  } catch { status = 'down'; code = 0; }      // timeout / network error → down
  return {
    name: t.name, kind: t.kind, label: t.label || t.name, url: t.url,
    status, code, ms: Date.now() - started, checkedAt: new Date().toISOString(),
  };
}

async function refresh() {
  try { snapshot = await Promise.all(targets().map(probe)); }
  catch (e) { console.error('[env] refresh failed', (e as Error).message); }
}

export function startEnvProbe(ms = 20000) {
  void refresh();
  setInterval(() => void refresh(), ms);
}
