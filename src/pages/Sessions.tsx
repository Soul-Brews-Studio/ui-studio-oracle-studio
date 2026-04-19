import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../api/oracle';
import { Spinner } from '../components/ui/Spinner';

interface SessionSummary {
  id: string;
  oracle: string;
  last_seen: string | number;
  thread_count: number;
  learning_count: number;
  trace_count: number;
}

interface SessionContext {
  id: string;
  oracle?: string;
  threads?: Array<{ id?: string | number; title?: string; message?: string; timestamp?: string | number }>;
  learnings?: Array<{ id?: string | number; title?: string; content?: string; timestamp?: string | number }>;
  traces?: Array<{ id?: string | number; traceId?: string; query?: string; timestamp?: string | number }>;
}

function shortId(id: string): string {
  return (id || '').slice(0, 8);
}

function formatTime(ts: string | number | undefined): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const diffS = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return `${Math.floor(diffS / 86400)}d ago`;
}

export function Sessions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (id) {
      fetch(`${API_BASE}/session/${encodeURIComponent(id)}/context`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (cancelled) return;
          setContext(data || { id });
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setContext({ id });
          setLoading(false);
        });
    } else {
      fetch(`${API_BASE}/sessions`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (cancelled) return;
          const list: SessionSummary[] = Array.isArray(data) ? data : (data?.sessions ?? []);
          setSessions(list);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setSessions([]);
          setLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#0a0a0f] flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (id) {
    const threads = context?.threads ?? [];
    const learnings = context?.learnings ?? [];
    const traces = context?.traces ?? [];
    const empty = threads.length === 0 && learnings.length === 0 && traces.length === 0;

    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#0a0a0f]">
        <div className="max-w-[960px] mx-auto px-6 py-6">
          <button
            onClick={() => navigate('/sessions')}
            className="text-xs font-mono text-white/40 hover:text-white/70 mb-4 bg-transparent border-none cursor-pointer p-0"
          >
            ← All sessions
          </button>
          <div className="flex items-baseline gap-3 mb-6">
            <h1 className="text-2xl font-bold text-white">Session</h1>
            <span className="text-sm font-mono text-white/50">{shortId(id)}</span>
            {context?.oracle && (
              <span className="text-sm font-mono text-accent">{context.oracle}</span>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-400 font-mono mb-4">{error}</div>
          )}

          {empty ? (
            <div className="text-center text-white/30 py-12 font-mono text-sm">
              No context yet for this session.
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {threads.length > 0 && (
                <section>
                  <h2 className="text-sm font-mono uppercase tracking-wider text-white/50 mb-3">
                    Threads · {threads.length}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {threads.map((t, i) => (
                      <div key={t.id ?? i} className="bg-bg-card border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-sm text-white/90 truncate">{t.title || 'Untitled'}</span>
                          <span className="text-xs font-mono text-white/35 shrink-0">{formatTime(t.timestamp)}</span>
                        </div>
                        {t.message && (
                          <div className="text-xs font-mono text-white/50 line-clamp-2">{t.message}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {learnings.length > 0 && (
                <section>
                  <h2 className="text-sm font-mono uppercase tracking-wider text-white/50 mb-3">
                    Learnings · {learnings.length}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {learnings.map((l, i) => (
                      <div key={l.id ?? i} className="bg-bg-card border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-sm text-white/90 truncate">{l.title || 'Learning'}</span>
                          <span className="text-xs font-mono text-white/35 shrink-0">{formatTime(l.timestamp)}</span>
                        </div>
                        {l.content && (
                          <div className="text-xs font-mono text-white/50 line-clamp-3">{l.content}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {traces.length > 0 && (
                <section>
                  <h2 className="text-sm font-mono uppercase tracking-wider text-white/50 mb-3">
                    Traces · {traces.length}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {traces.map((tr, i) => {
                      const tid = tr.traceId || (tr.id != null ? String(tr.id) : '');
                      return (
                        <Link
                          key={tid || i}
                          to={tid ? `/traces/${tid}` : '#'}
                          className="bg-bg-card border border-border rounded-lg p-3 hover:border-accent/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-white/90 truncate">{tr.query || shortId(tid)}</span>
                            <span className="text-xs font-mono text-white/35 shrink-0">{formatTime(tr.timestamp)}</span>
                          </div>
                          {tid && (
                            <div className="text-[10px] font-mono text-white/30 mt-1">{shortId(tid)}</div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0a0a0f]">
      <div className="max-w-[1080px] mx-auto px-6 py-6">
        <div className="flex items-baseline gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <span className="text-sm font-mono text-white/50">{sessions.length} recent</span>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center text-white/30 py-12 font-mono text-sm">
            No sessions yet.
          </div>
        ) : (
          <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-mono uppercase tracking-wider text-white/40 border-b border-border">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Oracle</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                  <th className="px-4 py-3 font-medium text-right">Threads</th>
                  <th className="px-4 py-3 font-medium text-right">Learnings</th>
                  <th className="px-4 py-3 font-medium text-right">Traces</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/sessions/${encodeURIComponent(s.id)}`)}
                    className="border-b border-border/50 last:border-b-0 hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-white/80">{shortId(s.id)}</td>
                    <td className="px-4 py-3 font-mono text-accent">{s.oracle || '—'}</td>
                    <td className="px-4 py-3 font-mono text-white/50">{formatTime(s.last_seen)}</td>
                    <td className="px-4 py-3 font-mono text-white/70 text-right tabular-nums">{s.thread_count ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-white/70 text-right tabular-nums">{s.learning_count ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-white/70 text-right tabular-nums">{s.trace_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
