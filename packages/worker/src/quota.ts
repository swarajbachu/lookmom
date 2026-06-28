/** Layer 2 per-owner quotas — stop one user from blowing up storage/cost. */
import { eq, sql } from "drizzle-orm";
import type { DB } from "./db";
import * as schema from "./schema";

export const LIMITS = {
  /** Max distinct artifacts a single owner may create. */
  maxArtifactsPerOwner: 200,
  /** Max total stored bytes across all of an owner's versions. */
  maxTotalBytesPerOwner: 500 * 1024 * 1024, // 500 MiB
  /** Max versions retained per artifact (older ones can be pruned later). */
  maxVersionsPerArtifact: 100,
};

export interface OwnerUsage {
  artifactCount: number;
  totalBytes: number;
}

export async function getOwnerUsage(db: DB, ownerEmail: string): Promise<OwnerUsage> {
  const owner = ownerEmail.toLowerCase();
  const artRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.artifacts)
    .where(eq(schema.artifacts.ownerEmail, owner));
  const byteRow = await db
    .select({ b: sql<number>`coalesce(sum(${schema.versions.sizeBytes}), 0)` })
    .from(schema.versions)
    .innerJoin(schema.artifacts, eq(schema.versions.artifactId, schema.artifacts.id))
    .where(eq(schema.artifacts.ownerEmail, owner));
  return {
    artifactCount: Number(artRow[0]?.c ?? 0),
    totalBytes: Number(byteRow[0]?.b ?? 0),
  };
}

export class QuotaExceeded extends Error {
  constructor(public reason: string) {
    super(`quota_exceeded: ${reason}`);
  }
}

/**
 * Check before accepting an upload. `isNewArtifact` toggles the artifact-count
 * check; `incomingBytes` is the size of the new version being published.
 */
export async function assertPublishAllowed(
  db: DB,
  ownerEmail: string,
  incomingBytes: number,
  isNewArtifact: boolean,
): Promise<void> {
  const usage = await getOwnerUsage(db, ownerEmail);
  if (isNewArtifact && usage.artifactCount >= LIMITS.maxArtifactsPerOwner) {
    throw new QuotaExceeded("too many artifacts");
  }
  if (usage.totalBytes + incomingBytes > LIMITS.maxTotalBytesPerOwner) {
    throw new QuotaExceeded("storage limit reached");
  }
}
