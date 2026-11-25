/* ══════════════════════════════════════════════════
   zohoapi.js  —  Chicken4U Poultry Dashboard
   JS API v2 — Sequential requests (iOS compatible)
   v2.1 — Month selector + monthly trend chart data
══════════════════════════════════════════════════ */

const MONTH_MAP = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseZohoDate(str) {
  if (!str || typeof str !== "string") return null;
  str = str.trim();
  if (!str) return null;

  // "17-Apr-2026"  DD-Mon-YYYY  ← what Zoho actually returns
  const m1 = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const mon = MONTH_MAP[m1[2].toLowerCase()];
    if (mon === undefined) return null;
    return new Date(Number(m1[3]), mon, Number(m1[1]));
  }

  // "2026-04-17"  YYYY-MM-DD
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));

  // "17/04/2026"  DD/MM/YYYY
  const m3 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) return new Date(Number(m3[3]), Number(m3[2]) - 1, Number(m3[1]));

  // last resort
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// function dateToISO(date) {
//   if (!date || isNaN(date)) return "";
//   return date.toISOString().split("T")[0];
// }

function dateToISO(date) {
  if (!date || isNaN(date)) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

let _zohoReady = false;
async function zohoInit() {
  // await ZOHO.CREATOR.init();
  _zohoReady = true;
}

let _muoCache = null;
let _muoStatsCache = null;

const DEFAULT_MUO = { total: 0, male: 0, female: 0, sspTotal: 0 };
const DEFAULT_SALES = {
  grangers: 0,
  grangerBreeds: {},
  grangerBreedsDel: {},
  grangerBreedsPend: {},
  grangersDelivered: 0,
  grangersPending: 0,
  layers: 0,
  layerBreeds: {},
  layerBreedsDel: {},
  layerBreedsPend: {},
  broilers: 0,
  broilerBreeds: {},
  broilerBreedsDel: {},
  broilerBreedsPend: {},
  chicksOrdered: 0,
  chicksDelivered: 0,
  chicksPending: 0,
  layersOrdered: 0,
  broilersOrdered: 0,
  layersDelivered: 0,
  broilersDelivered: 0,
  layersPending: 0,
  broilersPending: 0,
  ordersDelivered: 0,
  ordersPending: 0,
  allProducts: {},
  feedKgOrdered: 0,
  feedKgDelivered: 0,
  feedKgPending: 0,
  topMuos: [],
  topSatos: [],
  pendingWeek: { qty: 0, orders: 0, list: [] },
  pendingMonth: { qty: 0, orders: 0, list: [] },
  monthlyTrend: [],
  availableMonths: [],
  availableYears: [],
};
const DEFAULT_WEEKLY = {
  mortality: 0,
  feedKg: 0,
  birdsSold: 0,
  revenue: 0,
  sickBirds: 0,
};

/* ── v2 Paginator ── */
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
        console.error(
          `[zohoapi] fetchAllRecords(${reportName}) code=${res?.code}:`,
          res,
        );
      } else {
        console.warn(`[zohoapi] ${reportName} → no data / 3100`);
      }
      break;
    }

    const records = res.data ?? [];
    all.push(...records);

    const cursor = res.record_cursor ?? res?.headers?.record_cursor ?? null;
    if (!cursor || records.length < 1000) break;
    record_cursor = cursor;
  }

  return all;
}

function displayVal(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    return (v.zc_display_value ?? v.display_value ?? v.name ?? "").toString();
  }
  return v.toString();
}

function addBreed(map, breed, qty) {
  if (!breed) return;
  map[breed] = (map[breed] ?? 0) + qty;
}

