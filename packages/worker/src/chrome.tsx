/** Server-rendered product chrome (Hono JSX). Minimal, calm UI. */
import type { FC, PropsWithChildren } from "hono/jsx";
import type { Artifact } from "./schema";
import { LOGO_DATA_URI } from "./brand";

/**
 * Design system — quiet surfaces, hairline rings, tabular nums,
 * ease-out micro-interactions, reduced motion, touch-first targets.
 */
const STYLE = `
  :root {
    color-scheme: light dark;
    --bg: #f7f7f8;
    --bg-elevated: #ffffff;
    --fg: #111113;
    --fg-2: #3f3f46;
    --muted: #71717a;
    --line: rgba(15,15,18,0.08);
    --line-strong: rgba(15,15,18,0.12);
    --accent: #5b5bd6;
    --accent-hover: #4a4ac4;
    --accent-soft: rgba(91,91,214,0.09);
    --accent-fg: #ffffff;
    --danger: #e11d48;
    --danger-soft: rgba(225,29,72,0.08);
    --ok: #16a34a;
    --ok-soft: rgba(22,163,74,0.1);
    --radius: 16px;
    --radius-md: 12px;
    --radius-sm: 10px;
    --radius-xs: 8px;
    --shadow-xs: 0 1px 2px rgba(15,15,18,0.04);
    --shadow-sm: 0 1px 2px rgba(15,15,18,0.04), 0 4px 12px rgba(15,15,18,0.04);
    --shadow-md: 0 8px 30px rgba(15,15,18,0.08), 0 0 0 1px var(--line);
    --shadow-ring: 0 0 0 1px var(--line);
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --dur: 160ms;
    --bar-h: 52px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0c0c0e;
      --bg-elevated: #141416;
      --fg: #f4f4f5;
      --fg-2: #d4d4d8;
      --muted: #a1a1aa;
      --line: rgba(255,255,255,0.08);
      --line-strong: rgba(255,255,255,0.12);
      --accent: #8b8cf7;
      --accent-hover: #a5a6ff;
      --accent-soft: rgba(139,140,247,0.12);
      --accent-fg: #0c0c0e;
      --danger: #fb7185;
      --danger-soft: rgba(251,113,133,0.1);
      --ok: #4ade80;
      --ok-soft: rgba(74,222,128,0.12);
      --shadow-xs: 0 1px 2px rgba(0,0,0,0.35);
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.28);
      --shadow-md: 0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px var(--line);
    }
  }

  *, *::before, *::after { box-sizing: border-box; }
  html { height: 100%; }
  body {
    margin: 0;
    min-height: 100%;
    font: 14.5px/1.5 var(--font);
    color: var(--fg);
    background: var(--bg);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  h1, h2, h3 { text-wrap: balance; letter-spacing: -0.025em; margin: 0; font-weight: 600; }
  h1 { font-size: 1.5rem; line-height: 1.2; letter-spacing: -0.03em; }
  h2 { font-size: 1rem; line-height: 1.3; }
  p { margin: 0 0 14px; color: var(--muted); max-width: 42rem; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; text-underline-offset: 2px; }

  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .shell-main {
    flex: 1;
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
    padding: 40px 20px 64px;
  }
  .shell-main.narrow { max-width: 480px; }
  .shell-main.wide { max-width: 1040px; }
  /* Legacy auth pages use .wrap */
  .wrap {
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    padding: 48px 20px 64px;
  }

  /* Top nav */
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: var(--bar-h);
    padding: 0 16px;
    background: color-mix(in srgb, var(--bg-elevated) 86%, transparent);
    backdrop-filter: blur(14px) saturate(1.2);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: var(--fg);
    text-decoration: none !important;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .nav-mark {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    box-shadow: var(--shadow-xs);
    flex-shrink: 0;
    object-fit: cover;
    display: block;
    background: var(--bg-elevated);
  }
  .nav-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .nav-meta {
    font-size: 12.5px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Artifact chrome */
  .viewer {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg);
  }
  .viewer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: var(--bar-h);
    padding: 0 12px 0 14px;
    background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
    backdrop-filter: blur(14px) saturate(1.15);
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }
  .viewer-title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    font-weight: 600;
    font-size: 14px;
    letter-spacing: -0.015em;
  }
  .viewer-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .viewer-emoji {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--bg);
    box-shadow: var(--shadow-ring);
    font-size: 15px;
    flex-shrink: 0;
  }
  .viewer-frame {
    flex: 1;
    border: 0;
    width: 100%;
    background: var(--bg-elevated);
    display: block;
  }

  /* Cards / surfaces */
  .card {
    background: var(--bg-elevated);
    border-radius: var(--radius);
    padding: 28px;
    box-shadow: var(--shadow-md);
  }
  .card.quiet {
    box-shadow: var(--shadow-ring);
    background: transparent;
    padding: 0;
  }
  .kicker {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 8px;
  }
  .lede { margin: 6px 0 0; color: var(--muted); max-width: 40ch; }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 36px;
    padding: 0 14px;
    border-radius: var(--radius-xs);
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    border: 0;
    cursor: pointer;
    text-decoration: none !important;
    background: var(--accent);
    color: var(--accent-fg);
    box-shadow: var(--shadow-xs);
    transition: background var(--dur) ease, transform var(--dur) var(--ease-out),
      box-shadow var(--dur) ease, color var(--dur) ease, opacity var(--dur) ease;
  }
  .btn:hover { background: var(--accent-hover); }
  .btn:active { transform: scale(0.98); }
  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .btn.secondary {
    background: transparent;
    color: var(--fg);
    box-shadow: var(--shadow-ring);
  }
  .btn.secondary:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .btn.ghost {
    background: transparent;
    color: var(--muted);
    box-shadow: none;
    min-height: 32px;
    padding: 0 10px;
  }
  .btn.ghost:hover { color: var(--fg); background: var(--accent-soft); }
  .btn.sm { min-height: 32px; padding: 0 11px; font-size: 13px; }
  .btn:disabled, .btn[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
  .icon-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: var(--radius-xs);
    display: inline-grid;
    place-items: center;
    background: transparent;
    border: 0;
    color: var(--muted);
    cursor: pointer;
    box-shadow: var(--shadow-ring);
    transition: background var(--dur) ease, color var(--dur) ease, transform var(--dur) var(--ease-out);
  }
  .icon-btn:hover { background: var(--accent-soft); color: var(--fg); }
  .icon-btn:active { transform: scale(0.97); }
  .icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .stack { display: flex; flex-direction: column; gap: 12px; }
  .spacer { flex: 1; }
  .mono {
    font-family: var(--mono);
    font-size: 0.9em;
    font-variant-numeric: tabular-nums;
  }

  /* Gallery grid */
  .page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
  }
  .page-head p { margin: 6px 0 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }
  .art-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    border-radius: var(--radius-md);
    background: var(--bg-elevated);
    box-shadow: var(--shadow-ring);
    transition: box-shadow var(--dur) ease, transform var(--dur) var(--ease-out);
    text-decoration: none !important;
    color: inherit;
    min-height: 128px;
  }
  .art-card:hover {
    box-shadow: var(--shadow-sm), var(--shadow-ring);
    transform: translateY(-1px);
  }
  .art-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .art-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .art-emoji {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 18px;
    background: var(--bg);
    box-shadow: var(--shadow-ring);
  }
  .art-title {
    font-weight: 600;
    font-size: 14.5px;
    letter-spacing: -0.015em;
    line-height: 1.3;
    color: var(--fg);
  }
  .art-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: auto;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--muted);
    background: var(--bg);
    border-radius: 999px;
    padding: 3px 9px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .badge.accent {
    color: var(--accent);
    background: var(--accent-soft);
  }

  .empty {
    text-align: center;
    padding: 48px 24px;
    border-radius: var(--radius);
    background: var(--bg-elevated);
    box-shadow: var(--shadow-ring);
  }
  .empty h2 { margin-bottom: 8px; }
  .empty p { margin: 0 auto 18px; max-width: 32ch; }
  .empty .mono {
    display: inline-block;
    padding: 8px 12px;
    border-radius: var(--radius-xs);
    background: var(--bg);
    box-shadow: var(--shadow-ring);
    color: var(--fg-2);
    font-size: 13px;
  }

  /* Forms */
  .err {
    color: var(--danger);
    background: var(--danger-soft);
    font-size: 13.5px;
    margin: 0 0 14px;
    padding: 10px 12px;
    border-radius: var(--radius-xs);
  }
  .ok {
    color: var(--ok);
    background: var(--ok-soft);
    font-size: 13.5px;
    margin: 0 0 14px;
    padding: 10px 12px;
    border-radius: var(--radius-xs);
  }
  input.code {
    font-family: var(--mono);
    font-size: 22px;
    letter-spacing: 0.16em;
    padding: 14px 16px;
    width: 100%;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--fg);
    text-align: center;
    text-transform: uppercase;
    box-shadow: var(--shadow-ring);
    font-variant-numeric: tabular-nums;
  }
  input.code:focus, input.text:focus, textarea.text:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
  }
  input.text, textarea.text {
    font: inherit;
    font-size: 14.5px;
    padding: 10px 12px;
    width: 100%;
    border: 0;
    border-radius: var(--radius-xs);
    background: var(--bg);
    color: var(--fg);
    box-shadow: var(--shadow-ring);
  }
  textarea.text { min-height: 88px; resize: vertical; line-height: 1.45; }
  label.field {
    display: block;
    margin: 12px 0 0;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--muted);
  }
  label.field > input, label.field > textarea { margin-top: 6px; }

  label.share-opt {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin: 0;
    padding: 12px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    box-shadow: var(--shadow-ring);
    background: var(--bg-elevated);
    transition: background var(--dur) ease, box-shadow var(--dur) ease;
  }
  label.share-opt + label.share-opt { margin-top: 8px; }
  label.share-opt:hover { background: color-mix(in srgb, var(--bg) 60%, var(--bg-elevated)); }
  label.share-opt:has(input:checked) {
    background: var(--accent-soft);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  label.share-opt:has(input:disabled) { opacity: 0.5; cursor: not-allowed; }
  label.share-opt input {
    margin-top: 3px;
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    flex-shrink: 0;
  }
  label.share-opt strong {
    display: block;
    color: var(--fg);
    font-weight: 600;
    font-size: 13.5px;
    letter-spacing: -0.01em;
  }
  label.share-opt .hint {
    display: block;
    font-size: 12.5px;
    color: var(--muted);
    margin-top: 2px;
    line-height: 1.4;
  }

  .callout {
    padding: 14px;
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: var(--shadow-ring);
  }
  .callout strong { color: var(--fg); font-size: 13px; }
  .callout p { margin: 6px 0 0; font-size: 13px; max-width: none; }
  .section-label {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 10px;
  }
  .link-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--fg-2);
    background: var(--bg);
    padding: 7px 10px;
    border-radius: 8px;
    box-shadow: var(--shadow-ring);
    word-break: break-all;
    max-width: 100%;
    text-decoration: none !important;
  }
  .link-chip:hover { color: var(--accent); }
  .footer-note {
    margin-top: 24px;
    font-size: 12.5px;
    color: var(--muted);
  }

  /* Modal */
  dialog.modal {
    border: 0;
    padding: 0;
    border-radius: calc(var(--radius) + 2px);
    background: var(--bg-elevated);
    color: var(--fg);
    box-shadow: var(--shadow-md);
    width: min(420px, calc(100vw - 32px));
    max-height: min(88vh, 720px);
    overflow: auto;
  }
  dialog.modal::backdrop {
    background: rgba(10, 10, 12, 0.45);
    backdrop-filter: blur(4px);
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 16px 0;
  }
  .modal-body { padding: 12px 16px 18px; }
  .modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 16px 16px;
  }
  .copy-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
    margin-bottom: 16px;
  }
  .copy-row input {
    flex: 1;
    min-width: 0;
    font-family: var(--mono);
    font-size: 12px;
  }

  .divider {
    height: 1px;
    background: var(--line);
    margin: 18px 0;
    border: 0;
  }

  @media (hover: none) {
    .btn:hover { background: var(--accent); }
    .btn.secondary:hover { background: transparent; color: var(--fg); }
    .art-card:hover { transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }
  @media (max-width: 560px) {
    .shell-main { padding: 28px 16px 48px; }
    .card { padding: 22px 18px; }
    .nav-meta { display: none; }
    .page-head { flex-direction: column; }
  }
`;

