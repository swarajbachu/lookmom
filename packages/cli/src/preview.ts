/**
 * Local preview that mirrors production exactly: the artifact is served under
 * the SAME strict CSP and inside a sandboxed iframe, so "looks right locally"
 * == "looks right published" (external-resource breakage shows up here too).
 *
 * Accepts a single HTML file OR a project directory (index.html + CSS/JS).
 * Multi-file projects are re-bundled on each request so live-reload stays accurate.
 */
import { statSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { bundleArtifact } from "./bundle";
import { c, info, openBrowser, warn } from "./util";

// Keep in sync with packages/worker/src/csp.ts (resource directives).
// frame-ancestors MUST be 'self' here: preview embeds /raw in an iframe on the
// same origin. Production allows the gate host instead of 'none' for the same reason.
const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "sandbox allow-scripts allow-popups allow-downloads",
].join("; ");

const WRAPPER = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lookmom preview</title>
<style>
  :root { color-scheme: dark; --bg:#0c0c0e; --bar:#141417; --line:rgba(255,255,255,0.08);
    --fg:#f4f4f5; --muted:#a1a1aa; --ok:#34d399; --accent:#818cf8; }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; background:var(--bg); color:var(--fg);
    font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    -webkit-font-smoothing:antialiased; }
  .bar { display:flex; align-items:center; gap:12px; padding:0 14px; height:40px;
    background:var(--bar); border-bottom:1px solid var(--line); flex-shrink:0; }
  .dot { width:8px; height:8px; border-radius:50%; background:var(--ok);
    box-shadow:0 0 0 3px rgba(52,211,153,0.15); }
  .bar strong { font-weight:600; letter-spacing:-0.01em; }
  .bar .muted { color:var(--muted); }
  .bar .spacer { flex:1; }
  .pill { font-size:11px; color:var(--muted); border:1px solid var(--line);
    border-radius:999px; padding:3px 9px; font-variant-numeric:tabular-nums; }
  iframe { border:0; width:100%; height:calc(100vh - 40px); display:block; background:#fff; }
  @media (prefers-reduced-motion: reduce) {
    .dot { box-shadow:none; }
  }
</style>
</head>
<body>
  <div class="bar">
    <span class="dot" aria-hidden="true"></span>
    <strong>lookmom preview</strong>
    <span class="muted" id="src"></span>
    <span class="spacer"></span>
    <span class="pill" id="meta">live</span>
  </div>
  <iframe id="f" src="/raw" title="Artifact preview"></iframe>
  <script>
    const srcEl = document.getElementById("src");
    const meta = document.getElementById("meta");
    srcEl.textContent = new URLSearchParams(location.search).get("name") || "";
    let v = null;
    async function tick() {
      try {
        const r = await fetch("/version");
        const j = await r.json();
        if (v !== null && j.v !== v) {
          document.getElementById("f").src = "/raw?" + j.v;
          meta.textContent = j.files + " files · " + j.kb + " KB";
        }
        if (v === null) meta.textContent = j.files + " files · " + j.kb + " KB";
        v = j.v;
      } catch (e) {}
      setTimeout(tick, 700);
    }
    tick();
  </script>
</body>
</html>`;

/** Fingerprint a path or directory tree for live-reload (mtime + size). */
function treeVersion(root: string): string {
  const abs = resolve(root);
  let acc = 0;
  const walk = (p: string, depth: number) => {
    if (depth > 8) return;
    let st;
    try {
      st = statSync(p);
    } catch {
      return;
    }
    acc = (acc + Math.floor(st.mtimeMs) + st.size) >>> 0;
    if (st.isDirectory()) {
      let names: string[] = [];
      try {
        names = readdirSync(p);
      } catch {
        return;
      }
      for (const name of names) {
        if (name === "node_modules" || name === ".git" || name.startsWith(".")) continue;
        walk(join(p, name), depth + 1);
      }
    }
  };
  walk(abs, 0);
  return String(acc);
}

export function startPreview(path: string, port = 4321): void {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`File or directory not found: ${path}`);
  }

  // Warm-up bundle so startup errors are loud.
  let last: ReturnType<typeof bundleArtifact>;
  try {
    last = bundleArtifact(abs);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
  for (const w of last.warnings) warn(w);

  const watchRoot = statSync(abs).isDirectory() ? abs : dirname(abs);

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/version") {
        let result = last;
        try {
          result = bundleArtifact(abs);
          last = result;
        } catch {
          /* keep last good */
        }
        return new Response(
          JSON.stringify({
            v: treeVersion(watchRoot) + ":" + result.bytes,
            files: result.inlined.length,
            kb: Math.round(result.bytes / 1024),
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (url.pathname === "/raw") {
        try {
          last = bundleArtifact(abs);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(
            `<!doctype html><pre style="padding:24px;font:14px/1.5 ui-monospace,monospace;color:#f87171;background:#0d0d0f">Bundle error:\n${msg}</pre>`,
            {
              status: 500,
              headers: {
                "content-type": "text/html; charset=utf-8",
                "content-security-policy": ARTIFACT_CSP,
                "cache-control": "no-store",
              },
            },
          );
        }
        return new Response(last.html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": ARTIFACT_CSP,
            "cache-control": "no-store",
          },
        });
      }
      return new Response(WRAPPER, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  });

  const previewUrl = `http://localhost:${server.port}/?name=${encodeURIComponent(path)}`;
  info("");
  info(`  ${c.green("●")} Previewing ${c.bold(path)} under production CSP`);
  if (last.inlined.length > 1) {
    info(`  ${c.dim(`bundled ${last.inlined.length} files · ${(last.bytes / 1024).toFixed(1)} KB`)}`);
  }
  info(`  ${c.cyan(previewUrl)}  ${c.dim("(live-reloads on save · Ctrl-C to stop)")}`);
  info("");
  openBrowser(previewUrl);
}
