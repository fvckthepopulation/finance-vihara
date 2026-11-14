"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Td, TdAksi, Th, ThAksi } from "@/components/Tabel";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag, DANA_CATEGORY_LABEL, debetDanaCategory } from "@/components/DanaTag";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/Field";
import { PenerimaInput } from "@/components/PenerimaInput";
import { Toast } from "@/components/Toast";
import { YayasanViharaFields, YayasanViharaValue } from "@/components/YayasanViharaFields";
import { NoTransaksi } from "@/components/NoTransaksi";
import { PembayaranDetail } from "@/components/PembayaranDetail";
import { bankBrand, listViharaBankAccounts, ViharaBankAccount } from "@/lib/kasBank";
import {
  createPembayaran,
  fetchPembayaranAttachment,
  getPembayaran,
  postPembayaran,
  PembayaranStatus,
  STATUS_LABEL,
  STATUS_TONE,
  submitPembayaran,
  updatePembayaran,
  uploadPembayaranAttachment,
} from "@/lib/pembayaran";
import { listTransactionNames, TransactionName } from "@/lib/transactionNames";
import { listTransactions, TransactionRow } from "@/lib/transactions";
import { useAuth } from "@/lib/useAuth";
import { useVihara } from "@/lib/useVihara";

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const BIAYA_CATEGORIES = [
  "biaya_bhikkhu",
  "biaya_operasional",
  "biaya_paramita",
  "biaya_perayaan",
] as const;

const today = () => new Date().toISOString().slice(0, 10);

export default function PembayaranPage() {
  // useSearchParams butuh batas Suspense saat halaman di-prerender.
  return (
    <Suspense fallback={null}>
      <IsiPembayaran />
    </Suspense>
  );
}

