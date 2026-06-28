/** Viewer-session cookie helpers + Hono middleware. */
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import type { Env, Vars } from "../types";
import { signViewerSession, verifyViewerSession } from "../tokens";

export const SESSION_COOKIE = "oha_session";

type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

export async function startSession(c: Ctx, email: string, name?: string): Promise<void> {
  const token = await signViewerSession(c.env.JWT_SIGNING_SECRET, { email, name });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function endSession(c: Ctx): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
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
    if (claims) c.set("viewer", { email: claims.email, name: claims.name });
  }
  await next();
};
