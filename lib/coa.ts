import { api, Paginated } from "./api";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type CoaAccount = {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  parent_code: string | null;
  entity_id: number | null;
  is_header: boolean;
  note: string | null;
  active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

export type CoaUsageBreakdown = {
  journal_lines: number;
  invoice_lines_debit: number;
  ar_invoice_lines_credit: number;
};

export type CoaDetail = {
  account: CoaAccount;
  usage_count: number;
  usage_breakdown: CoaUsageBreakdown;
};

export const listCoa = (params: { q?: string; type?: string; active?: boolean } = {}) => {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type) sp.set("type", params.type);
  if (typeof params.active === "boolean") sp.set("active", String(params.active));
  return api<CoaAccount[]>(`/api/coa${sp.toString() ? `?${sp}` : ""}`);
};

export const listCoaPaginated = (
  params: { q?: string; type?: string; active?: boolean; page?: number; per_page?: number } = {},
) => {
  const sp = new URLSearchParams({ paginate: "1" });
  if (params.q) sp.set("q", params.q);
  if (params.type) sp.set("type", params.type);
  if (typeof params.active === "boolean") sp.set("active", String(params.active));
  if (params.page) sp.set("page", String(params.page));
  if (params.per_page) sp.set("per_page", String(params.per_page));
  return api<Paginated<CoaAccount>>(`/api/coa?${sp}`);
};

export const getCoa = (code: string) => api<CoaDetail>(`/api/coa/${encodeURIComponent(code)}`);

export type CreateCoaPayload = {
  code: string;
  name: string;
  type: AccountType;
  parent_code?: string | null;
  entity_id?: number | null;
  is_header?: boolean;
  note?: string | null;
  active?: boolean;
};

export const createCoa = (payload: CreateCoaPayload) =>
  api<CoaAccount>(`/api/coa`, { method: "POST", body: JSON.stringify(payload) });

export type UpdateCoaPayload = Partial<Omit<CreateCoaPayload, "code">> & { force?: boolean };

export const updateCoa = (code: string, payload: UpdateCoaPayload) =>
  api<CoaAccount>(`/api/coa/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteCoa = (code: string) =>
  api<{ message: string }>(`/api/coa/${encodeURIComponent(code)}`, { method: "DELETE" });

export const TYPE_LABEL: Record<AccountType, string> = {
  asset: "Aset",
  liability: "Kewajiban",
  equity: "Ekuitas",
  revenue: "Pendapatan",
  expense: "Beban",
};
