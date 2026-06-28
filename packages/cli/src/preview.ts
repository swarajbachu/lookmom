/**
 * Local preview that mirrors production exactly: the artifact is served under
 * the SAME strict CSP and inside a sandboxed iframe, so "looks right locally"
 * == "looks right published" (external-resource breakage shows up here too).
 * A thin wrapper page (NOT under the artifact CSP) polls for file changes and
 * reloads the iframe — live reload without violating the artifact's sandbox.
 */
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { c, info, openBrowser } from "./util";

// Keep in sync with packages/worker/src/csp.ts (ARTIFACT_CSP).
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
  "frame-ancestors 'none'",
  "sandbox allow-scripts allow-popups allow-downloads",
].join("; ");

const WRAPPER = (port: number) => `<!doctype html><html><head><meta charset="utf-8">
<title>lookmom preview</title><style>
  html,body{margin:0;height:100%;background:#1112}
  iframe{border:0;width:100%;height:100vh;display:block;background:#fff}
</style></head><body>
<iframe id="f" src="/raw"></iframe>
<script>
  let v=null;
  async function tick(){
    try{const r=await fetch('/version');const {v:nv}=await r.json();
      if(v!==null&&nv!==v){document.getElementById('f').src='/raw?'+nv;}
      v=nv;}catch(e){}
    setTimeout(tick,700);
  }
  tick();
</script></body></html>`;

export function startPreview(file: string, port = 4321): void {
  const abs = resolve(file);
  // Fail fast if missing.
  try {
    statSync(abs);
  } catch {
    throw new Error(`File not found: ${file}`);
  }

  const version = () => {
    try {
      return Math.floor(statSync(abs).mtimeMs).toString();
    } catch {
      return "0";
    }
  };

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/version") {
        return new Response(JSON.stringify({ v: version() }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url.pathname === "/raw") {
        return new Response(Bun.file(abs), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": ARTIFACT_CSP,
            "cache-control": "no-store",
          },
        });
      }
      return new Response(WRAPPER(port), { headers: { "content-type": "text/html; charset=utf-8" } });
    },
  });

  const previewUrl = `http://localhost:${server.port}`;
  info("");
  info(`  ${c.green("●")} Previewing ${c.bold(file)} under production CSP`);
  info(`  ${c.cyan(previewUrl)}  ${c.dim("(live-reloads on save · Ctrl-C to stop)")}`);
  info("");
  openBrowser(previewUrl);
}
