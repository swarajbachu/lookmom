/** Tiny CSP-safe SVG bars for the index cost comparison. */
(function (global) {
  function barCompare(host, items) {
    const w = 920;
    const h = 120;
    const pad = { l: 8, r: 8, t: 12, b: 28 };
    const max = Math.max(...items.map((d) => d.value), 1);
    const gap = 16;
    const bw = (w - pad.l - pad.r - gap * (items.length - 1)) / items.length;
    const colors = ["#5c5346", "#e85d4c", "#3faf6c"];

    const bars = items
      .map((d, i) => {
        const bh = Math.max(6, (d.value / max) * (h - pad.t - pad.b));
        const x = pad.l + i * (bw + gap);
        const y = pad.t + (h - pad.t - pad.b) - bh;
        const fill = d.color || colors[i % colors.length];
        const rx = 10 + (i % 3) * 3;
        return (
          `<g>` +
          `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${rx}" fill="${fill}" stroke="#2a241c" stroke-width="2.2" />` +
          `<text x="${x + bw / 2}" y="${y - 8}" text-anchor="middle" fill="#2a241c" font-size="16" font-family="Caveat, Patrick Hand, cursive" font-weight="700">${d.value.toLocaleString()}</text>` +
          `<text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle" fill="#6b5e4e" font-size="14" font-family="Patrick Hand, cursive">${d.label}</text>` +
          `</g>`
        );
      })
      .join("");

    host.innerHTML =
      `<svg viewBox="0 0 ${w} ${h}" role="presentation" style="color:inherit">` +
      bars +
      `</svg>`;
  }

  global.MiniCharts = { barCompare };
})(window);
