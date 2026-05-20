import React from "react";

type BrandLogoProps = {
  compact?: boolean;
  showName?: boolean;
};

export default function BrandLogo({
  compact = false,
  showName = true,
}: BrandLogoProps) {
  return (
    <div className={`brandLogo ${compact ? "compact" : ""}`}>
      <img
        src="/images/logoT.png"
        alt="ORIX logo"
        className="brandLogoImage"
      />

      {showName && <span className="brandLogoText">ORIX</span>}
    </div>
  );
}