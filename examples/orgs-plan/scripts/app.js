(function () {
  // Force sketch greens regardless of OS dark mode
  const SKETCH = {
    indigo: "#3d6b3a",
    cyan: "#4a7c59",
    amber: "#c4a35a",
    emerald: "#3d6b3a",
    fuchsia: "#6b5b95",
    rose: "#b5403a",
    slate: "#5c6b52",
  };
  if (window.Diagram) {
    Diagram.accent = function (name) {
      return SKETCH[name] || SKETCH.indigo;
    };
  }

  const W = 900;

  // --- Pain: every member OAuth ---
  Diagram.renderFlow(document.getElementById("d-pain"), {
    width: W,
    height: 240,
    pad: 8,
    nodes: [
      { id: "art", title: "Org artifact", sub: "shared link", x: 40, y: 90, w: 150, h: 56, tone: "amber", iconKey: "box" },
      { id: "u1", title: "Member 1", sub: "SAML request…", x: 280, y: 24, w: 140, h: 52, tone: "rose", iconKey: "eye" },
      { id: "u2", title: "Member 2", sub: "SAML request…", x: 280, y: 94, w: 140, h: 52, tone: "rose", iconKey: "eye" },
      { id: "u3", title: "Member …50", sub: "SAML request…", x: 280, y: 164, w: 140, h: 52, tone: "rose", iconKey: "eye" },
      { id: "gh", title: "GitHub / admin", sub: "approve × 50", x: 540, y: 90, w: 170, h: 56, tone: "slate", iconKey: "lock" },
      { id: "sad", title: "Friction", sub: "nobody opens it", x: 780, y: 96, w: 100, h: 48, tone: "rose", iconKey: "share" },
    ],
    edges: [
      { from: "art", to: "u1", route: "hv", color: "rose", label: "open", fromSide: "e", toSide: "w" },
      { from: "art", to: "u2", route: "h", color: "rose", strong: true, fromSide: "e", toSide: "w" },
      { from: "art", to: "u3", route: "hv", color: "rose", fromSide: "e", toSide: "w" },
      { from: "u1", to: "gh", route: "hv", color: "slate", dashed: true, fromSide: "e", toSide: "w" },
      { from: "u2", to: "gh", route: "h", color: "slate", strong: true, fromSide: "e", toSide: "w" },
      { from: "u3", to: "gh", route: "hv", color: "slate", dashed: true, fromSide: "e", toSide: "w" },
      { from: "gh", to: "sad", route: "h", color: "rose", label: "blocked", fromSide: "e", toSide: "w" },
    ],
  });

  // --- Target model ---
  Diagram.renderFlow(document.getElementById("d-target"), {
    width: W,
    height: 340,
    pad: 8,
    lanes: [
      { title: "Once", x: 0, y: 4, w: W, h: 130 },
      { title: "Every member", x: 0, y: 150, w: W, h: 170 },
    ],
    nodes: [
      { id: "linker", title: "Linker (admin)", sub: "connect org", x: 40, y: 48, w: 160, h: 56, tone: "indigo", iconKey: "lock" },
      { id: "org", title: "lookmom Orgs", sub: "Aperturs linked", x: 280, y: 48, w: 160, h: 56, tone: "emerald", iconKey: "cloud" },
      { id: "roster", title: "Member roster", sub: "@logins + emails", x: 520, y: 48, w: 170, h: 56, tone: "amber", iconKey: "db" },
      { id: "m1", title: "Alice", sub: "identity only", x: 80, y: 210, w: 130, h: 52, tone: "cyan", iconKey: "eye" },
      { id: "m2", title: "Bob", sub: "identity only", x: 260, y: 210, w: 130, h: 52, tone: "cyan", iconKey: "eye" },
      { id: "m3", title: "…team", sub: "no org grant", x: 440, y: 210, w: 130, h: 52, tone: "cyan", iconKey: "eye" },
      { id: "lib", title: "Org library", sub: "all org artifacts", x: 680, y: 200, w: 170, h: 64, tone: "emerald", iconKey: "box" },
    ],
    edges: [
      { from: "linker", to: "org", route: "h", color: "indigo", label: "read:org once", strong: true, fromSide: "e", toSide: "w" },
      { from: "org", to: "roster", route: "h", color: "emerald", label: "sync", fromSide: "e", toSide: "w" },
      { from: "m1", to: "lib", route: "hv", color: "cyan", fromSide: "e", toSide: "w" },
      { from: "m2", to: "lib", route: "h", color: "cyan", strong: true, label: "on roster?", fromSide: "e", toSide: "w" },
      { from: "m3", to: "lib", route: "hv", color: "cyan", fromSide: "e", toSide: "w" },
      { from: "roster", to: "lib", route: "v", color: "amber", dashed: true, open: true, fromSide: "s", toSide: "n" },
    ],
  });

  // --- Two scopes ---
  Diagram.renderFlow(document.getElementById("d-scopes"), {
    width: W,
    height: 200,
    pad: 8,
    nodes: [
      { id: "you", title: "Any member", sub: "lookmom user", x: 40, y: 70, w: 140, h: 56, tone: "slate", iconKey: "eye" },
      { id: "id", title: "Identity connect", sub: "read:user (+ email)", x: 260, y: 30, w: 180, h: 56, tone: "cyan", iconKey: "bot" },
      { id: "link", title: "Org link", sub: "read:org", x: 260, y: 120, w: 180, h: 56, tone: "indigo", iconKey: "lock" },
      { id: "proof", title: "Proves @login", sub: "see org libraries", x: 540, y: 30, w: 170, h: 56, tone: "emerald", iconKey: "share" },
      { id: "power", title: "Syncs members", sub: "powers the org", x: 540, y: 120, w: 170, h: 56, tone: "amber", iconKey: "db" },
    ],
    edges: [
      { from: "you", to: "id", route: "hv", color: "cyan", label: "everyone", strong: true, fromSide: "e", toSide: "w" },
      { from: "you", to: "link", route: "hv", color: "indigo", label: "1 person", dashed: true, fromSide: "e", toSide: "w" },
      { from: "id", to: "proof", route: "h", color: "cyan", fromSide: "e", toSide: "w" },
      { from: "link", to: "power", route: "h", color: "indigo", strong: true, fromSide: "e", toSide: "w" },
    ],
  });

  // --- Sequence happy path ---
  Diagram.renderSequence(document.getElementById("d-flow"), {
    width: W,
    actors: [
      { id: "L", title: "Linker" },
      { id: "lm", title: "lookmom" },
      { id: "gh", title: "GitHub" },
      { id: "M", title: "Member" },
    ],
    messages: [
      { from: "L", to: "lm", label: "Orgs → Connect org", color: "indigo" },
      { from: "lm", to: "gh", label: "OAuth read:org", color: "amber" },
      { from: "gh", to: "lm", label: "token + orgs list", open: true, color: "amber" },
      { from: "L", to: "lm", label: "Link Aperturs · Sync members", color: "indigo" },
      { from: "lm", to: "gh", label: "list members", color: "emerald" },
      { from: "gh", to: "lm", label: "logins (+ public emails)", open: true, color: "emerald" },
      { from: "L", to: "lm", label: "Share artifact → org", color: "indigo" },
      { from: "M", to: "lm", label: "Identity GitHub only", color: "cyan" },
      { from: "lm", to: "M", label: "Org library + artifact ✓", open: true, color: "emerald", note: "no org SAML" },
    ],
  });

  // --- Access gate ---
  Diagram.renderFlow(document.getElementById("d-gate"), {
    width: W,
    height: 420,
    pad: 8,
    nodes: [
      { id: "hit", title: "Open /a/:id", sub: "org artifact", x: 360, y: 8, w: 160, h: 52, tone: "slate", iconKey: "cloud" },
      { id: "sess", title: "signed in?", x: 380, y: 90, w: 120, h: 70, shape: "diamond", tone: "amber" },
      { id: "login", title: "Email or GitHub", sub: "identity", x: 140, y: 100, w: 150, h: 52, tone: "cyan", iconKey: "eye" },
      { id: "email", title: "email on roster?", x: 380, y: 190, w: 120, h: 70, shape: "diamond", tone: "amber" },
      { id: "ok1", title: "Allow", sub: "email path", x: 620, y: 200, w: 130, h: 48, tone: "emerald", iconKey: "box" },
      { id: "login2", title: "@login on roster?", x: 380, y: 290, w: 120, h: 70, shape: "diamond", tone: "cyan" },
      { id: "ok2", title: "Allow", sub: "username path", x: 620, y: 300, w: 130, h: 48, tone: "emerald", iconKey: "box" },
      { id: "live", title: "linker token check", sub: "fallback", x: 140, y: 300, w: 160, h: 52, tone: "indigo", iconKey: "lock" },
      { id: "deny", title: "Deny", sub: "re-sync org", x: 380, y: 380, w: 120, h: 48, tone: "rose", iconKey: "share" },
    ],
    edges: [
      { from: "hit", to: "sess", route: "v", color: "slate", strong: true, fromSide: "s", toSide: "n" },
      { from: "sess", to: "login", label: "no", route: "h", color: "slate", fromSide: "w", toSide: "e" },
      { from: "sess", to: "email", label: "yes", route: "v", color: "emerald", fromSide: "s", toSide: "n" },
      { from: "email", to: "ok1", label: "yes", route: "h", color: "emerald", strong: true, fromSide: "e", toSide: "w" },
      { from: "email", to: "login2", label: "no", route: "v", color: "cyan", fromSide: "s", toSide: "n" },
      { from: "login2", to: "ok2", label: "yes", route: "h", color: "emerald", strong: true, fromSide: "e", toSide: "w" },
      { from: "login2", to: "live", label: "no", route: "h", color: "indigo", dashed: true, fromSide: "w", toSide: "e" },
      { from: "live", to: "ok2", route: "hv", color: "indigo", open: true, dashed: true, fromSide: "e", toSide: "w" },
      { from: "login2", to: "deny", label: "fail", route: "v", color: "rose", fromSide: "s", toSide: "n" },
    ],
  });

  // --- Screens IA ---
  Diagram.renderFlow(document.getElementById("d-screens"), {
    width: W,
    height: 220,
    pad: 8,
    nodes: [
      { id: "nav", title: "Nav", sub: "Gallery · Orgs · Log out", x: 40, y: 80, w: 180, h: 56, tone: "slate", iconKey: "terminal" },
      { id: "gal", title: "/gallery", sub: "my artifacts", x: 300, y: 30, w: 140, h: 52, tone: "cyan", iconKey: "box" },
      { id: "orgs", title: "/orgs", sub: "linked orgs", x: 300, y: 120, w: 140, h: 52, tone: "emerald", iconKey: "cloud" },
      { id: "home", title: "/orgs/aperturs", sub: "artifacts + members", x: 520, y: 120, w: 180, h: 56, tone: "indigo", iconKey: "db" },
      { id: "view", title: "/a/:id", sub: "viewer + share", x: 520, y: 30, w: 160, h: 52, tone: "amber", iconKey: "eye" },
      { id: "share", title: "Share dialog", sub: "pick linked org", x: 740, y: 70, w: 140, h: 56, tone: "rose", iconKey: "share" },
    ],
    edges: [
      { from: "nav", to: "gal", route: "hv", color: "cyan", fromSide: "e", toSide: "w" },
      { from: "nav", to: "orgs", route: "hv", color: "emerald", strong: true, fromSide: "e", toSide: "w" },
      { from: "gal", to: "view", route: "h", color: "amber", fromSide: "e", toSide: "w" },
      { from: "orgs", to: "home", route: "h", color: "indigo", strong: true, label: "click", fromSide: "e", toSide: "w" },
      { from: "view", to: "share", route: "hv", color: "rose", fromSide: "e", toSide: "w" },
      { from: "home", to: "view", route: "v", color: "amber", open: true, dashed: true, fromSide: "n", toSide: "s" },
    ],
  });

  // --- Phases ---
  Diagram.renderFlow(document.getElementById("d-phases"), {
    width: W,
    height: 160,
    pad: 8,
    nodes: [
      { id: "p1", title: "Phase 1", sub: "org links + roster + gate", x: 30, y: 50, w: 180, h: 56, tone: "indigo", iconKey: "db" },
      { id: "p2", title: "Phase 2", sub: "/orgs UI + share", x: 250, y: 50, w: 170, h: 56, tone: "cyan", iconKey: "cloud" },
      { id: "p3", title: "Phase 3", sub: "identity-only members", x: 460, y: 50, w: 180, h: 56, tone: "emerald", iconKey: "eye" },
      { id: "p4", title: "Phase 4", sub: "teams · CLI · harden", x: 680, y: 50, w: 180, h: 56, tone: "amber", iconKey: "terminal" },
    ],
    edges: [
      { from: "p1", to: "p2", route: "h", color: "indigo", strong: true, fromSide: "e", toSide: "w" },
      { from: "p2", to: "p3", route: "h", color: "cyan", strong: true, fromSide: "e", toSide: "w" },
      { from: "p3", to: "p4", route: "h", color: "emerald", strong: true, fromSide: "e", toSide: "w" },
    ],
  });
})();
