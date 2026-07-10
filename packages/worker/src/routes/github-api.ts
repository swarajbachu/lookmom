/**
 * CLI GitHub connect via WorkOS (not a separate GitHub OAuth device app):
 *
 *   POST /api/github/connect       — start claim (agent token)
 *   POST /api/github/connect/poll  — poll until human finishes WorkOS GitHub
 *   GET  /api/github/orgs          — list orgs for this owner (server holds token)
 *   GET  /api/github/orgs/:org/teams
 *   DELETE /api/github/connect     — disconnect
 *   GET  /api/github/status
 *
 * Flow: CLI → lookmom claim → browser WorkOS GitHubOAuth (return tokens) →
 * store token on owner → CLI lists orgs via API.
 */
import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { requireAgent, PUBLISH_SCOPE } from "../auth/agent";
import {
  getDb,
  createGithubCliClaim,
  findGithubCliClaimByTokenHash,
  getOwnerGithub,
  deleteOwnerGithub,
} from "../db";
import { isWorkosConfigured } from "../auth/workos";
import { listOrgTeams, listUserOrgs } from "../github/orgs";
import { enforce, RateLimited, clientIp } from "../ratelimit";
import { now, randomId, randomSecret, sha256Hex, userCode } from "../util";

const CLAIM_TTL = 600;

export const githubApiRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

githubApiRoutes.get("/api/github/config", (c) =>
  c.json({
    workos: isWorkosConfigured(c.env),
    /** CLI connect uses WorkOS GitHubOAuth + return tokens — not GitHub device flow. */
    cli_connect: isWorkosConfigured(c.env),
    scopes: "read:user user:email read:org",
  }),
);

githubApiRoutes.use("/api/github/connect", requireAgent(PUBLISH_SCOPE));
githubApiRoutes.use("/api/github/connect/*", requireAgent(PUBLISH_SCOPE));
githubApiRoutes.use("/api/github/orgs", requireAgent(PUBLISH_SCOPE));
githubApiRoutes.use("/api/github/orgs/*", requireAgent(PUBLISH_SCOPE));
githubApiRoutes.use("/api/github/status", requireAgent(PUBLISH_SCOPE));

githubApiRoutes.get("/api/github/status", async (c) => {
  const owner = c.get("agent")!.ownerEmail;
  const db = getDb(c.env.DB);
  const link = await getOwnerGithub(db, owner);
  return c.json({
    connected: !!link,
    login: link?.githubLogin ?? null,
    workos: isWorkosConfigured(c.env),
  });
});

/** Start CLI GitHub connect: agent already knows owner; human completes WorkOS GitHub. */
githubApiRoutes.post("/api/github/connect", async (c) => {
  try {
    await enforce(c.env.RL_AUTH, `ghcli:${clientIp(c.req.raw)}`);
  } catch (e) {
    if (e instanceof RateLimited) return c.json({ error: "rate_limited" }, 429);
    throw e;
  }
  if (!isWorkosConfigured(c.env)) {
    return c.json(
      {
        error: "workos_required",
        message:
          "CLI GitHub connect needs WorkOS with GitHub OAuth enabled (Return GitHub OAuth tokens + read:org).",
      },
      503,
    );
  }

  const owner = c.get("agent")!.ownerEmail;
  const db = getDb(c.env.DB);
  const id = randomId();
  const claimToken = randomSecret(32);
  const code = userCode();
  const expiresAt = now() + CLAIM_TTL;

  await createGithubCliClaim(db, {
    id,
    claimTokenHash: await sha256Hex(claimToken),
    userCodeHash: await sha256Hex(code),
    ownerEmail: owner,
    expiresAt,
  });

  const verificationUri = `${c.env.APP_HOST}/connect/github/cli`;
  const verificationUriComplete = `${verificationUri}?code=${encodeURIComponent(code)}`;

  return c.json({
    claim_token: claimToken,
    user_code: code,
    verification_uri: verificationUri,
    verification_uri_complete: verificationUriComplete,
    expires_in: CLAIM_TTL,
    interval: 2,
  });
});

githubApiRoutes.post("/api/github/connect/poll", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { claim_token?: string };
  const claimToken = String(body.claim_token ?? "").trim();
  if (!claimToken) return c.json({ error: "claim_token_required" }, 400);

  const db = getDb(c.env.DB);
  const claim = await findGithubCliClaimByTokenHash(db, await sha256Hex(claimToken));
  if (!claim) return c.json({ status: "pending" });
  if (claim.expiresAt < now()) return c.json({ status: "expired" });
  if (claim.status === "completed") {
    return c.json({ status: "ok", login: claim.githubLogin });
  }
  return c.json({ status: "pending" });
});

githubApiRoutes.delete("/api/github/connect", async (c) => {
  const owner = c.get("agent")!.ownerEmail;
  const db = getDb(c.env.DB);
  await deleteOwnerGithub(db, owner);
  return c.json({ ok: true });
});

githubApiRoutes.get("/api/github/orgs", async (c) => {
  const owner = c.get("agent")!.ownerEmail;
  const db = getDb(c.env.DB);
  const link = await getOwnerGithub(db, owner);
  if (!link) {
    return c.json(
      {
        error: "github_not_connected",
        message: "Run `lookmom github login` first (WorkOS GitHub connect).",
      },
      400,
    );
  }
  try {
    const orgs = await listUserOrgs(link.accessToken);
    return c.json({ login: link.githubLogin, orgs });
  } catch (e) {
    console.error("list orgs:", e);
    return c.json(
      {
        error: "github_api_failed",
        message: "Could not list orgs. Re-run `lookmom github login`.",
      },
      502,
    );
  }
});

githubApiRoutes.get("/api/github/orgs/:org/teams", async (c) => {
  const owner = c.get("agent")!.ownerEmail;
  const org = c.req.param("org");
  const db = getDb(c.env.DB);
  const link = await getOwnerGithub(db, owner);
  if (!link) {
    return c.json({ error: "github_not_connected" }, 400);
  }
  try {
    const teams = await listOrgTeams(link.accessToken, org);
    return c.json({ org, teams });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "org_not_found") return c.json({ error: "org_not_found" }, 404);
    console.error("list teams:", e);
    return c.json({ error: "github_api_failed" }, 502);
  }
});
