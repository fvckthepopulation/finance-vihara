import { api } from "./api";

// Master "Nama Penerimaan / Nama Pengeluaran" — opsi dropdown bertingkat
// (kategori → nama) pada form input penerimaan & pengeluaran.

export type TransactionNameType = "penerimaan" | "pengeluaran";

export type TransactionName = {
  id: number;
  type: TransactionNameType;
  category: string;
  /** null = berlaku untuk semua vihara; terisi = khusus vihara itu. */
  vihara_id: number | null;
  name: string;
};

export async function listTransactionNames(params: {
  type: TransactionNameType;
  category?: string;
  /**
   * Vihara transaksi. Bila diisi, daftar hanya memuat item umum + item milik
   * vihara itu — item khusus vihara lain tidak ikut terbawa.
   */
  vihara_id?: number | null;
}): Promise<TransactionName[]> {
  const sp = new URLSearchParams({ type: params.type });
  if (params.category) sp.set("category", params.category);
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  const res = await api<{ data: TransactionName[] }>(
    `/api/masters/transaction-names?${sp}`,
  );
  return res.data;
}
