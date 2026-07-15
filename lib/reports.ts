import { api } from "./api";

export type ReportPeriod = { from: string; to: string; status: "posted" | "all" };
export type AccountTotal = { code: string; name: string; total: number };

export type GroupBlock = { accounts: AccountTotal[]; total: number };

export type ProfitLoss = {
  period: ReportPeriod;
  revenue: GroupBlock;
  cogs: GroupBlock;
  gross_profit: number;
  opex: GroupBlock;
  operating_profit: number;
  tax: GroupBlock;
  net_profit: number;
};

export type BalanceSheet = {
  as_of: string;
  status: "posted" | "all";
  assets: GroupBlock;
  liabilities: GroupBlock;
  equity: {
    accounts: AccountTotal[];
    book_total: number;
    retained_earnings_ytd: number;
    total: number;
  };
  liabilities_plus_equity: number;
  balance_diff: number;
};

export type TrialBalanceRow = {
  code: string;
  name: string | null;
  type: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalance = {
  as_of: string;
  status: "posted" | "all";
  accounts: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  diff: number;
};

export type PajakRekap = {
  period: ReportPeriod;
  pajak: GroupBlock;
  komisi_diterima: GroupBlock;
  mdr_dibayar: GroupBlock;
  pajak_monthly: { month: string; total: number }[];
};

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const getProfitLoss = (params: { from?: string; to?: string; status?: string } = {}) =>
  api<ProfitLoss>(`/api/reports/pl${qs(params)}`);

export const getBalanceSheet = (params: { as_of?: string; status?: string } = {}) =>
  api<BalanceSheet>(`/api/reports/balance-sheet${qs(params)}`);

export const getTrialBalance = (params: { as_of?: string; status?: string } = {}) =>
  api<TrialBalance>(`/api/reports/trial-balance${qs(params)}`);

export const getPajakRekap = (params: { from?: string; to?: string; status?: string } = {}) =>
  api<PajakRekap>(`/api/reports/pajak${qs(params)}`);
