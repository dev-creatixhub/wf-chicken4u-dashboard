import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetchRegions, fetchDashboardData } from "./zohoapi";
import { EmptyChart } from "./components/EmptyChart.jsx"

/* ── Inject fonts + Bootstrap Icons ─────────────── */
(function injectAssets() {
  [
    "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap",
    "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css",
  ].forEach((href) => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = href;
      document.head.appendChild(l);
    }
  });

  const id = "c4u-styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'Poppins',sans-serif !important; background:#FFF8EE !important; }
      ::-webkit-scrollbar { width:5px; height:5px; }
      ::-webkit-scrollbar-thumb { background:#F5CA80; border-radius:10px; }

      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.35} }
      .blink { animation:blink 2s infinite; }

      @keyframes spin { to { transform:rotate(360deg); } }
      .spin { animation:spin .8s linear infinite; }

      /* ── Grid helpers ── */
      .kpi-grid    { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; }
      .muo-grid    { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
      .chicks-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
      .charts-2    { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; }
      .sales-grid  { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }

      /* ── Desktop sidebar ── */
      .sidebar-desktop {
        width:220px; flex-shrink:0; background:#fff;
        border-left:1px solid #F5D9A8; height:100%;
        overflow-y:auto; display:flex; flex-direction:column;
        box-shadow:-2px 0 14px rgba(217,123,15,.05);
      }

      /* ── Mobile sidebar ── */
      .sidebar-mobile {
        display:none; position:fixed; top:0; right:-280px;
        width:270px; height:100vh; background:#fff;
        border-left:1px solid #F5D9A8;
        box-shadow:-4px 0 28px rgba(42,26,4,.2);
        z-index:600; overflow-y:auto; flex-direction:column;
        transition:right 0.3s cubic-bezier(.4,0,.2,1);
      }
      .sidebar-mobile.open { right:0 !important; }

      .mob-overlay {
        display:none; position:fixed; inset:0;
        background:rgba(42,26,4,.4); z-index:590;
      }
      .mob-overlay.show { display:block; }

      /* ── Skeleton shimmer ── */
      @keyframes shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position:  400px 0; }
      }
      .skeleton {
        border-radius:6px;
        background: linear-gradient(90deg, #f5e6cc 25%, #fff4e0 50%, #f5e6cc 75%);
        background-size: 400px 100%;
        animation: shimmer 1.4s ease-in-out infinite;
      }

      /* ── Tablet 1024 ── */
      @media(max-width:1024px){
        .kpi-grid    { grid-template-columns:repeat(3,1fr) !important; }
        .muo-grid    { grid-template-columns:repeat(3,1fr) !important; }
        .chicks-grid { grid-template-columns:repeat(2,1fr) !important; }
        .charts-2    { grid-template-columns:1fr !important; }
        .sales-grid  { grid-template-columns:repeat(3,1fr) !important; }
      }

      /* ── Mobile 768 ── */
      @media(max-width:768px){
        .kpi-grid        { grid-template-columns:repeat(2,1fr) !important; }
        .muo-grid        { grid-template-columns:1fr !important; }
        .chicks-grid     { grid-template-columns:1fr !important; }
        .charts-2        { grid-template-columns:1fr !important; }
        .sales-grid      { grid-template-columns:1fr !important; }
        .main-pad        { padding:14px !important; }
        .page-hdr        { flex-direction:column !important; gap:12px !important; }
        .rs-wrap-full    { max-width:100% !important; width:100% !important; }
        .sidebar-desktop { display:none !important; }
        .sidebar-mobile  { display:flex !important; }
        .mob-btn         { display:flex !important; }
      }

      /* ── Small 480 ── */
      @media(max-width:480px){
        .kpi-grid    { grid-template-columns:repeat(2,1fr) !important; }
        .muo-grid    { grid-template-columns:1fr !important; }
        .sales-grid  { grid-template-columns:1fr !important; }
        .nav-pad     { padding:0 14px !important; }
        .logo-sub    { display:none !important; }
      }
    `;
    document.head.appendChild(s);
  }
})();

/* ── Palette ─────────────────────────────────────── */
const C = {
  pri: "#D97B0F", priDk: "#A85E07", priLt: "#FFF4E0", priMid: "#FDD9A0",
  brownMd: "#7A5230",
  green: "#1F7A42", greenLt: "#EDFBF2",
  red: "#C0392B", redLt: "#FFF0EE",
  sky: "#0369A1", skyLt: "#E0F2FE",
  amber: "#C47E0C", amberLt: "#FFFBEB",
  purple: "#7C3AED", purpleLt: "#F5F3FF",
  pink: "#BE185D", pinkLt: "#FDF2F8",
  bg: "#FFF8EE", surf: "#FFFFFF", bord: "#F5D9A8", bordMd: "#EEC882",
  text: "#2A1A04", textMd: "#6B4A22", textSf: "#A87842",
};

/* ── Zoho Creator base URL ───────────────────────── */
const ZOHO_APP_URL = "https://creatorapp.zoho.com/wafadgroup1/poultry-management/#Form:";



/* ── Window width hook ───────────────────────────── */
function useWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return w;
}

/* ── Static historical chart data ───────────────── */


/* ── Today's sidebar feed (static placeholders) ─── */
const buildFeed = (data) => [
  { icon: "bi-egg", label: "Grangers Sold", val: (data?.sales?.grangers ?? 0).toLocaleString("en-IN"), color: C.pri },
  { icon: "bi-egg-fill", label: "Layers Sold", val: (data?.sales?.layers ?? 0).toLocaleString("en-IN"), color: C.green },
  { icon: "bi-basket2", label: "Broilers Sold", val: (data?.sales?.broilers ?? 0).toLocaleString("en-IN"), color: C.sky },
  { icon: "bi-heartbreak", label: "Mortality", val: (data?.weekly?.mortality ?? 0).toLocaleString("en-IN"), color: C.red },
  { icon: "bi-bag", label: "Feed Used (kg)", val: (data?.weekly?.feedKg ?? 0).toLocaleString("en-IN"), color: C.brownMd },
];

/* ── Skeleton value ──────────────────────────────── */
function SkeletonVal({ w = 60, h = 24 }) {
  return <span className="skeleton" style={{ display: "inline-block", width: w, height: h }} />;
}

/* ── Chart tooltip ───────────────────────────────── */
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 10,
      padding: "10px 14px", fontFamily: "'Poppins',sans-serif", fontSize: 12,
      boxShadow: `0 10px 28px rgba(61,34,10,.12)`
    }}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: C.text }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: <strong>{Number(p.value).toLocaleString("en-IN")}</strong>
        </p>
      ))}
    </div>
  );
}

/* ── Region search dropdown ──────────────────────── */
function RegionSearch({ value, onChange, regions = [], regLoading = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const list = regions.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
  const displayName = regLoading ? "Loading regions…" : (value?.name ?? "All Regions");
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", maxWidth: 280 }} className="rs-wrap-full">
      <div onClick={() => { if (!regLoading) { setOpen(o => !o); setQ(""); } }} style={{
        display: "flex", alignItems: "center", gap: 9, background: C.surf,
        border: `1.5px solid ${open ? C.pri : C.bord}`, borderRadius: 12, padding: "9px 14px",
        cursor: regLoading ? "not-allowed" : "pointer",
        boxShadow: open ? `0 0 0 3px ${C.priLt}` : `0 2px 8px rgba(217,123,15,.08)`,
        transition: "all .18s", opacity: regLoading ? 0.6 : 1,
      }}>
        {regLoading
          ? <span className="blink" style={{ width: 8, height: 8, borderRadius: "50%", background: C.pri, display: "inline-block", flexShrink: 0 }} />
          : <i className="bi bi-geo-alt-fill" style={{ color: open ? C.pri : C.textSf, fontSize: 15 }} />
        }
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: regLoading ? C.textSf : C.text }}>{displayName}</span>
        {!regLoading && <i className={`bi bi-chevron-${open ? "up" : "down"}`} style={{ color: C.textSf, fontSize: 11 }} />}
      </div>
      {open && !regLoading && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: C.surf,
          border: `1.5px solid ${C.bord}`, borderRadius: 12, zIndex: 9999,
          boxShadow: `0 16px 48px rgba(61,34,10,.22)`, overflow: "hidden"
        }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.bord}`, display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-search" style={{ color: C.textSf, fontSize: 13 }} />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search region…"
              style={{ border: "none", outline: "none", fontFamily: "'Poppins',sans-serif", fontSize: 13, color: C.text, background: "transparent", width: "100%" }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            <div onClick={() => { onChange(null); setOpen(false); }} style={{
              padding: "10px 14px", fontSize: 13, cursor: "pointer",
              fontWeight: !value ? 600 : 400, color: !value ? C.pri : C.text,
              background: !value ? C.priLt : "transparent",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
              onMouseEnter={e => { if (value) e.currentTarget.style.background = C.bg; }}
              onMouseLeave={e => { if (value) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i className="bi bi-globe" style={{ color: C.textSf, fontSize: 12 }} />All Regions
              </span>
              {!value && <i className="bi bi-check2-circle" style={{ color: C.pri, fontSize: 15 }} />}
            </div>
            {list.map(r => (
              <div key={r.id} onClick={() => { onChange(r); setOpen(false); }} style={{
                padding: "10px 14px", fontSize: 13, cursor: "pointer",
                fontWeight: value?.id === r.id ? 600 : 400, color: value?.id === r.id ? C.pri : C.text,
                background: value?.id === r.id ? C.priLt : "transparent",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
                onMouseEnter={e => { if (value?.id !== r.id) e.currentTarget.style.background = C.bg; }}
                onMouseLeave={e => { if (value?.id !== r.id) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="bi bi-geo-alt" style={{ color: C.textSf, fontSize: 12 }} />{r.name}
                </span>
                {value?.id === r.id && <i className="bi bi-check2-circle" style={{ color: C.pri, fontSize: 15 }} />}
              </div>
            ))}
            {!list.length && (
              <div style={{ padding: "16px", fontSize: 13, color: C.textSf, textAlign: "center" }}>
                <i className="bi bi-search" style={{ fontSize: 22, display: "block", marginBottom: 6 }} />No regions found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Panel ───────────────────────────────────────── */
function Panel({ children, style: sx = {} }) {
  return (
    <div style={{
      background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 16,
      padding: "20px 22px", boxShadow: `0 2px 14px rgba(217,123,15,.06)`, ...sx
    }}>
      {children}
    </div>
  );
}
function PH({ title, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 16, flexWrap: "wrap", gap: 8
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 7 }}>{title}</p>
      {right}
    </div>
  );
}
function Pill({ children, color = C.pri, bg = C.priLt }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: bg, color,
      display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
    }}>{children}</span>
  );
}

/* ── Breed row ───────────────────────────────────── */
function BreedRow({ label, value, color, loading }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 10px", borderRadius: 8, background: color + "0D", border: `1px solid ${color}22`, marginTop: 6
    }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: C.textMd, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        {label}
      </span>
      {loading ? <SkeletonVal w={48} h={16} /> : <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>}
    </div>
  );
}

/* ── Chick section card ──────────────────────────── */
function ChicksSectionCard({ icon, title, color, bg, total, breeds, loading }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${color}33`, background: bg, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: color + "1A", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <i className={`bi ${icon}`} style={{ color, fontSize: 16 }} />
        </div>
        <div>
          <p style={{ fontSize: 9.5, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: ".07em" }}>{title}</p>
          {loading
            ? <SkeletonVal w={60} h={20} />
            : <p style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: "-.4px", lineHeight: 1.1 }}>{total}</p>
          }
        </div>
      </div>
      {breeds.map(b => <BreedRow key={b.label} label={b.label} value={b.value} color={color} loading={loading} />)}
    </div>
  );
}

/* ── Sidebar quick link (opens Zoho Creator form) ── */
function QuickLinkBtn({ icon, label, color, href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      <button style={{
        display: "flex", alignItems: "center", gap: 9, width: "100%",
        padding: "10px 11px", borderRadius: 10, border: `1px solid ${C.bord}`,
        background: C.bg, fontFamily: "'Poppins',sans-serif", fontSize: 12,
        fontWeight: 500, color: C.textMd, cursor: "pointer", textAlign: "left", transition: "all .15s",
      }}
        onMouseEnter={e => {
          e.currentTarget.style.background = C.priLt;
          e.currentTarget.style.borderColor = C.priMid;
          e.currentTarget.style.color = C.pri;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = C.bg;
          e.currentTarget.style.borderColor = C.bord;
          e.currentTarget.style.color = C.textMd;
        }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, background: color + "18", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`bi ${icon}`} style={{ color, fontSize: 13 }} />
        </span>
        {label}
      </button>
    </a>
  );
}

/* ── Sidebar contents ────────────────────────────── */
function SidebarContents({ onClose, isMobile, regionName, dashData, dataLoading }) {
  const feed = buildFeed(dashData);
  return (
    <>
      {isMobile && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 16px 12px", borderBottom: `1px solid ${C.bord}`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: `linear-gradient(135deg,${C.pri},${C.amber})`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
            }}>🐔</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              <span style={{ color: C.pri }}>Chicken</span>4U
            </span>
          </div>
          <button onClick={onClose} style={{
            background: C.bg, border: "none", cursor: "pointer",
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            color: C.textMd, fontSize: 18
          }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
      )}

      {/* Quick Links — only Add MUO */}
      <div style={{ padding: isMobile ? "16px 16px 0" : "20px 16px 0" }}>
        <p style={{
          fontSize: 10, fontWeight: 700, color: C.textSf, textTransform: "uppercase",
          letterSpacing: ".1em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6
        }}>
          <i className="bi bi-lightning-charge-fill" style={{ color: C.amber, fontSize: 13 }} /> Quick Links
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <QuickLinkBtn
            icon="bi-person-plus"
            label="Add MUO"
            color={C.sky}
            href={`${ZOHO_APP_URL}MUO_Profile_Form`}
          />
        </div>
      </div>

      <div style={{ height: 1, background: C.bord, margin: "16px 0" }} />

      {/* Today's Counts */}
      <div style={{ padding: "0 16px", flex: 1 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, color: C.textSf, textTransform: "uppercase",
          letterSpacing: ".1em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6
        }}>
          <i className="bi bi-sun" style={{ color: C.amber, fontSize: 13 }} /> Today's Counts
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {feed.map(({ icon, label, val, color }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 10px", borderRadius: 9, background: C.bg, border: `1px solid ${C.bord}`
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.textMd }}>
                <i className={`bi ${icon}`} style={{ color, fontSize: 13, width: 16 }} />{label}
              </span>
              {dataLoading
                ? <SkeletonVal w={36} h={14} />
                : <span style={{ fontSize: 13, fontWeight: 700, color }}>{val}</span>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div style={{ padding: "16px", borderTop: `1px solid ${C.bord}`, marginTop: "auto" }}>
        <div style={{ background: C.priLt, border: `1px solid ${C.priMid}`, borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ fontSize: 11, color: C.textMd, lineHeight: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <span><i className="bi bi-clock-history" style={{ marginRight: 6, color: C.pri }} />Last sync: <strong style={{ color: C.text }}>Just now</strong></span>
            <span><i className="bi bi-geo-alt-fill" style={{ marginRight: 6, color: C.pri }} />Region: <strong style={{ color: C.pri }}>{regionName ?? "All"}</strong></span>
          </p>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════ */
export default function App() {
  const [mobOpen, setMobOpen] = useState(false);
  const w = useWidth();
  const isMob = w <= 768;
  const isSm = w <= 480;




  /* ── Regions ─────────────────────────────────── */
  const [regions, setRegions] = useState([]);
  const [region, setRegion] = useState(null);   // null = All Regions
  const [regLoading, setRegLoading] = useState(true);

  /* ── Dashboard data ──────────────────────────── */
  const [dashData, setDashData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  /* ── Load regions on mount ───────────────────── */
  useEffect(() => {
    (async () => {
      try {
        setRegLoading(true);
        const regData = await fetchRegions();
        setRegions(regData);
      } catch (e) {
        console.error("[App] fetchRegions failed:", e);
      } finally {
        setRegLoading(false);
      }
    })();
  }, []);

  /* ── Reload dashboard data when region changes ─ */
  const loadDashboard = useCallback(async (regionId) => {
    try {
      setDataLoading(true);
      const data = await fetchDashboardData(regionId);
      setDashData(data);
    } catch (e) {
      console.error("[App] fetchDashboardData failed:", e);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(region?.id ?? null);
  }, [region, loadDashboard]);

  useEffect(() => { if (!isMob) setMobOpen(false); }, [isMob]);

  /* ── Derived values ──────────────────────────── */
  const muoTotal = dashData?.muo?.total ?? 0;
  const muoMale = dashData?.muo?.male ?? 0;
  const muoFemale = dashData?.muo?.female ?? 0;
  const sspTotal = dashData?.muo?.sspTotal ?? 0;
  const certified = dashData?.learners ?? 0;
  const mortality = dashData?.weekly?.mortality ?? 0;
  const feedKg = dashData?.weekly?.feedKg ?? 0;

  const chicksOrdered = dashData?.sales?.chicksOrdered ?? 0;
  const chicksDelivered = dashData?.sales?.chicksDelivered ?? 0;
  const chicksPending = dashData?.sales?.chicksPending ?? 0;
  const layersOrdered = dashData?.sales?.layersOrdered ?? 0;
  const broilersOrdered = dashData?.sales?.broilersOrdered ?? 0;
  const layersDel = dashData?.sales?.layersDelivered ?? 0;
  const broilersDel = dashData?.sales?.broilersDelivered ?? 0;
  const layersPend = dashData?.sales?.layersPending ?? 0;
  const broilersPend = dashData?.sales?.broilersPending ?? 0;
  const grangers = dashData?.sales?.grangers ?? 0;
  const layers = dashData?.sales?.layers ?? 0;
  const broilers = dashData?.sales?.broilers ?? 0;


  // derived values
  const dynamicChicksData = chicksOrdered > 0 || chicksDelivered > 0
    ? [
      { m: "Current", ordered: chicksOrdered, received: chicksDelivered }
    ]
    : [];

  const dynamicSalesData = grangers > 0 || layers > 0 || broilers > 0
    ? [
      { m: "Current", grangers, layers, broilers }
    ]
    : [];


  /* ── Chart helpers ───────────────────────────── */
  const tickStyle = { fontSize: isMob ? 9 : 11, fontFamily: "'Poppins'", fill: C.textSf };
  const xAxis = { dataKey: "m", tick: tickStyle, axisLine: false, tickLine: false, interval: isMob ? 1 : 0 };
  const yAxis = {
    tick: tickStyle, axisLine: false, tickLine: false, width: 32,
    tickFormatter: v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v
  };

  /* ── KPI cards data ──────────────────────────── */
  const kpis = [
    { icon: "bi-building", label: "Total MUOs", value: muoTotal, top: C.pri },
    { icon: "bi-people", label: "Total Certified", value: certified, top: C.sky },
    { icon: "bi-egg", label: "Chicks Ordered", value: chicksOrdered, top: C.amber },
    { icon: "bi-bag", label: "Feed Used (kg)", value: feedKg, top: C.brownMd },
    { icon: "bi-heartbreak", label: "Total Mortality", value: mortality, top: C.red },
    { icon: "bi-shop", label: "Total SSPs", value: sspTotal, top: C.green },
  ];

  const fmt = n => Number(n).toLocaleString("en-IN");

  return (
    <div style={{ fontFamily: "'Poppins',sans-serif", background: C.bg, minHeight: "100vh", overflowX: "hidden" }}>

      {/* ══ MOBILE OVERLAY ══ */}
      <div className={`mob-overlay${mobOpen ? " show" : ""}`} onClick={() => setMobOpen(false)} />

      {/* ══ MOBILE SIDEBAR ══ */}
      <div className={`sidebar-mobile${mobOpen ? " open" : ""}`}>
        <SidebarContents
          isMobile={true} onClose={() => setMobOpen(false)}
          regionName={region?.name} dashData={dashData} dataLoading={dataLoading}
        />
      </div>

      {/* ══ TOP NAV ══ */}
      <header className="nav-pad" style={{
        background: C.surf, borderBottom: `1px solid ${C.bord}`, height: 62,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", position: "sticky", top: 0, zIndex: 200,
        boxShadow: `0 2px 16px rgba(217,123,15,.09)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: `linear-gradient(135deg,${C.pri},${C.amber})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, boxShadow: `0 4px 14px ${C.pri}55`
          }}>🐔</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: C.text }}>
              <span style={{ color: C.pri }}>Chicken</span>4U</div>
            <div className="logo-sub" style={{ fontSize: 9.5, color: C.textSf, fontWeight: 500, letterSpacing: ".05em" }}>
              WAFAD GROUP</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Live / loading badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: dataLoading ? C.amberLt : C.greenLt,
            border: `1px solid ${dataLoading ? "#F5CA80" : "#9EE6B3"}`,
            borderRadius: 20, padding: "4px 12px"
          }}>
            {dataLoading
              ? <i className="bi bi-arrow-repeat spin" style={{ color: C.amber, fontSize: 11 }} />
              : <span className="blink" style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block" }} />
            }
            <span style={{ fontSize: 11, fontWeight: 600, color: dataLoading ? C.amber : C.green }}>
              {dataLoading ? "Syncing…" : "Live"}
            </span>
          </div>

          {/* Mobile sidebar toggle */}
          <button
            className="mob-btn"
            onClick={() => setMobOpen(o => !o)}
            style={{
              display: "none",
              alignItems: "center", gap: 6,
              background: C.priLt, border: `1px solid ${C.priMid}`,
              borderRadius: 9, padding: "6px 12px", cursor: "pointer",
              color: C.pri, fontSize: 12, fontWeight: 600,
            }}>
            <i className="bi bi-layout-sidebar-reverse" style={{ fontSize: 14 }} />
            {!isSm && <span>Menu</span>}
          </button>

          {/* Avatar */}
          <div style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg,${C.pri},${C.amber})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: `0 2px 8px ${C.pri}55`
          }}>A</div>
        </div>
      </header>

      {/* ══ BODY ══ */}
      <div style={{ display: "flex", height: "calc(100vh - 62px)", overflow: "hidden" }}>

        {/* ── MAIN CONTENT ── */}
        <main className="main-pad" style={{
          flex: 1, padding: "24px 28px",
          minWidth: 0, height: "100%", overflowY: "auto",
          width: isMob ? "100%" : "auto",
        }}>

          {/* Page header */}
          <div className="page-hdr" style={{
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", marginBottom: 22, gap: 14
          }}>
            <div>
              <h1 style={{
                fontSize: isMob ? 17 : 20, fontWeight: 700, color: C.text, letterSpacing: "-.4px",
                display: "flex", alignItems: "center", gap: 9
              }}>
                <i className="bi bi-speedometer2" style={{ color: C.pri, fontSize: 18 }} />
                Overview Dashboard
              </h1>
              <p style={{ fontSize: 12, color: C.textSf, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <i className="bi bi-calendar3" style={{ fontSize: 11 }} />
                March 2026 · Real-time poultry data
              </p>
            </div>
            <RegionSearch
              value={region} onChange={setRegion}
              regions={regions} regLoading={regLoading}
            />
          </div>

          {/* ── KPI STRIP ── */}
          <div className="kpi-grid" style={{ marginBottom: 12 }}>
            {kpis.map(({ icon, label, value, top }) => (
              <div key={label} style={{
                background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 14,
                padding: "14px 14px 12px", borderTop: `3px solid ${top}`,
                boxShadow: `0 2px 12px rgba(217,123,15,.05)`
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{
                    fontSize: 9.5, fontWeight: 600, color: C.textSf, textTransform: "uppercase",
                    letterSpacing: ".06em", lineHeight: 1.3
                  }}>{label}</span>
                  <span style={{
                    width: 28, height: 28, borderRadius: 7, background: top + "18", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <i className={`bi ${icon}`} style={{ color: top, fontSize: 13 }} />
                  </span>
                </div>
                {dataLoading
                  ? <SkeletonVal w={70} h={isSm ? 20 : isMob ? 22 : 26} />
                  : <p style={{
                    fontSize: isSm ? 15 : isMob ? 17 : 20, fontWeight: 700, color: C.text,
                    letterSpacing: "-.5px", lineHeight: 1
                  }}>{fmt(value)}</p>
                }
              </div>
            ))}
          </div>

          {/* ── MUO Gender Split ── */}
          <div className="muo-grid" style={{ marginBottom: 22 }}>
            {[
              {
                icon: "bi-gender-female", label: "Female MUOs",
                value: muoFemale, color: C.pink, bg: C.pinkLt,
                pct: muoTotal > 0 ? ((muoFemale / muoTotal) * 100).toFixed(1) + "%" : "0%"
              },
              {
                icon: "bi-gender-male", label: "Male MUOs",
                value: muoMale, color: C.sky, bg: C.skyLt,
                pct: muoTotal > 0 ? ((muoMale / muoTotal) * 100).toFixed(1) + "%" : "0%"
              },
              {
                icon: "bi-people-fill", label: "Total MUOs",
                value: muoTotal, color: C.purple, bg: C.purpleLt, pct: "100%"
              },
            ].map(({ icon, label, value, color, bg, pct }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                background: bg, borderRadius: 12, padding: "14px 16px",
                border: `1px solid ${color}22`, boxShadow: `0 2px 10px ${color}0F`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, background: color + "1A", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <i className={`bi ${icon}`} style={{ color, fontSize: 20 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 9.5, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</p>
                    {dataLoading
                      ? <SkeletonVal w={70} h={isMob ? 22 : 26} />
                      : <p style={{ fontSize: isMob ? 20 : 24, fontWeight: 700, color, letterSpacing: "-.5px", lineHeight: 1.1 }}>{fmt(value)}</p>
                    }
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                    background: "#fff", color, border: `1px solid ${color}33`
                  }}>{dataLoading ? "—" : pct}</span>
                  <p style={{ fontSize: 10, color: C.textSf, marginTop: 4 }}>of total</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Chicks: Ordered / Delivered / Pending ── */}
          <div className="chicks-grid" style={{ marginBottom: 22 }}>
            {/* Ordered */}
            <Panel>
              <PH
                title={<><i className="bi bi-cart3" style={{ color: C.amber }} /> Chicks Ordered</>}
                right={<Pill color={C.amber} bg={C.amberLt}><i className="bi bi-calendar-month" />Mar 2026</Pill>}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ChicksSectionCard
                  icon="bi-egg-fill" title="Layers" color={C.green} bg={C.greenLt}
                  total={fmt(layersOrdered)}
                  breeds={[
                    { label: "Novobrown", value: fmt(Math.round(layersOrdered * 0.554)) },
                    { label: "Novowhite", value: fmt(Math.round(layersOrdered * 0.446)) },
                  ]}
                  loading={dataLoading}
                />
                <ChicksSectionCard
                  icon="bi-basket2-fill" title="Broiler" color={C.sky} bg={C.skyLt}
                  total={fmt(broilersOrdered)}
                  breeds={[{ label: "Efficiency Plus", value: fmt(broilersOrdered) }]}
                  loading={dataLoading}
                />
              </div>
            </Panel>

            {/* Delivered */}
            <Panel>
              <PH
                title={<><i className="bi bi-box-seam" style={{ color: C.green }} /> Chicks Delivered</>}
                right={<Pill color={C.green} bg={C.greenLt}><i className="bi bi-check2-circle" />Received</Pill>}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ChicksSectionCard
                  icon="bi-egg-fill" title="Layers" color={C.green} bg={C.greenLt}
                  total={fmt(layersDel)}
                  breeds={[
                    { label: "Novobrown", value: fmt(Math.round(layersDel * 0.554)) },
                    { label: "Novowhite", value: fmt(Math.round(layersDel * 0.446)) },
                  ]}
                  loading={dataLoading}
                />
                <ChicksSectionCard
                  icon="bi-basket2-fill" title="Broiler" color={C.sky} bg={C.skyLt}
                  total={fmt(broilersDel)}
                  breeds={[{ label: "Efficiency Plus", value: fmt(broilersDel) }]}
                  loading={dataLoading}
                />
              </div>
            </Panel>

            {/* Pending */}
            <Panel>
              <PH
                title={<><i className="bi bi-hourglass-split" style={{ color: C.red }} /> Pending Delivery</>}
                right={<Pill color={C.red} bg={C.redLt}><i className="bi bi-clock" />Awaiting</Pill>}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ChicksSectionCard
                  icon="bi-egg-fill" title="Layers" color={C.amber} bg={C.amberLt}
                  total={fmt(layersPend)}
                  breeds={[
                    { label: "Novobrown", value: fmt(Math.round(layersPend * 0.71)) },
                    { label: "Novowhite", value: fmt(Math.round(layersPend * 0.29)) },
                  ]}
                  loading={dataLoading}
                />
                <ChicksSectionCard
                  icon="bi-basket2-fill" title="Broiler" color={C.red} bg={C.redLt}
                  total={fmt(broilersPend)}
                  breeds={[{ label: "Efficiency Plus", value: fmt(broilersPend) }]}
                  loading={dataLoading}
                />
              </div>
            </Panel>
          </div>

          {/* ── CHARTS ── */}
          <div className="charts-2" style={{ marginBottom: 22 }}>

            {/* Monthly Chicks */}
            <Panel>
              <PH
                title={<><i className="bi bi-bar-chart" style={{ color: C.pri }} /> Monthly Chicks</>}
                right={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[[C.pri, "Ordered"], [C.priMid, "Received"]].map(([c, l]) => (
                      <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: C.textSf }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                      </span>
                    ))}
                  </div>
                }
              />
              {dynamicChicksData.length === 0 ? (
                <EmptyChart height={isMob ? 180 : 240} message="No chick data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={isMob ? 180 : 240}>
                  <BarChart data={dynamicChicksData} barCategoryGap="25%" barGap={2} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <XAxis {...xAxis} /><YAxis {...yAxis} />
                    <Tooltip content={<Tip />} cursor={{ fill: "rgba(217,123,15,0.06)" }} />
                    <Bar dataKey="ordered" fill={C.pri} radius={[5, 5, 0, 0]} name="Ordered" />
                    <Bar dataKey="received" fill={C.priMid} radius={[5, 5, 0, 0]} name="Received" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            {/* Monthly Sales */}
            <Panel>
              <PH
                title={<><i className="bi bi-graph-up-arrow" style={{ color: C.pri }} /> Monthly Sales</>}
                right={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[[C.pri, "Grangers"], [C.green, "Layers"], [C.sky, "Broilers"]].map(([c, l]) => (
                      <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: C.textSf }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, display: "inline-block" }} />{l}
                      </span>
                    ))}
                  </div>
                }
              />
              {dynamicSalesData.length === 0 ? (
                <EmptyChart height={isMob ? 180 : 240} message="No sales data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={isMob ? 180 : 240}>
                  <AreaChart data={dynamicSalesData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.pri} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={C.pri} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis {...xAxis} /><YAxis {...yAxis} />
                    <Tooltip content={<Tip />} cursor={{ stroke: C.bord, strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="grangers" stroke={C.pri} fill="url(#aG)" strokeWidth={2.5} dot={{ r: 3, fill: C.pri, strokeWidth: 0 }} name="Grangers" />
                    <Line type="monotone" dataKey="layers" stroke={C.green} fill="none" strokeWidth={2.5} dot={{ r: 3, fill: C.green, strokeWidth: 0 }} name="Layers" />
                    <Line type="monotone" dataKey="broilers" stroke={C.sky} fill="none" strokeWidth={2.5} dot={{ r: 3, fill: C.sky, strokeWidth: 0 }} name="Broilers" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Panel>

          </div>

          {/* ── SALES SUMMARY ── */}
          <Panel style={{ marginBottom: 22 }}>
            <PH
              title={<><i className="bi bi-currency-rupee" style={{ color: C.pri }} /> Sales Summary</>}
              right={<Pill><i className="bi bi-calendar-month" />March 2026</Pill>}
            />
            <div className="sales-grid">
              {[
                { label: "Grangers Sold", icon: "bi-egg", value: grangers, color: C.pri, bg: C.priLt },
                { label: "Layers Sold", icon: "bi-egg-fill", value: layers, color: C.green, bg: C.greenLt },
                { label: "Broilers Sold", icon: "bi-basket2-fill", value: broilers, color: C.sky, bg: C.skyLt },
              ].map(({ label, icon, value, color, bg }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: 8, background: bg, borderRadius: 11, padding: "13px 16px",
                  border: `1px solid ${color}22`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 11, background: color + "1A", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <i className={`bi ${icon}`} style={{ color, fontSize: 19 }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</p>
                      {dataLoading
                        ? <SkeletonVal w={80} h={isMob ? 20 : 24} />
                        : <p style={{ fontSize: isMob ? 18 : 22, fontWeight: 700, color, letterSpacing: "-.5px", lineHeight: 1.1 }}>{fmt(value)}</p>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

        </main>

        {/* ══ DESKTOP SIDEBAR ══ */}
        <aside className="sidebar-desktop">
          <SidebarContents
            isMobile={false} regionName={region?.name}
            dashData={dashData} dataLoading={dataLoading}
          />
        </aside>

      </div>
    </div>
  );
}

