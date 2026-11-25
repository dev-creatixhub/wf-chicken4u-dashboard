import React, { useState, useEffect } from "react";
import { exportToExcel, exportToPptx } from "../exportUtils";

const C = {
  pri: "#D97B0F",
  priLt: "#FFF4E0",
  priMid: "#FDD9A0",
  green: "#1F7A42",
  greenLt: "#EDFBF2",
  text: "#2A1A04",
  textMd: "#6B4A22",
  textSf: "#A87842",
  bord: "#F5D9A8",
  surf: "#FFFFFF",
  bg: "#FFF8EE",
};

export default function ExportButtons({
  dashData,
  regionName = "All Regions",
  monthLabel = null, // "2026 – April 2026" etc.
  monthlyTrend = [], // kept for API compat
  disabled = false,
  logoDataUrl = null, // pass LOGO_IMG from App.jsx
}) {
  const [pptxLoading, setPptxLoading] = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function handlePptx() {
    if (disabled || pptxLoading) return;
    setPptxLoading(true);
    try {
      await exportToPptx(
        dashData,
        regionName ?? "All Regions",
        monthLabel,
        logoDataUrl,
      );
    } catch (e) {
      console.error("PPTX export failed:", e);
      alert("PowerPoint export failed. Make sure pptxgenjs CDN is loaded.");
    } finally {
      setPptxLoading(false);
    }
  }

  function handleXlsx() {
    if (disabled || xlsxLoading) return;
    setXlsxLoading(true);
    try {
      exportToExcel(dashData, regionName ?? "All Regions", monthLabel);
    } catch (e) {
      console.error("Excel export failed:", e);
      alert("Excel export failed. Make sure SheetJS CDN is loaded.");
    } finally {
      setXlsxLoading(false);
    }
  }

  const btnBase = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: isMobile ? 0 : 7,
    borderRadius: isMobile ? 50 : 10,
    padding: isMobile ? "8px" : "8px 16px",
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    transition: "all .18s",
    whiteSpace: "nowrap",
  };

  const pptxStyle = {
    ...btnBase,
    background: disabled || pptxLoading ? "#eee" : "#C0392B",
    color: disabled || pptxLoading ? C.textSf : "#fff",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 2px 8px rgba(192,57,43,.25)",
  };

  const xlsxStyle = {
    ...btnBase,
    background: disabled || xlsxLoading ? "#eee" : C.green,
    color: disabled || xlsxLoading ? C.textSf : "#fff",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 2px 8px rgba(31,122,66,.25)",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "nowrap",
      }}
    >
      {/* PowerPoint */}
      <button
        style={pptxStyle}
        onClick={handlePptx}
        disabled={disabled || pptxLoading}
      >
        {pptxLoading ? (
          <i
            className="bi bi-arrow-repeat"
            style={{
              animation: "spin .8s linear infinite",
              fontSize: isMobile ? 16 : 14,
            }}
          />
        ) : (
          <i
            className="bi bi-file-earmark-ppt-fill"
            style={{ fontSize: isMobile ? 16 : 14 }}
          />
        )}
        {!isMobile && (pptxLoading ? "Exporting…" : "Export PPTX")}
      </button>

      {/* Excel */}
      <button
        style={xlsxStyle}
        onClick={handleXlsx}
        disabled={disabled || xlsxLoading}
      >
        {xlsxLoading ? (
          <i
            className="bi bi-arrow-repeat"
            style={{
              animation: "spin .8s linear infinite",
              fontSize: isMobile ? 16 : 14,
            }}
          />
        ) : (
          <i
            className="bi bi-file-earmark-excel-fill"
            style={{ fontSize: isMobile ? 16 : 14 }}
          />
        )}
        {!isMobile && (xlsxLoading ? "Exporting…" : "Export Excel")}
      </button>
    </div>
  );
}

