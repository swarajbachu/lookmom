/** D1 data-access via Drizzle. Metadata + access control only; blobs in R2. */
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "./schema";
import type { Artifact, ShareMode, Version } from "./schema";
import { now } from "./util";

export type DB = DrizzleD1Database<typeof schema>;

export function getDb(d1: D1Database): DB {
  return drizzle(d1, { schema });
}

export async function getArtifact(db: DB, id: string): Promise<Artifact | undefined> {
  return db.query.artifacts.findFirst({ where: eq(schema.artifacts.id, id) });
}

export async function createArtifact(
  db: DB,
  args: { id: string; ownerEmail: string; title: string; emoji: string; shareMode: ShareMode },
): Promise<void> {
  const ts = now();
  await db.insert(schema.artifacts).values({
    id: args.id,
    ownerEmail: args.ownerEmail.toLowerCase(),
    title: args.title,
    emoji: args.emoji,
    currentVersion: 0,
    shareMode: args.shareMode,
    createdAt: ts,
    updatedAt: ts,
  });
}

/** Record a new version atomically, bump current_version, return the new no. */
export async function addVersion(
  db: DB,
  args: {
    versionId: string;
    artifactId: string;
    r2Key: string;
    sizeBytes: number;
    title?: string;
    emoji?: string;
  },
): Promise<number> {
  const art = await getArtifact(db, args.artifactId);
  if (!art) throw new Error("artifact not found");
  const nextNo = art.currentVersion + 1;
  const ts = now();

  await db.batch([
    db.insert(schema.versions).values({
      id: args.versionId,
      artifactId: args.artifactId,
      versionNo: nextNo,
      r2Key: args.r2Key,
      sizeBytes: args.sizeBytes,
      createdAt: ts,
    }),
    db
      .update(schema.artifacts)
      .set({
        currentVersion: nextNo,
        updatedAt: ts,
        ...(args.title ? { title: args.title } : {}),
        ...(args.emoji ? { emoji: args.emoji } : {}),
      })
      .where(eq(schema.artifacts.id, args.artifactId)),
  ]);
  return nextNo;
}

export async function getVersion(
  db: DB,
  artifactId: string,
  versionNo: number,
): Promise<Version | undefined> {
  return db.query.versions.findFirst({
    where: and(
      eq(schema.versions.artifactId, artifactId),
      eq(schema.versions.versionNo, versionNo),
    ),
  });
}

export async function listArtifactsByOwner(db: DB, ownerEmail: string): Promise<Artifact[]> {
  return db.query.artifacts.findMany({
    where: eq(schema.artifacts.ownerEmail, ownerEmail.toLowerCase()),
    orderBy: desc(schema.artifacts.updatedAt),
  });
}

// --- Access control ---------------------------------------------------------

export async function isAllowed(db: DB, artifactId: string, email: string): Promise<boolean> {
  const row = await db.query.allowlist.findFirst({
    where: and(
      eq(schema.allowlist.artifactId, artifactId),
      eq(schema.allowlist.email, email.toLowerCase()),
    ),
  });
  return !!row;
}

export async function addToAllowlist(
  db: DB,
  artifactId: string,
  emails: string[],
): Promise<void> {
  if (emails.length === 0) return;
  const ts = now();
  await db
    .insert(schema.allowlist)
    .values(emails.map((e) => ({ artifactId, email: e.toLowerCase(), addedAt: ts })))
    .onConflictDoNothing();
}

export async function setShareMode(db: DB, artifactId: string, mode: ShareMode): Promise<void> {
  await db
    .update(schema.artifacts)
    .set({
      shareMode: mode,
      updatedAt: now(),
      // Leaving github_team clears org/team so settings don't surprise later.
      ...(mode !== "github_team" ? { githubOrg: null, githubTeam: null } : {}),
    })
    .where(eq(schema.artifacts.id, artifactId));
}

/** Set github_team share mode with org (+ optional team slug). */
export async function setGithubTeamShare(
  db: DB,
  artifactId: string,
  args: { org: string; team?: string | null },
): Promise<void> {
  const org = args.org.toLowerCase();
  const team = args.team?.trim() ? args.team.trim().toLowerCase() : null;
  await db
    .update(schema.artifacts)
    .set({
      shareMode: "github_team",
      githubOrg: org,
      githubTeam: team,
      updatedAt: now(),
    })
    .where(eq(schema.artifacts.id, artifactId));
}

const MEMBERSHIP_CACHE_TTL_SECONDS = 15 * 60;

