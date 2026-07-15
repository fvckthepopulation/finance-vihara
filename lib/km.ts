// ============================================================================
// Drill-down ke KalyanaMitta Finance (aplikasi web KM).
// Env NEXT_PUBLIC_KM_WEB_URL (mis. http://localhost:3400) — bila tidak diset,
// helper mengembalikan null dan link "KM ↗" tidak dirender sama sekali.
// ============================================================================

/**
 * URL halaman escrow KM Finance yang sudah terfilter ke referensi donasi/
 * settlement tertentu. `null` bila env tidak diset atau ref kosong.
 */
export function kmDrilldownUrl(ref: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_KM_WEB_URL;
  if (!base || !ref) return null;
  return `${base.replace(/\/+$/, "")}/escrow?search=${encodeURIComponent(ref)}`;
}
