/**
 * Strict Content-Security-Policy for served artifacts, mirroring Claude's
 * artifact sandbox: no external requests of any kind. Everything an artifact
 * needs must be inlined (CSS/JS) or embedded as a data: URI (images/fonts).
 *
 * - default-src 'none'            -> deny everything not explicitly allowed
 * - script-src 'unsafe-inline'    -> inline <script> only, no external/eval
 * - style-src  'unsafe-inline'    -> inline styles only
 * - img-src data: blob:           -> embedded images only
 * - font-src  data:               -> embedded fonts only
 * - connect-src 'none'            -> blocks fetch / XHR / WebSocket
 * - frame-ancestors <gate>        -> only the lookmom gate may iframe the page
 * - sandbox ...                   -> scripts run, but origin is opaque (no
 *                                    cookie/storage access to the host origin)
 *
 * Note: frame-ancestors cannot be 'none' — the gate always loads /raw in an
 * iframe. We allow only the configured app (gate) origin.
 */
export function buildArtifactCsp(frameAncestors: string[]): string {
  const ancestors =
    frameAncestors.length > 0
      ? frameAncestors.join(" ")
      : "'none'";
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src data: blob:",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${ancestors}`,
    "sandbox allow-scripts allow-popups allow-downloads",
  ].join("; ");
}

/** Static CSP used when no gate host is known (tests / fallback). */
export const ARTIFACT_CSP = buildArtifactCsp(["'none'"]);

/** Maximum rendered artifact size, matching Claude's 16 MiB limit. */
export const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;

/** Response headers applied to every served artifact. */
export function artifactHeaders(
  extra?: Record<string, string>,
  opts?: { gateOrigin?: string },
): HeadersInit {
  const ancestors: string[] = [];
  if (opts?.gateOrigin) {
    try {
      ancestors.push(new URL(opts.gateOrigin).origin);
    } catch {
      /* ignore bad host */
    }
  }
  // Local/dev often serves gate + sandbox on the same origin.
  if (ancestors.length === 0) ancestors.push("'self'");

  return {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": buildArtifactCsp(ancestors),
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    // cross-origin so the gate host can embed the sandbox host in an iframe
    "cross-origin-resource-policy": "cross-origin",
    ...extra,
  };
}
