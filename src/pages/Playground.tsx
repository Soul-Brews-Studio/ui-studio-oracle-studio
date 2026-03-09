import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { search } from '../api/oracle';
import type { Document } from '../api/oracle';

interface ColumnResult {
  results: Document[];
  total: number;
  time: number;
  avgScore: number;
}

// Animated count-up hook
function useCountUp(target: number, duration = 400): number {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = ref.current;
    const diff = target - start;
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setValue(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

export function Playground() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [ftsCol, setFtsCol] = useState<ColumnResult | null>(null);
  const [vectorCol, setVectorCol] = useState<ColumnResult | null>(null);
  const [hybridCol, setHybridCol] = useState<ColumnResult | null>(null);
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);
  const [resultsVisible, setResultsVisible] = useState(false);

  async function doSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setResultsVisible(false);

    const modes = ['fts', 'vector', 'hybrid'] as const;
    const results = await Promise.all(
      modes.map(async (mode) => {
        const start = performance.now();
        try {
          const data = await search(q, 'all', 20, mode);
          const time = Math.round(performance.now() - start);
          const scores = data.results.map(r => r.score || 0);
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          return { results: data.results, total: data.total, time, avgScore };
        } catch {
          return { results: [], total: 0, time: Math.round(performance.now() - start), avgScore: 0 };
        }
      })
    );

    setFtsCol(results[0]);
    setVectorCol(results[1]);
    setHybridCol(results[2]);
    setLoading(false);
    // Trigger stagger animation after a tick
    requestAnimationFrame(() => setResultsVisible(true));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query);
  }

  // Shared/unique ID computation
  const ftsIds = new Set(ftsCol?.results.map(r => r.id) || []);
  const vectorIds = new Set(vectorCol?.results.map(r => r.id) || []);
  const hybridIds = new Set(hybridCol?.results.map(r => r.id) || []);

  const allIds = new Set([...ftsIds, ...vectorIds, ...hybridIds]);
  const sharedIds = new Set([...allIds].filter(id => ftsIds.has(id) && vectorIds.has(id)));
  const ftsOnly = new Set([...ftsIds].filter(id => !vectorIds.has(id)));
  const vectorOnly = new Set([...vectorIds].filter(id => !ftsIds.has(id)));

  // Max time for timing bars
  const maxTime = Math.max(ftsCol?.time || 0, vectorCol?.time || 0, hybridCol?.time || 0, 1);

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Pre-search landing */}
      {!searched && !loading && (
        <div className="max-w-[800px] mx-auto py-20 px-6 text-center">
          <h1 className="text-5xl max-md:text-[32px] font-extrabold mb-2 bg-gradient-to-br from-[#60a5fa] via-[#a78bfa] to-[#4ade80] bg-clip-text text-transparent animate-[gradientShift_4s_ease-in-out_infinite] bg-[length:200%_200%]">Vector Playground</h1>
          <p className="text-base text-text-muted mb-10">Compare search modes side-by-side</p>

          <form onSubmit={handleSubmit} className="flex gap-3 max-w-[640px] mx-auto mb-6">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type a query to compare FTS, Vector, and Hybrid..."
              className="flex-1 py-3.5 px-[18px] rounded-[10px] text-[15px] text-text-primary border border-border outline-none focus:border-accent transition-colors duration-200 placeholder:text-text-muted backdrop-blur-lg [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
              style={{ WebkitAppearance: 'none', background: 'rgba(20, 20, 35, 0.6)' }}
              autoFocus
            />
            <button
              type="submit"
              className="bg-accent border-none text-white py-3.5 px-7 rounded-[10px] text-[15px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap hover:bg-accent-hover hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Compare
            </button>
          </form>

          <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mt-10">
            <div
              className="rounded-[14px] py-7 px-6 text-left backdrop-blur-lg cursor-default transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(96,165,250,0.4)] hover:shadow-[0_0_24px_rgba(96,165,250,0.08)]"
              style={{ background: 'rgba(20, 20, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
            >
              <div className="text-xl font-extrabold mb-2.5" style={{ color: '#60a5fa' }}>FTS5</div>
              <p className="text-[13px] text-text-secondary leading-relaxed">Full-text search using SQLite's FTS5 engine. Fast keyword matching with ranking.</p>
            </div>
            <div
              className="rounded-[14px] py-7 px-6 text-left backdrop-blur-lg cursor-default transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(167,139,250,0.4)] hover:shadow-[0_0_24px_rgba(167,139,250,0.08)]"
              style={{ background: 'rgba(20, 20, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
            >
              <div className="text-xl font-extrabold mb-2.5" style={{ color: '#a78bfa' }}>Vector</div>
              <p className="text-[13px] text-text-secondary leading-relaxed">Semantic search using ChromaDB embeddings. Finds conceptually similar results.</p>
            </div>
            <div
              className="rounded-[14px] py-7 px-6 text-left backdrop-blur-lg cursor-default transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(74,222,128,0.4)] hover:shadow-[0_0_24px_rgba(74,222,128,0.08)]"
              style={{ background: 'rgba(20, 20, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
            >
              <div className="text-xl font-extrabold mb-2.5" style={{ color: '#4ade80' }}>Hybrid</div>
              <p className="text-[13px] text-text-secondary leading-relaxed">Best of both. Combines results and boosts docs found by both engines.</p>
            </div>
          </div>
        </div>
      )}

      {/* Post-search view */}
      {(searched || loading) && (
        <div className="max-w-[1200px] mx-auto py-8 px-6">
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-[640px] mx-auto mb-6">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search query..."
              className="flex-1 py-3.5 px-[18px] rounded-[10px] text-[15px] text-text-primary border border-border outline-none focus:border-accent transition-colors duration-200 placeholder:text-text-muted backdrop-blur-lg [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
              style={{ WebkitAppearance: 'none', background: 'rgba(20, 20, 35, 0.6)' }}
              autoFocus
            />
            <button
              type="submit"
              className="bg-accent border-none text-white py-3.5 px-7 rounded-[10px] text-[15px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap hover:bg-accent-hover hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Compare'}
            </button>
          </form>

          {loading && (
            <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mt-6">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-16 rounded-[10px] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%' }} />
                  {[0, 1, 2, 3, 4].map(j => (
                    <div key={j} className="h-20 rounded-[10px] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)', backgroundSize: '200% 100%', animationDelay: `${j * 80}ms` }} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {!loading && ftsCol && (
            <>
              <SummaryBar
                fts={ftsCol}
                vector={vectorCol}
                hybrid={hybridCol}
                sharedCount={sharedIds.size}
                maxTime={maxTime}
              />

              <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
                <Column
                  title="FTS5"
                  color="#60a5fa"
                  data={ftsCol}
                  uniqueIds={ftsOnly}
                  sharedIds={sharedIds}
                  hoveredDocId={hoveredDocId}
                  onHover={setHoveredDocId}
                  visible={resultsVisible}
                />
                <Column
                  title="Vector"
                  color="#a78bfa"
                  data={vectorCol}
                  uniqueIds={vectorOnly}
                  sharedIds={sharedIds}
                  hoveredDocId={hoveredDocId}
                  onHover={setHoveredDocId}
                  visible={resultsVisible}
                />
                <Column
                  title="Hybrid"
                  color="#4ade80"
                  data={hybridCol}
                  uniqueIds={new Set()}
                  sharedIds={sharedIds}
                  hoveredDocId={hoveredDocId}
                  onHover={setHoveredDocId}
                  visible={resultsVisible}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Summary bar with animated count-up and timing bars
function SummaryBar({
  fts, vector, hybrid, sharedCount, maxTime
}: {
  fts: ColumnResult | null;
  vector: ColumnResult | null;
  hybrid: ColumnResult | null;
  sharedCount: number;
  maxTime: number;
}) {
  const ftsCount = useCountUp(fts?.total || 0);
  const vecCount = useCountUp(vector?.total || 0);
  const hybCount = useCountUp(hybrid?.total || 0);
  const sharedAnim = useCountUp(sharedCount);

  return (
    <div
      className="flex max-md:flex-col items-center gap-6 py-4 px-6 rounded-xl mb-5 backdrop-blur-lg"
      style={{ background: 'rgba(20, 20, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <div className="flex-1 flex max-md:w-full gap-6">
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[28px] font-extrabold leading-none tabular-nums" style={{ color: '#60a5fa' }}>{ftsCount}</span>
          <span className="text-[11px] text-text-muted uppercase tracking-wide mb-1">FTS</span>
          <div className="h-[3px] rounded-sm overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <div
              className="h-full rounded-sm transition-[width] duration-500 ease-out"
              style={{
                width: `${((fts?.time || 0) / maxTime) * 100}%`,
                background: '#60a5fa',
              }}
            />
          </div>
          <span className="text-[10px] text-text-muted tabular-nums">{fts?.time || 0}ms</span>
        </div>

        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[28px] font-extrabold leading-none tabular-nums" style={{ color: '#a78bfa' }}>{vecCount}</span>
          <span className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Vector</span>
          <div className="h-[3px] rounded-sm overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <div
              className="h-full rounded-sm transition-[width] duration-500 ease-out"
              style={{
                width: `${((vector?.time || 0) / maxTime) * 100}%`,
                background: '#a78bfa',
              }}
            />
          </div>
          <span className="text-[10px] text-text-muted tabular-nums">{vector?.time || 0}ms</span>
        </div>

        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[28px] font-extrabold leading-none tabular-nums" style={{ color: '#4ade80' }}>{hybCount}</span>
          <span className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Hybrid</span>
          <div className="h-[3px] rounded-sm overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <div
              className="h-full rounded-sm transition-[width] duration-500 ease-out"
              style={{
                width: `${((hybrid?.time || 0) / maxTime) * 100}%`,
                background: '#4ade80',
              }}
            />
          </div>
          <span className="text-[10px] text-text-muted tabular-nums">{hybrid?.time || 0}ms</span>
        </div>
      </div>

      {/* Venn overlap indicator */}
      <div className="flex flex-col items-center gap-1 min-w-[90px]">
        <div className="flex items-center">
          <div
            className="rounded-full shrink-0 transition-all duration-300"
            style={{
              background: 'rgba(96, 165, 250, 0.15)',
              border: '1.5px solid rgba(96, 165, 250, 0.4)',
              width: `${Math.max(28, Math.min(56, (fts?.results.length || 0) * 3))}px`,
              height: `${Math.max(28, Math.min(56, (fts?.results.length || 0) * 3))}px`,
            }}
          />
          <div
            className="rounded-full shrink-0 -ml-3 transition-all duration-300"
            style={{
              background: 'rgba(167, 139, 250, 0.15)',
              border: '1.5px solid rgba(167, 139, 250, 0.4)',
              width: `${Math.max(28, Math.min(56, (vector?.results.length || 0) * 3))}px`,
              height: `${Math.max(28, Math.min(56, (vector?.results.length || 0) * 3))}px`,
            }}
          />
        </div>
        <span className="text-[11px] text-text-muted tabular-nums">{sharedAnim} shared</span>
      </div>
    </div>
  );
}

// Column component with stagger animation and cross-highlight
function Column({
  title, color, data, uniqueIds, sharedIds, hoveredDocId, onHover, visible
}: {
  title: string;
  color: string;
  data: ColumnResult | null;
  uniqueIds: Set<string>;
  sharedIds: Set<string>;
  hoveredDocId: string | null;
  onHover: (id: string | null) => void;
  visible: boolean;
}) {
  if (!data) return null;

  return (
    <div className="flex flex-col min-w-0">
      <div
        className="relative overflow-hidden py-3.5 px-4 rounded-xl mb-2.5 backdrop-blur-lg"
        style={{ background: 'rgba(20, 20, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 animate-[glowPulse_3s_ease-in-out_infinite]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <span className="text-base font-bold block mb-2" style={{ color }}>{title}</span>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-base font-bold text-text-primary tabular-nums">{data.results.length}</span>
          <span className="text-[11px] text-text-muted">results</span>
          <span className="w-px h-3 mx-0.5 self-center" style={{ background: 'rgba(255, 255, 255, 0.08)' }} />
          <span className="text-base font-bold text-text-primary tabular-nums">{data.time}ms</span>
          <span className="text-[11px] text-text-muted">time</span>
          <span className="w-px h-3 mx-0.5 self-center" style={{ background: 'rgba(255, 255, 255, 0.08)' }} />
          <span className="text-base font-bold text-text-primary tabular-nums">{Math.round(data.avgScore * 100)}%</span>
          <span className="text-[11px] text-text-muted">avg</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[600px] overflow-y-auto">
        {data.results.map((doc, index) => {
          const scorePercent = Math.round((doc.score || 0) * 100);
          const isShared = sharedIds.has(doc.id);
          const isUnique = uniqueIds.has(doc.id);
          const isCrossHighlighted = hoveredDocId === doc.id;

          return (
            <Link
              key={doc.id}
              to={`/doc/${encodeURIComponent(doc.id)}`}
              state={{ doc }}
              className={`block rounded-[10px] p-3 cursor-pointer backdrop-blur-md no-underline transition-all duration-300 ease-out ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              } hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]`}
              style={{
                background: 'rgba(20, 20, 35, 0.5)',
                border: `1px solid ${
                  isCrossHighlighted ? 'rgba(74, 222, 128, 0.5)' :
                  isShared ? 'rgba(74, 222, 128, 0.2)' :
                  isUnique ? 'rgba(251, 191, 36, 0.15)' :
                  'rgba(255, 255, 255, 0.05)'
                }`,
                transitionDelay: visible ? `${index * 30}ms` : '0ms',
                boxShadow: isCrossHighlighted ? '0 0 16px rgba(74, 222, 128, 0.12)' : undefined,
              }}
              onMouseEnter={() => isShared ? onHover(doc.id) : undefined}
              onMouseLeave={() => onHover(null)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 flex items-center gap-1.5">
                  <div className="flex-1 h-[3px] rounded-sm overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
                    <div
                      className="h-full rounded-sm transition-[width] duration-500 ease-out"
                      style={{
                        width: visible ? `${scorePercent}%` : '0%',
                        background: color,
                        transitionDelay: visible ? `${index * 30 + 200}ms` : '0ms',
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-text-muted font-semibold min-w-[30px] text-right tabular-nums">{scorePercent}%</span>
                </div>
                {isShared && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide py-0.5 px-[7px] rounded-md animate-[badgePulse_2.5s_ease-in-out_infinite]" style={{ color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)' }}>shared</span>
                )}
                {isUnique && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide py-0.5 px-[7px] rounded-md" style={{ color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)' }}>unique</span>
                )}
              </div>
              <div className="text-[11px] text-accent font-medium mb-1 capitalize">{doc.type}</div>
              <div className="text-[13px] text-text-primary leading-snug overflow-hidden text-ellipsis whitespace-nowrap">
                {(doc.content || '').replace(/^---[\s\S]*?---\s*/, '').replace(/^#+\s*/gm, '').split('\n')[0]?.slice(0, 60) || doc.id}
              </div>
            </Link>
          );
        })}
        {data.results.length === 0 && (
          <div className="text-center text-text-muted py-8 px-4 text-[13px]">No results</div>
        )}
      </div>
    </div>
  );
}
