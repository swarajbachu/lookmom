/**
 * Viewer login via WorkOS. Supports hosted AuthKit (default) and direct
 * social providers (e.g. GitHubOAuth) for connect / team-share flows.
 *
 * After code exchange we mint our own session cookie — no per-request
 * WorkOS calls. GitHub access tokens (when returned) are used only for
 * short-lived membership checks.
 */
import type { Env } from "../types";

const WORKOS_API = "https://api.workos.com";

/** Scopes needed for org/team membership checks. */
export const GITHUB_MEMBERSHIP_SCOPES = ["read:user", "user:email", "read:org"];

export function isWorkosConfigured(env: Env): boolean {
  return !!env.WORKOS_CLIENT_ID && !!env.WORKOS_API_KEY;
}

export type WorkosProvider = "authkit" | "GitHubOAuth" | "GoogleOAuth";

export interface AuthorizeOpts {
  state: string;
  provider?: WorkosProvider;
  /** Extra OAuth scopes for the IdP (e.g. GitHub read:org). */
  providerScopes?: string[];
}

/** Build the WorkOS authorize URL. */
export function authorizationUrl(env: Env, opts: AuthorizeOpts | string): string {
  const options: AuthorizeOpts =
    typeof opts === "string" ? { state: opts, provider: "authkit" } : opts;
  const u = new URL(`${WORKOS_API}/user_management/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", env.WORKOS_CLIENT_ID);
  u.searchParams.set("redirect_uri", env.WORKOS_REDIRECT_URI);
  u.searchParams.set("provider", options.provider ?? "authkit");
  u.searchParams.set("state", options.state);
  if (options.providerScopes?.length) {
    for (const scope of options.providerScopes) {
      u.searchParams.append("provider_scopes", scope);
    }
  }
  return u.toString();
}

export interface WorkosOauthTokens {
  accessToken: string;
  refreshToken?: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface WorkosUser {
  email: string;
  name?: string;
  /** Present when WorkOS returned IdP OAuth tokens (e.g. GitHub). */
  oauthTokens?: WorkosOauthTokens;
  authenticationMethod?: string;
}

/** Exchange an authorization code for the authenticated user (+ optional IdP tokens). */
export async function exchangeCode(env: Env, code: string): Promise<WorkosUser> {
  const res = await fetch(`${WORKOS_API}/user_management/authenticate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.WORKOS_CLIENT_ID,
      client_secret: env.WORKOS_API_KEY,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WorkOS authenticate failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    user: { email: string; first_name?: string; last_name?: string };
    authentication_method?: string;
    oauth_tokens?: {
      access_token?: string;
      refresh_token?: string;
      scopes?: string[];
      expires_at?: string;
    };
  };
  const name = [data.user.first_name, data.user.last_name].filter(Boolean).join(" ");
  const oauth = data.oauth_tokens?.access_token
    ? {
        accessToken: data.oauth_tokens.access_token,
        refreshToken: data.oauth_tokens.refresh_token,
        scopes: data.oauth_tokens.scopes,
        expiresAt: data.oauth_tokens.expires_at,
      }
    : undefined;

  return {
    email: data.user.email.toLowerCase(),
    name: name || undefined,
    oauthTokens: oauth,
    authenticationMethod: data.authentication_method,
  };
}
