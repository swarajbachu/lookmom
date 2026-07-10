/**
 * CLI GitHub via WorkOS (no separate GitHub OAuth app / no `gh` binary):
 *
 *   lookmom github login   → skip if already linked; else claim → WorkOS GitHub
 *   lookmom github orgs    → GET /api/github/orgs (token stays on server)
 *   lookmom github teams --org X
 *   lookmom github status | logout
 *
 * If the human's default WorkOS login is GitHub (return tokens enabled),
 * owner_github is already set after lookmom login / AuthKit — CLI detects that.
 */
import { type Credentials, loadCredentials, saveCredentials } from "./config";
import {
  ensureAuth,
  apiGithubConnectStart,
  apiGithubConnectPoll,
  apiGithubStatus,
  apiGithubOrgs,
  apiGithubTeams,
  apiGithubDisconnect,
  AuthExpired,
  deviceLogin,
} from "./api";
import { c, info, ok, openBrowser, sleep } from "./util";

async function refreshGithubLoginCache(creds: Credentials): Promise<Credentials> {
  const st = await apiGithubStatus(creds);
  const next = { ...creds };
  if (st.connected && st.login) {
    next.githubLogin = st.login;
  } else {
    delete next.githubLogin;
  }
  await saveCredentials(next);
  return next;
}

/** WorkOS-backed connect. No-ops if already linked (e.g. GitHub was default login). */
export async function githubLogin(apiBase: string): Promise<void> {
  let creds = await ensureAuth(apiBase);

  try {
    creds = await refreshGithubLoginCache(creds);
  } catch (e) {
    if (e instanceof AuthExpired) {
      creds = await deviceLogin(apiBase);
      creds = await refreshGithubLoginCache(creds);
    } else throw e;
  }

  if (creds.githubLogin) {
    ok(`GitHub already connected as ${c.bold("@" + creds.githubLogin)} (WorkOS)`);
    info(c.dim("Skip re-auth. Use `lookmom github orgs` to list organizations."));
    return;
  }

  let start;
  try {
    start = await apiGithubConnectStart(creds);
  } catch (e) {
    if (e instanceof AuthExpired) {
      creds = await deviceLogin(apiBase);
      start = await apiGithubConnectStart(creds);
    } else throw e;
  }

  info("");
  info(`  Connect GitHub through WorkOS (one-time):`);
  info(`  ${c.dim("1.")} Opening ${c.cyan(start.verification_uri)}`);
  info(`  ${c.dim("2.")} Sign in with GitHub when WorkOS asks`);
  info(`  ${c.dim("3.")} Code (if asked): ${c.bold(start.user_code)}`);
  info("");
  info(c.dim("  Agents: show the URL/code to the user; wait for this command to finish."));
  info("");
  openBrowser(start.verification_uri_complete);

  const deadline = Date.now() + (start.expires_in || 600) * 1000;
  let interval = Math.max(2, start.interval || 2) * 1000;

  while (Date.now() < deadline) {
    await sleep(interval);
    const poll = await apiGithubConnectPoll(creds, start.claim_token);
    if (poll.status === "ok" && poll.login) {
      const existing = (await loadCredentials()) ?? creds;
      await saveCredentials({
        ...existing,
        apiBase,
        accessToken: creds.accessToken,
        expiresAt: creds.expiresAt,
        githubLogin: poll.login,
      });
      ok(`GitHub connected as ${c.bold("@" + poll.login)} (via WorkOS)`);
      return;
    }
    if (poll.status === "expired") {
      throw new Error("Code expired. Run `lookmom github login` again.");
    }
  }
  throw new Error("Timed out waiting for WorkOS GitHub connect.");
}

export async function githubStatus(apiBase: string): Promise<void> {
  const creds = await ensureAuth(apiBase);
  const st = await apiGithubStatus(creds);
  if (st.connected && st.login) {
    const existing = (await loadCredentials()) ?? creds;
    await saveCredentials({ ...existing, githubLogin: st.login });
    info(`GitHub: ${c.bold("@" + st.login)} ${c.dim("(linked via WorkOS on server)")}`);
  } else {
    const existing = await loadCredentials();
    if (existing?.githubLogin) {
      const { githubLogin: _g, ...rest } = existing;
      await saveCredentials(rest);
    }
    info("GitHub: not connected. Run `lookmom github login` (or sign in with GitHub in WorkOS).");
  }
}

export async function githubLogout(apiBase: string): Promise<void> {
  const creds = await ensureAuth(apiBase);
  await apiGithubDisconnect(creds);
  const existing = await loadCredentials();
  if (existing) {
    const { githubLogin: _g, ...rest } = existing;
    await saveCredentials(rest);
  }
  ok("GitHub disconnected.");
}

export async function githubOrgs(apiBase: string): Promise<void> {
  const creds = await ensureAuth(apiBase);
  try {
    const { login, orgs } = await apiGithubOrgs(creds);
    const existing = (await loadCredentials()) ?? creds;
    await saveCredentials({ ...existing, githubLogin: login });
    info(`Connected as ${c.bold("@" + login)}`);
    if (orgs.length === 0) {
      info(c.dim("No organizations (or none visible with current scopes)."));
      return;
    }
    info("");
    for (const o of orgs) {
      info(`  ${c.cyan(o.login)}${o.description ? c.dim("  " + o.description) : ""}`);
    }
    info("");
    info(c.dim("Share: lookmom share <id> --github-org <login> [--github-team <slug>]"));
  } catch (e) {
    if (e instanceof Error && /github_not_connected|not connected/i.test(e.message)) {
      throw new Error(
        "GitHub not connected. If you use GitHub as your WorkOS login, re-login once with return tokens enabled; otherwise run `lookmom github login`.",
      );
    }
    throw e;
  }
}

export async function githubTeams(apiBase: string, org: string): Promise<void> {
  const creds = await ensureAuth(apiBase);
  const { teams } = await apiGithubTeams(creds, org);
  if (teams.length === 0) {
    info(c.dim(`No teams listed for ${org} (need org membership + permission to list teams).`));
    return;
  }
  info(`Teams in ${c.bold(org)}:`);
  for (const t of teams) {
    info(`  ${c.cyan(t.slug)}  ${t.name}${t.description ? c.dim("  " + t.description) : ""}`);
  }
}

export type { Credentials };
