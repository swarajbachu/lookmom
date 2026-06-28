/**
 * Short-lived signed grants that let the cookie-bearing gate (app host) hand a
 * viewer off to the cookieless sandbox host to fetch raw artifact bytes.
 *
 * The gate issues a grant ONLY after the allowlist check passes; the sandbox
 * verifies it statelessly. Grants are bound to a specific artifact + version
 * and expire in ~30s, so they can't be replayed or used to fetch other
 * artifacts. Because the sandbox origin has no cookies, artifact JS can run
 * without any path to the session.
 */
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "open-html-artifacts";
const GRANT_AUD = "content-grant";

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signGrant(
  secret: string,
  artifactId: string,
  versionNo: number,
  ttlSeconds = 30,
): Promise<string> {
  return new SignJWT({ v: versionNo })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(GRANT_AUD)
    .setSubject(artifactId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key(secret));
}

export async function verifyGrant(
  secret: string,
  token: string,
): Promise<{ artifactId: string; versionNo: number } | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: GRANT_AUD,
    });
    if (typeof payload.sub !== "string" || typeof payload.v !== "number") return null;
    return { artifactId: payload.sub, versionNo: payload.v };
  } catch {
    return null;
  }
}
