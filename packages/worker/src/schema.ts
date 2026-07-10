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
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("idx_artifacts_owner").on(t.ownerEmail)],
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

export type Artifact = InferSelectModel<typeof artifacts>;
export type Version = InferSelectModel<typeof versions>;
export type ShareMode = Artifact["shareMode"];
