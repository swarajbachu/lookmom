---
name: lookmom
description: Write a self-contained HTML artifact and publish it to a private, access-controlled URL using the lookmom CLI. Use whenever the user asks to make, build, or publish an artifact, dashboard, chart, diagram, mockup, PR walkthrough, comparison, or any visual page they want to look at or share — anything that is easier to see than to read as terminal text.
---

# lookmom — publish HTML artifacts

An **artifact** is a single self-contained HTML page published to a private URL
(`https://<host>/a/<id>`) that the user can share with specific people. You build the
page, then publish it with the `lookmom` CLI. This is the right tool when the output is
easier to *look at* than to read as text: dashboards, annotated diffs, charts, side-by-side
options, interactive tuners, status pages.

## When to use

Reach for an artifact when the user says things like "make an artifact", "build me a
dashboard / chart / mockup", "show this as a page", "walk me through this PR visually", or
asks to compare options side by side. Prefer it over dumping a large table or ASCII art in
the terminal.

## The one hard rule: the page must be fully self-contained

Artifacts are served under a **strict Content-Security-Policy** that blocks *all* external
requests. A page that loads anything from the network will render broken. So:

- **Inline everything.** All CSS in a `<style>` tag, all JS in inline `<script>` tags.
- **No external resources.** No `<link>`/`<script src>`/`@import`/Google Fonts/CDNs. No
  `fetch`, `XMLHttpRequest`, or WebSockets — `connect-src 'none'` blocks them.
- **Images/fonts must be embedded** as `data:` URIs. Prefer **inline SVG** or pure CSS over
  raster images — they're sharper and far cheaper in tokens.
- **One page.** No relative links to other files; use in-page `#anchors` for sections.
- **Size limit: 16 MiB** rendered. Big embedded raster images are the usual cause of bloat;
  summarize large datasets instead of inlining them in full.
- Use system font stacks (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`).

If you respect the rule above, `lookmom preview` will look identical to the published page.

## Design quality

Make it look deliberate, not default. If the project has a design system (check
`CLAUDE.md` or a theme file for colors/fonts/spacing), use it. Otherwise pick a clean,
restrained palette, good type scale, generous spacing, and support dark mode via
`color-scheme` / `prefers-color-scheme`. Interactive controls (sliders, toggles, tabs) are
encouraged where they help — they run fine inline.

## Workflow

1. **Write** the HTML to a file in the working directory, e.g. `artifact.html`, following
   the self-contained rule above.

2. **Preview** it locally (optional but recommended) — serves under the exact production CSP
   so you catch any external-resource breakage before publishing:
   ```bash
   lookmom preview artifact.html
   ```

3. **Publish** it:
   ```bash
   lookmom publish artifact.html --title "Signup funnel" --emoji 📊
   ```
   - On the **first publish ever**, the CLI prints a code and opens the browser for the user
     to authorize (one time). Tell the user to complete that sign-in; then publishing is
     silent.
   - It prints the URL, e.g. `https://<host>/a/pIewXqNLkEVCVMFCgEo37g`. **Give that URL to
     the user.**
   - New artifacts are **private** by default (only the owner can view).

4. **Share** (only if the user wants others to see it):
   ```bash
   lookmom share <id|url> --email teammate@example.com     # adds to allowlist
   lookmom share <id|url> --mode public                    # anyone with the link
   ```

## Updating an existing artifact

To revise a page the user already published, edit the file and republish to the **same URL**
with `--update`:
```bash
lookmom publish artifact.html --update https://<host>/a/<id>
```
Each publish becomes a new version at the same URL. If the user gives you an artifact URL and
asks to change it, always use `--update <url>` — otherwise you'll create a brand-new artifact.

## Useful commands

```bash
lookmom list                 # the user's artifacts + URLs
lookmom whoami               # login status
lookmom login                # (re)authorize this device
```

## Prerequisites

The `lookmom` CLI must be installed and pointed at a lookmom instance. If the command isn't
found, the user needs to set it up — see the project README. The instance URL defaults to
`http://localhost:8787`; a deployed instance is set via `--api <url>` or `$LOOKMOM_API_URL`.
