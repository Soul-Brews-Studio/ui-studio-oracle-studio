interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const HELP = {
  error: "API not available on deployed studio",
  message:
    "studio.buildwithoracle.com is a static preview — the API backend only runs locally. " +
    "Install + run: `bunx --bun oracle-studio@github:Soul-Brews-Studio/oracle-studio` " +
    "(and `bunx --bun arra-oracle-v3@github:Soul-Brews-Studio/arra-oracle-v3` for the MCP server).",
  docs: "https://neo.buildwithoracle.com/install/",
};

// Hashed by Vite — safe to cache forever. Covers /assets/* and any *-[hash].{js,css,png,woff2,...}
const HASHED_ASSET = /\/(?:assets\/|[^/]+-)[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      return Response.json(HELP, {
        status: 404,
        headers: { "cache-control": "no-store" },
      });
    }

    const response = await env.ASSETS.fetch(request);
    if (!response.ok) return response;

    const headers = new Headers(response.headers);

    if (HASHED_ASSET.test(url.pathname)) {
      // Content-addressed: immutable forever.
      headers.set("cache-control", "public, max-age=31536000, immutable");
    } else {
      // HTML / unhashed — short TTL + SWR so next deploy propagates within 1h
      // but reloads within 24h serve instantly from cache.
      headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
