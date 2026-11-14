"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Td, TdAksi, Th, ThAksi } from "@/components/Tabel";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag, GrayTag } from "@/components/DanaTag";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/Field";
import { NoTransaksi } from "@/components/NoTransaksi";
import { PenerimaanDetail } from "@/components/PenerimaanDetail";
import { PenerimaInput } from "@/components/PenerimaInput";
import { Toast } from "@/components/Toast";
import { YayasanViharaFields, YayasanViharaValue } from "@/components/YayasanViharaFields";
import { bankBrand, listViharaBankAccounts, ViharaBankAccount } from "@/lib/kasBank";
import {
  CategoryOption,
  createPenerimaan,
  fetchPenerimaanAttachment,
  getPenerimaan,
  getPenerimaanCategories,
  PenerimaanStatus,
  postPenerimaan,
  STATUS_LABEL,
  STATUS_TONE,
  submitPenerimaan,
  updatePenerimaan,
  uploadPenerimaanAttachment,
} from "@/lib/penerimaan";
import { listTransactionNames, TransactionName } from "@/lib/transactionNames";
import { listTransactions, TransactionRow } from "@/lib/transactions";
import { useAuth } from "@/lib/useAuth";
import { useVihara } from "@/lib/useVihara";

// ============================================================================
// Input Penerimaan (FV-45).
//
// Alur penerimaan pada dasarnya sama dengan pengeluaran — yang berbeda hanya
// arah dananya — jadi layar ini sengaja dibuat sebangun dengan Input
// Pengeluaran: tiga tombol niat (draft / ajukan / submit), rekening dari
// master yayasan, No. Bukti dan lampiran, serta tabel hari ini yang memuat
// No. Transaksi, Status, dan tombol Detail. Komponen detailnya pun sama
// (TransaksiDetail), supaya perbaikan berikutnya langsung berlaku di keduanya.
//
// Dua hal yang khas penerimaan:
//   - Metode Tunai tidak punya rekening: dananya masuk ke Kas Penerimaan
//     Langsung (1115). Rekening tujuan hanya muncul untuk Transfer.
//   - "Diterima oleh" diisi dari akun yang login dan tidak bisa diketik.
//     Dulu field ini bebas, jadi nama di layar belum tentu orang yang
//     benar-benar menerima dananya.
// ============================================================================

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const METHOD_LABEL: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer Bank",
  auto_credit: "Auto Credit",
};

const today = () => new Date().toISOString().slice(0, 10);

type Aksi = "draft" | "ajukan" | "submit";

export default function PenerimaanPage() {
  // useSearchParams butuh batas Suspense saat halaman di-prerender.
  return (
    <Suspense fallback={null}>
      <IsiPenerimaan />
    </Suspense>
  );
}

