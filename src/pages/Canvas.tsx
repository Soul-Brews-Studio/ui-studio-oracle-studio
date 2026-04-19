import { useEffect } from 'react';

const CANVAS_ORIGIN = 'https://canvas.buildwithoracle.com';

/**
 * Studio /canvas → cross-origin redirect to canvas.buildwithoracle.com.
 *
 * The full plugin host lives on its own subdomain now. Studio keeps the route
 * so existing menu entries + bookmarks don't 404 — they bounce to canvas.*
 * carrying the ?host + ?plugin query string through.
 */
export function Canvas() {
  useEffect(() => {
    const qs = typeof window !== 'undefined' ? window.location.search : '';
    window.location.replace(`${CANVAS_ORIGIN}/${qs}`);
  }, []);

  return (
    <div className="max-w-[1300px] mx-auto py-10 px-6 text-text-secondary">
      <p className="text-sm">
        Redirecting to <a className="text-accent underline" href={CANVAS_ORIGIN}>{CANVAS_ORIGIN}</a>…
      </p>
    </div>
  );
}
