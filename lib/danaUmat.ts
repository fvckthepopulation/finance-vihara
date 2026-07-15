import { api } from "./api";

// Penerimaan Dana Umat — rincian penerimaan per kategori dana (/api/dana-umat).
// API selalu mengembalikan 4 kategori dengan urutan:
// dana_perayaan, dana_operasional, dana_bhikkhu, dana_paramita.

export type DanaUmatRow = {
  id: number;
  date: string;
  name: string;
  donor: string | null;
  received_by: string | null;
  method: string;
  source: "km" | "manual";
  description: string | null;
  amount: number | string;
};

export type DanaUmatCategory = {
  category: string;
  label: string;
  count: number;
  total: number | string;
  rows: DanaUmatRow[];
};

export type DanaUmatResponse = {
  period: { mode: "ytd" | "bulan"; year: number; month: number | null };
  categories: DanaUmatCategory[];
};

export function getDanaUmat(params: {
  mode: "ytd" | "bulan";
  year: number;
  month?: number;
  vihara_id?: number | null;
}): Promise<DanaUmatResponse> {
  const sp = new URLSearchParams({ mode: params.mode, year: String(params.year) });
  if (params.mode === "bulan" && params.month) sp.set("month", String(params.month));
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  return api<DanaUmatResponse>(`/api/dana-umat?${sp}`);
}