function IsiPenerimaan() {
  const { user, can } = useAuth();
  // Header hanya menyaring tabel di bawah form. Vihara transaksi berasal
  // dari form — alasannya sama dengan Input Pengeluaran.
  const { viharaId: headerViharaId, ready: viharaReady } = useVihara();
  const bisaCatat = can("penerimaan.create");
  const bisaSetujui = can("penerimaan.approve");

  const [scope, setScope] = useState<YayasanViharaValue>({ entityId: null, viharaId: null });
  const viharaId = scope.viharaId;

  // ----- form state -----
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"tunai" | "transfer">("tunai");
  const [destAccount, setDestAccount] = useState("");
  const [donatur, setDonatur] = useState("");
  const [donaturId, setDonaturId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [pending, setPending] = useState<Aksi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"" | PenerimaanStatus>("");
  // Draft yang sedang diubah — form yang dipakai sama dengan input baru
  // (FV-46, diterapkan juga di sini supaya kedua modul tidak menyimpang).
  const router = useRouter();
  const draftParam = useSearchParams().get("draft");
  const draftId = draftParam ? Number(draftParam) : null;
  const [draftKode, setDraftKode] = useState<string | null>(null);
  const [draftLampiran, setDraftLampiran] = useState<string | null>(null);
  const [memuatDraft, setMemuatDraft] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ----- masters -----
  const [kategori, setKategori] = useState<CategoryOption[]>([]);
  const [names, setNames] = useState<TransactionName[]>([]);
  const [namesLoading, setNamesLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<ViharaBankAccount[]>([]);

  // ----- tabel hari ini -----
  const [todayRows, setTodayRows] = useState<TransactionRow[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);

  // Kategori Dana dari master (FV-45 poin 5) — kategori yang baru ditambah
  // admin langsung muncul, tanpa rilis baru.
  useEffect(() => {
    let alive = true;
    getPenerimaanCategories()
      .then((list) => alive && setKategori(list))
      .catch(() => alive && setKategori([]));
    return () => {
      alive = false;
    };
  }, []);

  // Rekening tujuan mengikuti vihara yang dipilih DI FORM; hanya rekening
  // jenis Bank, karena yang tunai tidak lewat rekening.
  useEffect(() => {
    setDestAccount("");
    if (viharaId == null) {
      setBankAccounts([]);
      return;
    }
    let alive = true;
    listViharaBankAccounts(viharaId, "bank")
      .then((list) => alive && setBankAccounts(list.filter((b) => b.active)))
      .catch(() => alive && setBankAccounts([]));
    return () => {
      alive = false;
    };
  }, [viharaId]);

  // Cascade: vihara + kategori dana → daftar Nama Penerimaan. Vihara ikut
  // jadi kunci karena ada item khusus satu vihara.
  useEffect(() => {
    setName("");
    if (!category || viharaId == null) {
      setNames([]);
      return;
    }
    let alive = true;
    setNamesLoading(true);
    listTransactionNames({ type: "penerimaan", category, vihara_id: viharaId })
      .then((list) => alive && setNames(list))
      .catch(() => alive && setNames([]))
      .finally(() => alive && setNamesLoading(false));
    return () => {
      alive = false;
    };
  }, [category, viharaId]);

  useEffect(() => {
    if (draftId == null) return;
    let alive = true;
    setMemuatDraft(true);
    getPenerimaan(draftId)
      .then((d) => {
        if (!alive) return;
        setDraftKode(d.code);
        setScope({ entityId: d.entity_id ?? null, viharaId: d.vihara?.id ?? null });
        setDate(d.date.slice(0, 10));
        setAmount(Number(d.amount) || 0);
        setCategory(d.category ?? "");
        setName(d.name ?? "");
        setMethod(d.method === "transfer" ? "transfer" : "tunai");
        setDestAccount(d.bank_account?.id != null ? String(d.bank_account.id) : "");
        setDonatur(d.source_name ?? "");
        setDonaturId(d.source_payee_id ?? null);
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
      tipe: "Penerimaan",
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

  const needVihara = viharaId == null;
  // Draft boleh setengah jadi; yang naik ke persetujuan harus punya rekening
  // tujuan bila metodenya transfer — akun debit jurnalnya dari situ.
  const needRekening = method === "transfer" && destAccount === "";
  // Penahan lama (FV-9) tetap berlaku untuk Ajukan dan Submit: kesalahan
  // tercegah sebelum request terkirim, bukan dijelaskan sesudahnya. Simpan
  // sebagai Draft sengaja TIDAK ditahan — draft memang boleh setengah jadi.
  const needJumlah = !amount || amount <= 0;

  function resetForm({ keepScope = false }: { keepScope?: boolean } = {}) {
    if (!keepScope) setScope({ entityId: null, viharaId: null });
    setDate(today());
    setAmount(0);
    setCategory("");
    setName("");
    setMethod("tunai");
    setDestAccount("");
    setDonatur("");
    setDonaturId(null);
    setReference("");
    setNotes("");
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
    setError(null);
  }

  /**
   * Tiga aksi, satu jalur simpan — persis seperti Input Pengeluaran.
   * Niatnya dinyatakan di tombol, dan server memeriksa izinnya sendiri.
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
    if (aksi !== "draft" && needRekening) {
      setError("Rekening Tujuan wajib dipilih untuk metode Transfer.");
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
        method,
        // Tunai tidak lewat rekening: null mengembalikan tujuannya ke Kas
        // Penerimaan Langsung kalau metodenya diubah dari transfer.
        bank_account_id: method === "transfer" && destAccount ? Number(destAccount) : null,
        source_name: donatur || null,
        source_payee_id: donaturId,
        reference: reference || null,
        description: notes || null,
      };

      const baris =
        draftId != null
          ? await updatePenerimaan(draftId, isian)
          : await createPenerimaan({
              ...isian,
              vihara_id: scope.viharaId,
              draft: aksi === "draft",
            });

      // Lampiran diunggah selagi masih draft: kalau gagal, transaksi belum
      // naik ke mana pun dan bisa diulang.
      if (attachment) {
        await uploadPenerimaanAttachment(baris.id, attachment);
      }

      if (aksi === "ajukan") {
        await submitPenerimaan(baris.id);
        setToast("Penerimaan diajukan — menunggu persetujuan");
      } else if (aksi === "submit") {
        await postPenerimaan(baris.id);
        setToast("Penerimaan disimpan dan disetujui");
      } else {
        setToast(
          draftId != null
            ? "Draft diperbarui — statusnya tetap Draft"
            : "Tersimpan sebagai draft — belum diajukan",
        );
      }

      if (draftId != null) {
        router.push("/penerimaan/daftar");
        return;
      }

      resetForm({ keepScope: true });
      reloadToday();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan penerimaan");
    } finally {
      setPending(null);
    }
  }

  return (
    <AppShell
      title={draftKode ? `Ubah Draft ${draftKode}` : "Input Penerimaan"}
      subtitle={
        draftKode
          ? "Melanjutkan draft — nomor transaksinya tetap"
          : "Catat dana masuk ke vihara"
      }
    >
      {toast && <Toast message={toast} tone="success" onClose={() => setToast(null)} />}

      <form onSubmit={(e) => e.preventDefault()}>
        <Card>
          <CardHeader
            title={draftKode ? `Ubah Draft ${draftKode}` : "Input Penerimaan Dana"}
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
            <Field label="Kategori Dana *">
              <Select
                required
                data-testid="form-kategori"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">— Pilih kategori dana —</option>
                {kategori.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nama Penerimaan *">
              <Select
                required
                data-testid="form-nama"
                disabled={!category || viharaId == null || namesLoading}
                value={name}
                onChange={(e) => setName(e.target.value)}
              >
                <option value="">
                  {viharaId == null
                    ? "— Pilih vihara dulu —"
                    : !category
                      ? "— Pilih kategori dana dulu —"
                      : namesLoading
                        ? "Memuat…"
                        : "— Pilih nama penerimaan —"}
                </option>
                {names.map((n) => (
                  <option key={n.id} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Metode Penerimaan *">
              <Select
                required
                data-testid="form-metode"
                value={method}
                onChange={(e) => setMethod(e.target.value as "tunai" | "transfer")}
              >
                <option value="tunai">Tunai</option>
                <option value="transfer">Transfer Bank</option>
              </Select>
            </Field>
            {method === "transfer" ? (
              <Field
                label="Rekening Tujuan *"
                hint={
                  viharaId == null
                    ? "Pilih vihara dulu — pilihan rekening mengikuti yayasannya."
                    : undefined
                }
              >
                <Select
                  data-testid="form-rekening"
                  disabled={viharaId == null}
                  value={destAccount}
                  onChange={(e) => setDestAccount(e.target.value)}
                >
                  <option value="">— Pilih rekening —</option>
                  {/* Pemilik rekening adalah YAYASAN (FV-36). */}
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {bankBrand(b.bank_name)} — {b.account_number}
                      {b.entity_name ? ` (${b.entity_name})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Masuk ke" hint="Metode Tunai tidak lewat rekening.">
                <Input value="Kas Penerimaan Langsung" disabled readOnly />
              </Field>
            )}
            <Field
              label="Donatur / Sumber"
              hint="Ketik untuk melihat saran dari master; nama baru tetap boleh diisi bebas."
            >
              <PenerimaInput
                value={donatur}
                payeeId={donaturId}
                onChange={(nama, id) => {
                  setDonatur(nama);
                  setDonaturId(id);
                }}
                onError={setError}
              />
            </Field>
            <Field label="No. Bukti / Referensi">
              <Input
                data-testid="form-referensi"
                value={reference}
                placeholder="No. kuitansi / bukti transfer"
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
            <Field
              label="Diterima oleh"
              hint="Diisi otomatis dari akun yang login — tidak bisa diubah."
            >
              <Input value={user?.name ?? "—"} disabled readOnly data-testid="form-diterima" />
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
                        const blob = await fetchPenerimaanAttachment(draftId);
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
            <p className="mx-4 mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
            {(needVihara || needRekening || needJumlah) && (
              <span className="mr-auto text-[11px] font-medium text-km-amber-ink">
                {needVihara
                  ? "Pilih yayasan dan vihara dulu"
                  : needRekening
                    ? /* Draft boleh tanpa rekening; yang naik ke persetujuan tidak. */
                      "Pilih rekening tujuan dulu"
                    : "Isi jumlah dulu"}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => (draftId != null ? router.push("/penerimaan/daftar") : resetForm())}
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
                disabled={pending !== null || needVihara || needRekening || needJumlah}
                onClick={() => simpan("ajukan")}
                data-testid="tombol-ajukan"
              >
                {pending === "ajukan" ? "Mengajukan…" : "Ajukan Persetujuan"}
              </Button>
            )}
            {bisaCatat && bisaSetujui && (
              <Button
                type="button"
                variant="success"
                disabled={pending !== null || needVihara || needRekening || needJumlah}
                onClick={() => simpan("submit")}
                data-testid="tombol-submit"
              >
                {pending === "submit" ? "Menyimpan…" : "Submit Penerimaan"}
              </Button>
            )}
          </div>
        </Card>
      </form>

      <Card className="mt-3.5">
        <CardHeader
          title="Penerimaan Hari Ini"
          subtitle={
            <a
              href="/penerimaan/daftar"
              className="text-km-blue hover:underline"
              data-testid="link-semua-penerimaan"
            >
              Lihat semua penerimaan →
            </a>
          }
          right={
            <label className="flex items-center gap-2 text-[11px] text-km-ink-muted">
              Status
              <Select
                data-testid="filter-status-tabel"
                className="w-48"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "" | PenerimaanStatus)}
              >
                <option value="">Semua status</option>
                {(Object.keys(STATUS_LABEL) as PenerimaanStatus[]).map((k) => (
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
                <Th>No. Transaksi</Th>
                <Th>Tanggal</Th>
                <Th>Vihara</Th>
                <Th>Nama Penerimaan</Th>
                <Th>Kategori Dana</Th>
                <Th>Metode</Th>
                <Th>Masuk ke</Th>
                <Th className="whitespace-nowrap text-right">Jumlah</Th>
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
                    Belum ada penerimaan hari ini
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
                    <Td>{r.name ?? "—"}</Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td>
                      <GrayTag>{METHOD_LABEL[r.method] ?? r.method}</GrayTag>
                    </Td>
                    <Td className="kode whitespace-nowrap text-[11px] text-km-ink-soft">
                      {r.bank_label ?? "Kas Penerimaan Langsung"}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium tabular-nums text-km-green">
                      {fmtRp(r.amount)}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status as PenerimaanStatus] ?? "neutral"}>
                        {STATUS_LABEL[r.status as PenerimaanStatus] ?? r.status}
                      </Badge>
                    </Td>
                    <TdAksi>
                      <Button
                        size="sm"
                        variant="default"
                        className="min-h-[32px]"
                        onClick={() => setDetailId(r.id)}
                        data-testid={`detail-penerimaan-${r.id}`}
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
        <PenerimaanDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={reloadToday}
        />
      )}
    </AppShell>
  );
}
