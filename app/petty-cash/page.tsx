"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Td, TdAksi, Th, ThAksi } from "@/components/Tabel";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import { PettyCashDetail } from "@/components/PettyCashDetail";
import { Toast } from "@/components/Toast";
import { bankBrand, listViharaBankAccounts, num, ViharaBankAccount } from "@/lib/kasBank";
import {
  cekLampiran,
  createPettyCash,
  CreatePettyCashInput,
  deletePettyCash,
  getPettyCashSummary,
  listPettyCashCategories,
  listPettyCashPaginated,
  listPettyCashPics,
  pettyCashDate,
  PettyCashCategory,
  PettyCashEntry,
  pettyCashKeterangan,
  pettyCashPicId,
  pettyCashPicName,
  PettyCashPic,
  pettyCashSourceLabel,
  PettyCashSummary,
  postPettyCash,
  updatePettyCash,
  uploadPettyCashAttachment,
  voidPettyCashMovement,
} from "@/lib/pettyCash";
import { listTransactionNames, TransactionName } from "@/lib/transactionNames";
import { YayasanViharaFields, YayasanViharaValue } from "@/components/YayasanViharaFields";
import { useAuth } from "@/lib/useAuth";
import { dialog } from "@/components/Dialog";

const fmtRp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const fmtTgl = (iso: string) =>
  new Date(iso.slice(0, 10)).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-CA");
const CATATAN_MAKS = 500;

// Warna kartu/tag per PIC — siklus mengikuti mockup (biru, ungu, lalu hijau/amber).
const PIC_COLORS = [
  { bg: "var(--km-blue-soft)", text: "var(--km-blue)" },
  { bg: "var(--km-purple-soft)", text: "var(--km-purple)" },
  { bg: "var(--km-green-soft)", text: "var(--km-green)" },
  { bg: "var(--km-amber-soft)", text: "var(--km-amber)" },
];
const picColor = (i: number) => PIC_COLORS[((i % PIC_COLORS.length) + PIC_COLORS.length) % PIC_COLORS.length];

type ToastMsg = { message: string; tone: "success" | "error" };

const LAMPIRAN_CLASS =
  "w-full rounded-lg border border-km-border-strong bg-km-panel px-2.5 py-1.5 text-[12px] text-km-ink file:mr-2 file:rounded-md file:border-0 file:bg-km-panel-soft file:px-2 file:py-1 file:text-[11px] file:text-km-ink-soft";

/**
 * Simpan mutasi (baru atau ubah draft), unggah lampiran, lalu — hanya untuk
 * mutasi BARU oleh akun yang boleh menyetujui — langsung posting.
 *
 * Lampiran diunggah selagi masih draft (server menolak lampiran pada mutasi
 * terposting). Kalau unggahnya gagal, mutasi tetap tersimpan sebagai draft
 * dan tidak diposting, supaya buktinya bisa dilengkapi dulu (FV-83).
 */
async function simpanMutasi(opsi: {
  editId: number | null;
  isian: CreatePettyCashInput;
  lampiran: File | null;
  bisaSetujui: boolean;
}): Promise<{ pesan: string; tone: "success" | "error" }> {
  const { editId, isian, lampiran, bisaSetujui } = opsi;
  const { vihara_id: _abaikan, ...tanpaVihara } = isian;
  void _abaikan;
  const row = editId != null ? await updatePettyCash(editId, tanpaVihara) : await createPettyCash(isian);
  if (lampiran) {
    try {
      await uploadPettyCashAttachment(row.id, lampiran);
    } catch (e) {
      return {
        pesan: `Mutasi tersimpan sebagai draft, tetapi lampiran gagal diunggah: ${
          e instanceof Error ? e.message : "kesalahan tidak diketahui"
        }. Lengkapi lewat Ubah.`,
        tone: "error",
      };
    }
  }
  if (editId != null) return { pesan: "Draft kas kecil diperbarui", tone: "success" };
  // Tanpa izin menyetujui, mutasi berhenti sebagai draft — bukan dipaksa
  // post lalu gagal 403 dan meninggalkan draft gantung.
  if (bisaSetujui) {
    await postPettyCash(row.id);
    return {
      pesan: isian.subtype === "topup" ? "Pengisian kas kecil tercatat" : "Penggunaan kas kecil tercatat",
      tone: "success",
    };
  }
  return { pesan: "Tersimpan sebagai draft — menunggu persetujuan", tone: "success" };
}

