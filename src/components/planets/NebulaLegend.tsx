import { useEffect, useState } from 'react';

const STORAGE_KEY = 'planets.legend.dismissed';
const OVERLAY_BG = 'rgba(10, 10, 20, 0.75)';

export function NebulaLegend() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      className="absolute bottom-4 right-4 max-w-[260px] rounded-[10px] px-3.5 py-3 text-[11px] text-text-secondary backdrop-blur-xl border border-white/[0.08] z-10 leading-relaxed"
      style={{ background: OVERLAY_BG }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <span className="text-xs font-semibold text-text-primary">
          Nebula Legend
        </span>
        <button
          onClick={dismiss}
          className="text-text-muted hover:text-accent cursor-pointer text-xs leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <p>
        Colored clouds connect projects that share concepts. Brighter = stronger
        overlap. Click a planet to open its document.
      </p>
    </div>
  );
}
