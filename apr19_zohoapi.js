/* ══════════════════════════════════════════════════
   zohoapi.js  —  Chicken4U Poultry Dashboard
   JS API v2 — Sequential requests (iOS compatible)
   Paginator uses record_cursor (v2 style)
══════════════════════════════════════════════════ */

let _zohoReady = false;
async function zohoInit() {
  // if (_zohoReady) return;
  // await ZOHO.CREATOR.init();
  _zohoReady = true;
}


let _muoCache = null;
let _muoStatsCache = null;

const DEFAULT_MUO = { total: 0, male: 0, female: 0, sspTotal: 0 };
const DEFAULT_SALES = {
  grangers: 0,
  grangerBreeds: {}, grangerBreeedsDel: {}, grangerBreedsPend: {},
  grangersDelivered: 0, grangersPending: 0,
  layers: 0,
  layerBreeds: {}, layerBreedsDel: {}, layerBreedsPend: {},
  broilers: 0,
  broilerBreeds: {}, broilerBreedsDel: {}, broilerBreedsPend: {},
  chicksOrdered: 0, chicksDelivered: 0, chicksPending: 0,
  layersOrdered: 0, broilersOrdered: 0,
  layersDelivered: 0, broilersDelivered: 0,
  layersPending: 0, broilersPending: 0,
  ordersDelivered: 0, ordersPending: 0,
  allProducts: {},
  feedKgOrdered: 0, feedKgDelivered: 0, feedKgPending: 0,
  topMuos: [],
  topSatos: [],
  pendingWeek: { qty: 0, orders: 0, list: [] },
  pendingMonth: { qty: 0, orders: 0, list: [] },
};
const DEFAULT_WEEKLY = { mortality: 0, feedKg: 0, birdsSold: 0, revenue: 0, sickBirds: 0 };

/* ── v2 Paginator (sequential, uses record_cursor) ── */
async function fetchAllRecords(reportName, criteria = null) {
  const all = [];
  let record_cursor = null;

  while (true) {
    const config = {
      report_name: reportName,
      max_records: 1000,
      field_config: "all",
    };
    if (criteria) config.criteria = criteria;
    if (record_cursor) config.record_cursor = record_cursor;

    let res;
    try {
      res = await ZOHO.CREATOR.DATA.getRecords(config);
    } catch (err) {
      console.error(`[zohoapi] fetchAllRecords(${reportName}) threw:`, err);
      break;
    }

    if (!res || res.code !== 3000) {
      if (res && res.code !== 3100) {
        console.error(`[zohoapi] fetchAllRecords(${reportName}) code=${res?.code}:`, res);
      } else {
        console.warn(`[zohoapi] ${reportName} → no data / 3100`);
      }
      break;
    }

    const records = res.data ?? [];
    all.push(...records);

    // v2 pagination: record_cursor comes in response headers or response root
    const cursor = res.record_cursor ?? res?.headers?.record_cursor ?? null;
    if (!cursor || records.length < 1000) break;
    record_cursor = cursor;
  }

  return all;
}

/* ── Resolve lookup / object / plain value → string ── */
function displayVal(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    // v2.1 returns zc_display_value alongside display_value
    return (v.zc_display_value ?? v.display_value ?? v.name ?? "").toString();
  }
  return v.toString();
}

/* ── Add qty to a breed map ─────────────────────── */
function addBreed(map, breed, qty) {
  if (!breed) return;
  map[breed] = (map[breed] ?? 0) + qty;
}

/* ── Date helpers ────────────────────────────────── */
function getDateRanges() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  return { startOfWeek, endOfWeek, startOfMonth, endOfMonth };
}

/* ── Feed keyword check ─────────────────────────── */
function isFeedProduct(name, type) {
  const u = (name + " " + type).toUpperCase();
  return (
    u.includes("FEED") || u.includes("FEEDS") || u.includes("MASH") ||
    u.includes("PELLET") || u.includes("STARTER") || u.includes("FINISHER") ||
    u.includes("GROWER")
  );
}

