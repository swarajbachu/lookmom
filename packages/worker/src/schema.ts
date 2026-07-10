/** Drizzle schema for D1. Metadata + access control only; blobs live in R2. */
import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";
import type { InferSelectModel } from "drizzle-orm";

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    title: text("title").notNull().default("Untitled artifact"),
    emoji: text("emoji").notNull().default("📄"),
    currentVersion: integer("current_version").notNull().default(0),
    shareMode: text("share_mode", {
      enum: ["private", "allowlist", "public", "github_team"],
    })
      .notNull()
      .default("private"),
    /** GitHub org slug when shareMode is github_team. */
    githubOrg: text("github_org"),
    /** Optional team slug within the org; null/empty = any org member. */
    githubTeam: text("github_team"),
    /** When set, artifact lives in this org library. */
    orgSlug: text("org_slug"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("idx_artifacts_owner").on(t.ownerEmail),
    index("idx_artifacts_org").on(t.orgSlug),
  ],
);

export const versions = sqliteTable(
  "versions",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id").notNull(),
    versionNo: integer("version_no").notNull(),
    r2Key: text("r2_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_versions_artifact").on(t.artifactId, t.versionNo)],
);

export const githubShareRoster = sqliteTable(
  "github_share_roster",
  {
    artifactId: text("artifact_id").notNull(),
    githubLogin: text("github_login").notNull(),
    /** Public or known email when available; may be null. */
    email: text("email"),
    syncedAt: integer("synced_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.artifactId, t.githubLogin] }),
    index("idx_github_share_roster_artifact").on(t.artifactId),
    index("idx_github_share_roster_email").on(t.artifactId, t.email),
  ],
);

export const allowlist = sqliteTable(
  "allowlist",
  {
    artifactId: text("artifact_id").notNull(),
    email: text("email").notNull(),
    addedAt: integer("added_at").notNull(),
  },
  (t) => [index("idx_allowlist_artifact").on(t.artifactId)],
);

/** Short-lived cache of GitHub org/team membership checks. */
export const githubMembershipCache = sqliteTable(
  "github_membership_cache",
  {
    githubLogin: text("github_login").notNull(),
    org: text("org").notNull(),
    /** Empty string means org-level membership (any member of the org). */
    team: text("team").notNull().default(""),
    isMember: integer("is_member").notNull(),
    checkedAt: integer("checked_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.githubLogin, t.org, t.team] })],
);

export const agentTokens = sqliteTable(
  "agent_tokens",
  {
    jti: text("jti").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    scopes: text("scopes").notNull(),
    issuedAt: integer("issued_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revoked: integer("revoked").notNull().default(0),
  },
  (t) => [index("idx_agent_tokens_owner").on(t.ownerEmail)],
);

export const claimAttempts = sqliteTable(
  "claim_attempts",
  {
    id: text("id").primaryKey(),
    claimTokenHash: text("claim_token_hash").notNull(),
    userCodeHash: text("user_code_hash").notNull(),
    ownerEmail: text("owner_email"),
    scopes: text("scopes").notNull(),
    status: text("status", { enum: ["pending", "confirmed", "consumed", "expired"] })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("idx_claim_token").on(t.claimTokenHash)],
);


/** Org linked into lookmom by a linker (read:org token). */
export const githubOrgLinks = sqliteTable(
  "github_org_links",
  {
    orgSlug: text("org_slug").primaryKey(),
    linkedByEmail: text("linked_by_email").notNull(),
    githubLogin: text("github_login").notNull(),
    accessToken: text("access_token").notNull(),
    lastSyncedAt: integer("last_synced_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_github_org_links_linker").on(t.linkedByEmail)],
);

/** Org-level member roster (synced by linker). */
export const githubOrgMembers = sqliteTable(
  "github_org_members",
  {
    orgSlug: text("org_slug").notNull(),
    githubLogin: text("github_login").notNull(),
    email: text("email"),
    syncedAt: integer("synced_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgSlug, t.githubLogin] }),
    index("idx_github_org_members_org").on(t.orgSlug),
    index("idx_github_org_members_email").on(t.orgSlug, t.email),
  ],
);

/**
 * Owner's GitHub link from WorkOS GitHubOAuth (CLI or web connect).
 * access_token is used server-side for org/team listing + membership.
 */
export const ownerGithub = sqliteTable("owner_github", {
  ownerEmail: text("owner_email").primaryKey(),
  githubLogin: text("github_login").notNull(),
  accessToken: text("access_token").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** CLI `lookmom github login` claim — same pattern as auth.md device login. */
export const githubCliClaims = sqliteTable(
  "github_cli_claims",
  {
    id: text("id").primaryKey(),
    claimTokenHash: text("claim_token_hash").notNull(),
    userCodeHash: text("user_code_hash").notNull(),
    ownerEmail: text("owner_email").notNull(),
    status: text("status", { enum: ["pending", "completed", "expired"] })
      .notNull()
      .default("pending"),
    githubLogin: text("github_login"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [
    index("idx_gh_cli_claim_token").on(t.claimTokenHash),
    index("idx_gh_cli_claim_code").on(t.userCodeHash),
  ],
);

export type Artifact = InferSelectModel<typeof artifacts>;
export type Version = InferSelectModel<typeof versions>;
export type ShareMode = Artifact["shareMode"];
export type OwnerGithub = InferSelectModel<typeof ownerGithub>;
export type GithubShareRosterEntry = InferSelectModel<typeof githubShareRoster>;
export type GithubOrgLink = InferSelectModel<typeof githubOrgLinks>;
export type GithubOrgMember = InferSelectModel<typeof githubOrgMembers>;

