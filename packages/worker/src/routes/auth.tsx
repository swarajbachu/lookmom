/**
 * Human login + GitHub connect routes.
 *
 * Default login: WorkOS AuthKit (or dev email form).
 * GitHub (team share / connect): WorkOS GitHubOAuth when WorkOS is configured,
 * otherwise direct GitHub OAuth App fallback.
 */
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env, Vars } from "../types";
import {
  authorizationUrl,
  exchangeCode,
  isWorkosConfigured,
  GITHUB_MEMBERSHIP_SCOPES,
} from "../auth/workos";
import {
  exchangeGithubCode,
  fetchGithubUser,
  githubAuthorizationUrl,
  isGithubConfigured,
  isGithubTeamShareAvailable,
} from "../auth/github";
import {
  startSession,
  endSession,
  setGithubTokenCookie,
  updateSession,
  clearGithubTokenCookie,
} from "../auth/session";
import { enforce, RateLimited, clientIp } from "../ratelimit";
import { randomId } from "../util";
import { Layout } from "../chrome";

const OAUTH_COOKIE = "lookmom_oauth";
const GITHUB_OAUTH_COOKIE = "lookmom_gh_oauth";

type OauthPurpose = "login" | "connect_github" | "viewer_github";

interface OauthState {
  state: string;
  returnTo: string;
  purpose: OauthPurpose;
  /** Prefer WorkOS GitHubOAuth on the main login path. */
  via?: "workos_github" | "workos_authkit" | "github_direct";
}

/** Only allow same-site relative redirect targets. */
function safeReturnTo(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/gallery";
}

function setOauthCookie(
  c: { req: { url: string }; header: (n: string, v: string, options?: object) => void },
  payload: OauthState,
) {
  // hono setCookie accepts Context; narrow type is enough for our use.
  setCookie(c as Parameters<typeof setCookie>[0], OAUTH_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });
}

export const authRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

// --- Connect GitHub (owner path for org share) ------------------------------

authRoutes.get("/connect/github", async (c) => {
  const viewer = c.get("viewer");
  const returnTo = safeReturnTo(c.req.query("return_to"));
  const err = c.req.query("err");
  const ok = c.req.query("ok"); // "1" after connect, "disconnected" after unlink

  if (!viewer) {
    return c.redirect(
      `/auth/login?return_to=${encodeURIComponent(`/connect/github?return_to=${encodeURIComponent(returnTo)}`)}`,
    );
  }

  const available = isGithubTeamShareAvailable(c.env);
  const connected = !!viewer.githubLogin;

  return c.html(
    <Layout title="Connect GitHub">
      <div class="wrap">
        <div class="card">
          <h1>Connect GitHub</h1>
          <p>
            Connect your GitHub account to share artifacts with organization or
            team members. We request <span class="mono">read:org</span> so we
            can verify membership when someone opens a shared link.
          </p>

          {err ? <p class="err">{err}</p> : null}
          {ok === "1" && connected ? (
            <p class="ok">
              Connected as <span class="mono">@{viewer.githubLogin}</span>. You
              can return to sharing.
            </p>
          ) : null}
          {ok === "disconnected" ? (
            <p class="ok">GitHub disconnected from this session.</p>
          ) : null}

          {!available ? (
            <p class="err">
              GitHub team share isn’t available on this instance. The operator
              needs WorkOS with GitHub OAuth enabled (return tokens +{" "}
              <span class="mono">read:org</span>), or{" "}
              <span class="mono">GITHUB_CLIENT_ID</span> /{" "}
              <span class="mono">GITHUB_CLIENT_SECRET</span>.
            </p>
          ) : null}

          {connected && !ok ? (
            <p>
              Connected as <span class="mono">@{viewer.githubLogin}</span>
            </p>
          ) : null}

          <div class="row" style="margin-top:8px">
            {available ? (
              <a
                class="btn"
                href={`/auth/github?return_to=${encodeURIComponent(returnTo)}&purpose=connect`}
              >
                {connected ? "Reconnect GitHub" : "Connect to GitHub"}
              </a>
            ) : null}
            {connected ? (
              <form method="post" action="/connect/github/disconnect" style="margin:0">
                <input type="hidden" name="return_to" value={returnTo} />
                <button class="btn secondary" type="submit">
                  Disconnect
                </button>
              </form>
            ) : null}
            <a class="btn secondary" href={returnTo}>
              {returnTo.startsWith("/share/") ? "Back to Share" : "Done"}
            </a>
          </div>

          <p style="margin-top:24px;font-size:13px">
            Signed in as <span class="mono">{viewer.email}</span>
          </p>
        </div>
      </div>
    </Layout>,
  );
});

