#!/usr/bin/env bun
/** `lookmom` CLI — login, preview, publish, share, list. */
import { resolveApiBase, loadCredentials } from "./config";
import {
  deviceLogin,
  ensureAuth,
  apiPublish,
  apiShare,
  apiList,
  apiRevoke,
  parseArtifactRef,
  AuthExpired,
} from "./api";
import {
  githubLogin,
  githubLogout,
  githubOrgs,
  githubStatus,
  githubTeams,
} from "./github";
import { packToFile } from "./bundle";
import { startPreview } from "./preview";
import { c, info, ok, die, warn } from "./util";
import { relative } from "node:path";

type Flags = { _: string[] } & Record<string, string | string[] | boolean>;

function parse(argv: string[]): Flags {
  const f: Flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        f[key] = true;
      } else {
        // repeated flags accumulate into an array
        if (f[key] === undefined) f[key] = next;
        else if (Array.isArray(f[key])) (f[key] as string[]).push(next);
        else f[key] = [f[key] as string, next];
        i++;
      }
    } else if (a.startsWith("-") && a.length === 2) {
      // short flags: -o out.html
      const key = a.slice(1);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        f[key] = true;
      } else {
        f[key] = next;
        i++;
      }
    } else {
      f._.push(a);
    }
  }
  return f;
}