const SHARE_SCRIPT = `
(function () {
  var dlg = document.getElementById('share-dialog');
  var openBtn = document.getElementById('share-open');
  var closeBtns = document.querySelectorAll('[data-close-share]');
  var copyBtn = document.getElementById('copy-link');
  var linkInput = document.getElementById('share-link');
  if (openBtn && dlg) {
    openBtn.addEventListener('click', function () {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    });
  }
  closeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (dlg && typeof dlg.close === 'function') dlg.close();
      else if (dlg) dlg.removeAttribute('open');
    });
  });
  if (copyBtn && linkInput) {
    copyBtn.addEventListener('click', function () {
      var v = linkInput.value;
      function done() {
        var t = copyBtn.textContent;
        copyBtn.textContent = 'Copied';
        setTimeout(function () { copyBtn.textContent = t; }, 1200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v).then(done).catch(function () {
          linkInput.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
        });
      } else {
        linkInput.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
      }
    });
  }
  // Open dialog when redirected back with ?shared=1
  if (dlg && /[?&]shared=1\\b/.test(location.search)) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
  }
})();
`;

export const Layout: FC<
  PropsWithChildren<{
    title: string;
    bare?: boolean;
    navRight?: unknown;
  }>
> = ({ title, children, bare }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <title>{title}</title>
      <link rel="icon" href="/logo.png" type="image/png" />
      <link rel="apple-touch-icon" href="/logo.png" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
    </head>
    <body class={bare ? undefined : "shell"}>{children}</body>
  </html>
);

