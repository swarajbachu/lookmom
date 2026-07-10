/**
 * Tiny CSP-safe chart helpers (SVG only — no canvas, no CDN).
 * Good enough for dashboards, decks, and status pages.
 */
(function (global) {
  const SERIES = ["#4f46e5", "#06b6d4", "#f59e0b", "#10b981", "#a855f7", "#f43f5e"];

  function el(name, attrs, children) {
    let out = `<${name}`;
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      out += ` ${k}="${String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
    }
    if (children == null || children === "") return `${out} />`;
    return `${out}>${children}</${name}>`;
  }

  function barChart(container, items) {
    const w = 560;
    const h = 220;
    const pad = { t: 16, r: 8, b: 28, l: 8 };
    const max = Math.max(...items.map((d) => d.value), 1);
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const gap = 10;
    const bw = (innerW - gap * (items.length - 1)) / items.length;

    const bars = items
      .map((d, i) => {
        const bh = (d.value / max) * innerH;
        const x = pad.l + i * (bw + gap);
        const y = pad.t + innerH - bh;
        return (
          `<g class="bar">` +
          el("rect", {
            x,
            y,
            width: bw,
            height: Math.max(bh, 2),
            rx: 6,
            fill: SERIES[i % SERIES.length],
          }) +
          el(
            "text",
            {
              class: "bar-value",
              x: x + bw / 2,
              y: y - 6,
              "text-anchor": "middle",
            },
            String(d.value),
          ) +
          el(
            "text",
            {
              class: "bar-label",
              x: x + bw / 2,
              y: h - 8,
              "text-anchor": "middle",
            },
            d.label,
          ) +
          `</g>`
        );
      })
      .join("");

    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="presentation">${bars}</svg>`;
  }

  function donutChart(container, items) {
    const size = 180;
    const cx = size / 2;
    const cy = size / 2;
    const r = 68;
    const stroke = 22;
    const total = items.reduce((s, d) => s + d.value, 0) || 1;
    const C = 2 * Math.PI * r;
    let offset = 0;

    const rings = items
      .map((d, i) => {
        const len = (d.value / total) * C;
        const dash = `${len} ${C - len}`;
        const node = el("circle", {
          cx,
          cy,
          r,
          fill: "none",
          stroke: SERIES[i % SERIES.length],
          "stroke-width": stroke,
          "stroke-dasharray": dash,
          "stroke-dashoffset": -offset,
          "stroke-linecap": "butt",
          transform: `rotate(-90 ${cx} ${cy})`,
        });
        offset += len;
        return node;
      })
      .join("");

    const center =
      el(
        "text",
        {
          x: cx,
          y: cy - 2,
          "text-anchor": "middle",
          fill: "currentColor",
          "font-size": 22,
          "font-weight": 700,
          "font-variant-numeric": "tabular-nums",
        },
        String(total) + "%",
      ) +
      el(
        "text",
        {
          x: cx,
          y: cy + 16,
          "text-anchor": "middle",
          fill: "currentColor",
          "font-size": 11,
          opacity: 0.55,
        },
        "mix",
      );

    container.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="180" height="180" role="presentation">${rings}${center}</svg>`;
  }

  function funnelChart(container, steps) {
    const w = 960;
    const h = 160;
    const max = steps[0]?.value || 1;
    const rowH = 34;
    const gap = 8;
    const left = 120;
    const maxBar = w - left - 24;

    const body = steps
      .map((s, i) => {
        const bw = Math.max(48, (s.value / max) * maxBar);
        const y = 12 + i * (rowH + gap);
        const x = left + (maxBar - bw) / 2;
        const pct = ((s.value / max) * 100).toFixed(1);
        return (
          `<g class="funnel-step">` +
          el("text", { class: "funnel-label", x: 0, y: y + 22 }, s.label) +
          el("rect", {
            x,
            y,
            width: bw,
            height: rowH,
            rx: 8,
            fill: SERIES[i % SERIES.length],
            opacity: 1 - i * 0.08,
          }) +
          el(
            "text",
            {
              class: "funnel-sub",
              x: x + bw / 2,
              y: y + 22,
              "text-anchor": "middle",
              fill: "#fff",
              "font-weight": 600,
            },
            `${s.value.toLocaleString()} · ${pct}%`,
          ) +
          `</g>`
        );
      })
      .join("");

    const totalH = 12 + steps.length * (rowH + gap);
    container.innerHTML = `<svg viewBox="0 0 ${w} ${totalH}" role="presentation">${body}</svg>`;
  }

  function legend(listEl, items) {
    listEl.innerHTML = items
      .map(
        (d, i) =>
          `<li><span class="swatch" style="background:${SERIES[i % SERIES.length]}"></span>` +
          `${d.label} <span class="n">${d.value}%</span></li>`,
      )
      .join("");
  }

  global.Charts = { barChart, donutChart, funnelChart, legend, SERIES };
})(window);
