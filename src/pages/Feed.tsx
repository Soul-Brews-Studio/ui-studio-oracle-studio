import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { list } from '../api/oracle';
import type { Document } from '../api/oracle';
import { LogCard } from '../components/LogCard';
import { SidebarLayout } from '../components/SidebarLayout';

export function Feed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Get type from URL or default to 'all'
  const type = searchParams.get('type') || 'all';

  function setType(newType: string) {
    if (newType === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ type: newType });
    }
  }

  useEffect(() => {
    loadDocs(true);
  }, [type]);

  async function loadDocs(reset = false) {
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const data = await list(type, 20, newOffset);
      if (reset) {
        setDocs(data.results);
        setOffset(20);
      } else {
        setDocs(prev => [...prev, ...data.results]);
        setOffset(prev => prev + 20);
      }
      setHasMore(data.results.length >= 20);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SidebarLayout activeType={type} onTypeChange={setType}>
      <h1 className="text-[32px] font-bold text-text-primary mb-2">Knowledge Feed</h1>
      <p className="text-base text-text-secondary mb-8">
        Browse Oracle's indexed knowledge — principles, learnings, and retrospectives
      </p>

      <div className="flex flex-col">
        {docs.map(doc => (
          <LogCard key={doc.id} doc={doc} />
        ))}
      </div>

      {loading && <div className="text-center text-text-muted py-6">Loading...</div>}

      {!loading && hasMore && (
        <button
          type="button"
          onClick={() => loadDocs(false)}
          className="block w-full bg-bg-card border border-border text-text-primary py-4 rounded-lg cursor-pointer text-sm transition-all duration-200 mt-4 hover:border-accent hover:text-accent"
        >
          Load More
        </button>
      )}
    </SidebarLayout>
  );
}
