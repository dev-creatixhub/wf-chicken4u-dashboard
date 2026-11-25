/* ══════════════════════════════════════════════════
   zohoapi.js  —  Chicken4U Poultry Dashboard
══════════════════════════════════════════════════ */

let _zohoReady = false;
async function zohoInit() {
  if (_zohoReady) return;
  await ZOHO.CREATOR.init();
  _zohoReady = true;
}

const DEFAULT_MUO = { total: 0, male: 0, female: 0, sspTotal: 0 };
const DEFAULT_SALES = {
  grangers: 0, layers: 0, broilers: 0,
  chicksOrdered: 0, chicksDelivered: 0, chicksPending: 0,
  layersOrdered: 0, broilersOrdered: 0,
  layersDelivered: 0, broilersDelivered: 0,
  layersPending: 0, broilersPending: 0,
  ordersDelivered: 0, ordersPending: 0,
};
const DEFAULT_WEEKLY = { mortality: 0, feedKg: 0, birdsSold: 0, revenue: 0, sickBirds: 0 };

/* ── Paginator ───────────────────────────────────── */
async function fetchAllRecords(reportName, criteria = null) {
  const all = [];
  let page = 1;
  while (true) {
    const params = { reportName, page, pageSize: 200 };
    if (criteria) params.criteria = criteria;
    const res = await ZOHO.CREATOR.API.getAllRecords(params);
    if (res.code !== 3000) {
      if (res.code !== 3100) {
        console.error(`[zohoapi] fetchAllRecords(${reportName}) code=${res.code}:`, res);
      } else {
        console.warn(`[zohoapi] ${reportName} → 3100 No Data`);
      }
      break;
    }
    const records = res.data ?? [];
    all.push(...records);
    if (records.length < 200) break;
    page++;
  }
  return all;
}

/* ── Resolve lookup / object / plain value → string ── */
function displayVal(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return (v.display_value ?? v.name ?? "").toString();
  return v.toString();
}

/* ─────────────────────────────────────────────────
   1. REGIONS
───────────────────────────────────────────────── */
export async function fetchRegions() {
  await zohoInit();
  const records = await fetchAllRecords("All_Region_Details");
  return records.map(r => ({ id: r.ID ?? "", name: r.Region_Name ?? "" }));
}

/* ─────────────────────────────────────────────────
   2. MUO COUNTS
───────────────────────────────────────────────── */
export async function fetchMuoGenderCounts(regionId = null) {
  await zohoInit();
  const criteria = regionId ? `Region.ID == "${regionId}"` : null;
  const records = await fetchAllRecords("All_Muo_Profiles", criteria);

  if (records.length > 0) console.log("[zohoapi] MUO sample:", records[0]);

  let male = 0, female = 0;
  records.forEach(r => {
    const g = (r.Gender ?? "").toString().toLowerCase().trim();
    if (g === "male") male++;
    else if (g === "female") female++;
  });

  const sspTotal = records.reduce((sum, r) => {
    const v = r.No_of_SSPs ?? r.No_Of_SSPs ?? r.no_of_ssps
      ?? r.SSPs ?? r.Ssps ?? r.Number_of_SSPs
      ?? r.SSP_Count ?? r.No_SSPs ?? 0;
    return sum + (Number(v) || 0);
  }, 0);

  console.log("[zohoapi] MUO →", { total: records.length, male, female, sspTotal });
  return { total: records.length, male, female, sspTotal };
}

/* ─────────────────────────────────────────────────
   3. CERTIFIED LEARNERS
───────────────────────────────────────────────── */
export async function fetchCertifiedLearnersCount(regionId = null) {
  await zohoInit();
  const base = `Status == "Certified"`;
  const criteria = regionId ? `${base} && Region.ID == "${regionId}"` : base;
  const records = await fetchAllRecords("All_Learner_Registrations", criteria);
  console.log("[zohoapi] Certified learners →", records.length);
  return records.length;
}

