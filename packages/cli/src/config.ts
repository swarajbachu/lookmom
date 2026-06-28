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
}

/** Resolve the API base: --api flag > env > saved creds > localhost default. */
export function resolveApiBase(flag?: string, saved?: string): string {
  return (
    flag ||
    process.env.LOOKMOM_API_URL ||
    saved ||
    "http://localhost:8787"
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
  await writeFile(FILE, JSON.stringify(creds, null, 2), "utf8");
  await chmod(FILE, 0o600);
}

export async function clearCredentials(): Promise<void> {
  await rm(FILE, { force: true });
}

export function isExpired(creds: Credentials): boolean {
  if (!creds.expiresAt) return false;
  return creds.expiresAt < Math.floor(Date.now() / 1000) + 30;
}
