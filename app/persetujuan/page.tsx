"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Td, TdAksi, Th, ThAksi } from "@/components/Tabel";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag } from "@/components/DanaTag";
import { Field, Input, Select } from "@/components/Field";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import { PembayaranDetail } from "@/components/PembayaranDetail";
import { PenerimaanDetail } from "@/components/PenerimaanDetail";
import { Toast } from "@/components/Toast";
import { postPembayaran, rejectPembayaran, STATUS_LABEL, STATUS_TONE, PembayaranStatus } from "@/lib/pembayaran";
import { postPenerimaan, rejectPenerimaan } from "@/lib/penerimaan";
import {
  listApprovals,
  TransactionRow,
  TransactionStatus,
  TransactionTipe,
} from "@/lib/transactions";
import { fmtTanggal } from "@/lib/tanggal";
import { useAuth } from "@/lib/useAuth";
import { getMyScope, ScopeVihara } from "@/lib/api";

// ============================================================================
// Persetujuan transaksi.
//
// Antrean berisi yang DIAJUKAN (submitted) — bukan semua draft. Draft adalah
// pekerjaan setengah jadi milik pembuatnya dan tidak pernah masuk ke sini;
// itulah pemisahan yang dulu tidak ada, sehingga data belum final ikut
// mengantre.
//
// Penolakan mengembalikan transaksi ke pengajunya beserta alasan, bukan
// menghapusnya: pengaju perlu tahu apa yang salah dan bisa memperbaikinya.
// ============================================================================

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const STATUS_PILIHAN: Array<{ nilai: TransactionStatus; label: string }> = [
  { nilai: "submitted", label: "Menunggu Persetujuan" },
  { nilai: "posted", label: "Disetujui" },
  { nilai: "rejected", label: "Ditolak" },
];

const KOSONG = {
  from: "",
  to: "",
  vihara: "",
  tipe: "" as TransactionTipe | "",
  status: "submitted" as TransactionStatus,
  category: "",
  pengaju: "",
  cari: "",
};

