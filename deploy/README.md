# Deploying Fleet Town (`/town`) persistently + exposed

Fleet Town reads the **local** tmux fleet, so it must run on the fleet host
(the EC2 box where the agent panes live), fronted by HTTPS + auth.

## 1. Build + run the server

`server/fleet-server.ts` is an always-on Bun server that serves the built
`dist/` bundle and the live `/__fleet/state` endpoint. It is **isolated from the
memory backbone**: only `/api/health` and `/api/auth/status` are forwarded to the
Oracle API (so the SPA's BackendGate boots); every other `/api/*` path is refused.

```bash
bunx vite build                 # produce dist/  (the dep `knowledge-map-3d`
                                # trips `tsc -b`, so build with vite directly)
bun server/fleet-server.ts      # FLEET_PORT=8788, binds 127.0.0.1 by default
```

Persist with systemd (binds localhost — Caddy does TLS + auth in front):

```bash
sudo cp deploy/fleet-town.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fleet-town.service
systemctl status fleet-town.service
```

## 2. Expose via the existing Caddy (HTTPS + basic-auth)

No AWS security-group change is needed — Caddy already listens on 443. Add a site
block to `/etc/caddy/Caddyfile` (back it up first). Use any `<sub>.<dashed-ip>.sslip.io`
host; it resolves to the public IP and Caddy auto-provisions a Let's Encrypt cert.

```caddyfile
town.3-1-0-33.sslip.io {
	basic_auth {
		oracle <BCRYPT-HASH>   # generate: caddy hash-password --plaintext '<password>'
	}
	reverse_proxy 127.0.0.1:8788
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

## Security posture

- **basic-auth** at Caddy gates the whole site (HTTP 401 without credentials).
- **Backbone isolation**: even past auth, `/api/search`, `/api/docs`, etc. return
  404 from `fleet-server` — only the two harmless gate endpoints are forwarded, so
  the town never exposes Oracle memory/threads/handoffs.
- `fleet-server` binds `127.0.0.1` only; the public surface is Caddy's 443.
- The page seeds `localStorage['oracle-studio-host']` with its own origin so the
  studio's host resolver targets same-origin `/api` instead of the viewer's
  `localhost:47778`.
- To lock down further, restrict the Caddy site (or SSH-style the SG) to specific
  source IPs, or front it with Cloudflare Access.

## Operate

```bash
sudo systemctl restart fleet-town.service   # after a new `bunx vite build`
sudo journalctl -u fleet-town.service -f    # logs
```

> Follow-up: fold the probe into maw-js `GET /api/fleet` (+ WS push) so any studio
> deployment gets fleet data without this standalone server. Tracked in #50.
