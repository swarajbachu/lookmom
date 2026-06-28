/**
 * All JWTs (viewer session cookies + agent publisher tokens) are signed with a
 * single HS256 secret via `jose`. This keeps the Worker fully edge-native:
 * WorkOS is used only for the human login event, after which we mint our own
 * session — no per-request calls back to WorkOS, no Node-only SDK paths.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomId } from "./util";

const ISSUER = "open-html-artifacts";
const VIEWER_AUD = "viewer";
const AGENT_AUD = "agent";

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export interface ViewerClaims {
  email: string;
  name?: string;
}

/** Mint a viewer session JWT (goes in an HttpOnly cookie). */
export async function signViewerSession(
  secret: string,
  claims: ViewerClaims,
  ttlSeconds = 7 * 24 * 60 * 60,
): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(VIEWER_AUD)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key(secret));
}

export async function verifyViewerSession(
  secret: string,
  token: string,
): Promise<ViewerClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: VIEWER_AUD,
    });
    if (typeof payload.email !== "string") return null;
    return { email: payload.email, name: payload.name as string | undefined };
  } catch {
    return null;
  }
}

export interface AgentClaims extends JWTPayload {
  ownerEmail: string;
  scopes: string[];
  jti: string;
}

/** Mint an agent publisher token. Includes a jti so it can be revoked in D1. */
export async function signAgentToken(
  secret: string,
  ownerEmail: string,
  scopes: string[],
  ttlSeconds = 30 * 24 * 60 * 60,
): Promise<{ token: string; jti: string; expiresAt: number }> {
  const jti = randomId(18);
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await new SignJWT({ ownerEmail, scopes })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AGENT_AUD)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key(secret));
  return { token, jti, expiresAt };
}

export async function verifyAgentToken(
  secret: string,
  token: string,
): Promise<AgentClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AGENT_AUD,
    });
    if (typeof payload.ownerEmail !== "string" || typeof payload.jti !== "string") {
      return null;
    }
    return {
      ...payload,
      ownerEmail: payload.ownerEmail as string,
      scopes: (payload.scopes as string[]) ?? [],
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}
