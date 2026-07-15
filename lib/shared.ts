import { api } from "./api";

// Helper & tipe master data yang dipakai lintas modul (kas, petty cash,
// laporan). Dulu tinggal di lib/invoices.ts (modul AP marketplace) — modul
// itu sudah dihapus, helper generiknya dipindah ke sini.

export type Entity = {
  id: number;
  code: string;
  legal_name: string;
};

export type AccountRef = {
  id: number;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent_code?: string | null;
  is_header?: boolean;
};

export const getEntities = () => api<Entity[]>("/api/masters/entities");

export const getAccounts = (
  params: { type?: string; q?: string; include_headers?: boolean } = {},
) => {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.q) sp.set("q", params.q);
  if (params.include_headers) sp.set("include_headers", "1");
  return api<AccountRef[]>(`/api/masters/accounts${sp.toString() ? `?${sp}` : ""}`);
};

export function formatIDR(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}
