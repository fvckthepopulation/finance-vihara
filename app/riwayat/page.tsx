"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DanaTag, DANA_CATEGORY_LABEL } from "@/components/DanaTag";
import { KmLink } from "@/components/KmLink";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import {
  exportTransactionsCsv,
  fetchTransactionAttachment,
  voidTransaction,
  listTransactions,
  ListTransactionsParams,
  TransactionRow,
  TransactionSource,
  TransactionStatus,
  TransactionTipe,
  TransactionsResponse,
} from "@/lib/transactions";
import { useAuth } from "@/lib/useAuth";
import { useVihara } from "@/lib/useVihara";

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const KATEGORI_OPTIONS = [
  "dana_perayaan",
  "dana_operasional",
  "dana_bhikkhu",
  "dana_paramita",
  "biaya_operasional",
  "biaya_bhikkhu",
  "biaya_perayaan",
  "biaya_paramita",
];

const filterInputClass =
  "rounded-lg border border-km-border bg-km-panel px-2.5 py-1.5 text-[12px] text-km-ink placeholder:text-km-ink-muted";

export default function RiwayatPage() {
  const { viharaId, ready: viharaReady } = useVihara();
  const { can } = useAuth();
  // Satu izin cukup untuk memunculkan kolom; tiap barisnya dicek lagi sesuai
  // jenisnya, dan server tetap menolak yang tidak berhak.
  const bisaBatalkan = can("pembayaran.void") || can("penerimaan.void");
  // Dinaikkan setelah pembatalan supaya daftarnya dimuat ulang.
  const [revisi, setRevisi] = useState(0);
  const reload = () => setRevisi((n) => n + 1);

  // ----- filter state -----
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipe, setTipe] = useState<TransactionTipe | "">("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sumber, setSumber] = useState<TransactionSource | "">("");
  const [status, setStatus] = useState<TransactionStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);

  const [res, setRes] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce input pencarian.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // Reset ke halaman 1 saat filter berubah.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tipe, category, from, to, sumber, status, viharaId, perPage]);

  const filterParams: ListTransactionsParams = {
    search: debouncedSearch || undefined,
    tipe: tipe || undefined,
    category: category || undefined,
    from: from || undefined,
    to: to || undefined,
    sumber: sumber || undefined,
    status: status || undefined,
    vihara_id: viharaId,
  };

  useEffect(() => {
    if (!viharaReady) return;
    let alive = true;
    setLoading(true);
    setError(null);
    listTransactions({
      search: debouncedSearch || undefined,
      tipe: tipe || undefined,
      category: category || undefined,
      from: from || undefined,
      to: to || undefined,
      sumber: sumber || undefined,
      status: status || undefined,
      vihara_id: viharaId,
      page,
      per_page: perPage,
    })
      .then((r) => {
        if (alive) setRes(r);
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
  }, [
    viharaReady,
    viharaId,
    debouncedSearch,
    tipe,
    category,
    from,
    to,
    sumber,
    status,
    page,
    perPage,
    // Dinaikkan sesudah pembatalan supaya daftarnya dimuat ulang.
    revisi,
  ]);

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setTipe("");
    setCategory("");
    setFrom("");
    setTo("");
    setSumber("");
    setStatus("");
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportTransactionsCsv(filterParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transaksi_vihara.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal export CSV");
    } finally {
      setExporting(false);
    }
  }

  const rows = res?.data ?? [];
  const totals = res?.totals;
  const saldo = Number(totals?.masuk ?? 0) - Number(totals?.keluar ?? 0);

  return (
    <AppShell
      title="Semua Transaksi"
      subtitle="Riwayat lengkap penerimaan & pengeluaran"
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
          {error}
        </p>
      )}

      <Card>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-km-border px-4 py-3">
          <p className="text-[13px] font-medium text-km-ink">Semua Transaksi</p>
          <Button onClick={handleExport} disabled={exporting}>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-[13px] w-[13px]"
            >
              <path d="M4 13h8M8 3v7M5 7l3 3 3-3" />
            </svg>
            {exporting ? "Mengunduh…" : "Export CSV"}
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-km-border bg-km-bg px-4 py-2.5">
          <input
            data-testid="cari-transaksi"
            aria-label="Cari transaksi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, PIC, no. bukti…"
            className={`${filterInputClass} w-full sm:max-w-[220px]`}
          />
          <select
            value={tipe}
            onChange={(e) => setTipe(e.target.value as TransactionTipe | "")}
            className={filterInputClass}
            aria-label="Tipe"
          >
            <option value="">Semua Tipe</option>
            <option value="Penerimaan">Penerimaan</option>
            <option value="Pengeluaran">Pengeluaran</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={filterInputClass}
            aria-label="Kategori"
          >
            <option value="">Semua Kategori</option>
            {KATEGORI_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {DANA_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={filterInputClass}
            aria-label="Dari tanggal"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={filterInputClass}
            aria-label="Sampai tanggal"
          />
          <select
            value={sumber}
            onChange={(e) => setSumber(e.target.value as TransactionSource | "")}
            className={filterInputClass}
            aria-label="Sumber"
          >
            <option value="">Semua Sumber</option>
            <option value="km">KalyanaMitta</option>
            <option value="manual">Input Manual</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TransactionStatus | "")}
            className={filterInputClass}
            aria-label="Status"
          >
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
          </select>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Reset filter
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                <Th>Tanggal</Th>
                <Th>Keterangan</Th>
                <Th>Donatur / Sumber</Th>
                <Th>Kategori</Th>
                <Th className="text-right">Jumlah</Th>
                <Th>Status</Th>
                <Th>Bukti</Th>
                {bisaBatalkan && <Th>Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={bisaBatalkan ? 8 : 7} className="px-3 py-10 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={bisaBatalkan ? 8 : 7} className="px-3 py-10 text-center">
                    <p className="text-[13px] font-medium text-km-ink-soft">
                      Tidak ada transaksi
                    </p>
                    <p className="mt-1 text-[12px] text-km-ink-muted">
                      Coba ubah filter
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={`${r.tipe}-${r.id}`}
                    className="border-t border-km-border hover:bg-km-panel-soft"
                  >
                    <Td className="whitespace-nowrap">{r.date.slice(0, 10)}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-km-ink">{r.name}</span>
                        {r.source === "km" && (
                          <>
                            <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#E65100" }}>
                              KalyanaMitta
                            </span>
                            <KmLink refCode={r.reference} />
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-km-ink-muted">
                        {r.code}
                      </div>
                    </Td>
                    <Td className="text-km-ink-muted">{r.counterparty ?? "—"}</Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td
                      className={`whitespace-nowrap text-right tabular-nums font-medium ${
                        r.tipe === "Penerimaan" ? "text-km-green" : "text-km-red"
                      }`}
                    >
                      {r.tipe === "Pengeluaran" ? "−" : ""}
                      {fmtRp(r.amount)}
                    </Td>
                    <Td>
                      {r.status === "cancelled" ? (
                        <span
                          className="inline-flex items-center whitespace-nowrap rounded-full bg-km-red-soft px-2 py-0.5 text-[11px] font-medium text-km-red-ink"
                          title={r.void_reason ?? undefined}
                          data-testid={`status-cancelled-${r.id}`}
                        >
                          Dibatalkan
                        </span>
                      ) : r.status === "posted" ? (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-green-soft px-2 py-0.5 text-[11px] font-medium text-km-green">
                          Posted
                        </span>
                      ) : (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-amber-soft px-2 py-0.5 text-[11px] font-medium text-km-amber-ink">
                          Draft
                        </span>
                      )}
                    </Td>
                    <Td>
                      <BuktiLink row={r} onError={setError} />
                    </Td>
                    {bisaBatalkan && (
                      <Td>
                        <BatalkanButton row={r} onError={setError} onDone={reload} />
                      </Td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer strip: jumlah + totals */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-km-border px-4 py-2.5 text-[12px] text-km-ink-muted">
          <span>{totals?.count ?? 0} transaksi</span>
          <span className="tabular-nums">
            Masuk: <span className="font-medium text-km-green">{fmtRp(totals?.masuk ?? 0)}</span>
            <span className="mx-1.5">|</span>
            Keluar: <span className="font-medium text-km-red">{fmtRp(totals?.keluar ?? 0)}</span>
            <span className="mx-1.5">|</span>
            Saldo: <span className="font-medium text-km-ink">{fmtRp(saldo)}</span>
          </span>
        </div>

        {res && (
          <div className="border-t border-km-border">
            <Pagination
              currentPage={res.current_page}
              lastPage={res.last_page}
              total={res.total}
              from={res.from}
              to={res.to}
              onChange={setPage}
              perPage={perPage}
              onPerPageChange={setPerPage}
            />
          </div>
        )}
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

/**
 * Pembuka lampiran bukti. Berkasnya duduk di disk privat dan endpoint
 * unduhnya butuh token, jadi tidak bisa jadi <a href> biasa: diambil dulu
 * sebagai blob, baru dibuka di tab baru. URL objeknya dicabut setelah
 * sebentar supaya tidak menumpuk di memori.
 */
function BuktiLink({
  row,
  onError,
}: {
  row: TransactionRow;
  onError: (pesan: string) => void;
}) {
  const [pending, setPending] = useState(false);

  if (!row.has_attachment) {
    return <span className="text-[11px] text-km-ink-muted">—</span>;
  }

  async function buka() {
    setPending(true);
    try {
      const blob = await fetchTransactionAttachment(row);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Gagal membuka lampiran");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={buka}
      disabled={pending}
      data-testid={`bukti-${row.tipe}-${row.id}`}
      className="inline-flex items-center gap-1 rounded-md border border-km-border px-1.5 py-0.5 text-[11px] text-km-blue hover:bg-km-panel-soft disabled:opacity-60"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
        <path d="M9 2H4v12h8V5L9 2z" />
        <path d="M9 2v3h3" />
      </svg>
      {pending ? "Membuka…" : "Lihat"}
    </button>
  );
}

/**
 * Tombol pembatalan. Yang terjadi di server adalah jurnal pembalik, bukan
 * penghapusan — karena itu konfirmasinya menyebut hal itu, dan alasannya
 * wajib: alasan inilah satu-satunya jejak NIAT di balik pembatalan.
 */
function BatalkanButton({
  row,
  onError,
  onDone,
}: {
  row: TransactionRow;
  onError: (pesan: string) => void;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);

  if (row.status !== "posted") {
    return <span className="text-[11px] text-km-ink-muted">—</span>;
  }

  async function batalkan() {
    const alasan = window.prompt(
      `Batalkan ${row.code}?\n\nTransaksi TIDAK dihapus: sistem membuat jurnal pembalik dan menandainya dibatalkan.\n\nAlasan pembatalan:`,
    );
    if (alasan == null) return;
    if (alasan.trim().length < 3) {
      onError("Alasan pembatalan terlalu singkat.");
      return;
    }
    setPending(true);
    try {
      await voidTransaction(row, alasan.trim());
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Gagal membatalkan transaksi");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={batalkan}
      disabled={pending}
      data-testid={`batalkan-${row.tipe}-${row.id}`}
      className="whitespace-nowrap rounded-md border border-km-border px-1.5 py-0.5 text-[11px] text-km-red-ink hover:bg-km-red-soft disabled:opacity-60"
    >
      {pending ? "Membatalkan…" : "Batalkan"}
    </button>
  );
}