/* ── Classify product into category ─────────────── */
function classifyProduct(productName, productType) {
  const u = (productName + " " + productType).toUpperCase();
  if (u.includes("GRANGER") || u.includes("COCK")) return "chick";
  if (u.includes("LAYER") || u.includes("NOVO")) return "chick";
  if (u.includes("BROILER")) return "chick";
  if (isFeedProduct(productName, productType)) return "feed";
  if (u.includes("MEDIC") || u.includes("VACCINE") || u.includes("DRUG") || u.includes("VITAMIN") || u.includes("ANTIBIOTIC") || u.includes("DEWORM")) return "medication";
  if (u.includes("DISINFECT") || u.includes("CLEAN") || u.includes("SANITIZ")) return "sanitation";
  if (u.includes("EQUIP") || u.includes("FEEDER") || u.includes("DRINKER") || u.includes("WATERER") || u.includes("CAGE") || u.includes("LAMP") || u.includes("BULB")) return "equipment";
  return "other";
}

/* ─────────────────────────────────────────────────
   1. REGIONS  (sequential — single fetch)
───────────────────────────────────────────────── */
export async function fetchRegions() {
  await zohoInit();
  const records = await fetchAllRecords("All_Region_Details");
  return records.map(r => ({ id: r.ID ?? "", name: r.Region_Name ?? "" }));
}

/* ─────────────────────────────────────────────────
   2. MUO COUNTS  (sequential)
───────────────────────────────────────────────── */
export async function fetchMuoGenderCounts(regionId = null) {
  await zohoInit();
  const criteria = regionId ? `Region == ${regionId}` : null;
  const records = await fetchAllRecords("All_Muo_Profiles", criteria);

  if (records.length > 0) console.log("[zohoapi] MUO sample:", records[0]);

  let male = 0, female = 0;
  records.forEach(r => {
    const g = (r.Gender ?? "").toString().toLowerCase().trim();
    if (g === "male") male++;
    else if (g === "female") female++;
  });

  // Try every plausible field name for SSP count
  const sspTotal = records.reduce((sum, r) => {
    const v =
      r.No_of_SSPs ?? r.No_Of_SSPs ?? r.no_of_ssps ??
      r.SSPs ?? r.Ssps ?? r.Number_of_SSPs ??
      r.SSP_Count ?? r.No_SSPs ?? r.SSP ?? 0;
    return sum + (Number(v) || 0);
  }, 0);

  console.log("[zohoapi] MUO →", { total: records.length, male, female, sspTotal });
  return { total: records.length, male, female, sspTotal };
}

/* ─────────────────────────────────────────────────
   3. CERTIFIED LEARNERS  (sequential)
───────────────────────────────────────────────── */
export async function fetchCertifiedLearnersCount(regionId = null) {
  await zohoInit();
  const base = `Status == "Certified"`;
  const criteria = regionId ? `${base} && Region == ${regionId}` : base;
  const records = await fetchAllRecords("All_Learner_Registrations", criteria);
  console.log("[zohoapi] Certified learners →", records.length);
  return records.length;
}

