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
import {
  getDb,
  findGithubCliClaimByCodeHash,
  completeGithubCliClaim,
  upsertOwnerGithub,
  deleteOwnerGithub,
} from "../db";
import { enforce, RateLimited, clientIp } from "../ratelimit";
import { now, randomId, sha256Hex } from "../util";
import { SketchShell } from "../chrome";

const OAUTH_COOKIE = "lookmom_oauth";
const GITHUB_OAUTH_COOKIE = "lookmom_gh_oauth";

type OauthPurpose = "login" | "connect_github" | "viewer_github" | "cli_github";

interface OauthState {
  state: string;
  returnTo: string;
  purpose: OauthPurpose;
  /** Prefer WorkOS GitHubOAuth on the main login path. */
  via?: "workos_github" | "workos_authkit" | "github_direct";
  /** CLI connect claim id (github_cli_claims). */
  cliClaimId?: string;
  /** Owner email bound at claim start (from agent token). */
  cliOwnerEmail?: string;
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

// --- CLI GitHub connect (WorkOS) — agent shows code, human opens this URL ----

authRoutes.get("/connect/github/cli", async (c) => {
  if (!isWorkosConfigured(c.env)) {
    return c.html(
      <SketchShell title="WorkOS required" kicker="setup" navRight="gallery">
            <h1>WorkOS required</h1>
            <p>
              CLI GitHub connect goes through WorkOS GitHub OAuth (return tokens +{" "}
              <span class="mono">read:org</span>). Configure WorkOS on this instance.
            </p>
          </SketchShell>,
    );
  }

  const code = (c.req.query("code") ?? "").trim().toUpperCase();
  if (!code) {
    return c.html(
      <SketchShell title="Connect GitHub (CLI)" kicker="cli" navRight="gallery">
            <h1>Connect GitHub for your agent</h1>
            <p>Enter the code your agent showed you.</p>
            <form method="get" action="/connect/github/cli">
              <input class="code" name="code" placeholder="XXXX-XXXX" required maxlength={9} />
              <div class="row" style="margin-top:16px">
                <button class="btn" type="submit">
                  Continue with GitHub
                </button>
              </div>
            </form>
          </SketchShell>,
    );
  }

  const db = getDb(c.env.DB);
  const claim = await findGithubCliClaimByCodeHash(db, await sha256Hex(code));
  if (!claim || claim.status !== "pending" || claim.expiresAt < now()) {
    return c.html(
      <SketchShell title="Invalid code" kicker="oops" navRight="gallery">
            <h1>Invalid or expired code</h1>
            <p>Ask your agent to run <span class="mono">lookmom github login</span> again.</p>
          </SketchShell>,
    );
  }

  // Straight to WorkOS GitHubOAuth — token returned to callback, stored for owner.
  const state = randomId();
  setOauthCookie(c, {
    state,
    returnTo: "/connect/github/cli/done",
    purpose: "cli_github",
    via: "workos_github",
    cliClaimId: claim.id,
    cliOwnerEmail: claim.ownerEmail,
  });
  return c.redirect(
    authorizationUrl(c.env, {
      state,
      provider: "GitHubOAuth",
      providerScopes: GITHUB_MEMBERSHIP_SCOPES,
    }),
  );
});

authRoutes.get("/connect/github/cli/done", (c) => {
  const login = c.req.query("login");
  return c.html(
    <SketchShell title="GitHub connected" kicker="nice" navRight="gallery">
            <h1>GitHub connected</h1>
          <p class="ok">
            {login ? (
              <>
                Connected as <span class="mono">@{login}</span>.
              </>
            ) : (
              <>Connected.</>
            )}{" "}
            You can return to your agent — it can list orgs and share now.
          </p>
          </SketchShell>,
  );
});

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
    <SketchShell title="Connect GitHub" kicker="team share" navRight="gallery">
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
            <p class="ok">GitHub unlinked. You’re still signed in to lookmom — use Log out to end the session.</p>
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
                  Unlink GitHub
                </button>
              </form>
            ) : null}
            <a class="btn ghost sm" href="/auth/logout">
              Log out
            </a>
            <a class="btn secondary" href={returnTo}>
              {returnTo.startsWith("/share/") ? "Back to Share" : "Done"}
            </a>
          </div>

          <p style="margin-top:24px;font-size:13px">
            Signed in as <span class="mono">{viewer.email}</span>
          </p>
          </SketchShell>,
  );
});

authRoutes.post("/connect/github/disconnect", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return c.redirect("/auth/login?return_to=/connect/github");
  const body = await c.req.parseBody();
  const returnTo = safeReturnTo(String(body.return_to ?? "/connect/github"));
  // Unlink GitHub only — lookmom session stays signed in.
  try {
    await deleteOwnerGithub(getDb(c.env.DB), viewer.email);
  } catch (e) {
    console.error("deleteOwnerGithub failed:", e);
  }
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
    // ---------------------------------------------------------------------------
    // LOCAL / no WorkOS: skip the outdated email form so polished pages (gallery,
    // viewer, share) are reachable without a barebones intermediate screen.
    // Set SKIP_LOCAL_DEV_LOGIN_FORM to false (and uncomment the form below)
    // when you want the manual "enter any email" page again.
    // ---------------------------------------------------------------------------
    const SKIP_LOCAL_DEV_LOGIN_FORM = true;
    if (SKIP_LOCAL_DEV_LOGIN_FORM) {
      await startSession(c, "you@example.com");
      return c.redirect(returnTo);
    }

    /* LOCAL DEV LOGIN FORM — uncomment when SKIP_LOCAL_DEV_LOGIN_FORM is false
    return c.html(
      <SketchShell title="Dev sign in" kicker="local" navRight="gallery">
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
              </div>
            </form>
          </SketchShell>,
    );
    */
  }

  const state = randomId();
  setOauthCookie(c, {
    state,
    returnTo,
    purpose: "login",
    via: "workos_authkit",
  });
  // Include GitHub membership scopes so if the user picks GitHub as their
  // AuthKit method we get return tokens and can link owner_github for the CLI.
  return c.redirect(
    authorizationUrl(c.env, {
      state,
      provider: "authkit",
      providerScopes: GITHUB_MEMBERSHIP_SCOPES,
    }),
  );
});

