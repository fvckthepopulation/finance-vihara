import { api, API_URL, getToken } from "./api";
import { Paginated } from "./api";

export type JournalLine = {
  id?: number;
  account_code: string;
  debit: number;
  credit: number;
  description?: string | null;
};

export type JournalEntryRow = {
  id: number;
  entity_id: number;
  entry_date: string;
  reference_type: string;
  description: string;
  /** Vihara asal jurnal; null untuk jurnal tingkat yayasan. */
  vihara?: { id: number; code: string; name: string } | null;
  reference?: string | null;
  /**
   * Ringkasan transaksi sumber (null untuk jurnal manual). Diambil server
   * dari baris sumbernya, bukan dari teks deskripsi — supaya jurnal lama
   * pun menampilkan informasi pembeda.
   */
  source?: {
    type: "pembayaran" | "penerimaan" | "petty_cash";
    label: string;
    code: string | null;
    name: string | null;
    counterparty: string | null;
    /** Catatan penginput — keterangan terpisah, bukan deskripsi baris (FV-51). */
    catatan?: string | null;
    reference: string | null;
    id: number;
  } | null;
  total_debit: string;
  total_credit: string;
  /** cancelled = dibatalkan lewat jurnal pembalik; barisnya tetap ada. */
  status: "draft" | "submitted" | "posted" | "rejected" | "cancelled";
  posted_at: string | null;
  created_by_user_id: number | null;
  entity?: { id: number; code: string };
  created_by?: { id: number; name: string };
  posted_by?: { id: number; name: string };
  /** Baris jurnal (kolom Akun COA di list) — di-load oleh index API. */
  lines?: {
    id: number;
    account_code: string;
    debit: string;
    credit: string;
    description?: string | null;
    account?: { code: string; name: string } | null;
  }[];
};

export type JournalEntryDetail = JournalEntryRow & {
  lines: {
    id: number;
    account_code: string;
    debit: string;
    credit: string;
    description: string | null;
    account?: { code: string; name: string } | null;
  }[];
};

// reference_type → label for the "Sumber" column/filter.
export const JOURNAL_SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  pembayaran: "Pembayaran",
  penerimaan: "Penerimaan",
  invoice: "AP Invoice",
  invoice_reversal: "Balik AP Invoice",
  payment: "AP Payment",
  ar_invoice: "AR Invoice",
  ar_payment: "AR Payment",
  petty_cash: "Petty Cash",
  giro_clearing: "Giro Cair",
  konversi_um: "Konversi UM",
  penjualan_toko: "Penjualan Toko",
  pst_settlement: "Settlement Toko",
  bagi_hasil: "Bagi Hasil",
  pembayaran_amortisasi: "Amortisasi Prepaid",
  pembayaran_pph_akrual: "Akrual PPh 4(2)",
};

export const journalSourceLabel = (refType: string) =>
  JOURNAL_SOURCE_LABEL[refType] ?? refType;

export const listJournalEntries = (params: {
  status?: string;
  source?: string;
  entity_id?: number;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
} = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  });
  return api<Paginated<JournalEntryRow>>(
    `/api/journal-entries${sp.toString() ? `?${sp}` : ""}`,
  );
};

export const getJournalEntry = (id: number | string) =>
  api<JournalEntryDetail>(`/api/journal-entries/${id}`);

export type CreateJournalEntryPayload = {
  entity_id: number;
  /**
   * Vihara pemilik jurnal (FV-35). Wajib diisi dari form; null hanya untuk
   * jurnal tingkat yayasan yang dibuat sistem, dan untuk baris lama yang
   * memang belum punya vihara.
   */
  vihara_id?: number | null;
  entry_date: string;
  description: string;
  reference?: string;
  lines: {
    account_code: string;
    debit: number;
    credit: number;
    description?: string;
  }[];
};

export const createJournalEntry = (payload: CreateJournalEntryPayload) =>
  api<JournalEntryDetail>(`/api/journal-entries`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** Batalkan jurnal terposting — server menulis jurnal pembalik. */
/**
 * Siklus persetujuan jurnal manual (FV-53).
 *
 * Sebelumnya jurnal manual lahir sebagai draft dan berhenti di situ: tidak
 * ada jalan menuju posted, padahal laporan hanya membaca yang posted. Jadi
 * saldo awal dan koreksi tidak pernah berpengaruh ke mana pun.
 */
/**
 * Unduh Jurnal & Buku Besar sebagai .xlsx (FV-59).
 *
 * Mengikuti saringan yang sedang aktif. Tidak lewat api(): berkas biner
 * butuh token di header, jadi tidak bisa dibuka dengan <a href> polos.
 */
export async function unduhJurnalExcel(params: {
  status?: string;
  source?: string;
  from?: string;
  to?: string;
  q?: string;
  vihara_id?: number | null;
}): Promise<{ blob: Blob; filename: string }> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}/api/journal-entries/export?${sp}`, { headers });
  if (!res.ok) {
    let pesan = `Gagal mengunduh jurnal (HTTP ${res.status})`;
    try {
      const payload = (await res.json()) as { message?: string };
      if (payload.message) pesan = payload.message;
    } catch {
      /* biarkan pesan bawaan */
    }
    throw new Error(pesan);
  }

  const cd = res.headers.get("Content-Disposition") ?? "";
  const cocok = /filename="?([^";]+)"?/.exec(cd);

  return { blob: await res.blob(), filename: cocok?.[1] ?? "Jurnal.xlsx" };
}

export const submitJournalEntry = (id: number) =>
  api<JournalEntryRow>(`/api/journal-entries/${id}/submit`, { method: "POST" });

export const postJournalEntry = (id: number) =>
  api<JournalEntryRow>(`/api/journal-entries/${id}/post`, { method: "POST" });

export const rejectJournalEntry = (id: number, reason: string) =>
  api<JournalEntryRow>(`/api/journal-entries/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const voidJournalEntry = (id: number, reason: string) =>
  api<unknown>(`/api/journal-entries/${id}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const deleteJournalEntry = (id: number) =>
  api<{ message: string }>(`/api/journal-entries/${id}`, { method: "DELETE" });

// ── Konversi Uang Muka BB → Persediaan ──────────────────────────────────────

export type PendingKonversiRow = {
  id: number;
  code: string;
  date: string | null;
  supplier: string;
  entity_code: string | null;
  amount: number;
  status: "pending" | "dikonversi";
  konversi: {
    journal_entry_id: number;
    date: string | null;
    amount: number;
    reference: string | null;
  } | null;
};

export const listPendingKonversi = () =>
  api<PendingKonversiRow[]>(`/api/uang-muka/pending-konversi`);

export const konversiUangMuka = (
  pembayaranId: number,
  payload: { date: string; amount: number; reference?: string; description?: string },
) =>
  api<JournalEntryDetail>(`/api/uang-muka/${pembayaranId}/konversi`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
