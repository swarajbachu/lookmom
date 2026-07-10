/** Credential + config storage at ~/.lookmom/credentials.json (mode 600). */
import { homedir } from "node:os";
import { join } from "node:path";
import { chmod, mkdir, readFile, writeFile, rm } from "node:fs/promises";

const DIR = join(homedir(), ".lookmom");
const FILE = join(DIR, "credentials.json");

export interface Credentials {
  apiBase: string;
  accessToken: string;
  ownerEmail?: string;
  expiresAt?: number; // unix seconds
  /** Set after `lookmom github login` (WorkOS) — login only; token stays on server. */
  githubLogin?: string;
}

/** Production instance — default so agents/users don't need LOOKMOM_API_URL. */
export const DEFAULT_API_BASE = "https://lookmom.stuff.md";

/** Resolve the API base: --api flag > env > saved creds > production default. */
export function resolveApiBase(flag?: string, saved?: string): string {
  return (
    flag ||
    process.env.LOOKMOM_API_URL ||
    saved ||
    DEFAULT_API_BASE
  ).replace(/\/$/, "");
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await readFile(FILE, "utf8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await mkdir(DIR, { recursive: true });
  // Strip any accidental githubToken from older drafts
  const { githubToken: _drop, ...safe } = creds as Credentials & { githubToken?: string };
  await writeFile(FILE, JSON.stringify(safe, null, 2), "utf8");
  await chmod(FILE, 0o600);
}

export async function clearCredentials(): Promise<void> {
  await rm(FILE, { force: true });
}

export function isExpired(creds: Credentials): boolean {
  if (!creds.expiresAt) return false;
  return creds.expiresAt < Math.floor(Date.now() / 1000) + 30;
}