function AppNav(props: { email?: string; right?: "gallery" | "none" }) {
  return (
    <header class="nav">
      <a class="nav-brand" href="/gallery">
        <img class="nav-mark" src={LOGO_DATA_URI} width={24} height={24} alt="" />
        lookmom
      </a>
      <div class="nav-actions">
        {props.email ? <span class="nav-meta mono">{props.email}</span> : null}
        {props.right === "gallery" ? (
          <a class="btn secondary sm" href="/gallery">
            Gallery
          </a>
        ) : null}
      </div>
    </header>
  );
}

export const LoginPrompt: FC<{
  title: string;
  loginUrl: string;
  githubLoginUrl?: string;
  teamShare?: boolean;
  message?: string;
}> = ({ title, loginUrl, githubLoginUrl, teamShare, message }) => (
  <Layout title="Sign in · lookmom">
    <AppNav />
    <main class="shell-main narrow">
      <div class="card">
        <p class="kicker">Private artifact</p>
        <h1>Sign in to view</h1>
        <p style="margin-top:8px">
          {message ??
            (teamShare
              ? `“${title}” is shared with a GitHub team. Sign in with GitHub to check membership.`
              : `“${title}” is private. Sign in so we can check whether you have access.`)}
        </p>
        <div class="row" style="margin-top:20px">
          {githubLoginUrl ? (
            <a class="btn" href={githubLoginUrl}>
              Continue with GitHub
            </a>
          ) : null}
          {!teamShare || !githubLoginUrl ? (
            <a class={githubLoginUrl ? "btn secondary" : "btn"} href={loginUrl}>
              Continue
            </a>
          ) : (
            <a class="btn secondary" href={loginUrl}>
              Other sign-in
            </a>
          )}
        </div>
      </div>
    </main>
  </Layout>
);

