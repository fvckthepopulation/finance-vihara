import { api, API_URL, getToken } from "./api";

// ============================================================================
// Kas Kecil per PIC — kontrak baru (Phase Kas & Bank).
// ============================================================================

// ---------- Master PIC kas kecil ----------

export type PettyCashPic = {
  id: number;
  vihara_id: number;
  name: string;
  active: boolean;
};

export const listPettyCashPics = (viharaId?: number | null) => {
  const sp = new URLSearchParams();
  if (viharaId != null) sp.set("vihara_id", String(viharaId));
  return api<{ data: PettyCashPic[] }>(
    `/api/masters/petty-cash-pics${sp.toString() ? `?${sp}` : ""}`,
  ).then((r) => r.data);
};

export const createPettyCashPic = (viharaId: number, name: string) =>
  api<PettyCashPic>(`/api/viharas/${viharaId}/petty-cash-pics`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const updatePettyCashPic = (id: number, payload: { name?: string; active?: boolean }) =>
  api<PettyCashPic>(`/api/petty-cash-pics/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

/** DELETE — 422 bila PIC sudah dipakai transaksi (fallback: nonaktifkan). */
export const deletePettyCashPic = (id: number) =>
  api<{ message?: string }>(`/api/petty-cash-pics/${id}`, { method: "DELETE" });

// ---------- Transaksi kas kecil ----------

export type PettyCashSubtype = "topup" | "usage";

/** Shape longgar — API aktual memakai movement_date + relasi pic/source_bank_account. */
export type PettyCashEntry = {
  id: number;
  date?: string;
  movement_date?: string;
  pic?: { id: number; name: string } | null;
  pic_id?: number | null;
  pic_name?: string | null;
  subtype: PettyCashSubtype | string;
  amount: string | number;
  source_bank_label?: string | null;
  source_bank_account?: { id: number; bank_name: string; account_number: string } | null;
  reference?: string | null;
  /** Keterangan keperluan teks bebas — hanya mutasi lama sebelum FV-82. */
  description?: string | null;
  /** Nama Pengeluaran dari master (usage, FV-82). */
  name?: string | null;
  /** Catatan tambahan (FV-85), terpisah dari nama/keperluan. */
  notes?: string | null;
  /** Kode Kategori Biaya master (usage) — menentukan akun bebannya (FV-58, FV-82). */
  category?: string | null;
  category_label?: string | null;
  attachment_path?: string | null;
  created_by_user_id?: number | null;
  created_by?: { id: number; name: string } | null;
  created_at?: string | null;
  posted_at?: string | null;
  voided_at?: string | null;
  voided_by?: { id: number; name: string } | null;
  vihara?: { id: number; code: string; name: string } | null;
  entity?: { id: number; code: string; legal_name?: string } | null;
  counterpart_account?: { code: string; name: string } | null;
  cash_account?: { code: string; name: string } | null;
  journal_entry_id?: number | null;
  journal_entry?: {
    id: number;
    description: string | null;
    posted_at: string | null;
    posted_by?: { id: number; name: string } | null;
  } | null;
  /** Akun beban/lawan yang benar-benar dipakai jurnalnya. */
  counterpart_account_code?: string | null;
  /** draft | posted | cancelled. cancelled = dibatalkan lewat jurnal pembalik. */
  status?: string;
  void_reason?: string | null;
};

/** Keterangan baris riwayat: Nama Pengeluaran, atau keperluan mutasi lama. */
export const pettyCashKeterangan = (e: PettyCashEntry): string | null =>
  e.name || e.description || null;

export const pettyCashDate = (e: PettyCashEntry): string =>
  (e.date ?? e.movement_date ?? "").slice(0, 10);

export const pettyCashPicName = (e: PettyCashEntry): string =>
  e.pic?.name ?? e.pic_name ?? "—";

export const pettyCashPicId = (e: PettyCashEntry): number | null =>
  e.pic?.id ?? e.pic_id ?? null;

/** Label sumber pengisian, mis. "BCA 6280-3488-88" (null = Dana Tunai). */
export const pettyCashSourceLabel = (e: PettyCashEntry): string | null =>
  e.source_bank_label ??
  (e.source_bank_account
    ? `${e.source_bank_account.bank_name.replace(/^bank\s+/i, "")} ${e.source_bank_account.account_number}`
    : null);

export type PettyCashPage = {
  data: PettyCashEntry[];
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
  /** Total periode tersaring, hanya mutasi terposting (FV-86). */
  totals?: { masuk: string; keluar: string; selisih: string };
};

/** Versi berhalaman — dipakai tabel mutasi di layar Kas Kecil. */
export const listPettyCashPaginated = async (
  params: {
    vihara_id?: number | null;
    pic_id?: number;
    subtype?: PettyCashSubtype;
    q?: string;
    /** draft | posted | cancelled. */
    status?: string;
    /** Rentang tanggal mutasi, inklusif (FV-86). */
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  } = {},
): Promise<PettyCashPage> => {
  const sp = new URLSearchParams();
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  if (params.pic_id != null) sp.set("pic_id", String(params.pic_id));
  if (params.subtype) sp.set("subtype", params.subtype);
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.page) sp.set("page", String(params.page));
  if (params.per_page) sp.set("per_page", String(params.per_page));
  const res = await api<PettyCashPage>(`/api/petty-cash${sp.toString() ? `?${sp}` : ""}`);
  return res;
};

export const listPettyCash = async (
  params: { vihara_id?: number | null; pic_id?: number; subtype?: PettyCashSubtype } = {},
): Promise<PettyCashEntry[]> => {
  const sp = new URLSearchParams();
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  if (params.pic_id != null) sp.set("pic_id", String(params.pic_id));
  if (params.subtype) sp.set("subtype", params.subtype);
  const res = await api<unknown>(`/api/petty-cash${sp.toString() ? `?${sp}` : ""}`);
  // Adaptif: bisa array langsung atau paginated { data: [...] }.
  if (Array.isArray(res)) return res as PettyCashEntry[];
  if (res && typeof res === "object" && Array.isArray((res as { data?: unknown }).data)) {
    return (res as { data: PettyCashEntry[] }).data;
  }
  return [];
};

/** Kategori Biaya untuk penggunaan kas kecil — master yang sama dengan Input Pengeluaran (FV-82). */
export type PettyCashCategory = { key: string; label: string; default_counterpart: string | null };

export const listPettyCashCategories = () => api<PettyCashCategory[]>(`/api/petty-cash/categories`);

export type CreatePettyCashInput = {
  date: string;
  /** Wajib utk superadmin; user vihara tetap: server memaksa. */
  vihara_id?: number;
  pic_id: number;
  subtype: PettyCashSubtype;
  amount: number;
  /** Hanya topup; absen = ambil dari Dana Tunai. */
  source_bank_account_id?: number;
  /** Kategori Biaya master — WAJIB untuk usage, dilarang untuk topup (FV-58, FV-82). */
  category?: string;
  /** Nama Pengeluaran master — WAJIB untuk usage (FV-82). */
  name?: string;
  /** Usage: no. bukti / kuitansi. Topup: keterangan transfer. */
  reference?: string;
  /** Catatan tambahan, maks. 500 karakter (FV-85). */
  notes?: string;
};

export const createPettyCash = (input: CreatePettyCashInput) =>
  api<PettyCashEntry>(`/api/petty-cash`, { method: "POST", body: JSON.stringify(input) });

export const postPettyCash = (id: number | string) =>
  api<PettyCashEntry>(`/api/petty-cash/${id}/post`, { method: "POST" });

/** Ubah draft (FV-81). Tipe & vihara tetap; server memeriksa sama seperti saat membuat. */
export const updatePettyCash = (id: number, input: Omit<CreatePettyCashInput, "vihara_id">) =>
  api<PettyCashEntry>(`/api/petty-cash/${id}`, { method: "PUT", body: JSON.stringify(input) });

export const getPettyCash = (id: number) => api<PettyCashEntry>(`/api/petty-cash/${id}`);

/** Hapus draft (FV-81) — mutasi terposting hanya bisa dibatalkan. */
export const deletePettyCash = (id: number) =>
  api<{ message?: string }>(`/api/petty-cash/${id}`, { method: "DELETE" });

export const LAMPIRAN_MAKS_BYTE = 10 * 1024 * 1024;
const LAMPIRAN_TIPE = /\.(pdf|jpe?g|png)$/i;

/** Pemeriksaan lampiran di peramban, sama dengan aturan server (FV-83). */
export function cekLampiran(file: File | null): string | null {
  if (!file) return null;
  if (!LAMPIRAN_TIPE.test(file.name)) return "Lampiran harus berupa PDF, JPG, JPEG, atau PNG.";
  if (file.size > LAMPIRAN_MAKS_BYTE) return "Lampiran maksimal 10 MB.";
  return null;
}

/** Unggah lampiran bukti — hanya selama draft (FV-83). */
export async function uploadPettyCashAttachment(id: number, file: File): Promise<PettyCashEntry> {
  const body = new FormData();
  body.append("file", file);
  const headers = new Headers({ Accept: "application/json" });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Tidak lewat api(): boundary multipart diisi browser.
  const res = await fetch(`${API_URL}/api/petty-cash/${id}/attachment`, { method: "POST", headers, body });
  if (!res.ok) {
    let pesan = `Gagal mengunggah lampiran (HTTP ${res.status})`;
    try {
      const payload = (await res.json()) as { message?: string };
      if (payload.message) pesan = payload.message;
    } catch {
      /* pesan bawaan */
    }
    throw new Error(pesan);
  }
  return (await res.json()) as PettyCashEntry;
}

/** Ambil lampiran sebagai Blob — perlu token, jadi tidak bisa <a href> polos. */
export async function fetchPettyCashAttachment(id: number): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}/api/petty-cash/${id}/attachment`, { headers });
  if (!res.ok) throw new Error(`Gagal membuka lampiran (HTTP ${res.status})`);
  return res.blob();
}

// ---------- Ringkasan per PIC ----------

export type PettyCashPicSummary = {
  id: number;
  name: string;
  saldo_awal: string | number;
  saldo: string | number;
  total_isi: string | number;
  total_pakai: string | number;
  count: number;
};

export type PettyCashSummary = {
  pics: PettyCashPicSummary[];
  total: string | number;
};

export const getPettyCashSummary = (viharaId?: number | null) => {
  const sp = new URLSearchParams();
  if (viharaId != null) sp.set("vihara_id", String(viharaId));
  return api<PettyCashSummary>(`/api/petty-cash/summary${sp.toString() ? `?${sp}` : ""}`);
};

/** Batalkan mutasi kas kecil terposting — server menulis jurnal pembalik. */
export const voidPettyCashMovement = (id: number, reason: string) =>
  api<unknown>(`/api/petty-cash/${id}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
