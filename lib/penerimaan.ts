import { api, API_URL, getToken, Paginated } from "./api";
import { StatusTransaksi } from "./statusTransaksi";

export type PenerimaanMethod = "transfer" | "tunai" | "auto_credit";

export const METHOD_LABEL: Record<PenerimaanMethod, string> = {
  transfer: "Transfer bank",
  tunai: "Tunai",
  auto_credit: "Auto credit",
};

/** Kode kategori dana — longgar, karena admin boleh menambah di master. */
export type PenerimaanCategory = string;

const humanize = (key: string): string =>
  key.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");

/**
 * Cadangan label kalau master belum termuat. Sumber kebenarannya
 * /api/penerimaan/categories, yang membacanya dari master (FV-45).
 */
export const CATEGORY_LABEL: Record<string, string> = {
  dana_operasional: "Dana Operasional",
  dana_paramita: "Dana Paramita",
  dana_bhikkhu: "Dana Bhikkhu",
  dana_perayaan: "Dana Perayaan",
  donasi_belum_teridentifikasi: "Donasi Belum Teridentifikasi",
};

export const categoryLabel = (key: string): string =>
  CATEGORY_LABEL[key] ?? humanize(key);

// Siklus persetujuan penerimaan sama dengan pengeluaran (FV-45 poin 1).
export type PenerimaanStatus = StatusTransaksi;
export { STATUS_LABEL, STATUS_TONE } from "./statusTransaksi";

export type Penerimaan = {
  id: number;
  code: string;
  date: string;
  method: PenerimaanMethod;
  /** Boleh kosong HANYA saat draft. */
  destination_account_code: string | null;
  category: PenerimaanCategory | null;
  entity_id: number;
  vihara_id: number | null;
  source_payee_id: number | null;
  source_name: string | null;
  received_by: string | null;
  credit_account_code: string | null;
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
  vihara?: { id: number; code: string; name: string } | null;
  /** Nama penerimaan dari master transaction_names. */
  name?: string | null;
  bank_account?: { id: number; bank_name: string; account_number: string } | null;
  source_payee?: { id: number; code: string; name: string } | null;
  destination_account?: { code: string; name: string };
  credit_account?: { code: string; name: string };
  voided_at?: string | null;
  void_reason?: string | null;
  /** Jejak siklus — penyetuju yang sah berasal dari sini, bukan dari teks. */
  created_by?: { id: number; name: string } | null;
  submitted_at?: string | null;
  submitted_by?: { id: number; name: string } | null;
  posted_by?: { id: number; name: string } | null;
  rejected_at?: string | null;
  rejected_by?: { id: number; name: string } | null;
  reject_reason?: string | null;
};

export type CategoryOption = {
  key: PenerimaanCategory;
  label: string;
  /** 'tp' | 'dp' | null — klasifikasi ISAK 35; null untuk kategori buatan admin. */
  restriction?: "tp" | "dp" | null;
  default_credit: string | null;
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
  per_page?: number;
};

export async function listPenerimaan(
  params: ListPenerimaanParams = {},
): Promise<Paginated<Penerimaan>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.month) qs.set("month", params.month);
  if (params.entity_id) qs.set("entity_id", String(params.entity_id));
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  const suffix = qs.toString() ? `?${qs}` : "";
  return api<Paginated<Penerimaan>>(`/api/penerimaan${suffix}`);
}

export async function getPenerimaan(id: number): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan/${id}`);
}

export type CreatePenerimaanInput = {
  date: string;
  method: PenerimaanMethod;
  /** Rekening tujuan (master rekening yayasan) — server menurunkan akun COA. */
  bank_account_id?: number | null;
  /** @deprecated Pakai bank_account_id; tersisa untuk kompat lama. */
  destination_account_code?: string;
  /** Boleh kosong HANYA saat draft: true. */
  category?: PenerimaanCategory;
  entity_id?: number;
  source_payee_id?: number | null;
  source_name?: string | null;
  credit_account_code?: string | null;
  reference?: string | null;
  /** Boleh kosong HANYA saat draft: true. */
  amount?: number;
  description?: string | null;
  /** Nama penerimaan — dari master (FV-45 poin 5). */
  name?: string;
  /** Diterima oleh — diisi server dari akun yang login. */
  received_by?: string | null;
  /** Vihara tujuan — wajib utk superadmin; user vihara tetap: server memaksa. */
  vihara_id?: number;
  /**
   * true = simpan sebagai draft setengah jadi. Server melonggarkan validasi
   * (cukup tanggal + vihara); kelengkapan ditegakkan saat diajukan/disetujui,
   * dan draft tidak membuat jurnal maupun menyentuh saldo.
   */
  draft?: boolean;
};

export async function createPenerimaan(input: CreatePenerimaanInput): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan`, { method: "POST", body: JSON.stringify(input) });
}

/** Ubah draft / yang ditolak. */
export async function updatePenerimaan(
  id: number,
  input: Partial<CreatePenerimaanInput>,
): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Ajukan draft penerimaan ke antrean persetujuan. */
export async function submitPenerimaan(id: number): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan/${id}/submit`, { method: "POST" });
}

/** Tolak pengajuan penerimaan, alasan wajib. */
export async function rejectPenerimaan(id: number, reason: string): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function postPenerimaan(id: number): Promise<Penerimaan> {
  return api<Penerimaan>(`/api/penerimaan/${id}/post`, { method: "POST" });
}

export async function deletePenerimaan(id: number): Promise<void> {
  await api(`/api/penerimaan/${id}`, { method: "DELETE" });
}

/**
 * Unggah lampiran bukti (kuitansi / bukti transfer). Sama seperti pengeluaran:
 * pdf/jpg/png, maksimal 10 MB, disimpan di disk privat dan hanya bisa diambil
 * lewat endpoint unduh yang dijaga hirarki vihara.
 */
export async function uploadPenerimaanAttachment(
  id: number,
  file: File,
): Promise<Penerimaan> {
  const body = new FormData();
  body.append("file", file);
  const headers = new Headers({ Accept: "application/json" });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Sengaja tidak lewat api(): Content-Type harus dibiarkan diisi browser
  // agar boundary multipart-nya benar.
  const res = await fetch(`${API_URL}/api/penerimaan/${id}/attachment`, {
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
  return (await res.json()) as Penerimaan;
}

/** Ambil lampiran sebagai Blob — perlu token, jadi tidak bisa <a href> polos. */
export async function fetchPenerimaanAttachment(id: number): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}/api/penerimaan/${id}/attachment`, { headers });
  if (!res.ok) throw new Error(`Gagal membuka lampiran (HTTP ${res.status})`);
  return res.blob();
}
