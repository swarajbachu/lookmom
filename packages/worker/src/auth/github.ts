/**
 * GitHub identity helpers for github_team share mode.
 *
 * Preferred path: WorkOS GitHubOAuth with "Return GitHub OAuth tokens" +
 * read:org scopes (see workos.ts). Direct GitHub OAuth App credentials remain
 * as a fallback when WorkOS isn't used for GitHub.
 */
import type { Env } from "../types";
import { isWorkosConfigured } from "./workos";

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_API = "https://api.github.com";

/** Scopes: identity + verified emails + org membership for private orgs. */
export const GITHUB_OAUTH_SCOPES = "read:user user:email read:org";

/** Direct GitHub OAuth App credentials (legacy / local fallback). */
export function isGithubConfigured(env: Env): boolean {
  return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

/**
 * Instance can run github_team share: WorkOS (primary) or a dedicated
 * GitHub OAuth App (fallback).
 */
export function isGithubTeamShareAvailable(env: Env): boolean {
  return isWorkosConfigured(env) || isGithubConfigured(env);
}

export function githubRedirectUri(env: Env): string {
  return env.GITHUB_OAUTH_REDIRECT_URI || `${env.APP_HOST}/auth/github/callback`;
}

/** Build the direct GitHub OAuth authorize URL. `state` must be verified on callback. */
export function githubAuthorizationUrl(env: Env, state: string): string {
  const u = new URL(GITHUB_AUTHORIZE);
  u.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
  u.searchParams.set("redirect_uri", githubRedirectUri(env));
  u.searchParams.set("scope", GITHUB_OAUTH_SCOPES);
  u.searchParams.set("state", state);
  return u.toString();
}

export interface GithubUser {
  login: string;
  email: string;
  name?: string;
  accessToken: string;
}

/** Load GitHub login (+ email when possible) from an access token. */
export async function fetchGithubUser(accessToken: string): Promise<{
  login: string;
  email: string;
  name?: string;
}> {
  const userRes = await fetch(`${GITHUB_API}/user`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "lookmom",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!userRes.ok) {
    throw new Error(`GitHub /user failed (${userRes.status})`);
  }
  const user = (await userRes.json()) as {
    login: string;
    email?: string | null;
    name?: string | null;
  };

  let email = (user.email ?? "").toLowerCase();
  if (!email) {
    const emailsRes = await fetch(`${GITHUB_API}/user/emails`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${accessToken}`,
        "user-agent": "lookmom",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary =
        emails.find((e) => e.primary && e.verified) ??
        emails.find((e) => e.verified) ??
        emails[0];
      if (primary) email = primary.email.toLowerCase();
    }
  }
  if (!email) {
    // Fallback so session can still form; membership uses login, not email.
    email = `${user.login.toLowerCase()}@users.noreply.github.com`;
  }

  return {
    login: user.login.toLowerCase(),
    email,
    name: user.name ?? undefined,
  };
}

/** Exchange code for access token + load user login and a usable email. */
export async function exchangeGithubCode(env: Env, code: string): Promise<GithubUser> {
  const tokRes = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: githubRedirectUri(env),
    }),
  });
  if (!tokRes.ok) {
    const text = await tokRes.text();
    throw new Error(`GitHub token exchange failed (${tokRes.status}): ${text}`);
  }
  const tok = (await tokRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tok.access_token) {
    throw new Error(
      `GitHub token exchange failed: ${tok.error ?? "no_token"} ${tok.error_description ?? ""}`,
    );
  }
  const accessToken = tok.access_token;
  const profile = await fetchGithubUser(accessToken);
  return {
    login: profile.login,
    email: profile.email,
    name: profile.name,
    accessToken,
  };
}

/** GitHub org/team slug: lowercase alphanumeric + hyphens, 1–39 chars. */
export function isValidGithubSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(s) || /^[a-z0-9]$/.test(s);
}

export function normalizeGithubSlug(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s || s.length > 39 || !isValidGithubSlug(s)) return null;
  return s;
}