/* ─────────────────────────────────────────────────
   4. FIELD VISIT SALES ORDERS
   ─────────────────────────────────────────────────
   What we know:
   • Subform report "Field_Visist_Sales_Order_Master_SF_Report"
     returns rows with: Product {display_value, ID}, Quantity,
     Product_Type, Unit_Price, Line_Total, ID
     BUT has NO parent order ID or region field.
   
   • Parent report "Field_Visit_Sales_Order_Report"
     returns: ID, Order_Status, MUO.Region, Item_Details[]
     where Item_Details[i].ID = subform row ID
     and   Item_Details[i].display_value = product name
   
   Strategy:
   1. Fetch parent report → build map:
        subformRowId → { isDelivered, regionName, orderId }
   2. Fetch subform report → each row has Quantity + ID
   3. Join via subformRowId to get status + region per row
   4. Filter by region, aggregate quantities
───────────────────────────────────────────────── */
export async function fetchSalesOrderSummary(regionId = null) {
  await zohoInit();

  /* ── Step 1: fetch parent orders ── */
  const parentList = await fetchAllRecords("Field_Visit_Sales_Order_Report");
  console.log(`[zohoapi] Parent orders: ${parentList.length}`);

  // Resolve regionId → region name for filtering
  let filterRegionName = "";
  if (regionId) {
    const regions = await fetchAllRecords("All_Region_Details");
    filterRegionName = (
      regions.find(r => String(r.ID) === String(regionId))?.Region_Name ?? ""
    ).toLowerCase().trim();
    console.log(`[zohoapi] Region filter name: "${filterRegionName}"`);
  }

  /* ── Build subformRowId → meta map from parent records ── */
  // subformRowId → { isDelivered, regionName, orderId }
  const sfRowMeta = new Map();
  // orderId → isDelivered (for counting unique orders)
  const orderDelivered = new Map();

  for (const rec of parentList) {
    const orderId = String(rec.ID ?? "");
    const statusRaw = displayVal(rec.Order_Status ?? rec.Status ?? "").toLowerCase().trim();
    const isDelivered = statusRaw === "delivered";
    // "MUO.Region" is the dot-notation field Zoho joins into the report
    const regionName = displayVal(rec["MUO.Region"] ?? rec.Region ?? "").toLowerCase().trim();

    orderDelivered.set(orderId, { isDelivered, regionName });

    const items = rec.Item_Details ?? [];
    for (const item of items) {
      const sfId = String(item.ID ?? "");
      if (sfId) {
        sfRowMeta.set(sfId, { isDelivered, regionName, orderId });
      }
    }
  }

  console.log(`[zohoapi] Subform row IDs mapped: ${sfRowMeta.size}`);

  /* ── Step 2: fetch subform report ── */
  const sfRows = await fetchAllRecords("Field_Visist_Sales_Order_Master_SF_Report");
  console.log(`[zohoapi] Subform rows fetched: ${sfRows.length}`);

  /* ── Step 3: aggregate ── */
  let grangers = 0, layers = 0, broilers = 0;
  let layersDelivered = 0, broilersDelivered = 0;
  let layersPending = 0, broilersPending = 0;
  let ordersDelivered = 0, ordersPending = 0;
  const seenOrders = new Set();
  const unmatchedProducts = new Set();

  for (const row of sfRows) {
    const sfId = String(row.ID ?? "");
    const meta = sfRowMeta.get(sfId);

    // If we can't find this row in the parent map, skip
    // (shouldn't happen but guards against orphaned rows)
    if (!meta) {
      console.warn(`[zohoapi] SF row ${sfId} not found in parent map — skipping`);
      continue;
    }

    const { isDelivered, regionName, orderId } = meta;

    // Region filter — skip rows not in selected region
    if (filterRegionName && !regionName.includes(filterRegionName)) {
      continue;
    }

    // Count each unique parent order once
    if (orderId && !seenOrders.has(orderId)) {
      seenOrders.add(orderId);
      if (isDelivered) ordersDelivered++; else ordersPending++;
    }

    // Product name from subform row (lookup object)
    const productName = displayVal(row.Product ?? "").toUpperCase().trim();
    const qty = Number(row.Quantity ?? 0);

    if (qty === 0) continue;

    if (productName.includes("GRANGER")) {
      grangers += qty;
    } else if (productName.includes("LAYER")) {
      layers += qty;
      if (isDelivered) layersDelivered += qty; else layersPending += qty;
    } else if (productName.includes("BROILER")) {
      broilers += qty;
      if (isDelivered) broilersDelivered += qty; else broilersPending += qty;
    } else if (productName.includes("COCK")) {
      // Cocks counted under grangers sold (live bird sales)
      grangers += qty;
    } else {
      unmatchedProducts.add(productName || "[empty]");
    }
  }

  if (unmatchedProducts.size > 0) {
    console.log("[zohoapi] Unmatched products (not counted):", [...unmatchedProducts]);
  }

  const result = {
    grangers, layers, broilers,
    chicksOrdered: layers + broilers,
    chicksDelivered: layersDelivered + broilersDelivered,
    chicksPending: layersPending + broilersPending,
    layersOrdered: layers,
    broilersOrdered: broilers,
    layersDelivered, broilersDelivered,
    layersPending, broilersPending,
    ordersDelivered, ordersPending,
  };
  console.log("[zohoapi] Sales →", result);
  return result;
}

