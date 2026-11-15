import { api } from "./api";
import { Isak35Mode, Money, TpDp } from "./laporanKeuangan";

// ============================================================================
// Laporan Konsolidasi Yayasan — GET /api/laporan/konsolidasi?mode&year&month
// Level yayasan (lintas vihara); user dengan vihara tetap mendapat 403.
// Nominal bisa datang sebagai decimal string dari Laravel — koersi dengan num().
// ============================================================================

export type KonsolidasiVihara = {
  /** null = baris "Kantor Yayasan" (jurnal tingkat yayasan). */
  id: number | null;
  code: string;
  name: string;
  kota: string | null;
  /** Kode yayasan pemilik baris ini (FV-63). */
  yayasan_code?: string;
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

export type KonsolidasiYayasan = { id: number; code: string; nama: string };

/** Satu kelompok yayasan: vihara + kantor pusatnya, dengan subtotal (FV-63). */
export type KonsolidasiPerYayasan = {
  yayasan: KonsolidasiYayasan;
  per_vihara: KonsolidasiPerVihara[];
  subtotal: KonsolidasiEntry | null;
};

export type KonsolidasiResponse = {
  period: KonsolidasiPeriod;
  /** Nama & kode yayasan yang digabung; beberapa yayasan → "A + B". */
  yayasan: { nama: string; singkatan: string; jumlah?: number };
  /** Yayasan yang dipilih; null = semua yayasan dalam jangkauan akun. */
  entity_id?: number | null;
  /** Pilihan yayasan untuk dropdown — hanya yang boleh diakses akun. */
  yayasan_pilihan?: KonsolidasiYayasan[];
  per_yayasan?: KonsolidasiPerYayasan[];
  /** Semua baris dari semua kelompok, berurutan per yayasan. */
  per_vihara: KonsolidasiPerVihara[];
  /** null bila tidak ada vihara/jurnal sama sekali. */
  konsolidasi: KonsolidasiEntry | null;
};

export function getKonsolidasi(params: {
  mode: Isak35Mode;
  year: number;
  month?: number;
  /** null/undefined = semua yayasan. */
  entityId?: number | null;
}): Promise<KonsolidasiResponse> {
  const sp = new URLSearchParams({ mode: params.mode, year: String(params.year) });
  if (params.mode === "bulan" && params.month) sp.set("month", String(params.month));
  if (params.entityId != null) sp.set("entity_id", String(params.entityId));
  return api<KonsolidasiResponse>(`/api/laporan/konsolidasi?${sp}`);
}

/** Laporan menggabungkan lebih dari satu yayasan? */
export function multiYayasan(data: KonsolidasiResponse): boolean {
  return (data.per_yayasan?.length ?? 0) > 1;
}

/**
 * Baris per vihara untuk ditampilkan. Bila beberapa yayasan digabung, nama
 * diberi kode yayasannya — "Kantor Yayasan" tiap yayasan jadi bisa dibedakan.
 */
export function barisKonsolidasi(data: KonsolidasiResponse): KonsolidasiPerVihara[] {
  if (!multiYayasan(data)) return data.per_vihara;
  return data.per_vihara.map((v) => ({
    ...v,
    vihara: { ...v.vihara, name: `${v.vihara.name} (${v.vihara.yayasan_code ?? "-"})` },
  }));
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
