import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SidebarLayout, TOOLS_NAV } from '../components/SidebarLayout';
import { getDocDisplayInfo } from '../utils/docDisplay';
import { Spinner } from '../components/ui/Spinner';
import { API_BASE } from '../api/oracle';

interface TraceSummary {
  traceId: string;
  query: string;
  depth: number;
  fileCount: number;
  commitCount: number;
  issueCount: number;
  status: 'raw' | 'reviewed' | 'distilled';
  hasAwakening: boolean;
  createdAt: number;
  parentTraceId?: string | null;
  prevTraceId?: string | null;
  nextTraceId?: string | null;
}

interface TraceDetail {
  traceId: string;
  query: string;
  queryType: string;
  project: string | null;
  foundFiles: Array<{ path: string; type?: string; confidence?: string; matchReason?: string }>;
  foundCommits: Array<{ hash: string; shortHash?: string; message: string; date?: string }>;
  foundIssues: Array<{ number: number; title: string; state?: string; url?: string }>;
  foundRetrospectives: string[];
  foundLearnings: string[];
  fileCount: number;
  commitCount: number;
  issueCount: number;
  depth: number;
  parentTraceId: string | null;
  childTraceIds: string[];
  prevTraceId: string | null;
  nextTraceId: string | null;
  status: string;
  awakening: string | null;
  createdAt: number;
}

interface TracesResponse {
  traces: TraceSummary[];
  total: number;
  hasMore: boolean;
}

const TRACE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'raw', label: 'Raw' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'distilled', label: 'Distilled' },
];

