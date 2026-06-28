import type { Context } from "hono";

/** Workers' built-in rate-limit binding shape. Optional so local/dev no-ops. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Cloudflare bindings + vars available to the Worker. */
export interface Env {
  // Bindings
  DB: D1Database;
  BLOBS: R2Bucket;

  // Layer 1 rate limiters (see wrangler.toml). Optional => graceful no-op.
  RL_VIEW?: RateLimiter;
  RL_PUBLISH?: RateLimiter;
  RL_OTP?: RateLimiter;
  RL_AUTH?: RateLimiter;

  // Vars (wrangler.toml [vars])
  APP_HOST: string;
  ARTIFACT_SANDBOX_HOST: string;
  WORKOS_CLIENT_ID: string;
  WORKOS_REDIRECT_URI: string;
  DEV_ALLOWLIST: string;

  // Secrets (wrangler secret put / .dev.vars)
  WORKOS_API_KEY: string;
  JWT_SIGNING_SECRET: string;
}

export interface Vars {
  /** Set by viewer-session middleware once a human is authenticated. */
  viewer?: { email: string; name?: string };
  /** Set by agent-token middleware once a publisher token is verified. */
  agent?: { ownerEmail: string; scopes: string[] };
}

export type AppContext = Context<{ Bindings: Env; Variables: Vars }>;

// Row types live with the Drizzle schema.
export type { Artifact, Version, ShareMode } from "./schema";
