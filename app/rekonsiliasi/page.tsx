"use client";

import { SelectHTMLAttributes, FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field, Input, Select } from "@/components/Field";
import { Toast } from "@/components/Toast";
import { num } from "@/lib/kasBank";
import { KmLink } from "@/components/KmLink";
import {
  PgClearingData,
  PgClearingPending,
  ReconciliationSummary,
  SuspenseItem,
  SuspenseData,
  createOrOpenRun,
  getPgClearing,
  getReconciliationSummary,
  getSuspense,
  reklasifikasiPenerimaan,
} from "@/lib/reconciliation";
import { listTransactionNames, TransactionName } from "@/lib/transactionNames";
import { useVihara } from "@/lib/useVihara";

const fmtRp = (n: string | number | null | undefined) =>
  "Rp " + Math.round(num(n)).toLocaleString("id-ID");
const fmtTgl = (iso: string) =>
  new Date(iso.slice(0, 10)).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

/** Baris pending yang masih di gateway (status absen → dianggap Escrow). */
const isEscrow = (p: PgClearingPending) => (p.status ?? "Escrow") !== "Settled";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Kategori reklasifikasi — label persis enum API (Penerimaan::CATEGORIES).
const REKLAS_CATEGORIES: { key: string; label: string }[] = [
  { key: "dana_operasional", label: "Dana Operasional (Tanpa Pembatasan)" },
  { key: "dana_paramita", label: "Dana Paramita (Tanpa Pembatasan)" },
  { key: "dana_bhikkhu", label: "Dana Bhikkhu (Dengan Pembatasan)" },
  { key: "dana_perayaan", label: "Dana Perayaan (Dengan Pembatasan)" },
];

type TabKey = "pg" | "bank" | "suspense";

function TopbarSelect({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-lg border border-km-border-strong bg-km-panel px-2 py-1.5 text-[12px] text-km-ink ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

function StatusBadge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span
      className="rounded px-2 py-[3px] text-[10px] font-semibold"
      style={{ background: bg, color }}
    >
      {text}
    </span>
  );
}

function InfoAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-km-blue-soft bg-km-blue-soft px-3 py-2.5 text-[11px] leading-relaxed text-km-blue-ink">
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-[12.5px] transition ${
        active
          ? "border-km-accent font-semibold text-km-accent"
          : "border-transparent text-km-ink-muted hover:text-km-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function RekonsiliasiPage() {
  const router = useRouter();
  const { viharaId, fixed, ready } = useVihara();
  const needVihara = !fixed && viharaId == null;

  const now = new Date();
  const [mode, setMode] = useState<"ytd" | "bulan">("ytd");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [tab, setTab] = useState<TabKey>("pg");
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [pg, setPg] = useState<PgClearingData | null>(null);
  const [susp, setSusp] = useState<SuspenseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reklasItem, setReklasItem] = useState<SuspenseItem | null>(null);
  const [openingBank, setOpeningBank] = useState<number | null>(null);

  const loadSummary = useCallback(() => {
    if (!ready) return;
    getReconciliationSummary(viharaId)
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat rekonsiliasi"));
  }, [viharaId, ready]);

  const loadSuspense = useCallback(() => {
    if (!ready) return;
    getSuspense(viharaId)
      .then(setSusp)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat suspense"));
  }, [viharaId, ready]);

  useEffect(() => {
    setError(null);
    loadSummary();
    loadSuspense();
  }, [loadSummary, loadSuspense]);

  useEffect(() => {
    if (!ready) return;
    getPgClearing({ mode, year, month, vihara_id: viharaId })
      .then(setPg)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat PG clearing"));
  }, [mode, year, month, viharaId, ready]);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const periodSelector = (
    <div className="flex items-center gap-1.5">
      <TopbarSelect value={mode} onChange={(e) => setMode(e.target.value as "ytd" | "bulan")} className="max-w-[110px]" aria-label="Mode periode">
        <option value="ytd">YTD</option>
        <option value="bulan">Per Bulan</option>
      </TopbarSelect>
      <TopbarSelect value={year} onChange={(e) => setYear(Number(e.target.value))} className="max-w-[90px]" aria-label="Tahun">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </TopbarSelect>
      {mode === "bulan" && (
        <TopbarSelect value={month} onChange={(e) => setMonth(Number(e.target.value))} className="max-w-[105px]" aria-label="Bulan">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </TopbarSelect>
      )}
    </div>
  );

  // ── Derivasi kartu ringkasan ──
  const banks = summary?.banks ?? [];
  const bankNames = [...new Set(banks.map((b) => b.bank_label.split(" ")[0]))].join(" & ") || "—";
  const anyInProgress = banks.some((b) => b.last_run_status === "in_progress");
  const anyCompleted = banks.some((b) => b.last_run_status === "completed");
  const bankBadge = anyInProgress
    ? { text: "PROSES", bg: "var(--km-amber-soft)", color: "var(--km-amber)" }
    : anyCompleted
      ? { text: "SELESAI", bg: "var(--km-green-soft)", color: "var(--km-green)" }
      : { text: "BELUM", bg: "var(--km-bg)", color: "var(--km-ink-muted)" };
  const bankSub = anyInProgress
    ? "Ada rekonsiliasi yang sedang berjalan"
    : anyCompleted
      ? "Rekonsiliasi terakhir sudah diselesaikan"
      : "Rekonsiliasi bank belum dilakukan periode ini";

  const pgEscrow = (pg?.pending ?? []).filter(isEscrow);
  const pgPendingCount = pgEscrow.length;
  const pgPendingTotal = pgEscrow.reduce((a, p) => a + num(p.amount), 0);
  const pgBadge = pgPendingCount > 0
    ? { text: `${pgPendingCount} PENDING`, bg: "var(--km-amber-soft)", color: "var(--km-amber)" }
    : { text: "LUNAS", bg: "var(--km-green-soft)", color: "var(--km-green)" };
  const pgSub = pgPendingCount > 0
    ? `${fmtRp(pgPendingTotal)} masih di gateway (belum masuk bank)`
    : "Semua donasi KM sudah settle ke bank";

  const suspCount = susp?.count ?? 0;
  const suspBadge = suspCount > 0
    ? { text: `${suspCount} ITEM`, bg: "#FCEBEB", color: "var(--km-red)" }
    : { text: "BERSIH", bg: "var(--km-green-soft)", color: "var(--km-green)" };
  const suspSub = suspCount > 0
    ? `${fmtRp(susp?.total)} menunggu identifikasi donatur/program`
    : "Tidak ada dana yang perlu diidentifikasi";

  async function openRun(bankAccountId: number) {
    setOpeningBank(bankAccountId);
    setError(null);
    try {
      const runId = await createOrOpenRun(bankAccountId);
      router.push(`/rekonsiliasi/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memulai rekonsiliasi");
      setOpeningBank(null);
    }
  }

  return (
    <AppShell
      title="Rekonsiliasi"
      subtitle="PG Clearing KalyanaMitta, rekening bank, dan dana belum teridentifikasi"
      actions={periodSelector}
    >
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">{error}</p>
      )}

      {/* ── 3 kartu ringkasan status ── */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[.06em] text-km-ink-muted">Rekonsiliasi Bank</p>
              <p className="mt-0.5 text-[13px] font-semibold text-km-ink">{bankNames}</p>
            </div>
            <StatusBadge {...bankBadge} />
          </div>
          <p className="mt-2 text-[11px] text-km-ink-muted">{summary ? bankSub : "Memuat…"}</p>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[.06em] text-km-ink-muted">1160 · PG Clearing</p>
              <p className="mt-0.5 text-[13px] font-semibold text-km-ink">KalyanaMitta</p>
            </div>
            <StatusBadge {...pgBadge} />
          </div>
          <p className="mt-2 text-[11px] text-km-ink-muted">{pg ? pgSub : "Memuat…"}</p>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[.06em] text-km-ink-muted">2310 · Suspense</p>
              <p className="mt-0.5 text-[13px] font-semibold text-km-ink">Dana Belum Teridentifikasi</p>
            </div>
            <StatusBadge {...suspBadge} />
          </div>
          <p className="mt-2 text-[11px] text-km-ink-muted">{susp ? suspSub : "Memuat…"}</p>
        </Card>
      </div>

      {/* ── Kartu tab ── */}
      <Card>
        <div className="flex gap-1 border-b border-km-border px-2">
          <TabBtn active={tab === "pg"} onClick={() => setTab("pg")}>PG Clearing (KM)</TabBtn>
          <TabBtn active={tab === "bank"} onClick={() => setTab("bank")}>Rekonsiliasi Bank</TabBtn>
          <TabBtn active={tab === "suspense"} onClick={() => setTab("suspense")}>Dana Belum Teridentifikasi</TabBtn>
        </div>

        {tab === "pg" && <PgTab pg={pg} />}
        {tab === "bank" && (
          <BankTab
            summary={summary}
            needVihara={needVihara}
            openingBank={openingBank}
            onOpenRun={openRun}
          />
        )}
        {tab === "suspense" && (
          <SuspenseTab
            susp={susp}
            needVihara={needVihara}
            onIdentify={setReklasItem}
          />
        )}
      </Card>

      {reklasItem && (
        <ReklasModal
          item={reklasItem}
          onClose={() => setReklasItem(null)}
          onSaved={() => {
            setReklasItem(null);
            setToast("Dana berhasil diidentifikasi dan direklasifikasi");
            loadSuspense();
            loadSummary();
          }}
        />
      )}
    </AppShell>
  );
}

// ============================================================================
// TAB 1 — PG Clearing (1160)
// ============================================================================

function PgTab({ pg }: { pg: PgClearingData | null }) {
  const saldo = num(pg?.saldo_1160);
  const settlements = pg?.settlements ?? [];
  // Saldo 1160 harus = total donasi yang MASIH escrow (baris Settled — bila
  // backend masih mengirimnya di pending — tidak lagi menahan saldo 1160).
  const pendingTotal = (pg?.pending ?? [])
    .filter(isEscrow)
    .reduce((a, p) => a + num(p.amount), 0);
  const selisih = Math.abs(saldo - pendingTotal);
  const cocok = selisih < 1;

  return (
    <div className="px-5 py-5 sm:px-6">
      <InfoAlert>
        Saldo akun <strong>1160 · Payment Gateway Clearing</strong> = donasi KM yang sudah dibayar
        donatur (status Paid/Escrow) namun belum di-settle KM ke Bank Donasi vihara. Alur:{" "}
        <strong>Dr 1160/Kr 4110-4120</strong> (paid) → <strong>Dr 7140/Kr 1160</strong> (komisi) →{" "}
        <strong>Dr 1130/Kr 1160</strong> (settle).
      </InfoAlert>

      {/* 3 stat box */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border px-3.5 py-3" style={{ background: "#FFF8F0", borderColor: "#FFCC80" }}>
          <p className="text-[10px] font-semibold uppercase" style={{ color: "#BF360C" }}>Total Donasi Masuk (Gross)</p>
          <p className="mt-1 font-mono text-[20px] font-bold tabular-nums" style={{ color: "#E65100" }}>{fmtRp(pg?.gross.total)}</p>
          <p className="mt-0.5 text-[10px]" style={{ color: "#BF360C" }}>{pg?.gross.count ?? 0} transaksi</p>
        </div>
        <div className="rounded-lg border px-3.5 py-3" style={{ background: "#FCEBEB", borderColor: "#F4A9A8" }}>
          <p className="text-[10px] font-semibold uppercase" style={{ color: "#A32D2D" }}>Komisi KM Dipotong</p>
          <p className="mt-1 font-mono text-[20px] font-bold tabular-nums" style={{ color: "#A32D2D" }}>{fmtRp(pg?.komisi.total)}</p>
          <p className="mt-0.5 text-[10px]" style={{ color: "#A32D2D" }}>{pg?.komisi.count ?? 0} batch</p>
        </div>
        <div data-testid="pg-settled-box" className="rounded-lg border px-3.5 py-3" style={{ background: "#E8F5EE", borderColor: "#A3CDB8" }}>
          <p className="text-[10px] font-semibold uppercase" style={{ color: "#1A6B4A" }}>Sudah Settle ke Bank</p>
          <p data-testid="pg-settled-total" className="mt-1 font-mono text-[20px] font-bold tabular-nums" style={{ color: "#1A6B4A" }}>{fmtRp(pg?.settled.total)}</p>
          <p className="mt-0.5 text-[10px]" style={{ color: "#1A6B4A" }}>{pg?.settled.count ?? 0} transaksi</p>
        </div>
      </div>

      {/* Saldo 1160 */}
      <div className="mb-5 rounded-lg border border-km-border bg-km-bg px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-km-ink">Saldo Akun 1160 (Saat Ini)</p>
            <p className="mt-0.5 text-[11px] text-km-ink-muted">
              Gross − Komisi − Settled = Saldo PG Clearing (harus = total Pending/Escrow)
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[24px] font-bold tabular-nums text-km-amber">{fmtRp(saldo)}</p>
            <p className="mt-0.5 text-[11px]">
              {cocok ? (
                <span className="text-km-green">✓ Cocok dengan total Pending/Escrow</span>
              ) : (
                <span className="text-km-red">⚠ Selisih {fmtRp(selisih)} dari Pending/Escrow ({fmtRp(pendingTotal)})</span>
              )}
            </p>
          </div>
        </div>
        {pg && pg.settled.count === 0 && settlements.length === 0 && (
          <p className="mt-2 border-t border-km-border pt-2 text-[10.5px] text-km-ink-muted">
            Belum ada settlement dari KalyanaMitta
          </p>
        )}
      </div>

      {/* Tabel pending */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-km-ink-soft">Rincian Donasi Pending / Escrow (belum settle)</p>
        <span className="text-[12px] font-semibold text-km-amber">
          {pgPendingLabel(pg)}
        </span>
      </div>
      <div className="max-h-[280px] overflow-y-auto rounded-lg border border-km-border">
        <table className="w-full text-[12px]">
          <thead className="bg-km-panel-soft">
            <tr>
              <Th>Tanggal</Th><Th>Referensi</Th><Th>Donatur</Th><Th>Dana</Th>
              <Th className="text-right">Jumlah</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {!pg || pg.pending.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-km-ink-muted">
                  {pg ? "Semua donasi KM sudah settle ke bank ✓" : "Memuat…"}
                </td>
              </tr>
            ) : (
              pg.pending.map((p) => {
                const escrow = isEscrow(p);
                return (
                  <tr key={p.id} data-testid="pg-pending-row" className="border-t border-km-border hover:bg-km-panel-soft">
                    <Td className="whitespace-nowrap">{fmtTgl(p.date)}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px]">{p.reference}</span>
                        {p.km_ref && <KmLink refCode={p.km_ref} />}
                      </div>
                      {p.km_ref && p.km_ref !== p.reference && (
                        <div className="mt-0.5 font-mono text-[10px] text-km-ink-muted">{p.km_ref}</div>
                      )}
                    </Td>
                    <Td>{p.donor}</Td>
                    <Td>{p.category_label}</Td>
                    <Td className="whitespace-nowrap text-right font-mono font-semibold tabular-nums">{fmtRp(p.amount)}</Td>
                    <Td>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={
                          escrow
                            ? { background: "var(--km-amber-soft)", color: "var(--km-amber)" }
                            : { background: "var(--km-green-soft)", color: "var(--km-green)" }
                        }
                      >
                        {escrow ? "Escrow" : "Settled"}
                      </span>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Riwayat settlement KM → Bank Donasi (Phase 7) */}
      <div className="mb-2 mt-5 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-km-ink-soft">Riwayat Settlement KalyanaMitta</p>
        {settlements.length > 0 && (
          <span className="text-[12px] font-semibold text-km-green">{settlements.length} settlement</span>
        )}
      </div>
      <div className="max-h-[280px] overflow-y-auto rounded-lg border border-km-border">
        <table className="w-full text-[12px]">
          <thead className="bg-km-panel-soft">
            <tr>
              <Th>Tanggal</Th><Th>Ref</Th><Th>Donasi</Th>
              <Th className="text-right">Gross</Th><Th className="text-right">Komisi</Th>
              <Th className="text-right">Net</Th><Th>Bank</Th><Th />
            </tr>
          </thead>
          <tbody>
            {settlements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-km-ink-muted">
                  {pg ? "Belum ada settlement" : "Memuat…"}
                </td>
              </tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id} data-testid="pg-settlement-row" className="border-t border-km-border hover:bg-km-panel-soft">
                  <Td className="whitespace-nowrap">{fmtTgl(s.date)}</Td>
                  <Td className="whitespace-nowrap font-mono text-[10px]">{s.ref}</Td>
                  <Td className="whitespace-nowrap">{s.donation_count} donasi</Td>
                  <Td className="whitespace-nowrap text-right font-mono tabular-nums">{fmtRp(s.gross)}</Td>
                  <Td className="whitespace-nowrap text-right font-mono tabular-nums text-km-red">{fmtRp(s.komisi)}</Td>
                  <Td className="whitespace-nowrap text-right font-mono font-semibold tabular-nums text-km-green">{fmtRp(s.net)}</Td>
                  <Td>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--km-bg)", color: "var(--km-ink-muted)" }}>
                      {s.bank_label}
                    </span>
                  </Td>
                  <Td><KmLink refCode={s.ref} /></Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pgPendingLabel(pg: PgClearingData | null): string {
  if (!pg) return "";
  const total = pg.pending.reduce((a, p) => a + num(p.amount), 0);
  return `${pg.pending.length} transaksi · ${fmtRp(total)}`;
}

// ============================================================================
// TAB 2 — Rekonsiliasi Bank
// ============================================================================

function BankTab({
  summary,
  needVihara,
  openingBank,
  onOpenRun,
}: {
  summary: ReconciliationSummary | null;
  needVihara: boolean;
  openingBank: number | null;
  onOpenRun: (bankAccountId: number) => void;
}) {
  const banks = summary?.banks ?? [];
  const runs = summary?.runs ?? [];

  return (
    <div className="px-5 py-5 sm:px-6">
      <InfoAlert>
        Bandingkan saldo buku (dari transaksi tercatat) dengan saldo rekening koran bank. Gunakan tombol{" "}
        <strong>Rekonsiliasi</strong> untuk mencocokkan item satu per satu.
      </InfoAlert>

      {needVihara && (
        <p className="mb-3 text-[11px] font-medium text-km-amber-ink">
          Pilih vihara dulu di header untuk memulai rekonsiliasi.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {banks.map((b) => {
          // Saldo rekening koran terakhir = closing balance run completed terbaru.
          const completed = runs
            .filter((r) => r.bank_account_id === b.bank_account_id && r.status === "completed")
            .sort((x, y) => y.period_month.localeCompare(x.period_month));
          const lastCompleted = completed[0] ?? null;
          const koran = lastCompleted ? num(lastCompleted.bank_closing_balance) : null;
          const buku = num(b.saldo_buku);
          const selisih = koran != null ? koran - buku : null;
          const cocok = selisih != null && Math.abs(selisih) < 1;

          return (
            <div
              key={b.bank_account_id}
              data-testid="bank-rekon-card"
              className="rounded-lg border border-km-border bg-km-bg px-4 py-3.5"
            >
              <p className="text-[13px] font-semibold text-km-ink">{b.bank_label}</p>
              <div className="mt-3 flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-km-ink-muted">Saldo Buku</p>
                  <p className="font-mono text-[16px] font-semibold tabular-nums text-km-ink">{fmtRp(buku)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-km-ink-muted">Rekening Koran</p>
                  <p className="font-mono text-[16px] font-semibold tabular-nums text-km-ink">
                    {koran != null ? fmtRp(koran) : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-2 border-t border-km-border pt-2 text-[11px]">
                {koran == null ? (
                  <span className="text-km-ink-muted">Rekonsiliasi belum dilakukan</span>
                ) : cocok ? (
                  <span className="text-km-green">✓ Cocok dengan rekening koran</span>
                ) : (
                  <span className="text-km-red">⚠ Selisih {fmtRp(Math.abs(selisih ?? 0))}</span>
                )}
                {b.last_completed_month && (
                  <span className="ml-1 text-km-ink-muted">· terakhir {b.last_completed_month}</span>
                )}
              </p>
              <Button
                className="mt-2.5 w-full justify-center text-[11px]"
                disabled={needVihara || openingBank === b.bank_account_id}
                onClick={() => onOpenRun(b.bank_account_id)}
              >
                {openingBank === b.bank_account_id ? "Membuka…" : "Rekonsiliasi Sekarang"}
              </Button>
            </div>
          );
        })}
        {summary && banks.length === 0 && (
          <p className="py-6 text-center text-[12px] text-km-ink-muted sm:col-span-2">
            Belum ada rekening bank — tambahkan di Admin → Vihara.
          </p>
        )}
        {!summary && <p className="py-6 text-center text-[12px] text-km-ink-muted sm:col-span-2">Memuat…</p>}
      </div>
    </div>
  );
}

// ============================================================================
// TAB 3 — Dana Belum Teridentifikasi (2310)
// ============================================================================

function SuspenseTab({
  susp,
  needVihara,
  onIdentify,
}: {
  susp: SuspenseData | null;
  needVihara: boolean;
  onIdentify: (item: SuspenseItem) => void;
}) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <InfoAlert>
        Dana masuk ke Bank Donasi yang belum jelas donatur/programnya dicatat sementara di akun{" "}
        <strong>2310 · Dana Donasi Belum Teridentifikasi</strong> (Dr 1130 / Kr 2310) —{" "}
        <em>belum diakui sebagai pendapatan</em>. Setelah donatur &amp; program dikonfirmasi,
        reklasifikasi ke akun donasi yang sesuai (Dr 2310 / Kr 4xxx).
      </InfoAlert>

      {needVihara && (
        <p className="mb-3 text-[11px] font-medium text-km-amber-ink">
          Pilih vihara dulu di header untuk mengidentifikasi dana.
        </p>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-km-ink-soft">Daftar Transaksi Belum Teridentifikasi</p>
        <span className="text-[12px] font-semibold text-km-red">
          {susp ? `${susp.count} transaksi · ${fmtRp(susp.total)}` : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-km-border">
        {!susp ? (
          <p className="px-4 py-6 text-center text-[12px] text-km-ink-muted">Memuat…</p>
        ) : susp.items.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-km-ink-muted">
            Tidak ada dana belum teridentifikasi periode ini ✓
          </p>
        ) : (
          susp.items.map((t) => (
            <div
              key={t.id}
              data-testid="suspense-row"
              className="flex items-center justify-between border-b border-km-border px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "#FCEBEB", color: "var(--km-red)" }}>
                    2310
                  </span>
                  <span className="font-mono text-[12px] font-semibold tabular-nums text-km-ink">{fmtRp(t.amount)}</span>
                  <span className="text-[11px] text-km-ink-muted">·</span>
                  <span className="text-[11px] text-km-ink-muted">{t.bank_label ?? "—"}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-km-ink-muted">
                  {fmtTgl(t.date)}{t.reference ? ` · ${t.reference}` : ""}
                  {t.description ? ` — ${t.description}` : ""}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="ml-3 flex-shrink-0"
                disabled={needVihara}
                onClick={() => onIdentify(t)}
              >
                Identifikasi
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Modal reklasifikasi (mockup modal-reklas)
// ============================================================================

function ReklasModal({
  item,
  onClose,
  onSaved,
}: {
  item: SuspenseItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sourceName, setSourceName] = useState("");
  const [category, setCategory] = useState("dana_operasional");
  const [name, setName] = useState("");
  const [names, setNames] = useState<TransactionName[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nama peruntukan mengikuti kategori terpilih (master transaction-names).
  useEffect(() => {
    setName("");
    let alive = true;
    listTransactionNames({ type: "penerimaan", category })
      .then((list) => { if (alive) setNames(list); })
      .catch(() => { if (alive) setNames([]); });
    return () => { alive = false; };
  }, [category]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sourceName.trim()) {
      setError("Nama donatur / sumber dana wajib diisi");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await reklasifikasiPenerimaan(item.id, {
        category,
        source_name: sourceName.trim(),
        name: name || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan reklasifikasi");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-[480px] rounded-xl border border-km-border bg-km-panel shadow-xl">
        <div className="flex items-center justify-between border-b border-km-border px-4 py-3">
          <h2 className="text-[14px] font-medium">Reklasifikasi Dana</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-km-ink-muted hover:bg-km-bg" aria-label="Tutup">✕</button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="rounded-lg border border-km-blue-soft bg-km-blue-soft px-3 py-2.5 text-[11px] leading-relaxed text-km-blue-ink">
            <strong>{fmtRp(item.amount)}</strong> — {fmtTgl(item.date)}
            {item.reference ? ` · ${item.reference}` : ""}
            {item.description && <><br />{item.description}</>}
          </div>
          <Field label="Donatur / Sumber Dana *">
            <Input
              required
              value={sourceName}
              placeholder="Nama donatur setelah dikonfirmasi"
              onChange={(e) => setSourceName(e.target.value)}
            />
          </Field>
          <Field label="Kategori Dana *">
            <Select required value={category} onChange={(e) => setCategory(e.target.value)}>
              {REKLAS_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nama Peruntukan" hint="Opsional — dari master nama penerimaan sesuai kategori.">
            <Select value={name} onChange={(e) => setName(e.target.value)}>
              <option value="">— Tanpa nama peruntukan —</option>
              {names.map((n) => (
                <option key={n.id} value={n.name}>{n.name}</option>
              ))}
            </Select>
          </Field>
          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">{error}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
          <Button type="button" variant="default" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="success" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan Reklasifikasi"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-[10.5px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle text-km-ink ${className}`}>{children}</td>;
}
