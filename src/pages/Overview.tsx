import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getStats, reflect, stripProjectPrefix } from '../api/oracle';
import type { Document, Stats } from '../api/oracle';

// Inline keyframe styles for the wisdom card animations
const wisdomAnimationStyle = `
@keyframes wisdomPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}
@keyframes orbGlow {
  0%, 100% { box-shadow: 0 0 12px rgba(167, 139, 250, 0.6), 0 0 24px rgba(167, 139, 250, 0.3); }
  50% { box-shadow: 0 0 18px rgba(167, 139, 250, 0.8), 0 0 36px rgba(167, 139, 250, 0.5); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [wisdom, setWisdom] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setConnectionError(null);
      const [statsData, wisdomData] = await Promise.all([
        getStats(),
        reflect()
      ]);
      // Verify we got valid data (not empty/error response)
      if (!statsData || (statsData.total === 0 && !statsData.by_type)) {
        setConnectionError('Backend returned empty data. Server may need restarting.');
      }
      setStats(statsData);
      // Only set wisdom if it has content (not an error response)
      if (wisdomData && 'content' in wisdomData) {
        setWisdom(wisdomData);
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
      setConnectionError('Cannot connect to Oracle backend. Run: bun run server');
    } finally {
      setLoading(false);
    }
  }

  async function refreshWisdom() {
    const data = await reflect();
    // Only set wisdom if it has content (not an error response)
    if (data && 'content' in data) {
      setWisdom(data);
    }
  }

  if (loading) {
    return <div className="text-center text-text-muted py-16">Loading...</div>;
  }

  return (
    <div className="max-w-[900px] mx-auto py-12 px-6">
      <style>{wisdomAnimationStyle}</style>

      <h1 className="text-4xl font-bold text-text-primary mb-2 text-center">Oracle Overview</h1>
      <p className="text-text-secondary text-center mb-12">Your knowledge base at a glance</p>

      {connectionError && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-lg p-4 mb-6 text-[#ef4444]">
          <strong>Connection Error:</strong> {connectionError}
          <br />
          <code className="text-xs opacity-80">
            bun run server
          </code>
        </div>
      )}

      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-8">
        <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
          <div className="text-[32px] font-bold text-accent mb-1">{stats?.total?.toLocaleString() || 0}</div>
          <div className="text-xs uppercase text-text-muted tracking-wide">Documents</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
          <div className="text-[32px] font-bold text-accent mb-1">{(stats?.by_type?.learning || 0).toLocaleString()}</div>
          <div className="text-xs uppercase text-text-muted tracking-wide">Learnings</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
          <div className="text-[32px] font-bold text-accent mb-1">{(stats?.by_type?.retro || 0).toLocaleString()}</div>
          <div className="text-xs uppercase text-text-muted tracking-wide">Retros</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
          <div className="text-[32px] font-bold text-accent mb-1">{stats?.by_type?.principle || 0}</div>
          <div className="text-xs uppercase text-text-muted tracking-wide">Principles</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
          <div className={`text-[32px] font-bold mb-1 ${stats?.is_stale ? 'text-accent' : 'text-success'}`}>
            {stats?.is_stale ? 'Stale' : 'Healthy'}
          </div>
          <div className="text-xs uppercase text-text-muted tracking-wide">Status</div>
        </div>
        {stats?.vector && (
          <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
            <div className={`text-[32px] font-bold mb-1 ${stats.vector.enabled ? 'text-success' : 'text-accent'}`}>
              {stats.vector.count.toLocaleString()}
            </div>
            <div className="text-xs uppercase text-text-muted tracking-wide">Embeddings</div>
          </div>
        )}
      </div>

      {wisdom && (
        <>
          <div
            className="relative rounded-[20px] p-[2px] mb-12 overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(167,139,250,0.2)]"
            style={{
              background: 'linear-gradient(145deg, rgba(15, 10, 25, 0.9), rgba(25, 15, 40, 0.8))',
              border: '1px solid rgba(167, 139, 250, 0.3)',
            }}
            onClick={() => setShowModal(true)}
          >
            {/* Gradient overlay */}
            <div
              className="absolute inset-0 rounded-[20px] pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), transparent 50%, rgba(139, 92, 246, 0.1))' }}
            />

            {/* Glow animation */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: '-50%', left: '-50%', width: '200%', height: '200%',
                background: 'radial-gradient(circle at 30% 30%, rgba(167, 139, 250, 0.15) 0%, transparent 50%)',
                animation: 'wisdomPulse 8s ease-in-out infinite',
              }}
            />

            {/* Inner content */}
            <div
              className="relative rounded-[18px] p-8"
              style={{ background: 'linear-gradient(180deg, rgba(20, 15, 35, 0.95), rgba(15, 10, 25, 0.98))' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[1.5px] text-[rgba(167,139,250,0.9)]">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                      animation: 'orbGlow 2s ease-in-out infinite',
                    }}
                  />
                  <span>Oracle Wisdom</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); refreshWisdom(); }}
                  className="flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-300 hover:rotate-180"
                  style={{
                    background: 'rgba(167, 139, 250, 0.1)',
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                    color: 'rgba(167, 139, 250, 0.8)',
                  }}
                  title="New wisdom"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                </button>
              </div>

              {/* Quote */}
              <div className="relative px-6">
                <span
                  className="absolute font-serif text-[64px] leading-[0] text-[rgba(167,139,250,0.2)]"
                  style={{ top: '20px', left: '-8px' }}
                >"</span>
                <p className="text-xl leading-[1.8] text-white/95 font-normal m-0 py-2" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                  {wisdom.content.length > 200
                    ? wisdom.content.slice(0, 200).trim() + '...'
                    : wisdom.content}
                </p>
                <span
                  className="absolute font-serif text-[64px] leading-[0] text-[rgba(167,139,250,0.2)]"
                  style={{ bottom: '-10px', right: '-8px' }}
                >"</span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-6 pt-5" style={{ borderTop: '1px solid rgba(167, 139, 250, 0.15)' }}>
                <div className="flex items-center gap-3">
                  <span
                    className="py-1.5 px-3.5 rounded-[20px] text-[11px] font-semibold uppercase tracking-wide text-[#c4b5fd]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.3), rgba(139, 92, 246, 0.2))',
                      border: '1px solid rgba(167, 139, 250, 0.3)',
                    }}
                  >{wisdom.type}</span>
                  {wisdom.concepts && wisdom.concepts.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {wisdom.concepts.slice(0, 4).map(c => (
                        <span
                          key={c}
                          className="py-[5px] px-3 rounded-[14px] text-[11px] text-white/60 transition-all duration-200 hover:text-white/80"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >{c}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-[rgba(167,139,250,0.6)] italic">Click to read full</span>
              </div>
            </div>
          </div>

          {showModal && (
            <div
              className="fixed inset-0 flex items-center justify-center z-[1000] p-6"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                animation: 'fadeIn 0.2s ease',
              }}
              onClick={() => setShowModal(false)}
            >
              <div
                className="w-full max-w-[700px] max-h-[80vh] flex flex-col rounded-[20px]"
                style={{
                  background: 'linear-gradient(180deg, rgba(25, 20, 40, 0.98), rgba(15, 10, 25, 0.99))',
                  border: '1px solid rgba(167, 139, 250, 0.3)',
                  animation: 'slideUp 0.3s ease',
                  boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 48px rgba(167, 139, 250, 0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-7 py-6" style={{ borderBottom: '1px solid rgba(167, 139, 250, 0.15)' }}>
                  <div className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-[1.5px] text-[rgba(167,139,250,0.9)]">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                        animation: 'orbGlow 2s ease-in-out infinite',
                      }}
                    />
                    <span>Oracle Wisdom</span>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/10 hover:text-white/90"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.6)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>

                {/* Modal content - markdown */}
                <div className="px-7 py-7 overflow-y-auto flex-1 text-white/90 text-base leading-[1.8] [&_h1]:text-[#c4b5fd] [&_h2]:text-[#c4b5fd] [&_h3]:text-[#c4b5fd] [&_h1]:mt-6 [&_h2]:mt-6 [&_h3]:mt-6 [&_h1]:mb-3 [&_h2]:mb-3 [&_h3]:mb-3 [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_p]:mb-4 [&_code]:bg-[rgba(167,139,250,0.15)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-[#e9d5ff] [&_pre]:bg-black/40 [&_pre]:border [&_pre]:border-[rgba(167,139,250,0.2)] [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px] [&_pre_code]:text-white/85 [&_ul]:my-4 [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:pl-6 [&_li]:mb-2 [&_strong]:text-[#c4b5fd] [&_a]:text-[#a78bfa] [&_a]:underline [&_blockquote]:border-l-[3px] [&_blockquote]:border-[rgba(167,139,250,0.5)] [&_blockquote]:my-4 [&_blockquote]:pl-4 [&_blockquote]:text-white/70 [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm [&_th]:border [&_th]:border-[rgba(167,139,250,0.2)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:bg-[rgba(167,139,250,0.15)] [&_th]:text-[#c4b5fd] [&_th]:font-semibold [&_th]:uppercase [&_th]:text-xs [&_th]:tracking-wide [&_td]:border [&_td]:border-[rgba(167,139,250,0.2)] [&_td]:px-4 [&_td]:py-3 [&_td]:text-left [&_tr:nth-child(even)]:bg-white/[0.02] [&_tr:hover]:bg-[rgba(167,139,250,0.08)] [&_hr]:border-none [&_hr]:border-t [&_hr]:border-[rgba(167,139,250,0.2)] [&_hr]:my-6">
                  <Markdown remarkPlugins={[remarkGfm]}>{wisdom.content}</Markdown>
                </div>

                {/* Modal footer */}
                <div className="flex flex-col gap-3 px-7 py-5" style={{ borderTop: '1px solid rgba(167, 139, 250, 0.15)' }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className="py-1.5 px-3.5 rounded-[20px] text-[11px] font-semibold uppercase tracking-wide text-[#c4b5fd]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.3), rgba(139, 92, 246, 0.2))',
                        border: '1px solid rgba(167, 139, 250, 0.3)',
                      }}
                    >{wisdom.type}</span>
                    {wisdom.concepts && wisdom.concepts.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {wisdom.concepts.map(c => (
                          <span
                            key={c}
                            className="py-[5px] px-3 rounded-[14px] text-[11px] text-white/60 transition-all duration-200 hover:text-white/80"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                          >{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {wisdom.source_file && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted">Source:</span>
                      <code
                        className="font-mono text-[11px] text-accent px-2 py-1 rounded"
                        style={{ background: 'rgba(167, 139, 250, 0.1)' }}
                      >{stripProjectPrefix(wisdom.source_file, wisdom.project)}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <h2 className="text-sm uppercase text-text-muted mb-4 tracking-wide">Quick Actions</h2>
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
          <a href="/search" className="bg-bg-card border border-border rounded-xl p-6 flex flex-col gap-2 transition-all duration-200 no-underline hover:border-accent hover:-translate-y-0.5">
            <span className="text-[28px]">🔍</span>
            <span className="text-lg font-semibold text-text-primary">Search</span>
            <span className="text-sm text-text-secondary">Find patterns and learnings</span>
          </a>
          <a href="/map" className="bg-bg-card border border-border rounded-xl p-6 flex flex-col gap-2 transition-all duration-200 no-underline hover:border-accent hover:-translate-y-0.5">
            <span className="text-[28px]">🗺️</span>
            <span className="text-lg font-semibold text-text-primary">Memory</span>
            <span className="text-sm text-text-secondary">Visualize knowledge</span>
          </a>
          <a href="/playground" className="bg-bg-card border border-border rounded-xl p-6 flex flex-col gap-2 transition-all duration-200 no-underline hover:border-accent hover:-translate-y-0.5">
            <span className="text-[28px]">🧪</span>
            <span className="text-lg font-semibold text-text-primary">Playground</span>
            <span className="text-sm text-text-secondary">Compare search modes</span>
          </a>
        </div>
      </div>
    </div>
  );
}
