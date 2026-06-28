/**
 * Publisher (agent) authentication — auth.md User-Claimed (OTP) flow.
 *
 *   1. agent calls publish with no token        -> 401 + WWW-Authenticate
 *   2. agent reads /.well-known/oauth-protected-resource -> /auth.md
 *   3. agent POST /agent/claim                   -> { claim_token, user_code }
 *   4. owner opens /agent/confirm (AuthKit-gated), enters user_code
 *   5. agent polls POST /oauth2/token            -> { access_token } once confirmed
 *   6. POST /oauth2/revoke                        -> kill a token
 *
 * Bearer secrets (claim_token, user_code) are stored only as SHA-256 hashes.
 * AuthKit gates step 4, giving us both bot protection and the verified owner
 * email we bind the agent token to.
 */
import { Hono, type MiddlewareHandler } from "hono";
import type { Env, Vars } from "../types";
import {
  getDb,
  isTokenRevoked,
  recordAgentToken,
  revokeAgentToken,
  createClaim,
  findClaimByTokenHash,
  findClaimByCodeHash,
  confirmClaim,
  consumeClaim,
} from "../db";
import { signAgentToken, verifyAgentToken } from "../tokens";
import { now, randomId, randomSecret, sha256Hex, userCode } from "../util";
import { enforce, RateLimited, clientIp } from "../ratelimit";
import { ConfirmAgent } from "../chrome";

export const PUBLISH_SCOPE = "artifact:publish";
const ALLOWED_SCOPES = new Set([PUBLISH_SCOPE]);
const CLAIM_TTL = 600; // 10 minutes

function wwwAuthenticate(env: Env): string {
  return `Bearer resource_metadata="${env.APP_HOST}/.well-known/oauth-protected-resource"`;
}

function unauthorized(c: Parameters<MiddlewareHandler>[0]) {
  return c.json({ error: "unauthorized" }, 401, {
    "WWW-Authenticate": wwwAuthenticate(c.env as Env),
  });
}

/** Gate a route on a valid, unrevoked agent token carrying `scope`. */
export function requireAgent(scope: string): MiddlewareHandler<{ Bindings: Env; Variables: Vars }> {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = /^bearer /i.test(header) ? header.slice(7).trim() : null;
    if (!token) return unauthorized(c);

    const claims = await verifyAgentToken(c.env.JWT_SIGNING_SECRET, token);
    if (!claims || !claims.scopes.includes(scope)) return unauthorized(c);

    const db = getDb(c.env.DB);
    if (await isTokenRevoked(db, claims.jti)) return unauthorized(c);

    c.set("agent", { ownerEmail: claims.ownerEmail, scopes: claims.scopes });
    await next();
  };
}

async function readBody(c: Parameters<MiddlewareHandler>[0]): Promise<Record<string, string>> {
  const ct = c.req.header("content-type") ?? "";
  if (ct.includes("application/json")) return (await c.req.json().catch(() => ({}))) as Record<string, string>;
  const form = await c.req.parseBody().catch(() => ({}));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string") out[k] = v;
  return out;
}

export const agentRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

// --- Discovery --------------------------------------------------------------

agentRoutes.get("/.well-known/oauth-protected-resource", (c) =>
  c.json({
    resource: c.env.APP_HOST,
    authorization_servers: [c.env.APP_HOST],
    auth_md: `${c.env.APP_HOST}/auth.md`,
    token_endpoint: `${c.env.APP_HOST}/oauth2/token`,
    revocation_endpoint: `${c.env.APP_HOST}/oauth2/revoke`,
    scopes_supported: [...ALLOWED_SCOPES],
  }),
);

agentRoutes.get("/auth.md", (c) => {
  const host = c.env.APP_HOST;
  const md = `# lookmom — Agent Registration

This service supports the **user-claimed (OTP)** flow from auth.md.

## Scopes
- \`${PUBLISH_SCOPE}\` — publish and update HTML artifacts on the user's account.

## Flow
1. \`POST ${host}/agent/claim\` with JSON \`{ "scopes": ["${PUBLISH_SCOPE}"] }\`.
   Response: \`{ claim_token, user_code, verification_uri, verification_uri_complete, expires_in, interval }\`.
2. Show the user \`user_code\` and \`verification_uri\` (or open \`verification_uri_complete\`).
   The user signs in and authorizes there.
3. Poll \`POST ${host}/oauth2/token\` with \`{ "grant_type": "urn:ietf:params:oauth:grant-type:device_code", "claim_token": "..." }\`
   every \`interval\` seconds until you receive \`{ access_token }\` (or \`authorization_pending\`).
4. Send \`Authorization: Bearer <access_token>\` on publish requests.
5. \`POST ${host}/oauth2/revoke\` with \`{ "token": "<access_token>" }\` to revoke.
`;
  return c.text(md, 200, { "content-type": "text/markdown; charset=utf-8" });
});

// --- Step 3: agent creates a claim ------------------------------------------

