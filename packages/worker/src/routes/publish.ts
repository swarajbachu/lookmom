/**
 * Publish API (agent-token gated).
 *   POST /api/publish?id=&title=&emoji=&share=   body = raw HTML
 * Creates a new artifact (no id) or a new version of an owned one (id given),
 * stores the HTML in R2, records the version in D1. Returns { id, url, version }.
 */
import { Hono } from "hono";
import type { Env, Vars, ShareMode } from "../types";
import {
  getDb,
  getArtifact,
  createArtifact,
  addVersion,
  listArtifactsByOwner,
  setShareMode,
  addToAllowlist,
  setGithubTeamShare,
} from "../db";
import { assertPublishAllowed, QuotaExceeded } from "../quota";
import { MAX_ARTIFACT_BYTES } from "../csp";
import { requireAgent, PUBLISH_SCOPE } from "../auth/agent";
import { isGithubTeamShareAvailable, normalizeGithubSlug } from "../auth/github";
import { enforce, RateLimited } from "../ratelimit";
import { randomId } from "../util";

const SHARE_MODES: ShareMode[] = ["private", "allowlist", "public", "github_team"];

export const publishRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

// All /api/* routes here require a valid agent token.
publishRoutes.use("/api/publish", requireAgent(PUBLISH_SCOPE));
publishRoutes.use("/api/artifacts", requireAgent(PUBLISH_SCOPE));
publishRoutes.use("/api/artifacts/*", requireAgent(PUBLISH_SCOPE));

/** List the caller's artifacts (for `lookmom list`). */
publishRoutes.get("/api/artifacts", async (c) => {
  const owner = c.get("agent")!.ownerEmail;
  const db = getDb(c.env.DB);
  const rows = await listArtifactsByOwner(db, owner);
  return c.json({
    artifacts: rows.map((a) => ({
      id: a.id,
      title: a.title,
      emoji: a.emoji,
      share_mode: a.shareMode,
      github_org: a.githubOrg ?? null,
      github_team: a.githubTeam ?? null,
      version: a.currentVersion,
      url: `${c.env.APP_HOST}/a/${a.id}`,
      updated_at: a.updatedAt,
    })),
  });
});

/** Manage sharing for an owned artifact (for `lookmom share`). */
publishRoutes.post("/api/artifacts/:id/share", async (c) => {
  const owner = c.get("agent")!.ownerEmail;
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art) return c.json({ error: "not_found" }, 404);
  if (art.ownerEmail !== owner) return c.json({ error: "forbidden" }, 403);

  const body = (await c.req.json().catch(() => ({}))) as {
    mode?: string;
    emails?: string[];
    github_org?: string;
    github_team?: string | null;
  };

  const mode = body.mode as ShareMode | undefined;
  if (mode && !SHARE_MODES.includes(mode)) {
    return c.json({ error: "invalid_mode" }, 400);
  }

  // Resolve effective mode: explicit mode, or github_team if org provided.
  let effectiveMode = mode;
  if (!effectiveMode && body.github_org) effectiveMode = "github_team";

  if (effectiveMode === "github_team") {
    if (!isGithubTeamShareAvailable(c.env)) {
      return c.json(
        {
          error: "github_not_configured",
          message:
            "GitHub org share needs WorkOS GitHub OAuth (return tokens + read:org) or GITHUB_CLIENT_ID/SECRET on this instance.",
        },
        503,
      );
    }
    const orgRaw = body.github_org ?? art.githubOrg ?? "";
    const org = normalizeGithubSlug(String(orgRaw));
    if (!org) return c.json({ error: "github_org_required" }, 400);
    let team: string | null = null;
    if (body.github_team !== undefined && body.github_team !== null && body.github_team !== "") {
      team = normalizeGithubSlug(String(body.github_team));
      if (!team) return c.json({ error: "invalid_github_team" }, 400);
    } else if (body.github_team === null || body.github_team === "") {
      team = null;
    } else if (art.githubTeam) {
      team = art.githubTeam;
    }
    await setGithubTeamShare(db, id, { org, team });
  } else if (effectiveMode && SHARE_MODES.includes(effectiveMode)) {
    await setShareMode(db, id, effectiveMode);
  }

  if (Array.isArray(body.emails)) {
    const emails = body.emails
      .map((e) => String(e).trim().toLowerCase())
      .filter((e) => e.includes("@") && e.length <= 254);
    await addToAllowlist(db, id, emails);
  }

  const updated = await getArtifact(db, id);
  return c.json({
    id,
    share_mode: updated?.shareMode,
    github_org: updated?.githubOrg ?? null,
    github_team: updated?.githubTeam ?? null,
    url: `${c.env.APP_HOST}/a/${id}`,
  });
});