export async function getMembershipCache(
  db: DB,
  githubLogin: string,
  org: string,
  team: string,
): Promise<{ isMember: boolean; checkedAt: number } | null> {
  const row = await db.query.githubMembershipCache.findFirst({
    where: and(
      eq(schema.githubMembershipCache.githubLogin, githubLogin.toLowerCase()),
      eq(schema.githubMembershipCache.org, org.toLowerCase()),
      eq(schema.githubMembershipCache.team, team.toLowerCase()),
    ),
  });
  if (!row) return null;
  if (now() - row.checkedAt > MEMBERSHIP_CACHE_TTL_SECONDS) return null;
  return { isMember: row.isMember === 1, checkedAt: row.checkedAt };
}

export async function putMembershipCache(
  db: DB,
  args: { githubLogin: string; org: string; team: string; isMember: boolean },
): Promise<void> {
  const ts = now();
  const login = args.githubLogin.toLowerCase();
  const org = args.org.toLowerCase();
  const team = args.team.toLowerCase();
  await db
    .insert(schema.githubMembershipCache)
    .values({
      githubLogin: login,
      org,
      team,
      isMember: args.isMember ? 1 : 0,
      checkedAt: ts,
    })
    .onConflictDoUpdate({
      target: [
        schema.githubMembershipCache.githubLogin,
        schema.githubMembershipCache.org,
        schema.githubMembershipCache.team,
      ],
      set: { isMember: args.isMember ? 1 : 0, checkedAt: ts },
    });
}

export { MEMBERSHIP_CACHE_TTL_SECONDS };

// --- Agent token revocation -------------------------------------------------

export async function recordAgentToken(
  db: DB,
  args: { jti: string; ownerEmail: string; scopes: string[]; expiresAt: number },
): Promise<void> {
  await db.insert(schema.agentTokens).values({
    jti: args.jti,
    ownerEmail: args.ownerEmail.toLowerCase(),
    scopes: args.scopes.join(" "),
    issuedAt: now(),
    expiresAt: args.expiresAt,
    revoked: 0,
  });
}

/** Fail closed: unknown jti counts as revoked. */
export async function isTokenRevoked(db: DB, jti: string): Promise<boolean> {
  const row = await db.query.agentTokens.findFirst({
    where: eq(schema.agentTokens.jti, jti),
    columns: { revoked: true },
  });
  if (!row) return true;
  return row.revoked === 1;
}

