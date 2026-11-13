import { api } from "./api";

// ============================================================================
// Master Pengeluaran (FV-29) — Kategori Biaya (induk) + Nama Pengeluaran.
//
// `code` kategori adalah kunci yang disimpan kolom pembayaran.category, jadi
// tidak bisa diubah setelah dibuat: mengubahnya akan memutus transaksi lama.
// Akun COA di tingkat Nama Pengeluaran-lah yang dipakai jurnal sebagai akun
// debit; akun kategori hanya cadangan.
// ============================================================================

export type Halaman<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

export type KategoriBiaya = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  default_debit_code: string | null;
  active: boolean;
  jumlah_nama: number;
  jumlah_nama_aktif: number;
  in_use: boolean;
};

export type NamaPengeluaran = {
  id: number;
  code: string | null;
  category: string;
  category_label: string;
  name: string;
  coa_account_code: string | null;
  coa_account_name: string | null;
  description: string | null;
  vihara_id: number | null;
  vihara_name: string | null;
  active: boolean;
  in_use: boolean;
};

export type AkunBeban = { code: string; name: string; type: string };

const qs = (params: Record<string, string | number | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString() ? `?${sp}` : "";
};

export const listKategoriBiaya = (p: {
  q?: string;
  active?: "" | "1" | "0";
  page?: number;
  per_page?: number;
} = {}) => api<Halaman<KategoriBiaya>>(`/api/master-pengeluaran/kategori${qs(p)}`);

export const createKategoriBiaya = (payload: {
  code: string;
  name: string;
  description?: string | null;
  default_debit_code?: string | null;
}) =>
  api<KategoriBiaya>(`/api/master-pengeluaran/kategori`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateKategoriBiaya = (
  id: number,
  payload: Partial<{
    name: string;
    description: string | null;
    default_debit_code: string | null;
    active: boolean;
    /** Ikut menonaktifkan seluruh Nama Pengeluaran di bawahnya. */
    nonaktifkan_anak: boolean;
  }>,
) =>
  api<KategoriBiaya>(`/api/master-pengeluaran/kategori/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteKategoriBiaya = (id: number) =>
  api<{ message?: string }>(`/api/master-pengeluaran/kategori/${id}`, { method: "DELETE" });

export const listNamaPengeluaran = (p: {
  q?: string;
  category?: string;
  active?: "" | "1" | "0";
  page?: number;
  per_page?: number;
} = {}) => api<Halaman<NamaPengeluaran>>(`/api/master-pengeluaran/nama${qs(p)}`);

export type NamaPengeluaranInput = {
  category: string;
  name: string;
  coa_account_code: string;
  description?: string | null;
  vihara_id?: number | null;
};

export const createNamaPengeluaran = (payload: NamaPengeluaranInput) =>
  api<NamaPengeluaran>(`/api/master-pengeluaran/nama`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateNamaPengeluaran = (
  id: number,
  payload: Partial<NamaPengeluaranInput & { active: boolean }>,
) =>
  api<NamaPengeluaran>(`/api/master-pengeluaran/nama/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteNamaPengeluaran = (id: number) =>
  api<{ message?: string }>(`/api/master-pengeluaran/nama/${id}`, { method: "DELETE" });

export const listAkunBeban = (category?: string) =>
  api<{ data: AkunBeban[] }>(`/api/master-pengeluaran/akun-beban${qs({ category })}`).then(
    (r) => r.data,
  );
