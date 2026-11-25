/**
 * exportUtils.js  –  Chicken4U Dashboard
 * Exports ALL dashboard data to Excel (.xlsx) and PowerPoint (.pptx)
 *
 * ─── Installation (npm – no CDN scripts needed) ───────────────────────
 *   npm install pptxgenjs xlsx
 *
 *   Remove these two <script> tags from index.html:
 *     <script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/..."></script>
 *     <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/..."></script>
 */

import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";

/* ─── Slide geometry (16 × 9) ──────────────────────────────────────── */
const SLIDE_W = 10; // inches
const SLIDE_H = 5.625; // inches

const HDR_H = 0.68; // orange header bar height
const ACCENT_H = 0.04; // amber accent line beneath header
const HDR_TOT = HDR_H + ACCENT_H; // 0.72 in

const MARGIN_X = 0.4; // left / right margin
const MARGIN_B = 0.08; // bottom margin
const CONTENT_W = SLIDE_W - MARGIN_X * 2; // 9.20 in
const CONTENT_Y = HDR_TOT + 0.1; // 0.82 in – first content element

/**
 * Rows that fit on a FULL BODY slide (table starts at y ≈ 0.85).
 * Available: SLIDE_H − 0.85 − MARGIN_B ≈ 4.725 in
 * rowH = 0.32; hdrRow ≈ 0.36  →  (4.725 − 0.36) / 0.32 ≈ 13.6  → use 12
 */
const ROWS_PER_SLIDE = 12;

/**
 * Rows that fit on the PENDING SUMMARY slide (table starts at y ≈ 2.40).
 * Available: SLIDE_H − 2.40 − MARGIN_B ≈ 3.145 in
 * (3.145 − 0.36) / 0.32 ≈ 8.7  → use 8 (leaves room for "Continued" note)
 */
const PENDING_SUMMARY_ROWS = 8;

/* ─── Palette ───────────────────────────────────────────────────────── */
const HEX = {
  pri: "D97B0F",
  amber: "C47E0C",
  green: "1F7A42",
  sky: "0369A1",
  red: "C0392B",
  purple: "7C3AED",
  pink: "BE185D",
  brownMd: "7A5230",
  yellow: "F5C518",
  bg: "FFF8EE",
  surf: "FFFFFF",
  text: "2A1A04",
  textMd: "6B4A22",
  textSf: "A87842",
  bord: "F5D9A8",
  priLt: "FFF4E0",
  priDk: "A85E07",
};

/* ─── Utility helpers ───────────────────────────────────────────────── */
const n = (v) => Number(v ?? 0);
const fmt = (v) => n(v).toLocaleString("en-US");

const nowLabel = () =>
  new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
const fileDate = () => new Date().toISOString().slice(0, 10);
const safeFileName = (r) => (r ?? "All_Regions").replace(/\s+/g, "_");

