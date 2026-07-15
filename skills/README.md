# lookmom agent skills

Installable skills for coding agents ([skills](https://github.com/vercel-labs/skills) / Claude Code / Cursor / Codex / etc.).

## Skills

### `lookmom` — use the CLI

**Path:** [`lookmom/SKILL.md`](lookmom/SKILL.md)

Publish and share artifacts: `login`, `preview`, `pack`, `publish`, `share`, GitHub org access, CSP rules.

### `lookmom-design` — make the pages

**Path:** [`lookmom-design/SKILL.md`](lookmom-design/SKILL.md)

Design craft for CSP-safe HTML: concept explainers, architecture/sequence diagrams, mockups, charts, multi-file structure, sketch aesthetics.

## Install ([skills.sh](https://skills.sh) / `npx skills`)

Layout matches the multi-skill repo convention (`skills/<name>/SKILL.md`), same as
`vercel-labs/agent-skills`. The CLI discovers **both** skills and prompts which to install:

```bash
# Interactive: lists lookmom + lookmom-design, then prompts for which + which agents
npx skills add thegesturs/lookmom

# List only
npx skills add thegesturs/lookmom --list

# Install both, non-interactive
npx skills add thegesturs/lookmom --skill '*' -y

# One skill only
npx skills add thegesturs/lookmom --skill lookmom-design -y
npx skills add thegesturs/lookmom --skill lookmom -y
```

### Manual install

Copy either directory into your agent’s skills folder, e.g.:

```bash
cp -R skills/lookmom ~/.agents/skills/lookmom
cp -R skills/lookmom-design ~/.agents/skills/lookmom-design
```

(Exact path depends on your agent — Claude Code often uses `~/.claude/skills/`.)

## Recommended pairing

| Ask | Skills |
| --- | --- |
| “Publish this HTML” | `lookmom` |
| “Draw how auth works” | `lookmom-design` (+ `lookmom` to publish) |
| “Explain indexes and put it online” | both |
| “Mock the settings page” | `lookmom-design` |

## Examples in this repo

Agents should open these when available:

- `examples/dashboard/` — charts + KPIs  
- `examples/diagram/` — arrows, swimlanes, sequence  
- `examples/db-concepts/` — playful explainer + handwriting fonts  
- `examples/hello-artifact.html` — minimal single file  
