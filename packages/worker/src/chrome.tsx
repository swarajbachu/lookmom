/** Server-rendered chrome pages (Hono JSX → HTML string, no client JS). */
import type { FC, PropsWithChildren } from "hono/jsx";
import type { Artifact } from "./schema";

const STYLE = `
  :root { color-scheme: light dark; --fg:#111; --muted:#666; --bg:#fafafa;
    --card:#fff; --line:#e5e5e5; --accent:#2563eb; }
  @media (prefers-color-scheme: dark) { :root { --fg:#eee; --muted:#999;
    --bg:#0d0d0f; --card:#161618; --line:#262629; --accent:#3b82f6; } }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",
    Roboto,Helvetica,Arial,sans-serif; color:var(--fg); background:var(--bg); }
  .wrap { max-width:640px; margin:0 auto; padding:48px 24px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:32px; }
  h1 { font-size:22px; margin:0 0 6px; letter-spacing:-0.01em; }
  p { color:var(--muted); margin:0 0 20px; }
  .btn { display:inline-block; background:var(--accent); color:#fff;
    text-decoration:none; padding:10px 18px; border-radius:9px; font-weight:600;
    border:0; cursor:pointer; font-size:15px; }
  .btn.secondary { background:transparent; color:var(--accent);
    border:1px solid var(--line); }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .list { list-style:none; padding:0; margin:24px 0 0; }
  .item { display:flex; align-items:center; gap:12px; padding:14px 0;
    border-top:1px solid var(--line); }
  .item a { color:var(--fg); text-decoration:none; font-weight:600; }
  .badge { font-size:12px; color:var(--muted); border:1px solid var(--line);
    border-radius:20px; padding:2px 9px; }
  .err { color:#dc2626; font-size:14px; margin:0 0 16px; }
  .ok { color:#16a34a; font-size:14px; margin:0 0 16px; }
  input.code { font-size:20px; letter-spacing:3px; padding:12px 14px; width:100%;
    border:1px solid var(--line); border-radius:9px; background:var(--bg);
    color:var(--fg); text-align:center; text-transform:uppercase; }
  input.text { font-size:15px; padding:10px 12px; width:100%;
    border:1px solid var(--line); border-radius:9px; background:var(--bg);
    color:var(--fg); }
  label.field { display:block; margin:12px 0 0; font-size:14px; color:var(--muted); }
  label.share-opt { display:flex; gap:12px; align-items:flex-start; margin:12px 0;
    cursor:pointer; }
  label.share-opt input { margin-top:4px; }
  label.share-opt strong { display:block; color:var(--fg); font-weight:600; }
  label.share-opt .hint { display:block; font-size:13px; color:var(--muted); margin-top:2px; }
  .callout { padding:14px; border:1px solid var(--line); border-radius:10px;
    background:var(--bg); }
  .callout a { color:var(--accent); }
  header.bar { display:flex; align-items:center; justify-content:space-between;
    padding:12px 20px; border-bottom:1px solid var(--line); background:var(--card); }
  header.bar .title { font-weight:600; }
`;

export const Layout: FC<PropsWithChildren<{ title: string }>> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  <Layout title="Sign in">
    <div class="wrap">
      <div class="card">
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
  <Layout title="No access">
    <div class="wrap">
      <div class="card">
        <h1>You don’t have access</h1>
        <p>
          {message ??
            `You’re signed in as ${email}, which isn’t on this artifact’s allowlist. Ask the owner to add you, or sign in with a different account.`}
        </p>
        <p>
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
  <Layout title="GitHub not configured">
    <div class="wrap">
      <div class="card">
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
      <span class="title">
        {emoji} {title}
      </span>
      {canShare ? (
        <a class="btn secondary" href={shareUrl}>
          Share
        </a>
      ) : null}
    </header>
    <iframe
      src={rawUrl}
      sandbox="allow-scripts allow-popups allow-downloads"
      style="border:0;width:100%;height:calc(100vh - 49px);display:block"
      title={title}
    />
  </Layout>
);

export const Gallery: FC<{
  email: string;
  artifacts: Artifact[];
  host: string;
  githubLogin?: string;
}> = ({ email, artifacts, host, githubLogin }) => (
  <Layout title="Your artifacts">
    <div class="wrap">
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <h1>Your artifacts</h1>
            <p style="margin-bottom:0">
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
          <p style="margin-top:20px">
            Nothing published yet. Use the CLI: <span class="mono">lookmom publish</span>.
          </p>
        ) : (
          <ul class="list">
            {artifacts.map((a) => (
              <li class="item">
                <span>{a.emoji}</span>
                <a href={`${host}/a/${a.id}`}>{a.title}</a>
                <a class="badge" href={`${host}/share/${a.id}`}>
                  {a.shareMode === "github_team"
                    ? "org"
                    : a.shareMode === "allowlist"
                      ? "emails"
                      : a.shareMode}
                </a>
                {a.shareMode === "github_team" && a.githubOrg ? (
                  <span class="badge">
                    {a.githubTeam ? `${a.githubOrg}/${a.githubTeam}` : a.githubOrg}
                  </span>
                ) : null}
                <span class="badge">v{a.currentVersion}</span>
              </li>
            ))}
          </ul>
        )}
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
  <Layout title="Authorize agent">
    <div class="wrap">
      <div class="card">
        <h1>Authorize publishing agent</h1>
        {success ? (
          <>
            <p class="ok">✓ Authorized. You can return to your agent — it can now publish.</p>
          </>
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
