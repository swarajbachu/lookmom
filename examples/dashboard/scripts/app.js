(function () {
  const data = window.ARTIFACT_DATA;
  let range = "7";

  const kpis = document.getElementById("kpis");
  const bar = document.getElementById("bar-chart");
  const donut = document.getElementById("donut-chart");
  const legend = document.getElementById("legend");
  const funnel = document.getElementById("funnel");
  const stamp = document.getElementById("stamp");

  function render() {
    kpis.innerHTML = data.kpis[range]
      .map(
        (k) =>
          `<div class="stat"><span class="label">${k.label}</span>` +
          `<span class="value">${k.value}</span>` +
          `<span class="delta">${k.delta}</span></div>`,
      )
      .join("");

    Charts.barChart(bar, data.bars[range]);
    Charts.donutChart(donut, data.channels[range]);
    Charts.legend(legend, data.channels[range]);
    Charts.funnelChart(funnel, data.funnel[range]);
  }

  document.querySelectorAll(".filters button").forEach((btn) => {
    btn.addEventListener("click", () => {
      range = btn.getAttribute("data-range") || "7";
      document.querySelectorAll(".filters button").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      render();
    });
  });

  stamp.textContent = new Date().toISOString().slice(0, 10);
  render();
})();
