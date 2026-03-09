import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getDashboardSummary, getDashboardActivity, getDashboardGrowth } from '../api/oracle';
import type { DashboardSummary, DashboardActivity, DashboardGrowth } from '../api/oracle';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const PERIODS = ['week', 'month', 'quarter'] as const;
type Period = typeof PERIODS[number];

const TABS = ['gaps', 'searches', 'learnings'] as const;
type Tab = typeof TABS[number];

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function Activity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<DashboardActivity | null>(null);
  const [growth, setGrowth] = useState<DashboardGrowth | null>(null);
  const [loading, setLoading] = useState(true);

  // URL-persisted state
  const period = (searchParams.get('period') as Period) || 'week';
  const activeTab = (searchParams.get('tab') as Tab) || 'gaps';

  // Knowledge gaps: searches with 0 results
  const gaps = [
    ...(activity?.searches?.filter(s => s.results_count === 0).map(s => ({
      type: 'search' as const,
      query: s.query,
      created_at: s.created_at
    })) || []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  function setPeriod(newPeriod: Period) {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('period', newPeriod);
      return params;
    });
  }

  function setActiveTab(newTab: Tab) {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('tab', newTab);
      return params;
    });
  }

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
      const [summaryData, activityData, growthData] = await Promise.all([
        getDashboardSummary(),
        getDashboardActivity(days),
        getDashboardGrowth(period)
      ]);
      setSummary(summaryData);
      setActivity(activityData);
      setGrowth(growthData);
    } finally {
      setLoading(false);
    }
  }

  // Calculate averages
  const avgSearchTime = activity?.searches?.length
    ? Math.round(activity.searches.reduce((sum, s) => sum + s.search_time_ms, 0) / activity.searches.length)
    : 0;

  if (loading && !summary) {
    return <div className="text-center text-text-muted py-12 px-6">Loading activity data...</div>;
  }

  return (
    <div className="max-w-[1000px] mx-auto py-8 px-6">
      <header className="mb-8">
        <h1 className="text-[32px] font-bold text-text-primary mb-2">Activity</h1>
        <p className="text-base text-text-secondary">Search logs and learning history</p>
      </header>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6 max-md:flex-wrap">
        {PERIODS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`bg-bg-card border border-border text-text-secondary px-4 py-2 rounded-lg cursor-pointer text-sm transition-all duration-200 hover:border-accent hover:text-text-primary ${
              period === p ? '!bg-accent !border-accent !text-bg-primary font-medium' : ''
            }`}
          >
            {p === 'week' ? '7 days' : p === 'month' ? '30 days' : '90 days'}
          </button>
        ))}
      </div>

      {/* Summary Cards - clickable to switch tabs */}
      <div className="grid grid-cols-4 gap-4 mb-8 max-md:grid-cols-2 max-[480px]:grid-cols-1">
        <button
          type="button"
          onClick={() => setActiveTab('gaps')}
          className={`bg-bg-card border border-border rounded-xl p-5 text-center cursor-pointer transition-all duration-200 font-[inherit] hover:border-accent hover:-translate-y-0.5 ${
            gaps.length > 0 ? '!border-[#f59e0b] !bg-[rgba(245,158,11,0.1)]' : ''
          } ${activeTab === 'gaps' ? '!border-accent shadow-[0_0_0_1px_var(--color-accent)]' : ''}`}
        >
          <div className="text-2xl mb-2">⚠️</div>
          <div className={`text-[28px] font-bold mb-1 ${gaps.length > 0 ? 'text-[#f59e0b]' : 'text-text-primary'}`}>{gaps.length}</div>
          <div className="text-sm text-text-secondary mb-1">Knowledge Gaps</div>
          <div className="text-xs text-text-muted">0 result queries</div>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('searches')}
          className={`bg-bg-card border border-border rounded-xl p-5 text-center cursor-pointer transition-all duration-200 font-[inherit] hover:border-accent hover:-translate-y-0.5 ${
            activeTab === 'searches' ? '!border-accent shadow-[0_0_0_1px_var(--color-accent)]' : ''
          }`}
        >
          <div className="text-2xl mb-2">🔍</div>
          <div className="text-[28px] font-bold text-text-primary mb-1">{summary?.activity.searches_7d ?? 0}</div>
          <div className="text-sm text-text-secondary mb-1">Searches</div>
          <div className="text-xs text-text-muted">avg {avgSearchTime}ms</div>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('learnings')}
          className={`bg-bg-card border border-border rounded-xl p-5 text-center cursor-pointer transition-all duration-200 font-[inherit] hover:border-accent hover:-translate-y-0.5 ${
            activeTab === 'learnings' ? '!border-accent shadow-[0_0_0_1px_var(--color-accent)]' : ''
          }`}
        >
          <div className="text-2xl mb-2">📚</div>
          <div className="text-[28px] font-bold text-text-primary mb-1">{summary?.activity.learnings_7d ?? 0}</div>
          <div className="text-sm text-text-secondary mb-1">Learnings</div>
          <div className="text-xs text-text-muted">this period</div>
        </button>
      </div>

      {/* Growth Chart */}
      {growth && growth.data.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-0">Daily Activity</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={growth.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                stroke="#666"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { weekday: 'short' });
                }}
              />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #2a2a3a',
                  borderRadius: '8px',
                  color: '#e0e0e0'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="searches" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="documents" stroke="#fbbf24" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Recent Activity</h2>
          <button
            type="button"
            onClick={() => loadData()}
            className={`bg-transparent border border-border text-text-secondary w-8 h-8 rounded-lg cursor-pointer text-lg flex items-center justify-center transition-all duration-200 hover:enabled:border-accent hover:enabled:text-accent hover:enabled:bg-[rgba(167,139,250,0.1)] disabled:opacity-50 disabled:cursor-not-allowed ${
              loading ? 'animate-spin' : ''
            }`}
            disabled={loading}
            title="Refresh data"
          >
            ↻
          </button>
        </div>

        <div className="flex gap-1 mb-4 border-b border-border pb-4 max-md:overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`bg-transparent border-none text-text-secondary px-4 py-2 rounded-lg cursor-pointer text-sm transition-all duration-200 flex items-center gap-2 hover:bg-[rgba(167,139,250,0.1)] hover:text-text-primary ${
                activeTab === tab ? '!bg-[rgba(167,139,250,0.2)] !text-accent font-medium' : ''
              } ${tab === 'gaps' && gaps.length > 0 ? '!text-[#f59e0b]' : ''}`}
            >
              {tab === 'gaps' ? 'Knowledge Gaps' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span
                className={`px-2 py-0.5 rounded-[10px] text-xs ${
                  activeTab === tab ? 'bg-accent text-bg-primary' : 'bg-border'
                } ${tab === 'gaps' && gaps.length > 0 && activeTab !== tab ? '!bg-[#f59e0b] !text-bg-primary' : ''}`}
              >
                {tab === 'gaps' ? gaps.length :
                 tab === 'searches' ? activity?.searches?.length ?? 0 :
                 activity?.learnings?.length ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col">
          {/* Knowledge Gaps Tab */}
          {activeTab === 'gaps' && gaps.map((g, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 my-1 bg-[rgba(245,158,11,0.05)] rounded-lg border border-[rgba(245,158,11,0.2)]"
            >
              <div className="text-xl shrink-0 w-8 h-8 flex items-center justify-center bg-[rgba(245,158,11,0.2)] rounded-lg">🔍</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary mb-1 overflow-hidden text-ellipsis whitespace-nowrap">"{g.query}"</div>
                <div className="text-xs text-text-muted">
                  No results found
                </div>
              </div>
              <div className="flex gap-2 items-center shrink-0">
                <Link
                  to={`/search?q=${encodeURIComponent(g.query)}`}
                  className="bg-bg-card border border-border text-text-secondary px-2.5 py-1.5 rounded-md cursor-pointer text-sm no-underline transition-all duration-200 hover:border-accent hover:text-text-primary"
                  title="Search again"
                >
                  🔄
                </Link>
                <button
                  type="button"
                  className="bg-[#f59e0b] border-none text-bg-primary px-3 py-1.5 rounded-md cursor-pointer text-[13px] font-medium transition-all duration-200 flex items-center gap-1 hover:bg-[#d97706] hover:-translate-y-px"
                  onClick={() => {
                    const event = new CustomEvent('quicklearn:open', { detail: { query: g.query } });
                    window.dispatchEvent(event);
                  }}
                  title="Add knowledge about this topic"
                >
                  ➕ Learn
                </button>
              </div>
            </div>
          ))}
          {activeTab === 'gaps' && gaps.length === 0 && (
            <div className="text-center text-text-muted py-8">
              <div className="text-[32px] mb-2">✨</div>
              <div>No knowledge gaps! All searches found results.</div>
            </div>
          )}

          {/* Searches Tab */}
          {activeTab === 'searches' && activity?.searches?.map((s, i) => (
            <Link
              key={i}
              to={`/search?q=${encodeURIComponent(s.query)}`}
              className={`flex items-start gap-3 py-4 border-b border-border last:border-b-0 no-underline cursor-pointer transition-colors duration-200 hover:bg-[rgba(167,139,250,0.1)] hover:rounded-lg hover:mx-[-8px] hover:px-2 ${
                s.results_count === 0 ? '!bg-[rgba(245,158,11,0.05)] !rounded-lg !my-1 !p-4 !border !border-[rgba(245,158,11,0.2)]' : ''
              }`}
            >
              <div className={`text-xl shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${
                s.results_count === 0 ? 'bg-[rgba(245,158,11,0.2)]' : 'bg-[rgba(167,139,250,0.1)]'
              }`}>🔍</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary mb-1 overflow-hidden text-ellipsis whitespace-nowrap">"{s.query}"</div>
                <div className="text-xs text-text-muted">
                  {s.results_count === 0 ? (
                    <span className="text-[#f59e0b] font-medium">No results</span>
                  ) : (
                    <>{s.results_count} results</>
                  )} &middot; {s.search_time_ms}ms &middot; {s.type}
                </div>
              </div>
              <div className="text-xs text-text-muted shrink-0">{formatTimeAgo(s.created_at)}</div>
            </Link>
          ))}

          {/* Learnings Tab */}
          {activeTab === 'learnings' && activity?.learnings?.map((l, i) => (
            <div key={i} className="flex items-start gap-3 py-4 border-b border-border last:border-b-0">
              <div className="text-xl shrink-0 w-8 h-8 flex items-center justify-center bg-[rgba(167,139,250,0.1)] rounded-lg">📚</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary mb-1 overflow-hidden text-ellipsis whitespace-nowrap">{l.pattern_preview}</div>
                <div className="text-xs text-text-muted">
                  {l.concepts.join(', ') || 'No concepts'} &middot; {l.source}
                </div>
              </div>
              <div className="text-xs text-text-muted shrink-0">{formatTimeAgo(l.created_at)}</div>
            </div>
          ))}

          {/* Empty States */}
          {activeTab === 'searches' && !activity?.searches?.length && (
            <div className="text-center text-text-muted py-8">No searches in this period</div>
          )}
          {activeTab === 'learnings' && !activity?.learnings?.length && (
            <div className="text-center text-text-muted py-8">No learnings added in this period</div>
          )}
        </div>
      </div>
    </div>
  );
}
