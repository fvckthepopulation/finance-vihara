"use client";

import Link from "next/link";
import { SelectHTMLAttributes, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DashboardSummary, getDashboardSummary } from "@/lib/dashboard";
import { useVihara } from "@/lib/useVihara";

const fmtRp = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Warna dot + nominal per kategori/debet dana — mengikuti mockup.
const DANA_COLORS: Record<string, string> = {
  "Dana Perayaan": "#B85C00",
  "Dana Operasional": "#1A5C8A",
  "Dana Bhikkhu": "#5B3E8C",
  "Dana Paramita": "#1A6B40",
};
const danaColor = (name: string) =>
  DANA_COLORS[name] ?? (name === "Lainnya" ? "var(--km-ink-muted)" : "var(--km-accent)");

// Select kecil untuk topbar — meniru gaya input app (Field) tapi tidak w-full.
function TopbarSelect({
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

// Sub-kotak jalur penerimaan (Platform / Transfer / Tunai) di kartu Total Penerimaan.
function ChannelBox({
  icon,
  label,
  sub,
  amount,
  gradient,
  border,
  color,
  subColor,
}: {
  icon: string;
  label: string;
  sub: string;
  amount: number;
  gradient: string;
  border: string;
  color: string;
  subColor?: string;
}) {
  return (
    <div
      className="rounded-lg px-2.5 py-[9px]"
      style={{ background: gradient, border: `1px solid ${border}` }}
    >
      <div className="mb-[5px] flex items-center gap-[5px]">
        <span className="text-[13px] leading-none">{icon}</span>
        <div className="text-[10px] font-semibold leading-tight" style={{ color }}>
          {label}
        </div>
      </div>
      <div
        className="mb-1 min-h-3.5 text-[10px] leading-snug"
        style={{ color: subColor ?? color }}
      >
        {sub}
      </div>
      <div className="text-[14px] font-bold tabular-nums" style={{ color }}>
        {fmtRp(amount)}
      </div>
    </div>
  );
}

// Baris breakdown: dot warna + label + jumlah tx + persen + nominal.
function BreakdownRows({
  rows,
}: {
  rows: { key: string; label: string; count: number; total: number }[];
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[12px] text-km-ink-muted">
        Belum ada data untuk periode ini
      </div>
    );
  }
  const grand = rows.reduce((a, r) => a + r.total, 0);
  return (
    <div className="py-2">
      {rows.map((r) => {
        const color = danaColor(r.label);
        const pct = grand ? Math.round((r.total / grand) * 100) : 0;
        return (
          <div
            key={r.key}
            className="flex items-center gap-3 border-b border-[#E4E1D8] px-4 py-2"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: color }}
            />
            <span className="flex-1 text-[12px] text-km-ink-soft">{r.label}</span>
            <span className="text-[11px] text-km-ink-muted">{r.count} tx</span>
            <span className="min-w-[34px] text-right text-[11px] tabular-nums text-km-ink-muted">
              {pct}%
            </span>
            <span
              className="min-w-[100px] text-right text-[13px] font-semibold tabular-nums"
              style={{ color }}
            >
              {fmtRp(r.total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DetailButton() {
  return (
    <Link href="/riwayat">
      <Button variant="ghost" size="sm" className="text-[12px]">
        Detail
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-[13px] w-[13px]"
        >
          <path d="M2 8h12M8 3l5 5-5 5" />
        </svg>
      </Button>
    </Link>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const [mode, setMode] = useState<"ytd" | "bulan">("ytd");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { viharaId, ready: viharaReady } = useVihara();

  useEffect(() => {
    if (!viharaReady) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getDashboardSummary({ mode, year, month, vihara_id: viharaId })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Gagal memuat");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, year, month, viharaId, viharaReady]);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const periodSelector = (
    <div className="flex items-center gap-1.5">
      <TopbarSelect
        value={mode}
        onChange={(e) => setMode(e.target.value as "ytd" | "bulan")}
        className="max-w-[110px]"
        aria-label="Mode periode"
      >
        <option value="ytd">YTD</option>
        <option value="bulan">Per Bulan</option>
      </TopbarSelect>
      <TopbarSelect
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="max-w-[90px]"
        aria-label="Tahun"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </TopbarSelect>
      {mode === "bulan" && (
        <TopbarSelect
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="max-w-[105px]"
          aria-label="Bulan"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </TopbarSelect>
      )}
    </div>
  );

  const masuk = data?.penerimaan;
  const keluar = data?.pengeluaran;
  const ch = masuk?.by_channel;

  return (
    <AppShell
      title="Dashboard"
      subtitle="Ringkasan keuangan vihara"
      actions={periodSelector}
    >
      {error && (
        <div className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-4 py-3 text-[12px] text-km-red-ink">
          {error}
        </div>
      )}

      {!data && !error ? (
        <div className="py-16 text-center text-[12px] text-km-ink-muted">
          Memuat ringkasan…
        </div>
      ) : data ? (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* Baris utama: Total Penerimaan (kiri) + Total Pengeluaran (kanan) */}
          <div className="grid gap-2.5 md:grid-cols-2">
            {/* Total Penerimaan + 3 sub-kotak jalur */}
            <div className="rounded-lg border border-[#A3CDB8] bg-km-panel px-4 py-3.5">
              <div className="mb-2.5 flex items-baseline justify-between border-b border-[#D0EAD8] pb-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-km-ink-muted">
                    Total Penerimaan
                  </div>
                  <div className="mt-0.5 text-[26px] font-bold leading-[1.15] tabular-nums text-km-green">
                    {fmtRp(masuk?.total ?? 0)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-km-ink-muted">
                    {masuk?.count ?? 0} transaksi
                  </div>
                </div>
                <div className="text-[22px] opacity-25">↓</div>
              </div>
              <div className="grid grid-cols-3 gap-[7px]">
                <ChannelBox
                  icon="🌐"
                  label="Donasi via Platform"
                  sub={
                    (ch?.platform.count ?? 0) > 0
                      ? `${ch?.platform.count} transaksi`
                      : "Belum terhubung — Phase 7"
                  }
                  amount={ch?.platform.total ?? 0}
                  gradient="linear-gradient(160deg,#FFF3E0,#FFF8F4)"
                  border="#FFCC80"
                  color="#E65100"
                  subColor="#BF360C"
                />
                <ChannelBox
                  icon="🏦"
                  label="Transfer Bank"
                  sub={(ch?.transfer.total ?? 0) > 0 ? "via rekening bank" : "Belum ada"}
                  amount={ch?.transfer.total ?? 0}
                  gradient="linear-gradient(160deg,#E8F0F8,#F0F5FC)"
                  border="#A9C4E0"
                  color="#1A4A7A"
                />
                <ChannelBox
                  icon="💵"
                  label="Tunai Langsung"
                  sub={(ch?.tunai.total ?? 0) > 0 ? "diterima langsung" : "Belum ada"}
                  amount={ch?.tunai.total ?? 0}
                  gradient="linear-gradient(160deg,#E6F5EE,#F0FAF5)"
                  border="#A3CDB8"
                  color="#1A6B4A"
                />
              </div>
            </div>

            {/* Total Pengeluaran */}
            <div className="flex flex-col justify-between rounded-lg border border-[#F4A9A8] bg-km-panel px-4 py-3.5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-km-ink-muted">
                  Total Pengeluaran
                </div>
                <div className="mt-0.5 text-[26px] font-bold leading-[1.15] tabular-nums text-km-red">
                  {fmtRp(keluar?.total ?? 0)}
                </div>
                <div className="mt-0.5 text-[11px] text-km-ink-muted">
                  {keluar?.count ?? 0} transaksi
                </div>
              </div>
            </div>
          </div>

          {/* Baris kedua: breakdown per kategori / debet dana */}
          <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
            <Card>
              <CardHeader
                title="Penerimaan per Kategori Dana"
                subtitle={`${masuk?.by_category.length ?? 0} kategori · ${masuk?.count ?? 0} transaksi`}
                right={<DetailButton />}
              />
              <BreakdownRows
                rows={(masuk?.by_category ?? []).map((c) => ({
                  key: c.category,
                  label: c.label,
                  count: c.count,
                  total: c.total,
                }))}
              />
            </Card>

            <Card>
              <CardHeader
                title="Pengeluaran per Debet Dana"
                subtitle={`${keluar?.by_dana.length ?? 0} dana · ${keluar?.count ?? 0} transaksi`}
                right={<DetailButton />}
              />
              <BreakdownRows
                rows={(keluar?.by_dana ?? []).map((d) => ({
                  key: d.dana,
                  label: d.dana,
                  count: d.count,
                  total: d.total,
                }))}
              />
            </Card>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
