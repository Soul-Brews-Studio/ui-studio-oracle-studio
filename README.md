# Oracle Studio

React dashboard for [arra-oracle](https://github.com/Soul-Brews-Studio/arra-oracle) API.

## Quick Start

```bash
bunx oracle-studio
```

Serves the dashboard on http://localhost:3000, proxying API requests to arra-oracle on port 47778.

### Options

```bash
bunx oracle-studio --port 4000              # custom port
bunx oracle-studio --api http://host:47778  # custom API URL
```

## Development

Start the arra-oracle API server first:

```bash
# In your arra-oracle repo
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