export const AccessDenied: FC<{
  email: string;
  switchUrl: string;
  message?: string;
}> = ({ email, switchUrl, message }) => (
  <Layout title="No access · lookmom">
    <AppNav email={email} />
    <main class="shell-main narrow">
      <div class="card">
        <p class="kicker">Access</p>
        <h1>You don’t have access</h1>
        <p style="margin-top:8px">
          {message ??
            `You’re signed in as ${email}, which isn’t on this artifact’s allowlist. Ask the owner to add you, or switch accounts.`}
        </p>
        <p style="margin-bottom:18px">
          Account: <span class="mono">{email}</span>
        </p>
        <a class="btn secondary" href={switchUrl}>
          Use a different account
        </a>
      </div>
    </main>
  </Layout>
);

export const GithubNotConfigured: FC = () => (
  <Layout title="GitHub not configured · lookmom">
    <AppNav />
    <main class="shell-main narrow">
      <div class="card">
        <p class="kicker">Configuration</p>
        <h1>GitHub share unavailable</h1>
        <p style="margin-top:8px">
          This artifact is shared with a GitHub organization, but this lookmom
          instance has no GitHub login configured. The operator needs WorkOS
          with GitHub OAuth (return tokens + <span class="mono">read:org</span>
          ), or <span class="mono">GITHUB_CLIENT_ID</span> /{" "}
          <span class="mono">GITHUB_CLIENT_SECRET</span>.
        </p>
      </div>
    </main>
  </Layout>
);

