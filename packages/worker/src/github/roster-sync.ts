/**
 * Owner-driven roster sync for github_team share.
 *
 * Lists org/team members with the *owner's* GitHub token (once), so each of 50
 * teammates doesn't need to authorize the OAuth app / SAML for membership
 * checks. Public emails (when set) are copied into the allowlist for email
 * sign-in; everyone else can sign in with GitHub and match by login.
 */
import type { DB } from "../db";
import {
  addToAllowlist,
  replaceGithubShareRoster,
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

export async function syncGithubShareRoster(
  db: DB,
  args: {
    artifactId: string;
    accessToken: string;
    org: string;
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

  // Dedupe logins
  const unique = [...new Set(logins.map((l) => l.toLowerCase()))];

  // Best-effort public emails (rate-limit friendly batching)
  const members: Array<{ githubLogin: string; email?: string | null }> = [];
  const emails: string[] = [];
  const concurrency = 6;
  for (let i = 0; i < unique.length; i += concurrency) {
    const slice = unique.slice(i, i + concurrency);
    const found = await Promise.all(
      slice.map(async (login) => {
        const email = await fetchPublicEmail(args.accessToken, login);
        return { githubLogin: login, email };
      }),
    );
    for (const m of found) {
      members.push(m);
      if (m.email) emails.push(m.email);
    }
  }

  await replaceGithubShareRoster(db, args.artifactId, members);
  if (emails.length) {
    await addToAllowlist(db, args.artifactId, emails);
  }

  return { members: members.length, emails: emails.length };
}