authRoutes.get("/auth/callback", async (c) => {
  const oauthError = c.req.query("error");
  const oauthDesc = (c.req.query("error_description") ?? "").replace(/\+/g, " ");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const raw = getCookie(c, OAUTH_COOKIE);

  // WorkOS / provider failures land here without a code (e.g. GitHub userinfo failed).
  if (oauthError) {
    deleteCookie(c, OAUTH_COOKIE, { path: "/" });
    let hint =
      "Something went wrong during OAuth. Try again, or check WorkOS GitHub settings.";
    const descLower = oauthDesc.toLowerCase();
    if (descLower.includes("github") || oauthError === "oauth_failed") {
      hint =
        "WorkOS couldn’t load your GitHub profile. In the WorkOS dashboard: enable GitHub OAuth, turn on “Return GitHub OAuth tokens”, and request scopes read:user, user:email, read:org. Also confirm the GitHub OAuth App client id/secret are correct.";
    }
    const rawState = raw;
    let returnTo = "/gallery";
    let purpose = "";
    if (rawState) {
      try {
        const p = JSON.parse(rawState) as OauthState;
        if (p.returnTo) returnTo = safeReturnTo(p.returnTo);
        purpose = p.purpose ?? "";
      } catch {
        /* ignore */
      }
    }
    const retryHref =
      purpose === "connect_github" || purpose === "cli_github"
        ? `/connect/github?return_to=${encodeURIComponent(returnTo)}`
        : `/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    return c.html(
      <SketchShell title="Sign-in failed" kicker="oauth" navRight="gallery">
        <h1>Couldn’t finish sign-in</h1>
        <p class="err">{hint}</p>
        {oauthDesc ? (
          <p>
            Provider message: <span class="mono">{oauthDesc}</span>
          </p>
        ) : null}
        <div class="row" style="margin-top:16px">
          <a class="btn" href={retryHref}>
            Try again
          </a>
          <a class="btn secondary" href="/gallery">
            Gallery
          </a>
          <a class="btn ghost" href="/auth/logout">
            Log out
          </a>
        </div>
      </SketchShell>,
    );
  }

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

    // Any WorkOS path that returns a GitHub token links the owner for CLI/orgs.
    // Covers: default AuthKit login with GitHub, web Connect, CLI connect claim.
    const linkOwnerEmail =
      parsed.purpose === "cli_github"
        ? parsed.cliOwnerEmail
        : (existing?.email ?? user.email);

    if (ghToken && githubLogin && linkOwnerEmail) {
      try {
        await upsertOwnerGithub(getDb(c.env.DB), {
          ownerEmail: linkOwnerEmail,
          githubLogin,
          accessToken: ghToken,
        });
      } catch (e) {
        console.error("upsertOwnerGithub failed:", e);
      }
    }

    // CLI connect: complete claim so the agent poll succeeds.
    if (parsed.purpose === "cli_github") {
      if (!ghToken || !githubLogin || !parsed.cliClaimId || !parsed.cliOwnerEmail) {
        return c.html(
          <SketchShell title="GitHub connect failed" kicker="uh oh" navRight="gallery">
            <h1>GitHub token missing</h1>
                <p>
                  WorkOS signed you in but did not return a GitHub access token. In the
                  WorkOS dashboard enable <strong>Return GitHub OAuth tokens</strong> and
                  scopes <span class="mono">read:user user:email read:org</span>.
                </p>
          </SketchShell>,
        );
      }
      const db = getDb(c.env.DB);
      await completeGithubCliClaim(db, parsed.cliClaimId, githubLogin);
      await startSession(c, parsed.cliOwnerEmail, user.name, githubLogin);
      setGithubTokenCookie(c, ghToken);
      return c.redirect(
        `/connect/github/cli/done?login=${encodeURIComponent(githubLogin)}`,
      );
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
      <SketchShell title="GitHub not configured" kicker="setup" navRight="gallery">
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
          </SketchShell>,
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
  const oauthError = c.req.query("error");
  const oauthDesc = (c.req.query("error_description") ?? "").replace(/\+/g, " ");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const raw = getCookie(c, GITHUB_OAUTH_COOKIE);

  if (oauthError) {
    deleteCookie(c, GITHUB_OAUTH_COOKIE, { path: "/" });
    return c.html(
      <SketchShell title="GitHub login failed" kicker="oauth" navRight="gallery">
        <h1>GitHub denied access</h1>
        <p class="err">
          {oauthDesc || oauthError || "GitHub OAuth failed."}
        </p>
        <div class="row" style="margin-top:16px">
          <a class="btn" href="/connect/github">
            Try again
          </a>
          <a class="btn secondary" href="/gallery">
            Gallery
          </a>
        </div>
      </SketchShell>,
    );
  }

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
  // Home redirects to gallery, which will ask to sign in if needed.
  return c.redirect("/auth/login?return_to=/gallery");
});
