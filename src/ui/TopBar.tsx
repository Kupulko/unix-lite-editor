import React from "react";

type Props = {
  mode: "Design" | "Prototype";
  onMode: (m: "Design" | "Prototype") => void;
  zoomPct: number;
  onZoomPct: (pct: number) => void;
  onExport: () => void;
};

export default function TopBar({ mode, onMode, zoomPct, onZoomPct, onExport }: Props) {
  return (
    <div className="topbar">
      <div className="title">          <img src="/images/logoT.png" alt="Text" style={{ width: 40, height: "auto" }} />
</div>


      <div className="spacer" />

      <div className="rightGroup">
        <select
          value={zoomPct}
          onChange={(e) => onZoomPct(Number(e.target.value))}
          style={{ width: 92, height: 34 }}
        >
          {[25, 50, 75, 100, 125, 150, 200, 300].map((v) => (
            <option key={v} value={v}>
              {v}%
            </option>
          ))}
        </select>

        <button className="exportbutt" onClick={onExport}>
          Export
        </button>
      </div>
    </div>
  );
}