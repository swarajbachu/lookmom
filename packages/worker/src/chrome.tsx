/** Server-rendered chrome pages (Hono JSX → HTML string, no client JS). */
import type { FC, PropsWithChildren } from "hono/jsx";
import type { Artifact } from "./schema";

/**
 * Product chrome design system — Emil Kowalski–style polish:
 * no layout shift, hairline borders via shadow, tabular nums, reduced motion,
 * touch-first targets, antialiased type, ease-out micro-interactions.
 */
const STYLE = `
  :root {
    color-scheme: light dark;
    --fg: #0a0a0b;
    --fg-secondary: #3f3f46;
    --muted: #71717a;
    --bg: #f4f4f5;
    --bg-elevated: #fafafa;
    --card: #ffffff;
    --line: rgba(0,0,0,0.08);
    --line-strong: rgba(0,0,0,0.12);
    --accent: #4f46e5;
    --accent-hover: #4338ca;
    --accent-soft: rgba(79,70,229,0.08);
    --accent-fg: #ffffff;
    --danger: #dc2626;
    --danger-soft: rgba(220,38,38,0.08);
    --ok: #16a34a;
    --ok-soft: rgba(22,163,74,0.1);
    --radius: 14px;
    --radius-sm: 10px;
    --radius-xs: 8px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
    --shadow-ring: 0 0 0 1px var(--line);
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --dur: 160ms;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #fafafa;
      --fg-secondary: #d4d4d8;
      --muted: #a1a1aa;
      --bg: #09090b;
      --bg-elevated: #0c0c0e;
      --card: #141417;
      --line: rgba(255,255,255,0.08);
      --line-strong: rgba(255,255,255,0.14);
      --accent: #818cf8;
      --accent-hover: #a5b4fc;
      --accent-soft: rgba(129,140,248,0.12);
      --accent-fg: #0a0a0b;
      --danger: #f87171;
      --danger-soft: rgba(248,113,113,0.1);
      --ok: #4ade80;
      --ok-soft: rgba(74,222,128,0.12);
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
      --shadow: 0 1px 2px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.35);
      --shadow-ring: 0 0 0 1px var(--line);
    }
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { height: 100%; }
  body {
    margin: 0;
    min-height: 100%;
    font: 15px/1.55 var(--font);
    color: var(--fg);
    background: var(--bg);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  h1, h2, h3 { text-wrap: balance; letter-spacing: -0.02em; }
  h1 { font-size: 1.375rem; font-weight: 650; margin: 0 0 6px; line-height: 1.25; }
  h2 { font-size: 1.05rem; font-weight: 600; margin: 0 0 8px; }
  p { color: var(--muted); margin: 0 0 18px; max-width: 52ch; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; text-underline-offset: 2px; }

  .wrap {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 20px 64px;
  }
  .wrap.wide { max-width: 880px; }
  .card {
    background: var(--card);
    border-radius: var(--radius);
    padding: 28px 28px 32px;
    box-shadow: var(--shadow-ring), var(--shadow);
  }
  .card > :last-child { margin-bottom: 0; }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 16px;
    border-radius: var(--radius-xs);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    border: 0;
    cursor: pointer;
    text-decoration: none !important;
    background: var(--accent);
    color: var(--accent-fg);
    box-shadow: var(--shadow-sm);
    transition: background var(--dur) ease, transform var(--dur) var(--ease-out),
      box-shadow var(--dur) ease, color var(--dur) ease;
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
    min-height: 36px;
    padding: 0 10px;
  }
  .btn.ghost:hover { color: var(--fg); background: var(--accent-soft); }
  .btn:disabled, .btn[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }

  .mono {
    font-family: var(--mono);
    font-size: 0.92em;
    font-variant-numeric: tabular-nums;
  }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .stack { display: flex; flex-direction: column; gap: 12px; }

  .list { list-style: none; padding: 0; margin: 20px 0 0; }
  .item {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    gap: 10px 12px;
    align-items: center;
    padding: 14px 4px;
    border-top: 1px solid var(--line);
    transition: background var(--dur) ease;
  }
  .item:first-child { border-top: 0; }
  .item .emoji {
    width: 28px; height: 28px;
    display: grid; place-items: center;
    font-size: 16px;
    border-radius: 8px;
    background: var(--bg);
    box-shadow: var(--shadow-ring);
  }
  .item .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; }
  .item a.title-link {
    color: var(--fg);
    font-weight: 600;
    letter-spacing: -0.01em;
    text-decoration: none;
  }
  .item a.title-link:hover { color: var(--accent); }
  .item .sub {
    display: block;
    font-size: 12.5px;
    color: var(--muted);
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--muted);
    box-shadow: var(--shadow-ring);
    border-radius: 999px;
    padding: 3px 9px;
    letter-spacing: 0.01em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .badge.accent {
    color: var(--accent);
    background: var(--accent-soft);
    box-shadow: none;
  }

  .err {
    color: var(--danger);
    background: var(--danger-soft);
    font-size: 13.5px;
    margin: 0 0 16px;
    padding: 10px 12px;
    border-radius: var(--radius-xs);
  }
  .ok {
    color: var(--ok);
    background: var(--ok-soft);
    font-size: 13.5px;
    margin: 0 0 16px;
    padding: 10px 12px;
    border-radius: var(--radius-xs);
  }

  input.code {
    font-family: var(--mono);
    font-size: 22px;
    letter-spacing: 0.18em;
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
    transition: box-shadow var(--dur) ease;
  }
  input.code:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
  }
  input.text, textarea.text {
    font: inherit;
    font-size: 15px;
    padding: 10px 12px;
    width: 100%;
    border: 0;
    border-radius: var(--radius-xs);
    background: var(--bg);
    color: var(--fg);
    box-shadow: var(--shadow-ring);
    transition: box-shadow var(--dur) ease;
  }
  input.text:focus, textarea.text:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
  }
  textarea.text { min-height: 96px; resize: vertical; line-height: 1.45; }
  label.field {
    display: block;
    margin: 14px 0 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }
  label.field > input, label.field > textarea { margin-top: 6px; }

  label.share-opt {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin: 8px 0;
    padding: 12px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    box-shadow: var(--shadow-ring);
    background: var(--card);
    transition: background var(--dur) ease, box-shadow var(--dur) ease;
  }
  label.share-opt:hover { background: var(--bg-elevated); }
  label.share-opt:has(input:checked) {
    background: var(--accent-soft);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  label.share-opt:has(input:disabled) { opacity: 0.55; cursor: not-allowed; }
  label.share-opt input {
    margin-top: 3px;
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    flex-shrink: 0;
  }
  label.share-opt strong { display: block; color: var(--fg); font-weight: 600; font-size: 14px; }
  label.share-opt .hint { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; line-height: 1.4; }

  .callout {
    padding: 14px 14px 16px;
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: var(--shadow-ring);
  }
  .callout strong { color: var(--fg); font-size: 13.5px; }
  .callout p { margin: 6px 0 0; font-size: 13px; max-width: none; }
  .callout a { color: var(--accent); }

  header.bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 16px;
    height: 48px;
    background: color-mix(in srgb, var(--card) 92%, transparent);
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    box-shadow: 0 1px 0 var(--line);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  header.bar .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  header.bar .mark {
    width: 22px; height: 22px;
    border-radius: 6px;
    background: linear-gradient(135deg, var(--accent), #c084fc);
    flex-shrink: 0;
    box-shadow: var(--shadow-sm);
  }
  header.bar .title {
    font-weight: 600;
    font-size: 14px;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  header.bar .actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

  .page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 4px;
  }
  .page-head p { margin-bottom: 0; }
  .kicker {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 8px;
  }
  .empty {
    margin-top: 24px;
    padding: 28px 20px;
    text-align: center;
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: var(--shadow-ring);
  }
  .empty p { margin: 0 auto; max-width: 36ch; }
  .empty .mono { display: inline-block; margin-top: 10px; color: var(--fg-secondary); }

  .section-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 10px;
  }
  .link-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--fg-secondary);
    background: var(--bg);
    padding: 6px 10px;
    border-radius: 8px;
    box-shadow: var(--shadow-ring);
    word-break: break-all;
    max-width: 100%;
  }
  .link-chip:hover { color: var(--accent); text-decoration: none; }

  .footer-note {
    margin-top: 20px;
    font-size: 12.5px;
    color: var(--muted);
  }

  @media (hover: none) {
    .btn:hover { background: var(--accent); }
    .btn.secondary:hover { background: transparent; color: var(--fg); }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }
  @media (max-width: 520px) {
    .wrap { padding: 28px 16px 48px; }
    .card { padding: 22px 18px 26px; }
    .item { grid-template-columns: 28px 1fr; }
    .item .meta { grid-column: 2; justify-content: flex-start; }
  }
`;

