(function () {
  const NW = 172;
  const NH = 58;

  function archModel() {
    const lanes = [
      { title: "Author", x: 0, y: 4, w: 1020, h: 128 },
      { title: "Platform", x: 0, y: 148, w: 1020, h: 220 },
      { title: "Viewer", x: 0, y: 388, w: 1020, h: 120 },
    ];

    const nodes = [
      {
        id: "agent",
        title: "Agent / skill",
        sub: "multi-file HTML project",
        x: 48,
        y: 48,
        w: NW,
        h: NH,
        tone: "indigo",
        iconKey: "bot",
      },
      {
        id: "cli",
        title: "lookmom CLI",
        sub: "pack · preview · publish",
        x: 300,
        y: 48,
        w: NW + 8,
        h: NH,
        tone: "cyan",
        iconKey: "terminal",
      },
      {
        id: "worker",
        title: "Cloudflare Worker",
        sub: "API · auth · gate",
        x: 140,
        y: 220,
        w: NW + 16,
        h: NH,
        tone: "amber",
        iconKey: "cloud",
      },
      {
        id: "r2",
        title: "R2",
        sub: "HTML blobs",
        x: 420,
        y: 190,
        w: 128,
        h: NH,
        tone: "emerald",
        iconKey: "box",
      },
      {
        id: "d1",
        title: "D1",
        sub: "meta · ACL",
        x: 420,
        y: 278,
        w: 128,
        h: NH,
        tone: "emerald",
        iconKey: "db",
      },
      {
        id: "sandbox",
        title: "Sandbox host",
        sub: "cookieless /raw",
        x: 640,
        y: 234,
        w: NW,
        h: NH,
        tone: "fuchsia",
        iconKey: "lock",
      },
      {
        id: "viewer",
        title: "Viewer",
        sub: "browser session",
        x: 260,
        y: 420,
        w: NW,
        h: NH,
        tone: "slate",
        iconKey: "eye",
      },
      {
        id: "gate",
        title: "Gate /a/:id",
        sub: "ACL · short grant",
        x: 520,
        y: 420,
        w: NW,
        h: NH,
        tone: "indigo",
        iconKey: "share",
      },
    ];

    const edges = [
      {
        from: "agent",
        to: "cli",
        label: "files",
        route: "h",
        color: "indigo",
        fromSide: "e",
        toSide: "w",
      },
      {
        from: "cli",
        to: "worker",
        label: "POST /api/publish",
        route: "vh",
        color: "cyan",
        strong: true,
        fromSide: "s",
        toSide: "n",
      },
      {
        from: "worker",
        to: "r2",
        label: "store",
        route: "h",
        color: "amber",
        fromSide: "e",
        toSide: "w",
      },
      {
        from: "worker",
        to: "d1",
        label: "meta",
        route: "hv",
        color: "amber",
        fromSide: "e",
        toSide: "w",
      },
      {
        from: "r2",
        to: "sandbox",
        label: "bytes",
        route: "h",
        color: "emerald",
        fromSide: "e",
        toSide: "w",
      },
      {
        from: "d1",
        to: "sandbox",
        label: "version key",
        route: "hvh",
        color: "emerald",
        dashed: true,
        open: true,
        fromSide: "e",
        toSide: "w",
      },
      {
        from: "viewer",
        to: "gate",
        label: "open link",
        route: "h",
        color: "slate",
        strong: true,
        fromSide: "e",
        toSide: "w",
      },
      {
        from: "gate",
        to: "sandbox",
        label: "iframe + grant",
        route: "vh",
        color: "indigo",
        strong: true,
        fromSide: "n",
        toSide: "s",
      },
      {
        from: "gate",
        to: "d1",
        label: "isAllowed?",
        route: "vhv",
        color: "indigo",
        open: true,
        dashed: true,
        fromSide: "n",
        toSide: "s",
      },
    ];

    return { width: 1020, height: 520, lanes, nodes, edges, pad: 12 };
  }

  function flowModel() {
    const nodes = [
      {
        id: "hit",
        title: "GET /a/:id",
        sub: "gate request",
        x: 370,
        y: 12,
        w: 168,
        h: 54,
        tone: "indigo",
        iconKey: "cloud",
      },
      {
        id: "public",
        title: "public?",
        x: 394,
        y: 108,
        w: 120,
        h: 78,
        shape: "diamond",
        tone: "amber",
      },
      {
        id: "serve1",
        title: "Issue grant",
        sub: "render frame",
        x: 620,
        y: 120,
        w: 156,
        h: 54,
        tone: "emerald",
        iconKey: "lock",
      },
      {
        id: "session",
        title: "session?",
        x: 394,
        y: 230,
        w: 120,
        h: 78,
        shape: "diamond",
        tone: "amber",
      },
      {
        id: "login",
        title: "Login prompt",
        sub: "WorkOS / GitHub",
        x: 150,
        y: 242,
        w: 160,
        h: 54,
        tone: "slate",
        iconKey: "eye",
      },
      {
        id: "owner",
        title: "owner / ACL",
        x: 394,
        y: 352,
        w: 120,
        h: 78,
        shape: "diamond",
        tone: "cyan",
      },
      {
        id: "deny",
        title: "Access denied",
        sub: "switch account",
        x: 150,
        y: 364,
        w: 160,
        h: 54,
        tone: "rose",
        iconKey: "lock",
      },
      {
        id: "ok",
        title: "Allowed",
        sub: "sign grant → iframe",
        x: 620,
        y: 364,
        w: 168,
        h: 54,
        tone: "emerald",
        iconKey: "box",
      },
    ];

    const edges = [
      { from: "hit", to: "public", route: "v", strong: true, color: "indigo", fromSide: "s", toSide: "n" },
      { from: "public", to: "serve1", label: "yes", route: "h", color: "emerald", fromSide: "e", toSide: "w" },
      { from: "public", to: "session", label: "no", route: "v", color: "slate", fromSide: "s", toSide: "n" },
      { from: "session", to: "login", label: "no", route: "h", color: "slate", fromSide: "w", toSide: "e" },
      { from: "session", to: "owner", label: "yes", route: "v", color: "cyan", fromSide: "s", toSide: "n" },
      { from: "owner", to: "deny", label: "no", route: "h", color: "rose", fromSide: "w", toSide: "e" },
      { from: "owner", to: "ok", label: "yes", route: "h", color: "emerald", strong: true, fromSide: "e", toSide: "w" },
      {
        from: "serve1",
        to: "ok",
        route: "v",
        dashed: true,
        open: true,
        color: "emerald",
        fromSide: "s",
        toSide: "n",
      },
    ];

    return { width: 860, height: 460, nodes, edges, pad: 10 };
  }

  function seqModel() {
    return {
      width: 960,
      actors: [
        { id: "v", title: "Viewer" },
        { id: "g", title: "Gate" },
        { id: "db", title: "D1" },
        { id: "s", title: "Sandbox" },
        { id: "r2", title: "R2" },
      ],
      messages: [
        { from: "v", to: "g", label: "GET /a/:id", color: "indigo" },
        { from: "g", to: "db", label: "load artifact + ACL", color: "amber" },
        { from: "db", to: "g", label: "row + allowlist", open: true, color: "amber" },
        { from: "g", to: "g", label: "sign grant JWT (~30s)", dashed: true, color: "indigo" },
        { from: "g", to: "v", label: "HTML chrome + iframe src", open: true, color: "indigo" },
        { from: "v", to: "s", label: "GET /raw/:id?grant=…", color: "fuchsia" },
        { from: "s", to: "s", label: "verify grant signature", dashed: true, color: "fuchsia" },
        { from: "s", to: "r2", label: "get object by key", color: "emerald" },
        { from: "r2", to: "s", label: "HTML bytes", open: true, color: "emerald" },
        {
          from: "s",
          to: "v",
          label: "200 + strict CSP",
          open: true,
          color: "fuchsia",
          note: "no cookies on sandbox",
        },
      ],
    };
  }

  function paintLegend(el) {
    const items = [
      ["indigo", "Agent / gate"],
      ["cyan", "CLI"],
      ["amber", "Worker"],
      ["emerald", "Storage"],
      ["fuchsia", "Sandbox"],
      ["slate", "Viewer"],
    ];
    el.innerHTML = items
      .map(
        ([tone, label]) =>
          `<li><span class="swatch" style="background:${Diagram.accent(tone)}"></span>${label}</li>`,
      )
      .join("");
  }

  function show(tab) {
    document.querySelectorAll(".tabs button").forEach((b) => {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === tab ? "true" : "false");
    });
    document.querySelectorAll("[data-panel]").forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-panel") !== tab);
    });
  }

  function renderAll() {
    Diagram.renderFlow(document.getElementById("arch-diagram"), archModel());
    Diagram.renderFlow(document.getElementById("flow-diagram"), flowModel());
    Diagram.renderSequence(document.getElementById("seq-diagram"), seqModel());
    paintLegend(document.getElementById("arch-legend"));
  }

  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => show(btn.getAttribute("data-tab")));
  });

  if (typeof matchMedia === "function") {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
  }

  renderAll();
  show("arch");
})();
