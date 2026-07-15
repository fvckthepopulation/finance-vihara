import { api } from "./api";

// ============================================================================
// Anggaran tahunan per vihara — target penerimaan per kategori dana, anggaran
// pengeluaran per kategori biaya + detail per jenis (nama) pengeluaran.
// GET /api/anggaran?year&vihara_id (vihara_id WAJIB)
// PUT /api/anggaran {year, vihara_id, items:[...]} (amount 0 = hapus)
// ============================================================================

export type Money = string | number;

export type AnggaranKategoriRow = {
  category: string;
  label: string;
  target: Money;
  realisasi: Money;
  /** Persen realisasi vs target — null bila target belum diisi. */
  pct: number | null;
};

export type AnggaranDetailRow = {
  category: string;
  name: string;
  target: Money;
  realisasi: Money;
};

export type AnggaranResponse = {
  year: number;
  vihara_id: number;
  penerimaan: AnggaranKategoriRow[];
  pengeluaran: AnggaranKategoriRow[];
  detail: AnggaranDetailRow[];
};

export function getAnggaran(params: { year: number; vihara_id: number }): Promise<AnggaranResponse> {
  const sp = new URLSearchParams({
    year: String(params.year),
    vihara_id: String(params.vihara_id),
  });
  return api<AnggaranResponse>(`/api/anggaran?${sp}`);
}

export type AnggaranItemInput = {
  type: "penerimaan" | "pengeluaran";
  category: string;
  /** Diisi hanya untuk anggaran detail per jenis pengeluaran. */
  name?: string;
  /** 0 = hapus baris anggaran. */
  amount: number;
};

export function saveAnggaran(payload: {
  year: number;
  vihara_id: number;
  items: AnggaranItemInput[];
}): Promise<{ message?: string }> {
  return api<{ message?: string }>(`/api/anggaran`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
