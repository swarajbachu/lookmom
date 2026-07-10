---
name: lookmom
description: >
  Publish and share self-contained HTML artifacts with the lookmom CLI
  (preview, pack, publish, share, login, GitHub org share). Use when the user
  wants to put a page online behind auth, update an existing artifact URL,
  manage access, or install/run lookmom. For *how to design* diagrams,
  explainers, charts, and mockups, also load the companion skill lookmom-design.
---

# lookmom — CLI & publishing

**lookmom** publishes a self-contained HTML page to a private, access-controlled URL
(default `https://lookmom.stuff.md/a/<id>`). You (or an agent) write the page, then:

```bash
lookmom preview ./path   # local, exact production CSP
lookmom publish ./path   # → shareable URL
```

Companion skill **`lookmom-design`** covers visual craft (diagrams, mockups, explainers,
charts). This skill covers **auth, pack/preview/publish, share, and the CSP contract**.

## When to use this skill

- “Publish this as an artifact”
- “Share with the team / make public / GitHub org”
- “Update the artifact at this URL”
- “How do I install / login / list artifacts?”

If they only want a pretty page designed but not published yet, still follow the CSP
rules here so preview/publish will work; use **lookmom-design** for the craft.

## Hard rule: published HTML is fully self-contained

Artifacts run under a **strict CSP** — no network. Anything that loads from the internet
breaks.

| Allowed | Blocked |
| --- | --- |
| Inline / bundled CSS & JS | CDNs, Google Fonts, remote scripts |
| Local files bundled by CLI | `fetch` / XHR / WebSockets |
| `data:` images & fonts (≤ 512 KiB each) | External images/fonts |
| In-page `#anchors` | Multi-page site navigation |

**Size limit:** 16 MiB rendered.

### Multi-file projects (recommended)

```
my-artifact/
  index.html              # entry (required for directories)
  styles/*.css
  scripts/*.js
  partials/*.html         # <!-- lookmom:include partials/x.html -->
  fonts/*.ttf             # optional; inlined via CSS url()
```

```bash
lookmom preview ./my-artifact
lookmom pack ./my-artifact -o /tmp/out.html   # optional inspect
lookmom publish ./my-artifact --title "Title" --emoji 📊
```

Single file still works: `lookmom publish page.html`.

### What the bundler inlines

| Source | Becomes |
| --- | --- |
| `<link rel="stylesheet" href="local.css">` | `<style>` (+ nested `@import` / `url()`) |
| `<script src="local.js">` | inline `<script>` |
| `<!-- lookmom:include path.html -->` | spliced HTML |
| `<img src="local.png">` / CSS `url(local…)` | `data:` URI if small enough |

- Absolute `https://…` URLs are left alone and **fail CSP** — `preview` catches them.
- ES `type="module"` is **not** tree-shaken; use classic scripts or inline the body.

## CLI reference

Default API: **`https://lookmom.stuff.md`**. Override with `--api <url>` or `$LOOKMOM_API_URL`.

| Command | Purpose |
| --- | --- |
| `lookmom login` | Device auth (auth.md / WorkOS). Token in `~/.lookmom/` |
| `lookmom logout` | Revoke + forget token |
| `lookmom whoami` | Login + GitHub link status |
| `lookmom preview <file\|dir> [--port n]` | Local CSP sandbox + live reload |
| `lookmom pack <path> -o out.html` | Bundle to one file on disk |
| `lookmom publish <path> [opts]` | Create or update artifact |
| `lookmom list` | Your artifacts |
| `lookmom share <id\|url> [opts]` | Access control |
| `lookmom github login \| orgs \| teams --org X \| status \| logout` | Org share |

### publish options

```bash
lookmom publish ./dir \
  --title "Signup funnel" \
  --emoji 📊 \
  --update https://lookmom.stuff.md/a/<id> \  # same URL, new version
  --share private|allowlist|public|github_team \
  --github-org acme \
  --github-team eng
```

- First publish ever → CLI opens browser for user authorization; **tell the user to finish that**.
- New artifacts are **private** by default.
- Always print the final URL to the user.

### share

| Who | How |
| --- | --- |
| Specific emails | `lookmom share <id> --email a@b` (repeatable) |
| Anyone with link | `lookmom share <id> --mode public` |
| Only owner | `lookmom share <id> --mode private` |
| GitHub org/team | see below |

Prefer the **Share** button on the artifact chrome when the user is in a browser.

### GitHub organization share (CLI path)

No `gh` binary. Flow is CLI → WorkOS → GitHub.

```bash
lookmom login
lookmom whoami                 # may already show GitHub linked
lookmom github login           # only if not linked; show user the code/URL
lookmom github orgs
lookmom share <id> --github-org AcmeOrg
# optional:
lookmom share <id> --github-org AcmeOrg --github-team eng
```

**Agent rules**

1. If `whoami` already has GitHub → skip second connect.
2. If not, run `github login` and wait for the human.
3. Pick org from `github orgs` output.
4. Never invent a separate GitHub OAuth device flow.

Viewers of org-shared links sign in with GitHub in the browser. Email/public share do **not** need GitHub connect.

## Agent workflow (publish)

1. Build HTML (file or folder) that respects CSP — see **lookmom-design** for quality.
2. `lookmom preview ./path` when feasible; fix console/CSP issues.
3. `lookmom publish ./path --title "…" --emoji …`
4. Hand the user the URL.
5. Share only if they asked.
6. Edits to an existing URL → always `--update <url|id>`.

## Local / self-hosted

```bash
# local worker
lookmom … --api http://localhost:8787
# or
export LOOKMOM_API_URL=http://localhost:8787
```

CLI install / monorepo: see project README. Binary name is also `lm`.

## Minimal CSP checklist before publish

- [ ] `lookmom preview` loads with no missing assets
- [ ] No requests to third-party hosts
- [ ] Fonts/images are local or system stacks (or local `@font-face` files)
- [ ] Title + emoji set
- [ ] Using `--update` when revising an existing URL
