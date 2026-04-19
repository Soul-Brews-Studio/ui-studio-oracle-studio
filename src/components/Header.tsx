import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../api/oracle';
import { hostLabel, isDefault, setStoredHost, clearStoredHost } from '../api/host';

const navItems = [
  { path: '/', label: 'Overview' },
  { path: '/feed', label: 'Feed' },
  { path: '/map', label: 'Memory' },
  { path: '/search', label: 'Search' },
  { path: '/forum', label: 'Forum' },
  { path: '/pulse', label: 'Pulse' },
  { path: '/plugins', label: 'Plugins' },
  { path: '/activity?tab=searches', label: 'Activity' },
] as const;

const toolsItems = [
  { path: '/playground', label: 'Playground' },
  { path: '/compare', label: 'Compare' },
  { path: '/evolution', label: 'Evolution' },
  { path: '/traces', label: 'Traces' },
  { path: '/schedule', label: 'Schedule' },
] as const;

export function Header() {
  const location = useLocation();
  const { isAuthenticated, authEnabled, logout } = useAuth();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [stats, setStats] = useState({ searches: 0, learnings: 0 });
  const [sessionStart] = useState(() => {
    const stored = localStorage.getItem('oracle_session_start');
    if (stored) return parseInt(stored);
    const now = Date.now();
    localStorage.setItem('oracle_session_start', String(now));
    return now;
  });

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  async function loadStats() {
    try {
      const res = await fetch(`${API_BASE}/session/stats?since=${sessionStart}`);
      if (res.ok) {
        const data = await res.json();
        setStats({ searches: data.searches, learnings: data.learnings });
      }
    } catch {}
  }

  const mins = Math.floor((Date.now() - sessionStart) / 60000);
  const duration = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;

  const isActive = (path: string) => location.pathname === path.split('?')[0];

  return (
    <header className="bg-bg-secondary border-b border-border sticky top-0 z-50">
      {/* Top row: logo + stats */}
      <div className="flex justify-between items-center px-4 py-2">
        <Link to="/" className="text-lg font-bold text-accent shrink-0">
          ARRA 🔮racle
          <span className="text-[10px] font-medium text-text-muted bg-bg-card px-1.5 py-0.5 rounded ml-2 align-middle">
            {__APP_VERSION__}
          </span>
        </Link>

        {/* Session stats - moved here */}
        <div className="flex items-center gap-3 text-xs text-text-muted font-mono shrink-0">
          <button
            onClick={() => {
              const next = window.prompt(
                'Oracle host (leave empty to use default localhost:47778):\n\nExamples:\n  localhost:47778\n  http://mba.wg:47778\n  https://oracle.example.com',
                isDefault ? '' : hostLabel().replace(' (default)', '')
              );
              if (next === null) return;
              if (next.trim() === '') clearStoredHost();
              else setStoredHost(next.trim());
              window.location.reload();
            }}
            title={`Click to change host. Currently: ${hostLabel()}`}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-all duration-150 ${
              isDefault
                ? 'border-border text-text-muted hover:bg-bg-card'
                : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isDefault ? 'bg-text-muted' : 'bg-accent animate-pulse'}`} />
            <span>{hostLabel()}</span>
          </button>
          <span>{duration}</span>
          <span>{stats.searches}s</span>
          <span>{stats.learnings}l</span>
          <span className="w-px h-3 bg-border mx-1" />
          <Link to="/settings" className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-bg-card transition-all duration-150" title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          {authEnabled && isAuthenticated && (
            <button onClick={logout} className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-red-500/10 bg-transparent border-none cursor-pointer transition-all duration-150" title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Nav row: full width, scrollable */}
      <nav className="flex items-center gap-0.5 px-4 pb-2 flex-wrap">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-2.5 py-1.5 rounded-lg text-[13px] whitespace-nowrap transition-all duration-150 ${
              isActive(item.path)
                ? 'bg-accent/15 text-accent font-semibold border border-accent/20'
                : 'text-text-secondary hover:bg-bg-card hover:text-accent border border-transparent'
            }`}
          >
            {item.label}
          </Link>
        ))}

        <span className="w-px h-4 bg-border mx-2" />

        {/* Tools dropdown */}
        <div
          className="relative"
          onMouseEnter={() => setToolsOpen(true)}
          onMouseLeave={() => setToolsOpen(false)}
        >
          <button
            type="button"
            className={`px-2.5 py-1.5 rounded-lg text-[13px] whitespace-nowrap transition-all duration-150 bg-transparent border-none cursor-pointer font-[inherit] ${
              toolsItems.some(t => isActive(t.path))
                ? 'bg-bg-card text-accent'
                : 'text-text-secondary hover:bg-bg-card hover:text-accent'
            }`}
          >
            Tools ▾
          </button>
          {toolsOpen && (
            <>
              {/* Bridge gap */}
              <div className="absolute top-full left-0 right-0 h-2" />
              <div className="absolute top-[calc(100%+4px)] right-0 bg-bg-card border border-border rounded-xl p-1 min-w-[140px] shadow-lg z-[200]">
                {toolsItems.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block px-3 py-2 rounded-lg text-[13px] whitespace-nowrap transition-all duration-150 ${
                      isActive(item.path)
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-secondary hover:bg-white/5 hover:text-accent'
                    }`}
                    onClick={() => setToolsOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>

    </header>
  );
}