authRoutes.post("/connect/github/disconnect", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return c.redirect("/auth/login?return_to=/connect/github");
  const body = await c.req.parseBody();
  const returnTo = safeReturnTo(String(body.return_to ?? "/connect/github"));
  await updateSession(c, {
    email: viewer.email,
    name: viewer.name,
    githubLogin: undefined,
  });
  clearGithubTokenCookie(c);
  return c.redirect(
    `/connect/github?return_to=${encodeURIComponent(returnTo)}&ok=${encodeURIComponent("disconnected")}`,
  );
});

// --- Login ------------------------------------------------------------------

authRoutes.get("/auth/login", async (c) => {
  try {
    await enforce(c.env.RL_AUTH, `login:${clientIp(c.req.raw)}`);
  } catch (e) {
    if (e instanceof RateLimited) return c.text("Too many requests", 429);
    throw e;
  }
  const returnTo = safeReturnTo(c.req.query("return_to"));
  const preferGithub = c.req.query("github") === "1";

  // github_team artifacts can send viewers straight to GitHub.
  if (preferGithub && isGithubTeamShareAvailable(c.env)) {
    return c.redirect(
      `/auth/github?return_to=${encodeURIComponent(returnTo)}&purpose=viewer`,
    );
  }

  if (!isWorkosConfigured(c.env)) {
    return c.html(
      <Layout title="Dev sign in">
        <div class="wrap">
          <div class="card">
            <h1>Dev sign in</h1>
            <p>WorkOS isn’t configured. Enter any email to simulate a session.</p>
            <form method="post" action="/auth/dev-login">
              <input type="hidden" name="return_to" value={returnTo} />
              <input
                class="code"
                style="text-transform:none;letter-spacing:0;text-align:left"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
              <div class="row" style="margin-top:16px">
                <button class="btn" type="submit">
                  Continue
                </button>
                {isGithubConfigured(c.env) ? (
                  <a
                    class="btn secondary"
                    href={`/auth/github?return_to=${encodeURIComponent(returnTo)}&purpose=viewer`}
                  >
                    Sign in with GitHub
                  </a>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </Layout>,
    );
  }

  const state = randomId();
  setOauthCookie(c, {
    state,
    returnTo,
    purpose: "login",
    via: "workos_authkit",
  });
  return c.redirect(authorizationUrl(c.env, { state, provider: "authkit" }));
});

authRoutes.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const raw = getCookie(c, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, { path: "/" });

  if (!code || !raw) return c.text("Invalid login state", 400);
  let parsed: OauthState;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return c.text("Invalid login state", 400);
  }
  if (parsed.state !== state) return c.text("State mismatch", 400);

  try {
    const user = await exchangeCode(c.env, code);
    const existing = c.get("viewer");

    let githubLogin: string | undefined;
    let ghToken: string | undefined;

    if (user.oauthTokens?.accessToken) {
      try {
        const gh = await fetchGithubUser(user.oauthTokens.accessToken);
        githubLogin = gh.login;
        ghToken = user.oauthTokens.accessToken;
      } catch (e) {
        console.error("github profile from WorkOS token failed:", e);
        // Continue without GitHub — identity still works.
      }
    }

    // Connect flow: keep existing email if already signed in.
    if (
      (parsed.purpose === "connect_github" || parsed.purpose === "viewer_github") &&
      existing
    ) {
      await updateSession(c, {
        email: existing.email,
        name: existing.name ?? user.name,
        githubLogin: githubLogin ?? existing.githubLogin,
      });
    } else {
      await startSession(c, user.email, user.name, githubLogin);
    }

    if (ghToken) setGithubTokenCookie(c, ghToken);

    if (parsed.purpose === "connect_github") {
      if (!githubLogin) {
        return c.redirect(
          `/connect/github?return_to=${encodeURIComponent(parsed.returnTo)}&err=${encodeURIComponent(
            "GitHub connected but no access token was returned. In the WorkOS dashboard, enable “Return GitHub OAuth tokens” and request read:org.",
          )}`,
        );
      }
      return c.redirect(
        `/connect/github?return_to=${encodeURIComponent(parsed.returnTo)}&ok=1`,
      );
    }

    return c.redirect(safeReturnTo(parsed.returnTo));
  } catch (e) {
    console.error("workos callback failed:", e);
    return c.text("Login failed", 502);
  }
});

