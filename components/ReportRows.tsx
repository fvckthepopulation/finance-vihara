"use client";

import { ReactNode, SelectHTMLAttributes } from "react";

// ============================================================================
// Baris laporan ala mockup vihara-finance.html (lapTitle / lapHeader / lapRow /
// row3k) — dipakai bersama oleh /laporan (ISAK 35) dan /konsolidasi.
// ============================================================================

export const fmtRp = (n: number) =>
  (n < 0 ? "-" : "") + "Rp " + Math.round(Math.abs(n)).toLocaleString("id-ID");

// Warna nilai — tone eksplisit; default: merah bila negatif (ala mockup lapRow).
export type Tone = "green" | "red" | "accent" | "amber" | "muted";
export const TONE_VAR: Record<Tone, string> = {
  green: "var(--km-green)",
  red: "var(--km-red)",
  accent: "var(--km-accent)",
  amber: "var(--km-amber)",
  muted: "var(--km-ink-muted)",
};
export function valueColor(value: number | null, tone?: Tone): string {
  if (value !== null && value < 0) return TONE_VAR.red;
  return tone ? TONE_VAR[tone] : "var(--km-ink)";
}

/** Select kecil untuk topbar actions (period selector). */
export function TopbarSelect({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-lg border border-km-border-strong bg-km-panel px-2 py-1.5 text-[12px] text-km-ink ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function LapTitle({ org, jenis, periode }: { org: string; jenis: string; periode: string }) {
  return (
    <div className="mb-1 border-b-2 border-km-border pb-5 pt-4 text-center">
      <div className="text-[14px] font-bold tracking-tight text-km-ink">{org}</div>
      <div className="mt-1 text-[13px] font-semibold text-km-ink-soft">{jenis}</div>
      <div className="mt-0.5 text-[11px] text-km-ink-muted">{periode}</div>
    </div>
  );
}

export function LapHeader({ children }: { children: ReactNode }) {
  return (
    <div className="bg-km-bg px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[.07em] text-km-ink-muted">
      {children}
    </div>
  );
}

export function LapRow({
  code,
  label,
  value,
  indent = 0,
  isTotal = false,
  bold = false,
  tone,
  labelMuted = false,
  labelColor,
  note,
}: {
  code?: string;
  label: string;
  value: number | null;
  indent?: number;
  isTotal?: boolean;
  bold?: boolean;
  tone?: Tone;
  labelMuted?: boolean;
  /** Warna label eksplisit — mis. warna vihara pada laporan konsolidasi. */
  labelColor?: string;
  note?: ReactNode;
}) {
  const heavy = bold || isTotal;
  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 px-4 py-1.5 ${
          isTotal
            ? "border-b border-km-border border-t-[1.5px] bg-[#F8F7F2]"
            : "border-b border-km-border/40"
        }`}
        style={{ paddingLeft: 16 + indent * 16 }}
      >
        <span
          className={`text-[12px] ${heavy ? "font-semibold" : ""} ${
            labelMuted ? "text-km-ink-muted" : "text-km-ink-soft"
          }`}
          style={labelColor ? { color: labelColor } : undefined}
        >
          {code && <span className="font-mono">{code}</span>}
          {code && " · "}
          {label}
        </span>
        <span
          className={`whitespace-nowrap font-mono text-[12px] tabular-nums ${heavy ? "font-semibold" : ""}`}
          style={{ color: value === null ? TONE_VAR.muted : valueColor(value, tone) }}
        >
          {value === null ? "—" : fmtRp(value)}
        </span>
      </div>
      {note}
    </>
  );
}

// Baris 3 kolom (Tanpa Pembatasan / Dengan Pembatasan / Total).
export function Row3({
  code,
  label,
  tp,
  dp,
  total,
  indent = 0,
  isTotal = false,
  bold = false,
  tone,
  labelMuted = false,
  labelColor,
}: {
  code?: string;
  label: string;
  tp: number | null;
  dp: number | null;
  total: number | null;
  indent?: number;
  isTotal?: boolean;
  bold?: boolean;
  tone?: Tone;
  labelMuted?: boolean;
  /** Warna label eksplisit — mis. warna vihara pada laporan konsolidasi. */
  labelColor?: string;
}) {
  const heavy = bold || isTotal;
  const numCell = (v: number | null, pr = "pr-3") => (
    <td
      className={`whitespace-nowrap py-1.5 ${pr} text-right font-mono text-[12px] tabular-nums ${
        heavy ? "font-semibold" : ""
      }`}
      style={{ color: v === null ? TONE_VAR.muted : valueColor(v, tone) }}
    >
      {v === null ? "—" : fmtRp(v)}
    </td>
  );
  return (
    <tr
      className={
        isTotal
          ? "border-b border-km-border border-t-[1.5px] bg-[#F8F7F2]"
          : "border-b border-km-border/40"
      }
    >
      <td
        className={`py-1.5 pr-3 text-[12px] ${heavy ? "font-semibold" : ""} ${
          labelMuted ? "text-km-ink-muted" : "text-km-ink-soft"
        }`}
        style={{ paddingLeft: 16 + indent * 16, ...(labelColor ? { color: labelColor } : {}) }}
      >
        {code && <span className="font-mono">{code}</span>}
        {code && " · "}
        {label}
      </td>
      {numCell(tp)}
      {numCell(dp)}
      {numCell(total, "pr-4")}
    </tr>
  );
}

export function Hdr3({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td
        colSpan={4}
        className="bg-km-bg px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[.07em] text-km-ink-muted"
      >
        {children}
      </td>
    </tr>
  );
}

export function Table3Head() {
  return (
    <thead>
      <tr>
        <th className="px-4 py-2 text-left text-[11px] font-semibold text-km-ink-muted">Uraian</th>
        <th className="py-2 pr-3 text-right text-[11px] font-semibold text-km-ink-muted">
          Tanpa Pembatasan
        </th>
        <th className="py-2 pr-3 text-right text-[11px] font-semibold text-km-ink-muted">
          Dengan Pembatasan
        </th>
        <th className="py-2 pr-4 text-right text-[11px] font-semibold text-km-ink-muted">Total</th>
      </tr>
    </thead>
  );
}
