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
  Publish self-contained HTML to a private, shareable URL with the lookmom CLI.
  Use when the user wants an artifact online, team/org share, or to install lookmom.
---

# lookmom

Publish a self-contained HTML page to a private URL (default \`${host}/a/<id>\`).

You do **not** need to sign into the website first. Install a skill or the CLI, then publish.

## Install (pick one)

### Skill (recommended for agents)

\`\`\`bash
npx skills add swarajbachu/lookmom
# both skills (CLI + design craft):
npx skills add swarajbachu/lookmom --skill '*' -y
\`\`\`

### CLI

\`\`\`bash
npm install -g lookmom
# or: bun add -g lookmom
lookmom login
lookmom publish ./page.html --title "Demo"
\`\`\`

### This file

Tell the user/agent: read \`${host}/SKILL.md\` (or the full skills in the repo).

Full skill docs:
- https://github.com/swarajbachu/lookmom/blob/main/skills/lookmom/SKILL.md
- Design craft: https://github.com/swarajbachu/lookmom/blob/main/skills/lookmom-design/SKILL.md

## Quick publish

\`\`\`bash
lookmom preview ./my-artifact   # local CSP sandbox
lookmom publish ./my-artifact --title "Title" --emoji 📊
lookmom share <id> --mode public
lookmom share <id> --github-org AcmeOrg
\`\`\`

Multi-file folders need \`index.html\`; the CLI packs CSS/JS/images for a strict CSP (no external network in artifacts).

## Share modes

| Who | How |
| --- | --- |
| Only owner | default / \`--mode private\` |
| Specific emails | \`lookmom share <id> --email a@b\` |
| Anyone with link | \`lookmom share <id> --mode public\` |
| GitHub org/team | \`lookmom share <id> --github-org ORG [--github-team TEAM]\` |

Default API: \`${host}\`. Override with \`--api <url>\` or \`$LOOKMOM_API_URL\`.

Site: ${host} · Repo: https://github.com/swarajbachu/lookmom
`;
  return c.text(md, 200, {
    "content-type": "text/markdown; charset=utf-8",
    "cache-control": "public, max-age=300",
  });
});
