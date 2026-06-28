/** Small runtime helpers (IDs, hashing, codes) — all Web Crypto, Workers-native. */

/** URL-safe random id (default 16 bytes ~ 22 chars base64url). */
export function randomId(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

/** A long, opaque bearer secret (used for claim/user tokens before hashing). */
export function randomSecret(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

/** Human-friendly one-time code the owner reads back, e.g. "QK4F-7TZP". */
export function userCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[buf[i] % alphabet.length];
    if (i === 3) out += "-";
  }
  return out;
}

/** SHA-256 hex of a string — for storing bearer secrets at rest. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function base64url(buf: Uint8Array): string {
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}
