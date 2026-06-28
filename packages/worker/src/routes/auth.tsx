/**
 * Human login routes. In prod this bounces through WorkOS AuthKit (hosted,
 * bot-hardened — our Layer 3). When WorkOS isn't configured (local dev), a
 * dev-only email form stands in so the gate is testable without keys.
 */
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env, Vars } from "../types";
import { authorizationUrl, exchangeCode, isWorkosConfigured } from "../auth/workos";
import { startSession, endSession } from "../auth/session";
import { enforce, RateLimited, clientIp } from "../ratelimit";
import { randomId } from "../util";
import { Layout } from "../chrome";

const OAUTH_COOKIE = "lookmom_oauth";

/** Only allow same-site relative redirect targets. */
function safeReturnTo(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/gallery";
}

export const authRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

authRoutes.get("/auth/login", async (c) => {
  try {
    await enforce(c.env.RL_AUTH, `login:${clientIp(c.req.raw)}`);
  } catch (e) {
    if (e instanceof RateLimited) return c.text("Too many requests", 429);
    throw e;
  }
  const returnTo = safeReturnTo(c.req.query("return_to"));

  if (!isWorkosConfigured(c.env)) {
    // Dev fallback: simple email form.
    return c.html(
      <Layout title="Dev sign in">
        <div class="wrap">
          <div class="card">
            <h1>Dev sign in</h1>
            <p>WorkOS isn’t configured. Enter any email to simulate a session.</p>
            <form method="post" action="/auth/dev-login">
              <input type="hidden" name="return_to" value={returnTo} />
              <input
                class="code"
                style="text-transform:none;letter-spacing:0;text-align:left"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
              <div class="row" style="margin-top:16px">
                <button class="btn" type="submit">
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      </Layout>,
    );
  }

  const state = randomId();
  setCookie(c, OAUTH_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });
  return c.redirect(authorizationUrl(c.env, state));
});

authRoutes.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const raw = getCookie(c, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, { path: "/" });

  if (!code || !raw) return c.text("Invalid login state", 400);
  let parsed: { state: string; returnTo: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return c.text("Invalid login state", 400);
  }
  if (parsed.state !== state) return c.text("State mismatch", 400);

  const user = await exchangeCode(c.env, code);
  await startSession(c, user.email, user.name);
  return c.redirect(safeReturnTo(parsed.returnTo));
});

authRoutes.post("/auth/dev-login", async (c) => {
  if (isWorkosConfigured(c.env)) return c.text("Not found", 404);
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const returnTo = safeReturnTo(String(body.return_to ?? "/gallery"));
  if (!email || !email.includes("@")) return c.text("Bad email", 400);
  await startSession(c, email);
  return c.redirect(returnTo);
});

authRoutes.get("/auth/logout", (c) => {
  endSession(c);
  return c.redirect("/");
});