agentRoutes.post("/agent/claim", async (c) => {
  try {
    await enforce(c.env.RL_AUTH, `claim:${clientIp(c.req.raw)}`);
  } catch (e) {
    if (e instanceof RateLimited) return c.json({ error: "rate_limited" }, 429);
    throw e;
  }
  const body = await readBody(c);
  let scopes = PUBLISH_SCOPE.split(" ");
  if (Array.isArray((body as any).scopes)) {
    scopes = ((body as any).scopes as string[]).filter((s) => ALLOWED_SCOPES.has(s));
  }
  if (scopes.length === 0) return c.json({ error: "invalid_scope" }, 400);

  const claimToken = randomSecret(32);
  const code = userCode();
  const db = getDb(c.env.DB);
  await createClaim(db, {
    id: randomId(),
    claimTokenHash: await sha256Hex(claimToken),
    userCodeHash: await sha256Hex(code),
    scopes,
    expiresAt: now() + CLAIM_TTL,
  });

  const verificationUri = `${c.env.APP_HOST}/agent/confirm`;
  return c.json({
    claim_token: claimToken,
    user_code: code,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?code=${encodeURIComponent(code)}`,
    expires_in: CLAIM_TTL,
    interval: 3,
  });
});

// --- Step 4: owner confirms (AuthKit-gated) ---------------------------------

function requireViewerOrLogin(c: Parameters<MiddlewareHandler>[0]): Response | null {
  const viewer = (c as any).get("viewer") as Vars["viewer"];
  if (viewer) return null;
  const returnTo = encodeURIComponent(c.req.url.replace(c.env.APP_HOST, "") || "/agent/confirm");
  return c.redirect(`/auth/login?return_to=${returnTo}`);
}

agentRoutes.get("/agent/confirm", (c) => {
  const redirect = requireViewerOrLogin(c);
  if (redirect) return redirect;
  const viewer = c.get("viewer")!;
  const code = c.req.query("code");
  return c.html(<ConfirmAgent email={viewer.email} prefill={code} />);
});

agentRoutes.post("/agent/confirm", async (c) => {
  const redirect = requireViewerOrLogin(c);
  if (redirect) return redirect;
  const viewer = c.get("viewer")!;
  try {
    await enforce(c.env.RL_OTP, `confirm:${clientIp(c.req.raw)}`);
  } catch (e) {
    if (e instanceof RateLimited)
      return c.html(<ConfirmAgent email={viewer.email} error="Too many attempts. Wait a minute." />, 429);
    throw e;
  }

  const body = await readBody(c);
  const code = (body.user_code ?? "").trim().toUpperCase();
  const db = getDb(c.env.DB);
  const claim = await findClaimByCodeHash(db, await sha256Hex(code));
  const invalid = () =>
    c.html(<ConfirmAgent email={viewer.email} prefill={code} error="That code is invalid or expired." />);

  if (!claim || claim.status !== "pending" || claim.expiresAt < now()) return invalid();
  await confirmClaim(db, claim.id, viewer.email);
  return c.html(<ConfirmAgent email={viewer.email} success />);
});

// --- Step 5: agent exchanges claim for a token ------------------------------

agentRoutes.post("/oauth2/token", async (c) => {
  const body = await readBody(c);
  const claimToken = body.claim_token ?? "";
  if (!claimToken) return c.json({ error: "invalid_request" }, 400);

  const hash = await sha256Hex(claimToken);
  try {
    await enforce(c.env.RL_OTP, `tok:${clientIp(c.req.raw)}:${hash.slice(0, 16)}`);
  } catch (e) {
    if (e instanceof RateLimited) return c.json({ error: "slow_down" }, 429);
    throw e;
  }

  const db = getDb(c.env.DB);
  const claim = await findClaimByTokenHash(db, hash);
  if (!claim || claim.expiresAt < now()) return c.json({ error: "invalid_grant" }, 400);
  if (claim.status === "pending") return c.json({ error: "authorization_pending" }, 400);
  if (claim.status !== "confirmed" || !claim.ownerEmail) return c.json({ error: "invalid_grant" }, 400);

  const scopes = claim.scopes.split(" ").filter(Boolean);
  const { token, jti, expiresAt } = await signAgentToken(c.env.JWT_SIGNING_SECRET, claim.ownerEmail, scopes);
  await recordAgentToken(db, { jti, ownerEmail: claim.ownerEmail, scopes, expiresAt });
  await consumeClaim(db, claim.id);

  return c.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: expiresAt - now(),
    scope: scopes.join(" "),
  });
});

// --- Step 6: revoke ---------------------------------------------------------

agentRoutes.post("/oauth2/revoke", async (c) => {
  const body = await readBody(c);
  const token = body.token ?? "";
  const claims = token ? await verifyAgentToken(c.env.JWT_SIGNING_SECRET, token) : null;
  if (claims) await revokeAgentToken(getDb(c.env.DB), claims.jti);
  // RFC 7009: always 200, even for unknown tokens.
  return c.body(null, 200);
});
