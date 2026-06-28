/** Talks to the Worker: auth.md device login + publish/share/list/revoke. */
import { readFile } from "node:fs/promises";
import {
  type Credentials,
  loadCredentials,
  saveCredentials,
  clearCredentials,
  isExpired,
} from "./config";
import { c, info, ok, openBrowser, sleep } from "./util";

const SCOPE = "artifact:publish";

interface ClaimResponse {
  claim_token: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

/** Run the auth.md user-claimed (OTP/device) flow and return fresh creds. */
export async function deviceLogin(apiBase: string): Promise<Credentials> {
  const claimRes = await fetch(`${apiBase}/agent/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scopes: [SCOPE] }),
  });
  if (!claimRes.ok) throw new Error(`Could not start login (${claimRes.status}). Is the server running at ${apiBase}?`);
  const claim = (await claimRes.json()) as ClaimResponse;

  info("");
  info(`  Authorize this device to publish artifacts:`);
  info(`  ${c.dim("1.")} Opening ${c.cyan(claim.verification_uri)}`);
  info(`  ${c.dim("2.")} Sign in, then enter this code:`);
  info("");
  info(`       ${c.bold(claim.user_code)}`);
  info("");
  openBrowser(claim.verification_uri_complete);

  const deadline = Date.now() + claim.expires_in * 1000;
  let interval = Math.max(2, claim.interval) * 1000;

  while (Date.now() < deadline) {
    await sleep(interval);
    const tokRes = await fetch(`${apiBase}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        claim_token: claim.claim_token,
      }),
    });
    const data = (await tokRes.json().catch(() => ({}))) as Record<string, any>;
    if (tokRes.ok && data.access_token) {
      const creds: Credentials = {
        apiBase,
        accessToken: data.access_token,
        expiresAt: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined,
      };
      await saveCredentials(creds);
      ok("Logged in. Token cached in ~/.lookmom/credentials.json");
      return creds;
    }
    if (data.error === "authorization_pending") continue;
    if (data.error === "slow_down") {
      interval += 2000;
      continue;
    }
    throw new Error(`Login failed: ${data.error ?? tokRes.status}`);
  }
  throw new Error("Login timed out. Run `lookmom login` again.");
}

/** Return valid creds for apiBase, logging in if needed. */
export async function ensureAuth(apiBase: string, interactive = true): Promise<Credentials> {
  const existing = await loadCredentials();
  if (existing && existing.apiBase === apiBase && existing.accessToken && !isExpired(existing)) {
    return existing;
  }
  if (!interactive) throw new Error("Not logged in. Run `lookmom login` first.");
  return deviceLogin(apiBase);
}

export interface PublishResult {
  id: string;
  url: string;
  version: number;
}

export async function apiPublish(
  creds: Credentials,
  opts: { file: string; id?: string; title?: string; emoji?: string; share?: string },
): Promise<PublishResult> {
  const html = await readFile(opts.file);
  const qs = new URLSearchParams();
  if (opts.id) qs.set("id", opts.id);
  if (opts.title) qs.set("title", opts.title);
  if (opts.emoji) qs.set("emoji", opts.emoji);
  if (opts.share) qs.set("share", opts.share);

  const res = await fetch(`${creds.apiBase}/api/publish?${qs.toString()}`, {
    method: "POST",
    headers: { authorization: `Bearer ${creds.accessToken}`, "content-type": "text/html" },
    body: html,
  });
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) throw new Error(`Publish failed (${res.status}): ${data.error ?? "unknown"}`);
  return data as PublishResult;
}

export async function apiShare(
  creds: Credentials,
  id: string,
  body: { mode?: string; emails?: string[] },
): Promise<{ id: string; share_mode: string; url: string }> {
  const res = await fetch(`${creds.apiBase}/api/artifacts/${id}/share`, {
    method: "POST",
    headers: { authorization: `Bearer ${creds.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) throw new Error(`Share failed (${res.status}): ${data.error ?? "unknown"}`);
  return data as { id: string; share_mode: string; url: string };
}

export async function apiList(creds: Credentials): Promise<any[]> {
  const res = await fetch(`${creds.apiBase}/api/artifacts`, {
    headers: { authorization: `Bearer ${creds.accessToken}` },
  });
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  const data = (await res.json()) as { artifacts: any[] };
  return data.artifacts ?? [];
}

export async function apiRevoke(creds: Credentials): Promise<void> {
  await fetch(`${creds.apiBase}/oauth2/revoke`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: creds.accessToken }),
  }).catch(() => {});
  await clearCredentials();
}

/** Thrown when a cached token is rejected; callers re-login and retry. */
export class AuthExpired extends Error {
  constructor() {
    super("auth_expired");
  }
}

/** Accept a bare id or a full /a/:id URL. */
export function parseArtifactRef(ref: string): string {
  const m = ref.match(/\/a\/([^/?#]+)/);
  return m ? m[1] : ref;
}