export default function PersetujuanPage() {
  const { can } = useAuth();

  const bisaPengeluaran = can("pembayaran.approve");
  const bisaPenerimaan = can("penerimaan.approve");

  const [f, setF] = useState({ ...KOSONG });
  const [rows, setRows] = useState<TransactionRow[]>([]);
  // Detail dibuka dari antrean supaya approver bisa memeriksa isian dan
  // lampiran sebelum memutuskan (FV-50). Komponennya sama dengan yang
  // dipakai Daftar Pengeluaran/Penerimaan — bukan salinan.
  const [detail, setDetail] = useState<{ tipe: TransactionRow["tipe"]; id: number } | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: null as number | null, to: null as number | null });
  const [viharas, setViharas] = useState<ScopeVihara[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    getMyScope()
      .then((d) => setViharas(d.viharas))
      .catch(() => setViharas([]));
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listApprovals({
      status: f.status,
      tipe: f.tipe || undefined,
      category: f.category || undefined,
      from: f.from || undefined,
      to: f.to || undefined,
      vihara_id: f.vihara ? Number(f.vihara) : null,
      submitted_by: f.pengaju ? Number(f.pengaju) : null,
      search: f.cari || undefined,
      page,
      per_page: perPage,
    })
      .then((r) => {
        setRows(r.data);
        setMeta({ current_page: r.current_page, last_page: r.last_page, total: r.total, from: r.from, to: r.to });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [f, page, perPage]);

  useEffect(reload, [reload]);

  // Saringan berubah → kembali ke halaman 1.
  useEffect(() => {
    setPage(1);
  }, [f, perPage]);

  // Daftar pengaju dirakit dari isi antrean — tidak perlu endpoint sendiri,
  // dan isinya otomatis terbatas pada yang memang terlihat oleh pengguna.
  const pengajuPilihan = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      if (r.submitted_by_user_id && r.submitted_by) {
        map.set(r.submitted_by_user_id, r.submitted_by);
      }
    }
    return [...map.entries()];
  }, [rows]);

  const kategoriPilihan = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))],
    [rows],
  );

  function bolehProses(r: TransactionRow) {
    return r.tipe === "Pengeluaran" ? bisaPengeluaran : bisaPenerimaan;
  }

  async function setujui(r: TransactionRow) {
    setBusy(r.id);
    setError(null);
    try {
      if (r.tipe === "Pengeluaran") await postPembayaran(r.id);
      else await postPenerimaan(r.id);
      setToast(`${r.code} disetujui dan diposting`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyetujui");
    } finally {
      setBusy(null);
    }
  }

  async function tolak(r: TransactionRow) {
    const alasan = window.prompt(
      `Tolak ${r.code}?\n\nTransaksi dikembalikan ke pengajunya beserta alasan ini, tidak dihapus.\n\nAlasan penolakan:`,
    );
    if (alasan == null) return;
    if (alasan.trim().length < 3) {
      setError("Alasan penolakan terlalu singkat.");
      return;
    }
    setBusy(r.id);
    setError(null);
    try {
      if (r.tipe === "Pengeluaran") await rejectPembayaran(r.id, alasan.trim());
      else await rejectPenerimaan(r.id, alasan.trim());
      setToast(`${r.code} ditolak dan dikembalikan ke pengaju`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menolak");
    } finally {
      setBusy(null);
    }
  }

  const adaFilterTerpakai = JSON.stringify(f) !== JSON.stringify(KOSONG);

  return (
    <AppShell title="Persetujuan" subtitle="Transaksi yang diajukan untuk disetujui">
      {toast && <Toast message={toast} tone="success" onClose={() => setToast(null)} />}

      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      <Card className="mb-3.5">
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Dari tanggal">
            <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </Field>
          <Field label="Sampai tanggal">
            <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
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
          <Field label="Jenis transaksi">
            <Select
              data-testid="filter-tipe"
              value={f.tipe}
              onChange={(e) => setF({ ...f, tipe: e.target.value as TransactionTipe | "" })}
            >
              <option value="">Semua jenis</option>
              <option value="Pengeluaran">Pengeluaran</option>
              <option value="Penerimaan">Penerimaan</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              data-testid="filter-status"
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as TransactionStatus })}
            >
              {STATUS_PILIHAN.map((s) => (
                <option key={s.nilai} value={s.nilai}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kategori">
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
          <Field label="Pengaju">
            <Select
              data-testid="filter-pengaju"
              value={f.pengaju}
              onChange={(e) => setF({ ...f, pengaju: e.target.value })}
            >
              <option value="">Semua pengaju</option>
              {pengajuPilihan.map(([id, nama]) => (
                <option key={id} value={id}>
                  {nama}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cari">
            <Input
              placeholder="Kode, nama, no. bukti…"
              data-testid="filter-cari"
              value={f.cari}
              onChange={(e) => setF({ ...f, cari: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between border-t border-km-border bg-km-panel-soft px-4 py-2.5">
          <span className="text-[11px] text-km-ink-muted">
            {adaFilterTerpakai ? "Filter sedang dipakai" : "Menampilkan antrean bawaan"}
          </span>
          <Button
            size="sm"
            variant="default"
            data-testid="reset-filter"
            onClick={() => setF({ ...KOSONG })}
          >
            Reset filter
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Antrean persetujuan"
          subtitle={loading ? "Memuat…" : undefined}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                <Th>Tanggal</Th>
                <Th>Kode</Th>
                <Th>Tipe</Th>
                <Th>Vihara</Th>
                <Th>Keterangan</Th>
                <Th>Kategori</Th>
                <Th>Pengaju</Th>
                <Th className="whitespace-nowrap text-right">Jumlah</Th>
                <Th>Status</Th>
                <ThAksi />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-km-ink-muted">
                    {f.cari ? "Data tidak ditemukan" : "Tidak ada pengajuan"}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={`${r.tipe}-${r.id}`}
                    className="border-t border-km-border hover:bg-km-panel-soft"
                  >
                    <Td className="whitespace-nowrap">{fmtTanggal(r.date)}</Td>
                    <Td className="kode text-[11px]">{r.code}</Td>
                    <Td>
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          r.tipe === "Pengeluaran"
                            ? "bg-km-red-soft text-km-red"
                            : "bg-km-green-soft text-km-green"
                        }`}
                      >
                        {r.tipe}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">{r.vihara_name ?? "—"}</Td>
                    <Td>
                      <p>{r.name ?? "—"}</p>
                      {(r.counterparty || r.reference) && (
                        <p className="text-[11px] text-km-ink-muted">
                          {[r.counterparty, r.reference].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {r.status === "rejected" && r.reject_reason && (
                        <p className="text-[11px] text-km-red-ink">
                          Ditolak: {r.reject_reason}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td className="whitespace-nowrap text-[11px]">{r.submitted_by ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums font-medium">
                      {fmtRp(r.amount)}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status as PembayaranStatus] ?? "neutral"}>
                        {STATUS_LABEL[r.status as PembayaranStatus] ?? r.status}
                      </Badge>
                    </Td>
                    <TdAksi>
                      <Button
                        size="sm"
                        variant="default"
                        className="min-h-[32px]"
                        data-testid={`detail-antrean-${r.tipe}-${r.id}`}
                        onClick={() => setDetail({ tipe: r.tipe, id: r.id })}
                      >
                        Detail
                      </Button>
                      {r.status !== "submitted" ? (
                        <span className="text-[11px] text-km-ink-muted">—</span>
                      ) : bolehProses(r) ? (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            disabled={busy === r.id}
                            onClick={() => setujui(r)}
                            data-testid={`setujui-${r.tipe}-${r.id}`}
                          >
                            {busy === r.id ? "…" : "Setujui"}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={busy === r.id}
                            onClick={() => tolak(r)}
                            data-testid={`tolak-${r.tipe}-${r.id}`}
                          >
                            Tolak
                          </Button>
                        </>
                      ) : (
                        <span className="text-[11px] text-km-ink-muted">Bukan wewenang Anda</span>
                      )}
                    </TdAksi>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-km-border">
          <Pagination
            currentPage={meta.current_page}
            lastPage={meta.last_page}
            total={meta.total}
            from={meta.from}
            to={meta.to}
            onChange={setPage}
            perPage={perPage}
            onPerPageChange={setPerPage}
          />
        </div>
      </Card>

      {detail?.tipe === "Pengeluaran" && (
        <PembayaranDetail
          id={detail.id}
          onClose={() => setDetail(null)}
          onChanged={reload}
        />
      )}
      {detail?.tipe === "Penerimaan" && (
        <PenerimaanDetail
          id={detail.id}
          onClose={() => setDetail(null)}
          onChanged={reload}
        />
      )}
    </AppShell>
  );
}