authRoutes.post("/auth/dev-login", async (c) => {
  if (isWorkosConfigured(c.env)) return c.text("Not found", 404);
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const returnTo = safeReturnTo(String(body.return_to ?? "/gallery"));
  if (!email || !email.includes("@")) return c.text("Bad email", 400);
  await startSession(c, email);
  return c.redirect(returnTo);
});

// --- GitHub OAuth (WorkOS preferred, direct fallback) -----------------------

authRoutes.get("/auth/github", async (c) => {
  try {
    await enforce(c.env.RL_AUTH, `ghlogin:${clientIp(c.req.raw)}`);
  } catch (e) {
    if (e instanceof RateLimited) return c.text("Too many requests", 429);
    throw e;
  }

  if (!isGithubTeamShareAvailable(c.env)) {
    return c.html(
      <Layout title="GitHub not configured">
        <div class="wrap">
          <div class="card">
            <h1>GitHub login not configured</h1>
            <p>
              Enable GitHub OAuth in WorkOS (with return tokens +{" "}
              <span class="mono">read:org</span>), or set{" "}
              <span class="mono">GITHUB_CLIENT_ID</span> and{" "}
              <span class="mono">GITHUB_CLIENT_SECRET</span>.
            </p>
            <a class="btn secondary" href="/gallery">
              Back
            </a>
          </div>
        </div>
      </Layout>,
    );
  }

  const returnTo = safeReturnTo(c.req.query("return_to"));
  const purposeRaw = c.req.query("purpose");
  const purpose: OauthPurpose =
    purposeRaw === "connect"
      ? "connect_github"
      : purposeRaw === "viewer"
        ? "viewer_github"
        : "viewer_github";

  const state = randomId();

  // Prefer WorkOS GitHubOAuth when WorkOS is configured.
  if (isWorkosConfigured(c.env)) {
    setOauthCookie(c, {
      state,
      returnTo,
      purpose,
      via: "workos_github",
    });
    return c.redirect(
      authorizationUrl(c.env, {
        state,
        provider: "GitHubOAuth",
        providerScopes: GITHUB_MEMBERSHIP_SCOPES,
      }),
    );
  }

  // Direct GitHub OAuth App fallback (local / no WorkOS).
  setCookie(c, GITHUB_OAUTH_COOKIE, JSON.stringify({ state, returnTo, purpose }), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });
  return c.redirect(githubAuthorizationUrl(c.env, state));
});

authRoutes.get("/auth/github/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const raw = getCookie(c, GITHUB_OAUTH_COOKIE);
  deleteCookie(c, GITHUB_OAUTH_COOKIE, { path: "/" });

  if (!code || !raw) return c.text("Invalid GitHub login state", 400);
  let parsed: { state: string; returnTo: string; purpose?: OauthPurpose };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return c.text("Invalid GitHub login state", 400);
  }
  if (parsed.state !== state) return c.text("State mismatch", 400);

  if (!isGithubConfigured(c.env)) return c.text("GitHub not configured", 503);

  try {
    const user = await exchangeGithubCode(c.env, code);
    const existing = c.get("viewer");
    if (existing) {
      await updateSession(c, {
        email: existing.email,
        name: existing.name ?? user.name,
        githubLogin: user.login,
      });
    } else {
      await startSession(c, user.email, user.name, user.login);
    }
    setGithubTokenCookie(c, user.accessToken);

    if (parsed.purpose === "connect_github") {
      return c.redirect(
        `/connect/github?return_to=${encodeURIComponent(parsed.returnTo)}&ok=1`,
      );
    }
    return c.redirect(safeReturnTo(parsed.returnTo));
  } catch (e) {
    console.error("github oauth failed:", e);
    return c.text("GitHub login failed", 502);
  }
});

authRoutes.get("/auth/logout", (c) => {
  endSession(c);
  return c.redirect("/");
});