export default function PettyCashPage() {
  // Kas Kecil adalah pandangan PER VIHARA — saldo, PIC, dan mutasinya milik
  // satu vihara. Jadi viharanya dipilih DI HALAMAN INI, bukan diwarisi dari
  // pemilih di header: saldo yang terlihat dan transaksi yang dicatat harus
  // menunjuk vihara yang sama, dan harus terbaca jelas yang mana.
  const { can } = useAuth();
  const canVoid = can("petty_cash.void");
  const bisaCatat = can("petty_cash.declare");
  const bisaSetujui = can("petty_cash.approve");
  const [scope, setScope] = useState<YayasanViharaValue>({ entityId: null, viharaId: null });
  const viharaId = scope.viharaId;
  const needVihara = viharaId == null;

  const [summary, setSummary] = useState<PettyCashSummary | null>(null);
  const [pics, setPics] = useState<PettyCashPic[]>([]);
  const [bankAccounts, setBankAccounts] = useState<ViharaBankAccount[]>([]);
  const [kategori, setKategori] = useState<PettyCashCategory[]>([]);
  const [rows, setRows] = useState<PettyCashEntry[]>([]);
  const [halaman, setHalaman] = useState({ current_page: 1, last_page: 1, total: 0, from: null as number | null, to: null as number | null });
  const [totals, setTotals] = useState<{ masuk: number; keluar: number; selisih: number } | null>(null);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [filterPic, setFilterPic] = useState("");
  const [cari, setCari] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [ubah, setUbah] = useState<PettyCashEntry | null>(null);

  // Rentang terbalik tidak dikirim ke server — pesannya tampil di sini.
  const rentangSalah = dari !== "" && sampai !== "" && sampai < dari;
  const adaFilter = cari !== "" || filterPic !== "" || dari !== "" || sampai !== "";

  const reloadSummary = useCallback(() => {
    getPettyCashSummary(viharaId)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [viharaId]);

  const reloadRows = useCallback(() => {
    if (rentangSalah) {
      setRows([]);
      setTotals(null);
      setHalaman({ current_page: 1, last_page: 1, total: 0, from: null, to: null });
      setRowsLoading(false);
      return;
    }
    setRowsLoading(true);
    // Riwayat dipotong di server: daftar mutasi kas kecil ikut tumbuh tiap
    // bulan, jadi tidak semuanya ditarik lalu dipotong di peramban.
    listPettyCashPaginated({
      vihara_id: viharaId,
      pic_id: filterPic ? Number(filterPic) : undefined,
      q: cari || undefined,
      from: dari || undefined,
      to: sampai || undefined,
      page,
      per_page: perPage,
    })
      .then((res) => {
        setRows(res.data);
        setHalaman({
          current_page: res.current_page,
          last_page: res.last_page,
          total: res.total,
          from: res.from,
          to: res.to,
        });
        setTotals(
          res.totals
            ? { masuk: num(res.totals.masuk), keluar: num(res.totals.keluar), selisih: num(res.totals.selisih) }
            : null,
        );
      })
      .catch(() => {
        setRows([]);
        setTotals(null);
        setHalaman({ current_page: 1, last_page: 1, total: 0, from: null, to: null });
      })
      .finally(() => setRowsLoading(false));
  }, [viharaId, filterPic, cari, dari, sampai, rentangSalah, page, perPage]);

  useEffect(() => {
    reloadSummary();
  }, [reloadSummary]);

  useEffect(() => {
    reloadRows();
  }, [reloadRows]);

  useEffect(() => {
    listPettyCashCategories()
      .then(setKategori)
      .catch(() => setKategori([]));
  }, []);

  // Masters — PIC & rekening bank vihara aktif (form terblokir saat "Semua Vihara").
  useEffect(() => {
    listPettyCashPics(viharaId)
      .then((list) => setPics(list.filter((p) => p.active)))
      .catch(() => setPics([]));
    if (viharaId != null) {
      listViharaBankAccounts(viharaId)
        .then((list) => setBankAccounts(list.filter((b) => b.active)))
        .catch(() => setBankAccounts([]));
    } else {
      setBankAccounts([]);
    }
  }, [viharaId]);

  useEffect(() => {
    setFilterPic("");
    setCari("");
  }, [viharaId]);

  // Ganti saringan → balik ke halaman 1, supaya tidak terdampar di halaman kosong.
  useEffect(() => {
    setPage(1);
  }, [viharaId, filterPic, cari, dari, sampai, perPage]);

  // Urutan warna PIC konsisten di kartu ringkasan + tag riwayat.
  const picColorIndex = useMemo(() => {
    const map = new Map<number, number>();
    const source = summary?.pics.length ? summary.pics : pics;
    source.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [summary, pics]);

  async function handleVoid(r: { id: number }) {
    const alasan = await dialog.prompt({
      title: `Batalkan mutasi kas kecil #${r.id}`,
      message: "Mutasi TIDAK dihapus: sistem membuat jurnal pembalik dan menandainya dibatalkan.",
      label: "Alasan pembatalan",
      confirmLabel: "Batalkan Mutasi",
      tone: "danger",
      action: (a) => voidPettyCashMovement(r.id, a),
    });
    if (alasan == null) return;
    afterSaved("Mutasi kas kecil dibatalkan");
  }

  async function handleHapus(r: PettyCashEntry) {
    const ya = await dialog.confirm({
      title: `Hapus draft kas kecil #${r.id}`,
      message: "Draft belum membuat jurnal. Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: "Hapus",
      tone: "danger",
      action: () => deletePettyCash(r.id),
    });
    if (ya) afterSaved(`Draft kas kecil #${r.id} dihapus`);
  }

  async function handlePosting(r: PettyCashEntry) {
    const ya = await dialog.confirm({
      title: `Posting mutasi kas kecil #${r.id}`,
      message: `${r.subtype === "topup" ? "Pengisian" : "Penggunaan"} ${fmtRp(num(r.amount))} akan dijurnal dan mengubah saldo PIC.`,
      confirmLabel: "Posting",
      action: () => postPettyCash(r.id),
    });
    if (ya) afterSaved(`Mutasi kas kecil #${r.id} diposting`);
  }

  function afterSaved(message: string, tone: "success" | "error" = "success") {
    setToast({ message, tone });
    reloadSummary();
    reloadRows();
  }

  const formProps = {
    pics,
    viharaId,
    needVihara,
    bisaSetujui,
    onSaved: (m: string, tone: "success" | "error") => afterSaved(m, tone),
    onError: (m: string) => setToast({ message: m, tone: "error" }),
  };

  return (
    <AppShell title="Kas Kecil" subtitle="Kelola kas kecil per PIC">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div className="space-y-3.5">
        {/* ── Vihara yang sedang dikelola ── */}
        <Card>
          <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-2">
            <YayasanViharaFields value={scope} onChange={setScope} />
          </div>
          {needVihara && (
            <p className="border-t border-km-border bg-km-panel-soft px-4 py-2 text-[11px] font-medium text-km-amber-ink">
              Pilih yayasan dan vihara dulu — saldo dan mutasi di bawah mengikuti pilihan ini.
            </p>
          )}
        </Card>

        {/* ── Ringkasan per PIC ── */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {(summary?.pics ?? []).map((p, i) => {
            const c = picColor(picColorIndex.get(p.id) ?? i);
            return (
              <Card key={p.id}>
                <div className="border-b border-km-border px-4 py-3" style={{ background: c.bg }}>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[.06em]"
                    style={{ color: c.text }}
                  >
                    Kas Kecil — {p.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 px-4 py-3.5">
                  <div>
                    <p className="mb-1 text-[11px] text-km-ink-muted">Saldo Awal</p>
                    <p className="text-[18px] font-medium text-km-ink" data-testid={`saldo-awal-${p.id}`}>
                      {fmtRp(num(p.saldo_awal))}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-km-ink-muted">Saldo Saat Ini</p>
                    {/* Saldo minus merah, bukan hijau (FV-60 poin 4) — hijau
                        untuk angka minus membuatnya terbaca sebagai keadaan
                        baik-baik saja. */}
                    <p
                      data-testid={`saldo-kini-${p.id}`}
                      className={`text-[18px] font-semibold ${
                        num(p.saldo) < 0 ? "text-km-red" : "text-km-green"
                      }`}
                    >
                      {fmtRp(num(p.saldo))}
                    </p>
                    {num(p.saldo) < 0 && (
                      <p className="text-[11px] font-medium text-km-red-ink">Saldo minus</p>
                    )}
                  </div>
                </div>
                <p className="px-4 pb-3.5 text-[11px] text-km-ink-muted">
                  Pengisian bulan ini: {fmtRp(num(p.total_isi))} | Terpakai: {fmtRp(num(p.total_pakai))} | {p.count} mutasi
                </p>
              </Card>
            );
          })}
          {summary && summary.pics.length === 0 && (
            <Card className="sm:col-span-2">
              <p className="px-4 py-6 text-center text-[12px] text-km-ink-muted">
                Belum ada PIC kas kecil — tambahkan di Admin → Vihara.
              </p>
            </Card>
          )}
        </div>

        {/* ── Form pengisian & penggunaan ── */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <Card>
            <TopupForm {...formProps} bankAccounts={bankAccounts} title="Pengisian Kas Kecil" />
          </Card>
          <Card>
            <UsageForm {...formProps} kategori={kategori} title="Penggunaan Kas Kecil" />
          </Card>
        </div>

        {/* ── Riwayat mutasi ── */}
        <Card>
          <CardHeader title="Riwayat Mutasi Kas Kecil" />
          <div className="grid grid-cols-1 gap-2.5 border-b border-km-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Cari">
              <Input
                data-testid="cari-kaskecil"
                value={cari}
                placeholder="Nama pengeluaran, catatan, no. bukti, PIC…"
                onChange={(e) => setCari(e.target.value)}
                aria-label="Cari mutasi kas kecil"
              />
            </Field>
            <Field label="PIC">
              <Select value={filterPic} onChange={(e) => setFilterPic(e.target.value)} aria-label="Filter PIC">
                <option value="">Semua PIC</option>
                {pics.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            {/* Rentang tanggal (FV-86): inklusif, boleh diisi salah satu. */}
            <Field label="Dari tanggal">
              <Input
                type="date"
                data-testid="kaskecil-dari"
                value={dari}
                max={sampai || undefined}
                onChange={(e) => setDari(e.target.value)}
              />
            </Field>
            <Field label="Sampai tanggal">
              <Input
                type="date"
                data-testid="kaskecil-sampai"
                value={sampai}
                min={dari || undefined}
                onChange={(e) => setSampai(e.target.value)}
              />
            </Field>
            {rentangSalah && (
              <p
                className="text-[11px] font-medium text-km-red-ink sm:col-span-2 lg:col-span-4"
                data-testid="kaskecil-rentang-salah"
              >
                Sampai tanggal tidak boleh lebih awal dari Dari tanggal.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-km-panel-soft">
                <tr>
                  <Th>Tanggal</Th>
                  <Th>PIC</Th>
                  <Th>Keterangan</Th>
                  {/* Kategori biaya + akun bebannya (FV-58 poin 3). */}
                  <Th>Kategori</Th>
                  <Th>Tipe</Th>
                  <Th className="text-right">Masuk</Th>
                  <Th className="text-right">Keluar</Th>
                  <Th>No. Bukti</Th>
                  <ThAksi />
                </tr>
              </thead>
              <tbody>
                {rowsLoading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-km-ink-muted">Memuat…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-km-ink-muted">
                      {rentangSalah
                        ? "Perbaiki rentang tanggal"
                        : adaFilter
                          ? "Data tidak ditemukan"
                          : "Belum ada mutasi kas kecil"}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isTopup = r.subtype === "topup";
                    const amount = num(r.amount);
                    const picId = pettyCashPicId(r);
                    const c = picColor(picId != null ? picColorIndex.get(picId) ?? 0 : 0);
                    const draft = r.status === "draft";
                    return (
                      <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft" data-testid={`baris-kaskecil-${r.id}`}>
                        <Td className="whitespace-nowrap">{fmtTgl(pettyCashDate(r))}</Td>
                        <Td>
                          <span
                            className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: c.bg, color: c.text }}
                          >
                            {pettyCashPicName(r)}
                          </span>
                        </Td>
                        <Td>
                          {isTopup
                            ? pettyCashSourceLabel(r)
                              ? `Pengisian via ${pettyCashSourceLabel(r)}`
                              : "Pengisian dari Dana Tunai"
                            : (pettyCashKeterangan(r) ?? "—")}
                        </Td>
                        <Td className="whitespace-nowrap text-[11px]">
                          {r.category ? (
                            <>
                              {r.category_label ?? r.category}
                              <span className="ml-1 kode text-km-ink-muted">{r.counterpart_account_code ?? ""}</span>
                            </>
                          ) : (
                            <span className="text-km-ink-muted">—</span>
                          )}
                        </Td>
                        <Td>
                          <span className="flex items-center gap-1.5">
                            {isTopup ? (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-green-soft px-2 py-0.5 text-[11px] font-medium text-km-green">
                                Pengisian
                              </span>
                            ) : (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-red-soft px-2 py-0.5 text-[11px] font-medium text-km-red">
                                Penggunaan
                              </span>
                            )}
                            {draft && (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-amber-soft px-1.5 py-0.5 text-[10px] font-medium text-km-amber">
                                Draft
                              </span>
                            )}
                            {r.status === "cancelled" && (
                              <span
                                className="inline-flex items-center whitespace-nowrap rounded-full bg-km-red-soft px-1.5 py-0.5 text-[10px] font-medium text-km-red-ink"
                                title={r.void_reason ?? undefined}
                              >
                                Dibatalkan
                              </span>
                            )}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums text-km-green">
                          {isTopup ? fmtRp(amount) : "—"}
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums text-km-red">
                          {!isTopup ? fmtRp(amount) : "—"}
                        </Td>
                        <Td className="text-[11px] text-km-ink-muted">{r.reference || "—"}</Td>
                        <TdAksi>
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailId(r.id)}
                              data-testid={`detail-kaskecil-${r.id}`}
                              className="whitespace-nowrap text-[11px] text-km-blue hover:underline"
                            >
                              Detail
                            </button>
                            {draft && bisaCatat && (
                              <button
                                type="button"
                                onClick={() => setUbah(r)}
                                data-testid={`ubah-kaskecil-${r.id}`}
                                className="whitespace-nowrap text-[11px] text-km-ink hover:underline"
                              >
                                Ubah
                              </button>
                            )}
                            {draft && bisaCatat && (
                              <button
                                type="button"
                                onClick={() => handleHapus(r)}
                                data-testid={`hapus-kaskecil-${r.id}`}
                                className="whitespace-nowrap text-[11px] text-km-red-ink hover:underline"
                              >
                                Hapus
                              </button>
                            )}
                            {draft && bisaSetujui && (
                              <button
                                type="button"
                                onClick={() => handlePosting(r)}
                                data-testid={`posting-kaskecil-${r.id}`}
                                className="whitespace-nowrap text-[11px] font-medium text-km-green hover:underline"
                              >
                                Posting
                              </button>
                            )}
                            {canVoid && r.status === "posted" && (
                              <button
                                type="button"
                                onClick={() => handleVoid(r)}
                                data-testid={`batalkan-kaskecil-${r.id}`}
                                className="whitespace-nowrap text-[11px] text-km-red-ink hover:underline"
                              >
                                Batalkan
                              </button>
                            )}
                          </span>
                        </TdAksi>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Total periode tersaring — hanya terposting, aturan yang sama
                  dengan saldo (FV-86): untuk pertanggungjawaban PIC. */}
              {totals && !rentangSalah && (
                <tfoot className="border-t-2 border-km-border-strong bg-km-panel-soft" data-testid="kaskecil-total">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-[11px] font-medium text-km-ink-soft">
                      Total terposting {dari || sampai ? "periode ini" : "semua tanggal"}
                      {" · "}selisih{" "}
                      <span
                        data-testid="kaskecil-total-selisih"
                        className={`tabular-nums ${totals.selisih < 0 ? "text-km-red" : "text-km-ink"}`}
                      >
                        {fmtRp(totals.selisih)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-km-green" data-testid="kaskecil-total-masuk">
                      {fmtRp(totals.masuk)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-km-red" data-testid="kaskecil-total-keluar">
                      {fmtRp(totals.keluar)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="border-t border-km-border">
            <Pagination
              currentPage={halaman.current_page}
              lastPage={halaman.last_page}
              total={halaman.total}
              from={halaman.from}
              to={halaman.to}
              onChange={setPage}
              perPage={perPage}
              onPerPageChange={setPerPage}
            />
          </div>
        </Card>
      </div>

      {detailId != null && (
        <PettyCashDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={(m) => afterSaved(m)}
          onUbah={(row) => setUbah(row)}
        />
      )}

      {ubah && (
        <Modal
          title={`Ubah draft kas kecil #${ubah.id}`}
          onClose={() => setUbah(null)}
          width="max-w-lg"
          testId="ubah-kaskecil"
        >
          {ubah.subtype === "topup" ? (
            <TopupForm
              {...formProps}
              viharaId={ubah.vihara?.id ?? (ubah as { vihara_id?: number }).vihara_id ?? viharaId}
              needVihara={false}
              bankAccounts={bankAccounts}
              initial={ubah}
              onSaved={(m, tone) => {
                setUbah(null);
                afterSaved(m, tone);
              }}
              onCancel={() => setUbah(null)}
            />
          ) : (
            <UsageForm
              {...formProps}
              viharaId={ubah.vihara?.id ?? (ubah as { vihara_id?: number }).vihara_id ?? viharaId}
              needVihara={false}
              kategori={kategori}
              initial={ubah}
              onSaved={(m, tone) => {
                setUbah(null);
                afterSaved(m, tone);
              }}
              onCancel={() => setUbah(null)}
            />
          )}
        </Modal>
      )}
    </AppShell>
  );
}

type FormProps = {
  pics: PettyCashPic[];
  viharaId: number | null;
  needVihara: boolean;
  bisaSetujui: boolean;
  onSaved: (message: string, tone: "success" | "error") => void;
  onError: (message: string) => void;
  /** Isi draft yang diubah (FV-81); kosong = mutasi baru. */
  initial?: PettyCashEntry;
  onCancel?: () => void;
  /** Judul kartu, dirender di dalam form (form baru). */
  title?: string;
};

/** Field lampiran + catatan, sama di kedua form (FV-83, FV-85). */
function LampiranCatatan({
  lampiran,
  setLampiran,
  inputRef,
  notes,
  setNotes,
  adaLampiranLama,
  testPrefix,
}: {
  lampiran: File | null;
  setLampiran: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  notes: string;
  setNotes: (s: string) => void;
  adaLampiranLama: boolean;
  testPrefix: string;
}) {
  const salah = cekLampiran(lampiran);
  return (
    <>
      <Field
        label={adaLampiranLama ? "Ganti Lampiran Bukti" : "Lampiran Bukti"}
        hint={salah ?? (adaLampiranLama ? "Sudah ada lampiran. Pilih berkas baru untuk menggantinya." : "PDF, JPG, atau PNG — maksimal 10 MB.")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          data-testid={`${testPrefix}-lampiran`}
          onChange={(e) => setLampiran(e.target.files?.[0] ?? null)}
          className={`${LAMPIRAN_CLASS} ${salah ? "border-km-red" : ""}`}
        />
      </Field>
      <Field label="Catatan" hint={`${notes.length}/${CATATAN_MAKS} karakter`}>
        <Textarea
          value={notes}
          maxLength={CATATAN_MAKS}
          rows={2}
          data-testid={`${testPrefix}-catatan`}
          placeholder="Keterangan tambahan (opsional)"
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
    </>
  );
}

// ── Form Pengisian Kas Kecil ────────────────────────────────────────────────
function TopupForm({
  pics,
  bankAccounts,
  viharaId,
  needVihara,
  bisaSetujui,
  onSaved,
  onError,
  initial,
  onCancel,
  title,
}: FormProps & { bankAccounts: ViharaBankAccount[] }) {
  const edit = initial != null;
  const [date, setDate] = useState(initial ? pettyCashDate(initial) : today());
  const [picId, setPicId] = useState(initial ? String(pettyCashPicId(initial) ?? "") : "");
  const [amount, setAmount] = useState(initial ? num(initial.amount) : 0);
  const [source, setSource] = useState(
    initial?.source_bank_account?.id ? String(initial.source_bank_account.id) : "",
  ); // "" = Dana Tunai
  const [transferNote, setTransferNote] = useState(initial?.reference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lampiran, setLampiran] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (edit) return;
    setPicId("");
    setSource("");
  }, [viharaId, edit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (needVihara || !picId) return;
    const salah = cekLampiran(lampiran);
    if (salah) return onError(salah);
    setPending(true);
    try {
      const hasil = await simpanMutasi({
        editId: initial?.id ?? null,
        lampiran,
        bisaSetujui,
        isian: {
          date,
          pic_id: Number(picId),
          subtype: "topup",
          amount,
          ...(source ? { source_bank_account_id: Number(source) } : {}),
          ...(source && transferNote ? { reference: transferNote } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          vihara_id: viharaId!,
        },
      });
      if (!edit) {
        setDate(today());
        setPicId("");
        setAmount(0);
        setSource("");
        setTransferNote("");
        setNotes("");
        setLampiran(null);
        if (fileRef.current) fileRef.current.value = "";
      }
      onSaved(hasil.pesan, hasil.tone);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Gagal mencatat pengisian");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid={edit ? "form-ubah-pengisian" : "form-pengisian"}>
      {title && <CardHeader title={title} />}
      <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5">
        <Field label="Tanggal">
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="PIC Kas Kecil">
          <Select required value={picId} onChange={(e) => setPicId(e.target.value)} disabled={needVihara}>
            <option value="">— Pilih PIC —</option>
            {pics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jumlah Pengisian (Rp)">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Ambil dari">
          <Select value={source} onChange={(e) => setSource(e.target.value)} disabled={needVihara}>
            <option value="">Dana Tunai</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                Rekening {bankBrand(b.bank_name)} — {b.account_number}
              </option>
            ))}
          </Select>
        </Field>
        {source && (
          <Field label="Keterangan Transfer">
            <Input
              value={transferNote}
              placeholder="No. referensi transfer, jika ada"
              onChange={(e) => setTransferNote(e.target.value)}
            />
          </Field>
        )}
        <LampiranCatatan
          lampiran={lampiran}
          setLampiran={setLampiran}
          inputRef={fileRef}
          notes={notes}
          setNotes={setNotes}
          adaLampiranLama={!!initial?.attachment_path}
          testPrefix="pengisian"
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
        {needVihara && (
          <span className="mr-auto text-[11px] font-medium text-km-amber-ink">Pilih vihara dulu</span>
        )}
        {onCancel && (
          <Button type="button" variant="default" onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button type="submit" variant="success" disabled={pending || needVihara}>
          {pending ? "Menyimpan…" : edit ? "Simpan Perubahan" : "Catat Pengisian"}
        </Button>
      </div>
    </form>
  );
}

// ── Form Penggunaan Kas Kecil ───────────────────────────────────────────────
function UsageForm({
  pics,
  kategori,
  viharaId,
  needVihara,
  bisaSetujui,
  onSaved,
  onError,
  initial,
  onCancel,
  title,
}: FormProps & { kategori: PettyCashCategory[] }) {
  const edit = initial != null;
  const [date, setDate] = useState(initial ? pettyCashDate(initial) : today());
  const [picId, setPicId] = useState(initial ? String(pettyCashPicId(initial) ?? "") : "");
  const [kat, setKat] = useState(initial?.category ?? "");
  const [nama, setNama] = useState(initial?.name ?? "");
  const [namaList, setNamaList] = useState<TransactionName[]>([]);
  const [namaLoading, setNamaLoading] = useState(false);
  const [amount, setAmount] = useState(initial ? num(initial.amount) : 0);
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lampiran, setLampiran] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (edit) return;
    setPicId("");
  }, [viharaId, edit]);

  // Nama Pengeluaran dari master, sesuai kategori dan vihara transaksi —
  // sama dengan Input Pengeluaran (FV-82).
  useEffect(() => {
    if (!kat || viharaId == null) {
      setNamaList([]);
      return;
    }
    let alive = true;
    setNamaLoading(true);
    listTransactionNames({ type: "pengeluaran", category: kat, vihara_id: viharaId })
      .then((list) => alive && setNamaList(list))
      .catch(() => alive && setNamaList([]))
      .finally(() => alive && setNamaLoading(false));
    return () => {
      alive = false;
    };
  }, [kat, viharaId]);

  const akun = kategori.find((k) => k.key === kat)?.default_counterpart;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (needVihara || !picId) return;
    if (!kat) return onError("Kategori biaya wajib dipilih.");
    // Wajib bila kategorinya punya pilihan nama di master (FV-79, FV-82).
    if (!nama && namaList.length > 0) return onError("Nama pengeluaran wajib dipilih.");
    const salah = cekLampiran(lampiran);
    if (salah) return onError(salah);
    setPending(true);
    try {
      const hasil = await simpanMutasi({
        editId: initial?.id ?? null,
        lampiran,
        bisaSetujui,
        isian: {
          date,
          pic_id: Number(picId),
          subtype: "usage",
          amount,
          category: kat,
          ...(nama ? { name: nama } : {}),
          ...(reference ? { reference } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          vihara_id: viharaId!,
        },
      });
      if (!edit) {
        setDate(today());
        setPicId("");
        setNama("");
        setAmount(0);
        setReference("");
        setNotes("");
        setLampiran(null);
        if (fileRef.current) fileRef.current.value = "";
      }
      onSaved(hasil.pesan, hasil.tone);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Gagal mencatat penggunaan");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid={edit ? "form-ubah-penggunaan" : "form-penggunaan"}>
      {title && <CardHeader title={title} />}
      <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5">
        <Field label="Tanggal">
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="PIC Kas Kecil">
          <Select required value={picId} onChange={(e) => setPicId(e.target.value)} disabled={needVihara}>
            <option value="">— Pilih PIC —</option>
            {pics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {/* Kategori Biaya & Nama Pengeluaran dari master (FV-82). Akun beban
            mengikuti master, jadi keperluan Bhikkhu mendarat di 5100 (FV-58). */}
        <Field
          label="Kategori Biaya *"
          hint={akun ? `Dijurnal ke akun ${akun}, kecuali Nama Pengeluaran punya akun sendiri.` : undefined}
        >
          <Select
            required
            data-testid="kaskecil-kategori"
            value={kat}
            onChange={(e) => {
              setKat(e.target.value);
              setNama("");
            }}
          >
            <option value="">— Pilih kategori biaya —</option>
            {kategori.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={kat && !namaLoading && namaList.length === 0 ? "Nama Pengeluaran" : "Nama Pengeluaran *"}
          hint={kat && !namaLoading && namaList.length === 0 ? "Kategori ini tidak punya pilihan nama di master." : undefined}
        >
          <Select
            required={namaList.length > 0}
            data-testid="kaskecil-nama"
            value={nama}
            disabled={!kat || viharaId == null || namaLoading}
            onChange={(e) => setNama(e.target.value)}
          >
            <option value="">
              {!kat ? "— Pilih kategori dulu —" : namaLoading ? "Memuat…" : "— Pilih nama pengeluaran —"}
            </option>
            {namaList.map((n) => (
              <option key={n.id} value={n.name}>
                {n.name}
              </option>
            ))}
            {/* Draft lama yang namanya sudah tidak ada di daftar tetap terlihat. */}
            {nama && !namaList.some((n) => n.name === nama) && !namaLoading && (
              <option value={nama}>{nama}</option>
            )}
          </Select>
        </Field>
        {edit && !initial?.name && initial?.description && (
          <p className="text-[11px] text-km-ink-muted">Keperluan lama: {initial.description}</p>
        )}
        <Field label="Jumlah (Rp)">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="No. Bukti / Kuitansi">
          <Input value={reference} placeholder="BKK-001" onChange={(e) => setReference(e.target.value)} />
        </Field>
        <LampiranCatatan
          lampiran={lampiran}
          setLampiran={setLampiran}
          inputRef={fileRef}
          notes={notes}
          setNotes={setNotes}
          adaLampiranLama={!!initial?.attachment_path}
          testPrefix="penggunaan"
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
        {needVihara && (
          <span className="mr-auto text-[11px] font-medium text-km-amber-ink">Pilih vihara dulu</span>
        )}
        {onCancel && (
          <Button type="button" variant="default" onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button type="submit" variant="danger" disabled={pending || needVihara}>
          {pending ? "Menyimpan…" : edit ? "Simpan Perubahan" : "Catat Penggunaan"}
        </Button>
      </div>
    </form>
  );
}
