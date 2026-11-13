"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag } from "@/components/DanaTag";
import { Field, Input, Select } from "@/components/Field";
import { NoTransaksi } from "@/components/NoTransaksi";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import { PenerimaanDetail } from "@/components/PenerimaanDetail";
import { getMyScope, ScopeVihara } from "@/lib/api";
import { PenerimaanStatus, STATUS_LABEL, STATUS_TONE } from "@/lib/penerimaan";
import { fmtTanggal } from "@/lib/tanggal";
import { listDaftarTransaksi, TransactionsResponse } from "@/lib/transactions";

// ============================================================================
// Daftar penerimaan lengkap (FV-38).
//
// Tabel di bawah form Input Penerimaan hanya memperlihatkan hari ini, jadi
// draft atau penerimaan kemarin tidak bisa dibuka lagi — satu-satunya jalan
// sebelumnya adalah menu Semua Transaksi, yang mencampur dua modul. Halaman
// ini kembarannya Daftar Pengeluaran: saringan dan pagination di server,
// bukan memuat semua baris lalu memotongnya di peramban.
//
// Bedanya dengan menu Penerimaan Dana Umat: yang itu rekap donasi lewat
// platform KalyanaMitta per kategori dana; yang ini seluruh penerimaan yang
// diinput di layar Input Penerimaan, termasuk yang masih draft.
//
// Jangkauannya tetap diurus API (ViharaScopeService), jadi daftar vihara di
// saringan pun hanya berisi vihara yang boleh diakses akun ini.
// ============================================================================

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const METODE_LABEL: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer Bank",
  auto_credit: "Auto Credit",
};

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
  metode: "",
  status: "" as "" | PenerimaanStatus,
  cari: "",
};

export default function DaftarPenerimaanPage() {
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

  useEffect(() => {
    setPage(1);
  }, [f, perPage]);

  const muat = useCallback(() => {
    setLoading(true);
    setError(null);
    listDaftarTransaksi({
      tipe: "Penerimaan",
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

  const semua = res?.data ?? [];
  // Metode belum jadi saringan di API; disaring di sisi klien atas halaman
  // yang sedang tampil, dan itu disebut apa adanya di label.
  const rows = useMemo(
    () => (f.metode ? semua.filter((r) => r.method === f.metode) : semua),
    [semua, f.metode],
  );
  const kategoriPilihan = useMemo(
    () => [...new Set(semua.map((r) => r.category).filter(Boolean))],
    [semua],
  );

  return (
    <AppShell
      title="Daftar Penerimaan"
      subtitle="Seluruh penerimaan dalam jangkauan akses Anda"
    >
      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      <Card className="mb-3.5">
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-3 lg:grid-cols-7">
          <Field label="Dari tanggal">
            <Input
              type="date"
              data-testid="filter-dari"
              value={f.from}
              onChange={(e) => setF({ ...f, from: e.target.value })}
            />
          </Field>
          <Field label="Sampai tanggal">
            <Input
              type="date"
              data-testid="filter-sampai"
              value={f.to}
              onChange={(e) => setF({ ...f, to: e.target.value })}
            />
          </Field>
          <Field label="Vihara">
            <Select
              data-testid="filter-vihara"
              value={f.vihara}
              onChange={(e) => setF({ ...f, vihara: e.target.value })}
            >
              <option value="">Semua vihara</option>
              {viharas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kategori dana">
            <Select
              data-testid="filter-kategori"
              value={f.category}
              onChange={(e) => setF({ ...f, category: e.target.value })}
            >
              <option value="">Semua kategori</option>
              {kategoriPilihan.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Metode" hint="Menyaring halaman yang tampil.">
            <Select
              data-testid="filter-metode"
              value={f.metode}
              onChange={(e) => setF({ ...f, metode: e.target.value })}
            >
              <option value="">Semua metode</option>
              <option value="transfer">Transfer Bank</option>
              <option value="tunai">Tunai</option>
              <option value="auto_credit">Auto Credit</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              data-testid="filter-status"
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as "" | PenerimaanStatus })}
            >
              <option value="">Semua status</option>
              {(Object.keys(STATUS_LABEL) as PenerimaanStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cari">
            <Input
              data-testid="filter-cari"
              placeholder="No. transaksi, nama, donatur…"
              value={f.cari}
              onChange={(e) => setF({ ...f, cari: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex items-center justify-end border-t border-km-border bg-km-panel-soft px-4 py-2.5">
          <Button
            size="sm"
            variant="default"
            data-testid="reset-filter"
            onClick={() => setF({ ...FILTER_AWAL })}
          >
            Reset filter
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Penerimaan" subtitle={loading ? "Memuat…" : undefined} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                <Th>No. Transaksi</Th>
                <Th>Tanggal</Th>
                <Th>Vihara</Th>
                <Th>Nama Penerimaan</Th>
                <Th>Donatur / Sumber</Th>
                <Th>Kategori Dana</Th>
                <Th>Masuk ke</Th>
                <Th>Metode</Th>
                <Th className="text-right">Jumlah</Th>
                <Th>Status</Th>
                <Th>Bukti</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-km-ink-muted">
                    Tidak ada penerimaan
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
                      {r.reference && (
                        <p className="kode text-[11px] text-km-ink-muted">{r.reference}</p>
                      )}
                    </Td>
                    <Td>{r.counterparty ?? "—"}</Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td className="kode whitespace-nowrap text-[11px] text-km-ink-soft">
                      {r.bank_label ?? "Kas Penerimaan Langsung"}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {METODE_LABEL[r.method] ?? r.method}
                    </Td>
                    <Td className="text-right font-medium tabular-nums text-km-green">
                      {fmtRp(r.amount)}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status as PenerimaanStatus] ?? "neutral"}>
                        {STATUS_LABEL[r.status as PenerimaanStatus] ?? r.status}
                      </Badge>
                    </Td>
                    <Td className="text-center">
                      {r.has_attachment ? (
                        <span title="Ada lampiran bukti" aria-label="Ada lampiran bukti">
                          📎
                        </span>
                      ) : (
                        <span className="text-km-ink-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="default"
                        className="min-h-[32px]"
                        data-testid={`detail-penerimaan-${r.id}`}
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
        <PenerimaanDetail id={detailId} onClose={() => setDetailId(null)} onChanged={muat} />
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
