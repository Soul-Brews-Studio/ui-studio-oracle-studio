import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner';
import { API_BASE } from '../api/oracle';

interface Thread {
  id: number;
  title: string;
  status: 'active' | 'answered' | 'pending' | 'closed';
  message_count: number;
  created_at: string;
  issue_url: string | null;
}

interface Message {
  id: number;
  role: 'human' | 'oracle' | 'claude';
  content: string;
  author: string | null;
  principles_found: number | null;
  patterns_found: number | null;
  created_at: string;
}

interface ThreadDetail {
  thread: { id: number; title: string; status: string; created_at: string; issue_url: string | null };
  messages: Message[];
}

const STATUS_COLORS: Record<string, string> = {
  answered: '#4ade80',
  pending: '#fbbf24',
  active: '#60a5fa',
  closed: '#6b7280',
};

export function Forum() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [msg, setMsg] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const threadId = searchParams.get('thread');
  const showNew = searchParams.get('new') === 'true';

  useEffect(() => { loadThreads(); }, []);

  useEffect(() => {
    if (threadId) selectThread(parseInt(threadId, 10));
    else if (threads.length > 0 && !showNew) setSearchParams({ thread: threads[0].id.toString() });
    else setSelected(null);
  }, [threadId, threads]);

  async function loadThreads() {
    const data = await (await fetch(`${API_BASE}/threads`)).json();
    setThreads(data.threads);
  }

  async function selectThread(id: number) {
    const data = await (await fetch(`${API_BASE}/thread/${id}`)).json();
    setSelected(data);
    setSearchParams({ thread: id.toString() });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return;
    setLoading(true);
    try {
      if (selected) {
        await fetch(`${API_BASE}/thread`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, thread_id: selected.thread.id }) });
        const data = await (await fetch(`${API_BASE}/thread/${selected.thread.id}`)).json();
        setSelected(data);
      } else if (showNew) {
        const result = await (await fetch(`${API_BASE}/thread`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, title: title || undefined }) })).json();
        await loadThreads();
        setSearchParams({ thread: result.thread_id.toString() });
      }
      setMsg('');
      setTitle('');
    } finally { setLoading(false); }
  }

  async function handleToggle() {
    if (!selected) return;
    const newStatus = selected.thread.status === 'closed' ? 'active' : 'closed';
    await fetch(`${API_BASE}/thread/${selected.thread.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    const data = await (await fetch(`${API_BASE}/thread/${selected.thread.id}`)).json();
    setSelected(data);
    await loadThreads();
  }

  return (
    <div className="flex max-w-[1300px] mx-auto py-6 px-6 gap-6 max-md:flex-col max-md:p-3 max-md:gap-0">
      {/* Sidebar — hidden on mobile when thread is selected */}
      <div className={`w-[180px] shrink-0 flex flex-col max-md:w-full ${selected ? 'max-md:hidden' : ''}`}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-mono uppercase tracking-wide text-text-muted">Threads</h2>
          <button
            onClick={() => { setSearchParams({ new: 'true' }); setSelected(null); }}
            className="bg-accent text-white px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-none hover:bg-accent-hover transition-all duration-150"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {threads.map(t => (
            <div
              key={t.id}
              onClick={() => setSearchParams({ thread: t.id.toString() })}
              className={`p-3 rounded-xl cursor-pointer transition-all duration-150 border ${
                selected?.thread.id === t.id
                  ? 'bg-accent/10 border-accent/30'
                  : 'border-transparent hover:bg-white/3'
              }`}
            >
              <div className="text-sm font-medium text-text-primary mb-1.5 truncate">{t.title}</div>
              <div className="flex items-center gap-2">
                <StatusBadge status={t.status} />
                <span className="text-xs text-text-muted font-mono">{t.message_count} msgs</span>
              </div>
            </div>
          ))}
          {threads.length === 0 && <div className="text-center text-text-muted py-8 text-sm">No threads yet</div>}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showNew && !selected && (
          <div className="max-w-[600px] mx-auto pt-8 w-full">
            <h2 className="text-xl font-semibold text-text-primary mb-6">Start New Discussion</h2>
            <form onSubmit={handleSend} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Thread title (optional)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-bg-secondary border border-border text-text-primary px-4 py-3 rounded-xl text-[15px] font-[inherit] outline-none focus:border-accent transition-colors duration-150 placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
                style={{ WebkitAppearance: 'none' }}
              />
              <textarea
                placeholder="Ask Oracle a question..."
                value={msg}
                onChange={e => setMsg(e.target.value)}
                className="w-full bg-bg-secondary border border-border text-text-primary px-4 py-3 rounded-xl text-[15px] font-[inherit] resize-y min-h-[100px] outline-none focus:border-accent transition-colors duration-150 placeholder:text-text-muted"
                rows={4}
              />
              <button
                type="submit"
                disabled={loading || !msg.trim()}
                className="self-end bg-accent text-white px-6 py-3 rounded-xl text-[15px] font-medium cursor-pointer border-none hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? 'Sending...' : 'Ask Oracle'}
              </button>
            </form>
          </div>
        )}

        {selected && (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-6 py-5 mb-2 border-b border-border flex-wrap">
              <button
                onClick={() => { setSelected(null); setSearchParams({}); }}
                className="md:hidden bg-transparent border-none text-text-muted cursor-pointer p-1 hover:text-accent transition-colors"
              >
                ←
              </button>
              <h2 className="text-lg font-semibold text-text-primary flex-1 min-w-0 leading-tight">{selected.thread.title}</h2>
              <StatusBadge status={selected.thread.status} />
              <button
                onClick={handleToggle}
                className="bg-transparent border border-border text-text-muted px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all duration-150"
              >
                {selected.thread.status === 'closed' ? 'Reopen' : 'Close'}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {selected.messages.map(m => (
                <MessageCard key={m.id} message={m} />
              ))}
            </div>

            {/* Reply */}
            <form onSubmit={handleSend} className="px-6 py-5 border-t border-border bg-bg-card flex gap-3">
              <textarea
                placeholder="Continue the discussion..."
                value={msg}
                onChange={e => setMsg(e.target.value)}
                className="flex-1 bg-bg-secondary border border-border text-text-primary px-4 py-3 rounded-xl text-[15px] font-[inherit] resize-y min-h-[60px] outline-none focus:border-accent transition-colors duration-150 placeholder:text-text-muted"
                rows={3}
              />
              <button
                type="submit"
                disabled={loading || !msg.trim()}
                className="self-end bg-accent text-white px-6 py-3 rounded-xl text-[15px] font-medium cursor-pointer border-none hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? <Spinner /> : 'Reply'}
              </button>
            </form>
          </>
        )}

        {!showNew && !selected && (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Select a thread or start a new discussion
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280';
  return (
    <span
      className="text-[9px] font-mono font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
      style={{ background: `${color}25`, color }}
    >
      {status}
    </span>
  );
}

function MessageCard({ message: m }: { message: Message }) {
  const roleLabel = m.role === 'oracle' ? '🔮 Oracle' : m.role === 'claude' ? `🤖 ${m.author || 'Claude'}` : `👤 ${m.author || 'User'}`;
  const roleBorder = m.role === 'oracle' ? 'border-accent/30' : m.role === 'claude' ? 'border-type-learning/30' : 'border-border';

  return (
    <div className={`p-5 rounded-2xl bg-bg-card border ${roleBorder}`}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-semibold text-text-primary">{roleLabel}</span>
        <span className="text-xs text-text-muted font-mono">{new Date(m.created_at).toLocaleString()}</span>
      </div>
      <div className="text-text-primary leading-[1.65] whitespace-pre-wrap text-[15px]">{m.content}</div>
      {m.patterns_found != null && m.patterns_found > 0 && (
        <div className="mt-4 text-xs text-accent font-mono">Found {m.patterns_found} patterns</div>
      )}
    </div>
  );
}