function shareModeLabel(mode: string): string {
  if (mode === "github_team") return "Org";
  if (mode === "allowlist") return "People";
  if (mode === "public") return "Public";
  return "Private";
}

/** Gate chrome: floating bar + optional share dialog + sandboxed iframe. */
export const ArtifactFrame: FC<{
  id: string;
  title: string;
  emoji: string;
  rawUrl: string;
  canShare: boolean;
  shareUrl: string;
  viewUrl: string;
  shareMode?: string;
  githubOrg?: string | null;
  githubTeam?: string | null;
  githubConnected?: boolean;
  githubAvailable?: boolean;
  connectUrl?: string;
}> = ({
  id,
  title,
  emoji,
  rawUrl,
  canShare,
  shareUrl,
  viewUrl,
  shareMode = "private",
  githubOrg,
  githubTeam,
  githubConnected,
  githubAvailable,
  connectUrl,
}) => (
  <Layout title={`${emoji} ${title}`} bare>
    <div class="viewer">
      <header class="viewer-bar">
        <div class="viewer-title">
          <span class="viewer-emoji" aria-hidden="true">
            {emoji || "📄"}
          </span>
          <span>{title}</span>
        </div>
        <div class="row">
          <a class="btn ghost sm" href="/gallery">
            Gallery
          </a>
          {canShare ? (
            <>
              <button type="button" class="btn secondary sm" id="share-open">
                Share
              </button>
              <a class="btn ghost sm" href={shareUrl}>
                Full page
              </a>
            </>
          ) : null}
        </div>
      </header>

      <iframe class="viewer-frame" src={rawUrl} sandbox="allow-scripts allow-popups allow-downloads" title={title} />

      {canShare ? (
        <dialog class="modal" id="share-dialog" aria-labelledby="share-dialog-title">
          <div class="modal-head">
            <div>
              <p class="kicker" style="margin:0">Share</p>
              <h2 id="share-dialog-title">{title}</h2>
            </div>
            <button type="button" class="icon-btn" data-close-share aria-label="Close">
              ✕
            </button>
          </div>
          <div class="modal-body">
            <div class="copy-row">
              <input class="text" id="share-link" readonly value={viewUrl} aria-label="Artifact link" />
              <button type="button" class="btn secondary sm" id="copy-link">
                Copy
              </button>
            </div>

            <form method="post" action={`/share/${id}/mode`}>
              <input type="hidden" name="return_to" value={`/a/${id}?shared=1`} />
              <span class="section-label">Who can view</span>

              <label class="share-opt">
                <input type="radio" name="mode" value="private" checked={shareMode === "private"} />
                <span>
                  <strong>Only me</strong>
                  <span class="hint">Private — just your account</span>
                </span>
              </label>
              <label class="share-opt">
                <input type="radio" name="mode" value="allowlist" checked={shareMode === "allowlist"} />
                <span>
                  <strong>Specific people</strong>
                  <span class="hint">Emails you add below</span>
                </span>
              </label>
              <label class="share-opt">
                <input type="radio" name="mode" value="public" checked={shareMode === "public"} />
                <span>
                  <strong>Anyone with the link</strong>
                  <span class="hint">Public — no sign-in to view</span>
                </span>
              </label>
              <label class="share-opt">
                <input
                  type="radio"
                  name="mode"
                  value="github_team"
                  checked={shareMode === "github_team"}
                  disabled={!githubAvailable}
                />
                <span>
                  <strong>GitHub organization</strong>
                  <span class="hint">Org or team members (GitHub sign-in)</span>
                </span>
              </label>

              {!githubAvailable ? (
                <p class="err" style="margin-top:12px">
                  GitHub org share isn’t configured on this instance.
                </p>
              ) : !githubConnected ? (
                <div class="callout" style="margin-top:12px">
                  <strong>Connect GitHub</strong>
                  <p>Needed once for org membership checks.</p>
                  {connectUrl ? (
                    <div class="row" style="margin-top:10px">
                      <a class="btn sm" href={connectUrl}>
                        Connect GitHub
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div class="callout" style="margin-top:12px">
                  <strong>Organization</strong>
                  <label class="field">
                    Org slug
                    <input class="text" name="github_org" placeholder="acme" value={githubOrg ?? ""} autocomplete="off" />
                  </label>
                  <label class="field">
                    Team (optional)
                    <input class="text" name="github_team" placeholder="eng" value={githubTeam ?? ""} autocomplete="off" />
                  </label>
                </div>
              )}

              <div class="modal-foot" style="padding:16px 0 0">
                <button type="button" class="btn ghost" data-close-share>
                  Cancel
                </button>
                <button class="btn" type="submit">
                  Save
                </button>
              </div>
            </form>

            <hr class="divider" />

            <form method="post" action={`/share/${id}/allow`}>
              <input type="hidden" name="return_to" value={`/a/${id}?shared=1`} />
              <span class="section-label">Add emails</span>
              <textarea class="text" name="emails" placeholder="alice@example.com, bob@example.com" aria-label="Emails" />
              <div class="row" style="margin-top:10px;justify-content:flex-end">
                <button class="btn secondary sm" type="submit">
                  Add emails
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}

      <script dangerouslySetInnerHTML={{ __html: SHARE_SCRIPT }} />
    </div>
  </Layout>
);

export const Gallery: FC<{
  email: string;
  artifacts: Artifact[];
  host: string;
  githubLogin?: string;
}> = ({ email, artifacts, host, githubLogin }) => (
  <Layout title="Your artifacts · lookmom">
    <AppNav email={email} />
    <main class="shell-main wide">
      <div class="page-head">
        <div>
          <p class="kicker">Library</p>
          <h1>Your artifacts</h1>
          <p class="lede">
            Signed in as <span class="mono">{email}</span>
            {githubLogin ? (
              <>
                {" "}
                · <span class="mono">@{githubLogin}</span>
              </>
            ) : null}
          </p>
        </div>
        <a class="btn secondary" href="/connect/github?return_to=/gallery">
          {githubLogin ? "GitHub" : "Connect GitHub"}
        </a>
      </div>

      {artifacts.length === 0 ? (
        <div class="empty">
          <h2>Nothing here yet</h2>
          <p>Publish from your agent or terminal, then it shows up here.</p>
          <span class="mono">lookmom publish ./artifact</span>
        </div>
      ) : (
        <div class="grid">
          {artifacts.map((a) => (
            <a class="art-card" href={`${host}/a/${a.id}`}>
              <div class="art-card-top">
                <span class="art-emoji" aria-hidden="true">
                  {a.emoji || "📄"}
                </span>
                <span class="badge">v{a.currentVersion}</span>
              </div>
              <div class="art-title">{a.title}</div>
              <div class="art-meta">
                <span class="badge accent">{shareModeLabel(a.shareMode)}</span>
                {a.shareMode === "github_team" && a.githubOrg ? (
                  <span class="badge">
                    {a.githubTeam ? `${a.githubOrg}/${a.githubTeam}` : a.githubOrg}
                  </span>
                ) : null}
              </div>
            </a>
          ))}
        </div>
      )}

      <p class="footer-note">
        Tip: open an artifact and use <strong style="color:var(--fg);font-weight:600">Share</strong> for a quick dialog —
        or visit the full share page when agents send you there.
      </p>
    </main>
  </Layout>
);

export const ConfirmAgent: FC<{
  email: string;
  prefill?: string;
  error?: string;
  success?: boolean;
}> = ({ email, prefill, error, success }) => (
  <Layout title="Authorize agent · lookmom">
    <AppNav email={email} right="gallery" />
    <main class="shell-main narrow">
      <div class="card">
        <p class="kicker">Device</p>
        <h1>Authorize publishing</h1>
        {success ? (
          <p class="ok" style="margin-top:14px">
            Authorized. You can return to your agent — it can publish now.
          </p>
        ) : (
          <>
            <p style="margin-top:8px">
              Signed in as <span class="mono">{email}</span>. Enter the code your agent
              showed you.
            </p>
            {error ? <p class="err">{error}</p> : null}
            <form method="post" action="/agent/confirm">
              <input
                class="code"
                name="user_code"
                placeholder="XXXX-XXXX"
                value={prefill ?? ""}
                autocomplete="off"
                maxlength={9}
                required
                aria-label="Authorization code"
              />
              <div class="row" style="margin-top:16px">
                <button class="btn" type="submit">
                  Authorize
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  </Layout>
);
