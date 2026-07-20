# Nexus BDIX Scanner

A modern, glassmorphism-styled **static-only** web app for scanning BDIX & FTP servers from your ISP. No frameworks, no build tools, no backend, no API keys. Just open `index.html` through any static file server.

## Features

- **Parallel scanning** with a configurable concurrency worker pool (default 8, adjustable 1–64). Much faster than sequential probing of ~1300 URLs. Pause/resume/reset preserved.
- **Honest status labeling** — results are "Reachable" (fetch resolved) vs "Unreachable" (abort/timeout). Since `no-cors` HEAD can't read the status code, no server "up" is implied.
- **Optional Accurate probe** — toggles a real `GET` through free third-party CORS proxies (`api.allorigins.win`, `corsproxy.io`) and shows the HTTP status code per result. Clearly third-party; falls back to reachable/unreachable on failure.
- **Live progress** — 0→100% bar + title update, **circular SVG progress ring**, and an **ETA** computed from elapsed time and progress.
- **Live elapsed timer** (HH:MM:SS) with pause/resume.
- **Export** — Copy Reachable / Copy Unreachable (clipboard) and Download `.txt` (Blob + `URL.createObjectURL`).
- **Live search & filter** — real-time substring filter plus quick toggles All / Reachable / Unreachable, applied to already-rendered results.
- **Persistent state** — last results, timeout, concurrency, autoscroll, accurate-probe and sound toggles saved to `localStorage` and restored on reload. "Reset" also clears saved state.
- **Completion sound** — optional Web Audio API beep on scan finish (default off).
- **Share results** — copies a text summary with the creator's promo links.
- **Sticky creator bar** — Telegram/Linktree chips stay visible (sticky on mobile).
- **Visitor badge** — free no-signup counter (`api.countapi.xyz`). Hidden gracefully on failure.
- **Lightweight list virtualization** — caps rendered rows at 300 per list with a "showing X of Y — search to refine" note (full arrays kept in memory).
- **Keyboard shortcuts** — `Space` start/stop, `R` reset, `/` focus search (ignored while typing).
- **PWA** — `manifest.json` + `service-worker.js` cache core files for offline install.
- **XSS-safe** rendering via `createElement`/`textContent` (URLs never injected as HTML).

Creator links (kept prominent): [Telegram @n0b0jit_nexus](https://t.me/n0b0jit_nexus) · [Linktree](https://linktr.ee/mr_nobojit.m)

## New features

- **Share card (client-side canvas)** — "Share card" generates a branded 1200×630 PNG (`<canvas>`) titled "I found X reachable BDIX servers" with the counts and creator handles. Offers **Download card** (`canvas.toBlob` → download), **Copy image** (`ClipboardItem` → clipboard), and **Copy text** (summary with promo links). Graceful fallback to text share if canvas/clipboard unsupported.
- **Telegram completion CTA** — on scan finish a card appears: "Join @n0b0jit_nexus for fresh server lists" opening `https://t.me/n0b0jit_nexus?text=<prefilled>` with a prefilled "found X reachable" message.
- **Embed widget** — `embed.html` is a stripped, self-contained build reusing `style.css` + `script.js`; creator chips always visible. Embed with:

  ```html
  <iframe src="https://YOURDOMAIN/embed.html" width="100%" height="520"
          style="border:0;border-radius:18px;" title="Nexus BDIX Scanner"></iframe>
  ```

- **Submit a server** — form builds a pre-filled GitHub **issue** URL (`https://github.com/OWNER/REPO/issues/new?...`) plus a Telegram submit link; both open in new tabs. No token needed. Real auto-commit to `all_servers.txt` would require a `curl` PUT with a GitHub token — intentionally not done here (honest: GitHub forbids unauthenticated writes).
- **☕ Support chip** — a tasteful chip near the creator links opens the Linktree (which supports tips).
- **Web Push (serverless)** — "Enable notifications" toggle requests permission and subscribes via `serviceWorker.pushManager.subscribe` (VAPID). The subscription POSTs to `/api/subscribe`. See `api/subscribe.js` (Netlify Function / Vercel Edge scaffold). **PLACEHOLDER**: set `VAPID_PUBLIC_KEY` in `script.js` and a real endpoint; the vanilla client degrades gracefully if push or the endpoint is missing.
- **PWA update prompt** — service worker bumps its cache version; `script.js` listens for `updatefound` and `controllerchange`, showing a dismissible "New version available — Reload" banner.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Host for free

The app is 100% static — deploy the whole folder to any static host:

- **GitHub Pages**: push the folder to a repo → Settings → Pages → source `main` (root). Visits `https://<user>.github.io/<repo>/`.
- **Netlify / Vercel / Cloudflare Pages**: drag-and-drop the folder or connect the Git repo; build command leave empty, publish directory `.` (root).

No environment variables or server config required.

## Usage

1. Serve the folder (`python3 -m http.server 8000`) and open in a browser.
2. Adjust **Timeout** (default 8s) and **Concurrency** (default 8) as needed.
3. Click **Start Scan**. Use **Stop** / **Resume** to pause, **Reset** to clear (including saved state).
4. Toggle **Accurate probe** before scanning to get real HTTP status codes (slower).
5. Filter with the search box or the All/Reachable/Unreachable segmented control.
6. Use **Copy Reachable / Copy Unreachable / Download .txt / Share results** to export.
7. Refresh anytime — results restore from local storage.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup + control wiring |
| `style.css` | All styling |
| `script.js` | Scan engine, pool, persistence, export, PWA registration |
| `all_servers.txt` | Server URL list (data, do not edit) |
| `manifest.json` / `service-worker.js` / `icon.svg` | PWA assets |
| `embed.html` | Embeddable widget (reuses style.css + script.js) |
| `api/subscribe.js` | Serverless Web Push subscribe scaffold (Netlify/Vercel) |

## Web Push deploy (optional, free tier)

1. Generate VAPID keys: `npx web-push generate-vapid-keys`.
2. In `script.js` set the real public key: `const VAPID_PUBLIC_KEY = '…'`.
3. **Netlify**: keep `api/subscribe.js`, add `functions = "api"` to `netlify.toml`. Set `SUBSCRIBE_ENDPOINT = '/api/subscribe'` (already default). The function currently logs/stores subscriptions in memory — wire a DB/KV + `web-push` send for real delivery.
4. **Vercel**: use the Edge Function form at the bottom of `api/subscribe.js` (rename/uncomment, remove the Netlify `handler`).
5. GitHub Pages / plain static hosts cannot run this function — push stays disabled (client degrades gracefully).

> The main app stays 100% static. Only the optional notification feature needs the serverless function.
