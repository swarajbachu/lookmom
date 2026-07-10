---
name: lookmom-design
description: >
  Design clean, CSP-safe HTML artifacts for lookmom: diagrams with arrows,
  concept explainers, interactive mockups, dashboards, charts, and PR
  walkthroughs. Use when the user wants something easier to *see* than to read
  — “explain X visually”, “draw the architecture”, “mock this UI”, “make a
  dashboard”, “doodle notes”, “compare options side by side”. Pair with the
  lookmom skill to preview/publish. Prefer this skill over dumping long prose
  or ASCII art when a visual page would land better.
---

# lookmom-design — visual artifacts that teach & sell

Build **self-contained HTML** that looks intentional: architecture diagrams,
concept explainers, mockups, charts, comparisons. Author as multi-file projects;
the **lookmom** CLI packs them for a strict CSP (no CDNs, no `fetch`).

Install companion: `lookmom` skill (publish / share / CLI). This skill is the
**craft** layer.

## When to use

| User intent | Artifact type |
| --- | --- |
| Explain a concept (DB, auth, billing…) | Interactive explainer + diagrams |
| “How does our system work?” | Architecture / sequence diagram |
| Product or UI idea | Clickable mockup |
| Metrics / funnel | Dashboard + charts |
| Design options | Side-by-side comparison cards |
| PR or migration | Visual walkthrough |

Prefer an artifact over a wall of terminal text when scanning beats reading.

## Authoring model (multi-file)

```
my-artifact/
  index.html
  styles/
    tokens.css      # colors, type, motion
    layout.css
    diagram.css     # optional
  scripts/
    diagram.js      # optional SVG kit
    charts.js
    app.js
  partials/
    section-*.html  # <!-- lookmom:include partials/… -->
  fonts/            # optional local .ttf/.woff2 (inlined; keep each ≤ 512 KiB)
```

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Clear title</title>
  <link rel="stylesheet" href="styles/tokens.css">
  <link rel="stylesheet" href="styles/layout.css">
</head>
<body>
  <!-- lookmom:include partials/hero.html -->
  <main>…</main>
  <script src="scripts/app.js"></script>
</body>
</html>
```

Tiny one-offs can be a single `.html` file. Anything with diagrams or multiple
sections should be multi-file.

**CSP reminders (full detail in lookmom skill):** no remote CSS/JS/fonts; no
`fetch`; local assets only; classic scripts (not bare ES modules from CDN).

## Repo examples (copy patterns from these)

| Path | What to steal |
| --- | --- |
| `examples/dashboard/` | KPI row, bar/donut/funnel, filter chips, dark mode tokens |
| `examples/diagram/` | Orthogonal arrows, swimlanes, sequence frames, decision diamonds |
| `examples/db-concepts/` | Explainer structure, TOC, sketch aesthetic, handwriting fonts, interactive toggles |
| `examples/hello-artifact.html` | Minimal single-file |

When in this repo, **read those files** and adapt — don’t reinvent the SVG kit
from scratch if `diagram.js` already exists.

---

## 1. Concept explainers (teach clearly)

**Goal:** someone new gets the idea in under a minute of scanning.

### Structure

1. **Hero** — one-line promise + short lede (what / why)
2. **TOC chips** — jump links to `#sections`
3. **Numbered sections** — `01 · 02 · 03…` each one idea
4. Every section has **visual + words**:
   - left/right: diagram or table + short prose
   - callout boxes for “mental model” / “why it matters”
5. **Interactive toggles** where contrast teaches (e.g. seq scan vs index, INNER vs LEFT join)
6. Footer with source path or “self-contained” note

### Writing

- Short sentences. Concrete nouns. Example rows > abstract definitions.
- One metaphor max per section, then the real term.
- Show a tiny table of sample data before generalizing.
- Code chips sparingly: `WHERE id = 42`, not full tutorials.
- Avoid filler, em-dash spam, and “In today’s world…”.

### Clarity checklist

- [ ] Can a reader skip body text and still get the point from diagrams + headings?
- [ ] Every diagram has a one-line caption or nearby explanation
- [ ] Interactive modes change both the picture *and* a short status line
- [ ] No section longer than ~screen without a visual break

---

## 2. Diagrams (arrows, nodes, flows)

**No Mermaid CDN.** Draw **SVG** with markers, orthogonal edges, labels.

### Patterns

| Type | Building blocks |
| --- | --- |
| Architecture | Swimlanes + rounded nodes + orthogonal arrows + edge labels |
| Sequence | Actor chips, dashed lifelines, solid/open arrowheads, notes |
| Decision | Diamonds for branches, yes/no labels, outcome cards |
| Funnel / pipeline | Ordered stages, width or emphasis by volume |
| Entity / ER-ish | Boxes + PK/FK labels on edges |

### Implementation tips

