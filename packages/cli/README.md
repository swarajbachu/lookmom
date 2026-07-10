# lookmom CLI

Publish self-contained HTML artifacts to a lookmom instance (private, allowlist, public, or GitHub org share).

## Install

Requires [Bun](https://bun.sh) ≥ 1.3 (the CLI uses Bun for preview + the bin shebang).

```bash
bun add -g lookmom
# or
npm install -g lookmom
```

## Usage

```bash
# Default API is https://lookmom.stuff.md
# Local: lookmom … --api http://localhost:8787

lookmom login
lookmom preview ./my-dashboard          # file OR directory with index.html
lookmom pack ./my-dashboard -o out.html
lookmom publish ./my-dashboard --title "Demo"
lookmom publish page.html --title "Demo"
lookmom share <id> --email teammate@example.com
lookmom share <id> --mode public
lookmom share <id> --github-org acme --github-team eng
lookmom list
```

Multi-file projects are bundled automatically (local CSS/JS/images/partials inlined for CSP).

See the [repo README](https://github.com/swarajbachu/lookmom) for full docs.
