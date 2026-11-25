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
  grangers: 0,
  grangerBreeds: {},
  grangerBreedsDel: {},
  grangerBreedsPend: {},
  layers: 0,
  layerBreeds: {},
  layerBreedsDel: {},
  layerBreedsPend: {},
  broilers: 0,
  broilerBreeds: {},
  broilerBreedsDel: {},
  broilerBreedsPend: {},
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

/* ── Add qty to a breed map ─────────────────────── */
function addBreed(map, breed, qty) {
  if (!breed) return;
  map[breed] = (map[breed] ?? 0) + qty;
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
   Subform report: Field_Visist_Sales_Order_Master_SF_Report
     Fields: ID, Product {display_value}, Product_Type {display_value},
             Quantity, Unit_Price, Line_Total

   Parent report: Field_Visit_Sales_Order_Report
     Fields: ID, Order_Status, MUO.Region, Item_Details[]
       Item_Details[i].ID = subform row ID

   Strategy:
   1. Fetch parent → map subformRowId → { isDelivered, regionName, orderId }
   2. Fetch subform → each row has Product, Product_Type, Quantity, ID
   3. Join on subformRowId → get status/region per row
   4. Aggregate quantities split by Product + Product_Type (real breed data)
───────────────────────────────────────────────── */
export async function fetchSalesOrderSummary(regionId = null) {
  console.log("<------- fetchSalesOrderSummary func intiated ------>");
  await zohoInit();

  /* ── Step 1: parent orders ── */
  const parentList = await fetchAllRecords("Field_Visit_Sales_Order_Report");
  console.log(`[zohoapi] Parent orders: ${parentList.length}`);
  console.log("===== PARENT RECORD SAMPLE =====");
  console.log(parentList[0]);
  console.log("FULL PARENT LIST:", parentList);

  let filterRegionName = "";
  if (regionId) {
    const regions = await fetchAllRecords("All_Region_Details");
    filterRegionName = (
      regions.find(r => String(r.ID) === String(regionId))?.Region_Name ?? ""
    ).toLowerCase().trim();
    console.log(`[zohoapi] Region filter: "${filterRegionName}"`);
  }

  /* ── FIX: Build orderId → meta (NOT sfId mapping) ── */
  const orderMetaMap = new Map();

  for (const rec of parentList) {
    const orderId = String(rec.ID ?? "");

    const statusRaw = displayVal(rec.Order_Status ?? rec.Status ?? "")
      .toLowerCase()
      .trim();

    const isDelivered = statusRaw === "delivered"; // ✅ FIXED

    const regionName = displayVal(rec["MUO.Region"] ?? rec.Region ?? "")
      .toLowerCase()
      .trim();

    orderMetaMap.set(orderId, { isDelivered, regionName });
  }

  console.log(`[zohoapi] Order meta mapped: ${orderMetaMap.size}`);

  /* ── Step 2: subform rows ── */
  const sfRows = await fetchAllRecords("Field_Visit_Sales_Order_Master_SF_Report");
  console.log(`[zohoapi] Subform rows: ${sfRows.length}`);
  if (sfRows.length > 0) {
    console.log("[zohoapi] SF row sample:", JSON.stringify(sfRows[0], null, 2));
  }

  /* ── Step 3: aggregate with real breed breakdown ── */
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
  const unmatchedProducts = new Set();

  for (const row of sfRows) {
    const qty = Number(row.Quantity ?? 0);
    if (qty === 0) continue;

    /* ── FIX: Use SO_Reference instead of broken sfId mapping ── */
    const orderId = row.SO_Reference?.ID;

    if (!orderId) {
      console.warn(`[zohoapi] Missing SO_Reference → skipping`, row);
      continue;
    }

    const meta = orderMetaMap.get(String(orderId));

    if (!meta) {
      console.warn(`[zohoapi] Order not found in parent map →`, orderId);
      continue;
    }

    const { isDelivered, regionName } = meta;

    if (filterRegionName && !regionName.includes(filterRegionName)) continue;

    if (!seenOrders.has(orderId)) {
      seenOrders.add(orderId);
      if (isDelivered) ordersDelivered++;
      else ordersPending++;
    }

    // Product field
    const productName = displayVal(row.Product ?? "").toUpperCase().trim();
    const productType = displayVal(row.Product_Type ?? "").trim();
    const name = productName || productType.toUpperCase();

    if (name.includes("GRANGER") || name.includes("COCK")) {
      grangers += qty;
      addBreed(grangerBreeds, productType, qty);

      if (isDelivered) {
        grangersDelivered += qty;
        addBreed(grangerBreedsDel, productType, qty);
      } else {
        grangersPending += qty;
        addBreed(grangerBreedsPend, productType, qty);
      }

    } else if (name.includes("LAYER") || name.includes("NOVO")) {
      layers += qty;
      addBreed(layerBreeds, productType, qty);

      if (isDelivered) {
        layersDelivered += qty;
        addBreed(layerBreedsDel, productType, qty);
      } else {
        layersPending += qty;
        addBreed(layerBreedsPend, productType, qty);
      }

    } else if (name.includes("BROILER")) {
      broilers += qty;
      addBreed(broilerBreeds, productType, qty);

      if (isDelivered) {
        broilersDelivered += qty;
        addBreed(broilerBreedsDel, productType, qty);
      } else {
        broilersPending += qty;
        addBreed(broilerBreedsPend, productType, qty);
      }

    } else {
      unmatchedProducts.add(productName || "[empty]");
    }
  }

  if (unmatchedProducts.size > 0) {
    console.log("[zohoapi] Unmatched products:", [...unmatchedProducts]);
  }

  const result = {
    grangers, grangerBreeds, grangerBreedsDel, grangerBreedsPend, grangersDelivered, grangersPending,
    layers, layerBreeds, layerBreedsDel, layerBreedsPend,
    broilers, broilerBreeds, broilerBreedsDel, broilerBreedsPend,
    chicksOrdered: grangers + layers + broilers,
    chicksDelivered: grangersDelivered + layersDelivered + broilersDelivered,
    chicksPending: grangersPending + layersPending + broilersPending,
    layersOrdered: layers,
    broilersOrdered: broilers,
    layersDelivered, broilersDelivered,
    layersPending, broilersPending,
    ordersDelivered, ordersPending,
  };

  console.log("[zohoapi] Sales →", result);
  return result;
}





// export async function fetchSalesOrderSummary(regionId = null) {
//   await zohoInit();
//
//   /* ── Step 1: parent orders ── */
//   const parentList = await fetchAllRecords("Field_Visit_Sales_Order_Report");
//   console.log(`[zohoapi] Parent orders: ${parentList.length}`);
//   console.log("===== PARENT RECORD SAMPLE =====");
//   console.log(parentList[0]);
//   console.log("FULL PARENT LIST:", parentList);
//
//   let filterRegionName = "";
//   if (regionId) {
//     const regions = await fetchAllRecords("All_Region_Details");
//     filterRegionName = (
//       regions.find(r => String(r.ID) === String(regionId))?.Region_Name ?? ""
//     ).toLowerCase().trim();
//     console.log(`[zohoapi] Region filter: "${filterRegionName}"`);
//   }
//
//   /* ── Build subformRowId → meta ── */
//   const sfRowMeta = new Map();
//   const orderDelivered = new Map();
//
//   for (const rec of parentList) {
//     const orderId = String(rec.ID ?? "");
//     const statusRaw = displayVal(rec.Order_Status ?? rec.Status ?? "").toLowerCase().trim();
//     const isDelivered = statusRaw === "delivered";
//     const regionName = displayVal(rec["MUO.Region"] ?? rec.Region ?? "").toLowerCase().trim();
//
//     orderDelivered.set(orderId, { isDelivered, regionName });
//
//     const items = rec.Item_Details ?? [];
//     for (const item of items) {
//       const sfId = String(item.ID ?? "");
//       if (sfId) sfRowMeta.set(sfId, { isDelivered, regionName, orderId });
//     }
//   }
//
//   console.log(`[zohoapi] Subform row IDs mapped: ${sfRowMeta.size}`);
//
//   /* ── Step 2: subform rows ── */
//   const sfRows = await fetchAllRecords("Field_Visit_Sales_Order_Master_SF_Report");
//   console.log(`[zohoapi] Subform rows: ${sfRows.length}`);
//   if (sfRows.length > 0) {
//     console.log("[zohoapi] SF row sample:", JSON.stringify(sfRows[0], null, 2));
//   }
//
//   /* ── Step 3: aggregate with real breed breakdown ── */
//   let grangers = 0, layers = 0, broilers = 0;
//   const grangerBreeds = {}, layerBreeds = {}, broilerBreeds = {};
//   let grangersDelivered = 0, grangersPending = 0;
//   let layersDelivered = 0, broilersDelivered = 0;
//   let layersPending = 0, broilersPending = 0;
//   const layerBreedsDel = {}, layerBreedsPend = {};
//   const broilerBreedsDel = {}, broilerBreedsPend = {};
//   const grangerBreedsDel = {}, grangerBreedsPend = {};
//   let ordersDelivered = 0, ordersPending = 0;
//   const seenOrders = new Set();
//   const unmatchedProducts = new Set();
//
//   for (const row of sfRows) {
//     const sfId = String(row.ID ?? "");
//     const meta = sfRowMeta.get(sfId);
//
//     if (!meta) {
//       console.warn(`[zohoapi] SF row ${sfId} not in parent map — skipping`);
//       continue;
//     }
//
//     const { isDelivered, regionName, orderId } = meta;
//
//     if (filterRegionName && !regionName.includes(filterRegionName)) continue;
//
//     if (orderId && !seenOrders.has(orderId)) {
//       seenOrders.add(orderId);
//       if (isDelivered) ordersDelivered++; else ordersPending++;
//     }
//
//     // Product field → "GRANGERS", "LAYERS", "BROILERS", etc.
//     const productName = displayVal(row.Product ?? "").toUpperCase().trim();
//     // Product_Type field → actual breed name e.g. "Granger Gold", "Novobrown", "Efficiency Plus"
//     const productType = displayVal(row.Product_Type ?? "").trim();
//     const qty = Number(row.Quantity ?? 0);
//
//     if (qty === 0) continue;
//
//     if (productName.includes("GRANGER") || productName.includes("COCK")) {
//       grangers += qty;
//       addBreed(grangerBreeds, productType, qty);
//       if (isDelivered) {
//         grangersDelivered += qty;
//         addBreed(grangerBreedsDel, productType, qty);
//       } else {
//         grangersPending += qty;
//         addBreed(grangerBreedsPend, productType, qty);
//       }
//     } else if (productName.includes("LAYER")) {
//       layers += qty;
//       addBreed(layerBreeds, productType, qty);
//       if (isDelivered) {
//         layersDelivered += qty;
//         addBreed(layerBreedsDel, productType, qty);
//       } else {
//         layersPending += qty;
//         addBreed(layerBreedsPend, productType, qty);
//       }
//
//     } else if (productName.includes("BROILER")) {
//       broilers += qty;
//       addBreed(broilerBreeds, productType, qty);
//       if (isDelivered) {
//         broilersDelivered += qty;
//         addBreed(broilerBreedsDel, productType, qty);
//       } else {
//         broilersPending += qty;
//         addBreed(broilerBreedsPend, productType, qty);
//       }
//
//     } else {
//       unmatchedProducts.add(productName || "[empty]");
//     }
//   }
//
//   if (unmatchedProducts.size > 0) {
//     console.log("[zohoapi] Unmatched products:", [...unmatchedProducts]);
//   }
//
//   const result = {
//     grangers, grangerBreeds, grangerBreedsDel, grangerBreedsPend, grangersDelivered, grangersPending,
//     layers, layerBreeds, layerBreedsDel, layerBreedsPend,
//     broilers, broilerBreeds, broilerBreedsDel, broilerBreedsPend,
//     chicksOrdered: grangers + layers + broilers,
//     chicksDelivered: grangersDelivered + layersDelivered + broilersDelivered,
//     chicksPending: grangersPending + layersPending + broilersPending,
//     layersOrdered: layers,
//     broilersOrdered: broilers,
//     layersDelivered, broilersDelivered,
//     layersPending, broilersPending,
//     ordersDelivered, ordersPending,
//   };
//   console.log("[zohoapi] Sales →", result);
//   return result;
// }

/* ─────────────────────────────────────────────────
   5. WEEKLY OPERATION LOGS
───────────────────────────────────────────────── */
export async function fetchWeeklyMetrics(regionId = null) {
  await zohoInit();

  const reportCandidates = [
    "All_Weekly_Operation_Logs",
    "Weekly_Operation_Logs",
    "All_Weekly_Operations",
    "Field_Visit_Weekly_Summary",
    // "Field_Visit_Weekly_Su",
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
    console.error("[zohoapi] Weekly: report not found. Check Zoho Creator → Reports for the correct link name.");
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

