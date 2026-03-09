import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { list, getFile, getDoc } from '../api/oracle';
import type { Document } from '../api/oracle';
import { SidebarLayout } from '../components/SidebarLayout';
import { getDocDisplayInfo } from '../utils/docDisplay';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

interface LocationState {
  doc?: Document;
  docs?: Document[];
  currentIndex?: number;
}

export function DocDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [doc, setDoc] = useState<Document | null>(null);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<{ prev: Document | null; next: Document | null }>({ prev: null, next: null });
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawContent, setRawContent] = useState<string | null>(null);


  // Navigate to a document
  const goToDoc = useCallback((targetDoc: Document) => {
    navigate(`/doc/${encodeURIComponent(targetDoc.id)}`, { state: { doc: targetDoc } });
  }, [navigate]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'j' && neighbors.next) {
        goToDoc(neighbors.next);
      } else if (e.key === 'k' && neighbors.prev) {
        goToDoc(neighbors.prev);
      } else if (e.key === 'u') {
        navigate(-1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [neighbors, goToDoc, navigate]);

  // Load full content from file
  useEffect(() => {
    async function loadFullContent() {
      if (!doc?.source_file) return;

      try {
        const fileData = await getFile(doc.source_file, doc.project);
        if (fileData.error) {
          setFileNotFound(true);
        } else if (fileData.content) {
          setFullContent(fileData.content);
          setFileNotFound(false);
        }
      } catch (e) {
        console.error('Failed to load full content:', e);
        setFileNotFound(true);
      }
    }

    setFullContent(null); // Reset when doc changes
    setFileNotFound(false);
    loadFullContent();
  }, [doc]);

  // Load neighbors (prev/next documents)
  useEffect(() => {
    async function loadNeighbors() {
      if (!doc) return;

      try {
        // Check if docs list was passed via state
        const state = location.state as LocationState;
        if (state?.docs && state.currentIndex !== undefined) {
          const idx = state.currentIndex;
          setNeighbors({
            prev: idx > 0 ? state.docs[idx - 1] : null,
            next: idx < state.docs.length - 1 ? state.docs[idx + 1] : null
          });
          return;
        }

        // Otherwise fetch from API
        const data = await list(doc.type, 100, 0);
        const idx = data.results.findIndex(d => d.id === doc.id);
        if (idx !== -1) {
          setNeighbors({
            prev: idx > 0 ? data.results[idx - 1] : null,
            next: idx < data.results.length - 1 ? data.results[idx + 1] : null
          });
        }
      } catch (e) {
        console.error('Failed to load neighbors:', e);
      }
    }

    loadNeighbors();
  }, [doc, location.state]);

  useEffect(() => {
    // Check if document was passed via router state
    const state = location.state as LocationState;
    if (state?.doc) {
      // Use cached doc for instant display
      setDoc(state.doc);
      setLoading(false);
      // But always fetch fresh to get latest data (e.g., project field for GitHub link)
      loadDoc();
      return;
    }

    // Otherwise, search for the document
    loadDoc();
  }, [id, location.state]);

  async function loadDoc() {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const decodedId = decodeURIComponent(id);
      const docData = await getDoc(decodedId);

      if (docData.error) {
        setError('Document not found');
      } else {
        setDoc(docData);
      }
    } catch (e) {
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  // Show raw file in modal
  async function handleShowRawFile(e: React.MouseEvent) {
    e.preventDefault();
    if (!doc?.source_file) return;

    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(doc.source_file)}${doc.project ? `&project=${encodeURIComponent(doc.project)}` : ''}`);
      if (res.ok) {
        const content = await res.text();
        setRawContent(content);
        setShowRawModal(true);
      }
    } catch (err) {
      console.error('Failed to load raw file:', err);
    }
  }

  // Strip YAML frontmatter only, keep all content
  function stripFrontmatter(content: string): string {
    const trimmed = content.trim();
    if (trimmed.startsWith('---')) {
      const endIndex = trimmed.indexOf('---', 3);
      if (endIndex !== -1) {
        return trimmed.slice(endIndex + 3).trim();
      }
    }
    return trimmed;
  }

  // Try to format a date string, return null if invalid
  function tryFormatDate(dateStr: string): string | null {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return null;
    }
  }

  // Extract metadata
  function parseMetadata(doc: Document) {
    const source = doc.source_file || '';
    const content = doc.content || '';

    let when = 'Unknown date';

    // 1. Try YYYY-MM-DD pattern in source_file
    const isoDateMatch = source.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch) {
      const formatted = tryFormatDate(isoDateMatch[1]);
      if (formatted) when = formatted;
    }

    // 2. Try YYYY/MM/DD path pattern
    if (when === 'Unknown date') {
      const pathDateMatch = source.match(/(\d{4})\/(\d{2})\/(\d{2})/);
      if (pathDateMatch) {
        const formatted = tryFormatDate(`${pathDateMatch[1]}-${pathDateMatch[2]}-${pathDateMatch[3]}`);
        if (formatted) when = formatted;
      }
    }

    // 3. Try YYYY-MM/DD path pattern
    if (when === 'Unknown date') {
      const altPathMatch = source.match(/(\d{4})-(\d{2})\/(\d{2})/);
      if (altPathMatch) {
        const formatted = tryFormatDate(`${altPathMatch[1]}-${altPathMatch[2]}-${altPathMatch[3]}`);
        if (formatted) when = formatted;
      }
    }

    // 4. Try doc.id for date pattern
    if (when === 'Unknown date' && doc.id) {
      const idDateMatch = doc.id.match(/(\d{4}-\d{2}-\d{2})/);
      if (idDateMatch) {
        const formatted = tryFormatDate(idDateMatch[1]);
        if (formatted) when = formatted;
      }
    }

    // 5. Try to extract date from content (e.g., "Date: 2026-01-02")
    if (when === 'Unknown date') {
      const contentDateMatch = content.match(/Date:\s*(\d{4}-\d{2}-\d{2})/i);
      if (contentDateMatch) {
        const formatted = tryFormatDate(contentDateMatch[1]);
        if (formatted) when = formatted;
      }
    }

    const what = doc.type.charAt(0).toUpperCase() + doc.type.slice(1);

    const how = source.includes('resonance') ? 'From Resonance Profile'
      : source.includes('retrospective') ? 'From Session Retrospective'
      : source.includes('learnings') ? 'From Discoveries'
      : 'From Knowledge Base';

    return { when, what, how };
  }

  if (loading) {
    return <div className="text-center py-16 px-6 text-text-muted">Loading...</div>;
  }

  if (error || !doc) {
    return (
      <div className="text-center py-16 px-6 text-text-muted">
        <p>{error || 'Document not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 bg-bg-card border border-border text-text-primary py-3 px-6 rounded-lg cursor-pointer text-sm hover:border-accent transition-colors duration-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { when, what, how } = parseMetadata(doc);

  return (
    <SidebarLayout activeType={doc.type}>
    <article className="max-w-[720px]">
      <button
        onClick={() => navigate(-1)}
        className="inline-block bg-transparent border-none text-text-secondary text-sm cursor-pointer p-0 mb-8 transition-colors duration-200 hover:text-accent"
      >
        ← Back to Feed
      </button>

      <header className="mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <Badge type={doc.type} label={what} className="!text-xs !px-3 !py-1 !rounded-2xl" />
          <span className="text-text-muted">·</span>
          <span className="text-text-secondary text-sm">{when}</span>
        </div>

        <p className="text-text-muted text-sm">{how}</p>
      </header>

      <div className="doc-content text-lg leading-[1.8] text-text-primary [&_h1]:text-accent [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:font-semibold [&_h1]:text-[28px] [&_h1:first-child]:mt-0 [&_h2]:text-accent [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:font-semibold [&_h2]:text-2xl [&_h2:first-child]:mt-0 [&_h3]:text-accent [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:font-semibold [&_h3]:text-xl [&_h3:first-child]:mt-0 [&_p]:mb-4 [&_code]:bg-[rgba(167,139,250,0.15)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[15px] [&_code]:text-[#e9d5ff] [&_pre]:bg-[rgba(0,0,0,0.4)] [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm [&_pre_code]:text-white/85 [&_ul]:my-4 [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:pl-6 [&_li]:mb-2 [&_strong]:text-accent [&_strong]:font-semibold [&_a]:text-accent [&_a]:underline [&_a:hover]:text-[#c4b5fd] [&_blockquote]:border-l-[3px] [&_blockquote]:border-l-accent [&_blockquote]:my-4 [&_blockquote]:pl-4 [&_blockquote]:text-text-secondary [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-[15px] [&_th]:border [&_th]:border-border [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:bg-[rgba(167,139,250,0.15)] [&_th]:text-accent [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-3 [&_td]:text-left [&_tr:nth-child(even)]:bg-white/[0.02] [&_hr]:border-none [&_hr]:border-t [&_hr]:border-t-border [&_hr]:my-6 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4">
        <Markdown remarkPlugins={[remarkGfm]}>{stripFrontmatter(fullContent || doc.content)}</Markdown>
      </div>

      {doc.concepts && doc.concepts.length > 0 && (
        <div className="mt-12 pt-6 border-t border-border">
          <h3 className="text-xs uppercase text-text-muted mb-4 tracking-[0.5px]">Related Concepts</h3>
          <div className="flex flex-wrap gap-2">
            {doc.concepts.map(tag => (
              <Link
                key={tag}
                to={`/search?q=${encodeURIComponent(tag)}`}
                className="bg-bg-card text-text-secondary px-4 py-2 rounded-[20px] text-sm transition-all duration-200 hover:bg-accent hover:text-white"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      {(neighbors.prev || neighbors.next) && (
        <nav className="flex items-center justify-between mt-12 py-5 border-t border-border">
          <button
            onClick={() => neighbors.prev && goToDoc(neighbors.prev)}
            disabled={!neighbors.prev}
            className="flex items-center gap-2.5 bg-bg-card border border-border text-text-primary py-3 px-5 rounded-[10px] cursor-pointer text-sm transition-all duration-200 hover:enabled:border-accent hover:enabled:bg-[rgba(167,139,250,0.1)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="inline-flex items-center justify-center w-6 h-6 bg-[rgba(167,139,250,0.2)] border border-[rgba(167,139,250,0.3)] rounded-md text-xs font-semibold text-accent font-mono">K</span>
            <span className="text-text-secondary">Previous</span>
          </button>
          <span className="text-xs text-text-muted">J/K navigate · U back</span>
          <button
            onClick={() => neighbors.next && goToDoc(neighbors.next)}
            disabled={!neighbors.next}
            className="flex items-center gap-2.5 bg-bg-card border border-border text-text-primary py-3 px-5 rounded-[10px] cursor-pointer text-sm transition-all duration-200 hover:enabled:border-accent hover:enabled:bg-[rgba(167,139,250,0.1)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="text-text-secondary">Next</span>
            <span className="inline-flex items-center justify-center w-6 h-6 bg-[rgba(167,139,250,0.2)] border border-[rgba(167,139,250,0.3)] rounded-md text-xs font-semibold text-accent font-mono">J</span>
          </button>
        </nav>
      )}

      <footer className="mt-12 pt-6 border-t border-border">
        {fileNotFound && (
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-xs text-[#f59e0b]">⚠️ local file not found</span>
            {doc.project && (
              <span className="text-xs text-accent bg-[rgba(167,139,250,0.1)] px-2.5 py-1 rounded font-mono">📦 Source: {doc.project.replace('github.com/', '')}</span>
            )}
          </div>
        )}
        <div className="flex flex-col items-start gap-1.5">
          {(() => {
            const info = getDocDisplayInfo(doc.source_file, doc.project);

            return (
              <>
                <div className="flex items-center gap-4 flex-wrap">
                  {info.projectVaultUrl ? (
                    <a
                      href={info.projectVaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-secondary no-underline font-mono transition-colors duration-200 hover:text-accent"
                    >
                      🔗 {info.projectDisplay}
                    </a>
                  ) : (
                    <span className="text-[11px] text-[#fbbf24] bg-[rgba(251,191,36,0.1)] px-2 py-[3px] rounded font-medium">✦ universal</span>
                  )}
                  {info.fileUrl && (
                    <a
                      href={info.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent no-underline px-2.5 py-1 bg-[rgba(167,139,250,0.1)] rounded transition-all duration-200 hover:bg-[rgba(167,139,250,0.2)]"
                    >
                      View on GitHub ↗
                    </a>
                  )}
                  {info.vaultUrl && (
                    <a
                      href={info.vaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#34d399] bg-[rgba(52,211,153,0.1)] px-2 py-[3px] rounded font-medium no-underline transition-all duration-200 hover:bg-[rgba(52,211,153,0.2)] hover:text-[#6ee7b7]"
                    >
                      🏛️ vault
                    </a>
                  )}
                </div>
                {!fileNotFound ? (
                  <button
                    onClick={handleShowRawFile}
                    className="text-xs text-text-muted font-mono no-underline bg-transparent border-none p-0 cursor-pointer text-left transition-colors duration-200 hover:text-accent hover:underline"
                  >
                    📁 {info.displayPath}
                  </button>
                ) : (
                  <span className="text-xs text-text-muted font-mono opacity-70">📁 {info.displayPath}</span>
                )}
              </>
            );
          })()}
        </div>
      </footer>

      {/* Raw File Modal */}
      {showRawModal && rawContent && (
        <Modal onClose={() => setShowRawModal(false)} maxWidth="1100px">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="text-sm font-mono text-text-secondary">📁 {doc.source_file}</span>
            <button
              className="bg-transparent border-none text-text-muted text-2xl cursor-pointer p-0 leading-none transition-colors duration-200 hover:text-accent"
              onClick={() => setShowRawModal(false)}
            >
              ×
            </button>
          </div>
          <pre className="p-5 overflow-auto text-[13px] font-mono text-text-primary whitespace-pre-wrap break-words m-0 leading-relaxed">
            {rawContent.split('\n').map((line, i) => (
              <div key={i} className="flex">
                <span className="text-text-muted opacity-50 min-w-[45px] pr-4 text-right select-none border-r border-border mr-4">{i + 1}</span>
                <span className="flex-1">{line || ' '}</span>
              </div>
            ))}
          </pre>
        </Modal>
      )}
    </article>
    </SidebarLayout>
  );
}
