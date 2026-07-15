import { api } from "./api";

// Master "Nama Penerimaan / Nama Pengeluaran" — opsi dropdown bertingkat
// (kategori → nama) pada form input penerimaan & pengeluaran.

export type TransactionNameType = "penerimaan" | "pengeluaran";

export type TransactionName = {
  id: number;
  type: TransactionNameType;
  category: string;
  name: string;
};

export async function listTransactionNames(params: {
  type: TransactionNameType;
  category?: string;
}): Promise<TransactionName[]> {
  const sp = new URLSearchParams({ type: params.type });
  if (params.category) sp.set("category", params.category);
  const res = await api<{ data: TransactionName[] }>(
    `/api/masters/transaction-names?${sp}`,
  );
  return res.data;
}