/* ─────────────────────────────────────────────────
   4. COMPREHENSIVE SALES ORDER SUMMARY
   Sequential: fetch parent list THEN subform rows
───────────────────────────────────────────────── */
export async function fetchSalesOrderSummary(regionId = null) {
  console.log("<------- fetchSalesOrderSummary initiated ------>");
  await zohoInit();

  // ── Step 1: fetch parent records (sequential) ──
  const parentList = await fetchAllRecords("Field_Visit_Sales_Order_Report");
  console.log(`[zohoapi] Parents: ${parentList.length}`);

  // ── Step 2: fetch subform rows (sequential) ──
  const sfRows = await fetchAllRecords("Field_Visit_Sales_Order_Master_SF_Report");
  console.log(`[zohoapi] SF rows: ${sfRows.length}`);

  // ── Step 3: region filter (sequential) ──
  let filterRegionName = "";
  if (regionId) {
    const regions = await fetchAllRecords("All_Region_Details");
    filterRegionName = (
      regions.find(r => String(r.ID) === String(regionId))?.Region_Name ?? ""
    ).toLowerCase().trim();
    console.log(`[zohoapi] Region filter: "${filterRegionName}"`);
  }

  /* ── Date ranges ── */
  const { startOfWeek, endOfWeek, startOfMonth, endOfMonth } = getDateRanges();

  /* ── Build order meta map ── */
  const orderMetaMap = new Map();
  for (const rec of parentList) {
    const orderId = String(rec.ID ?? "");
    const statusRaw = displayVal(rec.Order_Status ?? rec.Status ?? "").toLowerCase().trim();
    const isDelivered = statusRaw === "delivered";
    const paymentStatusRaw = displayVal(rec.Payment_Status ?? "").toLowerCase().trim();
    const isPaid = paymentStatusRaw === "paid";
    const regionName = displayVal(rec["MUO.Region"] ?? rec.Region ?? "").toLowerCase().trim();
    const muoName = displayVal(
      rec["MUO.MUO_Name"] ?? rec["MUO.Name"] ?? rec["MUO.Full_Name"] ?? rec.MUO ?? ""
    ).trim();
    const satoName = displayVal(
      rec["SATO.SATO_Name"] ?? rec["SATO.Name"] ?? rec["SATO.Full_Name"] ?? rec.SATO ?? ""
    ).trim();
    let expectedDate = null;
    const edd = rec.Expected_Delivery_Date ?? rec.Expected_Date ?? rec.Delivery_Date ?? "";
    if (edd) { try { expectedDate = new Date(edd); } catch (e) { } }

    orderMetaMap.set(orderId, {
      isDelivered, isPaid, regionName,
      muoName, satoName, expectedDate, statusRaw,
    });
  }

  /* ── Aggregation ── */
  let grangers = 0, layers = 0, broilers = 0;
  const grangerBreeds = {}, layerBreeds = {}, broilerBreeds = {};
  let grangersDelivered = 0, grangersPending = 0;
  let layersDelivered = 0, broilersDelivered = 0;
  let layersPending = 0, broilersPending = 0;
  const layerBreedsDel = {}, layerBreedsPend = {};
  const broilerBreedsDel = {}, broilerBreedsPend = {};
  const grangerBreedsDel = {}, grangerBreedsPend = {};
  let ordersDelivered = 0, ordersPending = 0;
  const seenOrders = new Set();

  const allProductsMap = {};

  // Feed totals derived from allProducts
  let feedKgOrdered = 0, feedKgDelivered = 0, feedKgPending = 0;

  const muoMap = {};
  const satoMap = {};

  let pendingWeekQty = 0, pendingMonthQty = 0;
  const seenWeekOrders = new Set(), seenMonthOrders = new Set();
  const pendingWeekList = [], pendingMonthList = [];

  const unmatchedProducts = new Set();

  for (const row of sfRows) {
    const qty = Number(row.Quantity ?? 0);
    if (qty === 0) continue;

    const orderId = row.SO_Reference?.ID;
    if (!orderId) continue;

    const meta = orderMetaMap.get(String(orderId));
    if (!meta) continue;

    const { isDelivered, isPaid, regionName, muoName, satoName, expectedDate } = meta;
    if (filterRegionName && !regionName.includes(filterRegionName)) continue;

    if (!seenOrders.has(orderId)) {
      seenOrders.add(orderId);
      if (isDelivered) ordersDelivered++;
      else ordersPending++;
    }

    const productName = displayVal(row.Product ?? "").trim();
    const productType = displayVal(row.Product_Type ?? "").trim();
    const productKey = productName || productType || "Unknown";
    const productUpper = productName.toUpperCase();
    const category = classifyProduct(productName, productType);

    /* ── ALL PRODUCTS tracking ── */
    if (!allProductsMap[productKey]) {
      allProductsMap[productKey] = {
        ordered: 0, delivered: 0, pending: 0,
        category,
        types: {},
      };
    }
    allProductsMap[productKey].ordered += qty;
    if (isDelivered) allProductsMap[productKey].delivered += qty;
    else allProductsMap[productKey].pending += qty;
    if (productType) {
      allProductsMap[productKey].types[productType] =
        (allProductsMap[productKey].types[productType] ?? 0) + qty;
    }

    /* ── Feed KG totals ── */
    if (category === "feed") {
      feedKgOrdered += qty;
      if (isDelivered) feedKgDelivered += qty;
      else feedKgPending += qty;
    }

    /* ── TOP MUOs (by chicks delivered) ── */
    if (muoName && category === "chick") {
      if (!muoMap[muoName]) muoMap[muoName] = { ordered: 0, delivered: 0 };
      muoMap[muoName].ordered += qty;
      if (isDelivered) muoMap[muoName].delivered += qty;
    }

    /* ── TOP SATOs (by chicks with full payment) ── */
    if (satoName && category === "chick") {
      if (!satoMap[satoName]) satoMap[satoName] = { paidQty: 0, totalQty: 0 };
      satoMap[satoName].totalQty += qty;
      if (isPaid) satoMap[satoName].paidQty += qty;
    }

    /* ── PENDING DELIVERIES by date ── */
    if (!isDelivered && expectedDate && !isNaN(expectedDate)) {
      if (expectedDate >= startOfWeek && expectedDate <= endOfWeek) {
        pendingWeekQty += qty;
        if (!seenWeekOrders.has(String(orderId))) {
          seenWeekOrders.add(String(orderId));
          pendingWeekList.push({
            orderId: String(orderId), muoName, satoName,
            expectedDate: expectedDate.toISOString().split("T")[0],
            status: meta.statusRaw,
          });
        }
      }
      if (expectedDate >= startOfMonth && expectedDate <= endOfMonth) {
        pendingMonthQty += qty;
        if (!seenMonthOrders.has(String(orderId))) {
          seenMonthOrders.add(String(orderId));
          pendingMonthList.push({
            orderId: String(orderId), muoName, satoName,
            expectedDate: expectedDate.toISOString().split("T")[0],
            status: meta.statusRaw,
          });
        }
      }
    }

    /* ── CHICK CATEGORY breakdown ── */
    const name = productUpper || productType.toUpperCase();
    if (name.includes("GRANGER") || name.includes("COCK")) {
      grangers += qty;
      addBreed(grangerBreeds, productType, qty);
      if (isDelivered) { grangersDelivered += qty; addBreed(grangerBreedsDel, productType, qty); }
      else { grangersPending += qty; addBreed(grangerBreedsPend, productType, qty); }
    } else if (name.includes("LAYER") || name.includes("NOVO")) {
      layers += qty;
      addBreed(layerBreeds, productType, qty);
      if (isDelivered) { layersDelivered += qty; addBreed(layerBreedsDel, productType, qty); }
      else { layersPending += qty; addBreed(layerBreedsPend, productType, qty); }
    } else if (name.includes("BROILER")) {
      broilers += qty;
      addBreed(broilerBreeds, productType, qty);
      if (isDelivered) { broilersDelivered += qty; addBreed(broilerBreedsDel, productType, qty); }
      else { broilersPending += qty; addBreed(broilerBreedsPend, productType, qty); }
    } else {
      if (category !== "feed" && category !== "medication" && category !== "sanitation" && category !== "equipment") {
        unmatchedProducts.add(productName || "[empty]");
      }
    }
  }

  if (unmatchedProducts.size > 0) {
    console.log("[zohoapi] Non-chick/feed products found:", [...unmatchedProducts]);
  }

  /* ── Sort top performers ── */
  const topMuos = Object.entries(muoMap)
    .map(([name, d]) => ({ name, value: d.delivered, ordered: d.ordered }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const topSatos = Object.entries(satoMap)
    .map(([name, d]) => ({ name, value: d.paidQty, totalQty: d.totalQty }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  pendingWeekList.sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));
  pendingMonthList.sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));

  const result = {
    grangers, grangerBreeds, grangerBreedsDel, grangerBreedsPend, grangersDelivered, grangersPending,
    layers, layerBreeds, layerBreedsDel, layerBreedsPend,
    broilers, broilerBreeds, broilerBreedsDel, broilerBreedsPend,
    chicksOrdered: grangers + layers + broilers,
    chicksDelivered: grangersDelivered + layersDelivered + broilersDelivered,
    chicksPending: grangersPending + layersPending + broilersPending,
    layersOrdered: layers, broilersOrdered: broilers,
    layersDelivered, broilersDelivered, layersPending, broilersPending,
    ordersDelivered, ordersPending,
    allProducts: allProductsMap,
    // Feed totals — passed directly to dashboard
    feedKgOrdered, feedKgDelivered, feedKgPending,
    topMuos,
    topSatos,
    pendingWeek: {
      qty: pendingWeekQty,
      orders: seenWeekOrders.size,
      list: pendingWeekList.slice(0, 20),
    },
    pendingMonth: {
      qty: pendingMonthQty,
      orders: seenMonthOrders.size,
      list: pendingMonthList.slice(0, 20),
    },
  };

  console.log("[zohoapi] Sales summary →", {
    grangers, layers, broilers,
    feedKgOrdered, feedKgDelivered,
    topMuos: topMuos.length,
    topSatos: topSatos.length,
    allProductsCount: Object.keys(allProductsMap).length,
    pendingWeekOrders: seenWeekOrders.size,
    pendingMonthOrders: seenMonthOrders.size,
  });
  return result;
}

