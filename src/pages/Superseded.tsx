import { useState, useEffect } from 'react';
import { SidebarLayout, TOOLS_NAV } from '../components/SidebarLayout';
import { getDocDisplayInfo } from '../utils/docDisplay';

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'learning', label: 'Learning' },
  { key: 'principle', label: 'Principle' },
  { key: 'retro', label: 'Retro' },
  { key: 'pattern', label: 'Pattern' },
];

interface SupersedeLog {
  id: number;
  old_path: string;
  old_id: string | null;
  old_title: string | null;
  old_type: string | null;
  new_path: string | null;
  new_id: string | null;
  new_title: string | null;
  reason: string | null;
  superseded_at: string;
  superseded_by: string | null;
  project: string | null;
}

interface SupersedeResponse {
  supersessions: SupersedeLog[];
  total: number;
  limit: number;
  offset: number;
}

export function Superseded() {
  const [logs, setLogs] = useState<SupersedeLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const limit = 20;

  useEffect(() => {
    loadLogs();
  }, [page]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/supersede?limit=${limit}&offset=${page * limit}`);
      const data: SupersedeResponse = await res.json();
      setLogs(data.supersessions || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Failed to load supersede logs:', e);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function extractTitle(path: string | null, title?: string | null) {
    if (title) return title;
    if (!path) return 'Unknown';
    const filename = path.split('/').pop() || path;
    return filename.replace(/\.md$/, '').replace(/[-_]/g, ' ');
  }

  const filtered = typeFilter === 'all'
    ? logs
    : logs.filter(l => l.old_type === typeFilter);

  const totalPages = Math.ceil(total / limit);

  return (
    <SidebarLayout
      navItems={TOOLS_NAV}
      navTitle="Tools"
      filters={TYPE_FILTERS}
      filterTitle="Filter by Type"
      activeType={typeFilter}
      onTypeChange={setTypeFilter}
    >
      <div className="flex justify-between items-start mb-8 max-md:flex-col max-md:gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-text-primary mb-2">Superseded Documents</h1>
          <p className="text-text-muted text-sm italic">
            "Nothing is Deleted" — Old documents preserved but marked as outdated
          </p>
        </div>
        <div className="text-text-secondary text-sm bg-bg-card px-4 py-2 rounded-lg">
          {total} supersessions
        </div>
      </div>

      {loading ? (
        <div className="text-center text-text-muted py-16">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-text-muted py-16">
          <p>No superseded documents yet.</p>
          <p className="mt-4 text-[13px]">
            Use <code className="bg-bg-card px-2 py-0.5 rounded text-[13px]">oracle_supersede(oldId, newId)</code> to mark outdated documents.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {filtered.map((log) => (
              <div key={log.id} className="bg-bg-card border border-border rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <span className="bg-[rgba(239,68,68,0.2)] text-[#ef4444] px-2.5 py-1 rounded-xl text-[11px] font-medium uppercase">
                    {log.old_type || 'doc'}
                  </span>
                  <span className="text-text-muted text-xs">{formatDate(log.superseded_at)}</span>
                </div>

                <div className="flex items-center gap-4 mb-4 max-md:flex-col">
                  <div className="flex-1 flex flex-col gap-1 p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">
                    <span className="text-[10px] uppercase tracking-wide text-text-muted">Old</span>
                    <span className="font-medium text-text-primary text-sm">{extractTitle(log.old_path, log.old_title)}</span>
                    <span className="text-[11px] text-text-muted font-mono break-all">{log.old_path}</span>
                  </div>

                  <div className="text-2xl text-text-muted shrink-0 max-md:rotate-90">{'\u2192'}</div>

                  <div className="flex-1 flex flex-col gap-1 p-3 rounded-lg bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)]">
                    <span className="text-[10px] uppercase tracking-wide text-text-muted">New</span>
                    <span className="font-medium text-text-primary text-sm">{extractTitle(log.new_path, log.new_title)}</span>
                    <span className="text-[11px] text-text-muted font-mono break-all">{log.new_path || log.new_id || 'N/A'}</span>
                  </div>
                </div>

                {log.reason && (
                  <div className="bg-[rgba(167,139,250,0.1)] border-l-[3px] border-l-accent px-3.5 py-2.5 rounded-r-lg text-[13px] text-text-secondary mb-3">
                    <strong>Reason:</strong> {log.reason}
                  </div>
                )}

                <div className="flex gap-4 text-xs text-text-muted">
                  <span>by {log.superseded_by || 'user'}</span>
                  {(() => {
                    const info = getDocDisplayInfo(log.old_path || '', log.project);
                    return (
                      <>
                        {info.projectVaultUrl ? (
                          <a
                            href={info.projectVaultUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-text-secondary bg-[rgba(167,139,250,0.1)] px-2 py-0.5 rounded font-mono no-underline transition-all duration-200 hover:text-accent hover:bg-[rgba(167,139,250,0.2)]"
                          >
                            {'\u{1F517}'} {info.projectDisplay}
                          </a>
                        ) : (
                          <span className="text-[11px] text-warning bg-[rgba(251,191,36,0.1)] px-2 py-0.5 rounded font-medium">
                            {'\u2726'} universal
                          </span>
                        )}
                        {log.old_path && info.vaultUrl && (
                          <a
                            href={info.vaultUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#34d399] bg-[rgba(52,211,153,0.1)] px-2 py-[3px] rounded font-medium no-underline transition-all duration-200 hover:bg-[rgba(52,211,153,0.2)] hover:text-[#6ee7b7]"
                          >
                            {'\u{1F3DB}\uFE0F'} vault
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="bg-bg-card border border-border text-text-secondary px-4 py-2 rounded-lg cursor-pointer text-[13px] transition-all duration-200 hover:bg-accent hover:text-white hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {'\u2190'} Prev
              </button>
              <span className="text-text-muted text-[13px]">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="bg-bg-card border border-border text-text-secondary px-4 py-2 rounded-lg cursor-pointer text-[13px] transition-all duration-200 hover:bg-accent hover:text-white hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next {'\u2192'}
              </button>
            </div>
          )}
        </>
      )}
    </SidebarLayout>
  );
}
