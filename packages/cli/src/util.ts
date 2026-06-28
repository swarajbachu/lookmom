/** Tiny CLI helpers: colors, browser open, sleep. */
import { spawn } from "node:child_process";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  bold: wrap("1"),
  dim: wrap("2"),
  green: wrap("32"),
  red: wrap("31"),
  yellow: wrap("33"),
  cyan: wrap("36"),
};

export function info(msg: string): void {
  console.log(msg);
}
export function ok(msg: string): void {
  console.log(`${c.green("✓")} ${msg}`);
}
export function warn(msg: string): void {
  console.error(`${c.yellow("!")} ${msg}`);
}
export function die(msg: string, code = 1): never {
  console.error(`${c.red("✗")} ${msg}`);
  process.exit(code);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Best-effort open a URL in the default browser (non-fatal if it fails). */
export function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" });
    child.unref();
  } catch {
    /* ignore */
  }
}
