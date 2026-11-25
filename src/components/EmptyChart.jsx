
import React from "react"

// Only the two colors used in this component
const brownMd = "#7A5230"
const textSf = "#A87842"

export function EmptyChart({ height = 240, message = "No chicks around here" }) {
  return (
    <div style={{
      height,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    }}>
      <svg width="80" height="90" viewBox="0 0 80 90" style={{ animation: "emptyFloat 3.2s ease-in-out infinite" }}>
        <style>{`
          @keyframes emptyFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
          @keyframes emptyBlink  { 0%,90%,100%{ry:4} 93%,97%{ry:1} }
          @keyframes emptyWobble { 0%,100%{transform:rotate(0deg)} 25%{transform:rotate(-5deg)} 75%{transform:rotate(5deg)} }
        `}</style>
        {/* Shadow */}
        <ellipse cx="40" cy="84" rx="20" ry="4" fill="#D97B0F" opacity=".12" />
        {/* Body */}
        <ellipse cx="40" cy="62" rx="22" ry="19" fill="#F5CA80" />
        <ellipse cx="40" cy="62" rx="22" ry="19" fill="none" stroke="#EDAB30" strokeWidth="1" opacity=".5" />
        {/* Wings */}
        <ellipse cx="22" cy="64" rx="8" ry="6" fill="#EDAB30" transform="rotate(-18,22,64)" />
        <ellipse cx="58" cy="64" rx="8" ry="6" fill="#EDAB30" transform="rotate(18,58,64)" />
        {/* Feet */}
        <g stroke="#E07B10" strokeWidth="1.6" strokeLinecap="round">
          <line x1="32" y1="79" x2="27" y2="86" /><line x1="27" y1="86" x2="21" y2="88" />
          <line x1="27" y1="86" x2="27" y2="91" /><line x1="27" y1="86" x2="33" y2="89" />
          <line x1="48" y1="79" x2="53" y2="86" /><line x1="53" y1="86" x2="47" y2="88" />
          <line x1="53" y1="86" x2="53" y2="91" /><line x1="53" y1="86" x2="59" y2="89" />
        </g>
        {/* Head */}
        <g style={{ animation: "emptyWobble 4s ease-in-out infinite", transformOrigin: "40px 36px" }}>
          <ellipse cx="40" cy="36" rx="17" ry="16" fill="#F5CA80" />
          <ellipse cx="40" cy="36" rx="17" ry="16" fill="none" stroke="#EDAB30" strokeWidth="1" opacity=".5" />
          {/* Tuft */}
          <ellipse cx="35" cy="22" rx="3.5" ry="5.5" fill="#EDAB30" transform="rotate(-15,35,22)" />
          <ellipse cx="40" cy="20" rx="3.5" ry="6" fill="#F5CA80" />
          <ellipse cx="45" cy="22" rx="3.5" ry="5.5" fill="#EDAB30" transform="rotate(15,45,22)" />
          {/* Eyes */}
          <ellipse style={{ animation: "emptyBlink 3.5s ease-in-out infinite" }} cx="34" cy="35" rx="3" ry="3.5" fill="#2A1A04" />
          <ellipse style={{ animation: "emptyBlink 3.5s ease-in-out 0.2s infinite" }} cx="46" cy="35" rx="3" ry="3.5" fill="#2A1A04" />
          <circle cx="35" cy="33.5" r="1" fill="white" opacity=".7" />
          <circle cx="47" cy="33.5" r="1" fill="white" opacity=".7" />
          {/* Beak */}
          <polygon points="37.5,40 42.5,40 40,44.5" fill="#E07B10" />
        </g>
      </svg>
      <p style={{ fontSize: 12, fontWeight: 600, color: brownMd, margin: 0 }}>{message}</p>
      <p style={{ fontSize: 11, color: textSf, margin: 0, textAlign: "center" }}>
        Data will show up once records are added
      </p>
    </div>
  );
}