/* ─────────────────────────────────────────────────
   5. WEEKLY OPERATION LOGS  (sequential)
───────────────────────────────────────────────── */
export async function fetchWeeklyMetrics(regionId = null) {
  await zohoInit();

  const reportCandidates = [
    "All_Weekly_Operation_Logs",
    "All_Weekly_Operations",
    "Field_Visit_Weekly_Summary",
    "All_Weekly_Operation_Logs",
    "Weekly_Operations_Report",
    "Weekly_Metrics_Report",
    "All_Weekly_Metrics",
  ];

  let records = [];
  // Sequential — try each report name one at a time
  for (const name of reportCandidates) {
    const r = await fetchAllRecords(name);
    if (r.length > 0) {
      records = r;
      console.log(`[zohoapi] Weekly found in: "${name}", count: ${r.length}`);
      break;
    }
  }

  if (records.length === 0) {
    console.error("[zohoapi] Weekly: report not found.");
    return DEFAULT_WEEKLY;
  }

  let allowedMuoIds = null;
  if (regionId) {
    // Sequential — fetch MUOs after reports
    const muos = await fetchAllRecords("All_Muo_Profiles", `Region.ID == "${regionId}"`);
    allowedMuoIds = new Set(muos.map(m => String(m.ID)));
  }

  let mortality = 0, feedKg = 0, birdsSold = 0, revenue = 0, sickBirds = 0;

  for (const rec of records) {
    if (allowedMuoIds) {
      const muoId = String(rec.MUO?.ID ?? rec.MUO ?? "");
      if (!allowedMuoIds.has(muoId)) continue;
    }
    const metrics = rec.Weekly_Metrics ?? [];
    for (const m of metrics) {
      const rawName = m.Weekly_Metrics ?? m.Metric_Type ?? m.metric_type ?? m.Name ?? m.name ?? "";
      const name = displayVal(rawName).toLowerCase().trim();
      const qty = Number(m.Quantity) || 0;
      if (name.includes("mortality")) mortality += qty;
      else if (name.includes("feed")) feedKg += qty;
      else if (name.includes("birds sold")) birdsSold += qty;
      else if (name.includes("revenue")) revenue += qty;
      else if (name.includes("sick")) sickBirds += qty;
    }
  }

  const result = { mortality, feedKg, birdsSold, revenue, sickBirds };
  console.log("[zohoapi] Weekly →", result);
  return result;
}

