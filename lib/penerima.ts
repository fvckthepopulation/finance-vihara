import { api } from "./api";

// ============================================================================
// Master Penerima (FV-31).
//
// Field "Dibayarkan kepada / PIC" tetap boleh diisi bebas; master ini hanya
// memberi saran dan satu jalan singkat untuk memasukkan nama baru. Datanya
// milik yayasan, karena vendor biasanya lokal.
// ============================================================================

export type JenisPenerima = "vendor" | "perorangan" | "internal";

export const JENIS_PENERIMA: Record<JenisPenerima, string> = {
  vendor: "Vendor",
  perorangan: "Perorangan",
  internal: "Internal",
};

export type SaranPenerima = {
  id: number;
  code: string | null;
  name: string;
  type: JenisPenerima;
  bank_name: string | null;
  bank_account_number: string | null;
};

export type Penerima = SaranPenerima & {
  type_label: string;
  phone: string | null;
  address: string | null;
  bank_account_holder: string | null;
  npwp: string | null;
  entity_id: number | null;
  entity_name: string | null;
  active: boolean;
  in_use: boolean;
};

export type HalamanPenerima = {
  data: Penerima[];
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

const qs = (p: Record<string, string | number | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString() ? `?${sp}` : "";
};

/** Saran untuk form — maksimal 20, hanya penerima aktif. */
export const suggestPenerima = (q: string) =>
  api<{ data: SaranPenerima[] }>(`/api/penerima/suggest${qs({ q })}`).then((r) => r.data);

/**
 * Tambah dari form: cukup nama. Kalau namanya sudah ada (tanpa membedakan
 * huruf besar/kecil), yang kembali adalah baris yang sudah ada, ditandai
 * `sudah_ada` — jadi tidak pernah membuat duplikat.
 */
export const tambahPenerimaCepat = (name: string) =>
  api<SaranPenerima & { sudah_ada?: boolean }>(`/api/penerima/cepat`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const listPenerima = (p: {
  q?: string;
  type?: JenisPenerima | "";
  active?: "" | "1" | "0";
  page?: number;
  per_page?: number;
} = {}) => api<HalamanPenerima>(`/api/penerima${qs(p)}`);

export type PenerimaInput = {
  name: string;
  type: JenisPenerima;
  phone?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
  npwp?: string | null;
  active?: boolean;
};

export const createPenerima = (payload: PenerimaInput) =>
  api<Penerima>(`/api/penerima`, { method: "POST", body: JSON.stringify(payload) });

export const updatePenerima = (id: number, payload: Partial<PenerimaInput>) =>
  api<Penerima>(`/api/penerima/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deletePenerima = (id: number) =>
  api<{ message?: string }>(`/api/penerima/${id}`, { method: "DELETE" });
