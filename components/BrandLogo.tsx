"use client";

import { useEffect, useState } from "react";

/**
 * Logo brand Vihara Finance. Default: karakter dharmachakra (☸) dalam kotak
 * aksen. Kalau aset logo sudah ada, drop file-nya di
 * `vihara-finance-web/public/brand/vihara-finance-logo.png` lalu pass
 * `src="/brand/vihara-finance-logo.png"` dari pemanggil — komponen akan
 * pre-load dan swap ke <img> hanya bila file terbukti bisa dimuat (probe
 * tanpa src eksplisit sengaja dihindari supaya tidak 404 di tiap halaman).
 */
export function BrandLogo({
  size = 32,
  src,
  rounded = "rounded-md",
  className = "",
}: {
  size?: number;
  src?: string;
  rounded?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.src = src;
  }, [src]);

  if (!src || !loaded) {
    return (
      <div
        className={`flex items-center justify-center ${rounded} bg-km-accent text-km-accent-soft font-semibold ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
        aria-label="Vihara Finance"
      >
        ☸
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Vihara Finance"
      width={size}
      height={size}
      className={`${rounded} object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
