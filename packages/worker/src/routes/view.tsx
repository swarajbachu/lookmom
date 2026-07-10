/**
 * Viewer surface.
 *   GET /a/:id   (app host)     — the AUTH GATE + chrome. Renders login /
 *                                 denied / the sandboxed artifact frame.
 *   GET /raw/:id (sandbox host) — cookieless content delivery. Requires a
 *                                 signed grant the gate issues post-check;
 *                                 streams the HTML from R2 under strict CSP.
 */
import { Hono } from "hono";
import type { AppContext, Env, Vars } from "../types";
import {
  getArtifact,
  getVersion,
  isAllowed,
  getDb,
  getOwnerGithub,
  isOnGithubShareRoster,
} from "../db";
import { artifactHeaders } from "../csp";
import { signGrant, verifyGrant } from "../grants";
import { enforce, RateLimited, clientIp } from "../ratelimit";
import { getGithubTokenCookie } from "../auth/session";
import { isGithubTeamShareAvailable } from "../auth/github";
import { isGithubTeamMember } from "../github/membership";
import { listUserOrgs } from "../github/orgs";
import {
  AccessDenied,
  ArtifactFrame,
  GithubNotConfigured,
  LoginPrompt,
} from "../chrome";

export const viewRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

async function rateLimitView(c: AppContext) {
  await enforce(c.env.RL_VIEW, `view:${clientIp(c.req.raw)}`);
}

// --- The gate ---------------------------------------------------------------

