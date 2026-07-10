/**
 * Owner surfaces: gallery + per-artifact share controls.
 * Share options: only me | specific emails | GitHub org/team | anyone.
 * Org share requires Connect GitHub first.
 * Supports return_to so the preview dialog can post and return to /a/:id.
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

/** Only same-site relative paths. */
function safeReturnTo(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return fallback;
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
  const previewUrl = `/a/${id}`;

  return c.html(
    <Layout title={`Share — ${art.title}`}>
      <header class="nav">
        <a class="nav-brand" href="/gallery">
          <span class="nav-mark" aria-hidden="true" />
          lookmom
        </a>
        <div class="nav-actions">
          <a class="btn secondary sm" href={previewUrl}>
            ← Back to preview
          </a>
        </div>
      </header>
      <main class="shell-main narrow">
        <div class="card">
          <p class="kicker">Share settings</p>
          <h1>{art.title}</h1>
          <p style="margin:10px 0 16px">
            <a class="link-chip" href={`${c.env.APP_HOST}/a/${id}`}>
              {c.env.APP_HOST}/a/{id}
            </a>
          </p>
          {err ? <p class="err">{err}</p> : null}

          <form method="post" action={`/share/${id}/mode`} style="margin-bottom:24px">
            <input type="hidden" name="return_to" value={`/share/${id}`} />
            <span class="section-label">Who can view</span>

            <label class="share-opt">
              <input type="radio" name="mode" value="private" checked={art.shareMode === "private"} />
              <span>
                <strong>Only me</strong>
                <span class="hint">Private — only your account</span>
              </span>
            </label>
            <label class="share-opt">
              <input type="radio" name="mode" value="allowlist" checked={art.shareMode === "allowlist"} />
              <span>
                <strong>Specific people</strong>
                <span class="hint">Only the emails you add below</span>
              </span>
            </label>
            <label class="share-opt">
              <input type="radio" name="mode" value="public" checked={art.shareMode === "public"} />
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
                <span class="hint">Anyone in a GitHub org or team</span>
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
                <p>
                  Connect your GitHub account so membership checks can run. This
                  only requests org read access.
                </p>
                <div class="row" style="margin-top:12px">
                  <a class="btn sm" href={connectUrl}>
                    Connect to GitHub
                  </a>
                </div>
              </div>
            ) : (
              <div class="callout" style="margin-top:14px">
                <strong>Organization / team</strong>
                <p>
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
                    autocomplete="off"
                  />
                </label>
                <label class="field">
                  Team (optional)
                  <input
                    class="text"
                    name="github_team"
                    placeholder="eng"
                    value={art.githubTeam ?? ""}
                    autocomplete="off"
                  />
                </label>
              </div>
            )}

            <div class="row" style="margin-top:16px">
              <button class="btn" type="submit">
                Save access
              </button>
              <a class="btn secondary" href={previewUrl}>
                Back to preview
              </a>
            </div>
          </form>

          <form method="post" action={`/share/${id}/allow`}>
            <input type="hidden" name="return_to" value={`/share/${id}`} />
            <span class="section-label">Add emails (for “Specific people”)</span>
            <textarea
              class="text"
              name="emails"
              placeholder="alice@example.com, bob@example.com"
              aria-label="Emails to allow"
            />
            <div class="row" style="margin-top:12px">
              <button class="btn secondary" type="submit">
                Add emails
              </button>
            </div>
          </form>
        </div>
      </main>
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
  const fallback = `/share/${id}`;
  const returnTo = safeReturnTo(body.return_to, fallback);
  const mode = String(body.mode) as ShareMode;
  if (!SHARE_MODES.includes(mode)) return c.redirect(returnTo);

  if (mode === "github_team") {
    if (!isGithubTeamShareAvailable(c.env)) {
      return c.redirect(
        `${fallback}?err=${encodeURIComponent("GitHub org share is not configured on this instance.")}`,
      );
    }
    if (!viewer.githubLogin) {
      return c.redirect(
        `${fallback}?err=${encodeURIComponent("Connect GitHub first, then choose organization members.")}`,
      );
    }
    const orgRaw = String(body.github_org ?? "").trim();
    const teamRaw = String(body.github_team ?? "").trim();
    const org = normalizeGithubSlug(orgRaw);
    if (!org) {
      return c.redirect(
        `${fallback}?err=${encodeURIComponent("Enter a valid GitHub organization slug.")}`,
      );
    }
    let team: string | null = null;
    if (teamRaw) {
      team = normalizeGithubSlug(teamRaw);
      if (!team) {
        return c.redirect(
          `${fallback}?err=${encodeURIComponent("Enter a valid GitHub team slug, or leave it blank.")}`,
        );
      }
    }
    await setGithubTeamShare(db, id, { org, team });
  } else {
    await setShareMode(db, id, mode);
  }
  return c.redirect(returnTo);
});

shareRoutes.post("/share/:id/allow", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art || art.ownerEmail !== viewer.email) return c.text("Forbidden", 403);

  const body = await c.req.parseBody();
  const returnTo = safeReturnTo(body.return_to, `/share/${id}`);
  const emails = String(body.emails ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@") && e.length <= 254);
  await addToAllowlist(db, id, emails);
  if (art.shareMode === "private") {
    await setShareMode(db, id, "allowlist");
  }
  return c.redirect(returnTo);
});
