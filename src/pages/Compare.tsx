import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { search } from '../api/oracle';
import type { Document } from '../api/oracle';
import styles from './Compare.module.css';

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
    <div className={styles.container}>
      <h1 className={styles.title}>Model Compare</h1>
      <p className={styles.subtitle}>Same query, different models — side by side</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search across all models..."
          className={styles.input}
          autoFocus
        />
        <div className={styles.modeToggle}>
          {MODES.map(m => (
            <button
              key={m.key}
              type="button"
              className={`${styles.modeBtn} ${mode === m.key ? styles.modeBtnActive : ''}`}
              onClick={() => setMode(m.key as any)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="submit" className={styles.button}>Compare</button>
      </form>

      {!searched && (
        <div className={styles.suggestions}>
          <p className={styles.suggestionsLabel}>Try comparing:</p>
          <div className={styles.suggestionList}>
            {['คุณภาพอากาศ air quality', 'trust safety', 'vector embedding', 'oracle philosophy', 'git workflow'].map(term => (
              <button
                key={term}
                className={styles.suggestion}
                onClick={() => { setQuery(term); doCompare(term, mode); }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && (
        <div className={styles.grid}>
          {columns.map((col, colIdx) => {
            const modelInfo = MODELS.find(m => m.key === col.model)!;
            return (
              <div key={col.model} className={styles.column}>
                <div className={styles.columnHeader}>
                  <div className={styles.modelName}>{modelInfo.label}</div>
                  <div className={styles.modelDesc}>{modelInfo.desc}</div>
                  {!col.loading && (
                    <div className={styles.columnMeta}>
                      {col.total.toLocaleString()} results · {col.time}ms
                    </div>
                  )}
                </div>

                {col.loading && (
                  <div className={styles.loading}>
                    <div className={styles.spinner} />
                    Searching...
                  </div>
                )}

                {col.error && (
                  <div className={styles.error}>{col.error}</div>
                )}

                {!col.loading && !col.error && (
                  <div className={styles.resultList}>
                    {col.results.length === 0 && (
                      <div className={styles.empty}>No results</div>
                    )}
                    {col.results.map((doc, rank) => {
                      // Check if this doc appears in other columns
                      const inOther = idSets.some((s, j) => j !== colIdx && s.has(doc.id));
                      return (
                        <div
                          key={doc.id}
                          className={`${styles.resultCard} ${styles[`border_${doc.type}`] || ''} ${inOther ? styles.overlap : ''}`}
                          onClick={() => navigate(`/doc/${encodeURIComponent(doc.id)}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className={styles.resultHeader}>
                            <span className={styles.rank}>#{rank + 1}</span>
                            <span className={`${styles.typeBadge} ${styles[`type_${doc.type}`]}`}>
                              {doc.type}
                            </span>
                            {doc.score != null && (
                              <span className={styles.score}>
                                {Math.round(doc.score * 100)}%
                              </span>
                            )}
                            {doc.distance != null && (
                              <span className={styles.distance}>
                                d={Math.round(doc.distance)}
                              </span>
                            )}
                            {inOther && <span className={styles.overlapBadge}>overlap</span>}
                          </div>
                          <div className={styles.resultContent}>
                            {doc.content.slice(0, 120)}
                            {doc.content.length > 120 ? '...' : ''}
                          </div>
                          {doc.concepts && doc.concepts.length > 0 && (
                            <div className={styles.resultConcepts}>
                              {doc.concepts.slice(0, 3).map(c => (
                                <span key={c} className={styles.concept}>{c}</span>
                              ))}
                            </div>
                          )}
                          {doc.score != null && (
                            <div className={styles.scoreBar}>
                              <div className={styles.scoreBarFill} style={{ width: `${Math.round(doc.score * 100)}%` }} />
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
