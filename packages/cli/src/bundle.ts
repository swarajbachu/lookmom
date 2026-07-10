/**
 * Bundle a multi-file artifact project into one self-contained HTML string.
 *
 * Agents can author clean modular files (index.html + styles/*.css +
 * scripts/*.js + partials) and lookmom inlines everything so the published
 * page satisfies the strict CSP (no external requests).
 *
 * Supported inlining:
 *   - <link rel="stylesheet" href="relative.css">
 *   - @import "relative.css" inside CSS (url() and bare)
 *   - <script src="relative.js"> (classic scripts only)
 *   - <!-- lookmom:include path/to/partial.html -->
 *   - <img src="relative.(png|jpg|svg|gif|webp)"> → data: URI (≤ 512 KiB)
 *   - url(relative.asset) in CSS → data: URI when small enough
 *
 * Absolute http(s):// and protocol-relative // URLs are left alone (and will
 * break under production CSP — preview surfaces that).
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { dirname, extname, join, resolve, relative, isAbsolute } from "node:path";

const MAX_DATA_URI_BYTES = 512 * 1024;
const MIME: Record<string, string> = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".html": "text/html",
  ".htm": "text/html",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export interface BundleResult {
  html: string;
  entry: string;
  inlined: string[];
  warnings: string[];
  bytes: number;
}

export interface BundleOptions {
  /** Soft size warning threshold (default 4 MiB). Hard limit is still 16 MiB at publish. */
  warnBytes?: number;
}

function isRemote(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || /^(data|blob|mailto|javascript):/i.test(href);
}