export async function revokeAllAgentTokens(db: DB, ownerEmail: string): Promise<number> {
  const res = await db
    .update(schema.agentTokens)
    .set({ revoked: 1 })
    .where(
      and(
        eq(schema.agentTokens.ownerEmail, ownerEmail.toLowerCase()),
        eq(schema.agentTokens.revoked, 0),
      ),
    );
  // d1 run result is exposed via .meta on the raw driver; Drizzle returns it through sql`changes()`
  return (res as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
}

export async function revokeAgentToken(db: DB, jti: string): Promise<void> {
  await db
    .update(schema.agentTokens)
    .set({ revoked: 1 })
    .where(eq(schema.agentTokens.jti, jti));
}

// --- auth.md claim flow -----------------------------------------------------

export async function createClaim(
  db: DB,
  args: {
    id: string;
    claimTokenHash: string;
    userCodeHash: string;
    scopes: string[];
    expiresAt: number;
  },
): Promise<void> {
  await db.insert(schema.claimAttempts).values({
    id: args.id,
    claimTokenHash: args.claimTokenHash,
    userCodeHash: args.userCodeHash,
    scopes: args.scopes.join(" "),
    status: "pending",
    createdAt: now(),
    expiresAt: args.expiresAt,
  });
}

export async function findClaimByTokenHash(db: DB, claimTokenHash: string) {
  return db.query.claimAttempts.findFirst({
    where: eq(schema.claimAttempts.claimTokenHash, claimTokenHash),
  });
}

export async function findClaimByCodeHash(db: DB, userCodeHash: string) {
  return db.query.claimAttempts.findFirst({
    where: eq(schema.claimAttempts.userCodeHash, userCodeHash),
  });
}

export async function confirmClaim(db: DB, id: string, ownerEmail: string): Promise<void> {
  await db
    .update(schema.claimAttempts)
    .set({ status: "confirmed", ownerEmail: ownerEmail.toLowerCase() })
    .where(eq(schema.claimAttempts.id, id));
}

export async function consumeClaim(db: DB, id: string): Promise<void> {
  await db
    .update(schema.claimAttempts)
    .set({ status: "consumed" })
    .where(eq(schema.claimAttempts.id, id));
}

// --- Owner GitHub link (WorkOS) + CLI connect claims ------------------------

export async function upsertOwnerGithub(
  db: DB,
  args: { ownerEmail: string; githubLogin: string; accessToken: string },
): Promise<void> {
  const ts = now();
  await db
    .insert(schema.ownerGithub)
    .values({
      ownerEmail: args.ownerEmail.toLowerCase(),
      githubLogin: args.githubLogin.toLowerCase(),
      accessToken: args.accessToken,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: schema.ownerGithub.ownerEmail,
      set: {
        githubLogin: args.githubLogin.toLowerCase(),
        accessToken: args.accessToken,
        updatedAt: ts,
      },
    });
}

export async function getOwnerGithub(db: DB, ownerEmail: string) {
  return db.query.ownerGithub.findFirst({
    where: eq(schema.ownerGithub.ownerEmail, ownerEmail.toLowerCase()),
  });
}

export async function deleteOwnerGithub(db: DB, ownerEmail: string): Promise<void> {
  await db
    .delete(schema.ownerGithub)
    .where(eq(schema.ownerGithub.ownerEmail, ownerEmail.toLowerCase()));
}

export async function createGithubCliClaim(
  db: DB,
  args: {
    id: string;
    claimTokenHash: string;
    userCodeHash: string;
    ownerEmail: string;
    expiresAt: number;
  },
): Promise<void> {
  await db.insert(schema.githubCliClaims).values({
    id: args.id,
    claimTokenHash: args.claimTokenHash,
    userCodeHash: args.userCodeHash,
    ownerEmail: args.ownerEmail.toLowerCase(),
    status: "pending",
    createdAt: now(),
    expiresAt: args.expiresAt,
  });
}

export async function findGithubCliClaimByTokenHash(db: DB, claimTokenHash: string) {
  return db.query.githubCliClaims.findFirst({
    where: eq(schema.githubCliClaims.claimTokenHash, claimTokenHash),
  });
}

export async function findGithubCliClaimByCodeHash(db: DB, userCodeHash: string) {
  return db.query.githubCliClaims.findFirst({
    where: eq(schema.githubCliClaims.userCodeHash, userCodeHash),
  });
}

export async function completeGithubCliClaim(
  db: DB,
  id: string,
  githubLogin: string,
): Promise<void> {
  await db
    .update(schema.githubCliClaims)
    .set({ status: "completed", githubLogin: githubLogin.toLowerCase() })
    .where(eq(schema.githubCliClaims.id, id));
}

export { sql };


// --- GitHub org share roster (owner-synced member snapshot) -----------------

export async function replaceGithubShareRoster(
  db: DB,
  artifactId: string,
  members: Array<{ githubLogin: string; email?: string | null }>,
): Promise<void> {
  const ts = now();
  await db
    .delete(schema.githubShareRoster)
    .where(eq(schema.githubShareRoster.artifactId, artifactId));
  if (members.length === 0) return;
  // Chunk inserts for D1 limits
  const rows = members.map((m) => ({
    artifactId,
    githubLogin: m.githubLogin.toLowerCase(),
    email: m.email ? m.email.toLowerCase() : null,
    syncedAt: ts,
  }));
  for (let i = 0; i < rows.length; i += 40) {
    await db.insert(schema.githubShareRoster).values(rows.slice(i, i + 40));
  }
}

export async function isOnGithubShareRoster(
  db: DB,
  artifactId: string,
  args: { githubLogin?: string | null; email?: string | null },
): Promise<boolean> {
  if (args.githubLogin) {
    const row = await db.query.githubShareRoster.findFirst({
      where: and(
        eq(schema.githubShareRoster.artifactId, artifactId),
        eq(schema.githubShareRoster.githubLogin, args.githubLogin.toLowerCase()),
      ),
    });
    if (row) return true;
  }
  if (args.email) {
    const row = await db.query.githubShareRoster.findFirst({
      where: and(
        eq(schema.githubShareRoster.artifactId, artifactId),
        eq(schema.githubShareRoster.email, args.email.toLowerCase()),
      ),
    });
    if (row) return true;
  }
  return false;
}

export async function countGithubShareRoster(db: DB, artifactId: string): Promise<number> {
  const rows = await db.query.githubShareRoster.findMany({
    where: eq(schema.githubShareRoster.artifactId, artifactId),
  });
  return rows.length;
}
