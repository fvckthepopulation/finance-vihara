import { api } from "./api";

// ============================================================================
// Master transaksi dua tingkat: Kategori (induk) + Nama (anak), dengan akun
// COA di tingkat nama.
//
// Bentuknya sama untuk pengeluaran (FV-29) dan penerimaan (FV-45), jadi yang
// di sini generik dan dibedakan hanya oleh `jenis`. Dulu hanya ada versi
// pengeluaran; menyalinnya untuk penerimaan berarti dua salinan aturan yang
// pasti menyimpang begitu salah satunya diperbaiki.
//
// Satu perbedaan yang penting dan sengaja:
//   - pengeluaran: akun COA nama WAJIB — itulah akun debit jurnalnya.
//   - penerimaan: akun COA nama OPSIONAL. Kosong berarti "ikuti aturan kanal"
//     (41x0 KalyanaMitta / 42x0 transfer / 43x0 tunai × pembatasan ISAK 35),
//     yaitu perilaku yang sudah berjalan. Mengisinya berarti memakukan akun
//     dan melepas pembedaan kanal — keputusan yang harus disengaja.
// ============================================================================

export type JenisMaster = "pengeluaran" | "penerimaan";

const BASIS: Record<JenisMaster, string> = {
  pengeluaran: "/api/master-pengeluaran",
  penerimaan: "/api/master-penerimaan",
};

/** Ruas akun di URL lookup berbeda sebutannya per jenis. */
const RUAS_AKUN: Record<JenisMaster, string> = {
  pengeluaran: "akun-beban",
  penerimaan: "akun-pendapatan",
};

export type Halaman<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

/** Jenis pembatasan ISAK 35 untuk Kategori Dana (FV-49). */
export type JenisPembatasan = "tp" | "dp" | "suspense";

export const LABEL_PEMBATASAN: Record<JenisPembatasan, string> = {
  tp: "Tanpa Pembatasan",
  dp: "Dengan Pembatasan",
  suspense: "Belum Teridentifikasi",
};

/** Akun pendapatan per kanal penerimaan; null untuk kategori pengeluaran. */
export type AkunPerMetode = {
  auto_credit: string | null;
  transfer: string | null;
  tunai: string | null;
} | null;

/**
 * "KM 4120 · Transfer 4220 · Tunai 4320" — dipakai layar master supaya admin
 * bisa MELIHAT akun yang akan dipakai, bukan "—" (FV-49 poin 2).
 * Kalau ketiganya sama (kategori suspense), cukup ditulis sekali.
 */
export function ringkasAkunPerMetode(akun: AkunPerMetode): string {
  if (!akun) return "—";
  const { auto_credit: km, transfer, tunai } = akun;
  if (!km && !transfer && !tunai) return "—";
  if (km === transfer && transfer === tunai) return km ?? "—";
  return `KM ${km ?? "—"} · Transfer ${transfer ?? "—"} · Tunai ${tunai ?? "—"}`;
}

export type KategoriTransaksi = {
  id: number;
  code: string;
  name: string;
  /** Hanya kategori dana; null untuk pengeluaran. */
  restriction: JenisPembatasan | null;
  restriction_label: string | null;
  akun_per_metode: AkunPerMetode;
  description: string | null;
  /**
   * Akun bawaan kategori. Namanya warisan master pengeluaran; bacalah sebagai
   * "akun bawaan", sisi mana pun yang berlaku untuk jenisnya — debit untuk
   * pengeluaran, kredit untuk penerimaan.
   */
  default_debit_code: string | null;
  active: boolean;
  jumlah_nama: number;
  jumlah_nama_aktif: number;
  in_use: boolean;
};

export type NamaTransaksi = {
  id: number;
  code: string | null;
  category: string;
  category_label: string;
  name: string;
  coa_account_code: string | null;
  coa_account_name: string | null;
  /** Diwarisi dari kategorinya (penerimaan); null untuk pengeluaran. */
  akun_per_metode?: AkunPerMetode;
  description: string | null;
  vihara_id: number | null;
  vihara_name: string | null;
  active: boolean;
  in_use: boolean;
};

export type AkunMaster = { code: string; name: string; type: string };

const qs = (params: Record<string, string | number | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString() ? `?${sp}` : "";
};

export type FilterDaftar = {
  q?: string;
  active?: "" | "1" | "0";
  page?: number;
  per_page?: number;
};

export const listKategori = (jenis: JenisMaster, p: FilterDaftar = {}) =>
  api<Halaman<KategoriTransaksi>>(`${BASIS[jenis]}/kategori${qs(p)}`);

export type KategoriInput = {
  code: string;
  name: string;
  /** Wajib untuk Kategori Dana (FV-49). */
  restriction?: JenisPembatasan | null;
  description?: string | null;
  default_debit_code?: string | null;
};

export const createKategori = (jenis: JenisMaster, payload: KategoriInput) =>
  api<KategoriTransaksi>(`${BASIS[jenis]}/kategori`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateKategori = (
  jenis: JenisMaster,
  id: number,
  payload: Partial<{
    name: string;
    restriction: JenisPembatasan | null;
    description: string | null;
    default_debit_code: string | null;
    active: boolean;
    /** Ikut menonaktifkan seluruh Nama di bawahnya. */
    nonaktifkan_anak: boolean;
  }>,
) =>
  api<KategoriTransaksi>(`${BASIS[jenis]}/kategori/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteKategori = (jenis: JenisMaster, id: number) =>
  api<{ message?: string }>(`${BASIS[jenis]}/kategori/${id}`, { method: "DELETE" });

export const listNama = (
  jenis: JenisMaster,
  p: FilterDaftar & { category?: string } = {},
) => api<Halaman<NamaTransaksi>>(`${BASIS[jenis]}/nama${qs(p)}`);

export type NamaInput = {
  category: string;
  name: string;
  /** Wajib untuk pengeluaran; boleh null untuk penerimaan. */
  coa_account_code: string | null;
  description?: string | null;
  vihara_id?: number | null;
};

export const createNama = (jenis: JenisMaster, payload: NamaInput) =>
  api<NamaTransaksi>(`${BASIS[jenis]}/nama`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateNama = (
  jenis: JenisMaster,
  id: number,
  payload: Partial<NamaInput & { active: boolean }>,
) =>
  api<NamaTransaksi>(`${BASIS[jenis]}/nama/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteNama = (jenis: JenisMaster, id: number) =>
  api<{ message?: string }>(`${BASIS[jenis]}/nama/${id}`, { method: "DELETE" });

export const listAkunMaster = (jenis: JenisMaster, category?: string) =>
  api<{ data: AkunMaster[] }>(
    `${BASIS[jenis]}/${RUAS_AKUN[jenis]}${qs({ category })}`,
  ).then((r) => r.data);
