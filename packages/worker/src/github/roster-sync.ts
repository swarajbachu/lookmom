/**
 * Org-level member roster sync (and optional per-artifact snapshot).
 *
 * Linker token (read:org) lists members once so each teammate only needs
 * identity GitHub (or email if public) — no per-person org OAuth/SAML.
 */
import type { DB } from "../db";
import {
  addToAllowlist,
  replaceGithubOrgMembers,
  replaceGithubShareRoster,
  touchGithubOrgLinkSynced,
} from "../db";
import {
  fetchPublicEmail,
  listOrgMembers,
  listTeamMembers,
} from "./orgs";

export interface RosterSyncResult {
  members: number;
  emails: number;
  error?: string;
}

async function hydrateMembers(
  accessToken: string,
  logins: string[],
): Promise<Array<{ githubLogin: string; email?: string | null }>> {
  const unique = [...new Set(logins.map((l) => l.toLowerCase()))];
  const members: Array<{ githubLogin: string; email?: string | null }> = [];
  const concurrency = 6;
  for (let i = 0; i < unique.length; i += concurrency) {
    const slice = unique.slice(i, i + concurrency);
    const found = await Promise.all(
      slice.map(async (login) => {
        const email = await fetchPublicEmail(accessToken, login);
        return { githubLogin: login, email };
      }),
    );
    members.push(...found);
  }
  return members;
}

/** Sync org-level roster for a linked org. */
export async function syncOrgMembers(
  db: DB,
  args: {
    org: string;
    accessToken: string;
    /** Optional: only this team’s members. */
    team?: string | null;
  },
): Promise<RosterSyncResult> {
  const org = args.org.toLowerCase();
  const team = args.team?.trim() ? args.team.trim().toLowerCase() : null;

  let logins: string[];
  try {
    logins = team
      ? await listTeamMembers(args.accessToken, org, team)
      : await listOrgMembers(args.accessToken, org);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { members: 0, emails: 0, error: msg };
  }

  const members = await hydrateMembers(args.accessToken, logins);
  await replaceGithubOrgMembers(db, org, members);
  await touchGithubOrgLinkSynced(db, org);

  const emails = members.map((m) => m.email).filter((e): e is string => !!e);
  return { members: members.length, emails: emails.length };
}

/**
 * When sharing an artifact to an org: ensure org roster is fresh and
 * copy public emails onto the artifact allowlist; also keep per-artifact
 * roster for backward compatibility with older gate paths.
 */
export async function syncGithubShareRoster(
  db: DB,
  args: {
    artifactId: string;
    accessToken: string;
    org: string;
    team?: string | null;
  },
): Promise<RosterSyncResult> {
  const orgSync = await syncOrgMembers(db, {
    org: args.org,
    accessToken: args.accessToken,
    team: args.team,
  });
  if (orgSync.error) return orgSync;

  // Pull from org members table for this org (team filter already applied above)
  // Re-list for artifact snapshot accuracy
  let logins: string[];
  try {
    const team = args.team?.trim() ? args.team.trim().toLowerCase() : null;
    logins = team
      ? await listTeamMembers(args.accessToken, args.org, team)
      : await listOrgMembers(args.accessToken, args.org);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { members: 0, emails: 0, error: msg };
  }

  const members = await hydrateMembers(args.accessToken, logins);
  await replaceGithubShareRoster(db, args.artifactId, members);

  const emails = members.map((m) => m.email).filter((e): e is string => !!e);
  if (emails.length) {
    await addToAllowlist(db, args.artifactId, emails);
  }

  return { members: members.length, emails: emails.length };
}
