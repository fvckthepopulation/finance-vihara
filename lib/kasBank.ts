import { api } from "./api";

/** Koersi nilai uang dari API (bisa decimal string) → number. */
export const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

// ============================================================================
// Master rekening bank per vihara
// ============================================================================

export type ViharaBankAccount = {
  id: number;
  vihara_id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  coa_account_code: string | null;
  active: boolean;
};

export const listViharaBankAccounts = (viharaId?: number | null) => {
  const sp = new URLSearchParams();
  if (viharaId != null) sp.set("vihara_id", String(viharaId));
  return api<{ data: ViharaBankAccount[] }>(
    `/api/masters/vihara-bank-accounts${sp.toString() ? `?${sp}` : ""}`,
  ).then((r) => r.data);
};

export type ViharaBankAccountInput = {
  bank_name: string;
  account_number: string;
  account_name: string;
  coa_account_code?: string;
};

export const createViharaBankAccount = (viharaId: number, payload: ViharaBankAccountInput) =>
  api<ViharaBankAccount>(`/api/viharas/${viharaId}/bank-accounts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateViharaBankAccount = (
  id: number,
  payload: Partial<ViharaBankAccountInput> & { active?: boolean },
) =>
  api<ViharaBankAccount>(`/api/vihara-bank-accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

/** DELETE — 422 bila rekening sudah dipakai transaksi (fallback: nonaktifkan). */
export const deleteViharaBankAccount = (id: number) =>
  api<{ message?: string }>(`/api/vihara-bank-accounts/${id}`, { method: "DELETE" });

/** Nama bank tanpa prefiks "Bank " (API mengirim "Bank BCA"). */
export const bankBrand = (name: string) => name.replace(/^bank\s+/i, "");

/** Judul kartu, dijamin berprefiks "Bank" — mis. "Bank BCA". */
export const bankTitle = (name: string) => (/^bank\s/i.test(name) ? name : `Bank ${name}`);

/** Label pendek rekening, mis. "BCA 6280-3488-88" (mengikuti mockup). */
export const bankShortLabel = (b: { bank_name: string; account_number: string }) =>
  `${bankBrand(b.bank_name)} ${b.account_number}`;

// ============================================================================
// Kas & Bank dashboard (GET /api/kas-bank)
// ============================================================================

export type KasBankAccount = {
  id: number;
  vihara_id: number;
  vihara_name?: string | null;
  bank_name: string;
  account_number: string;
  account_name: string;
  saldo: string | number;
};

export type KasBankMutasi = {
  date: string;
  name: string;
  tipe: string;
  bank_account_id: number | null;
  bank_label?: string | null;
  masuk: string | number | null;
  keluar: string | number | null;
};

export type KasBankData = {
  bank_accounts: KasBankAccount[];
  kas_kecil: { pics: { id: number; name: string; saldo: string | number }[]; total: string | number };
  kas_tunai: string | number;
  mutasi: KasBankMutasi[];
};

export const getKasBank = (params: { vihara_id?: number | null; bank_account_id?: number } = {}) => {
  const sp = new URLSearchParams();
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  if (params.bank_account_id != null) sp.set("bank_account_id", String(params.bank_account_id));
  return api<KasBankData>(`/api/kas-bank${sp.toString() ? `?${sp}` : ""}`);
};
