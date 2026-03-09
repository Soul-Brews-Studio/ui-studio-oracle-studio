import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { search } from '../api/oracle';
import type { Document } from '../api/oracle';
import { Spinner } from '../components/ui/Spinner';

interface ModelResult {
  model: string;
  mode: string;
  results: Document[];
  total: number;
  time: number;
  loading: boolean;
  error?: string;
}

const MODELS = [
  { key: 'bge-m3', label: 'BGE-M3', desc: 'Multilingual 1024d' },
  { key: 'nomic', label: 'Nomic', desc: 'Fast 768d' },
  { key: 'multi', label: 'Multi', desc: 'Both models merged' },
];

const MODES = [
  { key: 'vector', label: 'Vector' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'fts', label: 'FTS' },
];

const TYPE_BORDER_COLORS: Record<string, string> = {
  learning: 'rgba(96, 165, 250, 0.25)',
  principle: 'rgba(192, 132, 252, 0.25)',
  retro: 'rgba(74, 222, 128, 0.25)',
};

const TYPE_BORDER_HOVER: Record<string, string> = {
  learning: '#60a5fa',
  principle: '#c084fc',
  retro: '#4ade80',
};

const TYPE_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  learning: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  principle: { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' },
  retro: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' },
};

export function Compare() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [mode, setMode] = useState<'vector' | 'hybrid' | 'fts'>(
    (searchParams.get('mode') as any) || 'vector'
  );
  const [columns, setColumns] = useState<ModelResult[]>([]);
  const [searched, setSearched] = useState(false);

  // Re-run search if URL has query params (e.g. navigating back)
  useEffect(() => {
    const q = searchParams.get('q');
    const m = searchParams.get('mode') as 'vector' | 'hybrid' | 'fts';
    if (q && !searched) {
      doCompare(q, m || 'vector');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function doCompare(q: string, m: 'vector' | 'hybrid' | 'fts') {
    if (!q.trim()) return;
    setSearched(true);
    setSearchParams({ q, mode: m });

    // Initialize columns as loading
    const initial: ModelResult[] = MODELS.map(model => ({
      model: model.key,
      mode: m,
      results: [],
      total: 0,
      time: 0,
      loading: true,
    }));
    setColumns(initial);

    // Fire all model searches in parallel
    const promises = MODELS.map(async (model, i) => {
      const start = performance.now();
      try {
        const data = await search(q, 'all', 10, m, model.key);
        const elapsed = Math.round(performance.now() - start);
        setColumns(prev => prev.map((col, j) =>
          j === i ? { ...col, results: data.results, total: data.total, time: elapsed, loading: false } : col
        ));
      } catch (e: any) {
        setColumns(prev => prev.map((col, j) =>
          j === i ? { ...col, loading: false, error: e.message } : col
        ));
      }
    });

    await Promise.allSettled(promises);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doCompare(query, mode);
  }

  // Find overlapping doc IDs across columns
  const idSets = columns.map(col => new Set(col.results.map(r => r.id)));

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-6">
      <h1 className="text-[28px] font-bold text-text-primary mb-1 text-center">Model Compare</h1>
      <p className="text-text-muted text-sm text-center mb-6">Same query, different models — side by side</p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search across all models..."
          className="flex-1 min-w-[200px] bg-bg-card border border-border text-text-primary px-4 py-3 rounded-lg text-[15px] outline-none focus:border-accent transition-colors duration-150 placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
          style={{ WebkitAppearance: 'none' }}
          autoFocus
        />
        <div className="flex gap-0.5 bg-bg-card rounded-lg p-0.5 border border-border">
          {MODES.map(m => (
            <button
              key={m.key}
              type="button"
              className={`bg-transparent border-none px-3.5 py-2.5 rounded-md text-[13px] cursor-pointer transition-all duration-150 ${
                mode === m.key
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              onClick={() => setMode(m.key as any)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="bg-accent border-none text-white px-6 py-3 rounded-lg text-[15px] font-medium cursor-pointer hover:opacity-90"
        >
          Compare
        </button>
      </form>

      {!searched && (
        <div className="text-center mt-12">
          <p className="text-text-muted text-[13px] mb-3">Try comparing:</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {['คุณภาพอากาศ air quality', 'trust safety', 'vector embedding', 'oracle philosophy', 'git workflow'].map(term => (
              <button
                key={term}
                className="bg-bg-card border border-border text-text-secondary px-3.5 py-2 rounded-full cursor-pointer text-[13px] transition-all duration-150 hover:border-accent hover:text-accent"
                onClick={() => { setQuery(term); doCompare(term, mode); }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && (
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          {columns.map((col, colIdx) => {
            const modelInfo = MODELS.find(m => m.key === col.model)!;
            return (
              <div key={col.model} className="bg-bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                  <div className="text-lg font-semibold text-text-primary">{modelInfo.label}</div>
                  <div className="text-xs text-text-muted mt-0.5">{modelInfo.desc}</div>
                  {!col.loading && (
                    <div className="text-xs text-text-secondary mt-1.5">
                      {col.total.toLocaleString()} results · {col.time}ms
                    </div>
                  )}
                </div>

                {col.loading && (
                  <div className="flex items-center justify-center gap-2 py-12 text-text-muted text-sm">
                    <Spinner />
                    Searching...
                  </div>
                )}

                {col.error && (
                  <div className="p-6 text-[#ef4444] text-[13px] text-center">{col.error}</div>
                )}

                {!col.loading && !col.error && (
                  <div className="p-2 flex flex-col gap-1">
                    {col.results.length === 0 && (
                      <div className="py-12 text-center text-text-muted text-sm">No results</div>
                    )}
                    {col.results.map((doc, rank) => {
                      // Check if this doc appears in other columns
                      const inOther = idSets.some((s, j) => j !== colIdx && s.has(doc.id));
                      const borderColor = TYPE_BORDER_COLORS[doc.type] || 'rgba(255, 255, 255, 0.06)';
                      const hoverBorderColor = TYPE_BORDER_HOVER[doc.type] || 'rgba(255, 255, 255, 0.12)';
                      const badgeStyle = TYPE_BADGE_STYLES[doc.type] || { bg: 'rgba(255, 255, 255, 0.1)', color: '#888' };

                      return (
                        <div
                          key={doc.id}
                          className="p-3 rounded-xl transition-all duration-150 cursor-pointer group"
                          style={{
                            border: `1px solid ${borderColor}`,
                            boxShadow: inOther ? '0 0 6px rgba(167, 139, 250, 0.1)' : undefined,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = hoverBorderColor; (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.02)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = borderColor; (e.currentTarget as HTMLElement).style.background = ''; }}
                          onClick={() => navigate(`/doc/${encodeURIComponent(doc.id)}`)}
                        >
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-[11px] text-text-muted font-semibold min-w-[20px]">#{rank + 1}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                              style={{ background: badgeStyle.bg, color: badgeStyle.color }}
                            >
                              {doc.type}
                            </span>
                            {doc.score != null && (
                              <span className="text-[11px] text-accent font-semibold">
                                {Math.round(doc.score * 100)}%
                              </span>
                            )}
                            {doc.distance != null && (
                              <span className="text-[10px] text-text-muted font-mono">
                                d={Math.round(doc.distance)}
                              </span>
                            )}
                            {inOther && (
                              <span className="text-[9px] px-1.5 py-px rounded-sm uppercase tracking-wide" style={{ background: 'rgba(100, 181, 246, 0.15)', color: '#64b5f6' }}>
                                overlap
                              </span>
                            )}
                          </div>
                          <div className="text-[13px] text-text-secondary leading-snug mb-1">
                            {doc.content.slice(0, 120)}
                            {doc.content.length > 120 ? '...' : ''}
                          </div>
                          {doc.concepts && doc.concepts.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {doc.concepts.slice(0, 3).map(c => (
                                <span key={c} className="text-[10px] px-1.5 py-px rounded-sm text-text-muted" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                          {doc.score != null && (
                            <div className="h-[3px] rounded-sm mt-1.5" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                              <div className="h-full rounded-sm bg-accent" style={{ width: `${Math.round(doc.score * 100)}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
