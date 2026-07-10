/**
 * CSP-safe SVG diagram kit — nodes, orthogonal edges with rounded elbows,
 * colored arrow markers, diamonds, swimlanes, sequence frames.
 */
(function (global) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function darkMode() {
    return (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  /* Playful crayon palette (light sketchbook) */
  const SKETCH = {
    indigo: "#3d8bfd",
    cyan: "#2aa8c5",
    amber: "#e09a00",
    emerald: "#3faf6c",
    fuchsia: "#9b5de5",
    rose: "#e85d4c",
    slate: "#5c5346",
  };

  function accent(name) {
    return SKETCH[name] || SKETCH.indigo;
  }

  function edgeInk(name) {
    if (!name) return "#5c5346";
    return accent(name);
  }

  function el(name, attrs, children) {
    let out = `<${name}`;
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      out += ` ${k}="${esc(v)}"`;
    }
    if (children == null || children === "") return `${out} />`;
    return `${out}>${children}</${name}>`;
  }

  /** Side midpoints of a node box. */
  function anchors(n) {
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    return {
      n: { x: cx, y: n.y, side: "n" },
      s: { x: cx, y: n.y + n.h, side: "s" },
      e: { x: n.x + n.w, y: cy, side: "e" },
      w: { x: n.x, y: cy, side: "w" },
      c: { x: cx, y: cy, side: "c" },
    };
  }

  /**
   * Pick exit/enter sides. Prefer explicit e.fromSide / e.toSide.
   * Otherwise infer from relative placement + route hint.
   */
  function pickSides(from, to, route) {
    const ax = from.x + from.w / 2;
    const ay = from.y + from.h / 2;
    const bx = to.x + to.w / 2;
    const by = to.y + to.h / 2;
    const dx = bx - ax;
    const dy = by - ay;

    if (route === "v" || (Math.abs(dx) < 12 && Math.abs(dy) > 8)) {
      return dy >= 0 ? ["s", "n"] : ["n", "s"];
    }
    if (route === "h" || (Math.abs(dy) < 12 && Math.abs(dx) > 8)) {
      return dx >= 0 ? ["e", "w"] : ["w", "e"];
    }
    // L-shaped defaults
    if (route === "hv") return dx >= 0 ? ["e", "n"] : ["w", "n"];
    if (route === "vh") return dy >= 0 ? ["s", "w"] : ["n", "w"];
    if (route === "hvh") return dx >= 0 ? ["e", "w"] : ["w", "e"];
    if (route === "vhv") return dy >= 0 ? ["s", "n"] : ["n", "s"];

    // auto: favor dominant axis
    if (Math.abs(dx) > Math.abs(dy) * 1.1) return dx >= 0 ? ["e", "w"] : ["w", "e"];
    return dy >= 0 ? ["s", "n"] : ["n", "s"];
  }

  /**
   * Build polyline points for an orthogonal connector with optional mid offset.
   */
  function orthoPoints(from, to, route = "auto", fromSide, toSide) {
    const A = anchors(from);
    const B = anchors(to);
    if (!fromSide || !toSide) {
      const picked = pickSides(from, to, route);
      fromSide = fromSide || picked[0];
      toSide = toSide || picked[1];
    }
    const p0 = A[fromSide] || A.e;
    const p1 = B[toSide] || B.w;

    if (route === "auto") {
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      if (Math.abs(dy) < 6) route = "h";
      else if (Math.abs(dx) < 6) route = "v";
      else if ((fromSide === "e" || fromSide === "w") && (toSide === "e" || toSide === "w"))
        route = "hvh";
      else if ((fromSide === "n" || fromSide === "s") && (toSide === "n" || toSide === "s"))
        route = "vhv";
      else if (fromSide === "e" || fromSide === "w") route = "hv";
      else route = "vh";
    }

    const pts = [{ x: p0.x, y: p0.y }];

    if (route === "h") {
      pts.push({ x: p1.x, y: p0.y });
      if (p0.y !== p1.y) pts.push({ x: p1.x, y: p1.y });
    } else if (route === "v") {
      pts.push({ x: p0.x, y: p1.y });
      if (p0.x !== p1.x) pts.push({ x: p1.x, y: p1.y });
    } else if (route === "hv") {
      pts.push({ x: p1.x, y: p0.y });
      pts.push({ x: p1.x, y: p1.y });
    } else if (route === "vh") {
      pts.push({ x: p0.x, y: p1.y });
      pts.push({ x: p1.x, y: p1.y });
    } else if (route === "hvh") {
      const mid = (p0.x + p1.x) / 2;
      pts.push({ x: mid, y: p0.y });
      pts.push({ x: mid, y: p1.y });
      pts.push({ x: p1.x, y: p1.y });
    } else if (route === "vhv") {
      const mid = (p0.y + p1.y) / 2;
      pts.push({ x: p0.x, y: mid });
      pts.push({ x: p1.x, y: mid });
      pts.push({ x: p1.x, y: p1.y });
    } else {
      pts.push({ x: p1.x, y: p1.y });
    }

    // collapse duplicate consecutive points
    const clean = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = clean[clean.length - 1];
      const b = pts[i];
      if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5) clean.push(b);
    }
    return clean;
  }

  /** Deterministic wobble so edges look hand-inked (stable per endpoint). */
  function wobble(x, y, amt = 1.6) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const f = n - Math.floor(n);
    return (f - 0.5) * 2 * amt;
  }

  /** Polyline → path with rounded elbows + slight sketch jitter. */
  function roundedPath(pts, r = 12) {
    if (pts.length < 2) return "";
    // jitter intermediate corners a bit
    const j = pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) return p;
      return {
        x: p.x + wobble(p.x, p.y, 2.2),
        y: p.y + wobble(p.y, p.x, 2.2),
      };
    });
    if (j.length === 2) {
      const mid = {
        x: (j[0].x + j[1].x) / 2 + wobble(j[0].x, j[1].y, 3),
        y: (j[0].y + j[1].y) / 2 + wobble(j[1].x, j[0].y, 3),
      };
      return `M ${j[0].x} ${j[0].y} Q ${mid.x} ${mid.y} ${j[1].x} ${j[1].y}`;
    }

    let d = `M ${j[0].x} ${j[0].y}`;
    for (let i = 1; i < j.length - 1; i++) {
      const prev = j[i - 1];
      const curr = j[i];
      const next = j[i + 1];
      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const rr = Math.min(r, len1 / 2, len2 / 2);
      const before = {
        x: curr.x - (v1x / len1) * rr,
        y: curr.y - (v1y / len1) * rr,
      };
      const after = {
        x: curr.x + (v2x / len2) * rr,
        y: curr.y + (v2y / len2) * rr,
      };
      d += ` L ${before.x} ${before.y} Q ${curr.x} ${curr.y} ${after.x} ${after.y}`;
    }
    const last = j[j.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  function pathMid(pts) {
    if (!pts.length) return { x: 0, y: 0 };
    // longest segment midpoint (usually the main run)
    let best = 0;
    let mid = pts[0];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len >= best) {
        best = len;
        mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    }
    return mid;
  }

  function markerId(color, open) {
    const key = (open ? "o-" : "f-") + color.replace("#", "");
    return `m-${key}`;
  }

  function buildMarkers(colors) {
    const uniq = [...new Set(colors)];
    return uniq
      .map((color) => {
        const filled = el(
          "marker",
          {
            id: markerId(color, false),
            viewBox: "0 0 12 12",
            refX: 10.2,
            refY: 6,
            markerWidth: 8.5,
            markerHeight: 8.5,
            orient: "auto",
            markerUnits: "userSpaceOnUse",
          },
          el("path", {
            d: "M1.2 1.4 L10.4 6 L1.2 10.6 Z",
            fill: color,
          }),
        );
        const open = el(
          "marker",
          {
            id: markerId(color, true),
            viewBox: "0 0 12 12",
            refX: 10.2,
            refY: 6,
            markerWidth: 8.5,
            markerHeight: 8.5,
            orient: "auto",
            markerUnits: "userSpaceOnUse",
          },
          el("path", {
            d: "M1.5 1.6 L10 6 L1.5 10.4",
            fill: "none",
            stroke: color,
            "stroke-width": 1.7,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
          }),
        );
        return filled + open;
      })
      .join("");
  }

  function defs(markerColors) {
    return el(
      "defs",
      {},
      [
        buildMarkers(markerColors),
        el(
          "filter",
          { id: "node-shadow", x: "-25%", y: "-25%", width: "150%", height: "150%" },
          el("feDropShadow", {
            dx: 0,
            dy: 1.5,
            stdDeviation: 1.5,
            "flood-opacity": darkMode() ? 0.35 : 0.1,
          }),
        ),
      ].join(""),
    );
  }

  // 16×16 stroke icons
  const icons = {
    bot: el("g", { class: "node-icon" }, [
      el("rect", { x: 1, y: 3, width: 14, height: 11, rx: 3 }),
      el("circle", { cx: 6, cy: 8, r: 1.2, fill: "currentColor", stroke: "none" }),
      el("circle", { cx: 10, cy: 8, r: 1.2, fill: "currentColor", stroke: "none" }),
      el("path", { d: "M8 1 v2" }),
    ].join("")),
    terminal: el("g", { class: "node-icon" }, [
      el("rect", { x: 1, y: 2, width: 14, height: 12, rx: 2 }),
      el("path", { d: "M4 6 l2 2 l-2 2" }),
      el("path", { d: "M8 10 h4" }),
    ].join("")),
    cloud: el("g", { class: "node-icon" }, [
      el("path", {
        d: "M5 12h7a3 3 0 0 0 .2-6 4 4 0 0 0-7.6-1.2A2.8 2.8 0 0 0 5 12z",
      }),
    ].join("")),
    db: el("g", { class: "node-icon" }, [
      el("ellipse", { cx: 8, cy: 4, rx: 6, ry: 2.2 }),
      el("path", { d: "M2 4 v8 c0 1.2 2.7 2.2 6 2.2 s6-1 6-2.2 V4" }),
      el("path", { d: "M2 8 c0 1.2 2.7 2.2 6 2.2 s6-1 6-2.2" }),
    ].join("")),
    lock: el("g", { class: "node-icon" }, [
      el("rect", { x: 3, y: 7, width: 10, height: 7, rx: 1.5 }),
      el("path", { d: "M5.5 7 V5.5 a2.5 2.5 0 0 1 5 0 V7" }),
    ].join("")),
    eye: el("g", { class: "node-icon" }, [
      el("path", {
        d: "M1.5 8 s2.8-4.5 6.5-4.5 S14.5 8 14.5 8 s-2.8 4.5-6.5 4.5 S1.5 8 1.5 8z",
      }),
      el("circle", { cx: 8, cy: 8, r: 1.8 }),
    ].join("")),
    box: el("g", { class: "node-icon" }, [
      el("path", { d: "M2 5 l6-3 6 3 v7 l-6 3 -6-3z" }),
      el("path", { d: "M2 5 l6 3 6-3" }),
      el("path", { d: "M8 8 v7" }),
    ].join("")),
    share: el("g", { class: "node-icon" }, [
      el("circle", { cx: 4, cy: 8, r: 2 }),
      el("circle", { cx: 12, cy: 4, r: 2 }),
      el("circle", { cx: 12, cy: 12, r: 2 }),
      el("path", { d: "M5.8 7 l4.4-2.4 M5.8 9 l4.4 2.4" }),
    ].join("")),
  };

  function nodeRect(n) {
    const accentColor = accent(n.tone || "indigo");
    // uneven “hand-cut” corner radii
    const r = n.r ?? 14 + Math.abs(wobble(n.x, n.y, 4));
    const jx = wobble(n.x, n.y, 1.2);
    const jy = wobble(n.y, n.x, 1.2);
    const x = n.x + jx;
    const y = n.y + jy;
    const icon = n.icon
      ? el(
          "g",
          {
            transform: `translate(${x + 14}, ${y + n.h / 2 - 8})`,
            color: accentColor,
          },
          n.icon,
        )
      : "";
    const textX = n.icon ? x + 38 : x + 16;
    const titleY = n.sub ? y + n.h / 2 - 4 : y + n.h / 2 + 5;
    const title = el(
      "text",
      { class: "node-title", x: textX, y: titleY },
      esc(n.title),
    );
    const sub = n.sub
      ? el("text", { class: "node-sub", x: textX, y: y + n.h / 2 + 14 }, esc(n.sub))
      : "";
    // paper fill tint by tone
    const fills = {
      indigo: "#e8f3ff",
      cyan: "#e6f7fa",
      amber: "#fff3c4",
      emerald: "#eefaf1",
      fuchsia: "#f6edff",
      rose: "#ffe8e3",
      slate: "#f4f0e8",
    };
    const fill = fills[n.tone] || fills.slate;
    return el(
      "g",
      { class: "node", "data-id": n.id },
      [
        el("rect", {
          class: "node-shell",
          x,
          y,
          width: n.w,
          height: n.h,
          rx: r,
          fill,
        }),
        el("rect", {
          x: x + 2,
          y: y + 8,
          width: 4,
          height: n.h - 16,
          rx: 2,
          fill: accentColor,
          stroke: "#2a241c",
          "stroke-width": 1.2,
        }),
        icon,
        title,
        sub,
      ].join(""),
    );
  }

  function diamond(n) {
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    const hw = n.w / 2;
    const hh = n.h / 2;
    const points = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
    const tone = accent(n.tone || "amber");
    return el(
      "g",
      { class: "diamond", "data-id": n.id },
      [
        el("polygon", {
          class: "diamond-shell",
          points,
          stroke: tone,
          "stroke-width": 1.5,
        }),
        el("text", { class: "diamond-title", x: cx, y: cy + 4 }, esc(n.title)),
      ].join(""),
    );
  }

  function edge(e, byId) {
    const a = byId[e.from];
    const b = byId[e.to];
    if (!a || !b) return "";
    const pts = orthoPoints(a, b, e.route || "auto", e.fromSide, e.toSide);
    const d = roundedPath(pts, e.radius ?? 11);
    const mid = pathMid(pts);
    const color = edgeInk(e.color);
    const cls = ["edge", e.strong && "strong", e.dashed && "dashed"].filter(Boolean).join(" ");
    const marker = `url(#${markerId(color, !!e.open)})`;

    let label = "";
    if (e.label) {
      const tw = Math.max(32, e.label.length * 6.4 + 16);
      const th = 22;
      // nudge labels off long vertical segments slightly
      const isVert =
        pts.length >= 2 && Math.abs(pts[0].x - pts[pts.length - 1].x) < 8;
      const lx = mid.x + (isVert ? 14 : 0);
      const ly = mid.y;
      label = [
        el("rect", {
          class: "edge-label-bg",
          x: lx - tw / 2,
          y: ly - th / 2,
          width: tw,
          height: th,
          rx: 7,
        }),
        el(
          "text",
          {
            class: "edge-label",
            x: lx,
            y: ly + 4,
            "text-anchor": "middle",
          },
          esc(e.label),
        ),
      ].join("");
    }

    return el(
      "g",
      { class: "edge-group" },
      [
        // hit-friendly wider invisible stroke optional — skip for clarity
        el("path", {
          class: cls,
          d,
          stroke: color,
          "marker-end": marker,
        }),
        label,
      ].join(""),
    );
  }

  function lane(l) {
    return [
      el("rect", {
        class: "lane",
        x: l.x,
        y: l.y,
        width: l.w,
        height: l.h,
        rx: 18,
      }),
      el("text", { class: "lane-title", x: l.x + 18, y: l.y + 24 }, esc(l.title)),
    ].join("");
  }

  function renderFlow(host, model) {
    const pad = model.pad ?? 10;
    const w = model.width;
    const h = model.height;
    const byId = Object.fromEntries(model.nodes.map((n) => [n.id, n]));

    const nodes = model.nodes.map((n) => ({
      ...n,
      icon: n.iconKey ? icons[n.iconKey] : n.icon,
    }));

    const markerColors = (model.edges || []).map((e) => edgeInk(e.color));
    markerColors.push(edgeInk());

    const lanes = (model.lanes || []).map(lane).join("");
    const edges = (model.edges || []).map((e) => edge(e, byId)).join("");
    const nodeSvg = nodes
      .map((n) => (n.shape === "diamond" ? diamond(n) : nodeRect(n)))
      .join("");

    host.innerHTML = el(
      "svg",
      {
        viewBox: `${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`,
        role: "presentation",
        xmlns: "http://www.w3.org/2000/svg",
      },
      [defs(markerColors), lanes, edges, nodeSvg].join(""),
    );
  }

  function renderSequence(host, model) {
    const actors = model.actors;
    const messages = model.messages;
    const top = 58;
    const rowH = 46;
    const left = 48;
    const colW = Math.max(148, (model.width - left * 2) / Math.max(actors.length, 1));
    const width = model.width || left * 2 + colW * actors.length;
    const height = top + 28 + messages.length * rowH + 36;

    const xs = Object.fromEntries(
      actors.map((a, i) => [a.id, left + colW * i + colW / 2]),
    );

    const ink = edgeInk("slate");
    const colors = [ink, edgeInk("indigo"), edgeInk("emerald")];

    const actorHeads = actors
      .map((a, i) => {
        const x = xs[a.id];
        const bw = 118;
        const tone = accent(["indigo", "cyan", "amber", "emerald", "fuchsia"][i % 5]);
        return [
          el("rect", {
            class: "node-shell",
            x: x - bw / 2,
            y: 14,
            width: bw,
            height: 34,
            rx: 11,
            filter: "url(#node-shadow)",
          }),
          el("rect", {
            x: x - bw / 2,
            y: 22,
            width: 3.5,
            height: 18,
            rx: 2,
            fill: tone,
          }),
          el(
            "text",
            { class: "actor-title", x, y: 36, "text-anchor": "middle" },
            esc(a.title),
          ),
          el("line", {
            class: "lifeline",
            x1: x,
            y1: 52,
            x2: x,
            y2: height - 14,
          }),
        ].join("");
      })
      .join("");

    const msgs = messages
      .map((m, i) => {
        const y = top + 18 + i * rowH;
        const x1 = xs[m.from];
        const x2 = xs[m.to];
        const self = m.from === m.to;
        const color = edgeInk(m.color || (m.open ? "slate" : "indigo"));
        let path;
        if (self) {
          const pts = [
            { x: x1, y },
            { x: x1 + 40, y },
            { x: x1 + 40, y: y + 20 },
            { x: x1, y: y + 20 },
          ];
          path = roundedPath(pts, 8);
        } else {
          path = `M ${x1} ${y} L ${x2} ${y}`;
        }
        const midX = self ? x1 + 48 : (x1 + x2) / 2;
        const marker = `url(#${markerId(color, !!m.open)})`;
        const cls = ["edge", m.dashed && "dashed", "strong"].filter(Boolean).join(" ");

        let note = "";
        if (m.note) {
          const nw = Math.min(210, m.note.length * 6.6 + 18);
          note = [
            el("rect", {
              class: "note-box",
              x: midX + 12,
              y: y - 24,
              width: nw,
              height: 22,
              rx: 6,
            }),
            el("text", { class: "note-text", x: midX + 20, y: y - 9 }, esc(m.note)),
          ].join("");
        }

        return el(
          "g",
          {},
          [
            el("path", {
              class: cls,
              d: path,
              stroke: color,
              "marker-end": marker,
            }),
            el(
              "text",
              {
                class: "msg-label",
                x: midX,
                y: self ? y - 6 : y - 9,
                "text-anchor": self ? "start" : "middle",
              },
              esc(m.label),
            ),
            note,
          ].join(""),
        );
      })
      .join("");

    host.innerHTML = el(
      "svg",
      {
        viewBox: `0 0 ${width} ${height}`,
        role: "presentation",
        xmlns: "http://www.w3.org/2000/svg",
      },
      [defs(colors), actorHeads, msgs].join(""),
    );
  }

  global.Diagram = {
    renderFlow,
    renderSequence,
    icons,
    accent,
  };
})(window);
