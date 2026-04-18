#!/usr/bin/env bun
/**
 * Oracle Studio CLI — serve the dashboard
 *
 * Usage:
 *   bunx oracle-studio                          # default: port 3000, API at localhost:47778
 *   bunx oracle-studio --port 4000              # custom port
 *   bunx oracle-studio --api http://host:47778  # custom API URL
 */

import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const args = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Oracle Studio — React dashboard for oracle-v2

Usage:
  oracle-studio [options]

Options:
  --port <number>   Port to serve on (default: 3000)
  --api  <url>      Oracle API URL (default: http://localhost:47778)
  -h, --help        Show this help
`);
  process.exit(0);
}

const PORT = parseInt(getArg('--port', '3000'), 10);
const API_URL = getArg('--api', 'http://localhost:47778');
const DIST = join(import.meta.dirname, '..', 'dist');

if (!existsSync(DIST)) {
  const projectRoot = join(import.meta.dirname, '..');
  console.log('📦 dist/ not found — building once (~10s)…');
  const result = Bun.spawnSync(['bun', 'run', 'build'], {
    cwd: projectRoot,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0 || !existsSync(DIST)) {
    console.error('Error: build failed or dist/ still missing. Try `cd` into the package and run `bun run build`.');
    process.exit(1);
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Proxy /api/* to oracle-v2
    if (url.pathname.startsWith('/api/')) {
      const target = `${API_URL}${url.pathname}${url.search}`;
      const headers = new Headers(req.headers);
      headers.delete('host');
      try {
        return await fetch(target, {
          method: req.method,
          headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
          redirect: 'follow',
        });
      } catch {
        return new Response(JSON.stringify({ error: 'API unreachable', target: API_URL }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    // Serve static files
    let filePath = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      const ext = extname(filePath);
      return new Response(content, {
        headers: { 'content-type': MIME[ext] || 'application/octet-stream' },
      });
    }

    // SPA fallback
    const indexPath = join(DIST, 'index.html');
    if (existsSync(indexPath)) {
      return new Response(readFileSync(indexPath), {
        headers: { 'content-type': 'text/html' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`
🎨 Oracle Studio running!

   Dashboard: http://localhost:${PORT}
   API proxy: ${API_URL}
`);
