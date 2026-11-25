/**
 * exportUtils.js  –  Chicken4U Dashboard
 * Exports ALL dashboard data to Excel (.xlsx) and PowerPoint (.pptx)
 *
 * CDNs required in index.html:
 *   <script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
 */

/* ─── Palette ───────────────────────────────────────── */
const HEX = {
  pri: "D97B0F",
  amber: "C47E0C",
  green: "1F7A42",
  sky: "0369A1",
  red: "C0392B",
  purple: "7C3AED",
  pink: "BE185D",
  brownMd: "7A5230",
  bg: "FFF8EE", // ← brand cream background
  surf: "FFFFFF",
  text: "2A1A04",
  textMd: "6B4A22",
  textSf: "A87842",
  bord: "F5D9A8",
  priLt: "FFF4E0",
  priDk: "A85E07",
};

/* ─── Helpers ───────────────────────────────────────── */
const n = (v) => Number(v ?? 0);
const fmt = (v) => n(v).toLocaleString("en-US");

function nowLabel() {
  return new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
}
function fileDate() {
  return new Date().toISOString().slice(0, 10);
}
function safeFileName(region) {
  return (region ?? "All_Regions").replace(/\s+/g, "_");
}

/* ══════════════════════════════════════════════════════
   EXCEL  EXPORT
══════════════════════════════════════════════════════ */
export function exportToExcel(
  dashData,
  regionName = "All Regions",
  monthLabel = null,
) {
  const XLSX = window.XLSX;
  if (!XLSX) {
    alert("SheetJS not loaded. Add XLSX CDN to index.html.");
    return;
  }

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

  /* ── Feed kg = orders kg + feed deliveries from target config ── */
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
  const seen = new Set();
  const dedupd = [
    ...pendWeekList.map((o) => ({ ...o, scope: "This Week" })),
    ...pendMonthList.map((o) => ({ ...o, scope: "This Month" })),
  ].filter((o) => {
    if (seen.has(o.orderId)) return false;
    seen.add(o.orderId);
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
      const m = topMuos[i];
      const s2 = topSatos[i];
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

  /* ── 9. All Other Products ── */
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

/* ══════════════════════════════════════════════════════
   POWERPOINT  EXPORT
══════════════════════════════════════════════════════ */

/* ── How many table rows fit on one slide (below a header bar) ──
   Available height ≈ 4.4 in after header (0.7) + footer (0.5)
   Each data row = ~0.32 in; header row = 0.38 in               */
const ROWS_PER_SLIDE = 11; // data rows only (safe, leaves room)

export async function exportToPptx(
  dashData,
  regionName = "All Regions",
  monthLabel = null,
  logoDataUrl = null,
) {
  const PptxGenJS = window.PptxGenJS;
  if (!PptxGenJS) {
    alert("PptxGenJS not loaded. Add pptxgenjs CDN to index.html.");
    return;
  }

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Chicken4U Dashboard";
  pres.author = "WAFAD Group";

  const month = monthLabel ?? nowLabel();

  /* ─── Shared text style helpers ─── */
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

  /* ─── Brand background helper ─── */
  function setBg(sl) {
    sl.background = { color: HEX.bg }; // warm cream #FFF8EE
  }

  /* ─── Shared header bar ─── */
  function hdr(sl, label, color = HEX.pri, sub = `${month}  ·  ${regionName}`) {
    setBg(sl);
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.68,
      fill: { color },
      line: { color },
    });
    sl.addText(label, {
      x: 0.3,
      y: 0,
      w: 6.5,
      h: 0.68,
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
      h: 0.68,
      margin: 0,
      fontSize: 10.5,
      color: "FFE0A0",
      fontFace: "Calibri",
      align: "right",
      valign: "middle",
    });
    /* bottom accent line */
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0.68,
      w: 10,
      h: 0.04,
      fill: { color: HEX.amber },
      line: { color: HEX.amber },
    });
  }

  /* ─── KPI card ─── */
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
    sl.addText(value, {
      x: x + 0.1,
      y: y + 0.42,
      w: w - 0.2,
      h: 0.75,
      ...V(color, 24),
    });
  }

  /* ─── Table header row builder ─── */
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

  /* ─── Paginated table helper ───────────────────────────────────────
     Draws one or more slides. Each slide gets the hdr bar, an optional
     small "page X / Y" label, and up to ROWS_PER_SLIDE data rows.
     colW  = array of column widths summing to ~9.2 in
  ─────────────────────────────────────────────────────────────────── */
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

      const rowH = 0.33;
      const tableH = rowH * tbl.length + 0.02;

      sl.addTable(tbl, {
        x: 0.4,
        y: 0.85,
        w: 9.2,
        h: tableH,
        fontSize: 10,
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

  /* ═══ DATA EXTRACTION ═══════════════════════════════════════════ */
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

  /* ── Pending (de-duplicated full list) ── */
  const seenPend = new Set();
  const allPending = [
    ...(s.pendingWeek?.list ?? []).map((o) => ({ ...o, scope: "This Week" })),
    ...(s.pendingMonth?.list ?? []).map((o) => ({ ...o, scope: "This Month" })),
  ].filter((o) => {
    if (seenPend.has(o.orderId)) return false;
    seenPend.add(o.orderId);
    return true;
  });

  /* ═══ SLIDE 1 – Title ═══════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    sl.background = { color: "1A0D02" }; // dark brand

    /* left accent bar */
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 0.18,
      h: 5.625,
      fill: { color: HEX.pri },
      line: { color: HEX.pri },
    });
    /* bottom bar */
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 4.82,
      w: 10,
      h: 0.805,
      fill: { color: HEX.pri },
      line: { color: HEX.pri },
    });

    /* Logo if available */
    if (logoDataUrl) {
      try {
        sl.addImage({ data: logoDataUrl, x: 0.5, y: 0.6, w: 1.1, h: 1.1 });
      } catch (_) {}
    }

    sl.addText("CHICKEN4U", {
      x: 0.45,
      y: logoDataUrl ? 1.85 : 1.0,
      w: 9,
      h: 0.85,
      ...T(HEX.surf, 52),
      charSpacing: 3,
    });
    sl.addText("Overview Dashboard", {
      x: 0.45,
      y: logoDataUrl ? 2.75 : 2.0,
      w: 9,
      h: 0.55,
      ...T(HEX.pri, 28),
    });
    sl.addText(`${month}  ·  Region: ${regionName}`, {
      x: 0.45,
      y: logoDataUrl ? 3.45 : 2.65,
      w: 9,
      h: 0.38,
      ...S(HEX.textSf, 15),
    });
    sl.addText("WAFAD GROUP – Real-Time Poultry Data", {
      x: 0.3,
      y: 4.87,
      w: 7,
      h: 0.45,
      fontSize: 13,
      color: HEX.surf,
      fontFace: "Calibri",
    });
    sl.addText(`Grow food. Earn Income. Changing lives.`, {
      x: 5.5,
      y: 4.87,
      w: 4.2,
      h: 0.45,
      fontSize: 10,
      italic: true,
      color: "FFD580",
      fontFace: "Calibri",
      align: "right",
    });
  }

  /* ═══ SLIDE 2 – KPI Overview ═══════════════════════════════════ */
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
    kpis.forEach((k, i) => {
      kpiCard(
        sl,
        0.25 + (i % 3) * 3.25,
        0.88 + Math.floor(i / 3) * 2.1,
        3.0,
        1.85,
        k.label,
        k.value,
        k.color,
      );
    });
  }

  /* ═══ SLIDE 3 – MUO Gender Split ═══════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "MUO Gender Split", HEX.purple);

    const total = n(muo.total);
    const male = n(muo.male);
    const female = n(muo.female);
    const fPct = total > 0 ? ((female / total) * 100).toFixed(1) + "%" : "0%";
    const mPct = total > 0 ? ((male / total) * 100).toFixed(1) + "%" : "0%";

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
      const x = 0.4 + i * 3.1;
      sl.addShape(pres.shapes.RECTANGLE, {
        x,
        y: 0.9,
        w: 2.85,
        h: 2.0,
        fill: { color: HEX.surf },
        line: { color: c.color + "44" },
        shadow: shadow(),
      });
      sl.addShape(pres.shapes.RECTANGLE, {
        x,
        y: 0.9,
        w: 2.85,
        h: 0.06,
        fill: { color: c.color },
        line: { color: c.color },
      });
      sl.addText(c.label.toUpperCase(), {
        x: x + 0.15,
        y: 1.05,
        w: 2.55,
        h: 0.26,
        ...LB(c.color),
      });
      sl.addText(c.value, {
        x: x + 0.1,
        y: 1.38,
        w: 2.65,
        h: 0.85,
        ...V(c.color, 34),
      });
      sl.addText(c.pct + " of total", {
        x: x + 0.15,
        y: 2.28,
        w: 2.55,
        h: 0.35,
        ...S(HEX.textSf, 12),
      });
    });

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
          y: 3.05,
          w: 9.0,
          h: 2.35,
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

  /* ═══ SLIDE 4 – Chick Distribution ══════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "Chick Distribution", HEX.amber);

    /* summary table */
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
        x: 0.4,
        y: 0.82,
        w: 9.2,
        h: 1.85,
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

    if (ordVals.some((v) => v > 0)) {
      sl.addChart(
        pres.charts.BAR,
        [
          { name: "Ordered", labels, values: ordVals },
          { name: "Delivered", labels, values: delVals },
          { name: "Pending", labels, values: penVals },
        ],
        {
          x: 0.4,
          y: 2.8,
          w: 9.2,
          h: 2.65,
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

  /* ═══ SLIDE 5 – Feed Used ════════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "Feed Overview", HEX.brownMd);

    const feedOrders = n(s.feedKgOrdered);
    const feedDel = n(s.feedDeliveriesOrdered);
    const feedDelDone = n(s.feedDeliveriesDelivered);
    const feedDelPend = feedDel - feedDelDone;

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
        0.3 + (i % 3) * 3.27,
        0.9 + Math.floor(i / 3) * 2.1,
        3.0,
        1.85,
        c.label,
        c.value,
        c.color,
      );
    });
  }

  /* ═══ SLIDE 6 – Monthly Trend ════════════════════════════════════ */
  if (trend.length > 0) {
    const sl = pres.addSlide();
    hdr(sl, "Monthly Chick Distribution");

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
        x: 0.4,
        y: 0.82,
        w: 9.2,
        h: 3.75,
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

    /* Summary stats row */
    const totals = trend.map(
      (d) => n(d.grangers) + n(d.layers) + n(d.broilers),
    );
    const peak = trend[totals.indexOf(Math.max(...totals))]?.label ?? "—";
    const avg = fmt(
      Math.round(totals.reduce((a, v) => a + v, 0) / totals.length),
    );
    const grand = fmt(totals.reduce((a, v) => a + v, 0));

    [
      { label: "Peak Month", value: peak, color: HEX.pri },
      { label: "Avg / Month", value: avg, color: HEX.sky },
      { label: "Grand Total", value: grand, color: HEX.purple },
    ].forEach((stat, i) => {
      kpiCard(
        sl,
        0.4 + i * 3.2,
        4.68,
        3.0,
        0.88,
        stat.label,
        stat.value,
        stat.color,
      );
    });
  }

  /* ═══ SLIDES 7+ – Pending Deliveries (paginated) ════════════════ */
  if (allPending.length > 0) {
    /* summary slide first */
    {
      const sl = pres.addSlide();
      hdr(sl, "Pending Deliveries", HEX.amber);

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
        const x = 0.4 + i * 4.8;
        sl.addShape(pres.shapes.RECTANGLE, {
          x,
          y: 0.88,
          w: 4.5,
          h: 1.35,
          fill: { color: HEX.surf },
          line: { color: c.color + "44" },
          shadow: shadow(),
        });
        sl.addShape(pres.shapes.RECTANGLE, {
          x,
          y: 0.88,
          w: 4.5,
          h: 0.06,
          fill: { color: c.color },
          line: { color: c.color },
        });
        sl.addText(c.label.toUpperCase(), {
          x: x + 0.15,
          y: 1.04,
          w: 4.2,
          h: 0.25,
          ...LB(c.color),
        });
        sl.addText(`${fmt(c.orders)} orders  ·  ${fmt(c.qty)} qty`, {
          x: x + 0.1,
          y: 1.35,
          w: 4.3,
          h: 0.55,
          ...V(c.color, 20),
        });
      });

      /* first chunk inline */
      const first = allPending.slice(0, ROWS_PER_SLIDE);
      const tblRows = first.map((o) => [
        o.scope ?? "",
        o.muoName ?? o.orderId ?? "",
        o.satoName ?? "",
        fmt(o.qty),
        o.expectedDate ?? "",
        o.status ?? "",
      ]);
      sl.addTable(
        [
          tblHdrRow(
            ["Scope", "MUO", "SATO", "Qty", "Exp. Date", "Status"],
            HEX.amber,
          ),
          ...tblRows,
        ],
        {
          x: 0.4,
          y: 2.38,
          w: 9.2,
          h: 0.36 + first.length * 0.33,
          fontSize: 9.5,
          fontFace: "Calibri",
          color: HEX.text,
          border: { type: "solid", pt: 0.5, color: HEX.bord },
          fill: { color: HEX.surf },
          rowH: 0.33,
          colW: [1.3, 2.1, 1.9, 0.85, 1.45, 1.6],
        },
      );

      if (allPending.length > ROWS_PER_SLIDE) {
        sl.addText(
          `Continued on next slide(s) — ${allPending.length} orders total`,
          {
            x: 0.4,
            y: 5.35,
            w: 9.2,
            h: 0.22,
            fontSize: 9,
            italic: true,
            color: HEX.textSf,
            fontFace: "Calibri",
          },
        );
      }
    }

    /* overflow pages */
    if (allPending.length > ROWS_PER_SLIDE) {
      const remaining = allPending.slice(ROWS_PER_SLIDE);
      const dataRows = remaining.map((o) => [
        o.scope ?? "",
        o.muoName ?? o.orderId ?? "",
        o.satoName ?? "",
        fmt(o.qty),
        o.expectedDate ?? "",
        o.status ?? "",
      ]);
      addPaginatedTable(
        "Pending Deliveries (cont.)",
        ["Scope", "MUO", "SATO", "Qty", "Exp. Date", "Status"],
        dataRows,
        [1.3, 2.1, 1.9, 0.85, 1.45, 1.6],
        HEX.amber,
      );
    }
  }

  /* ═══ SLIDES – Top Performers (paginated) ════════════════════════ */
  if (topMuos.length > 0 || topSatos.length > 0) {
    const DARK = "1A0D02";

    /* MUO slide */
    if (topMuos.length > 0) {
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
        const slice = muoRows.slice(
          p * ROWS_PER_SLIDE,
          (p + 1) * ROWS_PER_SLIDE,
        );
        sl.addTable(
          [tblHdrRow(["#", "MUO Name", "Chicks Delivered"], HEX.sky), ...slice],
          {
            x: 0.5,
            y: 0.85,
            w: 9.0,
            h: 0.4 + slice.length * 0.38,
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

    /* SATO slide */
    if (topSatos.length > 0) {
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
            h: 0.4 + slice.length * 0.38,
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
  }

  /* ═══ SLIDE – Sales Summary ══════════════════════════════════════ */
  {
    const sl = pres.addSlide();
    hdr(sl, "Sales Summary");

    [
      { label: "Grangers Sold", value: n(s.grangers), color: HEX.pri },
      { label: "Layers Sold", value: n(s.layers), color: HEX.green },
      { label: "Broilers Sold", value: n(s.broilers), color: HEX.sky },
    ].forEach((item, i) => {
      const x = 0.4 + i * 3.1;
      sl.addShape(pres.shapes.RECTANGLE, {
        x,
        y: 0.9,
        w: 2.9,
        h: 1.9,
        fill: { color: item.color + "15" },
        line: { color: item.color + "55" },
        shadow: shadow(),
      });
      sl.addShape(pres.shapes.RECTANGLE, {
        x,
        y: 0.9,
        w: 2.9,
        h: 0.06,
        fill: { color: item.color },
        line: { color: item.color },
      });
      sl.addText(item.label.toUpperCase(), {
        x: x + 0.15,
        y: 1.06,
        w: 2.6,
        h: 0.26,
        ...LB(item.color),
      });
      sl.addText(fmt(item.value), {
        x: x + 0.1,
        y: 1.4,
        w: 2.7,
        h: 0.75,
        ...V(item.color, 32),
      });
    });

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
          y: 2.95,
          w: 9,
          h: 2.55,
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

  /* ═══ LAST SLIDE – Brand Closing ════════════════════════════════ */
  {
    const sl = pres.addSlide();
    sl.background = { color: HEX.bg }; // warm cream

    /* Top gold bar */
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.08,
      fill: { color: HEX.pri },
      line: { color: HEX.pri },
    });
    /* Bottom gold bar */
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 5.425,
      w: 10,
      h: 0.2,
      fill: { color: HEX.pri },
      line: { color: HEX.pri },
    });
    /* Gold border rect */
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0.3,
      y: 0.3,
      w: 9.4,
      h: 4.85,
      fill: { type: "none" },
      line: { color: HEX.bord, pt: 1.5, dashType: "dash" },
    });

    /* Logo */
    if (logoDataUrl) {
      try {
        sl.addImage({ data: logoDataUrl, x: 3.8, y: 0.65, w: 2.4, h: 2.4 });
      } catch (_) {}
    } else {
      /* Fallback: stylised chicken icon placeholder */
      sl.addShape(pres.shapes.OVAL, {
        x: 4.2,
        y: 0.7,
        w: 1.6,
        h: 1.6,
        fill: { color: HEX.pri + "22" },
        line: { color: HEX.pri, pt: 2 },
      });
      sl.addText("🐔", {
        x: 4.2,
        y: 0.9,
        w: 1.6,
        h: 1.2,
        fontSize: 48,
        align: "center",
        valign: "middle",
      });
    }

    sl.addText("CHICKEN4U", {
      x: 0.5,
      y: 3.25,
      w: 9,
      h: 0.55,
      fontSize: 36,
      bold: true,
      color: HEX.pri,
      fontFace: "Trebuchet MS",
      align: "center",
      charSpacing: 4,
    });
    sl.addText("by WAFAD GROUP", {
      x: 0.5,
      y: 3.85,
      w: 9,
      h: 0.32,
      fontSize: 14,
      color: HEX.textMd,
      fontFace: "Calibri",
      align: "center",
    });
    sl.addText("CHICKS  |  FEEDS  |  EGGS  |  CHICKEN", {
      x: 0.5,
      y: 4.22,
      w: 9,
      h: 0.28,
      fontSize: 11,
      color: HEX.textSf,
      fontFace: "Calibri",
      align: "center",
      charSpacing: 2,
    });

    /* Tagline bar */
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 2.0,
      y: 4.6,
      w: 6.0,
      h: 0.42,
      fill: { color: HEX.pri },
      line: { color: HEX.pri },
    });
    sl.addText("Grow food.  Earn Income.  Changing lives.", {
      x: 2.0,
      y: 4.6,
      w: 6.0,
      h: 0.42,
      fontSize: 13,
      bold: true,
      color: HEX.surf,
      fontFace: "Trebuchet MS",
      align: "center",
      valign: "middle",
    });

    /* Footer contacts */
    sl.addText(`${regionName}  ·  ${month}  ·  wafadgroup`, {
      x: 0,
      y: 5.42,
      w: 10,
      h: 0.2,
      fontSize: 8,
      color: HEX.surf,
      fontFace: "Calibri",
      align: "center",
      valign: "middle",
    });
  }

  /* ── Save ── */
  await pres.writeFile({
    fileName: `Chicken4U_Dashboard_${safeFileName(regionName)}_${fileDate()}.pptx`,
  });
}