/* ══════════════════════════════════════════════════════════════════════
   EXCEL  EXPORT
══════════════════════════════════════════════════════════════════════ */
export function exportToExcel(
  dashData,
  regionName = "All Regions",
  monthLabel = null,
) {
  // XLSX is imported at the top – no window.XLSX needed
  const wb = XLSX.utils.book_new();
  const month = monthLabel ?? nowLabel();
  const s = dashData?.sales ?? {};
  const muo = dashData?.muo ?? {};

  function ws(rows) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = (rows[0] ?? []).map((_, i) => ({
      wch: Math.max(14, ...rows.map((r) => String(r[i] ?? "").length + 2)),
    }));
    return sheet;
  }
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, ws(rows), name);

  const feedKgTotal = n(s.feedKgOrdered) + n(s.feedDeliveriesOrdered);
  const chicksOrdered =
    n(s.grangers) + n(s.layersOrdered) + n(s.broilersOrdered);
  const chicksDelivered =
    n(s.grangersDelivered) + n(s.layersDelivered) + n(s.broilersDelivered);
  const chicksPending =
    n(s.grangersPending) + n(s.layersPending) + n(s.broilersPending);
  const mortality = Math.round(n(s.grangers) * 0.03);
  const sspTotal = Math.floor(n(s.grangers) / 5);

  /* ── 1. Summary ── */
  add("Summary", [
    ["Chicken4U Dashboard Export"],
    [`Region: ${regionName}`, `Period: ${month}`],
    [`Exported: ${new Date().toLocaleString("en-US")}`],
    [],
    ["Metric", "Value"],
    ["Total MUOs", n(muo.total)],
    ["Male MUOs", n(muo.male)],
    ["Female MUOs", n(muo.female)],
    ["Total Certified", n(dashData?.learners)],
    ["Total SSPs", sspTotal],
    ["Mortality (est)", mortality],
    ["Feed (kg) – Orders", n(s.feedKgOrdered)],
    ["Feed (kg) – Deliveries", n(s.feedDeliveriesOrdered)],
    ["Feed (kg) – Total", feedKgTotal],
    [],
    ["Chick Totals", "Ordered", "Delivered", "Pending"],
    ["All Chicks", chicksOrdered, chicksDelivered, chicksPending],
    ["Grangers", n(s.grangers), n(s.grangersDelivered), n(s.grangersPending)],
    ["Layers", n(s.layersOrdered), n(s.layersDelivered), n(s.layersPending)],
    [
      "Broilers",
      n(s.broilersOrdered),
      n(s.broilersDelivered),
      n(s.broilersPending),
    ],
    [],
    ["Feed Deliveries (kg)", "Ordered", "Delivered", "Pending"],
    [
      "Savannah Feed",
      n(s.feedDeliveriesOrdered),
      n(s.feedDeliveriesDelivered),
      n(s.feedDeliveriesOrdered) - n(s.feedDeliveriesDelivered),
    ],
    [],
    ["Sales", "Units Sold"],
    ["Grangers Sold", n(s.grangers)],
    ["Layers Sold", n(s.layers)],
    ["Broilers Sold", n(s.broilers)],
    ["Total Sales", n(s.grangers) + n(s.layers) + n(s.broilers)],
  ]);

  /* ── 2. Monthly Trend ── */
  const trend = s.monthlyTrend ?? [];
  if (trend.length > 0) {
    add("Monthly Trend", [
      ["Chicken4U – Monthly Chick Distribution"],
      [`Region: ${regionName}`],
      [],
      ["Month", "Grangers", "Layers", "Broilers", "Total"],
      ...trend.map((d) => [
        d.label,
        n(d.grangers),
        n(d.layers),
        n(d.broilers),
        n(d.grangers) + n(d.layers) + n(d.broilers),
      ]),
      [],
      [
        "TOTAL",
        trend.reduce((a, d) => a + n(d.grangers), 0),
        trend.reduce((a, d) => a + n(d.layers), 0),
        trend.reduce((a, d) => a + n(d.broilers), 0),
        trend.reduce(
          (a, d) => a + n(d.grangers) + n(d.layers) + n(d.broilers),
          0,
        ),
      ],
    ]);
  }

  /* ── 3. Chick Distribution ── */
  add("Chick Distribution", [
    ["Chicken4U – Chick Distribution", "", `Period: ${month}`],
    [],
    ["Category", "Ordered", "Delivered", "Pending"],
    ["Grangers", n(s.grangers), n(s.grangersDelivered), n(s.grangersPending)],
    ["Layers", n(s.layersOrdered), n(s.layersDelivered), n(s.layersPending)],
    [
      "Broilers",
      n(s.broilersOrdered),
      n(s.broilersDelivered),
      n(s.broilersPending),
    ],
    [],
    ["TOTALS", chicksOrdered, chicksDelivered, chicksPending],
  ]);

  /* ── 4. Layer Breeds ── */
  const layerKeys = Object.keys(s.layerBreeds ?? {});
  if (layerKeys.length > 0) {
    add("Layer Breeds", [
      ["Chicken4U – Layer Breeds", `Period: ${month}`],
      [],
      ["Breed", "Ordered", "Delivered", "Pending"],
      ...layerKeys.map((b) => [
        b,
        n(s.layerBreeds?.[b]),
        n(s.layerBreedsDel?.[b]),
        n(s.layerBreedsPend?.[b]),
      ]),
      [],
      [
        "TOTAL",
        layerKeys.reduce((a, b) => a + n(s.layerBreeds?.[b]), 0),
        layerKeys.reduce((a, b) => a + n(s.layerBreedsDel?.[b]), 0),
        layerKeys.reduce((a, b) => a + n(s.layerBreedsPend?.[b]), 0),
      ],
    ]);
  }

  /* ── 5. Broiler Breeds ── */
  const broilerKeys = Object.keys(s.broilerBreeds ?? {});
  if (broilerKeys.length > 0) {
    add("Broiler Breeds", [
      ["Chicken4U – Broiler Breeds", `Period: ${month}`],
      [],
      ["Breed", "Ordered", "Delivered", "Pending"],
      ...broilerKeys.map((b) => [
        b,
        n(s.broilerBreeds?.[b]),
        n(s.broilerBreedsDel?.[b]),
        n(s.broilerBreedsPend?.[b]),
      ]),
      [],
      [
        "TOTAL",
        broilerKeys.reduce((a, b) => a + n(s.broilerBreeds?.[b]), 0),
        broilerKeys.reduce((a, b) => a + n(s.broilerBreedsDel?.[b]), 0),
        broilerKeys.reduce((a, b) => a + n(s.broilerBreedsPend?.[b]), 0),
      ],
    ]);
  }

  /* ── 6. Granger Breeds ── */
  const grangerKeys = Object.keys(s.grangerBreeds ?? {});
  if (grangerKeys.length > 0) {
    add("Granger Breeds", [
      ["Chicken4U – Granger Breeds", `Period: ${month}`],
      [],
      ["Breed", "Ordered", "Delivered", "Pending"],
      ...grangerKeys.map((b) => [
        b,
        n(s.grangerBreeds?.[b]),
        n(s.grangerBreedsDel?.[b]),
        n(s.grangerBreedsPend?.[b]),
      ]),
      [],
      [
        "TOTAL",
        grangerKeys.reduce((a, b) => a + n(s.grangerBreeds?.[b]), 0),
        grangerKeys.reduce((a, b) => a + n(s.grangerBreedsDel?.[b]), 0),
        grangerKeys.reduce((a, b) => a + n(s.grangerBreedsPend?.[b]), 0),
      ],
    ]);
  }

  /* ── 7. Pending Deliveries ── */
  const pendWeekList = s.pendingWeek?.list ?? [];
  const pendMonthList = s.pendingMonth?.list ?? [];
  const seenXL = new Set();
  const dedupd = [
    ...pendWeekList.map((o) => ({ ...o, scope: "This Week" })),
    ...pendMonthList.map((o) => ({ ...o, scope: "This Month" })),
  ].filter((o) => {
    if (seenXL.has(o.orderId)) return false;
    seenXL.add(o.orderId);
    return true;
  });

  if (dedupd.length > 0) {
    add("Pending Deliveries", [
      ["Chicken4U – Pending Deliveries", `Period: ${month}`],
      [],
      [
        "Scope",
        "Order ID",
        "MUO Name",
        "SATO Name",
        "Qty",
        "Expected Date",
        "Status",
      ],
      ...dedupd.map((o) => [
        o.scope ?? "",
        o.orderId ?? "",
        o.muoName ?? "",
        o.satoName ?? "",
        n(o.qty),
        o.expectedDate ?? "",
        o.status ?? "",
      ]),
      [],
      ["TOTALS", "", "", "", dedupd.reduce((a, o) => a + n(o.qty), 0), "", ""],
    ]);
  }

  /* ── 8. Top Performers ── */
  const topMuos = s.topMuos ?? [];
  const topSatos = s.topSatos ?? [];
  if (topMuos.length > 0 || topSatos.length > 0) {
    const maxLen = Math.max(topMuos.length, topSatos.length);
    const rows = [
      ["Chicken4U – Top Performers", `Period: ${month}`],
      [],
      [
        "Rank",
        "MUO Name",
        "Chicks Delivered",
        "",
        "Rank",
        "SATO Name",
        "Paid Qty",
      ],
    ];
    for (let i = 0; i < maxLen; i++) {
      const m = topMuos[i],
        s2 = topSatos[i];
      rows.push([
        m ? i + 1 : "",
        m ? (m.name ?? "") : "",
        m ? n(m.value) : "",
        "",
        s2 ? i + 1 : "",
        s2 ? (s2.name ?? "") : "",
        s2 ? n(s2.value) : "",
      ]);
    }
    add("Top Performers", rows);
  }

  /* ── 9. Other Products ── */
  const CHICK_KW = [
    "GRANGER",
    "LAYER",
    "BROILER",
    "NOVOBROWN",
    "NOVOWHITE",
    "NOVO",
    "COCK",
    "PULLET",
  ];
  const allProducts = s.allProducts ?? {};
  const otherProds = Object.entries(allProducts).filter(([name]) => {
    const u = name.toUpperCase();
    return !CHICK_KW.some((k) => u.includes(k));
  });
  if (otherProds.length > 0) {
    add("Other Products", [
      ["Chicken4U – Other Products", `Period: ${month}`],
      [],
      ["Product", "Ordered", "Delivered", "Pending"],
      ...otherProds.map(([name, data]) => [
        name,
        n(data.ordered),
        n(data.delivered),
        n(data.pending),
      ]),
      [],
      [
        "TOTALS",
        otherProds.reduce((a, [, d]) => a + n(d.ordered), 0),
        otherProds.reduce((a, [, d]) => a + n(d.delivered), 0),
        otherProds.reduce((a, [, d]) => a + n(d.pending), 0),
      ],
    ]);
  }

  /* ── 10. MUO Gender ── */
  add("MUO Gender", [
    ["Chicken4U – MUO Gender Split", `Period: ${month}`],
    [],
    ["Category", "Count", "% of Total"],
    [
      "Female MUOs",
      n(muo.female),
      n(muo.total) > 0
        ? ((n(muo.female) / n(muo.total)) * 100).toFixed(1) + "%"
        : "0%",
    ],
    [
      "Male MUOs",
      n(muo.male),
      n(muo.total) > 0
        ? ((n(muo.male) / n(muo.total)) * 100).toFixed(1) + "%"
        : "0%",
    ],
    ["Total MUOs", n(muo.total), "100%"],
  ]);

  XLSX.writeFile(
    wb,
    `Chicken4U_Dashboard_${safeFileName(regionName)}_${fileDate()}.xlsx`,
  );
}

