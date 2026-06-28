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
import { startPreview } from "./preview";
import { c, info, ok, die, warn } from "./util";

type Flags = { _: string[] } & Record<string, string | string[] | boolean>;

function parse(argv: string[]): Flags {
  const f: Flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        f[key] = true;
      } else {
        // repeated flags accumulate into an array
        if (f[key] === undefined) f[key] = next;
        else if (Array.isArray(f[key])) (f[key] as string[]).push(next);
        else f[key] = [f[key] as string, next];
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
  lookmom login                       Authorize this device (auth.md flow)
  lookmom logout                      Revoke + forget the cached token
  lookmom whoami                      Show login status
  lookmom preview <file> [--port n]   Serve <file> locally under production CSP
  lookmom publish <file> [opts]       Publish (or update) an artifact
  lookmom share <id|url> [opts]       Manage who can view an artifact
  lookmom list                        List your artifacts

${c.bold("publish options")}
  --update <id|url>   Republish a new version to an existing artifact
  --title <text>      Title (tab name + gallery)
  --emoji <char>      Tab icon
  --share <mode>      private | allowlist | public   (default: private)

${c.bold("share options")}
  --email <addr>      Add an allowed viewer (repeatable)
  --mode <mode>       private | allowlist | public

${c.bold("global")}
  --api <url>         Worker base URL (default: $LOOKMOM_API_URL or http://localhost:8787)
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
      } else {
        info("Not logged in. Run `lookmom login`.");
      }
      break;
    }
    case "preview": {
      const file = flags._[1];
      if (!file) die("Usage: lookmom preview <file>");
      const port = Number(asStr(flags.port) ?? "4321");
      startPreview(file, port);
      // keep process alive
      await new Promise(() => {});
      break;
    }
    case "publish": {
      const file = flags._[1];
      if (!file) die("Usage: lookmom publish <file> [--update <id|url>] [--title ..] [--share ..]");
      const opts = {
        file,
        id: flags.update ? parseArtifactRef(asStr(flags.update)!) : undefined,
        title: asStr(flags.title),
        emoji: asStr(flags.emoji),
        share: asStr(flags.share),
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
      if (!ref) die("Usage: lookmom share <id|url> [--email a@b]... [--mode allowlist]");
      const id = parseArtifactRef(ref);
      const emails = asArray(flags.email);
      const mode = asStr(flags.mode) ?? (emails.length ? "allowlist" : undefined);
      const creds = await ensureAuth(apiBase);
      const res = await apiShare(creds, id, { mode, emails });
      ok(`Updated ${c.bold(res.url)} → ${c.cyan(res.share_mode)}`);
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
        info(`${a.emoji}  ${c.bold(a.title)}  ${c.dim(a.share_mode + " · v" + a.version)}`);
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
