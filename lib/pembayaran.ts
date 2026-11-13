import { api, API_URL, getToken, Paginated } from "./api";

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

export type PembayaranStatus =
  | "draft"
  | "submitted"
  | "posted"
  | "rejected"
  | "cancelled";

/** Label siklus draft -> pengajuan -> persetujuan, sesuai nama di laporan QC. */
export const STATUS_LABEL: Record<PembayaranStatus, string> = {
  draft: "Draft",
  submitted: "Menunggu Persetujuan",
  posted: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

export const STATUS_TONE: Record<
  PembayaranStatus,
  "neutral" | "info" | "warn" | "success" | "danger"
> = {
  draft: "neutral",
  submitted: "warn",
  posted: "success",
  rejected: "danger",
  cancelled: "danger",
};

export type Pembayaran = {
  id: number;
  code: string;
  date: string;
  method: PembayaranMethod;
  source_account_code: string;
  /** Boleh kosong HANYA saat draft: true. */
  category?: PembayaranCategory;
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
  vihara?: { id: number; code: string; name: string } | null;
  /** Nama pengeluaran dari master transaction_names. */
  name?: string | null;
  bank_account?: { id: number; bank_name: string; account_number: string } | null;
  approved_by_name?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  /** Jejak siklus — penyetuju yang sah berasal dari sini, bukan dari teks. */
  submitted_at?: string | null;
  submitted_by?: { id: number; name: string } | null;
  posted_by?: { id: number; name: string } | null;
  rejected_at?: string | null;
  rejected_by?: { id: number; name: string } | null;
  reject_reason?: string | null;
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
  /** Boleh kosong HANYA saat draft: true. */
  category?: PembayaranCategory;
  entity_id?: number;
  payee_id?: number | null;
  payee_name?: string | null;
  debit_account_code?: string | null;
  reference?: string | null;
  /** Boleh kosong HANYA saat draft: true. */
  amount?: number;
  description?: string | null;
  /** Nama pengeluaran — dari master transaction-names (form mockup). */
  name?: string;
  /** Disetujui oleh (nama approver). */
  approved_by_name?: string | null;
  /** Vihara — wajib utk superadmin; user vihara tetap: server memaksa. */
  vihara_id?: number;
  /**
   * true = simpan sebagai draft setengah jadi. Server melonggarkan validasi
   * (cukup tanggal + vihara); kelengkapan ditegakkan saat diajukan/disetujui.
   */
  draft?: boolean;
};

export async function createPembayaran(input: CreatePembayaranInput): Promise<Pembayaran> {
  return api<Pembayaran>(`/api/pembayaran`, { method: "POST", body: JSON.stringify(input) });
}

/**
 * Unggah lampiran bukti (kuitansi / invoice). API menerima pdf/jpg/png,
 * maksimal 10 MB, dan menyimpannya di disk privat — bukan folder publik —
 * sehingga hanya bisa diambil lewat endpoint unduh yang dijaga hirarki.
 */
export async function uploadPembayaranAttachment(
  id: number,
  file: File,
): Promise<Pembayaran> {
  const body = new FormData();
  body.append("file", file);
  const headers = new Headers({ Accept: "application/json" });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Sengaja tidak lewat api(): Content-Type harus dibiarkan diisi browser
  // agar boundary multipart-nya benar.
  const res = await fetch(`${API_URL}/api/pembayaran/${id}/attachment`, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) {
    let pesan = `Gagal mengunggah lampiran (HTTP ${res.status})`;
    try {
      const payload = (await res.json()) as { message?: string };
      if (payload.message) pesan = payload.message;
    } catch {
      /* biarkan pesan bawaan */
    }
    throw new Error(pesan);
  }
  return (await res.json()) as Pembayaran;
}

/** Ambil lampiran sebagai Blob — perlu token, jadi tidak bisa <a href> polos. */
export async function fetchPembayaranAttachment(id: number): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}/api/pembayaran/${id}/attachment`, { headers });
  if (!res.ok) throw new Error(`Gagal membuka lampiran (HTTP ${res.status})`);
  return res.blob();
}

/** Ubah draft / yang ditolak. */
export async function updatePembayaran(
  id: number,
  input: Partial<CreatePembayaranInput>,
): Promise<Pembayaran> {
  return api<Pembayaran>(`/api/pembayaran/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Ajukan draft ke antrean persetujuan. */
export async function submitPembayaran(id: number): Promise<Pembayaran> {
  return api<Pembayaran>(`/api/pembayaran/${id}/submit`, { method: "POST" });
}

/** Tolak pengajuan, alasan wajib. */
export async function rejectPembayaran(id: number, reason: string): Promise<Pembayaran> {
  return api<Pembayaran>(`/api/pembayaran/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function postPembayaran(id: number): Promise<Pembayaran> {
  return api<Pembayaran>(`/api/pembayaran/${id}/post`, { method: "POST" });
}

/** Backwards-compat alias used elsewhere in app (e.g. /pajak quick-pay). */
export const postNowPembayaran = postPembayaran;

export async function deletePembayaran(id: number): Promise<void> {
  await api(`/api/pembayaran/${id}`, { method: "DELETE" });
}