- Prefer a small kit (`Diagram.renderFlow` / `renderSequence` in examples) over ad-hoc SVG each time.
- Edges: side anchors (`e`/`w`/`n`/`s`), rounded elbows, `<marker>` arrowheads.
- Labels sit mid-edge on a pill background so they stay readable.
- Keep **6–12 nodes** per diagram; split large systems into tabs or sequential figures.
- Color by **role** (agent / storage / viewer), not rainbow decoration.
- Always `role="img"` + `aria-label` on the host.

### Sketch / hand-drawn vibe (optional)

When the user wants playful notes (see `examples/db-concepts/`):

- Light paper background + soft dots/grid
- Wobbly `border-radius` (asymmetric radii), ink borders, “tape” pseudo-elements
- Local handwriting fonts via `@font-face` + files under `fonts/` (Patrick Hand, Caveat, etc.) — **never** Google Fonts URL
- Slight path jitter on edges; thicker stroke; pastel node fills
- Wavy text underlines on titles

Still keep contrast readable and tap targets large.

---

## 3. Charts

SVG only (or canvas from inline JS). Recipes:

- **Bar** — `viewBox`, `<rect>` heights, value labels, tabular numbers
- **Donut** — circle + `stroke-dasharray` segments + legend
- **Line/area** — polyline/path; optional gradient fill in SVG defs
- **Funnel** — stacked horizontal bars by conversion
- **Cost compare** — 2–3 bars when teaching “before vs after”

Data lives in `scripts/data.js` as plain objects. Summarize (top N, weekly rollups).
Highlight the active series when toggles change.

---

## 4. Mockups

Interactive UI prototypes that feel real enough to discuss.

### Do

- Real product structure: nav, primary action, empty states, errors
- System or embedded fonts only; tokenized colors
- Working tabs, modals (CSS/JS), form affordances — no backend
- Realistic copy (names, amounts) not “lorem ipsum” when possible
- Mobile-friendly layouts (`max-width`, stacking grids)

### Don’t

- Fake browser chrome unless asked
- Dead buttons with no feedback
- Rely on hover-only interactions (touch-first)
- Pull icons from icon CDNs — inline SVG

### Device frame (optional)

A simple rounded rectangle + status bar is enough. Content quality > bezel cosplay.

---

## 5. Design system (non-sketch)

Default professional look (dashboard/diagram examples):

1. **Tokens** — `--bg`, `--surface`, `--fg`, `--muted`, `--accent`, `--line`, `--radius`, `--shadow`, `--ease-out`
2. **Dark mode** — `color-scheme` + `prefers-color-scheme` (unless deliberately light-only sketch)
3. **Type** — antialiased; headings `letter-spacing: -0.02em` + `text-wrap: balance`; measure ≤ ~65ch; `tabular-nums` for live numbers
4. **Surfaces** — hairline ring `box-shadow: 0 0 0 1px var(--line)` over harsh gray borders
5. **Motion** — ease-out 150–250ms; only `opacity`/`transform`; always:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

6. **Controls** — 40px min height; `@media (hover: hover)` for hover styles; `:focus-visible`; no font-weight change on hover

### Anti-patterns

- Purple gradient hero + Inter from Google Fonts  
- `transition: all`  
- Chart.js / D3 / Mermaid from CDN  
- Unstyled giant tables  
- Marketing fluff in product UI  

---

## 6. Layout recipes

| Use case | Layout |
| --- | --- |
| Dashboard | KPIs → filters → 2-col charts → wide table/funnel |
| Explainer | Hero + TOC → numbered sections (visual \| prose) |
| Comparison | Equal cards, shared metric alignment |
| Mockup | App shell + main canvas + optional side panel |
| PR walkthrough | Sticky TOC + before/after panels |
| Status | Big state pill + timeline + component table |

---

## 7. End-to-end agent flow

1. **Pick type** (explainer / diagram / mockup / dashboard).
2. **Scaffold** multi-file folder (or single file if tiny).
3. **Implement** visuals first, then tighten copy.
4. **`lookmom preview ./dir`** — fix CSP and layout.
5. **`lookmom publish ./dir --title "…" --emoji …`** (see **lookmom** skill).
6. Give the user the URL; share only if asked.

If lookmom CLI isn’t installed, still produce the HTML project and tell them how to publish once CLI is ready.

---

## 8. Quality gate

- [ ] Readable in 30s scan (headings + visuals carry the story)
- [ ] Diagrams have arrows that attach to sides (not floating lines)
- [ ] Interactive toggles update visual + text
- [ ] Works under `lookmom preview` (no external requests)
- [ ] Reduced motion respected
- [ ] Touch targets ≥ ~40px
- [ ] Title is specific (“Indexes: scan vs B-tree”, not “Document”)
- [ ] Dataset/examples are small and honest

## Pairing

| Skill | Responsibility |
| --- | --- |
| **lookmom-design** (this) | What to build and how it should look/teach |
| **lookmom** | preview / pack / publish / share / auth / CSP contract |

Load **both** when the user wants a designed page online.
