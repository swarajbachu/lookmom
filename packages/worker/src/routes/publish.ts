/**
 * Publish API (agent-token gated).
 *   POST /api/publish?id=&title=&emoji=&share=   body = raw HTML
 * Creates a new artifact (no id) or a new version of an owned one (id given),
 * stores the HTML in R2, records the version in D1. Returns { id, url, version }.
 */
import { Hono } from "hono";
import type { Env, Vars, ShareMode } from "../types";
import { getDb, getArtifact, createArtifact, addVersion } from "../db";
import { assertPublishAllowed, QuotaExceeded } from "../quota";
import { MAX_ARTIFACT_BYTES } from "../csp";
import { requireAgent, PUBLISH_SCOPE } from "../auth/agent";
import { enforce, RateLimited } from "../ratelimit";
import { randomId } from "../util";

const SHARE_MODES: ShareMode[] = ["private", "allowlist", "public"];

export const publishRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

publishRoutes.use("/api/publish", requireAgent(PUBLISH_SCOPE));

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
    await createArtifact(db, { id, ownerEmail: owner, title, emoji, shareMode });
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

  return c.json({
    id,
    url: `${c.env.APP_HOST}/a/${id}`,
    version: versionNo,
  });
});