function stripQueryHash(href: string): string {
  return href.split(/[?#]/)[0] ?? href;
}

function resolveLocal(fromDir: string, href: string): string | null {
  if (!href || isRemote(href)) return null;
  const clean = stripQueryHash(href.trim());
  if (!clean || clean.startsWith("#")) return null;
  const abs = isAbsolute(clean) ? clean : resolve(fromDir, clean);
  if (!existsSync(abs)) return null;
  try {
    if (!statSync(abs).isFile()) return null;
  } catch {
    return null;
  }
  return abs;
}

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

function toDataUri(path: string): string | null {
  try {
    const buf = readFileSync(path);
    if (buf.byteLength > MAX_DATA_URI_BYTES) return null;
    const ext = extname(path).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    if (ext === ".svg") {
      // Prefer utf8 SVG data URIs for sharpness / editability.
      const text = buf.toString("utf8");
      return `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
    }
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function mimeNote(path: string): string {
  return relative(process.cwd(), path) || path;
}

/** Inline nested @import and url() for local assets. */
function processCss(
  css: string,
  filePath: string,
  stack: Set<string>,
  inlined: string[],
  warnings: string[],
): string {
  const dir = dirname(filePath);
  if (stack.has(filePath)) {
    warnings.push(`Circular CSS import: ${mimeNote(filePath)}`);
    return "/* circular import skipped */";
  }
  stack.add(filePath);

  // @import "x" | @import url("x") — only simple forms; leave media queries on remote alone.
  css = css.replace(
    /@import\s+(?:url\(\s*)?['"]?([^'")\s]+)['"]?\s*\)?\s*;/gi,
    (full, href: string) => {
      if (isRemote(href)) return full;
      const abs = resolveLocal(dir, href);
      if (!abs) {
        warnings.push(`Missing CSS import: ${href} (from ${mimeNote(filePath)})`);
        return `/* missing @import ${href} */`;
      }
      inlined.push(abs);
      const nested = processCss(readText(abs), abs, stack, inlined, warnings);
      return `/* inlined: ${mimeNote(abs)} */\n${nested}`;
    },
  );

  // url(...) local assets
  css = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _q: string, href: string) => {
    if (isRemote(href) || href.startsWith("#") || href.startsWith("data:")) return full;
    const abs = resolveLocal(dir, href);
    if (!abs) {
      warnings.push(`Missing CSS url(): ${href} (from ${mimeNote(filePath)})`);
      return full;
    }
    const data = toDataUri(abs);
    if (!data) {
      warnings.push(`Asset too large to inline (>${MAX_DATA_URI_BYTES} bytes): ${mimeNote(abs)}`);
      return full;
    }
    inlined.push(abs);
    return `url("${data}")`;
  });

  stack.delete(filePath);
  return css;
}

function processHtmlIncludes(
  html: string,
  filePath: string,
  stack: Set<string>,
  inlined: string[],
  warnings: string[],
): string {
  const dir = dirname(filePath);
  if (stack.has(filePath)) {
    warnings.push(`Circular HTML include: ${mimeNote(filePath)}`);
    return `<!-- circular include skipped: ${mimeNote(filePath)} -->`;
  }
  stack.add(filePath);

  // <!-- lookmom:include path/to/file.html -->
  html = html.replace(
    /<!--\s*lookmom:include\s+([^\s]+)\s*-->/gi,
    (_full, href: string) => {
      const abs = resolveLocal(dir, href);
      if (!abs) {
        warnings.push(`Missing include: ${href} (from ${mimeNote(filePath)})`);
        return `<!-- missing include: ${href} -->`;
      }
      inlined.push(abs);
      const body = processHtmlIncludes(readText(abs), abs, stack, inlined, warnings);
      return `<!-- begin include: ${mimeNote(abs)} -->\n${body}\n<!-- end include: ${mimeNote(abs)} -->`;
    },
  );

  stack.delete(filePath);
  return html;
}

/**
 * Resolve entry path: directory → index.html, else the file itself.
 */
export function resolveEntry(path: string): string {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`Not found: ${path}`);
  }
  const st = statSync(abs);
  if (st.isDirectory()) {
    for (const name of ["index.html", "index.htm", "main.html"]) {
      const candidate = join(abs, name);
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    throw new Error(
      `No index.html in directory ${path}. Expected index.html, index.htm, or main.html.`,
    );
  }
  return abs;
}

/**
 * Bundle an HTML entry (or project directory) into one self-contained HTML document.
 */
export function bundleArtifact(path: string, opts: BundleOptions = {}): BundleResult {
  const entry = resolveEntry(path);
  const inlined: string[] = [entry];
  const warnings: string[] = [];
  const cssStack = new Set<string>();
  const htmlStack = new Set<string>();

  let html = readText(entry);
  html = processHtmlIncludes(html, entry, htmlStack, inlined, warnings);

  const entryDir = dirname(entry);

  // Stylesheets: <link rel="stylesheet" href="...">
  html = html.replace(
    /<link\b([^>]*?)>/gi,
    (full, attrs: string) => {
      const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (!href) return full;
      // stylesheet or empty rel with .css
      const isStyle =
        rel.split(/\s+/).includes("stylesheet") ||
        (!rel && href.toLowerCase().endsWith(".css"));
      if (!isStyle) return full;
      if (isRemote(href)) {
        warnings.push(`External stylesheet left as-is (will fail CSP): ${href}`);
        return full;
      }
      const abs = resolveLocal(entryDir, href);
      if (!abs) {
        warnings.push(`Missing stylesheet: ${href}`);
        return `<!-- missing stylesheet: ${href} -->`;
      }
      inlined.push(abs);
      const css = processCss(readText(abs), abs, cssStack, inlined, warnings);
      return `<style data-lookmom-src="${escapeAttr(mimeNote(abs))}">\n${css}\n</style>`;
    },
  );

  // External scripts: <script src="..."></script>
  html = html.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs: string, inlineBody: string) => {
      const src = /src\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (!src) {
        // already inline — keep
        return full;
      }
      if (isRemote(src)) {
        warnings.push(`External script left as-is (will fail CSP): ${src}`);
        return full;
      }
      const type = /type\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
      if (type === "module") {
        warnings.push(
          `ES module scripts are not bundled (${src}). Use classic <script src> or inline the module body.`,
        );
        return full;
      }
      const abs = resolveLocal(entryDir, src);
      if (!abs) {
        warnings.push(`Missing script: ${src}`);
        return `<!-- missing script: ${src} -->`;
      }
      inlined.push(abs);
      const code = readText(abs);
      // Preserve other attrs except src
      const cleaned = attrs
        .replace(/\s*src\s*=\s*["'][^"']*["']/i, "")
        .replace(/\s*defer\b/i, "")
        .replace(/\s*async\b/i, "")
        .trim();
      const attrStr = cleaned ? ` ${cleaned}` : "";
      return `<script data-lookmom-src="${escapeAttr(mimeNote(abs))}"${attrStr}>\n${code}\n</script>`;
    },
  );

  // Images with local src
  html = html.replace(
    /<img\b([^>]*?)>/gi,
    (full, attrs: string) => {
      const src = /src\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (!src || isRemote(src)) return full;
      const abs = resolveLocal(entryDir, src);
      if (!abs) {
        warnings.push(`Missing image: ${src}`);
        return full;
      }
      const data = toDataUri(abs);
      if (!data) {
        warnings.push(`Image too large to inline: ${mimeNote(abs)}`);
        return full;
      }
      inlined.push(abs);
      const newAttrs = attrs.replace(/src\s*=\s*["'][^"']*["']/i, `src="${data}"`);
      return `<img${newAttrs}>`;
    },
  );

  // Inline <style> blocks may still @import local CSS — process those too.
  html = html.replace(
    /<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
    (full, attrs: string, body: string) => {
      // Skip already-inlined (have data-lookmom-src) only for processing? still process @import
      const css = processCss(body, entry, cssStack, inlined, warnings);
      return `<style${attrs}>${css}</style>`;
    },
  );

  const bytes = Buffer.byteLength(html, "utf8");
  const warnBytes = opts.warnBytes ?? 4 * 1024 * 1024;
  if (bytes > warnBytes) {
    warnings.push(
      `Bundled size is ${(bytes / (1024 * 1024)).toFixed(2)} MiB (soft warn at ${(warnBytes / (1024 * 1024)).toFixed(0)} MiB; hard limit 16 MiB).`,
    );
  }

  // Dedupe inlined list for reporting
  const unique = [...new Set(inlined.map((p) => resolve(p)))];

  return {
    html,
    entry,
    inlined: unique,
    warnings,
    bytes,
  };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Write bundled HTML to a path (used by `lookmom pack`). */
export function packToFile(input: string, output: string, opts?: BundleOptions): BundleResult {
  const result = bundleArtifact(input, opts);
  const outAbs = resolve(output);
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, result.html, "utf8");
  return result;
}