// import React, { useState, useEffect } from "react";
// import { exportToExcel, exportToPptx } from "../exportUtils";
//
// const C = {
//   pri: "#D97B0F", priLt: "#FFF4E0", priMid: "#FDD9A0",
//   green: "#1F7A42", greenLt: "#EDFBF2",
//   text: "#2A1A04", textMd: "#6B4A22", textSf: "#A87842",
//   bord: "#F5D9A8", surf: "#FFFFFF", bg: "#FFF8EE",
// };
//
// export default function ExportButtons({
//   dashData,
//   regionName = "All Regions",
//   disabled = false,
// }) {
//   const [pptxLoading, setPptxLoading] = useState(false);
//   const [xlsxLoading, setXlsxLoading] = useState(false);
//   const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
//
//   // Handle resize (important for responsiveness)
//   useEffect(() => {
//     const handleResize = () => setIsMobile(window.innerWidth < 640);
//     window.addEventListener("resize", handleResize);
//     return () => window.removeEventListener("resize", handleResize);
//   }, []);
//
//   async function handlePptx() {
//     if (disabled || pptxLoading) return;
//     setPptxLoading(true);
//     try {
//       await exportToPptx(dashData, regionName ?? "All Regions");
//     } catch (e) {
//       console.error("PPTX export failed:", e);
//       alert("PowerPoint export failed. Make sure pptxgenjs CDN is loaded.");
//     } finally {
//       setPptxLoading(false);
//     }
//   }
//
//   function handleXlsx() {
//     if (disabled || xlsxLoading) return;
//     setXlsxLoading(true);
//     try {
//       exportToExcel(dashData, regionName ?? "All Regions");
//     } catch (e) {
//       console.error("Excel export failed:", e);
//       alert("Excel export failed. Make sure SheetJS CDN is loaded.");
//     } finally {
//       setXlsxLoading(false);
//     }
//   }
//
//   const btnBase = {
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     gap: isMobile ? 0 : 7,
//     borderRadius: isMobile ? 50 : 10,
//     padding: isMobile ? "8px" : "8px 16px",
//     cursor: "pointer",
//     fontFamily: "'Poppins',sans-serif",
//     fontSize: 12,
//     fontWeight: 600,
//     border: "none",
//     transition: "all .18s",
//     whiteSpace: "nowrap",
//   };
//
//   const pptxStyle = {
//     ...btnBase,
//     background: disabled || pptxLoading ? "#eee" : "#C0392B",
//     color: disabled || pptxLoading ? C.textSf : "#fff",
//     opacity: disabled ? 0.55 : 1,
//     cursor: disabled ? "not-allowed" : "pointer",
//     boxShadow: disabled ? "none" : "0 2px 8px rgba(192,57,43,.25)",
//   };
//
//   const xlsxStyle = {
//     ...btnBase,
//     background: disabled || xlsxLoading ? "#eee" : C.green,
//     color: disabled || xlsxLoading ? C.textSf : "#fff",
//     opacity: disabled ? 0.55 : 1,
//     cursor: disabled ? "not-allowed" : "pointer",
//     boxShadow: disabled ? "none" : "0 2px 8px rgba(31,122,66,.25)",
//   };
//
//   return (
//     <div
//       style={{
//         display: "flex",
//         alignItems: "center",
//         gap: 8,
//         flexWrap: "nowrap", // important for mobile alignment
//       }}
//     >
//       {/* PowerPoint */}
//       <button
//         style={pptxStyle}
//         onClick={handlePptx}
//         disabled={disabled || pptxLoading}
//       >
//         {pptxLoading ? (
//           <i
//             className="bi bi-arrow-repeat"
//             style={{
//               animation: "spin .8s linear infinite",
//               fontSize: isMobile ? 16 : 14,
//             }}
//           />
//         ) : (
//           <i
//             className="bi bi-file-earmark-ppt-fill"
//             style={{ fontSize: isMobile ? 16 : 14 }}
//           />
//         )}
//
//         {/* Hide text on mobile */}
//         {!isMobile && (pptxLoading ? "Exporting…" : "Export PPTX")}
//       </button>
//
//       {/* Excel */}
//       <button
//         style={xlsxStyle}
//         onClick={handleXlsx}
//         disabled={disabled || xlsxLoading}
//       >
//         {xlsxLoading ? (
//           <i
//             className="bi bi-arrow-repeat"
//             style={{
//               animation: "spin .8s linear infinite",
//               fontSize: isMobile ? 16 : 14,
//             }}
//           />
//         ) : (
//           <i
//             className="bi bi-file-earmark-excel-fill"
//             style={{ fontSize: isMobile ? 16 : 14 }}
//           />
//         )}
//
//         {/* Hide text on mobile */}
//         {!isMobile && (xlsxLoading ? "Exporting…" : "Export Excel")}
//       </button>
//     </div>
//   );
// }
