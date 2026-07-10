/** Viewer-session cookie helpers + Hono middleware. */
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import type { Env, Vars } from "../types";
import { signViewerSession, verifyViewerSession, type ViewerClaims } from "../tokens";

export const SESSION_COOKIE = "lookmom_session";
/** Short-lived GitHub OAuth access token for membership checks only. */
export const GH_TOKEN_COOKIE = "lookmom_gh_token";

type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

export async function startSession(
  c: Ctx,
  email: string,
  name?: string,
  githubLogin?: string,
): Promise<void> {
  const claims: ViewerClaims = { email, name, githubLogin };
  const token = await signViewerSession(c.env.JWT_SIGNING_SECRET, claims);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

/** Merge claims into an existing session (re-sign cookie). */
export async function updateSession(
  c: Ctx,
  claims: ViewerClaims,
): Promise<void> {
  // Explicitly drop empty githubLogin so disconnect clears the claim.
  const cleaned: ViewerClaims = {
    email: claims.email,
    name: claims.name,
    ...(claims.githubLogin ? { githubLogin: claims.githubLogin } : {}),
  };
  const token = await signViewerSession(c.env.JWT_SIGNING_SECRET, cleaned);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function setGithubTokenCookie(c: Ctx, accessToken: string, maxAge = 3600): void {
  setCookie(c, GH_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge,
  });
}

export function getGithubTokenCookie(c: Ctx): string | undefined {
  return getCookie(c, GH_TOKEN_COOKIE);
}

export function clearGithubTokenCookie(c: Ctx): void {
  deleteCookie(c, GH_TOKEN_COOKIE, { path: "/" });
}

export function endSession(c: Ctx): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  deleteCookie(c, GH_TOKEN_COOKIE, { path: "/" });
}

/**
 * Populates c.var.viewer when a valid session cookie is present. Never blocks —
 * route handlers decide whether a viewer is required.
 */
export const viewerSession: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (
  c,
  next,
) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const claims = await verifyViewerSession(c.env.JWT_SIGNING_SECRET, token);
    if (claims) {
      c.set("viewer", {
        email: claims.email,
        name: claims.name,
        githubLogin: claims.githubLogin,
      });
    }
  }
  await next();
};
