(function () {
  /* ---------- 02 Keys ---------- */
  function renderKeys() {
    Diagram.renderFlow(document.getElementById("keys-diagram"), {
      width: 900,
      height: 260,
      pad: 8,
      nodes: [
        {
          id: "users",
          title: "users",
          sub: "PK id · name · plan",
          x: 60,
          y: 90,
          w: 200,
          h: 64,
          tone: "indigo",
          iconKey: "db",
        },
        {
          id: "orders",
          title: "orders",
          sub: "PK id · FK user_id · total",
          x: 520,
          y: 90,
          w: 240,
          h: 64,
          tone: "cyan",
          iconKey: "box",
        },
        {
          id: "note",
          title: "1 user → N orders",
          sub: "relationship cardinality",
          x: 300,
          y: 20,
          w: 200,
          h: 54,
          tone: "slate",
          iconKey: "share",
        },
      ],
      edges: [
        {
          from: "users",
          to: "orders",
          label: "user_id → id",
          route: "h",
          color: "indigo",
          strong: true,
          fromSide: "e",
          toSide: "w",
        },
        {
          from: "note",
          to: "users",
          route: "vh",
          color: "slate",
          dashed: true,
          open: true,
          fromSide: "w",
          toSide: "n",
        },
        {
          from: "note",
          to: "orders",
          route: "vh",
          color: "slate",
          dashed: true,
          open: true,
          fromSide: "e",
          toSide: "n",
        },
      ],
    });
  }

  /* ---------- 03 Indexes ---------- */
  let scanMode = "seq";

  function indexModel(mode) {
    // left: heap pages, right: btree or scan path
    const nodes = [];
    const edges = [];

    // heap
    for (let i = 0; i < 6; i++) {
      nodes.push({
        id: "p" + i,
        title: "page " + (i + 1),
        sub: i === 4 ? "… id=42 here" : "rows…",
        x: 40,
        y: 24 + i * 48,
        w: 130,
        h: 40,
        tone: i === 4 && mode === "seq" ? "emerald" : "slate",
        iconKey: "box",
      });
    }

    nodes.push({
      id: "query",
      title: "WHERE id = 42",
      sub: "lookup",
      x: 360,
      y: 20,
      w: 170,
      h: 52,
      tone: "indigo",
      iconKey: "terminal",
    });

    if (mode === "seq") {
      nodes.push({
        id: "engine",
        title: "Seq scan",
        sub: "read every page",
        x: 360,
        y: 140,
        w: 170,
        h: 52,
        tone: "amber",
        iconKey: "eye",
      });
      edges.push({
        from: "query",
        to: "engine",
        route: "v",
        color: "indigo",
        fromSide: "s",
        toSide: "n",
      });
      for (let i = 0; i < 6; i++) {
        edges.push({
          from: "engine",
          to: "p" + i,
          route: "h",
          color: i === 4 ? "emerald" : "slate",
          dashed: i !== 4,
          open: i !== 4,
          fromSide: "w",
          toSide: "e",
        });
      }
    } else {
      // btree levels
      nodes.push({
        id: "root",
        title: "B-tree root",
        sub: "id ranges",
        x: 360,
        y: 100,
        w: 160,
        h: 52,
        tone: "cyan",
        iconKey: "share",
      });
      nodes.push({
        id: "leaf",
        title: "Leaf: id=42",
        sub: "→ page 5 ptr",
        x: 360,
        y: 190,
        w: 160,
        h: 52,
        tone: "emerald",
        iconKey: "db",
      });
      edges.push({
        from: "query",
        to: "root",
        route: "v",
        color: "indigo",
        strong: true,
        fromSide: "s",
        toSide: "n",
      });
      edges.push({
        from: "root",
        to: "leaf",
        label: "O(log n)",
        route: "v",
        color: "cyan",
        strong: true,
        fromSide: "s",
        toSide: "n",
      });
      edges.push({
        from: "leaf",
        to: "p4",
        label: "1 heap fetch",
        route: "h",
        color: "emerald",
        strong: true,
        fromSide: "w",
        toSide: "e",
      });
    }

    return { width: 580, height: 320, nodes, edges, pad: 6 };
  }

  function renderIndex() {
    Diagram.renderFlow(document.getElementById("index-diagram"), indexModel(scanMode));

    const stats = document.getElementById("index-stats");
    const copy = document.getElementById("index-copy");
    if (scanMode === "seq") {
      stats.innerHTML = `
        <div class="stat"><span class="label">Pages read</span><span class="value">12,400</span><span class="hint">whole table</span></div>
        <div class="stat"><span class="label">Complexity</span><span class="value">O(n)</span><span class="hint">grows with rows</span></div>
        <div class="stat"><span class="label">Good when</span><span class="value">~30%+</span><span class="hint">of rows match</span></div>`;
      copy.textContent =
        "Sequential scan walks the heap page by page. Fine for small tables or when you need most rows anyway — wasteful for “find one id in millions.”";
    } else {
      stats.innerHTML = `
        <div class="stat"><span class="label">Pages read</span><span class="value">4</span><span class="hint">tree + 1 heap</span></div>
        <div class="stat"><span class="label">Complexity</span><span class="value">O(log n)</span><span class="hint">tree height</span></div>
        <div class="stat"><span class="label">Good when</span><span class="value">selective</span><span class="hint">few rows match</span></div>`;
      copy.textContent =
        "An index is a separate sorted structure. The engine descends a few tree levels, then fetches only the heap page that holds the row.";
    }

    MiniCharts.barCompare(document.getElementById("cost-chart"), [
      { label: "Seq scan pages", value: 12400, color: scanMode === "seq" ? "#e09a00" : "#c4b8a5" },
      { label: "Index pages", value: 4, color: scanMode === "idx" ? "#3d8bfd" : "#c4b8a5" },
      { label: "Index + heap", value: 5, color: scanMode === "idx" ? "#3faf6c" : "#c4b8a5" },
    ]);
  }

  /* ---------- 04 ACID ---------- */
  function renderAcid() {
    Diagram.renderFlow(document.getElementById("acid-diagram"), {
      width: 920,
      height: 220,
      pad: 8,
      nodes: [
        {
          id: "begin",
          title: "BEGIN",
          sub: "open txn",
          x: 40,
          y: 80,
          w: 120,
          h: 54,
          tone: "slate",
          iconKey: "terminal",
        },
        {
          id: "debit",
          title: "Debit Alice",
          sub: "−$50",
          x: 220,
          y: 80,
          w: 140,
          h: 54,
          tone: "rose",
          iconKey: "box",
        },
        {
          id: "credit",
          title: "Credit Bob",
          sub: "+$50",
          x: 420,
          y: 80,
          w: 140,
          h: 54,
          tone: "emerald",
          iconKey: "box",
        },
        {
          id: "ok",
          title: "COMMIT",
          sub: "durable",
          x: 640,
          y: 30,
          w: 130,
          h: 54,
          tone: "indigo",
          iconKey: "lock",
        },
        {
          id: "fail",
          title: "ROLLBACK",
          sub: "as if never",
          x: 640,
          y: 130,
          w: 130,
          h: 54,
          tone: "amber",
          iconKey: "share",
        },
      ],
      edges: [
        { from: "begin", to: "debit", route: "h", color: "slate", strong: true, fromSide: "e", toSide: "w" },
        { from: "debit", to: "credit", route: "h", color: "rose", strong: true, fromSide: "e", toSide: "w" },
        { from: "credit", to: "ok", label: "success", route: "hv", color: "emerald", fromSide: "e", toSide: "w" },
        { from: "credit", to: "fail", label: "error / crash", route: "hv", color: "amber", dashed: true, fromSide: "e", toSide: "w" },
      ],
    });
  }

  /* ---------- 05 Joins ---------- */
  let joinMode = "inner";

  const USERS = [
    { id: 1, name: "Ada" },
    { id: 2, name: "Grace" },
    { id: 3, name: "Linus" },
  ];
  const ORDERS = [
    { id: 10, user_id: 1, total: 42 },
    { id: 11, user_id: 1, total: 17 },
    { id: 12, user_id: 3, total: 99 },
  ];

  function joinResult(mode) {
    if (mode === "inner") {
      return ORDERS.map((o) => {
        const u = USERS.find((x) => x.id === o.user_id);
        return { name: u.name, order_id: o.id, total: o.total, note: "matched" };
      });
    }
    if (mode === "left") {
      const rows = [];
      for (const u of USERS) {
        const os = ORDERS.filter((o) => o.user_id === u.id);
        if (os.length === 0) rows.push({ name: u.name, order_id: "—", total: "—", note: "kept (nulls)" });
        else os.forEach((o) => rows.push({ name: u.name, order_id: o.id, total: o.total, note: "matched" }));
      }
      return rows;
    }
    // anti: users with no orders
    return USERS.filter((u) => !ORDERS.some((o) => o.user_id === u.id)).map((u) => ({
      name: u.name,
      order_id: "—",
      total: "—",
      note: "no match",
    }));
  }

  function renderJoinTable() {
    const rows = joinResult(joinMode);
    const el = document.getElementById("join-table");
    el.innerHTML =
      `<thead><tr><th>user</th><th>order</th><th>total</th><th></th></tr></thead><tbody>` +
      rows
        .map(
          (r) =>
            `<tr class="${r.note.includes("no") || r.note.includes("null") ? "" : "hit"}">` +
            `<td>${r.name}</td><td class="mono">${r.order_id}</td><td class="mono">${r.total}</td>` +
            `<td style="color:var(--muted);font-size:12px">${r.note}</td></tr>`,
        )
        .join("") +
      `</tbody>`;
  }

  function joinDiagramModel(mode) {
    const nodes = [
      { id: "u", title: "users", sub: "Ada · Grace · Linus", x: 40, y: 100, w: 170, h: 58, tone: "indigo", iconKey: "db" },
      { id: "o", title: "orders", sub: "Ada×2 · Linus×1", x: 360, y: 100, w: 180, h: 58, tone: "cyan", iconKey: "box" },
      {
        id: "out",
        title: mode === "inner" ? "INNER result" : mode === "left" ? "LEFT result" : "Anti result",
        sub:
          mode === "inner"
            ? "3 rows (matches only)"
            : mode === "left"
              ? "4 rows (Grace nulls)"
              : "1 row (Grace)",
        x: 200,
        y: 240,
        w: 200,
        h: 58,
        tone: "emerald",
        iconKey: "terminal",
      },
    ];
    const edges = [
      {
        from: "u",
        to: "o",
        label: "ON u.id = o.user_id",
        route: "h",
        color: "indigo",
        strong: true,
        fromSide: "e",
        toSide: "w",
      },
      {
        from: "u",
        to: "out",
        route: "vh",
        color: mode === "anti" ? "amber" : "emerald",
        fromSide: "s",
        toSide: "n",
        label: mode === "inner" ? "require match" : mode === "left" ? "keep left" : "no match",
      },
      {
        from: "o",
        to: "out",
        route: "vh",
        color: mode === "anti" ? "slate" : "cyan",
        dashed: mode !== "inner",
        open: mode !== "inner",
        fromSide: "s",
        toSide: "n",
      },
    ];
    return { width: 560, height: 330, nodes, edges, pad: 8 };
  }

  function renderJoins() {
    const copy = document.getElementById("join-copy");
    if (joinMode === "inner") {
      copy.innerHTML =
        "<p><strong style='color:var(--fg)'>INNER JOIN</strong> returns only combinations that satisfy the join predicate. Users without orders disappear; orders without users (orphans) disappear too.</p>";
    } else if (joinMode === "left") {
      copy.innerHTML =
        "<p><strong style='color:var(--fg)'>LEFT JOIN</strong> keeps every row from the left table. If there’s no match on the right, right-side columns are <code>NULL</code> — Grace still appears.</p>";
    } else {
      copy.innerHTML =
        "<p><strong style='color:var(--fg)'>Anti-join</strong> (often <code>LEFT … WHERE right.id IS NULL</code> or <code>NOT EXISTS</code>) finds left rows with <em>no</em> match — “users who never ordered.”</p>";
    }
    renderJoinTable();
    Diagram.renderFlow(document.getElementById("join-diagram"), joinDiagramModel(joinMode));
  }

  /* ---------- wire UI ---------- */
  document.querySelectorAll("[data-scan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      scanMode = btn.getAttribute("data-scan");
      document.querySelectorAll("[data-scan]").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      renderIndex();
    });
  });

  document.querySelectorAll("[data-join]").forEach((btn) => {
    btn.addEventListener("click", () => {
      joinMode = btn.getAttribute("data-join");
      document.querySelectorAll("[data-join]").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      renderJoins();
    });
  });

  function renderAll() {
    renderKeys();
    renderIndex();
    renderAcid();
    renderJoins();
  }

  if (typeof matchMedia === "function") {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
  }

  renderAll();
})();
