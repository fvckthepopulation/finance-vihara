import { api, Paginated } from "./api";

export type PembayaranMethod = "transfer" | "tunai" | "auto_debit";

export const METHOD_LABEL: Record<PembayaranMethod, string> = {
  transfer: "Transfer bank",
  tunai: "Tunai",
  auto_debit: "Auto debit",
};

/** Loose: kategori PSAK Phase A bisa berkembang (16+ entries). Label datang dari API. */
export type PembayaranCategory = string;

/** Fallback labels — API endpoint /api/pembayaran/categories is the source of truth. */
export const CATEGORY_LABEL: Record<string, string> = {
  biaya_payment_gateway: "Biaya Payment Gateway",
  gaji_tunjangan: "Gaji & Tunjangan",
  bpjs: "BPJS",
  sewa_kantor: "Sewa Kantor",
  utilitas: "Utilitas",
  pph_badan: "PPh Badan",
  marketing_iklan: "Marketing & Iklan",
  atk_perlengkapan: "ATK & Perlengkapan",
  transport_perjalanan: "Transport & Perjalanan",
  konsumsi_rapat: "Konsumsi Rapat",
  biaya_server: "Biaya Server",
  ops_marketplace: "Ops Marketplace",
  refund_donatur: "Refund Donatur",
  refund_buyer: "Refund Buyer",
  pajak: "Pajak",
  lainnya: "Lainnya",
};

export const categoryLabel = (key: string): string =>
  CATEGORY_LABEL[key] ?? humanize(key);

function humanize(key: string): string {
  return key.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

export type PembayaranStatus = "draft" | "posted" | "cancelled";

export const STATUS_LABEL: Record<PembayaranStatus, string> = {
  draft: "Draft",
  posted: "Diposting",
  cancelled: "Dibatalkan",
};

export const STATUS_TONE: Record<PembayaranStatus, "neutral" | "info" | "success" | "danger"> = {
  draft: "neutral",
  posted: "success",
  cancelled: "danger",
};

export type Pembayaran = {
  id: number;
  code: string;
  date: string;
  method: PembayaranMethod;
  source_account_code: string;
  category: PembayaranCategory;
  entity_id: number;
  payee_id: number | null;
  payee_name: string | null;
  debit_account_code: string;
  reference: string | null;
  amount: string;
  description: string | null;
  attachment_path: string | null;
  status: PembayaranStatus;
  journal_entry_id: number | null;
  created_by_user_id: number | null;
  posted_by_user_id: number | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
  entity?: { id: number; code: string; legal_name: string };
  payee?: { id: number; code: string; name: string } | null;
  source_account?: { code: string; name: string };
  debit_account?: { code: string; name: string };
};

export type CategoryOption = {
  key: PembayaranCategory;
  label: string;
  default_debit: string;
};

export async function getPembayaranCategories(): Promise<CategoryOption[]> {
  return api<CategoryOption[]>(`/api/pembayaran/categories`);
}

export type ListPembayaranParams = {
  status?: PembayaranStatus;
  category?: PembayaranCategory;
  month?: string;
  entity_id?: number;
  page?: number;
};

export async function listPembayaran(params: ListPembayaranParams = {}): Promise<Paginated<Pembayaran>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.month) qs.set("month", params.month);
  if (params.entity_id) qs.set("entity_id", String(params.entity_id));
  if (params.page) qs.set("page", String(params.page));
  const suffix = qs.toString() ? `?${qs}` : "";
  return api<Paginated<Pembayaran>>(`/api/pembayaran${suffix}`);
}

export async function getPembayaran(id: number): Promise<Pembayaran> {
  return api<Pembayaran>(`/api/pembayaran/${id}`);
}

export type CreatePembayaranInput = {
  date: string;
  method: PembayaranMethod;
  /** Rekening sumber (master vihara-bank-accounts) — server menurunkan akun COA. */
  bank_account_id?: number;
  /** @deprecated Pakai bank_account_id; tersisa untuk kompat lama. */
  source_account_code?: string;
  category: PembayaranCategory;
  entity_id?: number;
  payee_id?: number | null;
  payee_name?: string | null;
  debit_account_code?: string | null;
  reference?: string | null;
  amount: number;
  description?: string | null;
  /** Nama pengeluaran — dari master transaction-names (form mockup). */
  name?: string;
  /** Disetujui oleh (nama approver). */
  approved_by_name?: string | null;
  /** Vihara — wajib utk superadmin; user vihara tetap: server memaksa. */
  vihara_id?: number;
};

export async function createPembayaran(input: CreatePembayaranInput): Promise<Pembayaran> {
  return api<Pembayaran>(`/api/pembayaran`, { method: "POST", body: JSON.stringify(input) });
}

export async function postPembayaran(id: number): Promise<Pembayaran> {
  return api<Pembayaran>(`/api/pembayaran/${id}/post`, { method: "POST" });
}

/** Backwards-compat alias used elsewhere in app (e.g. /pajak quick-pay). */
export const postNowPembayaran = postPembayaran;

export async function deletePembayaran(id: number): Promise<void> {
  await api(`/api/pembayaran/${id}`, { method: "DELETE" });
}
