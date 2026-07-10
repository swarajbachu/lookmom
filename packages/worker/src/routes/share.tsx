/**
 * Owner surfaces: gallery + per-artifact share controls.
 * Share options: only me | specific emails | GitHub org/team | anyone.
 * Org share requires Connect GitHub first.
 */
import { Hono } from "hono";
import type { AppContext, Env, Vars, ShareMode } from "../types";
import {
  getDb,
  getArtifact,
  listArtifactsByOwner,
  setShareMode,
  addToAllowlist,
  setGithubTeamShare,
} from "../db";
import { normalizeGithubSlug, isGithubTeamShareAvailable } from "../auth/github";
import { Gallery, Layout } from "../chrome";

const SHARE_MODES: ShareMode[] = ["private", "allowlist", "public", "github_team"];

export const shareRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

function loginRedirect(c: AppContext) {
  const path = new URL(c.req.url).pathname;
  return c.redirect(`/auth/login?return_to=${encodeURIComponent(path)}`);
}

shareRoutes.get("/gallery", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const db = getDb(c.env.DB);
  const artifacts = await listArtifactsByOwner(db, viewer.email);
  return c.html(
    <Gallery
      email={viewer.email}
      artifacts={artifacts}
      host={c.env.APP_HOST}
      githubLogin={viewer.githubLogin}
    />,
  );
});

shareRoutes.get("/share/:id", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art) return c.notFound();
  if (art.ownerEmail !== viewer.email) return c.text("Forbidden", 403);

  const err = c.req.query("err");
  const githubConnected = !!viewer.githubLogin;
  const githubAvailable = isGithubTeamShareAvailable(c.env);
  const connectUrl = `/connect/github?return_to=${encodeURIComponent(`/share/${id}`)}`;

  return c.html(
    <Layout title={`Share — ${art.title}`}>
      <div class="wrap">
        <div class="card">
          <h1>Share “{art.title}”</h1>
          <p>
            <a href={`${c.env.APP_HOST}/a/${id}`}>{c.env.APP_HOST}/a/{id}</a>
          </p>
          {err ? <p class="err">{err}</p> : null}

          <form method="post" action={`/share/${id}/mode`} style="margin-bottom:28px">
            <strong>Who can view</strong>

            <label class="share-opt">
              <input
                type="radio"
                name="mode"
                value="private"
                checked={art.shareMode === "private"}
              />
              <span>
                <strong>Only me</strong>
                <span class="hint">Private — only your account</span>
              </span>
            </label>

            <label class="share-opt">
              <input
                type="radio"
                name="mode"
                value="allowlist"
                checked={art.shareMode === "allowlist"}
              />
              <span>
                <strong>Specific people</strong>
                <span class="hint">Only the emails you add below</span>
              </span>
            </label>

            <label class="share-opt">
              <input
                type="radio"
                name="mode"
                value="public"
                checked={art.shareMode === "public"}
              />
              <span>
                <strong>Anyone with the link</strong>
                <span class="hint">Public — no sign-in required to view</span>
              </span>
            </label>

            <label class="share-opt">
              <input
                type="radio"
                name="mode"
                value="github_team"
                checked={art.shareMode === "github_team"}
                disabled={!githubAvailable}
              />
              <span>
                <strong>GitHub organization members</strong>
                <span class="hint">
                  Anyone in a GitHub org or team (viewers sign in with GitHub)
                </span>
              </span>
            </label>

            {!githubAvailable ? (
              <p class="err" style="margin-top:12px">
                GitHub org share isn’t configured on this instance (needs WorkOS
                GitHub OAuth or a GitHub OAuth App).
              </p>
            ) : !githubConnected ? (
              <div class="callout" style="margin-top:14px">
                <strong>Connect GitHub to enable org share</strong>
                <p style="margin:8px 0 0">
                  Before sharing with an organization, connect your GitHub account
                  so membership checks can run. This only requests org read
                  access.
                </p>
                <div class="row" style="margin-top:12px">
                  <a class="btn" href={connectUrl}>
                    Connect to GitHub
                  </a>
                </div>
              </div>
            ) : (
              <div class="callout" style="margin-top:14px">
                <strong>Organization / team</strong>
                <p style="margin:6px 0 0;font-size:13px">
                  Connected as <span class="mono">@{viewer.githubLogin}</span>.
                  Leave team blank to allow any member of the org.{" "}
                  <a href={connectUrl}>Manage GitHub connection</a>
                </p>
                <label class="field">
                  Organization
                  <input
                    class="text"
                    name="github_org"
                    placeholder="acme"
                    value={art.githubOrg ?? ""}
                    style="margin-top:6px"
                  />
                </label>
                <label class="field">
                  Team (optional)
                  <input
                    class="text"
                    name="github_team"
                    placeholder="eng"
                    value={art.githubTeam ?? ""}
                    style="margin-top:6px"
                  />
                </label>
              </div>
            )}

            <div style="margin-top:16px">
              <button class="btn" type="submit">
                Save
              </button>
            </div>
          </form>

          <form method="post" action={`/share/${id}/allow`}>
            <strong>Add emails (for “Specific people”)</strong>
            <textarea
              name="emails"
              placeholder="alice@example.com, bob@example.com"
              style="width:100%;min-height:90px;margin-top:8px;padding:10px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--fg)"
            />
            <div style="margin-top:10px">
              <button class="btn secondary" type="submit">
                Add emails
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>,
  );
});

shareRoutes.post("/share/:id/mode", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art || art.ownerEmail !== viewer.email) return c.text("Forbidden", 403);

  const body = await c.req.parseBody();
  const mode = String(body.mode) as ShareMode;
  if (!SHARE_MODES.includes(mode)) return c.redirect(`/share/${id}`);

  if (mode === "github_team") {
    if (!isGithubTeamShareAvailable(c.env)) {
      return c.redirect(
        `/share/${id}?err=${encodeURIComponent("GitHub org share is not configured on this instance.")}`,
      );
    }
    if (!viewer.githubLogin) {
      return c.redirect(
        `/share/${id}?err=${encodeURIComponent("Connect GitHub first, then choose organization members.")}`,
      );
    }
    const orgRaw = String(body.github_org ?? "").trim();
    const teamRaw = String(body.github_team ?? "").trim();
    const org = normalizeGithubSlug(orgRaw);
    if (!org) {
      return c.redirect(
        `/share/${id}?err=${encodeURIComponent("Enter a valid GitHub organization slug.")}`,
      );
    }
    let team: string | null = null;
    if (teamRaw) {
      team = normalizeGithubSlug(teamRaw);
      if (!team) {
        return c.redirect(
          `/share/${id}?err=${encodeURIComponent("Enter a valid GitHub team slug, or leave it blank.")}`,
        );
      }
    }
    await setGithubTeamShare(db, id, { org, team });
  } else {
    await setShareMode(db, id, mode);
  }
  return c.redirect(`/share/${id}`);
});

shareRoutes.post("/share/:id/allow", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art || art.ownerEmail !== viewer.email) return c.text("Forbidden", 403);

  const body = await c.req.parseBody();
  const emails = String(body.emails ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@") && e.length <= 254);
  await addToAllowlist(db, id, emails);
  // Adding emails while still private → switch to allowlist mode.
  if (art.shareMode === "private") {
    await setShareMode(db, id, "allowlist");
  }
  return c.redirect(`/share/${id}`);
});
