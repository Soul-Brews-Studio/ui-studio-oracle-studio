import { useState, useEffect } from 'react';
import { SidebarLayout, TOOLS_NAV } from '../components/SidebarLayout';
import { API_BASE } from '../api/oracle';

const EVOLUTION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'learning', label: 'Learning' },
  { key: 'principle', label: 'Principle' },
  { key: 'retro', label: 'Retro' },
  { key: 'pattern', label: 'Pattern' },
];

interface Supersession {
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
  supersessions: Supersession[];
  total: number;
  limit: number;
  offset: number;
}

export function Evolution() {
  const [supersessions, setSupersessions] = useState<Supersession[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    loadSupersessions();
  }, []);

  async function loadSupersessions() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/supersede`);
      const data: SupersedeResponse = await res.json();
      setSupersessions(data.supersessions);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load supersessions:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = typeFilter === 'all'
    ? supersessions
    : supersessions.filter(s => s.old_type === typeFilter);

  // Group by date
  const grouped = filtered.reduce((acc, s) => {
    const date = new Date(s.superseded_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(s);
    return acc;
  }, {} as Record<string, Supersession[]>);

  function getFileName(path: string | null): string {
    if (!path) return '(deleted)';
    return path.split('/').pop() || path;
  }

  function getTypeEmoji(type: string | null): string {
    switch (type) {
      case 'learning': return '\u{1F4DA}';
      case 'principle': return '\u{1F48E}';
      case 'retro': return '\u{1F4DD}';
      case 'pattern': return '\u{1F52E}';
      default: return '\u{1F4C4}';
    }
  }

  return (
    <SidebarLayout
      navItems={TOOLS_NAV}
      navTitle="Tools"
      filters={EVOLUTION_FILTERS}
      filterTitle="Filter by Type"
      activeType={typeFilter}
      onTypeChange={setTypeFilter}
    >
      <h1 className="text-[1.75rem] font-semibold text-text-primary mb-2">Knowledge Evolution</h1>
      <p className="text-text-secondary text-[0.95rem] mb-6">
        Track how knowledge evolves — what was superseded and why
        <span className="block italic text-[#c084fc] mt-1 text-sm">"Nothing is Deleted"</span>
      </p>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading supersessions...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-text-secondary bg-bg-secondary rounded-xl mt-4">
          <p>No supersessions recorded yet.</p>
          <p className="text-sm text-text-muted mt-2">
            Use <code className="bg-bg-card px-2 py-0.5 rounded text-sm">oracle_supersede()</code> to track document evolution.
          </p>
        </div>
      ) : (
        <>
          <div className="text-text-muted text-sm mb-4 pb-4 border-b border-border">
            <span>{total} supersession{total !== 1 ? 's' : ''} recorded</span>
          </div>

          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date} className="bg-bg-secondary rounded-xl p-4 px-5">
                <h2 className="text-sm font-semibold text-text-muted mb-4 pb-2 border-b border-border">{date}</h2>
                <div className="flex flex-col gap-4">
                  {items.map(s => (
                    <div key={s.id} className="p-3 bg-bg-card rounded-lg border-l-[3px] border-l-[#c084fc]">
                      <div className="flex items-center gap-2 text-[0.95rem] flex-wrap">
                        <span className="text-text-secondary line-through opacity-70">
                          {getTypeEmoji(s.old_type)} {getFileName(s.old_path)}
                        </span>
                        <span className="text-[#c084fc] font-bold">{'\u2192'}</span>
                        <span className="text-text-primary font-medium">
                          {s.new_path ? getFileName(s.new_path) : '(archived)'}
                        </span>
                      </div>
                      {s.reason && (
                        <div className="mt-2 p-2 bg-bg-secondary rounded text-sm text-text-secondary italic">
                          "{s.reason}"
                        </div>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-text-muted">
                        <span>
                          {'\u{1F464}'} {s.superseded_by || 'unknown'}
                        </span>
                        <span>
                          {'\u{1F550}'} {new Date(s.superseded_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </SidebarLayout>
  );
}
