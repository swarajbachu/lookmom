# lookmom

> *"Look mom, I built a website."*

**lookmom** is a free, self-hostable clone of Claude's **Artifacts** feature — the one that's locked to Team/Enterprise plans. It lets an AI agent (or you) publish a self-contained HTML page to a **private, access-controlled URL** that you can share with exactly the people you choose.

You ask Claude for a dashboard, a PR walkthrough, a chart, an interactive mockup — it writes the HTML, and `lookmom publish` puts it online behind real authentication in one step. Runs entirely on Cloudflare's free tier.

```
You: "make me a dashboard of last week's signups as an artifact"
Claude: writes dashboard.html → lookmom publish dashboard.html
        → https://lookmom.stuff.md/a/pIewXqNLkEVCVMFCgEo37g
You: lookmom share <id> --email teammate@acme.com
```

---

## Table of contents

- [What it is](#what-it-is)
- [How it works](#how-it-works)
- [Quick start (local)](#quick-start-local)
- [Using the CLI](#using-the-cli)
- [**Security model**](#security-model) ← *the part that makes this trustworthy*
- [Tech stack & cost](#tech-stack--cost)
- [Deploying to production](#deploying-to-production)
- [Project structure](#project-structure)

---

## What it is

A lookmom **artifact** is a single, self-contained HTML page — all CSS, JavaScript, and images inlined, no external requests — published to a URL like `https://lookmom.stuff.md/a/<id>`. It's a *capture of work*, not a hosted app: no backend, no database at view-time, one page.

Three things make it useful:

1. **Agents publish directly.** A CLI (`lookmom`) plus a skill let Claude write a page and publish it without you copy-pasting anything.
2. **Real access control.** Every artifact is `private` (only you), `allowlist` (only the emails you name), or `public`. Viewers sign in with Google or a magic link.
3. **It's free.** Cloudflare Workers + D1 + R2 + WorkOS all have generous free tiers; a personal instance costs **$0**.

---

## How it works

```
  Claude (skill) ── writes ──▶ self-contained HTML file
        │
        ├─ lookmom preview file.html ─▶ localhost (same CSP as prod, live-reload)
        │
        └─ lookmom publish file.html ──(agent token)──▶  ┌──────────────────────┐
                                                          │   Cloudflare Worker  │
                                                          │  ┌────────────────┐  │
                                  HTML bytes ─────────────┼─▶│      R2        │  │
                                  metadata + allowlist ───┼─▶│      D1        │  │
                                                          │  └────────────────┘  │
                                                          └──────────────────────┘

  A viewer opens  https://lookmom.stuff.md/a/<id>   (the "gate")
        │
        ├─ public?        → serve it
        ├─ no session?    → WorkOS hosted login (Google / magic link) → back to the gate
        └─ signed in?     → email allowed?  →  YES → render
                                            →  NO  → "you don't have access"

  When allowed, the gate issues a short-lived signed grant and loads the artifact
  from a SEPARATE cookieless host:
        https://lookmomcontent.stuff.md/raw/<id>?grant=<token>   (the "sandbox")
```

The gate (app host) holds your login cookie and runs every access check. The artifact's own code runs on a **different, cookieless host** so it can never touch your session — more on that below.

---

## Quick start (local)

Requires [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install

# one-time: create the local D1 tables
cd packages/worker
bunx wrangler d1 migrations apply lookmom-db --local

# run the Worker (local D1 + R2)
bunx wrangler dev --port 8787 --local
```

Out of the box (no WorkOS keys) the login page is a **dev form** that accepts any email — enough to test the whole gate. To use real WorkOS login, drop your keys into `packages/worker/.dev.vars`:

```
WORKOS_CLIENT_ID="client_..."
WORKOS_API_KEY="sk_test_..."
```

…then register `http://localhost:8787/auth/callback` as a redirect URI in the WorkOS dashboard and restart. The Worker switches to WorkOS automatically once both keys are present.

---

## Using the CLI

```bash
# from the repo, run via Bun:
bun run packages/cli/src/cli.ts <command>
# or build a binary:  cd packages/cli && bun run build   → ./dist/lookmom
```

| Command | What it does |
| --- | --- |
| `lookmom login` | Authorize this device (auth.md OTP flow). Token cached in `~/.lookmom/`. |
| `lookmom preview <file>` | Serve a file locally under the **exact production CSP** + live-reload. |
| `lookmom publish <file>` | Publish (or `--update <id\|url>`) an artifact. `--title --emoji --share`. |
| `lookmom share <id\|url>` | Manage access: `--email a@b` (repeatable), `--mode private\|allowlist\|public`. |
| `lookmom list` | List your artifacts. |
| `lookmom logout` | Revoke the token and forget it. |

`--api <url>` (or `$LOOKMOM_API_URL`) points the CLI at any instance; defaults to `http://localhost:8787`.

---

## Security model

This is the part that matters: you're publishing pages full of **code an AI wrote** (and, on a shared instance, code *other people* wrote) to URLs tied to *your* identity. lookmom is built so that even a deliberately malicious artifact cannot harm you or other users. Here's every layer, and the reasoning.

### 1. Artifacts run on a separate, cookieless origin (the sandbox)

The single most important rule: **artifact code never runs on the same domain as your login.**

- The **gate** (`lookmom.stuff.md`) holds your session cookie and runs the access checks. It renders only a thin header + an `<iframe>`.
- The **artifact's actual HTML** is served from a **different host** (`lookmomcontent.stuff.md`) that has **no cookies and no login** — the sandbox.

Why this matters: browsers automatically attach your cookies to same-origin requests and let same-origin scripts read `document.cookie`. If an artifact ran on the gate's domain, its JavaScript could read your session or call the API *as you*. By serving it from a cookieless sibling domain, the browser's **same-origin policy** makes that impossible — the artifact runs in an empty room with nothing to steal. This is the same split Claude uses (`claude.ai` vs `claudeusercontent.com`) and that Google, CodePen, and CodeSandbox all use.

> The two hosts are **siblings under `stuff.md`**, not parent/child, so they share no cookie scope whatsoever.

### 2. Strict Content-Security-Policy — no external requests, ever

Every artifact is served under a strict CSP:

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src data: blob:; font-src data:; connect-src 'none';
base-uri 'none'; form-action 'none'; frame-ancestors 'none';
sandbox allow-scripts allow-popups allow-downloads
```

- `connect-src 'none'` **blocks `fetch`, `XMLHttpRequest`, and WebSockets** — an artifact cannot phone home, exfiltrate data, or load a tracker.
- `default-src 'none'` + `img-src data:` mean **no external scripts, styles, fonts, or images** load at all. Everything must be inlined, so the page can't be a vector for third-party content.
- The `sandbox` directive gives the page an **opaque origin** on top of the iframe's own `sandbox` attribute — defense in depth.

`lookmom preview` serves your file under this *exact* CSP locally, so anything that would break in production breaks on your machine first.

### 3. Content is only reachable through a short-lived signed grant

You can't just hit the sandbox host directly. `/raw/<id>` refuses to serve anything without a valid **grant** — a JWT that:

- is **signed with the server's secret key** (unforgeable without it),
- is **issued only by the gate, and only after the access check passes**,
- **expires in ~30 seconds**, and
- is **bound to one specific artifact + version**.

So a direct visit to the sandbox with no grant → `403`. A leaked grant URL is useless after 30s and only ever exposed content the holder was already allowed to see. Artifact IDs are 128-bit random on top, so enumeration is hopeless.

### 4. Access control: private / allowlist / public

Every artifact has an owner and a share mode, enforced at the gate on every request:

- **private** — only the owner.
- **allowlist** — the owner plus the exact emails in the artifact's allowlist (checked against the signed-in email).
- **public** — anyone, but still routed through the gate (one consistent code path).

Viewer identity comes from **WorkOS-verified login** (Google or magic link), so "this email is allowed" means a real, verified email.

### 5. Publisher authentication: the auth.md OTP flow

Agents don't get a long-lived password. To publish, an agent runs the [auth.md](https://workos.com/auth-md) **user-claimed** flow:

1. The agent registers and gets a one-time `user_code`.
2. **You** approve it on a page that sits *behind WorkOS login* — which both proves you're human and binds the agent's token to *your verified email*.
3. The agent receives a **scoped, expiring, revocable** token (`artifact:publish` only).

Tokens are JWTs carrying a `jti`; revoking one (`lookmom logout`, or per-token) flips a flag in D1 that's checked on every publish — so access can be killed instantly. Tokens from the OTP flow **carry no refresh token** and simply expire.

### 6. Secrets are never stored in the clear

The OTP bearer secrets (`claim_token`, `user_code`) are stored **only as SHA-256 hashes** — a database leak reveals no usable codes. Session cookies and agent tokens are signed (HS256) with a server secret and are `HttpOnly`, `Secure`, `SameSite=Lax`. The OAuth flow uses a signed `state` parameter (CSRF protection) and only ever redirects to same-site paths (no open redirects).

### 7. Abuse protection: rate limits + quotas

- **Layer 1 — rate limiting.** Cloudflare's built-in Workers rate limiter guards every sensitive route, keyed appropriately: viewer hits by IP, publishing by owner, OTP attempts by claim + IP. Brute-forcing codes or hammering the gate is throttled at the edge.
- **Layer 2 — quotas.** Per-owner caps on artifact count and total stored bytes, plus a hard 16 MiB per-page limit checked *before* the body is read — so no one can blow up your storage or bill.
- **Layer 3 — WorkOS AuthKit.** All human login runs through WorkOS's hardened hosted page (bot detection, brute-force throttling), so we never hand-roll a login form or CAPTCHA.

### 8. What lookmom deliberately does *not* do

Being honest about the boundaries:

- Artifacts are **static** — no server-side execution, no database access at view time. There's no code path for an artifact to query your data.
- lookmom **never** sees or stores your WorkOS secret key in the repo (`.dev.vars` is gitignored; production uses Cloudflare secrets).
- An artifact you mark **public** is public — the CSP still sandboxes it, but anyone with the link can view it. Sharing is your decision.

---

## Tech stack & cost

| Concern | Choice | Free tier |
| --- | --- | --- |
| Compute / API | Cloudflare **Workers** (Hono) | 100k req/day |
| Database | **D1** via Drizzle (metadata + allowlist) | 5M reads / 100k writes per day |
| Blob storage | **R2** (the HTML, no egress fees) | 10 GB |
| Identity | **WorkOS AuthKit** (Google + magic link) | 1M monthly active users |
| Monorepo / runtime | **Turborepo + Bun** | — |
| Chrome UI | server-rendered **Hono JSX** (no FE framework) | — |

A personal instance comfortably stays at **$0**.

---

## Deploying to production

1. Create the resources: `wrangler d1 create lookmom-db`, `wrangler r2 bucket create lookmom-blobs`, and put their IDs in `wrangler.toml`.
2. Set secrets: `wrangler secret put WORKOS_API_KEY`, `wrangler secret put JWT_SIGNING_SECRET`.
3. Set the two hosts as vars/routes — the app host and a **sibling** sandbox host:
   ```
   APP_HOST = "https://lookmom.stuff.md"
   ARTIFACT_SANDBOX_HOST = "https://lookmomcontent.stuff.md"
   WORKOS_REDIRECT_URI = "https://lookmom.stuff.md/auth/callback"
   ```
4. Register both custom domains on the Worker, add the redirect URI in WorkOS, and `bun run deploy`.

> The sandbox host **must** be a separate site from the app host (see [Security §1](#1-artifacts-run-on-a-separate-cookieless-origin-the-sandbox)). Do not serve artifacts from a subdomain of the app host.

---

## Project structure

```
packages/
  worker/        Cloudflare Worker — API, viewer gate, auth.md flow, CSP serving
    src/
      index.ts          route wiring
      routes/           view (gate + sandbox), publish, share, auth
      auth/             WorkOS login, session cookies, agent (auth.md) flow
      schema.ts db.ts   Drizzle schema + queries (D1)
      csp.ts grants.ts  the CSP + signed content grants
      tokens.ts         JWT signing (sessions + agent tokens)
      ratelimit.ts quota.ts   Layer 1 + Layer 2 abuse protection
  cli/           the `lookmom` CLI (login, preview, publish, share, list)
examples/        a sample artifact
```

---

*lookmom is not affiliated with Anthropic. "Artifacts" describes the published-page concept.*
