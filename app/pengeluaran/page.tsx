"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag } from "@/components/DanaTag";
import { Field, Input, Select } from "@/components/Field";
import { NoTransaksi } from "@/components/NoTransaksi";
import { PembayaranDetail } from "@/components/PembayaranDetail";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import { getMyScope, ScopeVihara } from "@/lib/api";
import { PembayaranStatus, STATUS_LABEL, STATUS_TONE } from "@/lib/pembayaran";
import { fmtTanggal } from "@/lib/tanggal";
import { listDaftarTransaksi, TransactionsResponse } from "@/lib/transactions";

// ============================================================================
// Daftar pengeluaran lengkap.
//
// Tabel di bawah form Input Pengeluaran hanya memperlihatkan hari ini, jadi
// draft atau transaksi kemarin tidak bisa dibuka lagi. Halaman ini memberi
// jalan ke seluruh riwayat pengeluaran, dengan saringan dan pagination di
// server — bukan memuat semua baris lalu memotongnya di peramban.
//
// Jangkauannya tetap diurus API (ViharaScopeService), jadi daftar vihara di
// saringan pun hanya berisi vihara yang boleh diakses akun ini.
// ============================================================================

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

/** Bawaan: bulan berjalan, sesuai permintaan di laporan. */
function awalBulan(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
}
function hariIni(): string {
  return new Date().toLocaleDateString("en-CA");
}

const FILTER_AWAL = {
  from: awalBulan(),
  to: hariIni(),
  vihara: "",
  category: "",
  status: "" as "" | PembayaranStatus,
  cari: "",
};

export default function DaftarPengeluaranPage() {
  const [f, setF] = useState({ ...FILTER_AWAL });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [res, setRes] = useState<TransactionsResponse | null>(null);
  const [viharas, setViharas] = useState<ScopeVihara[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    getMyScope()
      .then((d) => setViharas(d.viharas))
      .catch(() => setViharas([]));
  }, []);

  // Filter atau kata kunci berubah → kembali ke halaman 1, kalau tidak
  // pengguna bisa terdampar di halaman kosong.
  useEffect(() => {
    setPage(1);
  }, [f, perPage]);

  const muat = useCallback(() => {
    setLoading(true);
    setError(null);
    listDaftarTransaksi({
      tipe: "Pengeluaran",
      from: f.from || undefined,
      to: f.to || undefined,
      vihara_id: f.vihara ? Number(f.vihara) : null,
      category: f.category || undefined,
      status: f.status || undefined,
      search: f.cari || undefined,
      page,
      per_page: perPage,
    })
      .then(setRes)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [f, page, perPage]);

  useEffect(muat, [muat]);

  const rows = res?.data ?? [];
  const kategoriPilihan = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))],
    [rows],
  );

  return (
    <AppShell title="Daftar Pengeluaran" subtitle="Seluruh pengeluaran dalam jangkauan akses Anda">
      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      <Card className="mb-3.5">
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Dari tanggal">
            <Input type="date" data-testid="filter-dari" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </Field>
          <Field label="Sampai tanggal">
            <Input type="date" data-testid="filter-sampai" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
          <Field label="Vihara">
            <Select data-testid="filter-vihara" value={f.vihara} onChange={(e) => setF({ ...f, vihara: e.target.value })}>
              <option value="">Semua vihara</option>
              {viharas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kategori biaya">
            <Select data-testid="filter-kategori" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option value="">Semua kategori</option>
              {kategoriPilihan.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              data-testid="filter-status"
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as "" | PembayaranStatus })}
            >
              <option value="">Semua status</option>
              {(Object.keys(STATUS_LABEL) as PembayaranStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cari">
            <Input
              data-testid="filter-cari"
              placeholder="Nama, PIC, no. bukti…"
              value={f.cari}
              onChange={(e) => setF({ ...f, cari: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex items-center justify-end border-t border-km-border bg-km-panel-soft px-4 py-2.5">
          <Button size="sm" variant="default" data-testid="reset-filter" onClick={() => setF({ ...FILTER_AWAL })}>
            Reset filter
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pengeluaran" subtitle={loading ? "Memuat…" : undefined} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                {/* FV-40 — nomor transaksi di kolom pertama, bisa diklik. */}
                <Th>No. Transaksi</Th>
                <Th>Tanggal</Th>
                <Th>Vihara</Th>
                <Th>Nama Pengeluaran</Th>
                <Th>Kategori Biaya</Th>
                <Th>Rekening</Th>
                <Th className="text-right">Jumlah</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-km-ink-muted">
                    Tidak ada pengeluaran
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft">
                    <Td>
                      <NoTransaksi
                        code={r.code}
                        onClick={() => setDetailId(r.id)}
                        testId={`no-transaksi-${r.id}`}
                      />
                    </Td>
                    <Td className="whitespace-nowrap">{fmtTanggal(r.date)}</Td>
                    <Td className="whitespace-nowrap">{r.vihara_name ?? "—"}</Td>
                    <Td>
                      <p>{r.name ?? "—"}</p>
                      {(r.counterparty || r.reference) && (
                        <p className="text-[11px] text-km-ink-muted">
                          {[r.counterparty, r.reference].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td className="whitespace-nowrap text-[11px] text-km-ink-soft">
                      {r.bank_label ?? "—"}
                    </Td>
                    <Td className="text-right tabular-nums font-medium text-km-red">
                      {fmtRp(r.amount)}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status as PembayaranStatus] ?? "neutral"}>
                        {STATUS_LABEL[r.status as PembayaranStatus] ?? r.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="default"
                        className="min-h-[32px]"
                        data-testid={`detail-pengeluaran-${r.id}`}
                        onClick={() => setDetailId(r.id)}
                      >
                        Detail
                      </Button>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-km-border">
          <Pagination
            currentPage={res?.current_page ?? 1}
            lastPage={res?.last_page ?? 1}
            total={res?.total ?? 0}
            from={res?.from ?? null}
            to={res?.to ?? null}
            onChange={setPage}
            perPage={perPage}
            onPerPageChange={setPerPage}
          />
        </div>
      </Card>

      {detailId != null && (
        <PembayaranDetail id={detailId} onClose={() => setDetailId(null)} onChanged={muat} />
      )}
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
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
