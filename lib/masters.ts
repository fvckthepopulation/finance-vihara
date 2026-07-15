import { api, Paginated } from "./api";

// ============ Supplier ============
export type MasterSupplier = {
  id: number;
  code: string;
  name: string;
  npwp: string | null;
  payment_term_days: number;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  is_konsinyasi: boolean;
  /** Supplier bahan baku (BB) — filter dropdown supplier di Tukar Faktur. */
  is_bahan_baku: boolean;
  active: boolean;
  usage_count: number;
};

export const listSuppliers = (params: { q?: string; active?: boolean; jenis?: "bb" | "non_bb" } = {}) => {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (typeof params.active === "boolean") sp.set("active", String(params.active));
  if (params.jenis) sp.set("jenis", params.jenis);
  return api<MasterSupplier[]>(`/api/master-suppliers${sp.toString() ? `?${sp}` : ""}`);
};
export const listSuppliersPaginated = (
  params: { q?: string; active?: boolean; page?: number; per_page?: number } = {},
) => {
  const sp = new URLSearchParams({ paginate: "1" });
  if (params.q) sp.set("q", params.q);
  if (typeof params.active === "boolean") sp.set("active", String(params.active));
  if (params.page) sp.set("page", String(params.page));
  if (params.per_page) sp.set("per_page", String(params.per_page));
  return api<Paginated<MasterSupplier>>(`/api/master-suppliers?${sp}`);
};
export const createSupplier = (payload: Partial<MasterSupplier>) =>
  api<MasterSupplier>(`/api/master-suppliers`, { method: "POST", body: JSON.stringify(payload) });
export const updateSupplier = (id: number, payload: Partial<MasterSupplier>) =>
  api<MasterSupplier>(`/api/master-suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteSupplier = (id: number) =>
  api<{ message: string }>(`/api/master-suppliers/${id}`, { method: "DELETE" });

// ============ Customer ============
export type Channel =
  | "bagi_hasil" | "rekanan" | "katering" | "pesanan_umum"
  | "roti_keliling" | "kafe_bistro" | "bar_lounge" | "padang_bistro" | "other";

export const CHANNEL_LABEL: Record<Channel, string> = {
  bagi_hasil: "Bagi Hasil", rekanan: "Rekanan", katering: "Katering",
  pesanan_umum: "Pesanan Umum", roti_keliling: "Roti Keliling",
  kafe_bistro: "Kafe & Bistro", bar_lounge: "Bar & Lounge",
  padang_bistro: "Padang Bistro", other: "Lainnya",
};

export type MasterCustomer = {
  id: number;
  code: string;
  name: string;
  channel: Channel;
  payment_term_days: number;
  credit_limit: string | null;
  bagi_hasil_pct: number | null;
  npwp: string | null;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
  usage_count: number;
};

export const listCustomers = (params: { q?: string; channel?: string; active?: boolean } = {}) => {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.channel) sp.set("channel", params.channel);
  if (typeof params.active === "boolean") sp.set("active", String(params.active));
  return api<MasterCustomer[]>(`/api/master-customers${sp.toString() ? `?${sp}` : ""}`);
};
export const listCustomersPaginated = (
  params: { q?: string; channel?: string; active?: boolean; page?: number; per_page?: number } = {},
) => {
  const sp = new URLSearchParams({ paginate: "1" });
  if (params.q) sp.set("q", params.q);
  if (params.channel) sp.set("channel", params.channel);
  if (typeof params.active === "boolean") sp.set("active", String(params.active));
  if (params.page) sp.set("page", String(params.page));
  if (params.per_page) sp.set("per_page", String(params.per_page));
  return api<Paginated<MasterCustomer>>(`/api/master-customers?${sp}`);
};
export const createCustomer = (payload: Partial<MasterCustomer>) =>
  api<MasterCustomer>(`/api/master-customers`, { method: "POST", body: JSON.stringify(payload) });
export const updateCustomer = (id: number, payload: Partial<MasterCustomer>) =>
  api<MasterCustomer>(`/api/master-customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteCustomer = (id: number) =>
  api<{ message: string }>(`/api/master-customers/${id}`, { method: "DELETE" });

// ============ Entity ============
export type MasterEntity = {
  id: number;
  code: string;
  legal_name: string;
  npwp: string | null;
  address: string | null;
  active: boolean;
  usage_count: number;
  usage_breakdown: {
    ap_invoices: number;
    ar_invoices: number;
    journal_entries: number;
    petty_cash: number;
  };
};

export const listEntities = (params: { active?: boolean } = {}) => {
  const sp = new URLSearchParams();
  if (typeof params.active === "boolean") sp.set("active", String(params.active));
  return api<MasterEntity[]>(`/api/master-entities${sp.toString() ? `?${sp}` : ""}`);
};
export const listEntitiesPaginated = (
  params: { active?: boolean; page?: number; per_page?: number } = {},
) => {
  const sp = new URLSearchParams({ paginate: "1" });
  if (typeof params.active === "boolean") sp.set("active", String(params.active));
  if (params.page) sp.set("page", String(params.page));
  if (params.per_page) sp.set("per_page", String(params.per_page));
  return api<Paginated<MasterEntity>>(`/api/master-entities?${sp}`);
};
export const createEntity = (payload: Partial<MasterEntity>) =>
  api<MasterEntity>(`/api/master-entities`, { method: "POST", body: JSON.stringify(payload) });
export const updateEntity = (id: number, payload: Partial<MasterEntity>) =>
  api<MasterEntity>(`/api/master-entities/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteEntity = (id: number) =>
  api<{ message: string }>(`/api/master-entities/${id}`, { method: "DELETE" });
