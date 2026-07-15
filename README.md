# lookmom

> *"Look mom, I built a website."*

**lookmom** is a **Claude Artifacts alternative** — free, open source, and built for **every agent** (Claude, Cursor, Codex, or a plain terminal), not locked to one chat product or a Team/Enterprise plan.

Publish a self-contained HTML page to a **private, access-controlled URL**. Share with specific people, anyone with the link, or your **GitHub org / team** without buying enterprise seats. Self-host on Cloudflare’s free tier, or use the public instance at [lookmom.stuff.md](https://lookmom.stuff.md).

```
You: "make me a dashboard of last week's signups as an artifact"
Agent: writes dashboard.html → lookmom publish dashboard.html
        → https://lookmom.stuff.md/a/pIewXqNLkEVCVMFCgEo37g
You: lookmom share <id> --github-org acme
```

### Why lookmom

| | Claude Artifacts (Team/Enterprise) | lookmom |
| --- | --- | --- |
| Who can publish | Inside Claude, paid plans | Any agent + CLI |
| Org / team share | Enterprise-shaped plans | GitHub org/team, free |
| Open source | No | Yes (MIT) |
| Self-host | No | Yes, Cloudflare free tier |

---

## Table of contents

- [What it is](#what-it-is)
- [How it works](#how-it-works)
- [Quick start (local)](#quick-start-local)
- [Using the CLI](#using-the-cli)
- [The skill (install for your agent)](#the-skill)
- [**Security model**](#security-model) ← *the part that makes this trustworthy*
- [Tech stack & cost](#tech-stack--cost)
- [Deploying to production](#deploying-to-production)
- [Project structure](#project-structure)

---

## What it is

A lookmom **artifact** is a self-contained HTML page — all CSS, JavaScript, and images inlined, no external requests — published to a URL like `https://lookmom.stuff.md/a/<id>`. It's a *capture of work*, not a hosted app: no backend, no database at view-time, one page.

You can author **one file** or a **multi-file project** (`index.html` + CSS/JS/partials). The CLI bundles local assets automatically so agents can keep code clean while the published page stays CSP-safe — the same *shape* as Claude Artifacts, without the plan wall.

Three things make it useful:

1. **Every agent can publish.** Paste a prompt, install the skill (`npx skills add thegesturs/lookmom`), or use the CLI (`npm install -g lookmom`). Not Claude-only.
2. **Real access control, easy team share.** Every artifact is `private`, `allowlist` (emails), `github_team` (current GitHub org/team members), or `public`. Org sharing does **not** require an enterprise plan.
3. **Free & open source.** MIT license. Cloudflare Workers + D1 + R2 + WorkOS free tiers; a personal instance costs **$0**.

---

## How it works

```
  Claude (skill) ── writes ──▶ file.html  OR  project/ (index.html + css/js)
        │                              │
        │                              └─ auto-bundle local assets
        │
        ├─ lookmom preview <path> ─▶ localhost (same CSP as prod, live-reload)
        ├─ lookmom pack <path> -o out.html ─▶ inspect the bundled document
        │
        └─ lookmom publish <path> ──(agent token)──▶  ┌──────────────────────┐
                                                       │   Cloudflare Worker  │
                                                       │  ┌────────────────┐  │
                               bundled HTML bytes ─────┼─▶│      R2        │  │
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

# run the Worker (local D1 + R2).
# wrangler.toml has production hosts; override for local in .dev.vars:
#   APP_HOST / ARTIFACT_SANDBOX_HOST / WORKOS_REDIRECT_URI = http://localhost:8787
bunx wrangler dev --port 8787 --local
```

Out of the box (no WorkOS keys) the login page is a **dev form** that accepts any email — enough to test the whole gate. To use real WorkOS login, drop your keys into `packages/worker/.dev.vars`:

```
APP_HOST="http://localhost:8787"
ARTIFACT_SANDBOX_HOST="http://localhost:8787"
WORKOS_REDIRECT_URI="http://localhost:8787/auth/callback"
WORKOS_CLIENT_ID="client_..."
WORKOS_API_KEY="sk_test_..."
JWT_SIGNING_SECRET="dev-secret"
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
| `lookmom preview <path>` | Serve a **file or project dir** under the **exact production CSP** + live-reload. Multi-file projects re-bundle on save. |
| `lookmom pack <path> -o out.html` | Bundle multi-file HTML/CSS/JS/partials into one self-contained HTML file. |
| `lookmom publish <path>` | Publish (or `--update <id\|url>`) an artifact. Accepts a file or directory with `index.html`. `--title --emoji --share`. |
| `lookmom share <id\|url>` | Manage access: `--email a@b`, `--mode private\|allowlist\|public\|github_team`, `--github-org`, `--github-team`. |
| `lookmom list` | List your artifacts. |
| `lookmom logout` | Revoke the token and forget it. |

### Multi-file projects

```
my-dashboard/
  index.html
  styles/tokens.css
  styles/layout.css
  scripts/data.js
  scripts/app.js
  partials/header.html   # optional: <!-- lookmom:include partials/header.html -->
```

```bash
lookmom preview ./my-dashboard
lookmom publish ./my-dashboard --title "Signup funnel" --emoji 📊
```

The bundler inlines local stylesheets, scripts, images (`data:` URIs), CSS `@import`/`url()`, and `<!-- lookmom:include … -->` partials. External CDNs still fail under CSP — which is intentional.

Examples:

- `examples/hello-artifact.html` — tiny single-file page
- `examples/dashboard/` — multi-file KPIs + bar/donut/funnel charts
- `examples/diagram/` — architecture / decision-flow / sequence diagrams (SVG arrows, swimlanes)
- `examples/db-concepts/` — interactive explainer (tables, keys, indexes, ACID, joins)

See the agent skills below for design craft and CLI publishing.

Defaults to production (`https://lookmom.stuff.md`). Override with `--api <url>` or `$LOOKMOM_API_URL` (e.g. `http://localhost:8787` for local).

---

## Agent skills (downloadable)

Two complementary skills ship in this repo so agents can install what they need:

| Skill | Path | Use it for |
| --- | --- | --- |
| **lookmom** | [`skills/lookmom/SKILL.md`](skills/lookmom/SKILL.md) | CLI: login, preview, pack, publish, share, GitHub org access, CSP contract |
| **lookmom-design** | [`skills/lookmom-design/SKILL.md`](skills/lookmom-design/SKILL.md) | Craft: diagrams, concept explainers, mockups, charts, multi-file layout, sketch style |

Install with [`skills`](https://github.com/vercel-labs/skills) (Claude Code, Cursor, Codex, and 60+ agents):

```bash
# both skills from this repo
npx skills add thegesturs/lookmom

# or copy a single skill directory into your agent's skills folder:
#   skills/lookmom/
#   skills/lookmom-design/
```

Typical pairing:

> *"Explain database indexes visually and publish it as an artifact"*

- **lookmom-design** → multi-file explainer + diagrams (like `examples/db-concepts/`)
- **lookmom** → `lookmom preview` / `lookmom publish` / share

> The **lookmom** skill drives the CLI — install and authorize it first (`lookmom login`).

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
base-uri 'none'; form-action 'none'; frame-ancestors <gate-origin>;
sandbox allow-scripts allow-popups allow-downloads
```

- `connect-src 'none'` **blocks `fetch`, `XMLHttpRequest`, and WebSockets** — an artifact cannot phone home, exfiltrate data, or load a tracker.
- `default-src 'none'` + `img-src data:` mean **no external scripts, styles, fonts, or images** load at all. Everything must be inlined, so the page can't be a vector for third-party content.
- `frame-ancestors` allows **only the lookmom gate** to embed the page (so random sites can’t iframe your artifact). Local preview uses `frame-ancestors 'self'`.
- The `sandbox` directive gives the page an **opaque origin** on top of the iframe's own `sandbox` attribute — defense in depth.

`lookmom preview` serves your file under this *exact* CSP locally, so anything that would break in production breaks on your machine first.

### 3. Content is only reachable through a short-lived signed grant

You can't just hit the sandbox host directly. `/raw/<id>` refuses to serve anything without a valid **grant** — a JWT that:

- is **signed with the server's secret key** (unforgeable without it),
- is **issued only by the gate, and only after the access check passes**,
- **expires in ~30 seconds**, and
- is **bound to one specific artifact + version**.

So a direct visit to the sandbox with no grant → `403`. A leaked grant URL is useless after 30s and only ever exposed content the holder was already allowed to see. Artifact IDs are 128-bit random on top, so enumeration is hopeless.

### 4. Access control: private / allowlist / github_team / public

Every artifact has an owner and a share mode, enforced at the gate on every request. Owners use the **Share** button on the artifact chrome (or the CLI):

- **private** — only the owner.
- **allowlist** — specific emails (checked against the signed-in email).
- **github_team** — members of a GitHub organization (or a team within it).
- **public** — anyone with the link.

**Connect GitHub** (`/connect/github`) is a separate page used **only for org share**. Owners connect once (WorkOS GitHub OAuth with return tokens + `read:org`). Viewers of org-shared links sign in with GitHub; membership is checked live via the GitHub API and cached briefly (~15 minutes). Email and public share do not require Connect GitHub.

```bash
# Share with everyone in the acme org (after Connect GitHub in the UI):
lookmom share <id> --mode github_team --github-org acme

# Or only the eng team:
lookmom share <id> --github-org acme --github-team eng
```

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
| Identity | **WorkOS** (AuthKit + GitHub OAuth for org share) | 1M monthly active users |
| Monorepo / runtime | **Turborepo + Bun** | — |
| Chrome UI | server-rendered **Hono JSX** (no FE framework) | — |

A personal instance comfortably stays at **$0**.

---

## Deploying to production

1. Create the resources: `wrangler d1 create lookmom-db`, `wrangler r2 bucket create lookmom-blobs`, and put their IDs in `wrangler.toml`.
2. Set secrets: `wrangler secret put WORKOS_API_KEY`, `wrangler secret put JWT_SIGNING_SECRET`.
3. **(Optional, for GitHub org share)** In the WorkOS dashboard, enable **GitHub OAuth**, use your own GitHub OAuth App credentials, turn on **Return GitHub OAuth tokens**, and add scopes `read:user`, `user:email`, `read:org`. GitHub’s callback URL must be the WorkOS redirect URI from the dashboard (not lookmom’s).  
   Fallback (no WorkOS GitHub): set a [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) callback to `https://lookmom.stuff.md/auth/github/callback`, then:
   ```
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   ```
4. Set the two hosts as vars/routes — the app host and a **sibling** sandbox host:
   ```
   APP_HOST = "https://lookmom.stuff.md"
   ARTIFACT_SANDBOX_HOST = "https://lookmomcontent.stuff.md"
   WORKOS_REDIRECT_URI = "https://lookmom.stuff.md/auth/callback"
   ```
5. Register both custom domains on the Worker, add the lookmom redirect URI in WorkOS, and `bun run deploy`.

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
skills/
  lookmom/          CLI + publish/share skill
  lookmom-design/   diagrams / explainers / mockups skill
examples/
  hello-artifact.html
  dashboard/        multi-file charts
  diagram/          architecture + sequence SVG
  db-concepts/      sketch-style interactive explainer
```


---

*lookmom is not affiliated with Anthropic. "Artifacts" describes the published-page concept.*