export const Layout: FC<PropsWithChildren<{ title: string }>> = ({
  title,
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <title>{title}</title>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
    </head>
    <body>{children}</body>
  </html>
);

export const LoginPrompt: FC<{
  title: string;
  loginUrl: string;
  githubLoginUrl?: string;
  teamShare?: boolean;
  message?: string;
}> = ({ title, loginUrl, githubLoginUrl, teamShare, message }) => (
  <Layout title="Sign in · lookmom">
    <div class="wrap">
      <div class="card">
        <p class="kicker">lookmom</p>
        <h1>Sign in to view</h1>
        <p>
          {message ??
            (teamShare
              ? `“${title}” is shared with a GitHub team. Sign in with GitHub to check membership.`
              : `“${title}” is a private artifact. Sign in to check whether you have access.`)}
        </p>
        <div class="row">
          {githubLoginUrl ? (
            <a class="btn" href={githubLoginUrl}>
              Sign in with GitHub
            </a>
          ) : null}
          {!teamShare || !githubLoginUrl ? (
            <a class={githubLoginUrl ? "btn secondary" : "btn"} href={loginUrl}>
              Sign in
            </a>
          ) : (
            <a class="btn secondary" href={loginUrl}>
              Other sign-in
            </a>
          )}
        </div>
      </div>
    </div>
  </Layout>
);

export const AccessDenied: FC<{
  email: string;
  switchUrl: string;
  message?: string;
}> = ({ email, switchUrl, message }) => (
  <Layout title="No access · lookmom">
    <div class="wrap">
      <div class="card">
        <p class="kicker">lookmom</p>
        <h1>You don’t have access</h1>
        <p>
          {message ??
            `You’re signed in as ${email}, which isn’t on this artifact’s allowlist. Ask the owner to add you, or sign in with a different account.`}
        </p>
        <p style="margin-bottom:20px">
          Account: <span class="mono">{email}</span>
        </p>
        <a class="btn secondary" href={switchUrl}>
          Use a different account
        </a>
      </div>
    </div>
  </Layout>
);

export const GithubNotConfigured: FC = () => (
  <Layout title="GitHub not configured · lookmom">
    <div class="wrap">
      <div class="card">
        <p class="kicker">lookmom</p>
        <h1>GitHub team share unavailable</h1>
        <p>
          This artifact is shared with a GitHub organization, but this lookmom
          instance has no GitHub login configured. The operator needs WorkOS
          with GitHub OAuth (return tokens + <span class="mono">read:org</span>
          ), or <span class="mono">GITHUB_CLIENT_ID</span> /{" "}
          <span class="mono">GITHUB_CLIENT_SECRET</span>.
        </p>
      </div>
    </div>
  </Layout>
);

/** Thin gate header wrapping the sandboxed artifact iframe. */
export const ArtifactFrame: FC<{
  title: string;
  emoji: string;
  rawUrl: string;
  canShare: boolean;
  shareUrl: string;
}> = ({ title, emoji, rawUrl, canShare, shareUrl }) => (
  <Layout title={`${emoji} ${title}`}>
    <header class="bar">
      <div class="brand">
        <span class="mark" aria-hidden="true" />
        <span class="title">
          {emoji} {title}
        </span>
      </div>
      <div class="actions">
        {canShare ? (
          <a class="btn secondary" href={shareUrl} style="min-height:32px;padding:0 12px;font-size:13px">
            Share
          </a>
        ) : null}
      </div>
    </header>
    <iframe
      src={rawUrl}
      sandbox="allow-scripts allow-popups allow-downloads"
      style="border:0;width:100%;height:calc(100vh - 48px);display:block;background:var(--card)"
      title={title}
    />
  </Layout>
);

function shareLabel(mode: string): string {
  if (mode === "github_team") return "org";
  if (mode === "allowlist") return "emails";
  return mode;
}

export const Gallery: FC<{
  email: string;
  artifacts: Artifact[];
  host: string;
  githubLogin?: string;
}> = ({ email, artifacts, host, githubLogin }) => (
  <Layout title="Your artifacts · lookmom">
    <div class="wrap wide">
      <div class="card">
        <div class="page-head">
          <div>
            <p class="kicker">lookmom</p>
            <h1>Your artifacts</h1>
            <p>
              Signed in as <span class="mono">{email}</span>
              {githubLogin ? (
                <>
                  {" "}
                  · GitHub <span class="mono">@{githubLogin}</span>
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
            <p>Nothing published yet. From your agent or terminal:</p>
            <span class="mono">lookmom publish ./artifact</span>
          </div>
        ) : (
          <ul class="list">
            {artifacts.map((a) => (
              <li class="item">
                <span class="emoji" aria-hidden="true">
                  {a.emoji || "📄"}
                </span>
                <div>
                  <a class="title-link" href={`${host}/a/${a.id}`}>
                    {a.title}
                  </a>
                  <span class="sub">v{a.currentVersion}</span>
                </div>
                <div class="meta">
                  <a class="badge accent" href={`${host}/share/${a.id}`}>
                    {shareLabel(a.shareMode)}
                  </a>
                  {a.shareMode === "github_team" && a.githubOrg ? (
                    <span class="badge">
                      {a.githubTeam ? `${a.githubOrg}/${a.githubTeam}` : a.githubOrg}
                    </span>
                  ) : null}
                  <a class="badge" href={`${host}/a/${a.id}`}>
                    open
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p class="footer-note">
          Multi-file projects work too — pass a folder with{" "}
          <span class="mono">index.html</span> to{" "}
          <span class="mono">lookmom publish</span>.
        </p>
      </div>
    </div>
  </Layout>
);

export const ConfirmAgent: FC<{
  email: string;
  prefill?: string;
  error?: string;
  success?: boolean;
}> = ({ email, prefill, error, success }) => (
  <Layout title="Authorize agent · lookmom">
    <div class="wrap">
      <div class="card">
        <p class="kicker">lookmom</p>
        <h1>Authorize publishing agent</h1>
        {success ? (
          <p class="ok">Authorized. You can return to your agent — it can now publish.</p>
        ) : (
          <>
            <p>
              Signed in as <span class="mono">{email}</span>. Enter the code your agent
              showed you to let it publish artifacts to your account.
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
    </div>
  </Layout>
);
