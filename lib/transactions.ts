import { api, API_URL, getToken, Paginated } from "./api";

// Riwayat gabungan semua transaksi (penerimaan + pengeluaran) — /api/transactions.

export type TransactionTipe = "Penerimaan" | "Pengeluaran";
export type TransactionSource = "km" | "manual";
export type TransactionStatus = "draft" | "posted";

export type TransactionRow = {
  id: number;
  tipe: TransactionTipe;
  code: string;
  date: string;
  /** Nama transaksi — bisa null (mis. penerimaan manual tanpa nama). */
  name: string | null;
  category: string;
  category_label: string;
  amount: number | string;
  method: string;
  source: TransactionSource;
  status: TransactionStatus;
  counterparty: string | null;
  description: string | null;
  vihara_id: number | null;
  /**
   * Referensi eksternal — untuk `source: "km"` berisi ref donasi KalyanaMitta
   * (dipakai link drill-down "KM ↗"). Opsional: backend pra-Phase 7 belum
   * mengirim field ini; link tidak dirender bila absen.
   */
  reference?: string | null;
};

// Nominal bisa datang sebagai string desimal ("6925000.00") dari Laravel.
export type TransactionTotals = {
  masuk: number | string;
  keluar: number | string;
  count: number;
};

export type TransactionsResponse = Paginated<TransactionRow> & {
  totals: TransactionTotals;
};

export type ListTransactionsParams = {
  search?: string;
  tipe?: TransactionTipe | "";
  category?: string;
  from?: string;
  to?: string;
  sumber?: TransactionSource | "";
  status?: TransactionStatus | "";
  vihara_id?: number | null;
  page?: number;
  per_page?: number;
};

function buildQuery(params: ListTransactionsParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.tipe) sp.set("tipe", params.tipe);
  if (params.category) sp.set("category", params.category);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.sumber) sp.set("sumber", params.sumber);
  if (params.status) sp.set("status", params.status);
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  if (params.page) sp.set("page", String(params.page));
  if (params.per_page) sp.set("per_page", String(params.per_page));
  return sp;
}

export function listTransactions(
  params: ListTransactionsParams = {},
): Promise<TransactionsResponse> {
  const sp = buildQuery(params);
  return api<TransactionsResponse>(
    `/api/transactions${sp.toString() ? `?${sp}` : ""}`,
  );
}

/** Unduh CSV riwayat transaksi dengan filter yang sama seperti daftar. */
export async function exportTransactionsCsv(
  params: ListTransactionsParams = {},
): Promise<Blob> {
  const sp = buildQuery(params);
  const headers = new Headers({ Accept: "text/csv" });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(
    `${API_URL}/api/transactions/export${sp.toString() ? `?${sp}` : ""}`,
    { headers },
  );
  if (!res.ok) throw new Error(`Gagal export CSV (HTTP ${res.status})`);
  return res.blob();
}
