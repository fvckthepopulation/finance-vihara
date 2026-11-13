import { api } from "./api";

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
  description?: string | null;
  /** draft | posted | cancelled. cancelled = dibatalkan lewat jurnal pembalik. */
  status?: string;
  voided_at?: string | null;
  void_reason?: string | null;
};

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
};

/** Versi berhalaman — dipakai tabel mutasi di layar Kas Kecil. */
export const listPettyCashPaginated = async (
  params: {
    vihara_id?: number | null;
    pic_id?: number;
    subtype?: PettyCashSubtype;
    q?: string;
    page?: number;
    per_page?: number;
  } = {},
): Promise<PettyCashPage> => {
  const sp = new URLSearchParams();
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  if (params.pic_id != null) sp.set("pic_id", String(params.pic_id));
  if (params.subtype) sp.set("subtype", params.subtype);
  if (params.q) sp.set("q", params.q);
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

export type CreatePettyCashInput = {
  date: string;
  /** Wajib utk superadmin; user vihara tetap: server memaksa. */
  vihara_id?: number;
  pic_id: number;
  subtype: PettyCashSubtype;
  amount: number;
  /** Hanya topup; absen = ambil dari Dana Tunai. */
  source_bank_account_id?: number;
  /** Usage: no. bukti / kuitansi. Topup: keterangan transfer. */
  reference?: string;
  description?: string;
};

export const createPettyCash = (input: CreatePettyCashInput) =>
  api<PettyCashEntry>(`/api/petty-cash`, { method: "POST", body: JSON.stringify(input) });

export const postPettyCash = (id: number | string) =>
  api<PettyCashEntry>(`/api/petty-cash/${id}/post`, { method: "POST" });

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
