# Oracle Studio

React dashboard for [oracle-v2](https://github.com/Soul-Brews-Studio/oracle-v2) API.

## Setup

```bash
bun install
```

## Development

Start the oracle-v2 API server first:

```bash
# In your oracle-v2 repo
bun run server  # http://localhost:47778
```

Then start the dashboard:

```bash
bun run dev     # http://localhost:3000
```

The dev server proxies `/api/*` requests to the oracle-v2 API on port 47778.

### Custom API URL

```bash
ORACLE_API_URL=http://your-server:47778 bun run dev
```

## Build

```bash
bun run build
bun run preview
```
