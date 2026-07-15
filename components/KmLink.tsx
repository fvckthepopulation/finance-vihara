import { kmDrilldownUrl } from "@/lib/km";

/**
 * Anchor kecil "KM ↗" → drill-down ke KalyanaMitta Finance (halaman escrow,
 * terfilter ke referensi terkait). Tidak dirender bila ref kosong atau env
 * NEXT_PUBLIC_KM_WEB_URL tidak diset.
 */
export function KmLink({
  refCode,
  className = "",
}: {
  refCode: string | null | undefined;
  className?: string;
}) {
  const url = kmDrilldownUrl(refCode);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Lihat di KalyanaMitta Finance"
      className={`whitespace-nowrap text-[10px] font-semibold text-km-accent opacity-75 transition hover:opacity-100 ${className}`}
    >
      KM ↗
    </a>
  );
}