/* ── Month key helpers ── */
function getMonthKey(date) {
  if (!date || isNaN(date)) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthKeyToLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

/* ── Date ranges ── */
function getDateRanges(monthKey = null) {
  const now = new Date();

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  let startOfMonth, endOfMonth;
  if (monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    startOfMonth = new Date(y, m - 1, 1);
    startOfMonth.setHours(0, 0, 0, 0);
    endOfMonth = new Date(y, m, 0);
    endOfMonth.setHours(23, 59, 59, 999);
  } else {
    startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
  }

  return { startOfWeek, endOfWeek, startOfMonth, endOfMonth };
}

function isFeedProduct(name, type) {
  const u = (name + " " + type).toUpperCase();
  return (
    u.includes("FEED") ||
    u.includes("FEEDS") ||
    u.includes("MASH") ||
    u.includes("PELLET") ||
    u.includes("STARTER") ||
    u.includes("FINISHER") ||
    u.includes("GROWER")
  );
}

function classifyProduct(productName, productType) {
  const u = (productName + " " + productType).toUpperCase();
  if (u.includes("GRANGER") || u.includes("COCK")) return "chick";
  if (u.includes("LAYER") || u.includes("NOVO")) return "chick";
  if (u.includes("BROILER")) return "chick";
  if (isFeedProduct(productName, productType)) return "feed";
  if (
    u.includes("MEDIC") ||
    u.includes("VACCINE") ||
    u.includes("DRUG") ||
    u.includes("VITAMIN") ||
    u.includes("ANTIBIOTIC") ||
    u.includes("DEWORM")
  )
    return "medication";
  if (u.includes("DISINFECT") || u.includes("CLEAN") || u.includes("SANITIZ"))
    return "sanitation";
  if (
    u.includes("EQUIP") ||
    u.includes("FEEDER") ||
    u.includes("DRINKER") ||
    u.includes("WATERER") ||
    u.includes("CAGE") ||
    u.includes("LAMP") ||
    u.includes("BULB")
  )
    return "equipment";
  return "other";
}

/* ─────────────────────────────────────────────────
   1. REGIONS
───────────────────────────────────────────────── */
export async function fetchRegions() {
  await zohoInit();
  const records = await fetchAllRecords("All_Region_Details");
  return records.map((r) => ({ id: r.ID ?? "", name: r.Region_Name ?? "" }));
}

/* ─────────────────────────────────────────────────
   2. MUO COUNTS
───────────────────────────────────────────────── */
// 🟢 REPLACE WITH THIS:
export async function fetchMuoGenderCounts(regionId = null, yearKey = null) {
  await zohoInit();
  const criteria = regionId ? `Region == ${regionId}` : null;
  const records = await fetchAllRecords("All_Muo_Profiles", criteria);

  if (records.length > 0) console.log("[zohoapi] MUO sample:", records[0]);

  // ← NEW: Filter by year if provided (using Added_Time field)
  let filteredRecords = records;
  if (yearKey) {
    const targetYear = Number(yearKey);
    filteredRecords = records.filter((r) => {
      const addedTime = parseZohoDate(r.Added_Time ?? "");
      if (!addedTime || isNaN(addedTime)) return false;
      return addedTime.getFullYear() === targetYear;
    });
    console.log(
      `[zohoapi] MUO filtered by year ${yearKey}: ${filteredRecords.length} of ${records.length}`,
    );
  }

  let male = 0,
    female = 0;
  filteredRecords.forEach((r) => {
    // ← Changed from 'records' to 'filteredRecords'
    const g = (r.Gender ?? "").toString().toLowerCase().trim();
    if (g === "male") male++;
    else if (g === "female") female++;
  });

  const sspTotal = filteredRecords.reduce((sum, r) => {
    // ← Changed from 'records' to 'filteredRecords'
    const v =
      r.No_of_SSPs ??
      r.No_Of_SSPs ??
      r.no_of_ssps ??
      r.SSPs ??
      r.Ssps ??
      r.Number_of_SSPs ??
      r.SSP_Count ??
      r.No_SSPs ??
      r.SSP ??
      0;
    return sum + (Number(v) || 0);
  }, 0);

  return { total: filteredRecords.length, male, female, sspTotal }; // ← Changed from 'records.length'
}

// export async function fetchMuoGenderCounts(regionId = null) {
//   await zohoInit();
//   const criteria = regionId ? `Region == ${regionId}` : null;
//   const records = await fetchAllRecords("All_Muo_Profiles", criteria);
//
//   if (records.length > 0) console.log("[zohoapi] MUO sample:", records[0]);
//
//   let male = 0,
//     female = 0;
//   records.forEach((r) => {
//     const g = (r.Gender ?? "").toString().toLowerCase().trim();
//     if (g === "male") male++;
//     else if (g === "female") female++;
//   });
//
//   const sspTotal = records.reduce((sum, r) => {
//     const v =
//       r.No_of_SSPs ??
//       r.No_Of_SSPs ??
//       r.no_of_ssps ??
//       r.SSPs ??
//       r.Ssps ??
//       r.Number_of_SSPs ??
//       r.SSP_Count ??
//       r.No_SSPs ??
//       r.SSP ??
//       0;
//     return sum + (Number(v) || 0);
//   }, 0);
//
//   return { total: records.length, male, female, sspTotal };
// }

/* ─────────────────────────────────────────────────
   3. CERTIFIED LEARNERS
───────────────────────────────────────────────── */
export async function fetchCertifiedLearnersCount(
  regionId = null,
  yearKey = null,
) {
  await zohoInit();
  const base = `Certified_ID != null`;
  const criteria = regionId ? `${base} && Region == ${regionId}` : base;
  const records = await fetchAllRecords("All_Muo_Profiles", criteria);

  // ← NEW: Filter by year if provided (using Added_Time field)
  let filteredRecords = records;
  if (yearKey) {
    const targetYear = Number(yearKey);
    filteredRecords = records.filter((r) => {
      const addedTime = parseZohoDate(r.Added_Time ?? "");
      if (!addedTime || isNaN(addedTime)) return false;
      return addedTime.getFullYear() === targetYear;
    });
    console.log(
      `[zohoapi] Certified learners filtered by year ${yearKey}: ${filteredRecords.length} of ${records.length}`,
    );
  }

  return filteredRecords.length; // ← Changed from 'records.length'
}

// fetch muo with certification id
// export async function fetchCertifiedLearnersCount(regionId = null) {
//   await zohoInit();
//   const base = `Certified_ID != null`;
//   const criteria = regionId ? `${base} && Region == ${regionId}` : base;
//   const records = await fetchAllRecords("All_Muo_Profiles", criteria);
//   return records.length;
// }

/* ─────────────────────────────────────────────────
   4. COMPREHENSIVE SALES ORDER SUMMARY
   monthKey: "YYYY-MM" or null (all time)
───────────────────────────────────────────────── */
// export async function fetchSalesOrderSummary(regionId = null, monthKey = null) {
export async function fetchSalesOrderSummary(
  regionId = null,
  monthKey = null,
  yearKey = null,
  satoCommCfg = null,
) {
  console.log("<------- fetchSalesOrderSummary ------>", {
    regionId,
    monthKey,
  });
  await zohoInit();

  /* ── Fetch both reports ── */
  const parentList = await fetchAllRecords("Field_Visit_Sales_Order_Report");
  console.log(`[zohoapi] Parents: ${parentList.length}`);

  const sfRows = await fetchAllRecords(
    "Field_Visit_Sales_Order_Master_SF_Report",
  );
  console.log(`[zohoapi] SF rows: ${sfRows.length}`);

  /* ── Date ranges for pending sections ── */
  const now = new Date();

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Pending always uses the real current month regardless of monthKey filter
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfCurrentMonth.setHours(23, 59, 59, 999);

  /* ── Month filter boundaries (for KPIs) ── */
  let monthStart = null,
    monthEnd = null;
  if (monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    monthStart = new Date(y, m - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    monthEnd = new Date(y, m, 0);
    monthEnd.setHours(23, 59, 59, 999);
  }

  /* ══════════════════════════════════════════════
     BUILD ORDER META MAP from parent records
     Key: String(rec.ID)
  ══════════════════════════════════════════════ */
  const orderMetaMap = new Map();
  const monthsWithData = new Set();

  for (const rec of parentList) {
    const orderId = String(rec.ID ?? "");
    if (!orderId) continue;

    /* Order status */
    const statusRaw = String(rec.Order_Status ?? "")
      .toLowerCase()
      .trim();
    const isDelivered = statusRaw === "delivered";

    /* Payment status */
    const payRaw = String(rec.Payment_Status ?? "")
      .toLowerCase()
      .trim();
    const isPaid = payRaw === "paid";

    /* Region — rec["MUO.Region"] is an object {Region_Name, ID, zc_display_value} */
    const regionObj = rec["MUO.Region"] ?? {};
    const regionName = String(regionObj.Region_Name ?? "")
      .toLowerCase()
      .trim();
    const regionObjId = String(regionObj.ID ?? "");

    /* MUO name — zc_display_value is " Walk-In Main " */
    const muoName = String(rec.MUO?.zc_display_value ?? "").trim();

    /* SATO name */
    const satoName = String(rec.SATO?.zc_display_value ?? "").trim();

    /* Order date — actual field is "Date_field", format "17-Apr-2026" */
    const orderDate = parseZohoDate(rec.Date_field ?? "");

    /* Delivery dates */
    const expectedDeliveryDate = parseZohoDate(
      rec.Expected_Delivery_Date ?? "",
    );
    const deliveryDate = parseZohoDate(rec.Delivery_Date ?? "");

    /* Use order date for month bucketing; fall back to expected delivery date */
    const bucketDate = orderDate ?? expectedDeliveryDate;
    if (bucketDate && !isNaN(bucketDate)) {
      const mk = getMonthKey(bucketDate);
      if (mk) monthsWithData.add(mk);
    }

    orderMetaMap.set(orderId, {
      isDelivered,
      isPaid,
      regionName,
      regionObjId,
      muoName,
      satoName,
      orderDate,
      expectedDeliveryDate,
      deliveryDate,
      statusRaw,
    });
  }

  // replace with:
  const availableYears = [
    ...new Set([...monthsWithData].map((mk) => mk.slice(0, 4))),
  ]
    .sort()
    .map((year) => ({ key: year, label: year }));

  // When a year is selected, only expose months within that year
  const availableMonths = [...monthsWithData]
    .filter((mk) => !yearKey || mk.startsWith(yearKey))
    .sort()
    .map((key) => ({ key, label: monthKeyToLabel(key) }));

  /* Available months for the month selector (sorted ascending) */
  // const availableMonths = [...monthsWithData]
  //   .sort()
  //   .map(key => ({ key, label: monthKeyToLabel(key) }));
  //
  /* ══════════════════════════════════════════════
     MONTH FILTER HELPER
     Uses orderDate (Date_field); falls back to
     expectedDeliveryDate if orderDate is missing.
  ══════════════════════════════════════════════ */
  function isInMonthFilter(meta) {
    const d = meta.orderDate ?? meta.expectedDeliveryDate;
    if (!d || isNaN(d)) return !monthKey && !yearKey ? true : false;
    if (yearKey && d.getFullYear() !== Number(yearKey)) return false;
    if (!monthKey) return true;
    return d >= monthStart && d <= monthEnd;
  }
  // function isInMonthFilter(meta) {
  //   if (!monthKey) return true; // no filter = all time
  //   const d = meta.orderDate ?? meta.expectedDeliveryDate;
  //   if (!d || isNaN(d)) return false;
  //   return d >= monthStart && d <= monthEnd;
  // }

  /* ══════════════════════════════════════════════
     REGION FILTER HELPER
     Match by Region ID (most reliable).
     Falls back to region name substring.
  ══════════════════════════════════════════════ */
  function isInRegion(meta) {
    if (!regionId) return true;
    if (meta.regionObjId && meta.regionObjId === String(regionId)) return true;
    // fallback: partial name match (shouldn't be needed but keeps it safe)
    return false;
  }

  /* ══════════════════════════════════════════════
     AGGREGATION
  ══════════════════════════════════════════════ */
  let grangers = 0,
    layers = 0,
    broilers = 0;
  const grangerBreeds = {},
    layerBreeds = {},
    broilerBreeds = {};
  let grangersDelivered = 0,
    grangersPending = 0;
  let layersDelivered = 0,
    layersPending = 0;
  let broilersDelivered = 0,
    broilersPending = 0;
  const grangerBreedsDel = {},
    grangerBreedsPend = {};
  const layerBreedsDel = {},
    layerBreedsPend = {};
  const broilerBreedsDel = {},
    broilerBreedsPend = {};

  let ordersDelivered = 0,
    ordersPending = 0;
  const seenOrders = new Set();

  const allProductsMap = {};
  let feedKgOrdered = 0,
    feedKgDelivered = 0,
    feedKgPending = 0;

  const muoMap = {}; // { [muoName]: { ordered, delivered } }
  const satoMap = {}; // { [satoName]: { paidQty, totalQty } }

  /* Pending lists */
  let pendingWeekQty = 0,
    pendingMonthQty = 0;
  const seenWeekOrders = new Set();
  const seenMonthOrders = new Set();
  const pendingWeekList = [];
  const pendingMonthList = [];

  /* Monthly trend (always across ALL time, ignores month filter) */
  const monthlyMap = {};

  /* helper */
  function addBreed(map, breed, qty) {
    if (!breed) return;
    map[breed] = (map[breed] ?? 0) + qty;
  }

  for (const row of sfRows) {
    /* ── Quantity ── */
    const qty = Number(row.Quantity ?? 0);
    if (qty <= 0) continue;

    /* ── Link to parent ── */
    const orderId = String(row.SO_Reference?.ID ?? "");
    if (!orderId) continue;

    const meta = orderMetaMap.get(orderId);
    if (!meta) continue;

    /* ── Product name & breed ──
       row.Product       = { Product: "LAYERS", ID: "...", zc_display_value: "LAYERS" }
       row.Product_Type  = { Product_Name: "NOVOBROWN", ID: "...", zc_display_value: "NOVOBROWN" }
    ── */
    const productName = String(
      row.Product?.Product ?? row.Product?.zc_display_value ?? "",
    ).trim();
    const productBreed = String(
      row.Product_Type?.Product_Name ??
        row.Product_Type?.zc_display_value ??
        "",
    ).trim();
    const productUpper = productName.toUpperCase();
    const breedUpper = productBreed.toUpperCase();

    /* ── Always build monthly trend (no region/month filter) ── */
    const bucketDate = meta.orderDate ?? meta.expectedDeliveryDate;
    const rowMonthKey = getMonthKey(bucketDate);
    if (rowMonthKey) {
      if (!monthlyMap[rowMonthKey]) {
        monthlyMap[rowMonthKey] = {
          grangers: 0,
          layers: 0,
          broilers: 0,
          chicksOrdered: 0,
          chicksDelivered: 0,
        };
      }
      if (productUpper.includes("GRANGER") || productUpper.includes("COCK")) {
        monthlyMap[rowMonthKey].grangers += qty;
        monthlyMap[rowMonthKey].chicksOrdered += qty;
        if (meta.isDelivered) monthlyMap[rowMonthKey].chicksDelivered += qty;
      } else if (
        productUpper.includes("LAYER") ||
        productUpper.includes("NOVO")
      ) {
        monthlyMap[rowMonthKey].layers += qty;
        monthlyMap[rowMonthKey].chicksOrdered += qty;
        if (meta.isDelivered) monthlyMap[rowMonthKey].chicksDelivered += qty;
      } else if (productUpper.includes("BROILER")) {
        monthlyMap[rowMonthKey].broilers += qty;
        monthlyMap[rowMonthKey].chicksOrdered += qty;
        if (meta.isDelivered) monthlyMap[rowMonthKey].chicksDelivered += qty;
      }
      // if (!monthlyMap[rowMonthKey]) {
      //   monthlyMap[rowMonthKey] = { grangers: 0, layers: 0, broilers: 0 };
      // }
      // if (productUpper.includes("GRANGER") || productUpper.includes("COCK")) {
      //   monthlyMap[rowMonthKey].grangers += qty;
      // } else if (productUpper.includes("LAYER") || productUpper.includes("NOVO")) {
      //   monthlyMap[rowMonthKey].layers += qty;
      // } else if (productUpper.includes("BROILER")) {
      //   monthlyMap[rowMonthKey].broilers += qty;
      // }
    }

    /* ── Apply region + month filters for KPIs ── */
    if (!isInRegion(meta)) continue;
    if (!isInMonthFilter(meta)) continue;

    const { isDelivered, isPaid, muoName, satoName, expectedDeliveryDate } =
      meta;

    /* Order-level counters (deduplicated) */
    if (!seenOrders.has(orderId)) {
      seenOrders.add(orderId);
      if (isDelivered) ordersDelivered++;
      else ordersPending++;
    }

    /* ── Classify product ── */
    const isFeed =
      productUpper.includes("FEED") ||
      productUpper.includes("MASH") ||
      productUpper.includes("PELLET") ||
      productUpper.includes("STARTER") ||
      productUpper.includes("FINISHER") ||
      productUpper.includes("GROWER") ||
      breedUpper.includes("FEED");

    /* allProducts map (for "Other Products" panel) */
    const productKey = productName || "Unknown";
    if (!allProductsMap[productKey]) {
      allProductsMap[productKey] = { ordered: 0, delivered: 0, pending: 0 };
    }
    allProductsMap[productKey].ordered += qty;
    if (isDelivered) allProductsMap[productKey].delivered += qty;
    else allProductsMap[productKey].pending += qty;

    /* Feed kg */
    if (isFeed) {
      feedKgOrdered += qty;
      if (isDelivered) feedKgDelivered += qty;
      else feedKgPending += qty;
    }

    /* ── Chick classification ── */
    const isGranger =
      productUpper.includes("GRANGER") || productUpper.includes("COCK");
    const isLayer =
      productUpper.includes("LAYER") || productUpper.includes("NOVO");
    const isBroiler = productUpper.includes("BROILER");

    if (isGranger) {
      grangers += qty;
      addBreed(grangerBreeds, productBreed, qty);
      if (isDelivered) {
        grangersDelivered += qty;
        addBreed(grangerBreedsDel, productBreed, qty);
      } else {
        grangersPending += qty;
        addBreed(grangerBreedsPend, productBreed, qty);
      }

      /* Top MUOs — ranked by chicks delivered */
      if (muoName) {
        if (!muoMap[muoName]) muoMap[muoName] = { ordered: 0, delivered: 0 };
        muoMap[muoName].ordered += qty;
        if (isDelivered) muoMap[muoName].delivered += qty;
      }
    } else if (isLayer) {
      layers += qty;
      addBreed(layerBreeds, productBreed, qty);
      if (isDelivered) {
        layersDelivered += qty;
        addBreed(layerBreedsDel, productBreed, qty);
      } else {
        layersPending += qty;
        addBreed(layerBreedsPend, productBreed, qty);
      }

      if (muoName) {
        if (!muoMap[muoName]) muoMap[muoName] = { ordered: 0, delivered: 0 };
        muoMap[muoName].ordered += qty;
        if (isDelivered) muoMap[muoName].delivered += qty;
      }
    } else if (isBroiler) {
      broilers += qty;
      addBreed(broilerBreeds, productBreed, qty);
      if (isDelivered) {
        broilersDelivered += qty;
        addBreed(broilerBreedsDel, productBreed, qty);
      } else {
        broilersPending += qty;
        addBreed(broilerBreedsPend, productBreed, qty);
      }

      if (muoName) {
        if (!muoMap[muoName]) muoMap[muoName] = { ordered: 0, delivered: 0 };
        muoMap[muoName].ordered += qty;
        if (isDelivered) muoMap[muoName].delivered += qty;
      }
    }

    /* Top SATOs — ranked by paid quantity */
    // if (satoName && (isGranger || isLayer || isBroiler)) {
    //   if (!satoMap[satoName]) satoMap[satoName] = { paidQty: 0, totalQty: 0 };
    //   satoMap[satoName].totalQty += qty;
    //   if (isPaid) satoMap[satoName].paidQty += qty;
    // }

    /* SATO commission tracking — runs for ALL rows, all months (no filter) */
    if (satoName && (isGranger || isLayer || isBroiler)) {
      if (!satoMap[satoName]) {
        satoMap[satoName] = {
          paidQty: 0,
          totalQty: 0,
          grangersDelivered: 0,
          layersDelivered: 0,
          broilersDelivered: 0,
          monthly: {},
        };
      }
      satoMap[satoName].totalQty += qty;
      if (isPaid) satoMap[satoName].paidQty += qty;
      if (isDelivered) {
        if (isGranger) satoMap[satoName].grangersDelivered += qty;
        else if (isLayer) satoMap[satoName].layersDelivered += qty;
        else if (isBroiler) satoMap[satoName].broilersDelivered += qty;
        if (rowMonthKey) {
          if (!satoMap[satoName].monthly[rowMonthKey]) {
            satoMap[satoName].monthly[rowMonthKey] = {
              grangersDelivered: 0,
              layersDelivered: 0,
              broilersDelivered: 0,
            };
          }
          const sm = satoMap[satoName].monthly[rowMonthKey];
          if (isGranger) sm.grangersDelivered += qty;
          else if (isLayer) sm.layersDelivered += qty;
          else if (isBroiler) sm.broilersDelivered += qty;
        }
      }
    }

    /* ── Pending deliveries ──
       Use expectedDeliveryDate to determine which bucket (week / month).
       Always uses the real current week/month, not the month filter.
    ── */
    if (!isDelivered && expectedDeliveryDate && !isNaN(expectedDeliveryDate)) {
      /* This week */
      if (
        expectedDeliveryDate >= startOfWeek &&
        expectedDeliveryDate <= endOfWeek
      ) {
        pendingWeekQty += qty;
        if (!seenWeekOrders.has(orderId)) {
          seenWeekOrders.add(orderId);
          pendingWeekList.push({
            orderId,
            muoName,
            satoName,
            expectedDate: dateToISO(expectedDeliveryDate),
            status: meta.statusRaw,
            qty,
          });
        }
      }
      /* This month */
      if (
        expectedDeliveryDate >= startOfCurrentMonth &&
        expectedDeliveryDate <= endOfCurrentMonth
      ) {
        pendingMonthQty += qty;
        if (!seenMonthOrders.has(orderId)) {
          seenMonthOrders.add(orderId);
          pendingMonthList.push({
            orderId,
            muoName,
            satoName,
            expectedDate: dateToISO(expectedDeliveryDate),
            status: meta.statusRaw,
            qty,
          });
        }
      }
    }
  }

  /* ── Monthly trend (sorted ascending) ── */
  // const monthlyTrend = Object.entries(monthlyMap)
  //   .sort(([a], [b]) => a.localeCompare(b))
  //   .map(([key, d]) => ({
  //     key,
  //     label: monthKeyToLabel(key),
  //     grangers: d.grangers,
  //     layers: d.layers,
  //     broilers: d.broilers,
  //     total: d.grangers + d.layers + d.broilers,
  //   }));

  // const monthlyTrend = Object.entries(monthlyMap)
  //   .sort(([a], [b]) => a.localeCompare(b))
  //   .map(([key, d]) => ({
  const monthlyTrend = Object.entries(monthlyMap)
    .filter(([key]) => !yearKey || key.startsWith(yearKey))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => ({
      key,
      label: monthKeyToLabel(key),
      grangers: d.grangers,
      layers: d.layers,
      broilers: d.broilers,
      chicksOrdered: d.chicksOrdered ?? d.grangers + d.layers + d.broilers,
      chicksDelivered: d.chicksDelivered ?? 0,
      total: d.grangers + d.layers + d.broilers,
    }));

  /* ── Top performers ── */
  const topMuos = Object.entries(muoMap)
    .map(([name, d]) => ({ name, value: d.delivered, ordered: d.ordered }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const commCfg = satoCommCfg || {
    grangerRate: 0.3,
    layerRate: 0.2,
    broilerRate: 0.2,
    layerTarget: 0,
    broilerTarget: 0,
  };

  const satoCommissionByMonth = [];
  const topSatos = Object.entries(satoMap)
    .map(([name, d]) => {
      const grangerComm = (d.grangersDelivered || 0) * commCfg.grangerRate;
      const meetsLayerTarget =
        commCfg.layerTarget > 0
          ? d.layersDelivered >= commCfg.layerTarget
          : true;
      const meetsBroilerTarget =
        commCfg.broilerTarget > 0
          ? d.broilersDelivered >= commCfg.broilerTarget
          : true;
      const layerComm = meetsLayerTarget
        ? d.layersDelivered * commCfg.layerRate
        : 0;
      const broilerComm = meetsBroilerTarget
        ? d.broilersDelivered * commCfg.broilerRate
        : 0;
      const totalCommission = grangerComm + layerComm + broilerComm;

      const monthly = Object.entries(d.monthly || {})
        .map(([mk, md]) => {
          const mGranger = md.grangersDelivered * commCfg.grangerRate;
          const mMeetsLayer =
            commCfg.layerTarget > 0
              ? md.layersDelivered >= commCfg.layerTarget
              : true;
          const mMeetsBroiler =
            commCfg.broilerTarget > 0
              ? md.broilersDelivered >= commCfg.broilerTarget
              : true;
          const mLayer = mMeetsLayer
            ? md.layersDelivered * commCfg.layerRate
            : 0;
          const mBroiler = mMeetsBroiler
            ? md.broilersDelivered * commCfg.broilerRate
            : 0;
          const row = {
            month: mk,
            monthLabel: monthKeyToLabel(mk),
            grangersDelivered: md.grangersDelivered,
            layersDelivered: md.layersDelivered,
            broilersDelivered: md.broilersDelivered,
            grangerComm: parseFloat(mGranger.toFixed(2)),
            layerComm: parseFloat(mLayer.toFixed(2)),
            broilerComm: parseFloat(mBroiler.toFixed(2)),
            total: parseFloat((mGranger + mLayer + mBroiler).toFixed(2)),
            meetsLayerTarget: mMeetsLayer,
            meetsBroilerTarget: mMeetsBroiler,
          };
          satoCommissionByMonth.push({ sato: name, ...row });
          return row;
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        name,
        value: d.paidQty,
        totalQty: d.totalQty,
        grangersDelivered: d.grangersDelivered,
        layersDelivered: d.layersDelivered,
        broilersDelivered: d.broilersDelivered,
        grangerComm: parseFloat(grangerComm.toFixed(2)),
        layerComm: parseFloat(layerComm.toFixed(2)),
        broilerComm: parseFloat(broilerComm.toFixed(2)),
        totalCommission: parseFloat(totalCommission.toFixed(2)),
        meetsLayerTarget,
        meetsBroilerTarget,
        monthly,
      };
    })
    .sort((a, b) => b.totalCommission - a.totalCommission)
    .slice(0, 20);

  satoCommissionByMonth.sort(
    (a, b) => a.month.localeCompare(b.month) || b.total - a.total,
  );
  const totalSatoCommissionPayable = parseFloat(
    topSatos.reduce((s, x) => s + x.totalCommission, 0).toFixed(2),
  );

  // const topSatos = Object.entries(satoMap)
  //   .map(([name, d]) => ({ name, value: d.paidQty, totalQty: d.totalQty }))
  //   .sort((a, b) => b.value - a.value)
  //   .slice(0, 10);

  /* ── Sort pending lists by expected date ── */
  pendingWeekList.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  pendingMonthList.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  return {
    grangers,
    grangerBreeds,
    grangerBreedsDel,
    grangerBreedsPend,
    grangersDelivered,
    grangersPending,

    layers,
    layerBreeds,
    layerBreedsDel,
    layerBreedsPend,
    layersOrdered: layers,
    layersDelivered,
    layersPending,

    broilers,
    broilerBreeds,
    broilerBreedsDel,
    broilerBreedsPend,
    broilersOrdered: broilers,
    broilersDelivered,
    broilersPending,

    chicksOrdered: grangers + layers + broilers,
    chicksDelivered: grangersDelivered + layersDelivered + broilersDelivered,
    chicksPending: grangersPending + layersPending + broilersPending,

    ordersDelivered,
    ordersPending,
    allProducts: allProductsMap,
    feedKgOrdered,
    feedKgDelivered,
    feedKgPending,

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

    monthlyTrend,
    availableMonths,
    availableYears,

    satoCommissionConfig: commCfg,
    satoCommissionByMonth,
    totalSatoCommissionPayable,
  };
}

/* ══════════════════════════════════════════════════
   Also add this helper near the top of zohoapi.js
   (used inside fetchSalesOrderSummary above)
══════════════════════════════════════════════════ */

// export async function fetchSalesOrderSummary(regionId = null, monthKey = null) {
//   console.log("<------- fetchSalesOrderSummary ------>", { regionId, monthKey });
//   await zohoInit();
//
//   const parentList = await fetchAllRecords("Field_Visit_Sales_Order_Report");
//   console.log(`[zohoapi] Parents: ${parentList.length}`);
//   if (parentList.length > 0) {
//     console.log("[zohoapi] PARENT RECORD FIELDS:", JSON.stringify(parentList[0], null, 2));
//   }
//
//   const sfRows = await fetchAllRecords("Field_Visit_Sales_Order_Master_SF_Report");
//   console.log(`[zohoapi] SF rows: ${sfRows.length}`);
//   if (sfRows.length > 0) {
//     console.log("[zohoapi] SF ROW FIELDS:", JSON.stringify(sfRows[0], null, 2));
//   }
//
//   let filterRegionName = "";
//   if (regionId) {
//     const regions = await fetchAllRecords("All_Region_Details");
//     filterRegionName = (
//       regions.find(r => String(r.ID) === String(regionId))?.Region_Name ?? ""
//     ).toLowerCase().trim();
//   }
//
//   const { startOfWeek, endOfWeek, startOfMonth, endOfMonth } = getDateRanges(monthKey);
//
//   /* Month filter boundaries */
//   let monthStart = null, monthEnd = null;
//   if (monthKey) {
//     const [y, m] = monthKey.split("-").map(Number);
//     monthStart = new Date(y, m - 1, 1);
//     monthStart.setHours(0, 0, 0, 0);
//     monthEnd = new Date(y, m, 0);
//     monthEnd.setHours(23, 59, 59, 999);
//   }
//
//   /* Build order meta map */
//   const orderMetaMap = new Map();
//   for (const rec of parentList) {
//     const orderId = String(rec.ID ?? "");
//     const statusRaw = displayVal(rec.Order_Status ?? rec.Status ?? "").toLowerCase().trim();
//     const isDelivered = statusRaw === "delivered";
//     const paymentStatusRaw = displayVal(rec.Payment_Status ?? "").toLowerCase().trim();
//     const isPaid = paymentStatusRaw === "paid";
//     const regionName = displayVal(rec["MUO.Region"] ?? rec.Region ?? "").toLowerCase().trim();
//     const muoName = displayVal(
//       rec["MUO.MUO_Name"] ?? rec["MUO.Name"] ?? rec["MUO.Full_Name"] ?? rec.MUO ?? ""
//     ).trim();
//     const satoName = displayVal(
//       rec["SATO.SATO_Name"] ?? rec["SATO.Name"] ?? rec["SATO.Full_Name"] ?? rec.SATO ?? ""
//     ).trim();
//
//     let orderDate = null;
//     const odf = rec.Order_Date ?? rec.Date_of_Order ?? rec.Created_Time ??
//       rec.Added_Time ?? rec.Date ?? rec.created_time ?? "";
//     if (odf) { try { orderDate = new Date(odf); } catch (e) { } }
//
//     let expectedDate = null;
//     const edd = rec.Expected_Delivery_Date ?? rec.Expected_Date ?? rec.Delivery_Date ?? "";
//     if (edd) { try { expectedDate = new Date(edd); } catch (e) { } }
//
//     orderMetaMap.set(orderId, {
//       isDelivered, isPaid, regionName,
//       muoName, satoName, expectedDate, statusRaw,
//       orderDate,
//     });
//   }
//
//   /* Collect all months that have data */
//   const monthsWithData = new Set();
//   for (const [, meta] of orderMetaMap) {
//     const d = meta.orderDate ?? meta.expectedDate;
//     if (d && !isNaN(d)) {
//       const mk = getMonthKey(d);
//       if (mk) monthsWithData.add(mk);
//     }
//   }
//
//   const availableMonths = [...monthsWithData]
//     .sort()
//     .map(key => ({ key, label: monthKeyToLabel(key) }));
//
//   /* Month filter helper */
//   function isInMonthFilter(meta) {
//     if (!monthKey) return true;
//     const d = meta.orderDate ?? meta.expectedDate;
//     if (!d || isNaN(d)) return false;
//     return d >= monthStart && d <= monthEnd;
//   }
//
//   /* Per-month aggregation for trend chart */
//   const monthlyMap = {};
//
//   /* Main aggregation vars */
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
//   const allProductsMap = {};
//   let feedKgOrdered = 0, feedKgDelivered = 0, feedKgPending = 0;
//   const muoMap = {};
//   const satoMap = {};
//   let pendingWeekQty = 0, pendingMonthQty = 0;
//   const seenWeekOrders = new Set(), seenMonthOrders = new Set();
//   const pendingWeekList = [], pendingMonthList = [];
//   const unmatchedProducts = new Set();
//
//   for (const row of sfRows) {
//     const qty = Number(row.Quantity ?? 0);
//     if (qty === 0) continue;
//
//     const orderId = row.SO_Reference?.ID;
//     if (!orderId) continue;
//
//     const meta = orderMetaMap.get(String(orderId));
//     if (!meta) continue;
//
//     const { isDelivered, isPaid, regionName, muoName, satoName, expectedDate, orderDate } = meta;
//
//     if (filterRegionName && !regionName.includes(filterRegionName)) continue;
//
//     /* ── Always aggregate per-month trend (ignore month filter) ── */
//     const rowMonthKey = getMonthKey(orderDate ?? expectedDate);
//     if (rowMonthKey) {
//       if (!monthlyMap[rowMonthKey]) {
//         monthlyMap[rowMonthKey] = { grangers: 0, layers: 0, broilers: 0, chicksOrdered: 0, chicksDelivered: 0 };
//       }
//       const pn = displayVal(row.Product ?? "").trim().toUpperCase();
//       if (pn.includes("GRANGER") || pn.includes("COCK")) {
//         monthlyMap[rowMonthKey].grangers += qty;
//         monthlyMap[rowMonthKey].chicksOrdered += qty;
//         if (isDelivered) monthlyMap[rowMonthKey].chicksDelivered += qty;
//       } else if (pn.includes("LAYER") || pn.includes("NOVO")) {
//         monthlyMap[rowMonthKey].layers += qty;
//         monthlyMap[rowMonthKey].chicksOrdered += qty;
//         if (isDelivered) monthlyMap[rowMonthKey].chicksDelivered += qty;
//       } else if (pn.includes("BROILER")) {
//         monthlyMap[rowMonthKey].broilers += qty;
//         monthlyMap[rowMonthKey].chicksOrdered += qty;
//         if (isDelivered) monthlyMap[rowMonthKey].chicksDelivered += qty;
//       }
//     }
//
//     /* ── Month filter for main KPIs ── */
//     if (!isInMonthFilter(meta)) continue;
//
//     if (!seenOrders.has(orderId)) {
//       seenOrders.add(orderId);
//       if (isDelivered) ordersDelivered++;
//       else ordersPending++;
//     }
//
//     const productName = displayVal(row.Product ?? "").trim();
//     const productType = displayVal(row.Product_Type ?? "").trim();
//     const productKey = productName || productType || "Unknown";
//     const productUpper = productName.toUpperCase();
//     const category = classifyProduct(productName, productType);
//
//     if (!allProductsMap[productKey]) {
//       allProductsMap[productKey] = { ordered: 0, delivered: 0, pending: 0, category, types: {} };
//     }
//     allProductsMap[productKey].ordered += qty;
//     if (isDelivered) allProductsMap[productKey].delivered += qty;
//     else allProductsMap[productKey].pending += qty;
//     if (productType) {
//       allProductsMap[productKey].types[productType] =
//         (allProductsMap[productKey].types[productType] ?? 0) + qty;
//     }
//
//     if (category === "feed") {
//       feedKgOrdered += qty;
//       if (isDelivered) feedKgDelivered += qty;
//       else feedKgPending += qty;
//     }
//
//     if (muoName && category === "chick") {
//       if (!muoMap[muoName]) muoMap[muoName] = { ordered: 0, delivered: 0 };
//       muoMap[muoName].ordered += qty;
//       if (isDelivered) muoMap[muoName].delivered += qty;
//     }
//
//     if (satoName && category === "chick") {
//       if (!satoMap[satoName]) satoMap[satoName] = { paidQty: 0, totalQty: 0 };
//       satoMap[satoName].totalQty += qty;
//       if (isPaid) satoMap[satoName].paidQty += qty;
//     }
//
//     /* ── Pending deliveries (always current week/month regardless of month filter) ── */
//     if (!isDelivered && expectedDate && !isNaN(expectedDate)) {
//       if (expectedDate >= startOfWeek && expectedDate <= endOfWeek) {
//         pendingWeekQty += qty;
//         if (!seenWeekOrders.has(String(orderId))) {
//           seenWeekOrders.add(String(orderId));
//           pendingWeekList.push({
//             orderId: String(orderId), muoName, satoName,
//             expectedDate: expectedDate.toISOString().split("T")[0],
//             status: meta.statusRaw,
//             qty,
//           });
//         }
//       }
//       if (expectedDate >= startOfMonth && expectedDate <= endOfMonth) {
//         pendingMonthQty += qty;
//         if (!seenMonthOrders.has(String(orderId))) {
//           seenMonthOrders.add(String(orderId));
//           pendingMonthList.push({
//             orderId: String(orderId), muoName, satoName,
//             expectedDate: expectedDate.toISOString().split("T")[0],
//             status: meta.statusRaw,
//             qty,
//           });
//         }
//       }
//     }
//
//     const name = productUpper || productType.toUpperCase();
//     if (name.includes("GRANGER") || name.includes("COCK")) {
//       grangers += qty;
//       addBreed(grangerBreeds, productType, qty);
//       if (isDelivered) { grangersDelivered += qty; addBreed(grangerBreedsDel, productType, qty); }
//       else { grangersPending += qty; addBreed(grangerBreedsPend, productType, qty); }
//     } else if (name.includes("LAYER") || name.includes("NOVO")) {
//       layers += qty;
//       addBreed(layerBreeds, productType, qty);
//       if (isDelivered) { layersDelivered += qty; addBreed(layerBreedsDel, productType, qty); }
//       else { layersPending += qty; addBreed(layerBreedsPend, productType, qty); }
//     } else if (name.includes("BROILER")) {
//       broilers += qty;
//       addBreed(broilerBreeds, productType, qty);
//       if (isDelivered) { broilersDelivered += qty; addBreed(broilerBreedsDel, productType, qty); }
//       else { broilersPending += qty; addBreed(broilerBreedsPend, productType, qty); }
//     } else {
//       if (!["feed", "medication", "sanitation", "equipment"].includes(category)) {
//         unmatchedProducts.add(productName || "[empty]");
//       }
//     }
//   }
//
//   const monthlyTrend = Object.entries(monthlyMap)
//     .sort(([a], [b]) => a.localeCompare(b))
//     .map(([key, d]) => ({
//       key,
//       label: monthKeyToLabel(key),
//       grangers: d.grangers,
//       layers: d.layers,
//       broilers: d.broilers,
//       chicksOrdered: d.chicksOrdered,
//       chicksDelivered: d.chicksDelivered,
//       total: d.grangers + d.layers + d.broilers,
//     }));
//
//   const topMuos = Object.entries(muoMap)
//     .map(([name, d]) => ({ name, value: d.delivered, ordered: d.ordered }))
//     .sort((a, b) => b.value - a.value)
//     .slice(0, 10);
//
//   const topSatos = Object.entries(satoMap)
//     .map(([name, d]) => ({ name, value: d.paidQty, totalQty: d.totalQty }))
//     .sort((a, b) => b.value - a.value)
//     .slice(0, 10);
//
//   pendingWeekList.sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));
//   pendingMonthList.sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));
//
//   return {
//     grangers, grangerBreeds, grangerBreedsDel, grangerBreedsPend, grangersDelivered, grangersPending,
//     layers, layerBreeds, layerBreedsDel, layerBreedsPend,
//     broilers, broilerBreeds, broilerBreedsDel, broilerBreedsPend,
//     chicksOrdered: grangers + layers + broilers,
//     chicksDelivered: grangersDelivered + layersDelivered + broilersDelivered,
//     chicksPending: grangersPending + layersPending + broilersPending,
//     layersOrdered: layers, broilersOrdered: broilers,
//     layersDelivered, broilersDelivered, layersPending, broilersPending,
//     ordersDelivered, ordersPending,
//     allProducts: allProductsMap,
//     feedKgOrdered, feedKgDelivered, feedKgPending,
//     topMuos, topSatos,
//     pendingWeek: { qty: pendingWeekQty, orders: seenWeekOrders.size, list: pendingWeekList.slice(0, 20) },
//     pendingMonth: { qty: pendingMonthQty, orders: seenMonthOrders.size, list: pendingMonthList.slice(0, 20) },
//     monthlyTrend,
//     availableMonths,
//   };
// }

/* ─────────────────────────────────────────────────
   5. WEEKLY OPERATION LOGS
───────────────────────────────────────────────── */
export async function fetchWeeklyMetrics(regionId = null) {
  await zohoInit();

  const reportCandidates = [
    "All_Weekly_Operation_Logs",
    "All_Weekly_Operations",
    "Field_Visit_Weekly_Summary",
    "Weekly_Operations_Report",
    "Weekly_Metrics_Report",
    "All_Weekly_Metrics",
  ];

  let records = [];
  for (const name of reportCandidates) {
    const r = await fetchAllRecords(name);
    if (r.length > 0) {
      records = r;
      break;
    }
  }

  if (records.length === 0) return DEFAULT_WEEKLY;

  let allowedMuoIds = null;
  if (regionId) {
    const muos = await fetchAllRecords(
      "All_Muo_Profiles",
      `Region.ID == "${regionId}"`,
    );
    allowedMuoIds = new Set(muos.map((m) => String(m.ID)));
  }

  let mortality = 0,
    feedKg = 0,
    birdsSold = 0,
    revenue = 0,
    sickBirds = 0;

  for (const rec of records) {
    if (allowedMuoIds) {
      const muoId = String(rec.MUO?.ID ?? rec.MUO ?? "");
      if (!allowedMuoIds.has(muoId)) continue;
    }
    const metrics = rec.Weekly_Metrics ?? [];
    for (const m of metrics) {
      const rawName =
        m.Weekly_Metrics ??
        m.Metric_Type ??
        m.metric_type ??
        m.Name ??
        m.name ??
        "";
      const n = displayVal(rawName).toLowerCase().trim();
      const qty = Number(m.Quantity) || 0;
      if (n.includes("mortality")) mortality += qty;
      else if (n.includes("feed")) feedKg += qty;
      else if (n.includes("birds sold")) birdsSold += qty;
      else if (n.includes("revenue")) revenue += qty;
      else if (n.includes("sick")) sickBirds += qty;
    }
  }

  return { mortality, feedKg, birdsSold, revenue, sickBirds };
}

/* ─────────────────────────────────────────────────
   6. COMBINED DASHBOARD FETCH
   ⚠️  SEQUENTIAL only (iOS native app requirement)
   monthKey: "YYYY-MM" or null
───────────────────────────────────────────────── */
export async function fetchDashboardData(
  regionId = null,
  monthKey = null,
  yearKey = null,
) {
  await zohoInit();

  let muo = DEFAULT_MUO;
  try {
    muo = await fetchMuoGenderCounts(regionId, yearKey); // ← ADDED yearKey
  } catch (e) {
    console.error("[zohoapi] MUO failed:", e);
  }

  let learners = 0;
  try {
    learners = await fetchCertifiedLearnersCount(regionId, yearKey); // ← ADDED yearKey
  } catch (e) {
    console.error("[zohoapi] Learners failed:", e);
  }

  let weekly = DEFAULT_WEEKLY;
  try {
    weekly = await fetchWeeklyMetrics(regionId);
  } catch (e) {
    console.error("[zohoapi] Weekly failed:", e);
  }

  let satoCommCfg = {
    grangerRate: 0.3,
    layerRate: 0.2,
    broilerRate: 0.2,
    layerTarget: 0,
    broilerTarget: 0,
  };
  try {
    satoCommCfg = await fetchSatoCommissionConfig();
  } catch (e) {
    console.error("[zohoapi] SatoCommissionConfig failed:", e);
  }

  let sales = DEFAULT_SALES;
  try {
    sales = await fetchSalesOrderSummary(
      regionId,
      monthKey,
      yearKey,
      satoCommCfg,
    );
  } catch (e) {
    console.error("[zohoapi] Sales failed:", e);
  }

  let feedDeliveryTargets = {
    feedDeliveriesOrdered: 0,
    feedDeliveriesDelivered: 0,
  };
  try {
    feedDeliveryTargets = await fetchFeedDeliveryTargets();
  } catch (e) {
    console.error("[zohoapi] FeedDeliveryTargets failed:", e);
  }

  return {
    muo,
    learners,
    sales: {
      ...sales,
      feedDeliveriesOrdered: feedDeliveryTargets.feedDeliveriesOrdered,
      feedDeliveriesDelivered: feedDeliveryTargets.feedDeliveriesDelivered,
    },
    weekly,
  };

  // return {
  //   muo, learners, sales: {
  //     ...sales,
  //     feedDeliveriesOrdered: feedDeliveryTargets.feedDeliveriesOrdered,
  //     feedDeliveriesDelivered: feedDeliveryTargets.feedDeliveriesDelivered,
  //   }, , weekly
  // };
}

/* ─────────────────────────────────────────────────
   7. FEED DELIVERY TARGETS from Target Config Report
───────────────────────────────────────────────── */
export async function fetchFeedDeliveryTargets() {
  await zohoInit();
  try {
    const records = await fetchAllRecords("Target_Config_Report");
    let feedDeliveriesOrdered = 0;
    let feedDeliveriesDelivered = 0;

    for (const rec of records) {
      const metricName = String(rec.Metric_Name ?? "")
        .toLowerCase()
        .trim();
      const targetValue = Number(rec.Target_Value ?? 0);
      const isActive =
        String(rec.Active ?? "")
          .toLowerCase()
          .trim() === "true";

      if (!isActive) continue;

      if (metricName === "feed_deliveries_ordered") {
        feedDeliveriesOrdered = targetValue;
      } else if (metricName === "feed_deliveries_delivered") {
        feedDeliveriesDelivered = targetValue;
      }
    }

    return { feedDeliveriesOrdered, feedDeliveriesDelivered };
  } catch (e) {
    console.error("[zohoapi] fetchFeedDeliveryTargets failed:", e);
    return { feedDeliveriesOrdered: 0, feedDeliveriesDelivered: 0 };
  }
}

export async function fetchSatoCommissionConfig() {
  await zohoInit();
  try {
    const records = await fetchAllRecords("Target_Config_Report");
    const targets = {};
    records.forEach((t) => {
      const isActive =
        String(t.Active ?? "")
          .toLowerCase()
          .trim() === "true";
      if (!isActive) return;
      const key = String(t.Metric_Name ?? "").trim();
      const val = Number(t.Target_Value ?? 0);
      const period = String(t.Period ?? "month")
        .toLowerCase()
        .trim();
      targets[`${key}_${period}`] = val;
    });
    return {
      grangerRate: targets["sato_granger_commission_month"] || 0.3,
      layerRate: targets["sato_layer_commission_month"] || 0.2,
      broilerRate: targets["sato_broiler_commission_month"] || 0.2,
      layerTarget: targets["sato_layer_target_month"] || 0,
      broilerTarget: targets["sato_broiler_target_month"] || 0,
    };
  } catch (e) {
    console.error("[zohoapi] fetchSatoCommissionConfig failed:", e);
    return {
      grangerRate: 0.3,
      layerRate: 0.2,
      broilerRate: 0.2,
      layerTarget: 0,
      broilerTarget: 0,
    };
  }
}
