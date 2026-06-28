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
import { getArtifact, getVersion, isAllowed, getDb } from "../db";
import { artifactHeaders } from "../csp";
import { signGrant, verifyGrant } from "../grants";
import { enforce, RateLimited, clientIp } from "../ratelimit";
import { AccessDenied, ArtifactFrame, LoginPrompt } from "../chrome";

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

  // Decide access.
  let allowed = art.shareMode === "public";
  if (!allowed) {
    if (!viewer) return c.html(<LoginPrompt title={art.title} loginUrl={loginUrl} />);
    if (viewer.email === art.ownerEmail) allowed = true;
    else if (art.shareMode === "allowlist") allowed = await isAllowed(db, id, viewer.email);
  }
  if (!allowed) {
    return c.html(<AccessDenied email={viewer!.email} switchUrl={loginUrl} />);
  }

  // Issue a short-lived grant and hand off to the cookieless sandbox host.
  const grant = await signGrant(c.env.JWT_SIGNING_SECRET, id, art.currentVersion);
  const rawUrl = `${c.env.ARTIFACT_SANDBOX_HOST}/raw/${id}?grant=${encodeURIComponent(grant)}`;
  return c.html(
    <ArtifactFrame
      title={art.title}
      emoji={art.emoji}
      rawUrl={rawUrl}
      canShare={!!viewer && viewer.email === art.ownerEmail}
      shareUrl={`${c.env.APP_HOST}/share/${id}`}
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
    headers: artifactHeaders({ "cache-control": "private, no-store" }),
  });
});
