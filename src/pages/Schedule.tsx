import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SidebarLayout, TOOLS_NAV } from '../components/SidebarLayout';

const API_BASE = '/api';

export function Schedule() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', event: '', time: '', notes: '' });

  useEffect(() => { loadSchedule(); }, []);

  async function loadSchedule() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/schedule/md`);
      if (res.ok) setContent(await res.text());
    } catch (e) {
      console.error('Failed to load schedule:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.event) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ date: '', event: '', time: '', notes: '' });
        setShowForm(false);
        await loadSchedule();
      }
    } catch (e) {
      console.error('Failed to add event:', e);
    } finally {
      setAdding(false);
    }
  }

  return (
    <SidebarLayout navItems={TOOLS_NAV} navTitle="Tools" filters={[]}>
      <div className="flex justify-between items-start mb-6 max-md:flex-col max-md:gap-3">
        <div>
          <h1 className="text-[32px] font-bold text-text-primary mb-2">Schedule</h1>
          <p className="text-text-secondary">
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-[13px]">~/.oracle/psi/inbox/schedule.md</code>
          </p>
        </div>
        <button
          className="bg-accent text-black border-none px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity duration-150"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Event'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-bg-card border border-border rounded-xl p-5 mb-6 flex flex-col gap-3">
          <div className="flex gap-3 max-md:flex-col">
            <input
              className="bg-bg-secondary border border-border rounded-lg px-3.5 py-2.5 text-text-primary text-sm flex-1 outline-none focus:border-accent transition-colors duration-150 placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
              style={{ WebkitAppearance: 'none' }}
              placeholder="Date (e.g. 5 Mar, 28 ก.พ.)"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              required
            />
            <input
              className="bg-bg-secondary border border-border rounded-lg px-3.5 py-2.5 text-text-primary text-sm flex-1 outline-none focus:border-accent transition-colors duration-150 placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
              style={{ WebkitAppearance: 'none' }}
              placeholder="Time (e.g. 14:00, TBD)"
              value={form.time}
              onChange={e => setForm({ ...form, time: e.target.value })}
            />
          </div>
          <input
            className="bg-bg-secondary border border-border rounded-lg px-3.5 py-2.5 text-text-primary text-sm flex-1 outline-none focus:border-accent transition-colors duration-150 placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
            style={{ WebkitAppearance: 'none' }}
            placeholder="Event description"
            value={form.event}
            onChange={e => setForm({ ...form, event: e.target.value })}
            required
          />
          <input
            className="bg-bg-secondary border border-border rounded-lg px-3.5 py-2.5 text-text-primary text-sm flex-1 outline-none focus:border-accent transition-colors duration-150 placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
            style={{ WebkitAppearance: 'none' }}
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
          <button
            type="submit"
            className="bg-accent text-black border-none px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer self-end disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={adding}
          >
            {adding ? 'Adding...' : 'Add to Schedule'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-text-muted py-12 text-center">Loading schedule...</div>
      ) : content ? (
        <div className="bg-bg-card border border-border rounded-xl p-6 leading-[1.7] text-text-primary text-sm [&_h1]:my-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:text-text-primary [&_h2]:my-4 [&_h2]:mb-2 [&_h2]:text-[17px] [&_h2]:text-text-primary [&_h3]:my-4 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:text-text-primary [&_p]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:border-b [&_th]:border-border [&_th]:text-xs [&_th]:text-text-muted [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_td]:text-left [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border [&_td]:text-[13px] [&_td]:text-text-primary [&_strong]:text-accent [&_hr]:border-none [&_hr]:border-t [&_hr]:border-border [&_hr]:my-4">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      ) : (
        <div className="text-center py-16 text-text-secondary">
          <p className="my-2">No schedule found.</p>
          <p className="text-sm text-text-muted my-2">
            Use <code className="bg-bg-card px-1.5 py-0.5 rounded text-[13px]">oracle_schedule_add</code> or click "+ Add Event".
          </p>
        </div>
      )}
    </SidebarLayout>
  );
}