publishRoutes.post("/api/publish", async (c) => {
  const agent = c.get("agent")!;
  const owner = agent.ownerEmail;

  try {
    await enforce(c.env.RL_PUBLISH, `publish:${owner}`);
  } catch (e) {
    if (e instanceof RateLimited) return c.json({ error: "rate_limited" }, 429);
    throw e;
  }

  // Reject oversize before reading the body.
  const declared = Number(c.req.header("content-length") ?? "0");
  if (declared > MAX_ARTIFACT_BYTES) {
    return c.json({ error: "too_large", max_bytes: MAX_ARTIFACT_BYTES }, 413);
  }

  const buf = new Uint8Array(await c.req.arrayBuffer());
  if (buf.byteLength === 0) return c.json({ error: "empty_body" }, 400);
  if (buf.byteLength > MAX_ARTIFACT_BYTES) {
    return c.json({ error: "too_large", max_bytes: MAX_ARTIFACT_BYTES }, 413);
  }

  const db = getDb(c.env.DB);
  const q = c.req.query();
  const title = (q.title ?? "Untitled artifact").slice(0, 200);
  const emoji = (q.emoji ?? "📄").slice(0, 8);
  const shareMode: ShareMode = SHARE_MODES.includes(q.share as ShareMode)
    ? (q.share as ShareMode)
    : "private";

  let githubOrg: string | null = null;
  let githubTeam: string | null = null;
  if (shareMode === "github_team") {
    if (!isGithubTeamShareAvailable(c.env)) {
      return c.json(
        {
          error: "github_not_configured",
          message:
            "GitHub org share needs WorkOS GitHub OAuth (return tokens + read:org) or GITHUB_CLIENT_ID/SECRET on this instance.",
        },
        503,
      );
    }
    githubOrg = normalizeGithubSlug(q.github_org ?? "");
    if (!githubOrg) return c.json({ error: "github_org_required" }, 400);
    if (q.github_team) {
      githubTeam = normalizeGithubSlug(q.github_team);
      if (!githubTeam) return c.json({ error: "invalid_github_team" }, 400);
    }
  }

  let id = q.id;
  const isNew = !id;

  if (id) {
    const art = await getArtifact(db, id);
    if (!art) return c.json({ error: "not_found" }, 404);
    if (art.ownerEmail !== owner) return c.json({ error: "forbidden" }, 403);
  } else {
    id = randomId();
  }

  try {
    await assertPublishAllowed(db, owner, buf.byteLength, isNew);
  } catch (e) {
    if (e instanceof QuotaExceeded) return c.json({ error: e.reason }, 403);
    throw e;
  }

  if (isNew) {
    await createArtifact(db, {
      id,
      ownerEmail: owner,
      title,
      emoji,
      shareMode: shareMode === "github_team" ? "private" : shareMode,
    });
    if (shareMode === "github_team" && githubOrg) {
      await setGithubTeamShare(db, id, { org: githubOrg, team: githubTeam });
    }
  }

  const versionId = randomId();
  const r2Key = `${id}/${versionId}.html`;
  await c.env.BLOBS.put(r2Key, buf, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });

  const versionNo = await addVersion(db, {
    versionId,
    artifactId: id,
    r2Key,
    sizeBytes: buf.byteLength,
    title: isNew ? undefined : title,
    emoji: isNew ? undefined : emoji,
  });

  // On update, apply share settings if provided.
  if (!isNew && shareMode === "github_team" && githubOrg) {
    await setGithubTeamShare(db, id, { org: githubOrg, team: githubTeam });
  } else if (!isNew && q.share && SHARE_MODES.includes(shareMode) && shareMode !== "github_team") {
    await setShareMode(db, id, shareMode);
  }

  return c.json({
    id,
    url: `${c.env.APP_HOST}/a/${id}`,
    version: versionNo,
  });
});
