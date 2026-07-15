import { api } from "./api";

// ============================================================================
// Laporan Keuangan ISAK 35 (Entitas Berorientasi Nonlaba)
// GET /api/laporan/isak35?mode=ytd|bulan&year&month&vihara_id
//
// Nominal uang bisa datang sebagai decimal string dari Laravel — koersi dengan
// num() (lib/kasBank.ts) di sisi render.
// ============================================================================

export type Isak35Mode = "ytd" | "bulan";

/** Nominal dari API — bisa number atau decimal string ("6925000.00"). */
export type Money = string | number;

/** Trio kolom ISAK 35: Tanpa Pembatasan / Dengan Pembatasan / Total. */
export type TpDp = { tp: Money; dp: Money; total: Money };

export type Isak35Period = {
  mode: Isak35Mode;
  year: number;
  month: number | null;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
};

export type KasSetaraRow = { code: string; name: string; balance: Money };

export type Isak35Posisi = {
  as_of: string;
  kas_setara: { rows: KasSetaraRow[]; total: Money };
  /** 1160 · Payment Gateway Clearing (KM belum settle). */
  pg_clearing: Money;
  total_aset: Money;
  liabilitas: { rows: KasSetaraRow[]; total: Money };
  aset_neto: TpDp;
  balance_ok: boolean;
  selisih: Money;
};

export type PendapatanRow = {
  code: string;
  label: string;
  /** null = tidak berlaku pada kolom itu (tampil "—"). */
  tp: Money | null;
  dp: Money | null;
  total: Money;
};

export type BebanRow = { group: string; label: string; total: Money };

export type Isak35Penghasilan = {
  pendapatan: { rows: PendapatanRow[]; tp: Money; dp: Money; total: Money };
  beban: { rows: BebanRow[]; total: Money };
  kenaikan: TpDp;
};

export type Isak35Perubahan = {
  awal: TpDp;
  pendapatan: TpDp;
  beban: TpDp;
  kenaikan: TpDp;
  akhir: TpDp;
};

export type ArusKasRow = { key: string; label: string; amount: Money };
export type ArusKasSection = { rows: ArusKasRow[]; total: Money };

export type Isak35ArusKas = {
  operasi: ArusKasSection;
  investasi: ArusKasSection;
  pendanaan: ArusKasSection;
  kas_awal: Money;
  kas_akhir: Money;
  check_kas_akhir_ok: boolean;
};

export type Isak35Response = {
  period: Isak35Period;
  posisi: Isak35Posisi;
  penghasilan: Isak35Penghasilan;
  perubahan: Isak35Perubahan;
  arus_kas: Isak35ArusKas;
};

export function getIsak35(params: {
  mode: Isak35Mode;
  year: number;
  month?: number;
  vihara_id?: number | null;
}): Promise<Isak35Response> {
  const sp = new URLSearchParams({ mode: params.mode, year: String(params.year) });
  if (params.mode === "bulan" && params.month) sp.set("month", String(params.month));
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  return api<Isak35Response>(`/api/laporan/isak35?${sp}`);
}

export const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Label periode ala mockup: "YTD 2025" / "November 2025". */
export function isak35PeriodLabel(mode: Isak35Mode, year: number, month: number): string {
  if (mode === "ytd") return `YTD ${year}`;
  return `${MONTHS_ID[month - 1] ?? month} ${year}`;
}
