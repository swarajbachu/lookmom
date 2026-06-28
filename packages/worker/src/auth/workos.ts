/**
 * Viewer login via WorkOS AuthKit. We use WorkOS only for the human login
 * event: redirect to its hosted UI (Google + magic link, configured in the
 * WorkOS dashboard), exchange the code for the user's verified email, then
 * mint our OWN session cookie (see tokens.ts). No per-request WorkOS calls.
 *
 * Implemented with plain fetch so it runs natively on the Workers runtime.
 */
import type { Env } from "../types";

const WORKOS_API = "https://api.workos.com";

export function isWorkosConfigured(env: Env): boolean {
  return !!env.WORKOS_CLIENT_ID && !!env.WORKOS_API_KEY;
}

/** Build the AuthKit hosted-login URL. `state` round-trips through the IdP. */
export function authorizationUrl(env: Env, state: string): string {
  const u = new URL(`${WORKOS_API}/user_management/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", env.WORKOS_CLIENT_ID);
  u.searchParams.set("redirect_uri", env.WORKOS_REDIRECT_URI);
  u.searchParams.set("provider", "authkit");
  u.searchParams.set("state", state);
  return u.toString();
}

export interface WorkosUser {
  email: string;
  name?: string;
}

/** Exchange an authorization code for the authenticated user. */
export async function exchangeCode(env: Env, code: string): Promise<WorkosUser> {
  const res = await fetch(`${WORKOS_API}/user_management/authenticate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.WORKOS_CLIENT_ID,
      client_secret: env.WORKOS_API_KEY,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WorkOS authenticate failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    user: { email: string; first_name?: string; last_name?: string };
  };
  const name = [data.user.first_name, data.user.last_name].filter(Boolean).join(" ");
  return { email: data.user.email.toLowerCase(), name: name || undefined };
}