/* ══════════════════════════════════════════════════════════════════════
   POWERPOINT  EXPORT
══════════════════════════════════════════════════════════════════════ */
export async function exportToPptx(
  dashData,
  regionName = "All Regions",
  monthLabel = null,
  logoDataUrl = null,
) {
  // PptxGenJS is imported at the top – no window.PptxGenJS needed
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Chicken4U Dashboard";
  pres.author = "WAFAD Group";

  const month = monthLabel ?? nowLabel();

  /* ── Text style factories ── */
  const T = (color = HEX.surf, size = 38) => ({
    fontSize: size,
    bold: true,
    color,
    fontFace: "Trebuchet MS",
  });
  const S = (color = HEX.textSf, size = 13) => ({
    fontSize: size,
    color,
    fontFace: "Calibri",
  });
  const LB = (color = HEX.textSf, size = 9) => ({
    fontSize: size,
    bold: true,
    color,
    fontFace: "Calibri",
    charSpacing: 1,
  });
  const V = (color = HEX.pri, size = 30) => ({
    fontSize: size,
    bold: true,
    color,
    fontFace: "Trebuchet MS",
  });

  const shadow = () => ({
    type: "outer",
    blur: 6,
    offset: 2,
    angle: 135,
    color: "000000",
    opacity: 0.1,
  });

  /* ─────────────────────────────────────────────────────────────────
     hdr()  –  shared orange/amber header band on every content slide
  ───────────────────────────────────────────────────────────────── */
  function hdr(sl, label, color = HEX.pri, sub = `${month}  ·  ${regionName}`) {
    sl.background = { color: HEX.bg };
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: HDR_H,
      fill: { color },
      line: { color },
    });
    sl.addText(label, {
      x: 0.3,
      y: 0,
      w: 6.5,
      h: HDR_H,
      margin: 0,
      fontSize: 19,
      bold: true,
      color: HEX.surf,
      fontFace: "Trebuchet MS",
      valign: "middle",
    });
    sl.addText(sub, {
      x: 5.8,
      y: 0,
      w: 4.0,
      h: HDR_H,
      margin: 0,
      fontSize: 10.5,
      color: "FFE0A0",
      fontFace: "Calibri",
      align: "right",
      valign: "middle",
    });
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: HDR_H,
      w: SLIDE_W,
      h: ACCENT_H,
      fill: { color: HEX.amber },
      line: { color: HEX.amber },
    });
  }

  /* ─────────────────────────────────────────────────────────────────
     kpiCard()
     FIX: value-text height is now DYNAMIC (h − 0.52) so it never
     overflows the card regardless of what h is passed in.
     Old code used a hardcoded h: 0.75 which exceeded small cards.
  ───────────────────────────────────────────────────────────────── */
  function kpiCard(sl, x, y, w, h, label, value, color) {
    sl.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w,
      h,
      fill: { color: HEX.surf },
      line: { color: HEX.bord, pt: 1 },
      shadow: shadow(),
    });
    sl.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w,
      h: 0.06,
      fill: { color },
      line: { color },
    });
    sl.addText(label.toUpperCase(), {
      x: x + 0.12,
      y: y + 0.12,
      w: w - 0.24,
      h: 0.24,
      ...LB(HEX.textSf, 8),
    });
    // Dynamic: ensures text box always sits inside the card.
    // For h=1.85: valueH=1.33. For h=1.25 (mini): valueH=0.73. Never overflows.
    const valueH = Math.max(0.45, h - 0.52);
    sl.addText(value, {
      x: x + 0.1,
      y: y + 0.42,
      w: w - 0.2,
      h: valueH,
      ...V(color, 24),
    });
  }

  /* ─────────────────────────────────────────────────────────────────
     tblHdrRow()  –  styled header row for addTable calls
  ───────────────────────────────────────────────────────────────── */
  function tblHdrRow(cols, color = HEX.pri) {
    return cols.map((text) => ({
      text,
      options: {
        bold: true,
        color: HEX.surf,
        fill: { color },
        fontSize: 10,
        fontFace: "Calibri",
      },
    }));
  }

  /* ─────────────────────────────────────────────────────────────────
     addPaginatedTable()
     Draws one or more full-body slides (table starts at y ≈ 0.85).
     colW[] must sum to ≈ 9.2 in.
  ───────────────────────────────────────────────────────────────── */
  function addPaginatedTable(title, hdrCols, dataRows, colW, color = HEX.pri) {
    if (dataRows.length === 0) {
      const sl = pres.addSlide();
      hdr(sl, title, color);
      sl.addText("No data available for this period.", {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 0.5,
        fontSize: 13,
        color: HEX.textSf,
        fontFace: "Calibri",
        italic: true,
      });
      return;
    }
    const pages = Math.ceil(dataRows.length / ROWS_PER_SLIDE);
    for (let p = 0; p < pages; p++) {
      const sl = pres.addSlide();
      const pageLabel = pages > 1 ? `${title}  (${p + 1} / ${pages})` : title;
      hdr(sl, pageLabel, color);
      const slice = dataRows.slice(
        p * ROWS_PER_SLIDE,
        (p + 1) * ROWS_PER_SLIDE,
      );
      const tbl = [tblHdrRow(hdrCols, color), ...slice];
      const rowH = 0.32;
      sl.addTable(tbl, {
        x: MARGIN_X,
        y: 0.85,
        w: CONTENT_W,
        h: rowH * tbl.length + 0.02,
        fontSize: 9.5,
        fontFace: "Calibri",
        color: HEX.text,
        border: { type: "solid", pt: 0.5, color: HEX.bord },
        fill: { color: HEX.surf },
        rowH,
        colW,
        autoPage: false,
      });
    }
  }

  /* ══ Data extraction ══ */
  const s = dashData?.sales ?? {};
  const muo = dashData?.muo ?? {};

  const feedKgTotal = n(s.feedKgOrdered) + n(s.feedDeliveriesOrdered);
  const mortality = Math.round(n(s.grangers) * 0.03);
  const sspTotal = Math.floor(n(s.grangers) / 5);
  const chicksOrdered =
    n(s.grangers) + n(s.layersOrdered) + n(s.broilersOrdered);
  const trend = s.monthlyTrend ?? [];
  const topMuos = s.topMuos ?? [];
  const topSatos = s.topSatos ?? [];

  const seenPend = new Set();
  const allPending = [
    ...(s.pendingWeek?.list ?? []).map((o) => ({ ...o, scope: "This Week" })),
    ...(s.pendingMonth?.list ?? []).map((o) => ({ ...o, scope: "This Month" })),
  ].filter((o) => {
    if (seenPend.has(o.orderId)) return false;
    seenPend.add(o.orderId);
    return true;
  });

  /* ════════════════════════════════════════════════════
     SLIDE 1 – Title
  ════════════════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    sl.background = { color: HEX.surf };

    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: 0.08,
      fill: { color: HEX.pri },
      line: { color: HEX.pri },
    });
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 0.16,
      h: SLIDE_H,
      fill: { color: HEX.pri },
      line: { color: HEX.pri },
    });

    if (logoDataUrl) {
      try {
        sl.addImage({ data: logoDataUrl, x: 0.35, y: 0.2, w: 1.55, h: 1.55 });
      } catch (_) {}
    } else {
      sl.addShape(pres.shapes.OVAL, {
        x: 0.35,
        y: 0.2,
        w: 1.55,
        h: 1.55,
        fill: { color: HEX.pri + "22" },
        line: { color: HEX.pri, pt: 2 },
      });
      sl.addText("🐔", {
        x: 0.35,
        y: 0.3,
        w: 1.55,
        h: 1.35,
        fontSize: 42,
        align: "center",
        valign: "middle",
      });
    }

    sl.addText("CHICKEN4U", {
      x: 0.35,
      y: 2.0,
      w: 8.5,
      h: 0.9,
      ...T(HEX.text, 52),
      charSpacing: 3,
    });
    sl.addText("Overview Dashboard", {
      x: 0.35,
      y: 2.98,
      w: 8.5,
      h: 0.55,
      ...T(HEX.pri, 28),
    });
    sl.addText(`${month}  ·  Region: ${regionName}`, {
      x: 0.35,
      y: 3.65,
      w: 8.5,
      h: 0.38,
      ...S(HEX.textSf, 15),
    });

    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 4.82,
      w: SLIDE_W,
      h: 0.805,
      fill: { color: HEX.yellow },
      line: { color: HEX.yellow },
    });
    if (logoDataUrl) {
      try {
        sl.addImage({ data: logoDataUrl, x: 0.18, y: 4.88, w: 0.62, h: 0.62 });
      } catch (_) {}
    }
    sl.addText("WAFAD GROUP – Real-Time Poultry Data", {
      x: 0.95,
      y: 4.82,
      w: 5.5,
      h: 0.805,
      fontSize: 13,
      color: HEX.text,
      fontFace: "Calibri",
      valign: "middle",
    });
    sl.addText("Grow food.  Earn Income.  Changing lives.", {
      x: 5.5,
      y: 4.82,
      w: 4.3,
      h: 0.805,
      fontSize: 11,
      italic: true,
      color: HEX.surf,
      fontFace: "Trebuchet MS",
      align: "right",
      valign: "middle",
    });
  }

  /* ════════════════════════════════════════════════════
     SLIDE 2 – KPI Overview
  ════════════════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "KPI Overview");

    const kpis = [
      { label: "Total MUOs", value: fmt(muo.total), color: HEX.pri },
      {
        label: "Total Certified",
        value: fmt(dashData?.learners),
        color: HEX.sky,
      },
      { label: "Chicks Ordered", value: fmt(chicksOrdered), color: HEX.amber },
      { label: "Feed Used (kg)", value: fmt(feedKgTotal), color: HEX.brownMd },
      { label: "Mortality (est)", value: fmt(mortality), color: HEX.red },
      { label: "Total SSPs", value: fmt(sspTotal), color: HEX.green },
    ];

    const CARD_W = 3.0;
    const CARD_H = 1.85;
    const COL_SP = 3.25;
    const ROW_SP = 2.1;
    const START_X = 0.25;
    const START_Y = 0.88;

    kpis.forEach((k, i) => {
      kpiCard(
        sl,
        START_X + (i % 3) * COL_SP,
        START_Y + Math.floor(i / 3) * ROW_SP,
        CARD_W,
        CARD_H,
        k.label,
        k.value,
        k.color,
      );
    });
  }

  /* ════════════════════════════════════════════════════
     SLIDE 3 – MUO Gender Split
  ════════════════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "MUO Gender Split", HEX.purple);

    const total = n(muo.total);
    const male = n(muo.male);
    const female = n(muo.female);
    const fPct = total > 0 ? ((female / total) * 100).toFixed(1) + "%" : "0%";
    const mPct = total > 0 ? ((male / total) * 100).toFixed(1) + "%" : "0%";

    const CARD_H = 2.0;
    const CARD_Y = 0.9;
    const CARD_W = 2.85;

    [
      { label: "Female MUOs", value: fmt(female), pct: fPct, color: HEX.pink },
      { label: "Male MUOs", value: fmt(male), pct: mPct, color: HEX.sky },
      {
        label: "Total MUOs",
        value: fmt(total),
        pct: "100%",
        color: HEX.purple,
      },
    ].forEach((c, i) => {
      const x = MARGIN_X + i * 3.1;
      sl.addShape(pres.shapes.RECTANGLE, {
        x,
        y: CARD_Y,
        w: CARD_W,
        h: CARD_H,
        fill: { color: HEX.surf },
        line: { color: c.color + "44" },
        shadow: shadow(),
      });
      sl.addShape(pres.shapes.RECTANGLE, {
        x,
        y: CARD_Y,
        w: CARD_W,
        h: 0.06,
        fill: { color: c.color },
        line: { color: c.color },
      });
      sl.addText(c.label.toUpperCase(), {
        x: x + 0.15,
        y: CARD_Y + 0.12,
        w: 2.55,
        h: 0.26,
        ...LB(c.color),
      });
      sl.addText(c.value, {
        x: x + 0.1,
        y: CARD_Y + 0.44,
        w: 2.65,
        h: 0.9,
        ...V(c.color, 34),
      });
      sl.addText(c.pct + " of total", {
        x: x + 0.15,
        y: CARD_Y + 1.4,
        w: 2.55,
        h: 0.35,
        ...S(HEX.textSf, 12),
      });
    });

    // Chart fills remaining space below cards
    const CHART_Y = CARD_Y + CARD_H + 0.1;
    const CHART_H = SLIDE_H - CHART_Y - MARGIN_B;

    if (male + female > 0) {
      sl.addChart(
        pres.charts.BAR,
        [
          {
            name: "MUO Count",
            labels: ["Female", "Male"],
            values: [female, male],
          },
        ],
        {
          x: 0.5,
          y: CHART_Y,
          w: 9.0,
          h: CHART_H,
          barDir: "col",
          chartColors: [HEX.pink, HEX.sky],
          chartArea: { fill: { color: HEX.surf } },
          showValue: true,
          dataLabelColor: HEX.text,
          dataLabelFontSize: 12,
          catAxisLabelColor: HEX.textSf,
          valAxisLabelColor: HEX.textSf,
          catGridLine: { style: "none" },
          valGridLine: { color: "E2E8F0", size: 0.5 },
          showLegend: false,
        },
      );
    }
  }

  /* ════════════════════════════════════════════════════
     SLIDE 4 – Chick Distribution
  ════════════════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "Chick Distribution", HEX.amber);

    const TABLE_Y = CONTENT_Y;
    const TABLE_H = 1.85;

    sl.addTable(
      [
        tblHdrRow(["Category", "Ordered", "Delivered", "Pending"], HEX.amber),
        [
          "Grangers",
          fmt(s.grangers),
          fmt(s.grangersDelivered),
          fmt(s.grangersPending),
        ],
        [
          "Layers",
          fmt(s.layersOrdered),
          fmt(s.layersDelivered),
          fmt(s.layersPending),
        ],
        [
          "Broilers",
          fmt(s.broilersOrdered),
          fmt(s.broilersDelivered),
          fmt(s.broilersPending),
        ],
      ],
      {
        x: MARGIN_X,
        y: TABLE_Y,
        w: CONTENT_W,
        h: TABLE_H,
        fontSize: 12,
        fontFace: "Calibri",
        color: HEX.text,
        border: { type: "solid", pt: 0.5, color: HEX.bord },
        fill: { color: HEX.surf },
        rowH: 0.43,
        colW: [2.5, 2.2, 2.2, 2.3],
      },
    );

    const ordVals = [n(s.grangers), n(s.layersOrdered), n(s.broilersOrdered)];
    const delVals = [
      n(s.grangersDelivered),
      n(s.layersDelivered),
      n(s.broilersDelivered),
    ];
    const penVals = [
      n(s.grangersPending),
      n(s.layersPending),
      n(s.broilersPending),
    ];
    const labels = ["Grangers", "Layers", "Broilers"];

    // Chart fills all remaining space below the table
    const CHART_Y = TABLE_Y + TABLE_H + 0.08;
    const CHART_H = SLIDE_H - CHART_Y - MARGIN_B;

    if (ordVals.some((v) => v > 0)) {
      sl.addChart(
        pres.charts.BAR,
        [
          { name: "Ordered", labels, values: ordVals },
          { name: "Delivered", labels, values: delVals },
          { name: "Pending", labels, values: penVals },
        ],
        {
          x: MARGIN_X,
          y: CHART_Y,
          w: CONTENT_W,
          h: CHART_H,
          barDir: "col",
          barGrouping: "clustered",
          chartColors: [HEX.pri, HEX.green, HEX.red],
          chartArea: { fill: { color: HEX.surf } },
          showValue: true,
          dataLabelFontSize: 9,
          catAxisLabelColor: HEX.textSf,
          valAxisLabelColor: HEX.textSf,
          catGridLine: { style: "none" },
          valGridLine: { color: "E2E8F0", size: 0.5 },
          legendPos: "r",
          showLegend: true,
          legendFontSize: 11,
        },
      );
    }
  }

  /* ════════════════════════════════════════════════════
     SLIDE 5 – Feed Overview
  ════════════════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "Feed Overview", HEX.brownMd);

    const feedOrders = n(s.feedKgOrdered);
    const feedDel = n(s.feedDeliveriesOrdered);
    const feedDelDone = n(s.feedDeliveriesDelivered);
    const feedDelPend = feedDel - feedDelDone;

    const CARD_W = 3.0;
    const CARD_H = 1.85;

    [
      {
        label: "Feed (kg) – Orders",
        value: fmt(feedOrders),
        color: HEX.brownMd,
      },
      {
        label: "Feed Deliveries – Ordered",
        value: fmt(feedDel),
        color: HEX.amber,
      },
      {
        label: "Feed Deliveries – Delivered",
        value: fmt(feedDelDone),
        color: HEX.green,
      },
      {
        label: "Feed Deliveries – Pending",
        value: fmt(feedDelPend),
        color: HEX.red,
      },
      { label: "Total Feed (kg)", value: fmt(feedKgTotal), color: HEX.pri },
    ].forEach((c, i) => {
      kpiCard(
        sl,
        MARGIN_X - 0.1 + (i % 3) * 3.27,
        0.9 + Math.floor(i / 3) * 2.1,
        CARD_W,
        CARD_H,
        c.label,
        c.value,
        c.color,
      );
    });
  }

  /* ════════════════════════════════════════════════════
     SLIDE 6 – Monthly Chick Distribution
     ─────────────────────────────────────────────────
     ROOT CAUSE OF OLD BUG:
       • kpiCard value text was always h=0.75 regardless of card h.
       • Mini-cards used h=0.88, so text y+0.42+0.75 = y+1.17 → 0.29in
         overflow, which pushed the chart or clipped the numbers.
       • Chart h=3.75 was hardcoded, not derived from slide geometry.
     FIX:
       • MINI_H = 1.25in  (fits label + value + breathing room)
       • MINI_Y = derived from slide bottom so cards always sit flush
       • CHART_H = space between CONTENT_Y and the top of mini-cards
       • kpiCard now uses dynamic valueH = max(0.45, h − 0.52)
  ════════════════════════════════════════════════════ */
  if (trend.length > 0) {
    const sl = pres.addSlide();
    hdr(sl, "Monthly Chick Distribution");

    /* ── Geometry (all derived, nothing hardcoded) ── */
    const MINI_H = 1.25; // tall enough for label+value
    const GAP = 0.1; // gap between chart bottom and mini-cards
    const MINI_Y = SLIDE_H - MARGIN_B - MINI_H; // 4.295 in
    const CHART_Y = CONTENT_Y; // 0.82 in
    const CHART_H = MINI_Y - GAP - CHART_Y; // 3.375 in – uses ALL available space

    sl.addChart(
      pres.charts.BAR,
      [
        {
          name: "Grangers",
          labels: trend.map((d) => d.label),
          values: trend.map((d) => n(d.grangers)),
        },
        {
          name: "Layers",
          labels: trend.map((d) => d.label),
          values: trend.map((d) => n(d.layers)),
        },
        {
          name: "Broilers",
          labels: trend.map((d) => d.label),
          values: trend.map((d) => n(d.broilers)),
        },
      ],
      {
        x: MARGIN_X,
        y: CHART_Y,
        w: CONTENT_W,
        h: CHART_H,
        barDir: "col",
        barGrouping: "stacked",
        chartColors: [HEX.pri, HEX.green, HEX.sky],
        chartArea: { fill: { color: HEX.surf } },
        showValue: false,
        catAxisLabelColor: HEX.textSf,
        valAxisLabelColor: HEX.textSf,
        catGridLine: { style: "none" },
        valGridLine: { color: "E2E8F0", size: 0.5 },
        legendPos: "b",
        showLegend: true,
        legendFontSize: 11,
      },
    );

    /* ── Mini-stat cards (3 equal columns) ── */
    const totals = trend.map(
      (d) => n(d.grangers) + n(d.layers) + n(d.broilers),
    );
    const peak = trend[totals.indexOf(Math.max(...totals))]?.label ?? "—";
    const avg = fmt(
      Math.round(totals.reduce((a, v) => a + v, 0) / totals.length),
    );
    const grand = fmt(totals.reduce((a, v) => a + v, 0));
    const CARD_W = (CONTENT_W - 0.2) / 3; // three equal cards spanning CONTENT_W

    [
      { label: "Peak Month", value: peak, color: HEX.pri },
      { label: "Avg / Month", value: avg, color: HEX.sky },
      { label: "Grand Total", value: grand, color: HEX.purple },
    ].forEach((stat, i) => {
      kpiCard(
        sl,
        MARGIN_X + i * (CARD_W + 0.1),
        MINI_Y,
        CARD_W,
        MINI_H,
        stat.label,
        stat.value,
        stat.color,
      );
    });
  }

  /* ════════════════════════════════════════════════════
     SLIDES 7+ – Pending Deliveries
     ─────────────────────────────────────────────────
     FIX: summary slide table is capped to PENDING_SUMMARY_ROWS (8).
     Old code used ROWS_PER_SLIDE (11) but the table starts at y≈2.40;
     11 rows would bottom out at ≈6.26in — 0.63in past the slide edge.
     "Continued" note position is now derived from the table bottom.
  ════════════════════════════════════════════════════ */
  if (allPending.length > 0) {
    /* ── Summary card slide ── */
    {
      const sl = pres.addSlide();
      hdr(sl, "Pending Deliveries", HEX.amber);

      const SUMM_Y = 0.88;
      const SUMM_H = 1.35;

      [
        {
          label: "Pending This Week",
          orders: n(s.pendingWeek?.orders),
          qty: n(s.pendingWeek?.qty),
          color: HEX.amber,
        },
        {
          label: "Pending This Month",
          orders: n(s.pendingMonth?.orders),
          qty: n(s.pendingMonth?.qty),
          color: HEX.sky,
        },
      ].forEach((c, i) => {
        const x = MARGIN_X + i * 4.8;
        sl.addShape(pres.shapes.RECTANGLE, {
          x,
          y: SUMM_Y,
          w: 4.5,
          h: SUMM_H,
          fill: { color: HEX.surf },
          line: { color: c.color + "44" },
          shadow: shadow(),
        });
        sl.addShape(pres.shapes.RECTANGLE, {
          x,
          y: SUMM_Y,
          w: 4.5,
          h: 0.06,
          fill: { color: c.color },
          line: { color: c.color },
        });
        sl.addText(c.label.toUpperCase(), {
          x: x + 0.15,
          y: SUMM_Y + 0.12,
          w: 4.2,
          h: 0.25,
          ...LB(c.color),
        });
        sl.addText(`${fmt(c.orders)} orders  ·  ${fmt(c.qty)} qty`, {
          x: x + 0.1,
          y: SUMM_Y + 0.44,
          w: 4.3,
          h: 0.55,
          ...V(c.color, 20),
        });
      });

      /* Table – capped to PENDING_SUMMARY_ROWS so it never overflows */
      const TABLE_Y = SUMM_Y + SUMM_H + 0.16; // ≈ 2.39 in
      const ROW_H = 0.3;
      const HDR_ROW_H = 0.36;
      const first = allPending.slice(0, PENDING_SUMMARY_ROWS);

      const tblRows = first.map((o) => [
        o.scope ?? "",
        (o.muoName ?? o.orderId ?? "").slice(0, 28),
        (o.satoName ?? "").slice(0, 22),
        fmt(o.qty),
        o.expectedDate ?? "",
        o.status ?? "",
      ]);

      const TABLE_H = HDR_ROW_H + first.length * ROW_H + 0.04;

      sl.addTable(
        [
          tblHdrRow(
            ["Scope", "MUO", "SATO", "Qty", "Exp. Date", "Status"],
            HEX.amber,
          ),
          ...tblRows,
        ],
        {
          x: MARGIN_X,
          y: TABLE_Y,
          w: CONTENT_W,
          h: TABLE_H,
          fontSize: 9,
          fontFace: "Calibri",
          color: HEX.text,
          border: { type: "solid", pt: 0.5, color: HEX.bord },
          fill: { color: HEX.surf },
          rowH: ROW_H,
          colW: [1.25, 2.15, 1.95, 0.8, 1.4, 1.65],
          autoPage: false,
        },
      );

      /* "Continued" note – positioned dynamically below the table */
      if (allPending.length > PENDING_SUMMARY_ROWS) {
        const noteY = TABLE_Y + TABLE_H + 0.06;
        if (noteY + 0.22 <= SLIDE_H - 0.04) {
          sl.addText(
            `Continued on next slide(s) — ${allPending.length} orders total`,
            {
              x: MARGIN_X,
              y: noteY,
              w: CONTENT_W,
              h: 0.22,
              fontSize: 9,
              italic: true,
              color: HEX.textSf,
              fontFace: "Calibri",
            },
          );
        }
      }
    }

    /* Overflow pages – remaining rows go to paginated slides */
    if (allPending.length > PENDING_SUMMARY_ROWS) {
      const remaining = allPending.slice(PENDING_SUMMARY_ROWS);
      const dataRows = remaining.map((o) => [
        o.scope ?? "",
        (o.muoName ?? o.orderId ?? "").slice(0, 28),
        (o.satoName ?? "").slice(0, 22),
        fmt(o.qty),
        o.expectedDate ?? "",
        o.status ?? "",
      ]);
      addPaginatedTable(
        "Pending Deliveries (cont.)",
        ["Scope", "MUO", "SATO", "Qty", "Exp. Date", "Status"],
        dataRows,
        [1.25, 2.15, 1.95, 0.8, 1.4, 1.65],
        HEX.amber,
      );
    }
  }

  /* ════════════════════════════════════════════════════
     SLIDES – Top MUOs  (paginated, dark theme)
  ════════════════════════════════════════════════════ */
  if (topMuos.length > 0) {
    const DARK = "1A0D02";
    const muoRows = topMuos.map((m, i) => [
      String(i + 1),
      m.name ?? "—",
      fmt(m.value),
    ]);
    const pages = Math.ceil(muoRows.length / ROWS_PER_SLIDE);
    for (let p = 0; p < pages; p++) {
      const sl = pres.addSlide();
      sl.background = { color: DARK };
      hdr(
        sl,
        pages > 1 ? `Top MUOs 🏆 (${p + 1}/${pages})` : "Top MUOs 🏆",
        HEX.pri,
      );
      const slice = muoRows.slice(p * ROWS_PER_SLIDE, (p + 1) * ROWS_PER_SLIDE);
      sl.addTable(
        [tblHdrRow(["#", "MUO Name", "Chicks Delivered"], HEX.sky), ...slice],
        {
          x: 0.5,
          y: 0.85,
          w: 9.0,
          h: 0.38 + slice.length * 0.38,
          fontSize: 11,
          fontFace: "Calibri",
          color: "DDDDDD",
          border: { type: "solid", pt: 0.5, color: "334466" },
          fill: { color: "0F1A2E" },
          rowH: 0.38,
          colW: [0.6, 6.5, 1.9],
        },
      );
    }
  }

  /* ════════════════════════════════════════════════════
     SLIDES – Top SATOs  (paginated, dark theme)
  ════════════════════════════════════════════════════ */
  if (topSatos.length > 0) {
    const DARK = "1A0D02";
    const satoRows = topSatos.map((m, i) => [
      String(i + 1),
      m.name ?? "—",
      fmt(m.value),
    ]);
    const pages = Math.ceil(satoRows.length / ROWS_PER_SLIDE);
    for (let p = 0; p < pages; p++) {
      const sl = pres.addSlide();
      sl.background = { color: DARK };
      hdr(
        sl,
        pages > 1 ? `Top SATOs 🏆 (${p + 1}/${pages})` : "Top SATOs 🏆",
        HEX.green,
      );
      const slice = satoRows.slice(
        p * ROWS_PER_SLIDE,
        (p + 1) * ROWS_PER_SLIDE,
      );
      sl.addTable(
        [tblHdrRow(["#", "SATO Name", "Paid Qty"], HEX.green), ...slice],
        {
          x: 0.5,
          y: 0.85,
          w: 9.0,
          h: 0.38 + slice.length * 0.38,
          fontSize: 11,
          fontFace: "Calibri",
          color: "DDDDDD",
          border: { type: "solid", pt: 0.5, color: "1A3322" },
          fill: { color: "0A1A0F" },
          rowH: 0.38,
          colW: [0.6, 6.5, 1.9],
        },
      );
    }
  }

  /* ════════════════════════════════════════════════════
     SLIDE – Sales Summary
  ════════════════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "Sales Summary");

    const CARD_Y = 0.9;
    const CARD_H = 1.9;
    const CARD_W = 2.9;

    [
      { label: "Grangers Sold", value: n(s.grangers), color: HEX.pri },
      { label: "Layers Sold", value: n(s.layers), color: HEX.green },
      { label: "Broilers Sold", value: n(s.broilers), color: HEX.sky },
    ].forEach((item, i) => {
      const x = MARGIN_X + i * 3.1;
      sl.addShape(pres.shapes.RECTANGLE, {
        x,
        y: CARD_Y,
        w: CARD_W,
        h: CARD_H,
        fill: { color: item.color + "15" },
        line: { color: item.color + "55" },
        shadow: shadow(),
      });
      sl.addShape(pres.shapes.RECTANGLE, {
        x,
        y: CARD_Y,
        w: CARD_W,
        h: 0.06,
        fill: { color: item.color },
        line: { color: item.color },
      });
      sl.addText(item.label.toUpperCase(), {
        x: x + 0.15,
        y: CARD_Y + 0.1,
        w: 2.6,
        h: 0.26,
        ...LB(item.color),
      });
      sl.addText(fmt(item.value), {
        x: x + 0.1,
        y: CARD_Y + 0.42,
        w: 2.7,
        h: Math.max(0.45, CARD_H - 0.52),
        ...V(item.color, 32),
      });
    });

    // Chart fills the remaining slide below cards
    const CHART_Y = CARD_Y + CARD_H + 0.08;
    const CHART_H = SLIDE_H - CHART_Y - MARGIN_B;
    const salesVals = [n(s.grangers), n(s.layers), n(s.broilers)];

    if (salesVals.some((v) => v > 0)) {
      sl.addChart(
        pres.charts.PIE,
        [
          {
            name: "Sales",
            labels: ["Grangers", "Layers", "Broilers"],
            values: salesVals,
          },
        ],
        {
          x: 0.5,
          y: CHART_Y,
          w: 9.0,
          h: CHART_H,
          chartColors: [HEX.pri, HEX.green, HEX.sky],
          chartArea: { fill: { color: HEX.surf } },
          dataLabelColor: HEX.text,
          showPercent: true,
          showValue: true,
          legendPos: "r",
          showLegend: true,
          legendFontSize: 12,
        },
      );
    }
  }

  /* ════════════════════════════════════════════════════
     LAST SLIDE – Business-Card Closing
  ════════════════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    sl.background = { color: HEX.surf };

    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: 0.07,
      fill: { color: HEX.pri },
      line: { color: HEX.pri },
    });

    if (logoDataUrl) {
      try {
        sl.addImage({ data: logoDataUrl, x: 0.85, y: 0.75, w: 3.2, h: 3.2 });
      } catch (_) {}
    } else {
      sl.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 0.7,
        y: 0.7,
        w: 3.6,
        h: 3.4,
        fill: { color: "F9F9F9" },
        line: { color: "DDDDDD", pt: 1.5 },
        rectRadius: 0.1,
      });
      sl.addText("🐔", {
        x: 0.9,
        y: 0.9,
        w: 3.2,
        h: 1.6,
        fontSize: 72,
        align: "center",
        valign: "middle",
      });
      sl.addText("CHICKEN4U", {
        x: 0.9,
        y: 2.5,
        w: 3.2,
        h: 0.45,
        fontSize: 20,
        bold: true,
        color: HEX.pri,
        fontFace: "Trebuchet MS",
        align: "center",
      });
      sl.addText("CHICKS | FEEDS | EGGS | CHICKEN", {
        x: 0.9,
        y: 2.98,
        w: 3.2,
        h: 0.28,
        fontSize: 8,
        color: HEX.textSf,
        fontFace: "Calibri",
        align: "center",
        charSpacing: 0.5,
      });
      sl.addText("by WAFAD GROUP", {
        x: 0.9,
        y: 3.28,
        w: 3.2,
        h: 0.25,
        fontSize: 9,
        color: HEX.textMd,
        fontFace: "Calibri",
        align: "center",
        italic: true,
      });
    }

    const rx = 5.2;
    sl.addText("WAFAD GROUP", {
      x: rx,
      y: 0.95,
      w: 4.5,
      h: 0.55,
      fontSize: 28,
      bold: true,
      color: HEX.text,
      fontFace: "Trebuchet MS",
    });
    sl.addText(
      "Plot 1A, Melcom Road,\nNear Pacific Filling Station\nAdum-Afrancho\nKumasi – Ghana",
      {
        x: rx,
        y: 1.6,
        w: 4.5,
        h: 1.3,
        fontSize: 12,
        color: HEX.textMd,
        fontFace: "Calibri",
        lineSpacingMultiple: 1.35,
      },
    );
    sl.addText("Call / WhatsApp", {
      x: rx,
      y: 3.02,
      w: 4.5,
      h: 0.28,
      fontSize: 11,
      bold: true,
      color: HEX.text,
      fontFace: "Calibri",
    });
    sl.addText("+233 551 555 528\n+233 551 555 529\n+233 540 112 711", {
      x: rx,
      y: 3.3,
      w: 4.5,
      h: 0.82,
      fontSize: 12,
      color: HEX.textMd,
      fontFace: "Calibri",
      lineSpacingMultiple: 1.3,
    });
    sl.addText("wafadgroup", {
      x: rx,
      y: 4.18,
      w: 4.5,
      h: 0.28,
      fontSize: 11,
      bold: true,
      color: HEX.pri,
      fontFace: "Calibri",
    });

    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 4.82,
      w: SLIDE_W,
      h: 0.805,
      fill: { color: HEX.yellow },
      line: { color: HEX.yellow },
    });
    if (logoDataUrl) {
      try {
        sl.addImage({ data: logoDataUrl, x: 0.15, y: 4.88, w: 0.62, h: 0.62 });
      } catch (_) {}
    }
    sl.addText("Grow food.  Earn Income.  Changing lives.", {
      x: 0.9,
      y: 4.82,
      w: 9.0,
      h: 0.805,
      fontSize: 18,
      bold: true,
      color: HEX.surf,
      fontFace: "Trebuchet MS",
      align: "center",
      valign: "middle",
    });
  }

  /* ── Save ── */
  await pres.writeFile({
    fileName: `Chicken4U_Dashboard_${safeFileName(regionName)}_${fileDate()}.pptx`,
  });
}
