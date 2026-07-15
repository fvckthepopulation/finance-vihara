import { api } from "./api";
import { Isak35Mode, Money, TpDp } from "./laporanKeuangan";

// ============================================================================
// Laporan Konsolidasi Yayasan — GET /api/laporan/konsolidasi?mode&year&month
// Level yayasan (lintas vihara); user dengan vihara tetap mendapat 403.
// Nominal bisa datang sebagai decimal string dari Laravel — koersi dengan num().
// ============================================================================

export type KonsolidasiVihara = {
  id: number;
  code: string;
  name: string;
  kota: string | null;
};

export type KonsolidasiBeban = {
  program: Money;
  admin: Money;
  fundraising: Money;
  total: Money;
};

export type KonsolidasiPosisi = {
  kas_setara: Money;
  pg_clearing: Money;
  total_aset: Money;
  liabilitas: Money;
  aset_neto: TpDp;
  balance_ok: boolean;
  selisih: Money;
};

export type KonsolidasiEntry = {
  pendapatan: TpDp;
  beban: KonsolidasiBeban;
  kenaikan: TpDp;
  posisi: KonsolidasiPosisi;
  arus_kas_bersih: Money;
};

export type KonsolidasiPerVihara = KonsolidasiEntry & {
  vihara: KonsolidasiVihara;
};

export type KonsolidasiPeriod = {
  mode: Isak35Mode;
  year: number;
  month: number | null;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
};

export type KonsolidasiResponse = {
  period: KonsolidasiPeriod;
  yayasan: { nama: string; singkatan: string };
  per_vihara: KonsolidasiPerVihara[];
  konsolidasi: KonsolidasiEntry;
};

export function getKonsolidasi(params: {
  mode: Isak35Mode;
  year: number;
  month?: number;
}): Promise<KonsolidasiResponse> {
  const sp = new URLSearchParams({ mode: params.mode, year: String(params.year) });
  if (params.mode === "bulan" && params.month) sp.set("month", String(params.month));
  return api<KonsolidasiResponse>(`/api/laporan/konsolidasi?${sp}`);
}

// Warna identitas vihara — peta kode ala mockup; fallback palet by index
// (hijau, biru, coklat, ungu).
const VIHARA_COLOR_BY_CODE: Record<string, string> = {
  VVG: "#1A6B4A",
  VBM: "#1A4A7A",
  VAD: "#7B3F00",
};
const FALLBACK_PALETTE = ["#1A6B4A", "#1A4A7A", "#7B3F00", "#5B3E8C"];

export function viharaColor(code: string, index: number): string {
  return VIHARA_COLOR_BY_CODE[code] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}
