import { api } from "./api";

export type CashAccountBalance = {
  code: string;
  name: string;
  balance: number;
};

export type CashDashboard = {
  as_of_date: string;
  accounts: CashAccountBalance[];
  totals: {
    cash_total: number;
    ar_outstanding: number;
    ap_outstanding: number;
    net_position: number;
  };
  forecast_7d: {
    ar_due: number;
    ap_due: number;
    net: number;
    window_end: string;
  };
};

export const getCashDashboard = (params: { as_of_date?: string; entity_id?: number } = {}) => {
  const sp = new URLSearchParams();
  if (params.as_of_date) sp.set("as_of_date", params.as_of_date);
  if (params.entity_id) sp.set("entity_id", String(params.entity_id));
  return api<CashDashboard>(`/api/cash/dashboard${sp.toString() ? `?${sp}` : ""}`);
};

export type BankTransaction = {
  id: number;
  entry_id: number;
  entry_date: string;
  entry_description: string;
  reference_type: string | null;
  reference_id: number | null;
  debit: number;
  credit: number;
  description: string | null;
  running_balance: number;
  reconciled_at: string | null;
  bank_statement_date: string | null;
  bank_statement_ref: string | null;
};

export type BankBook = {
  account: { code: string; name: string };
  period: { start: string; end: string };
  opening_balance: number;
  closing_balance: number;
  totals: {
    debit: number;
    credit: number;
    movement: number;
    count: number;
    reconciled_count: number;
    unreconciled_count: number;
  };
  rows: BankTransaction[];
};

export const getBankBook = (
  accountCode: string,
  params: { start_date?: string; end_date?: string; recon_status?: "" | "reconciled" | "unreconciled" } = {},
) => {
  const sp = new URLSearchParams();
  if (params.start_date) sp.set("start_date", params.start_date);
  if (params.end_date) sp.set("end_date", params.end_date);
  if (params.recon_status) sp.set("recon_status", params.recon_status);
  return api<BankBook>(
    `/api/cash/accounts/${encodeURIComponent(accountCode)}/transactions${sp.toString() ? `?${sp}` : ""}`,
  );
};

export type ReconcilePayload = {
  reconciled: boolean;
  bank_statement_date?: string;
  bank_statement_ref?: string;
};

export const reconcileJournalLine = (
  lineId: number,
  payload: ReconcilePayload,
) =>
  api<{ id: number; reconciled_at: string | null; bank_statement_ref: string | null }>(
    `/api/cash/journal-lines/${lineId}/reconcile`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