function asArray(v: string | string[] | boolean | undefined): string[] {
  if (v === undefined || typeof v === "boolean") return [];
  return Array.isArray(v) ? v : [v];
}
function asStr(v: string | string[] | boolean | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

const HELP = `${c.bold("lookmom")} — publish self-contained HTML artifacts behind auth

${c.bold("Usage")}
  lookmom login                       Authorize this device (auth.md / WorkOS)
  lookmom logout                      Revoke + forget the cached token
  lookmom whoami                      Show login status
  lookmom preview <path> [--port n]   Serve file OR project dir under production CSP
  lookmom pack <path> -o out.html     Bundle multi-file project → one HTML file
  lookmom publish <path> [opts]       Publish (or update) an artifact
  lookmom share <id|url> [opts]       Manage who can view an artifact
  lookmom list                        List your artifacts
  lookmom github login                Connect GitHub via WorkOS (for org share)
  lookmom github orgs                 List orgs you can share with
  lookmom github teams --org <org>    List teams in an org
  lookmom github status | logout

${c.bold("path")} can be a single .html file or a directory with index.html.
Multi-file projects are bundled automatically: local CSS, JS, images, and
<!-- lookmom:include partial.html --> are inlined for the strict CSP.

${c.bold("publish options")}
  --update <id|url>   Republish a new version to an existing artifact
  --title <text>      Title (tab name + gallery)
  --emoji <char>      Tab icon
  --share <mode>      private | allowlist | public | github_team   (default: private)
  --github-org <org>  GitHub org slug (required with --share github_team)
  --github-team <t>   Optional GitHub team slug within the org

${c.bold("pack options")}
  -o, --out <file>    Output path for the bundled HTML (required)

${c.bold("share options")}
  --email <addr>      Add an allowed viewer (repeatable)
  --mode <mode>       private | allowlist | public | github_team
  --github-org <org>  GitHub org (implies --mode github_team)
  --github-team <t>   Optional GitHub team slug

${c.bold("global")}
  --api <url>         Worker base URL (default: https://lookmom.stuff.md, or $LOOKMOM_API_URL)
`;

async function main() {
  const flags = parse(process.argv.slice(2));
  const cmd = flags._[0];
  const saved = await loadCredentials();
  const apiBase = resolveApiBase(asStr(flags.api), saved?.apiBase);

  switch (cmd) {
    case "login": {
      await deviceLogin(apiBase);
      break;
    }
    case "logout": {
      if (saved) await apiRevoke(saved);
      ok("Logged out.");
      break;
    }
    case "whoami": {
      if (saved?.accessToken) {
        info(`Logged in to ${c.cyan(saved.apiBase)}`);
        if (saved.expiresAt) info(c.dim(`token expires ${new Date(saved.expiresAt * 1000).toLocaleString()}`));
        // Live check: default WorkOS GitHub login already links the owner.
        try {
          await githubStatus(apiBase);
        } catch {
          if (saved.githubLogin) info(`GitHub: ${c.bold("@" + saved.githubLogin)}`);
          else info(c.dim("GitHub: not connected (lookmom github login)"));
        }
      } else {
        info("Not logged in. Run `lookmom login`.");
      }
      break;
    }
    case "github": {
      const sub = flags._[1];
      switch (sub) {
        case "login":
          await githubLogin(apiBase);
          break;
        case "logout":
          await githubLogout(apiBase);
          break;
        case "status":
          await githubStatus(apiBase);
          break;
        case "orgs":
          await githubOrgs(apiBase);
          break;
        case "teams": {
          const org = asStr(flags.org) ?? asStr(flags["github-org"]);
          if (!org) die("Usage: lookmom github teams --org <org>");
          await githubTeams(apiBase, org);
          break;
        }
        default:
          die(
            "Usage: lookmom github <login|logout|status|orgs|teams --org X>\nGitHub connect goes through WorkOS (not a separate GitHub OAuth app).",
          );
      }
      break;
    }
    case "preview": {
      const file = flags._[1];
      if (!file) die("Usage: lookmom preview <file|dir>");
      const port = Number(asStr(flags.port) ?? "4321");
      startPreview(file, port);
      // keep process alive
      await new Promise(() => {});
      break;
    }
    case "pack": {
      const input = flags._[1];
      const out = asStr(flags.out) ?? asStr(flags.o);
      if (!input || !out) die("Usage: lookmom pack <file|dir> -o <out.html>");
      const result = packToFile(input, out);
      for (const w of result.warnings) warn(w);
      ok(
        `Packed ${c.bold(relative(process.cwd(), result.entry) || result.entry)} → ${c.bold(out)}`,
      );
      info(
        c.dim(
          `  ${result.inlined.length} files · ${(result.bytes / 1024).toFixed(1)} KB`,
        ),
      );
      break;
    }
    case "publish": {
      const file = flags._[1];
      if (!file) {
        die("Usage: lookmom publish <file|dir> [--update <id|url>] [--title ..] [--share ..]");
      }
      const githubOrg = asStr(flags["github-org"]);
      const githubTeam = asStr(flags["github-team"]);
      let share = asStr(flags.share);
      if (!share && githubOrg) share = "github_team";
      if (share === "github_team" && !githubOrg) {
        die("github_team share requires --github-org <org>");
      }
      const opts = {
        file,
        id: flags.update ? parseArtifactRef(asStr(flags.update)!) : undefined,
        title: asStr(flags.title),
        emoji: asStr(flags.emoji),
        share,
        githubOrg,
        githubTeam,
      };
      let creds = await ensureAuth(apiBase);
      let res;
      try {
        res = await apiPublish(creds, opts);
      } catch (e) {
        if (e instanceof AuthExpired) {
          warn("Session expired — re-authorizing.");
          creds = await deviceLogin(apiBase);
          res = await apiPublish(creds, opts);
        } else throw e;
      }
      ok(`Published ${c.bold(res.url)} ${c.dim(`(v${res.version})`)}`);
      break;
    }
    case "share": {
      const ref = flags._[1];
      if (!ref) {
        die(
          "Usage: lookmom share <id|url> [--email a@b]... [--mode allowlist|github_team] [--github-org org] [--github-team team]",
        );
      }
      const id = parseArtifactRef(ref);
      const emails = asArray(flags.email);
      const githubOrg = asStr(flags["github-org"]);
      const githubTeam = asStr(flags["github-team"]);
      let mode = asStr(flags.mode);
      if (!mode && emails.length) mode = "allowlist";
      if (!mode && githubOrg) mode = "github_team";
      if (mode === "github_team" && !githubOrg) {
        die("github_team mode requires --github-org <org>");
      }
      if (!mode && !emails.length && !githubOrg) {
        die("Provide --mode, --email, and/or --github-org");
      }
      const creds = await ensureAuth(apiBase);
      const res = await apiShare(creds, id, {
        mode,
        emails,
        github_org: githubOrg,
        github_team: githubTeam,
      });
      ok(`Updated ${c.bold(res.url)} → ${c.cyan(res.share_mode)}`);
      if (res.github_org) {
        info(
          c.dim(
            `github: ${res.github_org}${res.github_team ? "/" + res.github_team : " (whole org)"}`,
          ),
        );
        info(c.dim("Viewers sign in with GitHub. Owners: lookmom github login → github orgs"));
      }
      if (emails.length) info(c.dim(`allowed: ${emails.join(", ")}`));
      break;
    }
    case "list": {
      const creds = await ensureAuth(apiBase);
      const items = await apiList(creds);
      if (items.length === 0) {
        info("No artifacts yet. Publish one with `lookmom publish <file>`.");
        break;
      }
      for (const a of items) {
        const gh =
          a.share_mode === "github_team" && a.github_org
            ? ` · ${a.github_org}${a.github_team ? "/" + a.github_team : ""}`
            : "";
        info(
          `${a.emoji}  ${c.bold(a.title)}  ${c.dim(a.share_mode + gh + " · v" + a.version)}`,
        );
        info(`    ${c.cyan(a.url)}`);
      }
      break;
    }
    case "help":
    case undefined:
      info(HELP);
      break;
    default:
      die(`Unknown command: ${cmd}\nRun \`lookmom help\`.`);
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
