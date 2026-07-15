import { api, Paginated } from "./api";

export type PenerimaanMethod = "transfer" | "tunai" | "auto_credit";

export const METHOD_LABEL: Record<PenerimaanMethod, string> = {
  transfer: "Transfer bank",
  tunai: "Tunai",
  auto_credit: "Auto credit",
};

/** Loose: enum Phase A dipangkas jadi 4 kategori utama; tetap longgar untuk masa depan. */
export type PenerimaanCategory = string;

/** Fallback labels — API endpoint /api/penerimaan/categories is the source of truth. */
export const CATEGORY_LABEL: Record<string, string> = {
  bunga_bank: "Bunga Bank",
  komisi_settlement: "Komisi Settlement",
  pendapatan_lain: "Pendapatan Lain-lain",
  pengembalian_dana: "Pengembalian Dana",
};

export const categoryLabel = (key: string): string =>
  CATEGORY_LABEL[key] ?? humanize(key);

function humanize(key: string): string {
  return key.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

export type PenerimaanStatus = "draft" | "posted" | "cancelled";

export const STATUS_LABEL: Record<PenerimaanStatus, string> = {
  draft: "Draft",
  posted: "Diposting",
  cancelled: "Dibatalkan",
};

export const STATUS_TONE: Record<PenerimaanStatus, "neutral" | "info" | "success" | "danger"> = {
  draft: "neutral",
  posted: "success",
  cancelled: "danger",
};

export type Penerimaan = {
  id: number;
  code: string;
  date: string;
  method: PenerimaanMethod;
  destination_account_code: string;
  category: PenerimaanCategory;
  entity_id: number;
  source_payee_id: number | null;
  source_name: string | null;
  credit_account_code: string;
  reference: string | null;
  amount: string;
  description: string | null;
  attachment_path: string | null;
  status: PenerimaanStatus;
  journal_entry_id: number | null;
  created_by_user_id: number | null;
  posted_by_user_id: number | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
  entity?: { id: number; code: string; legal_name: string };
  source_payee?: { id: number; code: string; name: string } | null;
  destination_account?: { code: string; name: string };
  credit_account?: { code: string; name: string };
};

export type CategoryOption = {
  key: PenerimaanCategory;
  label: string;
  default_credit: string;
};

export async function getPenerimaanCategories(): Promise<CategoryOption[]> {
  return api<CategoryOption[]>(`/api/penerimaan/categories`);
}

export type ListPenerimaanParams = {
  status?: PenerimaanStatus;
  category?: PenerimaanCategory;
  month?: string;
  entity_id?: number;
  page?: number;
};

export async function listPenerimaan(params: ListPenerimaanParams = {}): Promise<Paginated<Penerimaan>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.month) qs.set("month", params.month);
  if (params.entity_id) qs.set("entity_id", String(params.entity_id));
  if (params.page) qs.set("page", String(params.page));
  const suffix = qs.toString() ? `?${qs}` : "";
  return api<Paginated<Penerimaan>>(`/api/penerimaan${suffix}`);
}

export async function getPenerimaan(id: number): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan/${id}`);
}

export type CreatePenerimaanInput = {
  date: string;
  method: PenerimaanMethod;
  /** Rekening tujuan (master vihara-bank-accounts) — server menurunkan akun COA. */
  bank_account_id?: number;
  /** @deprecated Pakai bank_account_id; tersisa untuk kompat lama. */
  destination_account_code?: string;
  category: PenerimaanCategory;
  entity_id?: number;
  source_payee_id?: number | null;
  source_name?: string | null;
  credit_account_code?: string | null;
  reference?: string | null;
  amount: number;
  description?: string | null;
  /** Nama penerimaan — dari master transaction-names (form mockup). */
  name?: string;
  /** Diterima oleh (nama bendahara/admin). */
  received_by?: string | null;
  /** Vihara tujuan — wajib utk superadmin; user vihara tetap: server memaksa. */
  vihara_id?: number;
};

export async function createPenerimaan(input: CreatePenerimaanInput): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan`, { method: "POST", body: JSON.stringify(input) });
}

export async function postPenerimaan(id: number): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan/${id}/post`, { method: "POST" });
}

export async function deletePenerimaan(id: number): Promise<void> {
  await api(`/api/penerimaan/${id}`, { method: "DELETE" });
}
