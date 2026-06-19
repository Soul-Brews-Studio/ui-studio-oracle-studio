// Poll the staging-env health snapshot (/__fleet/env) for the town's Staging band.
import { useEffect, useState } from 'react';

export interface EnvStatus {
  name: string; kind: string; label: string; url: string;
  status: 'up' | 'degraded' | 'down'; code: number; ms: number; checkedAt: string;
}

export function useEnv(intervalMs = 10000): EnvStatus[] {
  const [env, setEnv] = useState<EnvStatus[]>([]);
  useEffect(() => {
    let alive = true;
    const tick = () => fetch('/__fleet/env').then((r) => r.json()).then((d) => { if (alive) setEnv(d); }).catch(() => {});
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);
  return env;
}