function IsiPembayaran() {
  // Header hanya menyaring TABEL di bawah. Transaksi memakai Yayasan/Vihara
  // dari form — lihat komentar di YayasanViharaFields.
  const { viharaId: headerViharaId, ready: viharaReady } = useVihara();

  // ----- form state -----
  const { can } = useAuth();
  const bisaSetujui = can("pembayaran.approve");
  const bisaCatat = can("pembayaran.create");
  const [scope, setScope] = useState<YayasanViharaValue>({ entityId: null, viharaId: null });
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [sourceAccount, setSourceAccount] = useState("");
  const [payeeName, setPayeeName] = useState("");
  // Terisi kalau nama yang dipakai cocok dengan master (FV-31); dikirim ke
  // server sebagai payee_id supaya rekap per penerima bisa diandalkan.
  const [payeeId, setPayeeId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  // null = tidak ada yang berjalan; selain itu aksi yang sedang jalan.
  const [pending, setPending] = useState<Aksi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  // Draft yang sedang diubah (FV-46). Form yang dipakai SAMA dengan form
  // input baru — dulu modal tersendiri, yang isinya sempat menyimpang dari
  // form aslinya (field Metode hilang, tanda wajib tidak lengkap).
  const router = useRouter();
  const draftParam = useSearchParams().get("draft");
  const draftId = draftParam ? Number(draftParam) : null;
  const [draftKode, setDraftKode] = useState<string | null>(null);
  const [draftLampiran, setDraftLampiran] = useState<string | null>(null);
  const [memuatDraft, setMemuatDraft] = useState(false);
  // Filter status tabel di bawah form (FV-21 poin 4).
  const [filterStatus, setFilterStatus] = useState<"" | PembayaranStatus>("");
  // Input file tidak terkendali React; perlu ref untuk mengosongkannya.
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ----- masters -----
  const [names, setNames] = useState<TransactionName[]>([]);
  const [namesLoading, setNamesLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<ViharaBankAccount[]>([]);

  // ----- tabel hari ini -----
  const [todayRows, setTodayRows] = useState<TransactionRow[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);

  // Rekening sumber mengikuti vihara yang dipilih DI FORM. Mengganti vihara
  // (termasuk lewat penggantian yayasan) mengosongkan rekening, karena
  // rekening milik vihara lama tidak sah untuk vihara baru.
  const formViharaId = scope.viharaId;
  useEffect(() => {
    // Saat memuat draft, rekeningnya baru saja diisi dari data — jangan
    // dikosongkan lagi oleh efek ini.
    if (!memuatDraft) setSourceAccount("");
    if (formViharaId == null) {
      setBankAccounts([]);
      return;
    }
    let alive = true;
    // Hanya rekening jenis Bank: metode pembayaran di layar ini memang
    // Transfer Bank (pengeluaran tunai lewat Kas Kecil), jadi kas tunai tidak
    // boleh ikut muncul di "Transfer dari Rekening" (FV-30).
    //
    // Disaring juga menurut KATEGORI BIAYA (FV-56): tiap kategori punya akun
    // bank yang sah, dan rekening di luar itu tidak boleh ditawarkan.
    listViharaBankAccounts(formViharaId, "bank", category || undefined)
      .then((list) => alive && setBankAccounts(list.filter((b) => b.active)))
      .catch(() => alive && setBankAccounts([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formViharaId, category]);

  // Cascade: vihara + kategori biaya → daftar nama pengeluaran.
  // Vihara ikut jadi kunci: ada item yang khusus satu vihara, dan item itu
  // tidak boleh muncul di vihara lain. Mengganti vihara memuat ulang daftar.
  useEffect(() => {
    setName("");
    if (!category || formViharaId == null) {
      setNames([]);
      return;
    }
    let alive = true;
    setNamesLoading(true);
    listTransactionNames({ type: "pengeluaran", category, vihara_id: formViharaId })
      .then((list) => {
        if (alive) setNames(list);
      })
      .catch(() => {
        if (alive) setNames([]);
      })
      .finally(() => {
        if (alive) setNamesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category, formViharaId]);

  // Isi form dari draft. Yayasan & Vihara ikut terisi tapi dikunci: draft
  // melekat pada viharanya (aturan yang sudah berlaku sejak FV-44).
  useEffect(() => {
    if (draftId == null) return;
    let alive = true;
    setMemuatDraft(true);
    getPembayaran(draftId)
      .then((d) => {
        if (!alive) return;
        setDraftKode(d.code);
        setScope({ entityId: d.entity_id ?? null, viharaId: d.vihara?.id ?? null });
        setDate(d.date.slice(0, 10));
        setAmount(Number(d.amount) || 0);
        setCategory(d.category ?? "");
        setName(d.name ?? "");
        setSourceAccount(d.bank_account?.id != null ? String(d.bank_account.id) : "");
        setPayeeName(d.payee_name ?? "");
        setPayeeId(d.payee_id ?? null);
        setReference(d.reference ?? "");
        setNotes(d.description ?? "");
        setDraftLampiran(d.attachment_path ?? null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Gagal memuat draft"))
      .finally(() => alive && setMemuatDraft(false));
    return () => {
      alive = false;
    };
  }, [draftId]);

  const reloadToday = useCallback(() => {
    if (!viharaReady) return;
    setTodayLoading(true);
    const d = today();
    listTransactions({
      tipe: "Pengeluaran",
      from: d,
      to: d,
      vihara_id: headerViharaId,
      status: filterStatus || undefined,
      per_page: 100,
    })
      .then((res) => setTodayRows(res.data))
      .catch(() => setTodayRows([]))
      .finally(() => setTodayLoading(false));
  }, [headerViharaId, viharaReady, filterStatus]);

  useEffect(() => {
    reloadToday();
  }, [reloadToday]);

  // Yang menahan simpan sekarang isi form, bukan pilihan header.
  const needVihara = scope.viharaId == null;
  const needRekening = sourceAccount === "";

  function resetForm({ keepScope = false }: { keepScope?: boolean } = {}) {
    if (!keepScope) setScope({ entityId: null, viharaId: null });
    setDate(today());
    setAmount(0);
    setCategory("");
    setName("");
    setSourceAccount("");
    setPayeeName("");
    setPayeeId(null);
    setReference("");
    setNotes("");
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
    setError(null);
  }

  type Aksi = "draft" | "ajukan" | "submit";

  /**
   * Tiga aksi, satu jalur simpan.
   *
   * Dulu tombolnya cuma satu dan artinya berubah diam-diam menurut izin
   * pengguna: "Simpan sebagai Draft" sebenarnya langsung mengajukan. Sekarang
   * niatnya dinyatakan di tombol, dan server memeriksa izinnya sendiri —
   * tombol yang hilang bukan satu-satunya penjaga.
   */
  async function simpan(aksi: Aksi) {
    if (scope.entityId == null) {
      setError("Yayasan wajib dipilih.");
      return;
    }
    if (scope.viharaId == null) {
      setError("Vihara wajib dipilih.");
      return;
    }
    // Draft boleh setengah jadi; yang naik ke persetujuan harus lengkap.
    if (aksi !== "draft" && !sourceAccount) {
      setError("Transfer dari Rekening wajib dipilih.");
      return;
    }
    setError(null);
    setPending(aksi);
    try {
      const isian = {
        date,
        amount: amount || undefined,
        category: category || undefined,
        name: name || undefined,
        method: "transfer" as const,
        bank_account_id: sourceAccount ? Number(sourceAccount) : undefined,
        payee_name: payeeName || null,
        payee_id: payeeId,
        reference: reference || null,
        description: notes || null,
      };

      // Draft yang sudah ada DIPERBARUI, bukan dibuat ulang: nomor
      // transaksinya tetap, sesuai FV-46 poin 6.
      const baris =
        draftId != null
          ? await updatePembayaran(draftId, isian)
          : await createPembayaran({
              ...isian,
              vihara_id: scope.viharaId,
              draft: aksi === "draft",
            });

      // Lampiran diunggah selagi masih draft: kalau gagal, transaksi belum
      // naik ke mana pun dan bisa diulang.
      if (attachment) {
        await uploadPembayaranAttachment(baris.id, attachment);
      }

      if (aksi === "ajukan") {
        await submitPembayaran(baris.id);
        setToast("Pengeluaran diajukan — menunggu persetujuan");
      } else if (aksi === "submit") {
        await postPembayaran(baris.id);
        setToast("Pengeluaran disimpan dan disetujui");
      } else {
        setToast(
          draftId != null
            ? "Draft diperbarui — statusnya tetap Draft"
            : "Tersimpan sebagai draft — belum diajukan",
        );
      }

      if (draftId != null) {
        // Kembali ke daftar, seperti yang diminta FV-46 poin 6.
        router.push("/pengeluaran");
        return;
      }

      resetForm({ keepScope: true });
      reloadToday();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengeluaran");
    } finally {
      setPending(null);
    }
  }

  return (
    <AppShell
      title={draftKode ? `Ubah Draft ${draftKode}` : "Input Pengeluaran"}
      subtitle={
        draftKode
          ? "Melanjutkan draft — nomor transaksinya tetap"
          : "Catat dana keluar dari vihara"
      }
    >
      {toast && (
        <Toast message={toast} tone="success" onClose={() => setToast(null)} />
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        <Card>
          <CardHeader
            title={draftKode ? `Ubah Draft ${draftKode}` : "Input Pengeluaran"}
            subtitle={
              draftKode
                ? "Yayasan dan Vihara draft tidak bisa dipindah"
                : "Pilih yayasan dan vihara terlebih dahulu"
            }
          />
          <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-2">
            <YayasanViharaFields
              value={scope}
              onChange={setScope}
              disabled={pending !== null || draftId != null || memuatDraft}
            />
            <Field label="Tanggal *">
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Jumlah (Rp) *">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Kategori Biaya *">
              <Select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">— Pilih kategori biaya —</option>
                {BIAYA_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DANA_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nama Pengeluaran *">
              <Select
                required
                disabled={!category || formViharaId == null || namesLoading}
                value={name}
                onChange={(e) => setName(e.target.value)}
              >
                <option value="">
                  {formViharaId == null
                    ? "— Pilih vihara dulu —"
                    : !category
                      ? "— Pilih kategori biaya dulu —"
                      : namesLoading
                        ? "Memuat…"
                        : "— Pilih nama pengeluaran —"}
                </option>
                {names.map((n) => (
                  <option key={n.id} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Metode Pembayaran *">
              <Select required value="transfer" onChange={() => {}}>
                <option value="transfer">Transfer Bank</option>
              </Select>
            </Field>
            {/* Wajib: Input Pengeluaran hanya untuk Transfer Bank (yang tunai
                lewat Kas Kecil), dan rekening sumberlah yang menentukan akun
                kredit di jurnal — 1120 atau 1130. Tanpa itu jurnal dan saldo
                bank tidak bisa ditentukan. */}
            <Field
              label="Transfer dari Rekening *"
              hint={
                formViharaId == null
                  ? "Pilih vihara dulu — pilihan rekening mengikuti yayasannya."
                  : category && bankAccounts.length === 0
                    ? "Belum ada rekening yang sesuai untuk kategori biaya ini. Daftarkan rekeningnya di Admin → Master Rekening."
                    : undefined
              }
            >
              <Select
                required
                data-testid="form-rekening"
                disabled={formViharaId == null}
                value={sourceAccount}
                onChange={(e) => setSourceAccount(e.target.value)}
              >
                <option value="">— Pilih rekening —</option>
                {/* Pemilik rekening adalah YAYASAN (FV-36), jadi itulah yang
                    disebut di label — bukan "atas nama", yang pada data lama
                    masih berisi nama vihara dan menyesatkan. */}
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {bankBrand(b.bank_name)} — {b.account_number}
                    {b.entity_name ? ` (${b.entity_name})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Dibayarkan kepada / PIC"
              hint="Ketik untuk melihat saran dari master; nama baru tetap boleh diisi bebas."
            >
              <PenerimaInput
                value={payeeName}
                payeeId={payeeId}
                onChange={(nama, id) => {
                  setPayeeName(nama);
                  setPayeeId(id);
                }}
                onError={setError}
              />
            </Field>
            <Field label="No. Bukti / Referensi">
              <Input
                value={reference}
                placeholder="No. kuitansi / invoice"
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
            <Field
              label={draftLampiran ? "Ganti Lampiran Bukti" : "Lampiran Bukti"}
              hint="PDF, JPG, atau PNG — maksimal 10 MB."
            >
              {draftLampiran && draftId != null && (
                <p className="mb-1 text-[11px] text-km-ink-muted">
                  Lampiran saat ini:{" "}
                  <button
                    type="button"
                    data-testid="lampiran-draft"
                    className="text-km-blue hover:underline"
                    onClick={async () => {
                      try {
                        const blob = await fetchPembayaranAttachment(draftId);
                        window.open(URL.createObjectURL(blob), "_blank", "noopener");
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Gagal membuka lampiran");
                      }
                    }}
                  >
                    {draftLampiran.split("/").pop()}
                  </button>
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                data-testid="form-lampiran"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-km-border-strong bg-km-panel px-2.5 py-1.5 text-[12px] text-km-ink file:mr-2 file:rounded-md file:border-0 file:bg-km-panel-soft file:px-2 file:py-1 file:text-[11px] file:text-km-ink-soft"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Catatan">
                <Textarea
                  value={notes}
                  placeholder="Keterangan tambahan (opsional)"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </div>
          </div>
          {error && (
            <p className="mx-4 mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
            {(needVihara || needRekening) && (
              <span className="mr-auto text-[11px] font-medium text-km-amber-ink">
                {needVihara
                  ? "Pilih yayasan dan vihara dulu"
                  : /* Draft boleh tanpa rekening; yang naik ke persetujuan tidak. */
                    "Pilih rekening sumber dulu"}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => (draftId != null ? router.push("/pengeluaran") : resetForm())}
              data-testid={draftId != null ? "tombol-batal" : "tombol-reset"}
            >
              {draftId != null ? "Batal" : "Reset"}
            </Button>
            {bisaCatat && (
              <Button
                type="button"
                variant="default"
                disabled={pending !== null || needVihara}
                onClick={() => simpan("draft")}
                data-testid="tombol-draft"
              >
                {pending === "draft"
                  ? "Menyimpan…"
                  : draftId != null
                    ? "Simpan Draft"
                    : "Simpan sebagai Draft"}
              </Button>
            )}
            {bisaCatat && (
              <Button
                type="button"
                variant="primary"
                disabled={pending !== null || needVihara || needRekening}
                onClick={() => simpan("ajukan")}
                data-testid="tombol-ajukan"
              >
                {pending === "ajukan" ? "Mengajukan…" : "Ajukan Persetujuan"}
              </Button>
            )}
            {bisaCatat && bisaSetujui && (
              <Button
                type="button"
                variant="danger"
                disabled={pending !== null || needVihara || needRekening}
                onClick={() => simpan("submit")}
                data-testid="tombol-submit"
              >
                {pending === "submit" ? "Menyimpan…" : "Submit Pengeluaran"}
              </Button>
            )}
          </div>
        </Card>
      </form>

      <Card className="mt-3.5">
        <CardHeader
          title="Pengeluaran Hari Ini"
          subtitle={
            <a
              href="/pengeluaran"
              className="text-km-blue hover:underline"
              data-testid="link-semua-pengeluaran"
            >
              Lihat semua pengeluaran →
            </a>
          }
          right={
            <label className="flex items-center gap-2 text-[11px] text-km-ink-muted">
              Status
              <Select
                data-testid="filter-status-tabel"
                className="w-48"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "" | PembayaranStatus)}
              >
                <option value="">Semua status</option>
                {(Object.keys(STATUS_LABEL) as PembayaranStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </option>
                ))}
              </Select>
            </label>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                {/* No. Transaksi jadi kolom pertama (FV-40): nomor itulah
                    yang dipakai saat merujuk transaksi ke approver atau
                    mencocokkannya dengan jurnal. */}
                <Th>No. Transaksi</Th>
                <Th>Tanggal</Th>
                {/* Vihara & Rekening: saat header "Semua Vihara", tanpa dua
                    kolom ini admin tidak bisa membedakan baris milik vihara
                    mana dan dibayar dari rekening mana — salah input baru
                    ketahuan saat rekonsiliasi. */}
                <Th>Vihara</Th>
                <Th>Nama Pengeluaran</Th>
                <Th>Kategori Biaya</Th>
                <Th>Debet Dana</Th>
                <Th>Rekening</Th>
                <Th className="text-right">Jumlah</Th>
                <Th>Status</Th>
                <ThAksi />
              </tr>
            </thead>
            <tbody>
              {todayLoading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : todayRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-km-ink-muted">
                    Belum ada pengeluaran hari ini
                  </td>
                </tr>
              ) : (
                todayRows.map((r) => (
                  <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft">
                    <Td>
                      <NoTransaksi
                        code={r.code}
                        onClick={() => setDetailId(r.id)}
                        testId={`no-transaksi-${r.id}`}
                      />
                    </Td>
                    <Td>{r.date.slice(0, 10)}</Td>
                    <Td className="whitespace-nowrap">{r.vihara_name ?? "—"}</Td>
                    <Td>{r.name}</Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td>
                      <DanaTag category={debetDanaCategory(r.category)} />
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums text-[11px] text-km-ink-soft">
                      {r.bank_label ?? "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums font-medium text-km-red">
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
                        onClick={() => setDetailId(r.id)}
                        data-testid={`detail-pengeluaran-${r.id}`}
                      >
                        Detail
                      </Button>
                    </TdAksi>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {detailId != null && (
        <PembayaranDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={reloadToday}
        />
      )}
    </AppShell>
  );
}
