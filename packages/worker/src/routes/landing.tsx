/** Public marketing home + agent SKILL.md. */
import { Hono } from "hono";
import type { Env, Vars } from "../types";
import { Landing } from "../chrome";

export const landingRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

landingRoutes.get("/", (c) => {
  const viewer = c.get("viewer");
  return c.html(<Landing email={viewer?.email} host={c.env.APP_HOST} />);
});

/** Agent-readable skill entry (clerk.com/SKILL.md style). */
landingRoutes.get("/SKILL.md", (c) => {
  const host = c.env.APP_HOST;
  const md = `---
name: lookmom
description: >
  Claude Artifacts alternative: publish private HTML for any agent, free and open source,
  with GitHub org/team share (no enterprise plan). Install skill or CLI, then publish/share.
---

# lookmom — Claude Artifacts for every agent

Free, open-source alternative to Claude Artifacts. Works with **any agent** (Claude, Cursor, Codex, …) plus a CLI. Share with a GitHub org or team **without** Team/Enterprise. Self-host or use \`${host}\`.

Default artifact URL: \`${host}/a/<id>\`.

## Install

### Skill

\`\`\`bash
npx skills add swarajbachu/lookmom
\`\`\`

### npm (CLI)

\`\`\`bash
npm install -g lookmom
\`\`\`

Then: \`lookmom login\` · \`lookmom publish ./page.html --title "Demo"\`

### Prompt (paste to an agent)

\`\`\`
Publish this as a lookmom artifact.

1. Read ${host}/SKILL.md
2. Install the CLI if needed, then lookmom login + lookmom publish
3. Share with my GitHub org if I ask — no enterprise plan required
\`\`\`

Full skills in the repo:
- https://github.com/swarajbachu/lookmom/blob/main/skills/lookmom/SKILL.md
- Design: https://github.com/swarajbachu/lookmom/blob/main/skills/lookmom-design/SKILL.md

## Quick publish

\`\`\`bash
lookmom preview ./my-artifact
lookmom publish ./my-artifact --title "Title" --emoji 📊
lookmom share <id> --mode public
lookmom share <id> --github-org AcmeOrg
\`\`\`

Multi-file folders need \`index.html\`; CLI packs CSS/JS/images for a strict CSP (no external network in artifacts).

## Share modes

| Who | How |
| --- | --- |
| Only owner | default / \`--mode private\` |
| Specific emails | \`lookmom share <id> --email a@b\` |
| Anyone with link | \`lookmom share <id> --mode public\` |
| GitHub org/team | \`lookmom share <id> --github-org ORG [--github-team TEAM]\` |

Default API: \`${host}\`. Override with \`--api <url>\` or \`$LOOKMOM_API_URL\`.

Site: ${host} · Source: https://github.com/swarajbachu/lookmom (MIT)
`;
  return c.text(md, 200, {
    "content-type": "text/markdown; charset=utf-8",
    "cache-control": "public, max-age=300",
  });
});
