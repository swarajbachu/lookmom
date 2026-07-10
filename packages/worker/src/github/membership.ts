/**
 * Live GitHub org/team membership checks with a short D1 cache.
 * Fail closed on API errors — never grant access when membership is unknown.
 */
import type { DB } from "../db";
import { getMembershipCache, putMembershipCache } from "../db";

const GITHUB_API = "https://api.github.com";

function ghHeaders(accessToken: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${accessToken}`,
    "user-agent": "lookmom",
    "x-github-api-version": "2022-11-28",
  };
}

/**
 * Check whether `githubLogin` is a member of `org` (and optional `team`).
 * Uses cache when fresh; otherwise calls GitHub with the viewer's OAuth token.
 */
export async function isGithubTeamMember(
  db: DB,
  args: {
    githubLogin: string;
    org: string;
    team?: string | null;
    accessToken: string | undefined;
  },
): Promise<{ allowed: boolean; reason: "member" | "not_member" | "needs_github" | "error" }> {
  const login = args.githubLogin.toLowerCase();
  const org = args.org.toLowerCase();
  const team = (args.team ?? "").trim().toLowerCase();

  const cached = await getMembershipCache(db, login, org, team);
  if (cached) {
    return {
      allowed: cached.isMember,
      reason: cached.isMember ? "member" : "not_member",
    };
  }

  if (!args.accessToken) {
    return { allowed: false, reason: "needs_github" };
  }

  try {
    const isMember = team
      ? await checkTeamMembership(args.accessToken, org, team, login)
      : await checkOrgMembership(args.accessToken, org, login);

    await putMembershipCache(db, {
      githubLogin: login,
      org,
      team,
      isMember,
    });

    return {
      allowed: isMember,
      reason: isMember ? "member" : "not_member",
    };
  } catch {
    return { allowed: false, reason: "error" };
  }
}

/** Org membership: 204 = member, 404 = not member / no access. */
async function checkOrgMembership(
  accessToken: string,
  org: string,
  login: string,
): Promise<boolean> {
  const res = await fetch(`${GITHUB_API}/orgs/${org}/members/${login}`, {
    headers: ghHeaders(accessToken),
  });
  if (res.status === 204) return true;
  if (res.status === 404 || res.status === 302) return false;
  // 403 often means SAML SSO not authorized for this token — treat as not member.
  if (res.status === 403) return false;
  throw new Error(`org membership check failed: ${res.status}`);
}

/** Team membership: active/pending states; only "active" grants access. */
async function checkTeamMembership(
  accessToken: string,
  org: string,
  team: string,
  login: string,
): Promise<boolean> {
  const res = await fetch(
    `${GITHUB_API}/orgs/${org}/teams/${team}/memberships/${login}`,
    { headers: ghHeaders(accessToken) },
  );
  if (res.status === 404) return false;
  if (res.status === 403) return false;
  if (!res.ok) throw new Error(`team membership check failed: ${res.status}`);
  const data = (await res.json()) as { state?: string };
  return data.state === "active";
}
