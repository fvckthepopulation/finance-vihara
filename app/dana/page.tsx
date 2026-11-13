"use client";

import { SelectHTMLAttributes, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag } from "@/components/DanaTag";
import { DanaUmatCategory, DanaUmatResponse, getDanaUmat } from "@/lib/danaUmat";
import { useVihara } from "@/lib/useVihara";

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Konfigurasi tab per mockup .dana-tabs-wrap (urutan sesuai API).
const TABS: { category: string; emoji: string; label: string; color: string }[] = [
  { category: "dana_perayaan", emoji: "🏮", label: "Dana Perayaan", color: "#B85C00" },
  { category: "dana_operasional", emoji: "☸", label: "Dana Operasional", color: "#1A4A7A" },
  { category: "dana_bhikkhu", emoji: "☸", label: "Dana Bhikkhu", color: "#5B3E8C" },
  { category: "dana_paramita", emoji: "🤲", label: "Dana Paramita", color: "#1A6B4A" },
];

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

export default function DanaPage() {
  const now = new Date();
  const [mode, setMode] = useState<"ytd" | "bulan">("ytd");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState("dana_perayaan");
  const [data, setData] = useState<DanaUmatResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { viharaId, ready: viharaReady } = useVihara();

  useEffect(() => {
    if (!viharaReady) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getDanaUmat({ mode, year, month, vihara_id: viharaId })
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

  const byCategory = new Map<string, DanaUmatCategory>(
    (data?.categories ?? []).map((c) => [c.category, c]),
  );
  const activeConfig = TABS.find((t) => t.category === activeTab) ?? TABS[0];
  const active = byCategory.get(activeConfig.category);

  return (
    <AppShell
      title="Penerimaan Dana Umat"
      subtitle="Rincian penerimaan per kategori dana"
      actions={periodSelector}
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
          {error}
        </p>
      )}

      <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <CardHeader
          title="Penerimaan Dana Umat"
          subtitle="Rincian penerimaan per kategori dana"
        />

        {/* Pill tab bar — 4 tab sama lebar (mockup .dana-tabs-wrap) */}
        <div className="grid grid-cols-2 border-b-2 border-km-border sm:grid-cols-4">
          {TABS.map((t) => {
            const cat = byCategory.get(t.category);
            const isActive = t.category === activeTab;
            return (
              <button
                key={t.category}
                type="button"
                onClick={() => setActiveTab(t.category)}
                className={`-mb-0.5 px-3 py-3.5 text-center text-[12px] font-semibold transition ${
                  isActive
                    ? "bg-km-panel"
                    : "bg-km-bg text-km-ink-muted hover:bg-km-panel hover:text-km-ink"
                }`}
                style={
                  isActive
                    ? { color: t.color, borderBottom: `3px solid ${t.color}` }
                    : { borderBottom: "3px solid transparent" }
                }
              >
                <span className="block">
                  {t.emoji} {t.label}
                </span>
                <span className="mt-0.5 block text-[10px] font-medium opacity-70">
                  {cat ? `${cat.count} transaksi | ${fmtRp(cat.total)}` : "— transaksi"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 border-b border-km-border px-4 py-3">
          <div className="min-w-[120px] flex-1">
            <div className="text-[11px] text-km-ink-muted">Total Penerimaan</div>
            <div className="text-[18px] font-medium tabular-nums text-km-green">
              {fmtRp(active?.total ?? 0)}
            </div>
          </div>
          <div className="min-w-[120px] flex-1">
            <div className="text-[11px] text-km-ink-muted">Jumlah Transaksi</div>
            <div className="text-[18px] font-medium tabular-nums text-km-ink">
              {active?.count ?? 0}
            </div>
          </div>
        </div>

        {/* Tabel per tab */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                <Th>Tanggal</Th>
                <Th>Donatur / Sumber</Th>
                <Th>Diterima oleh</Th>
                <Th>Kategori Dana</Th>
                <Th>Catatan</Th>
                <Th className="text-right">Jumlah</Th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : !active || active.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-km-ink-muted">
                    Belum ada penerimaan {activeConfig.label}
                  </td>
                </tr>
              ) : (
                active.rows.map((r) => (
                  <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft">
                    <Td className="whitespace-nowrap">{r.date.slice(0, 10)}</Td>
                    <Td>{r.donor || r.name}</Td>
                    <Td>{r.received_by ?? "—"}</Td>
                    <Td>
                      <DanaTag category={activeConfig.category} />
                    </Td>
                    <Td className="max-w-[220px] truncate text-km-ink-muted">
                      {r.description ?? "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums font-medium text-km-green">
                      {fmtRp(r.amount)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10.5px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle text-km-ink ${className}`}>{children}</td>;
}
