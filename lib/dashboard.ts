import { api } from "./api";

export type ChannelSummary = { total: number; count: number };

export type DashboardCategory = {
  category: string;
  label: string;
  count: number;
  total: number;
};

export type DashboardDana = { dana: string; count: number; total: number };

export type DashboardSummary = {
  period: { mode: "ytd" | "bulan"; year: number; month: number | null };
  penerimaan: {
    total: number;
    count: number;
    by_channel: {
      platform: ChannelSummary; // method = auto_credit (jalur KalyanaMitta, Phase 7)
      transfer: ChannelSummary;
      tunai: ChannelSummary;
    };
    by_category: DashboardCategory[];
    suspense: ChannelSummary; // donasi belum teridentifikasi (2310) — belum diakui pendapatan
  };
  pengeluaran: {
    total: number;
    count: number;
    by_dana: DashboardDana[];
  };
};

export const getDashboardSummary = (
  params: {
    mode?: "ytd" | "bulan";
    year?: number;
    month?: number;
    vihara_id?: number | null;
  } = {},
) => {
  const sp = new URLSearchParams();
  if (params.mode) sp.set("mode", params.mode);
  if (params.year) sp.set("year", String(params.year));
  if (params.mode === "bulan" && params.month) sp.set("month", String(params.month));
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  return api<DashboardSummary>(`/api/dashboard${sp.toString() ? `?${sp}` : ""}`);
};
