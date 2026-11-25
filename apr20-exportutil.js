/**
 * exportUtils.js
 * Browser-compatible export helpers for Chicken4U dashboard.
 * Uses pptxgenjs (CDN) for PowerPoint and SheetJS (CDN) for Excel.
 * Drop this file into src/ and import the two functions.
 *
 * CDN scripts must be loaded in index.html (or Zoho Page HTML):
 *   <script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
 */

/* ─── Palette (mirrors App.jsx C object) ───────────── */
const HEX = {
  pri: "D97B0F",
  amber: "C47E0C",
  green: "1F7A42",
  sky: "0369A1",
  red: "C0392B",
  purple: "7C3AED",
  pink: "BE185D",
  brownMd: "7A5230",
  bg: "FFF8EE",
  surf: "FFFFFF",
  text: "2A1A04",
  textMd: "6B4A22",
  textSf: "A87842",
  bord: "F5D9A8",
};

/* ─── Helpers ───────────────────────────────────────── */
const fmt = (n) => Number(n ?? 0).toLocaleString("en-IN");

function nowLabel() {
  return new Date().toLocaleString("en-IN", {
    month: "long", year: "numeric",
  });
}

/* ══════════════════════════════════════════════════════
   EXCEL EXPORT
   Produces a multi-sheet .xlsx with all dashboard data.
══════════════════════════════════════════════════════ */
export function exportToExcel(dashData, regionName = "All Regions") {
  const XLSX = window.XLSX;
  if (!XLSX) { alert("SheetJS not loaded. Add XLSX CDN script to index.html."); return; }

  const wb = XLSX.utils.book_new();
  const month = nowLabel();

  /* ── Helper: append a styled sheet ── */
  function addSheet(name, rows) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Auto column widths (rough)
    ws["!cols"] = rows[0]?.map((_, i) => ({
      wch: Math.max(
        14,
        ...rows.map((r) => String(r[i] ?? "").length + 2)
      ),
    }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  /* ── 1. Summary ── */
  addSheet("Summary", [
    ["Chicken4U Dashboard Export"],
    [`Region: ${regionName}`, `Period: ${month}`],
    [],
    ["Metric", "Value"],
    ["Total MUOs", dashData?.muo?.total ?? 0],
    ["Male MUOs", dashData?.muo?.male ?? 0],
    ["Female MUOs", dashData?.muo?.female ?? 0],
    ["Total SSPs", dashData?.muo?.sspTotal ?? 0],
    ["Total Certified", dashData?.learners ?? 0],
    ["Total Mortality", dashData?.weekly?.mortality ?? 0],
    ["Feed Used (kg)", dashData?.weekly?.feedKg ?? 0],
  ]);

  /* ── 2. Chick Distribution ── */
  const s = dashData?.sales ?? {};
  addSheet("Chick Distribution", [
    ["Chicken4U – Chick Distribution", "", `Period: ${month}`],
    [],
    ["Category", "Ordered", "Delivered", "Pending"],
    ["Grangers", s.grangers ?? 0, s.grangersDelivered ?? 0, s.grangersPending ?? 0],
    ["Layers", s.layersOrdered ?? 0, s.layersDelivered ?? 0, s.layersPending ?? 0],
    ["Broilers", s.broilersOrdered ?? 0, s.broilersDelivered ?? 0, s.broilersPending ?? 0],
    [],
    ["TOTALS",
      (s.grangers ?? 0) + (s.layersOrdered ?? 0) + (s.broilersOrdered ?? 0),
      (s.grangersDelivered ?? 0) + (s.layersDelivered ?? 0) + (s.broilersDelivered ?? 0),
      (s.grangersPending ?? 0) + (s.layersPending ?? 0) + (s.broilersPending ?? 0),
    ],
  ]);

  /* ── 3. Sales Summary ── */
  addSheet("Sales Summary", [
    ["Chicken4U – Sales Summary", `Period: ${month}`],
    [],
    ["Product", "Units Sold"],
    ["Grangers", s.grangers ?? 0],
    ["Layers", s.layers ?? 0],
    ["Broilers", s.broilers ?? 0],
    [],
    ["Total", (s.grangers ?? 0) + (s.layers ?? 0) + (s.broilers ?? 0)],
  ]);

  /* ── 4. Layer Breeds ── */
  const layerRows = [
    ["Breed", "Ordered", "Delivered", "Pending"],
    ...Object.keys(s.layerBreeds ?? {}).map((b) => [
      b,
      s.layerBreeds?.[b] ?? 0,
      s.layerBreedsDel?.[b] ?? 0,
      s.layerBreedsPend?.[b] ?? 0,
    ]),
  ];
  if (layerRows.length > 1) addSheet("Layer Breeds", [["Chicken4U – Layer Breeds", `Period: ${month}`], [], ...layerRows]);

  /* ── 5. Broiler Breeds ── */
  const broilerRows = [
    ["Breed", "Ordered", "Delivered", "Pending"],
    ...Object.keys(s.broilerBreeds ?? {}).map((b) => [
      b,
      s.broilerBreeds?.[b] ?? 0,
      s.broilerBreedsDel?.[b] ?? 0,
      s.broilerBreedsPend?.[b] ?? 0,
    ]),
  ];
  if (broilerRows.length > 1) addSheet("Broiler Breeds", [["Chicken4U – Broiler Breeds", `Period: ${month}`], [], ...broilerRows]);

  /* ── Save ── */
  XLSX.writeFile(wb, `Chicken4U_Dashboard_${regionName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}


/* ══════════════════════════════════════════════════════
   POWERPOINT EXPORT
   Produces a branded .pptx with 5 slides.
══════════════════════════════════════════════════════ */
export async function exportToPptx(dashData, regionName = "All Regions") {
  const PptxGenJS = window.PptxGenJS;
  if (!PptxGenJS) { alert("PptxGenJS not loaded. Add pptxgenjs CDN script to index.html."); return; }

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Chicken4U Dashboard";
  pres.author = "WAFAD Group";

  const month = nowLabel();
  const s = dashData?.sales ?? {};
  const muo = dashData?.muo ?? {};
  const weekly = dashData?.weekly ?? {};

  /* ── Shared style helpers ── */
  const DARK_BG = "1A0D02";
  const CARD_BG = "FFF4E0";
  const makeShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.12 });

  /* ── Title text style ── */
  const titleOpts = (color = HEX.surf, size = 38) =>
    ({ fontSize: size, bold: true, color, fontFace: "Trebuchet MS" });
  const subOpts = (color = HEX.textSf, size = 14) =>
    ({ fontSize: size, color, fontFace: "Calibri" });
  const labelOpts = (color = HEX.textMd, size = 11) =>
    ({ fontSize: size, color, fontFace: "Calibri", bold: true });
  const valOpts = (color = HEX.pri, size = 28) =>
    ({ fontSize: size, color, bold: true, fontFace: "Trebuchet MS" });

  /* ══ SLIDE 1 – Title ══ */
  {
    const sl = pres.addSlide();
    sl.background = { color: DARK_BG };

    // Left accent bar
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.18, h: 5.625,
      fill: { color: HEX.pri }, line: { color: HEX.pri },
    });

    // Orange bottom strip
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 4.8, w: 10, h: 0.825,
      fill: { color: HEX.pri }, line: { color: HEX.pri },
    });

    sl.addText("Chicken4U", {
      x: 0.45, y: 1.1, w: 9, h: 0.9,
      ...titleOpts(HEX.surf, 52), charSpacing: 2,
    });
    sl.addText("Overview Dashboard", {
      x: 0.45, y: 2.0, w: 9, h: 0.6,
      ...titleOpts(HEX.pri, 28),
    });
    sl.addText(`${month}  ·  Region: ${regionName}`, {
      x: 0.45, y: 2.65, w: 9, h: 0.4,
      ...subOpts(HEX.textSf, 15),
    });
    sl.addText("WAFAD GROUP – Real-Time Poultry Data", {
      x: 0.3, y: 4.85, w: 7, h: 0.5,
      fontSize: 13, color: HEX.surf, fontFace: "Calibri", bold: false,
    });
  }

  /* ══ SLIDE 2 – KPI Overview ══ */
  {
    const sl = pres.addSlide();
    sl.background = { color: HEX.bg };

    // Header bar
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.7,
      fill: { color: HEX.pri }, line: { color: HEX.pri },
    });
    sl.addText("KPI Overview", {
      x: 0.3, y: 0, w: 9, h: 0.7, margin: 0,
      fontSize: 20, bold: true, color: HEX.surf, fontFace: "Trebuchet MS", valign: "middle",
    });
    sl.addText(`${month}  ·  ${regionName}`, {
      x: 6, y: 0, w: 3.7, h: 0.7, margin: 0,
      fontSize: 11, color: "FFE0A0", fontFace: "Calibri", align: "right", valign: "middle",
    });

    const kpis = [
      { label: "Total MUOs", value: fmt(muo.total ?? 0), color: HEX.pri },
      { label: "Total Certified", value: fmt(dashData?.learners ?? 0), color: HEX.sky },
      { label: "Chicks Ordered", value: fmt(s.grangers ?? 0 + s.layersOrdered ?? 0 + s.broilersOrdered ?? 0), color: HEX.amber },
      { label: "Feed Used (kg)", value: fmt(weekly.feedKg ?? 0), color: HEX.brownMd },
      { label: "Total Mortality", value: fmt(weekly.mortality ?? 0), color: HEX.red },
      { label: "Total SSPs", value: fmt(muo.sspTotal ?? 0), color: HEX.green },
    ];

    // 3-column × 2-row grid
    kpis.forEach((k, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.25 + col * 3.25;
      const y = 0.9 + row * 2.15;

      sl.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 3.05, h: 1.85,
        fill: { color: HEX.surf }, line: { color: HEX.bord },
        shadow: makeShadow(),
      });
      // Color top accent
      sl.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 3.05, h: 0.07,
        fill: { color: k.color }, line: { color: k.color },
      });
      sl.addText(k.label.toUpperCase(), {
        x: x + 0.15, y: y + 0.18, w: 2.75, h: 0.3,
        fontSize: 9, color: HEX.textSf, fontFace: "Calibri", bold: true, charSpacing: 1,
      });
      sl.addText(k.value, {
        x: x + 0.1, y: y + 0.55, w: 2.85, h: 0.75,
        fontSize: 30, bold: true, color: k.color, fontFace: "Trebuchet MS",
      });
    });
  }

  /* ══ SLIDE 3 – MUO Gender Split ══ */
  {
    const sl = pres.addSlide();
    sl.background = { color: HEX.bg };

    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.7,
      fill: { color: HEX.purple }, line: { color: HEX.purple },
    });
    sl.addText("MUO Gender Split", {
      x: 0.3, y: 0, w: 9, h: 0.7, margin: 0,
      fontSize: 20, bold: true, color: HEX.surf, fontFace: "Trebuchet MS", valign: "middle",
    });

    const total = muo.total ?? 0;
    const male = muo.male ?? 0;
    const female = muo.female ?? 0;
    const femalePct = total > 0 ? ((female / total) * 100).toFixed(1) : "0.0";
    const malePct = total > 0 ? ((male / total) * 100).toFixed(1) : "0.0";

    const cards = [
      { label: "Female MUOs", value: fmt(female), pct: femalePct + "%", color: HEX.pink },
      { label: "Male MUOs", value: fmt(male), pct: malePct + "%", color: HEX.sky },
      { label: "Total MUOs", value: fmt(total), pct: "100%", color: HEX.purple },
    ];

    cards.forEach((c, i) => {
      const x = 0.4 + i * 3.1;
      sl.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.0, w: 2.85, h: 3.9,
        fill: { color: HEX.surf }, line: { color: c.color + "44" },
        shadow: makeShadow(),
      });
      sl.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.0, w: 2.85, h: 0.08,
        fill: { color: c.color }, line: { color: c.color },
      });
      sl.addText(c.label.toUpperCase(), {
        x: x + 0.15, y: 1.18, w: 2.55, h: 0.3,
        fontSize: 9, color: c.color, fontFace: "Calibri", bold: true, charSpacing: 1,
      });
      sl.addText(c.value, {
        x: x + 0.1, y: 1.55, w: 2.65, h: 0.9,
        fontSize: 38, bold: true, color: c.color, fontFace: "Trebuchet MS",
      });
      sl.addText(c.pct + " of total", {
        x: x + 0.15, y: 2.55, w: 2.55, h: 0.4,
        fontSize: 13, color: HEX.textSf, fontFace: "Calibri",
      });
    });

    // Bar chart
    pres.charts && sl.addChart(pres.charts.BAR, [
      {
        name: "MUO Count",
        labels: ["Female", "Male"],
        values: [female, male],
      },
    ], {
      x: 0.4, y: 3.3, w: 9.2, h: 2.0,
      barDir: "col",
      chartColors: [HEX.pink, HEX.sky],
      chartArea: { fill: { color: "FFFFFF" } },
      showValue: true,
      dataLabelColor: HEX.text,
      catAxisLabelColor: HEX.textSf,
      valAxisLabelColor: HEX.textSf,
      catGridLine: { style: "none" },
      valGridLine: { color: "E2E8F0", size: 0.5 },
      showLegend: false,
    });
  }

  /* ══ SLIDE 4 – Chick Distribution ══ */
  {
    const sl = pres.addSlide();
    sl.background = { color: HEX.bg };

    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.7,
      fill: { color: HEX.amber }, line: { color: HEX.amber },
    });
    sl.addText("Chick Distribution", {
      x: 0.3, y: 0, w: 9, h: 0.7, margin: 0,
      fontSize: 20, bold: true, color: HEX.surf, fontFace: "Trebuchet MS", valign: "middle",
    });

    // Table
    const tableData = [
      [
        { text: "Category", options: { bold: true, color: HEX.surf, fill: { color: HEX.pri } } },
        { text: "Ordered", options: { bold: true, color: HEX.surf, fill: { color: HEX.pri } } },
        { text: "Delivered", options: { bold: true, color: HEX.surf, fill: { color: HEX.pri } } },
        { text: "Pending", options: { bold: true, color: HEX.surf, fill: { color: HEX.pri } } },
      ],
      ["Grangers", fmt(s.grangers ?? 0), fmt(s.grangersDelivered ?? 0), fmt(s.grangersPending ?? 0)],
      ["Layers", fmt(s.layersOrdered ?? 0), fmt(s.layersDelivered ?? 0), fmt(s.layersPending ?? 0)],
      ["Broilers", fmt(s.broilersOrdered ?? 0), fmt(s.broilersDelivered ?? 0), fmt(s.broilersPending ?? 0)],
    ];

    sl.addTable(tableData, {
      x: 0.5, y: 0.9, w: 9, h: 2.6,
      fontSize: 14, fontFace: "Calibri",
      color: HEX.text,
      border: { type: "solid", pt: 1, color: HEX.bord },
      fill: { color: HEX.surf },
      rowH: 0.55,
      colW: [2.5, 2.2, 2.2, 2.1],
    });

    // Bar chart
    sl.addChart(pres.charts.BAR, [
      { name: "Ordered", labels: ["Grangers", "Layers", "Broilers"], values: [s.grangers ?? 0, s.layersOrdered ?? 0, s.broilersOrdered ?? 0] },
      { name: "Delivered", labels: ["Grangers", "Layers", "Broilers"], values: [s.grangersDelivered ?? 0, s.layersDelivered ?? 0, s.broilersDelivered ?? 0] },
      { name: "Pending", labels: ["Grangers", "Layers", "Broilers"], values: [s.grangersPending ?? 0, s.layersPending ?? 0, s.broilersPending ?? 0] },
    ], {
      x: 0.5, y: 3.6, w: 9, h: 1.8,
      barDir: "col", barGrouping: "clustered",
      chartColors: [HEX.pri, HEX.green, HEX.red],
      chartArea: { fill: { color: "FFFFFF" } },
      showValue: true,
      dataLabelFontSize: 9,
      catAxisLabelColor: HEX.textSf,
      valAxisLabelColor: HEX.textSf,
      catGridLine: { style: "none" },
      valGridLine: { color: "E2E8F0", size: 0.5 },
      legendPos: "r",
      showLegend: true,
      legendFontSize: 10,
    });
  }

  /* ══ SLIDE 5 – Sales Summary ══ */
  {
    const sl = pres.addSlide();
    sl.background = { color: DARK_BG };

    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.7,
      fill: { color: HEX.pri }, line: { color: HEX.pri },
    });
    sl.addText("Sales Summary", {
      x: 0.3, y: 0, w: 9, h: 0.7, margin: 0,
      fontSize: 20, bold: true, color: HEX.surf, fontFace: "Trebuchet MS", valign: "middle",
    });
    sl.addText(`${month}  ·  ${regionName}`, {
      x: 6, y: 0, w: 3.7, h: 0.7, margin: 0,
      fontSize: 11, color: "FFE0A0", fontFace: "Calibri", align: "right", valign: "middle",
    });

    const sales = [
      { label: "Grangers Sold", value: s.grangers ?? 0, color: HEX.pri },
      { label: "Layers Sold", value: s.layers ?? 0, color: HEX.green },
      { label: "Broilers Sold", value: s.broilers ?? 0, color: HEX.sky },
    ];

    sales.forEach((item, i) => {
      const x = 0.4 + i * 3.1;
      sl.addShape(pres.shapes.RECTANGLE, {
        x, y: 0.9, w: 2.9, h: 2.2,
        fill: { color: item.color + "22" }, line: { color: item.color + "55" },
        shadow: makeShadow(),
      });
      sl.addText(item.label.toUpperCase(), {
        x: x + 0.15, y: 1.05, w: 2.6, h: 0.3,
        fontSize: 9, color: item.color, fontFace: "Calibri", bold: true, charSpacing: 1,
      });
      sl.addText(fmt(item.value), {
        x: x + 0.1, y: 1.45, w: 2.7, h: 0.85,
        fontSize: 34, bold: true, color: item.color, fontFace: "Trebuchet MS",
      });
    });

    // Pie chart
    sl.addChart(pres.charts.PIE, [{
      name: "Sales",
      labels: ["Grangers", "Layers", "Broilers"],
      values: [s.grangers ?? 0, s.layers ?? 0, s.broilers ?? 0],
    }], {
      x: 0.5, y: 3.1, w: 9, h: 2.35,
      chartColors: [HEX.pri, HEX.green, HEX.sky],
      chartArea: { fill: { color: "1A0D02" } },
      dataLabelColor: HEX.surf,
      showPercent: true,
      showLegend: true,
      legendPos: "r",
      legendFontColor: HEX.surf,
      legendFontSize: 12,
    });
  }

  /* ── Save ── */
  await pres.writeFile({
    fileName: `Chicken4U_Dashboard_${regionName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pptx`,
  });
}

