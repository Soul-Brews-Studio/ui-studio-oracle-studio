# Oracle Studio

React dashboard for [oracle-v2](https://github.com/Soul-Brews-Studio/oracle-v2) API.

## Quick Start

```bash
bunx oracle-studio
```

Serves the dashboard on http://localhost:3000, proxying API requests to oracle-v2 on port 47778.

### Options

```bash
bunx oracle-studio --port 4000              # custom port
bunx oracle-studio --api http://host:47778  # custom API URL
```

## Development

Start the oracle-v2 API server first:

```bash
# In your oracle-v2 repo
bun run server  # http://localhost:47778
```

Then start the dev server with HMR:

```bash
bun install
bun run dev     # http://localhost:3000
```

## Build & Publish

```bash
bun run build     # build to dist/
npm publish       # publishes dist/ + bin/
```
