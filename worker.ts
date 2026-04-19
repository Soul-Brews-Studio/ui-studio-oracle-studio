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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      return Response.json(HELP, {
        status: 404,
        headers: { "cache-control": "no-store" },
      });
    }
    const VECTOR_HOSTS = new Set([
      "vector.buildwithoracle.com",
      "vector-playground.buildwithoracle.com",
    ]);
    if (
      VECTOR_HOSTS.has(url.hostname) &&
      (url.pathname === "/" || url.pathname === "/index.html")
    ) {
      const rewritten = new URL(request.url);
      rewritten.pathname = "/playground";
      return env.ASSETS.fetch(new Request(rewritten.toString(), request));
    }
    return env.ASSETS.fetch(request);
  },
};
