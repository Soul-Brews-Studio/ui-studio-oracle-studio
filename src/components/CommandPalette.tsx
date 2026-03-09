import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { search } from '../api/oracle';
import type { Document } from '../api/oracle';
import styles from './CommandPalette.module.css';

interface CommandPaletteProps {
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  learning: '#60a5fa',
  principle: '#c084fc',
  retro: '#4ade80',
  trace: '#38bdf8',
  thread: '#a78bfa',
  resonance: '#fb7185',
  handoff: '#22d3ee',
};

const MODES = ['hybrid', 'fts', 'vector'] as const;
const MODELS = [
  { key: 'bge-m3', label: 'BGE-M3' },
  { key: 'nomic', label: 'Nomic' },
  { key: 'multi', label: 'Multi' },
] as const;

export const CommandPalette = memo(function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [mode, setMode] = useState<'hybrid' | 'fts' | 'vector'>('hybrid');
  const [model, setModel] = useState<string>('bge-m3');
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
    // Double-focus for mobile
    setTimeout(() => inputRef.current?.click(), 50);
  }, []);

  const doSearch = useCallback(async (q: string, m: typeof mode, mod: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); setTotal(0); return; }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setSearched(true);
    setSelectedIdx(-1);
    setExpandedId(null);
    const start = performance.now();
    try {
      const data = await search(q.trim(), 'all', 20, m, mod);
      if (ac.signal.aborted) return;
      setResults(data.results || []);
      setTotal(data.total || 0);
      setSearchTime(Math.round(performance.now() - start));
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setResults([]);
        setTotal(0);
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedIdx >= 0 && results[selectedIdx]) {
        navigate(`/doc/${encodeURIComponent(results[selectedIdx].id)}`);
        onClose();
      } else {
        doSearch(query, mode, model);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, -1));
      return;
    }
  }, [query, mode, model, results, selectedIdx, doSearch, onClose, navigate]);

  // Scroll selected into view
  useEffect(() => {
    if (selectedIdx >= 0 && listRef.current) {
      const el = listRef.current.children[selectedIdx] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx]);

  const scoreDisplay = (doc: Document) => {
    const parts: string[] = [];
    if (doc.score != null) parts.push(`${Math.round(doc.score * 100)}%`);
    if (doc.distance != null) parts.push(`d=${Math.round(doc.distance)}`);
    if (doc.model) parts.push(doc.model);
    return parts.join(' · ');
  };

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.palette}>
        {/* Search bar */}
        <div className={styles.searchBar}>
          <svg className={styles.searchIcon} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx={11} cy={11} r={8} />
            <line x1={21} y1={21} x2={16.65} y2={16.65} />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.input}
            placeholder="Search Oracle..."
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          {loading && <div className={styles.spinner} />}
        </div>

        {/* Controls bar */}
        <div className={styles.controlsBar}>
          <div className={styles.toggleGroup}>
            {MODES.map(m => (
              <button
                key={m}
                className={`${styles.toggleBtn} ${mode === m ? styles.toggleActive : ''}`}
                onClick={() => { setMode(m); if (query.trim()) doSearch(query, m, model); }}
              >
                {m}
              </button>
            ))}
          </div>
          <div className={styles.toggleGroup}>
            {MODELS.map(m => (
              <button
                key={m.key}
                className={`${styles.toggleBtn} ${model === m.key ? styles.toggleActive : ''}`}
                onClick={() => { setModel(m.key); if (query.trim()) doSearch(query, mode, m.key); }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meta bar */}
        {searched && !loading && (
          <div className={styles.metaBar}>
            <span>{total.toLocaleString()} results</span>
            <span>{searchTime}ms</span>
          </div>
        )}

        {/* Results */}
        <div className={styles.resultList} ref={listRef}>
          {!searched && !loading && (
            <div className={styles.hints}>
              <div className={styles.hintsLabel}>Try searching</div>
              <div className={styles.hintsList}>
                {['trust', 'oracle philosophy', 'คุณภาพอากาศ', 'git workflow', 'embedding'].map(term => (
                  <button
                    key={term}
                    className={styles.hintBtn}
                    onClick={() => { setQuery(term); doSearch(term, mode, model); }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div className={styles.empty}>No results for "{query}"</div>
          )}

          {results.map((doc, i) => {
            const isSelected = i === selectedIdx;
            const isExpanded = expandedId === doc.id;
            const content = doc.content || '';
            const typeColor = TYPE_COLORS[doc.type] || '#888';

            return (
              <div
                key={doc.id}
                className={`${styles.resultCard} ${isSelected ? styles.resultSelected : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                onDoubleClick={() => { navigate(`/doc/${encodeURIComponent(doc.id)}`); onClose(); }}
              >
                <div className={styles.resultHeader}>
                  <span className={styles.rank}>#{i + 1}</span>
                  <span className={styles.typeBadge} style={{ background: `${typeColor}20`, color: typeColor }}>
                    {doc.type}
                  </span>
                  <span className={styles.resultMeta}>{scoreDisplay(doc)}</span>
                  {doc.source && doc.source !== 'fts' && (
                    <span className={styles.sourceBadge}>{doc.source}</span>
                  )}
                </div>
                <div className={styles.resultContent} style={{ maxHeight: isExpanded ? 'none' : '2.8em' }}>
                  {isExpanded ? content : content.slice(0, 150)}
                  {!isExpanded && content.length > 150 ? '...' : ''}
                </div>
                {doc.source_file && (
                  <div className={styles.resultSource}>
                    {doc.source_file.length > 60 ? '...' + doc.source_file.slice(-57) : doc.source_file}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span><kbd>Enter</kbd> search · <kbd>↑↓</kbd> navigate · <kbd>Esc</kbd> close · double-click → detail</span>
          <span>oracle-v2</span>
        </div>
      </div>
    </div>
  );
});
