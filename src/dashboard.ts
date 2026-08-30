import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { riskBand } from "./policy.js";
import type { EventStore, TriageEvent } from "./store.js";

/** Built React app (web/dist). When present it is served; otherwise the legacy server-rendered page below is the fallback. */
const WEB_DIST = path.resolve(
  process.env.LANEKEEPER_WEB_DIST ?? path.join(process.cwd(), "web", "dist"),
);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".woff2": "font/woff2",
};

function tryServeStatic(req: IncomingMessage, res: ServerResponse): boolean {
  if (!fs.existsSync(path.join(WEB_DIST, "index.html"))) return false;

  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const resolved = path.normalize(path.join(WEB_DIST, urlPath));
  if (resolved !== WEB_DIST && !resolved.startsWith(WEB_DIST + path.sep)) {
    res.writeHead(403).end();
    return true;
  }

  let file = resolved;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(WEB_DIST, "index.html"); // SPA fallback
  }

  const ext = path.extname(file);
  res.writeHead(200, {
    "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
    "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  res.end(fs.readFileSync(file));
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "?";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function row(e: TriageEvent): string {
  const band = riskBand(e.risk);
  return `<tr>
    <td><a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">${escapeHtml(`${e.owner}/${e.repo}#${e.number}`)}</a></td>
    <td class="title">${escapeHtml(e.title)}${e.dryRun ? ' <span class="tag">dry run</span>' : ""}</td>
    <td>${escapeHtml(e.author)}${e.authorIsBot ? ' <span class="tag">bot</span>' : ""}</td>
    <td><span class="lane lane-${e.lane}">${e.lane}</span></td>
    <td class="num risk-${band}" title="risk">${e.risk}</td>
    <td class="num" title="value">${e.value}</td>
    <td class="num" title="urgency">${e.urgency}</td>
    <td>${escapeHtml(e.readiness.replace("_", " "))}</td>
    <td class="muted">${escapeHtml(e.modelLabel)}</td>
    <td class="muted">${timeAgo(e.ts)}</td>
  </tr>`;
}

export function renderDashboardHtml(queue: TriageEvent[], totalEvents: number): string {
  const counts = { deep: 0, fast: 0, auto: 0 };
  for (const e of queue) counts[e.lane] += 1;

  const rows = queue.map(row).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Lanekeeper</title>
<style>
  :root {
    --bg: #f6f7f9; --panel: #ffffff; --text: #1a1f26; --muted: #68737f;
    --border: #e3e7ec; --deep: #c62f2f; --fast: #b97f0a; --auto: #2e7d43; --link: #0b62c4;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14171b; --panel: #1d2127; --text: #e8ebee; --muted: #97a1ac;
      --border: #2c323a; --deep: #ff7a70; --fast: #ecb64a; --auto: #6fce8d; --link: #6cb2ff;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 24px 20px 60px; }
  h1 { font-size: 20px; margin: 0; }
  header { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  header .sub { color: var(--muted); }
  .chips { display: flex; gap: 10px; margin: 0 0 16px; flex-wrap: wrap; }
  .chip { background: var(--panel); border: 1px solid var(--border); border-radius: 999px;
          padding: 5px 14px; font-weight: 600; }
  .chip b { font-weight: 700; }
  .chip.deep b { color: var(--deep); } .chip.fast b { color: var(--fast); } .chip.auto b { color: var(--auto); }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; min-width: 900px; }
  th, td { text-align: left; padding: 9px 12px; border-top: 1px solid var(--border); white-space: nowrap; }
  thead th { border-top: 0; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  td.title { white-space: normal; min-width: 240px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .risk-high { color: var(--deep); } .risk-medium { color: var(--fast); } .risk-low { color: var(--auto); }
  .lane { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #fff; }
  .lane-deep { background: var(--deep); } .lane-fast { background: var(--fast); } .lane-auto { background: var(--auto); }
  @media (prefers-color-scheme: dark) { .lane { color: #14171b; } }
  .tag { font-size: 11px; color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 0 5px; }
  .muted { color: var(--muted); }
  a { color: var(--link); text-decoration: none; } a:hover { text-decoration: underline; }
  .empty { padding: 40px; text-align: center; color: var(--muted); }
  footer { margin-top: 14px; color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🛣️ Lanekeeper</h1>
    <span class="sub">change queue — latest triage per pull request</span>
  </header>
  <div class="chips">
    <span class="chip deep"><b>${counts.deep}</b> deep</span>
    <span class="chip fast"><b>${counts.fast}</b> fast</span>
    <span class="chip auto"><b>${counts.auto}</b> auto</span>
  </div>
  <div class="panel">
  ${
    queue.length === 0
      ? '<div class="empty">No triage events yet. Run <code>npm run triage -- --repo owner/name --pr 123</code> or point PR webhooks at the server.</div>'
      : `<table>
    <thead><tr><th>PR</th><th>Title</th><th>Author</th><th>Lane</th><th>Risk</th><th>Value</th><th>Urgency</th><th>Readiness</th><th>Model</th><th>When</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
  }
  </div>
  <footer>${totalEvents} events recorded · auto-refreshes every 30s · <a href="/api/events">/api/events</a></footer>
</div>
</body>
</html>`;
}

/** Mountable dashboard routes; returns true when the request was handled. */
export function handleDashboard(
  req: IncomingMessage,
  res: ServerResponse,
  store: EventStore,
): boolean {
  const url = (req.url ?? "/").split("?")[0];

  if (url === "/api/events") {
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ queue: store.latestPerPR(), events: store.list(200) }));
    return true;
  }

  if (url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return true;
  }

  if (tryServeStatic(req, res)) return true;

  if (url === "/" || url === "/dashboard") {
    const events = store.list();
    res
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(renderDashboardHtml(store.latestPerPR(), events.length));
    return true;
  }

  return false;
}