export function Traces() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileGithubUrl, setFileGithubUrl] = useState<string | null>(null);
  const [fileConcepts, setFileConcepts] = useState<string[]>([]);
  const [fileProject, setFileProject] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [linkedChain, setLinkedChain] = useState<TraceDetail[]>([]);
  const [chainPosition, setChainPosition] = useState(0);
  const [familyChain, setFamilyChain] = useState<TraceDetail[]>([]);
  const [familyPosition, setFamilyPosition] = useState(0);

  useEffect(() => {
    if (id) {
      loadTraceDetail(id);
      // Only reload linked chain if this trace isn't already in current chain
      const inCurrentChain = linkedChain.some(t => t.traceId === id);
      if (!inCurrentChain) {
        loadLinkedChain(id);
      } else {
        // Update position within existing chain
        const newPosition = linkedChain.findIndex(t => t.traceId === id);
        if (newPosition !== -1) setChainPosition(newPosition);
      }
      // Check family chain too
      const inFamilyChain = familyChain.some(t => t.traceId === id);
      if (!inFamilyChain) {
        loadFamilyChain(id);
      } else {
        const newFamilyPos = familyChain.findIndex(t => t.traceId === id);
        if (newFamilyPos !== -1) setFamilyPosition(newFamilyPos);
      }
    } else {
      loadTraces();
      setLinkedChain([]);
      setFamilyChain([]);
    }
  }, [id, statusFilter]);

  async function loadTraces() {
    setLoading(true);
    setSelectedTrace(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${API_BASE}/traces?${params}`);
      const data: TracesResponse = await res.json();
      setTraces(data.traces);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load traces:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTraceDetail(traceId: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/traces/${traceId}`);
      if (!res.ok) {
        navigate('/traces');
        return;
      }
      const data: TraceDetail = await res.json();
      setSelectedTrace(data);
    } catch (err) {
      console.error('Failed to load trace detail:', err);
      navigate('/traces');
    } finally {
      setLoading(false);
    }
  }

  async function loadLinkedChain(traceId: string) {
    try {
      const res = await fetch(`${API_BASE}/traces/${traceId}/linked-chain`);
      if (res.ok) {
        const data = await res.json();
        setLinkedChain(data.chain || []);
        setChainPosition(data.position || 0);
      }
    } catch (err) {
      console.error('Failed to load linked chain:', err);
      setLinkedChain([]);
    }
  }

  async function loadFamilyChain(traceId: string) {
    try {
      // Fetch current trace to get parent/children info
      const res = await fetch(`${API_BASE}/traces/${traceId}`);
      if (!res.ok) return;
      const current: TraceDetail = await res.json();

      const family: TraceDetail[] = [];

      // Fetch parent if exists
      if (current.parentTraceId) {
        const parentRes = await fetch(`${API_BASE}/traces/${current.parentTraceId}`);
        if (parentRes.ok) {
          const parent: TraceDetail = await parentRes.json();
          family.push(parent);
        }
      }

      // Add current
      family.push(current);

      // Fetch children
      if (current.childTraceIds && current.childTraceIds.length > 0) {
        for (const childId of current.childTraceIds) {
          const childRes = await fetch(`${API_BASE}/traces/${childId}`);
          if (childRes.ok) {
            const child: TraceDetail = await childRes.json();
            family.push(child);
          }
        }
      }

      // Also check if current is a child and has siblings
      if (current.parentTraceId) {
        const parentRes = await fetch(`${API_BASE}/traces/${current.parentTraceId}`);
        if (parentRes.ok) {
          const parent: TraceDetail = await parentRes.json();
          // Add siblings (other children of parent)
          for (const siblingId of parent.childTraceIds || []) {
            if (siblingId !== traceId && !family.some(f => f.traceId === siblingId)) {
              const sibRes = await fetch(`${API_BASE}/traces/${siblingId}`);
              if (sibRes.ok) {
                const sibling: TraceDetail = await sibRes.json();
                family.push(sibling);
              }
            }
          }
        }
      }

      // Sort by createdAt
      family.sort((a, b) => a.createdAt - b.createdAt);
      const finalPosition = family.findIndex(f => f.traceId === traceId);

      setFamilyChain(family);
      setFamilyPosition(finalPosition >= 0 ? finalPosition : 0);
    } catch (err) {
      console.error('Failed to load family chain:', err);
      setFamilyChain([]);
    }
  }

  async function toggleFilePreview(path: string, project: string | null) {
    if (expandedFile === path) {
      setExpandedFile(null);
      setFileContent(null);
      setFileGithubUrl(null);
      setFileConcepts([]);
      setFileProject(null);
      return;
    }

    setExpandedFile(path);
    setFileContent(null);
    setFileGithubUrl(null);
    setFileConcepts([]);
    setFileProject(project);
    setLoadingFile(true);

    // Always compute GitHub URL if project available
    let ghUrl: string | null = null;
    if (project) {
      const isRepoRef = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(path);
      if (isRepoRef) {
        ghUrl = `https://github.com/${path}`;
      } else {
        const ghProject = project.includes('github.com') ? project : `github.com/${project}`;
        ghUrl = `https://${ghProject}/blob/main/${path}`;
      }
      setFileGithubUrl(ghUrl);
    }

    try {
      // First try direct file read
      const params = new URLSearchParams({ path });
      if (project) params.set('project', project);
      const res = await fetch(`${API_BASE}/file?${params}`);
      if (res.ok) {
        const text = await res.text();
        if (text && !text.startsWith('File not found')) {
          setFileContent(text);
          return;
        }
      }

      // Search Oracle for related content (use last part of path or repo name)
      const searchTerm = path.split('/').pop()?.replace('.md', '') || path.split('/').slice(-1)[0] || '';
      const searchRes = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchTerm)}&limit=1`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.results?.[0]) {
          if (searchData.results[0].content) {
            setFileContent(searchData.results[0].content);
          }
          if (searchData.results[0].concepts) {
            setFileConcepts(searchData.results[0].concepts);
          }
          return;
        }
      }

      // Also try searching for the full path/repo name
      if (!fileConcepts.length) {
        const repoName = path.replace(/\//g, ' ');
        const repoSearchRes = await fetch(`${API_BASE}/search?q=${encodeURIComponent(repoName)}&limit=1`);
        if (repoSearchRes.ok) {
          const repoData = await repoSearchRes.json();
          if (repoData.results?.[0]?.concepts) {
            setFileConcepts(repoData.results[0].concepts);
          }
        }
      }

      // Not found locally - content stays null, GitHub URL already set
      setFileContent(null);
    } catch {
      setFileContent('Failed to load file');
    } finally {
      setLoadingFile(false);
    }
  }

  // Group traces by date
  const grouped = traces.reduce((acc, t) => {
    const date = new Date(t.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(t);
    return acc;
  }, {} as Record<string, TraceSummary[]>);

  function getStatusBadge(status: string, hasAwakening: boolean) {
    if (hasAwakening) return (
      <span className="text-[11px] px-2.5 py-1 rounded-xl uppercase font-semibold tracking-wide" style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' }}>awakened</span>
    );
    switch (status) {
      case 'distilled': return (
        <span className="text-[11px] px-2.5 py-1 rounded-xl uppercase font-semibold tracking-wide" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>distilled</span>
      );
      case 'reviewed': return (
        <span className="text-[11px] px-2.5 py-1 rounded-xl uppercase font-semibold tracking-wide" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>reviewed</span>
      );
      default: return (
        <span className="text-[11px] px-2.5 py-1 rounded-xl uppercase font-semibold tracking-wide" style={{ background: 'rgba(100, 100, 100, 0.2)', color: '#666' }}>raw</span>
      );
    }
  }

  function getDigPointsPreview(t: TraceSummary) {
    const parts: string[] = [];
    if (t.fileCount > 0) parts.push(`${t.fileCount} files`);
    if (t.commitCount > 0) parts.push(`${t.commitCount} commits`);
    if (t.issueCount > 0) parts.push(`${t.issueCount} issues`);
    return parts.length > 0 ? parts.join(' · ') : 'no dig points';
  }

  // Render file preview section (shared between main trace and linked traces)
  function renderFilePreview(path: string, project: string | null, f?: { confidence?: string; matchReason?: string }) {
    return (
      <li key={path} className="flex flex-col">
        <div
          className={`flex items-center gap-3 flex-wrap cursor-pointer py-2 px-3 -my-2 -mx-3 rounded-md transition-colors duration-200 hover:bg-[rgba(167,139,250,0.1)] ${expandedFile === path ? 'bg-[rgba(167,139,250,0.15)]' : ''}`}
          onClick={() => toggleFilePreview(path, project)}
        >
          <span className="font-mono text-[13px] text-accent break-all transition-colors duration-200 hover:text-text-primary">{path}</span>
          {f?.confidence && (
            <span className="text-[11px] py-0.5 px-2 rounded" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>{f.confidence}</span>
          )}
          {f?.matchReason && (
            <span className="text-xs text-text-muted italic">{f.matchReason}</span>
          )}
        </div>
        {expandedFile === path && (
          <div className="mt-3 bg-[rgba(0,0,0,0.3)] rounded-lg overflow-hidden">
            {loadingFile ? (
              <div className="p-4 text-text-muted italic">Loading...</div>
            ) : (
              <>
                {(fileGithubUrl || project) && (
                  <div className="py-2 px-4 flex items-center gap-4 text-text-muted border-t border-white/10">
                    {fileGithubUrl && (
                      <a
                        href={fileGithubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] py-2 px-4 rounded-md no-underline transition-all duration-200"
                        style={{ background: 'rgba(167, 139, 250, 0.2)', color: '#64b5f6' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.3)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.2)'; e.currentTarget.style.color = '#64b5f6'; }}
                      >
                        View on GitHub →
                      </a>
                    )}
                    {(() => {
                      const sourceFile = project
                        ? `${project.includes('github.com') ? '' : 'github.com/'}${project}/${path}`
                        : path;
                      const fInfo = getDocDisplayInfo(sourceFile, project);
                      return fInfo.vaultUrl ? (
                        <a
                          href={fInfo.vaultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-medium py-0.5 px-2 rounded no-underline transition-all duration-200"
                          style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52, 211, 153, 0.2)'; e.currentTarget.style.color = '#6ee7b7'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52, 211, 153, 0.1)'; e.currentTarget.style.color = '#34d399'; }}
                        >
                          🏛️ vault
                        </a>
                      ) : null;
                    })()}
                  </div>
                )}
                {fileConcepts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 py-2.5 px-4 border-b border-white/10 bg-[rgba(0,0,0,0.2)]">
                    <span className="text-[11px] text-text-muted mr-1">Related:</span>
                    {fileConcepts.map((c, j) => (
                      <span key={j} className="text-[11px] py-0.5 px-2.5 rounded-xl font-medium" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>{c}</span>
                    ))}
                  </div>
                )}
                {fileContent ? (
                  <pre className="p-4 m-0 font-mono text-xs leading-normal text-text-secondary whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">{fileContent}</pre>
                ) : (
                  <div className="py-3 px-4 text-text-muted italic text-[13px]">
                    ⚠️ local file not found
                    {fileProject && (
                      <div className="mt-2 not-italic font-mono text-xs text-accent inline-block py-1 px-2.5 rounded" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
                        📦 Source: {fileProject}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </li>
    );
  }

  // Render a dig points section (shared between main trace and linked traces)
  function renderDigPoints(trace: TraceDetail, isLinked = false) {
    return (
      <div className="flex flex-col gap-8">
        {trace.foundFiles?.length > 0 && (
          <section className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm text-accent mb-5 uppercase tracking-wide">Files ({trace.foundFiles.length})</h3>
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {trace.foundFiles.map((f, i) => (
                isLinked ? (
                  <li key={i} className="flex flex-col">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-[13px] text-accent break-all">{f.path}</span>
                      {f.confidence && (
                        <span className="text-[11px] py-0.5 px-2 rounded" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>{f.confidence}</span>
                      )}
                      {f.matchReason && (
                        <span className="text-xs text-text-muted italic">{f.matchReason}</span>
                      )}
                    </div>
                  </li>
                ) : renderFilePreview(f.path, trace.project, f)
              ))}
            </ul>
          </section>
        )}

        {trace.foundCommits?.length > 0 && (
          <section className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm text-accent mb-5 uppercase tracking-wide">Commits ({trace.foundCommits.length})</h3>
            {trace.project && (
              <div className="text-xs text-text-muted mb-3 font-mono">{trace.project}</div>
            )}
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {trace.foundCommits.map((c, i) => {
                const repoMatch = c.message?.match(/^([a-zA-Z0-9_-]+):\s/);
                const org = trace.project?.split('/')[0] || 'LarisLabs';
                let targetProject = trace.project;
                if (repoMatch) {
                  targetProject = `${org}/${repoMatch[1]}`;
                }
                const ghProject = targetProject?.includes('github.com') ? targetProject : `github.com/${targetProject}`;
                const commitUrl = targetProject ? `https://${ghProject}/commit/${c.hash}` : null;
                const displayHash = c.shortHash || c.hash?.slice(0, 7);
                return (
                  <li key={i} className="flex items-start gap-3">
                    {commitUrl ? (
                      <a
                        href={commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs py-1 px-2 rounded text-accent no-underline shrink-0 transition-all duration-200 hover:text-white"
                        style={{ background: 'rgba(167, 139, 250, 0.15)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.15)'; }}
                      >
                        {displayHash}
                      </a>
                    ) : (
                      <code className="font-mono text-xs py-1 px-2 rounded text-accent shrink-0" style={{ background: 'rgba(167, 139, 250, 0.15)' }}>
                        {displayHash}
                      </code>
                    )}
                    <span className="text-sm text-text-primary flex-1">{c.message}</span>
                    {c.date && <span className="text-xs text-text-muted shrink-0">{c.date}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {trace.foundIssues?.length > 0 && (
          <section className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm text-accent mb-5 uppercase tracking-wide">Issues ({trace.foundIssues.length})</h3>
            {trace.project && (
              <div className="text-xs text-text-muted mb-3 font-mono">{trace.project}</div>
            )}
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {trace.foundIssues.map((issue, i) => {
                const issueUrl = issue.url || (trace.project ? `https://${trace.project}/issues/${issue.number}` : null);
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span
                      className="font-mono text-xs py-1 px-2 rounded shrink-0"
                      style={issue.state === 'open'
                        ? { background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }
                        : { background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }
                      }
                    >
                      #{issue.number}
                    </span>
                    {issueUrl ? (
                      <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-text-primary no-underline hover:text-accent hover:underline">
                        {issue.title}
                      </a>
                    ) : (
                      <span className="text-sm text-text-primary">{issue.title}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {!isLinked && trace.foundRetrospectives?.length > 0 && (
          <section className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm text-accent mb-5 uppercase tracking-wide">Retrospectives ({trace.foundRetrospectives.length})</h3>
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {trace.foundRetrospectives.map((path, i) => (
                <li key={i} className="flex flex-col">
                  <div
                    className={`flex items-center gap-3 flex-wrap cursor-pointer py-2 px-3 -my-2 -mx-3 rounded-md transition-colors duration-200 hover:bg-[rgba(167,139,250,0.1)] ${expandedFile === path ? 'bg-[rgba(167,139,250,0.15)]' : ''}`}
                    onClick={() => toggleFilePreview(path, null)}
                  >
                    <span className="font-mono text-[13px] text-accent break-all">{path}</span>
                  </div>
                  {expandedFile === path && (
                    <div className="mt-3 bg-[rgba(0,0,0,0.3)] rounded-lg overflow-hidden">
                      {loadingFile ? (
                        <div className="p-4 text-text-muted italic">Loading...</div>
                      ) : (
                        <>
                          {fileContent ? (
                            <pre className="p-4 m-0 font-mono text-xs leading-normal text-text-secondary whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">{fileContent}</pre>
                          ) : (
                            <div className="py-3 px-4 text-text-muted italic text-[13px]">Retrospective not found</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isLinked && trace.foundLearnings?.length > 0 && (
          <section className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm text-accent mb-5 uppercase tracking-wide">Learnings ({trace.foundLearnings.length})</h3>
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {trace.foundLearnings.map((item, i) => {
                const isFilePath = item.startsWith('ψ/') || item.includes('/memory/');
                if (!isFilePath) {
                  return (
                    <li key={i} className="py-2.5 px-3.5 rounded text-[13px] text-text-primary mb-2 border-l-[3px] border-l-accent" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>{item}</li>
                  );
                }
                return renderFilePreview(item, trace.project);
              })}
            </ul>
          </section>
        )}
      </div>
    );
  }

  // Detail view
  if (selectedTrace) {
    const t = selectedTrace;
    const totalDigPoints = t.fileCount + t.commitCount + t.issueCount +
      t.foundRetrospectives.length + t.foundLearnings.length;

    return (
      <SidebarLayout
        navItems={TOOLS_NAV}
        navTitle="Tools"
        filters={TRACE_FILTERS}
        filterTitle="Filter by Status"
        activeType={statusFilter}
        onTypeChange={setStatusFilter}
      >
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate('/traces')}
            className="inline-block bg-none border-none text-text-secondary text-sm cursor-pointer p-0 transition-colors duration-200 hover:text-accent"
          >
            ← Back to Traces
          </button>
          <div className="flex items-center gap-2">
            {/* Use linked chain if available, otherwise use family chain */}
            {(() => {
              const chain = linkedChain.length > 1 ? linkedChain : familyChain;
              const position = linkedChain.length > 1 ? chainPosition : familyPosition;

              if (chain.length <= 1) return null;

              return (
                <>
                  {position > 0 ? (
                    <button
                      onClick={() => navigate(`/traces/${chain[0].traceId}`)}
                      className="py-1.5 px-3 rounded-md text-[13px] text-accent border border-accent cursor-pointer transition-all duration-200 hover:bg-accent hover:text-white"
                      style={{ background: 'rgba(167, 139, 250, 0.15)' }}
                      title="First"
                    >
                      ⏮
                    </button>
                  ) : (
                    <span className="text-text-muted py-1.5 px-3 text-[13px] opacity-50">⏮</span>
                  )}
                  {position > 0 ? (
                    <button
                      onClick={() => navigate(`/traces/${chain[position - 1].traceId}`)}
                      className="py-1.5 px-3 rounded-md text-[13px] text-accent border border-accent cursor-pointer transition-all duration-200 hover:bg-accent hover:text-white"
                      style={{ background: 'rgba(167, 139, 250, 0.15)' }}
                      title="Previous"
                    >
                      ←
                    </button>
                  ) : (
                    <span className="text-text-muted py-1.5 px-3 text-[13px] opacity-50">←</span>
                  )}
                  <div className="flex gap-1">
                    {chain.map((trace, i) => (
                      <button
                        key={trace.traceId}
                        onClick={() => navigate(`/traces/${trace.traceId}`)}
                        className={`w-7 h-7 rounded-md border text-[13px] font-medium cursor-pointer transition-all duration-200 ${
                          i === position
                            ? 'bg-accent border-accent text-white cursor-default'
                            : 'bg-transparent border-border text-text-secondary hover:border-accent hover:text-accent'
                        }`}
                        title={trace.query}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  {position < chain.length - 1 ? (
                    <button
                      onClick={() => navigate(`/traces/${chain[position + 1].traceId}`)}
                      className="py-1.5 px-3 rounded-md text-[13px] text-accent border border-accent cursor-pointer transition-all duration-200 hover:bg-accent hover:text-white"
                      style={{ background: 'rgba(167, 139, 250, 0.15)' }}
                      title="Next"
                    >
                      →
                    </button>
                  ) : (
                    <span className="text-text-muted py-1.5 px-3 text-[13px] opacity-50">→</span>
                  )}
                  {position < chain.length - 1 ? (
                    <button
                      onClick={() => navigate(`/traces/${chain[chain.length - 1].traceId}`)}
                      className="py-1.5 px-3 rounded-md text-[13px] text-accent border border-accent cursor-pointer transition-all duration-200 hover:bg-accent hover:text-white"
                      style={{ background: 'rgba(167, 139, 250, 0.15)' }}
                      title="Last"
                    >
                      ⏭
                    </button>
                  ) : (
                    <span className="text-text-muted py-1.5 px-3 text-[13px] opacity-50">⏭</span>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div className="mb-8 pb-6 border-b border-border">
          <h1 className="text-[28px] font-semibold text-text-primary mb-4 leading-snug">"{t.query}"</h1>
          <div className="flex items-center gap-4 flex-wrap">
            {getStatusBadge(t.status, !!t.awakening)}
            <span className="text-xs text-text-muted bg-bg-card py-1 px-2.5 rounded">{t.queryType}</span>
            {(() => {
              const tInfo = getDocDisplayInfo('', t.project);
              return tInfo.projectVaultUrl ? (
                <a
                  href={tInfo.projectVaultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-text-secondary font-mono py-1 px-2.5 rounded no-underline transition-all duration-200 hover:text-accent"
                  style={{ background: 'rgba(167, 139, 250, 0.1)' }}
                  onClick={e => e.stopPropagation()}
                >
                  🔗 {tInfo.projectDisplay}
                </a>
              ) : (
                <span className="text-[11px] font-medium py-0.5 px-2 rounded" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>✦ universal</span>
              );
            })()}
            <span className="text-xs text-text-muted">
              {new Date(t.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        {t.awakening && (
          <div className="rounded-xl p-6 mb-8" style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
            <h3 className="text-sm mb-3 uppercase tracking-wide" style={{ color: '#fbbf24' }}>Awakening</h3>
            <p className="text-text-primary leading-relaxed">{t.awakening}</p>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-text-secondary mb-8">
          <span>{totalDigPoints} dig points found</span>
          {t.depth > 0 && (
            <span className="py-0.5 px-2 rounded text-accent" style={{ background: 'rgba(167, 139, 250, 0.15)' }}>depth: {t.depth}</span>
          )}
        </div>

        {renderDigPoints(t)}

        {totalDigPoints === 0 && (
          <div className="text-center p-12 text-text-muted bg-bg-card border border-border rounded-xl">
            No dig points recorded for this trace.
          </div>
        )}

        {/* Linked Traces - Full Content */}
        {linkedChain.filter(trace => trace.traceId !== t.traceId).map((trace) => (
          <div key={trace.traceId} className="mt-12 pt-8 border-t-2 border-t-accent">
            <div className="mb-6">
              <button
                className="bg-none border-none p-0 text-xs font-semibold text-accent uppercase tracking-wider cursor-pointer transition-opacity duration-200 hover:opacity-70 hover:underline mb-2 block"
                onClick={() => navigate(`/traces/${trace.traceId}`)}
              >
                {trace.traceId === t.prevTraceId ? '← Previous' : 'Next →'}
              </button>
              <h2 className="text-[22px] font-semibold text-text-primary mb-3 leading-snug">"{trace.query}"</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-text-muted bg-bg-card py-1 px-2.5 rounded">{trace.queryType}</span>
                {(() => {
                  const ltInfo = getDocDisplayInfo('', trace.project);
                  return ltInfo.projectVaultUrl ? (
                    <a
                      href={ltInfo.projectVaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-secondary font-mono py-1 px-2.5 rounded no-underline transition-all duration-200 hover:text-accent"
                      style={{ background: 'rgba(167, 139, 250, 0.1)' }}
                    >
                      🔗 {ltInfo.projectDisplay}
                    </a>
                  ) : (
                    <span className="text-[11px] font-medium py-0.5 px-2 rounded" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>✦ universal</span>
                  );
                })()}
                <span className="text-xs text-text-muted">
                  {new Date(trace.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {renderDigPoints(trace, true)}
          </div>
        ))}

      </SidebarLayout>
    );
  }

  // List view
  return (
    <SidebarLayout
      filters={TRACE_FILTERS}
      filterTitle="Filter by Status"
      activeType={statusFilter}
      onTypeChange={setStatusFilter}
    >
      <h1 className="text-[32px] font-semibold text-text-primary mb-3">Discovery Traces</h1>
      <p className="text-text-secondary text-base mb-8">
        Your discovery journeys — what you searched and found
        <span className="block mt-2 italic text-accent text-sm">"Trace → Dig → Distill → Awakening"</span>
      </p>

      {loading ? (
        <div className="text-center py-20 px-6 text-text-muted flex flex-col items-center gap-3">
          <Spinner size="md" />
          Loading traces...
        </div>
      ) : traces.length === 0 ? (
        <div className="text-center py-20 px-6 text-text-muted">
          <p>No traces recorded yet.</p>
          <p className="mt-4 text-sm">
            Use <code className="py-1 px-2 rounded text-accent" style={{ background: 'rgba(167, 139, 250, 0.15)' }}>/trace</code> or <code className="py-1 px-2 rounded text-accent" style={{ background: 'rgba(167, 139, 250, 0.15)' }}>oracle_trace()</code> to log discoveries.
          </p>
        </div>
      ) : (
        <>
          <div className="text-text-muted text-sm mb-8 pb-4 border-b border-border">
            <span>{total} trace{total !== 1 ? 's' : ''} logged</span>
          </div>

          <div className="flex flex-col gap-10">
            {Object.entries(grouped).map(([date, items]) => {
              // Separate root traces and children
              const roots = items.filter(t => t.depth === 0 || !t.parentTraceId);
              const children = items.filter(t => t.depth > 0 && t.parentTraceId);

              // Build tree: each root with its children
              const tree = roots.map(root => ({
                root,
                children: children.filter(c => c.parentTraceId === root.traceId)
              }));

              // Add orphan children (parent not in this date group)
              const assignedChildren = new Set(tree.flatMap(t => t.children.map(c => c.traceId)));
              const orphans = children.filter(c => !assignedChildren.has(c.traceId));

              return (
                <div key={date} className="flex flex-col gap-5">
                  <h2 className="text-sm font-semibold text-accent uppercase tracking-wide">{date}</h2>
                  <div className="flex flex-col gap-4">
                    {tree.map(({ root, children }) => (
                      <div key={root.traceId} className="flex flex-col">
                        {/* Parent trace */}
                        <div
                          className="bg-bg-card border border-border rounded-xl py-5 px-6 cursor-pointer transition-all duration-200 hover:border-accent hover:bg-[rgba(167,139,250,0.05)]"
                          onClick={() => navigate(`/traces/${root.traceId}`)}
                        >
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <span className="text-base text-text-primary font-medium">"{root.query}"</span>
                            {getStatusBadge(root.status, root.hasAwakening)}
                          </div>
                          <div className="text-sm text-text-secondary mb-3">
                            {getDigPointsPreview(root)}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-text-muted">
                            <code className="text-[11px] text-text-muted py-0.5 px-1.5 rounded" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>{root.traceId.slice(0, 8)}</code>
                            {(root.prevTraceId || root.nextTraceId) && (
                              <span className="text-[11px] text-accent py-0.5 px-2 rounded" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
                                {root.prevTraceId && '←'}
                                {root.prevTraceId && root.nextTraceId ? ' linked ' : root.prevTraceId ? ' first' : ''}
                                {root.nextTraceId && '→'}
                                {!root.nextTraceId && root.prevTraceId && ' last'}
                              </span>
                            )}
                            <span className="text-text-muted">
                              {new Date(root.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        {/* Children traces */}
                        {children.length > 0 && (
                          <div className="ml-6 pl-4 border-l-2 border-l-border flex flex-col gap-3 -mt-1 pt-3">
                            {children.map(child => (
                              <div
                                key={child.traceId}
                                className="bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)] rounded-xl py-5 px-6 cursor-pointer transition-all duration-200 hover:border-accent hover:bg-[rgba(167,139,250,0.05)]"
                                onClick={() => navigate(`/traces/${child.traceId}`)}
                              >
                                <div className="flex items-center justify-between gap-4 mb-3">
                                  <div>
                                    <span className="text-accent mr-2 font-semibold">↳</span>
                                    <span className="text-base text-text-primary font-medium">"{child.query}"</span>
                                  </div>
                                  {getStatusBadge(child.status, child.hasAwakening)}
                                </div>
                                <div className="text-sm text-text-secondary mb-3">
                                  {getDigPointsPreview(child)}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-text-muted">
                                  <code className="text-[11px] text-text-muted py-0.5 px-1.5 rounded" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>{child.traceId.slice(0, 8)}</code>
                                  <span className="py-0.5 px-2 rounded text-accent" style={{ background: 'rgba(167, 139, 250, 0.15)' }}>depth {child.depth}</span>
                                  {(child.prevTraceId || child.nextTraceId) && (
                                    <span className="text-[11px] text-accent py-0.5 px-2 rounded" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
                                      {child.prevTraceId && '←'}
                                      {child.nextTraceId && '→'}
                                      {!child.nextTraceId && child.prevTraceId && ' last'}
                                    </span>
                                  )}
                                  <span className="text-text-muted">
                                    {new Date(child.createdAt).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Orphan children (parent in different date) */}
                    {orphans.map(orphan => (
                      <div
                        key={orphan.traceId}
                        className="bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)] rounded-xl py-5 px-6 cursor-pointer transition-all duration-200 hover:border-accent hover:bg-[rgba(167,139,250,0.05)]"
                        onClick={() => navigate(`/traces/${orphan.traceId}`)}
                      >
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div>
                            <span className="text-accent mr-2 font-semibold">↳</span>
                            <span className="text-base text-text-primary font-medium">"{orphan.query}"</span>
                          </div>
                          {getStatusBadge(orphan.status, orphan.hasAwakening)}
                        </div>
                        <div className="text-sm text-text-secondary mb-3">
                          {getDigPointsPreview(orphan)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-muted">
                          <span className="py-0.5 px-2 rounded text-accent" style={{ background: 'rgba(167, 139, 250, 0.15)' }}>depth {orphan.depth}</span>
                          <span className="text-text-muted">
                            {new Date(orphan.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </SidebarLayout>
  );
}