/* ─────────────────────────────────────────────────
   5. WEEKLY OPERATION LOGS
   Report name confirmed as still missing — keeping
   candidates list. Add the correct name here once
   you find it in Zoho Creator → Reports.
───────────────────────────────────────────────── */
export async function fetchWeeklyMetrics(regionId = null) {
  await zohoInit();

  const reportCandidates = [
    "All_Weekly_Operation_Logs",
    "Weekly_Operation_Logs",
    "All_Weekly_Operations",
    "Field_Visit_Weekly_Summary",
    "Field_Visit_Weekly_Su",
    "All_Weekly_operation_Logs",
    "Weekly_Operations_Report",
    "Weekly_Metrics_Report",
    "All_Weekly_Metrics",
  ];

  let records = [];
  for (const name of reportCandidates) {
    const r = await fetchAllRecords(name);
    if (r.length > 0) {
      records = r;
      console.log(`[zohoapi] Weekly found in: "${name}", count: ${r.length}`);
      break;
    }
  }

  if (records.length === 0) {
    console.error(
      "[zohoapi] Weekly: not found. Go to Zoho Creator → your app → Reports, " +
      "find the report for Weekly_operation_Log_Form, copy its link name exactly, " +
      "and add it to the reportCandidates array in fetchWeeklyMetrics()."
    );
    return DEFAULT_WEEKLY;
  }

  console.log("[zohoapi] Weekly sample:", JSON.stringify(records[0], null, 2));

  let allowedMuoIds = null;
  if (regionId) {
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
───────────────────────────────────────────────── */
export async function fetchDashboardData(regionId = null) {
  await zohoInit();

  const [muoRes, learnersRes, salesRes, weeklyRes] = await Promise.allSettled([
    fetchMuoGenderCounts(regionId),
    fetchCertifiedLearnersCount(regionId),
    fetchSalesOrderSummary(regionId),
    fetchWeeklyMetrics(regionId),
  ]);

  if (muoRes.status === "rejected") console.error("[zohoapi] MUO failed:", muoRes.reason);
  if (learnersRes.status === "rejected") console.error("[zohoapi] Learners failed:", learnersRes.reason);
  if (salesRes.status === "rejected") console.error("[zohoapi] Sales failed:", salesRes.reason);
  if (weeklyRes.status === "rejected") console.error("[zohoapi] Weekly failed:", weeklyRes.reason);

  return {
    muo: muoRes.status === "fulfilled" ? muoRes.value : DEFAULT_MUO,
    learners: learnersRes.status === "fulfilled" ? learnersRes.value : 0,
    sales: salesRes.status === "fulfilled" ? salesRes.value : DEFAULT_SALES,
    weekly: weeklyRes.status === "fulfilled" ? weeklyRes.value : DEFAULT_WEEKLY,
  };
}

