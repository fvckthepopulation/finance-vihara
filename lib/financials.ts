import { api } from "./api";

export type PLRow = {
  code: string;
  name: string;
  type: "revenue" | "expense";
  group: string;
  amount: number;
};

export type PLSection = {
  label: string;
  rows: PLRow[];
  total: number;
};

export type IncomeStatement = {
  period: { start: string; end: string };
  entity_id: number | null;
  sections: PLSection[];
  summary: {
    total_revenue: number;
    total_expense: number;
    net_income: number;
    gross_profit: number;
    operating_income: number;
  };
};

export type BSRow = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity";
  section: string;
  balance: number;
  synthetic?: boolean;
};

export type BSSection = {
  label: string;
  rows: BSRow[];
  total: number;
};

export type BalanceSheet = {
  as_of_date: string;
  entity_id: number | null;
  sections: BSSection[];
  summary: {
    total_asset: number;
    total_liability: number;
    total_equity: number;
    total_liability_equity: number;
    balance_check: number;
  };
};

export type CashFlowSection = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
};

export type CashFlow = {
  period: { start: string; end: string };
  entity_id: number | null;
  sections: CashFlowSection[];
  summary: {
    opening_cash: number;
    total_inflow: number;
    total_outflow: number;
    net_movement: number;
    closing_cash: number;
  };
};

export const getIncomeStatement = (params: {
  period_start?: string;
  period_end?: string;
  entity_id?: number;
} = {}) => {
  const sp = new URLSearchParams();
  if (params.period_start) sp.set("period_start", params.period_start);
  if (params.period_end) sp.set("period_end", params.period_end);
  if (params.entity_id) sp.set("entity_id", String(params.entity_id));
  return api<IncomeStatement>(`/api/reports/income-statement${sp.toString() ? `?${sp}` : ""}`);
};

export const getBalanceSheet = (params: { as_of_date?: string; entity_id?: number } = {}) => {
  const sp = new URLSearchParams();
  if (params.as_of_date) sp.set("as_of_date", params.as_of_date);
  if (params.entity_id) sp.set("entity_id", String(params.entity_id));
  return api<BalanceSheet>(`/api/reports/balance-sheet${sp.toString() ? `?${sp}` : ""}`);
};

export const getCashFlow = (params: {
  period_start?: string;
  period_end?: string;
  entity_id?: number;
} = {}) => {
  const sp = new URLSearchParams();
  if (params.period_start) sp.set("period_start", params.period_start);
  if (params.period_end) sp.set("period_end", params.period_end);
  if (params.entity_id) sp.set("entity_id", String(params.entity_id));
  return api<CashFlow>(`/api/reports/cash-flow${sp.toString() ? `?${sp}` : ""}`);
};

export type TaxSummary = {
  period: { start: string; end: string };
  entity_id: number | null;
  pph_final: {
    label: string;
    rate: number;
    base: number;
    base_label: string;
    amount: number;
    coa_code: string;
  };
  ppn: {
    label: string;
    keluaran: number;
    masukan: number;
    amount: number;
    note: string;
    coa_code_keluaran: string;
    coa_code_masukan: string;
  };
  pb1: {
    label: string;
    rate: number;
    base: number;
    base_label: string;
    amount: number;
    note: string;
  };
  summary: {
    total_tax_liability: number;
  };
};

export const getTaxSummary = (params: {
  period_start?: string;
  period_end?: string;
  entity_id?: number;
} = {}) => {
  const sp = new URLSearchParams();
  if (params.period_start) sp.set("period_start", params.period_start);
  if (params.period_end) sp.set("period_end", params.period_end);
  if (params.entity_id) sp.set("entity_id", String(params.entity_id));
  return api<TaxSummary>(`/api/reports/tax-summary${sp.toString() ? `?${sp}` : ""}`);
};
