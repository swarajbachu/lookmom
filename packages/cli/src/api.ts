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
      // If the human already used GitHub as their WorkOS login, server has a link.
      try {
        const stRes = await fetch(`${apiBase}/api/github/status`, {
          headers: { authorization: `Bearer ${data.access_token}` },
        });
        if (stRes.ok) {
          const st = (await stRes.json()) as { connected?: boolean; login?: string | null };
          if (st.connected && st.login) {
            creds.githubLogin = st.login;
          }
        }
      } catch {
        /* optional */
      }
      await saveCredentials(creds);
      ok("Logged in. Token cached in ~/.lookmom/credentials.json");
      if (creds.githubLogin) {
        ok(`GitHub already linked as ${c.bold("@" + creds.githubLogin)} (WorkOS)`);
      }
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
  opts: {
    file: string;
    id?: string;
    title?: string;
    emoji?: string;
    share?: string;
    githubOrg?: string;
    githubTeam?: string;
  },
): Promise<PublishResult> {
  const html = await readFile(opts.file);
  const qs = new URLSearchParams();
  if (opts.id) qs.set("id", opts.id);
  if (opts.title) qs.set("title", opts.title);
  if (opts.emoji) qs.set("emoji", opts.emoji);
  if (opts.share) qs.set("share", opts.share);
  if (opts.githubOrg) qs.set("github_org", opts.githubOrg);
  if (opts.githubTeam) qs.set("github_team", opts.githubTeam);

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
  body: {
    mode?: string;
    emails?: string[];
    github_org?: string;
    github_team?: string | null;
  },
): Promise<{
  id: string;
  share_mode: string;
  url: string;
  github_org?: string | null;
  github_team?: string | null;
}> {
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
  if (!res.ok) {
    const detail = data.message ? `: ${data.message}` : "";
    throw new Error(`Share failed (${res.status}): ${data.error ?? "unknown"}${detail}`);
  }
  return data as {
    id: string;
    share_mode: string;
    url: string;
    github_org?: string | null;
    github_team?: string | null;
  };
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

// --- GitHub via WorkOS (token stays on server) --------------------------------

export async function apiGithubConnectStart(creds: Credentials): Promise<{
  claim_token: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}> {
  const res = await fetch(`${creds.apiBase}/api/github/connect`, {
    method: "POST",
    headers: { authorization: `Bearer ${creds.accessToken}` },
  });
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    throw new Error(data.message || data.error || `GitHub connect failed (${res.status})`);
  }
  return data as any;
}

export async function apiGithubConnectPoll(
  creds: Credentials,
  claimToken: string,
): Promise<{ status: string; login?: string }> {
  const res = await fetch(`${creds.apiBase}/api/github/connect/poll`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${creds.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ claim_token: claimToken }),
  });
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  return (await res.json()) as { status: string; login?: string };
}

export async function apiGithubStatus(creds: Credentials): Promise<{
  connected: boolean;
  login: string | null;
}> {
  const res = await fetch(`${creds.apiBase}/api/github/status`, {
    headers: { authorization: `Bearer ${creds.accessToken}` },
  });
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  return (await res.json()) as { connected: boolean; login: string | null };
}

export async function apiGithubOrgs(creds: Credentials): Promise<{
  login: string;
  orgs: Array<{ login: string; description: string }>;
}> {
  const res = await fetch(`${creds.apiBase}/api/github/orgs`, {
    headers: { authorization: `Bearer ${creds.accessToken}` },
  });
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    throw new Error(data.message || data.error || `List orgs failed (${res.status})`);
  }
  return data as any;
}

export async function apiGithubTeams(
  creds: Credentials,
  org: string,
): Promise<{ org: string; teams: Array<{ slug: string; name: string; description: string }> }> {
  const res = await fetch(
    `${creds.apiBase}/api/github/orgs/${encodeURIComponent(org)}/teams`,
    { headers: { authorization: `Bearer ${creds.accessToken}` } },
  );
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    throw new Error(data.message || data.error || `List teams failed (${res.status})`);
  }
  return data as any;
}

export async function apiGithubDisconnect(creds: Credentials): Promise<void> {
  const res = await fetch(`${creds.apiBase}/api/github/connect`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${creds.accessToken}` },
  });
  if (res.status === 401) {
    await clearCredentials();
    throw new AuthExpired();
  }
  if (!res.ok) throw new Error(`Disconnect failed (${res.status})`);
}