viewRoutes.get("/a/:id", async (c) => {
  try {
    await rateLimitView(c);
  } catch (e) {
    if (e instanceof RateLimited) return c.text("Too many requests", 429);
    throw e;
  }

  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art || art.currentVersion === 0) return c.notFound();

  const viewer = c.get("viewer");
  const loginUrl = `/auth/login?return_to=${encodeURIComponent(`/a/${id}`)}`;
  const githubLoginUrl = `/auth/github?return_to=${encodeURIComponent(`/a/${id}`)}&purpose=viewer`;

  // Decide access.
  let allowed = art.shareMode === "public";
  if (!allowed) {
    if (!viewer) {
      return c.html(
        <LoginPrompt
          title={art.title}
          loginUrl={loginUrl}
          githubLoginUrl={
            art.shareMode === "github_team" ? githubLoginUrl : undefined
          }
          teamShare={false}
          message={
            art.shareMode === "github_team"
              ? "Shared with a GitHub org. Try your work email first (if synced), or sign in with GitHub."
              : undefined
          }
        />,
      );
    }
    if (viewer.email === art.ownerEmail) {
      allowed = true;
    } else if (art.shareMode === "allowlist") {
      allowed = await isAllowed(db, id, viewer.email);
    } else if (art.shareMode === "github_team") {
      if (!art.githubOrg) {
        return c.html(
          <AccessDenied
            email={viewer.email}
            switchUrl={loginUrl}
            message="This artifact is set to GitHub org share but has no organization configured."
          />,
        );
      }
      if (!isGithubTeamShareAvailable(c.env)) {
        return c.html(<GithubNotConfigured />);
      }

      // 1) Email match from roster/allowlist (public emails synced by owner)
      if (await isAllowed(db, id, viewer.email)) {
        allowed = true;
      } else if (
        await isOnGithubShareRoster(db, id, {
          email: viewer.email,
          githubLogin: viewer.githubLogin,
        })
      ) {
        // 2) On owner-synced roster (login or email)
        allowed = true;
      } else {
        // 3) Live membership — prefer *owner* token so members don't need SAML'd app access
        const ownerLink = await getOwnerGithub(db, art.ownerEmail);
        const token =
          ownerLink?.accessToken ?? getGithubTokenCookie(c) ?? undefined;

        if (!viewer.githubLogin) {
          return c.html(
            <LoginPrompt
              title={art.title}
              loginUrl={loginUrl}
              githubLoginUrl={githubLoginUrl}
              teamShare={false}
              message="This is shared with a GitHub org. Sign in with your work email if the owner synced it, or with GitHub (username match / membership)."
            />,
          );
        }

        if (!token) {
          return c.html(
            <LoginPrompt
              title={art.title}
              loginUrl={loginUrl}
              githubLoginUrl={githubLoginUrl}
              teamShare
              message="Sign in with GitHub to verify org membership (owner may need to re-sync members)."
            />,
          );
        }

        const result = await isGithubTeamMember(db, {
          githubLogin: viewer.githubLogin,
          org: art.githubOrg,
          team: art.githubTeam,
          accessToken: token,
        });

        if (result.reason === "error") {
          return c.html(
            <AccessDenied
              email={viewer.email}
              switchUrl={githubLoginUrl}
              message="We couldn’t verify organization membership right now. Try again later."
            />,
          );
        }
        allowed = result.allowed;
      }
    }
  }

  if (!allowed) {
    return c.html(
      <AccessDenied
        email={viewer!.email}
        switchUrl={
          art.shareMode === "github_team" ? githubLoginUrl : loginUrl
        }
        message={
          art.shareMode === "github_team"
            ? `You’re signed in as ${viewer!.githubLogin ? `@${viewer!.githubLogin}` : viewer!.email}, which isn’t a member of the shared GitHub ${art.githubTeam ? `team ${art.githubOrg}/${art.githubTeam}` : `org ${art.githubOrg}`}.`
            : undefined
        }
      />,
    );
  }

  // Issue a short-lived grant and hand off to the cookieless sandbox host.
  const grant = await signGrant(c.env.JWT_SIGNING_SECRET, id, art.currentVersion);
  const rawUrl = `${c.env.ARTIFACT_SANDBOX_HOST}/raw/${id}?grant=${encodeURIComponent(grant)}`;
  const isOwner = !!viewer && viewer.email === art.ownerEmail;
  let githubOrgs: Array<{ login: string; description: string }> = [];
  let githubOrgsError: string | undefined;
  let ownerGhLogin: string | undefined;
  let ownerGhConnected = false;
  if (isOwner && viewer) {
    const link = await getOwnerGithub(db, viewer.email);
    ownerGhConnected = !!link || !!viewer.githubLogin;
    ownerGhLogin = link?.githubLogin ?? viewer.githubLogin;
    if (link) {
      try {
        githubOrgs = await listUserOrgs(link.accessToken);
      } catch (e) {
        console.error("viewer share list orgs:", e);
        githubOrgsError = "Could not load organizations. Try reconnecting GitHub.";
      }
    }
  }
  return c.html(
    <ArtifactFrame
      id={id}
      title={art.title}
      emoji={art.emoji}
      rawUrl={rawUrl}
      canShare={isOwner}
      shareUrl={`${c.env.APP_HOST}/share/${id}`}
      viewUrl={`${c.env.APP_HOST}/a/${id}`}
      shareMode={art.shareMode}
      githubOrg={art.githubOrg}
      githubTeam={art.githubTeam}
      githubConnected={ownerGhConnected}
      githubAvailable={isGithubTeamShareAvailable(c.env)}
      connectUrl={
        isOwner
          ? `/connect/github?return_to=${encodeURIComponent(`/a/${id}?shared=1`)}`
          : undefined
      }
      githubOrgs={githubOrgs}
      githubOrgsError={githubOrgsError}
      githubLogin={ownerGhLogin}
    />,
  );
});

// --- Cookieless content delivery (sandbox host) -----------------------------

viewRoutes.get("/raw/:id", async (c) => {
  try {
    await rateLimitView(c);
  } catch (e) {
    if (e instanceof RateLimited) return c.text("Too many requests", 429);
    throw e;
  }

  const id = c.req.param("id");
  const grantToken = c.req.query("grant") ?? "";
  const grant = await verifyGrant(c.env.JWT_SIGNING_SECRET, grantToken);
  if (!grant || grant.artifactId !== id) return c.text("Forbidden", 403);

  const db = getDb(c.env.DB);
  const version = await getVersion(db, id, grant.versionNo);
  if (!version) return c.notFound();

  const obj = await c.env.BLOBS.get(version.r2Key);
  if (!obj) return c.notFound();

  return new Response(obj.body, {
    headers: artifactHeaders(
      { "cache-control": "private, no-store" },
      { gateOrigin: c.env.APP_HOST },
    ),
  });
});