/* ─────────────────────────────────────────────────
   6. COMBINED DASHBOARD FETCH
   ⚠️  All fetches are SEQUENTIAL — no Promise.all / 
       Promise.allSettled (iOS native app requirement)
───────────────────────────────────────────────── */
export async function fetchDashboardData(regionId = null) {
  await zohoInit();

  // ── Sequential chain ──
  let muo = DEFAULT_MUO;
  try {
    muo = await fetchMuoGenderCounts(regionId);
  } catch (e) {
    console.error("[zohoapi] MUO failed:", e);
  }

  let learners = 0;
  try {
    learners = await fetchCertifiedLearnersCount(regionId);
  } catch (e) {
    console.error("[zohoapi] Learners failed:", e);
  }

  let sales = DEFAULT_SALES;
  try {
    sales = await fetchSalesOrderSummary(regionId);
  } catch (e) {
    console.error("[zohoapi] Sales failed:", e);
  }

  let weekly = DEFAULT_WEEKLY;
  try {
    weekly = await fetchWeeklyMetrics(regionId);
  } catch (e) {
    console.error("[zohoapi] Weekly failed:", e);
  }

  return { muo, learners, sales, weekly };
}


async function loadMuoData() {
  if (_muoStatsCache) return; // already computed

  await zohoInit();

  console.log("[zohoapi] Loading MUO data (one-time)");

  const records = await fetchAllRecords("All_Muo_Profiles");

  _muoCache = records;

  const statsByRegion = {};
  const overall = { total: 0, male: 0, female: 0, sspTotal: 0 };

  for (const r of records) {
    const regionId = r.Region?.ID || "unknown";

    if (!statsByRegion[regionId]) {
      statsByRegion[regionId] = { total: 0, male: 0, female: 0, sspTotal: 0 };
    }

    const gender = (r.Gender ?? "").toString().toLowerCase().trim();
    const ssp = Number(r.No_of_SSPs) || 0;

    // overall
    overall.total++;
    overall.sspTotal += ssp;
    if (gender === "male") overall.male++;
    else if (gender === "female") overall.female++;

    // region-wise
    const bucket = statsByRegion[regionId];
    bucket.total++;
    bucket.sspTotal += ssp;
    if (gender === "male") bucket.male++;
    else if (gender === "female") bucket.female++;
  }

  _muoStatsCache = {
    overall,
    byRegion: statsByRegion,
  };
}

