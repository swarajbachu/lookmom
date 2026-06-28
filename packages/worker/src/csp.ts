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
 * - frame-ancestors 'none'        -> cannot be embedded elsewhere
 * - sandbox ...                   -> scripts run, but origin is opaque (no
 *                                    cookie/storage access to the host origin)
 */
export const ARTIFACT_CSP = [
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

/** Maximum rendered artifact size, matching Claude's 16 MiB limit. */
export const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;

/** Response headers applied to every served artifact. */
export function artifactHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": ARTIFACT_CSP,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-origin",
    ...extra,
  };
}
