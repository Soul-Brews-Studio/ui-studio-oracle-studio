import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { SidebarLayout, TOOLS_NAV } from '../components/SidebarLayout';

interface HandoffFile {
  filename: string;
  path: string;
  created: string;
  preview: string;
  type: string;
}

export function Handoff() {
  const [files, setFiles] = useState<HandoffFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    loadInbox();
  }, []);

  async function loadInbox() {
    setLoading(true);
    try {
      const res = await fetch('/api/inbox?limit=50');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to load inbox:', e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(file: HandoffFile) {
    if (expanded === file.filename) {
      setExpanded(null);
      setFullContent(null);
      return;
    }

    setExpanded(file.filename);
    setFullContent(null);
    setLoadingContent(true);

    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const text = await res.text();
        setFullContent(text);
      } else {
        setFullContent(file.preview);
      }
    } catch {
      setFullContent(file.preview);
    } finally {
      setLoadingContent(false);
    }
  }

  function formatDate(created: string): string {
    if (created === 'unknown') return 'Unknown date';
    try {
      return new Date(created).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return created;
    }
  }

  function extractTitle(preview: string): string {
    // Try to get first heading or first line
    const headingMatch = preview.match(/^#\s+(.+)$/m);
    if (headingMatch) return headingMatch[1];
    const firstLine = preview.split('\n').find(l => l.trim().length > 0);
    return firstLine?.substring(0, 80) || 'Untitled handoff';
  }

  return (
    <SidebarLayout navItems={TOOLS_NAV} navTitle="Tools" filters={[]}>
      <h1 className="text-[32px] font-bold text-text-primary mb-2">Inbox</h1>
      <p className="text-text-secondary mb-8">
        Session handoffs from <code className="bg-bg-card px-1.5 py-0.5 rounded text-[13px]">oracle_handoff()</code>
      </p>

      {loading ? (
        <div className="text-text-muted py-12 text-center">Loading inbox...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 text-text-secondary">
          <p className="my-2">No handoffs yet.</p>
          <p className="text-sm text-text-muted my-2">
            Use <code className="bg-bg-card px-1.5 py-0.5 rounded text-[13px]">oracle_handoff(content)</code> to save session context for future sessions.
          </p>
        </div>
      ) : (
        <>
          <div className="text-text-muted text-sm mb-4">
            {total} handoff{total !== 1 ? 's' : ''}
          </div>

          <div className="flex flex-col gap-2">
            {files.map(file => (
              <div
                key={file.filename}
                className="bg-bg-card border border-border rounded-xl overflow-hidden transition-colors duration-200 hover:border-accent"
              >
                <div
                  className="px-5 py-4 cursor-pointer"
                  onClick={() => toggleExpand(file)}
                >
                  <div className="text-[15px] font-medium text-text-primary mb-1.5">
                    {extractTitle(file.preview)}
                  </div>
                  <div className="flex gap-4 text-xs text-text-muted max-sm:flex-col max-sm:gap-1">
                    <span className="text-accent">{formatDate(file.created)}</span>
                    <span className="font-mono text-[11px]">{file.filename}</span>
                  </div>
                </div>

                {expanded === file.filename && (
                  <div className="border-t border-border p-5">
                    {loadingContent ? (
                      <div className="text-text-muted py-12 text-center">Loading...</div>
                    ) : (
                      <div className="leading-[1.7] text-text-primary text-sm prose-handoff">
                        <Markdown>{fullContent || file.preview}</Markdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </SidebarLayout>
  );
}
