/**
 * Layer 1 rate limiting via Workers' built-in limiter binding.
 * Bindings are optional: if absent (e.g. a context where they aren't bound),
 * we fail OPEN for availability but log — the binding is declared in
 * wrangler.toml so it's present in dev and prod.
 */
import type { RateLimiter } from "./types";

/** Client IP from Cloudflare's header (falls back to a constant in dev). */
export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "local";
}

/**
 * Returns true if the request is ALLOWED. When the limiter is undefined we
 * allow (dev). Keys should be stable + specific (e.g. `view:<ip>`).
 */
export async function allow(limiter: RateLimiter | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch {
    // Never let a limiter outage take down the route.
    return true;
  }
}

/** Throws a 429-shaped error when over budget; used inside handlers. */
export class RateLimited extends Error {
  constructor(public retryAfter = 60) {
    super("rate_limited");
  }
}

export async function enforce(
  limiter: RateLimiter | undefined,
  key: string,
  retryAfter = 60,
): Promise<void> {
  if (!(await allow(limiter, key))) throw new RateLimited(retryAfter);
}
