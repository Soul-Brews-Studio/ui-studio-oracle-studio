import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../api/oracle';
import { clearStoredHost, hostLabel, setStoredHost } from '../api/host';

type GateState = 'probing' | 'ok' | 'unreachable';

const PROBE_TIMEOUT_MS = 3000;

async function probeBackend(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function BackendGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('probing');

  const probe = useCallback(async () => {
    setState('probing');
    const ok = await probeBackend();
    setState(ok ? 'ok' : 'unreachable');
  }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  if (state === 'ok') return <>{children}</>;

  if (state === 'probing') {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-secondary text-sm gap-2">
        <span className="inline-block w-3 h-3 rounded-full bg-accent animate-pulse" />
        checking backend…
      </div>
    );
  }

  return <UnreachableLanding onRetry={probe} />;
}

function UnreachableLanding({ onRetry }: { onRetry: () => void }) {
  const handleChangeHost = () => {
    const current = hostLabel();
    const next = window.prompt(
      'Enter a new host (e.g. localhost:47778, http://mba.wg:47778). Leave empty to reset to default.',
      current.replace(' (default)', ''),
    );
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed === '') {
      clearStoredHost();
    } else {
      setStoredHost(trimmed);
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-bg-card border border-border rounded-2xl p-10 max-w-[720px] w-full">
        <h1 className="text-3xl font-semibold text-text-primary mb-3">
          ARRA 🔮Racle needs a local MCP
        </h1>
        <p className="text-text-secondary mb-2">
          This studio is a thin client. Run the backend locally first:
        </p>
        <p className="text-text-secondary text-xs mb-6">
          Current host: <code className="text-accent">{hostLabel()}</code>
        </p>

        <div className="space-y-4 mb-8">
          <InstallCard
            label="1. Backend (MCP server)"
            command="bunx @soul-brews-studio/arra-oracle"
          />
          <InstallCard
            label="2. CLI"
            command="bunx @soul-brews-studio/arra-oracle-cli"
          />
          <InstallCard
            label="3. Studio (this UI, served locally)"
            command="bunx @soul-brews-studio/oracle-studio"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90"
          >
            Retry
          </button>
          <button
            onClick={handleChangeHost}
            className="px-4 py-2 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-bg-hover"
          >
            Change host
          </button>
        </div>
      </div>
    </div>
  );
}

function InstallCard({ label, command }: { label: string; command: string }) {
  return (
    <div className="border border-border rounded-xl p-4 bg-bg-elevated">
      <div className="text-text-secondary text-xs mb-2">{label}</div>
      <pre className="text-sm text-text-primary font-mono overflow-x-auto">{command}</pre>
    </div>
  );
}
