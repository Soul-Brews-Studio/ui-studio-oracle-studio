// FleetState contract (shared with server/fleet-probe.ts) + a React polling hook.
//
// The contract is render-agnostic on purpose: today a lightweight DOM town consumes
// it; a future faithful PixiJS port would consume the exact same shape unchanged.
import { useEffect, useRef, useState } from 'react';

export type AgentStatus = 'working' | 'idle' | 'offline';

export interface FleetAgent {
  id: string;          // "01-soul-brews:6.0" (session:window.pane — stable key)
  session: string;     // tmux session → district / zone
  windowName: string;  // "orchestrator-botlog"
  role: string;        // costume key (see role-costume.ts)
  label: string;       // task / campaign slug — distinguishes duplicate roles
  task: string;        // pane title minus the leading status glyph
  status: AgentStatus;
  glyph: string;       // raw leading glyph of the title (debug + animation phase)
  team: string | null; // campaign plot it belongs to, or null for the commons
  isOrchestrator: boolean;
}

export interface FleetTeam {
  name: string;        // campaign / team name (== window slug)
  session: string;     // district it sits in
  members: string[];   // agent ids
  known: boolean;      // backed by ~/.claude/teams/<name>/config.json
  description?: string;
}

export interface FleetRoad {
  from: string;        // orchestrator agent id
  to: string;          // dispatched worker agent id
}

export interface FleetCounts {
  working: number;
  idle: number;
  offline: number;
  teams: number;
  agents: number;
}

export interface FleetState {
  ts: string;          // ISO probe timestamp
  host: string;
  agents: FleetAgent[];
  teams: FleetTeam[];
  roads: FleetRoad[];
  counts: FleetCounts;
  error?: string;
}

export const EMPTY_FLEET: FleetState = {
  ts: '', host: '', agents: [], teams: [], roads: [],
  counts: { working: 0, idle: 0, offline: 0, teams: 0, agents: 0 },
};

// Dedicated path (NOT under /api) so Vite's /api→:47778 proxy never intercepts it,
// and so it stays same-origin (fleet data is local to the host running tmux).
export const FLEET_ENDPOINT = '/__fleet/state';

export async function fetchFleet(signal?: AbortSignal): Promise<FleetState> {
  const res = await fetch(FLEET_ENDPOINT, { signal });
  if (!res.ok) throw new Error(`fleet ${res.status}`);
  return (await res.json()) as FleetState;
}

export interface UseFleet {
  state: FleetState;
  loading: boolean;
  error: string | null;
  lastOk: number | null;
}

/** Poll the fleet endpoint every `intervalMs` (default 2s). */
export function useFleet(intervalMs = 2000): UseFleet {
  const [state, setState] = useState<FleetState>(EMPTY_FLEET);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    async function tick() {
      try {
        const s = await fetchFleet(ac.signal);
        if (!alive) return;
        setState(s);
        setError(s.error ?? null);
        setLastOk(Date.now());
      } catch (e) {
        if (alive && (e as Error).name !== 'AbortError') setError((e as Error).message);
      } finally {
        if (alive) {
          setLoading(false);
          timer.current = setTimeout(tick, intervalMs);
        }
      }
    }
    tick();
    return () => {
      alive = false;
      ac.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [intervalMs]);

  return { state, loading, error, lastOk };
}
