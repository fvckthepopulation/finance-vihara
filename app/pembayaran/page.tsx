"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag, DANA_CATEGORY_LABEL, debetDanaCategory } from "@/components/DanaTag";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/Field";
import { Toast } from "@/components/Toast";
import { YayasanViharaFields, YayasanViharaValue } from "@/components/YayasanViharaFields";
import { bankBrand, listViharaBankAccounts, ViharaBankAccount } from "@/lib/kasBank";
import {
  createPembayaran,
  postPembayaran,
  uploadPembayaranAttachment,
} from "@/lib/pembayaran";
import { listTransactionNames, TransactionName } from "@/lib/transactionNames";
import { listTransactions, TransactionRow } from "@/lib/transactions";
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
  // Header hanya menyaring TABEL di bawah. Transaksi memakai Yayasan/Vihara
  // dari form — lihat komentar di YayasanViharaFields.
  const { viharaId: headerViharaId, ready: viharaReady } = useVihara();

  // ----- form state -----
  const [scope, setScope] = useState<YayasanViharaValue>({ entityId: null, viharaId: null });
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [sourceAccount, setSourceAccount] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [reference, setReference] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
    setSourceAccount("");
    if (formViharaId == null) {
      setBankAccounts([]);
      return;
    }
    let alive = true;
    listViharaBankAccounts(formViharaId)
      .then((list) => alive && setBankAccounts(list.filter((b) => b.active)))
      .catch(() => alive && setBankAccounts([]));
    return () => {
      alive = false;
    };
  }, [formViharaId]);

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

  const reloadToday = useCallback(() => {
    if (!viharaReady) return;
    setTodayLoading(true);
    const d = today();
    listTransactions({
      tipe: "Pengeluaran",
      from: d,
      to: d,
      vihara_id: headerViharaId,
      per_page: 100,
    })
      .then((res) => setTodayRows(res.data))
      .catch(() => setTodayRows([]))
      .finally(() => setTodayLoading(false));
  }, [headerViharaId, viharaReady]);

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
    setReference("");
    setApprovedBy("");
    setNotes("");
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (scope.entityId == null) {
      setError("Yayasan wajib dipilih.");
      return;
    }
    if (scope.viharaId == null) {
      setError("Vihara wajib dipilih.");
      return;
    }
    if (!sourceAccount) {
      setError("Transfer dari Rekening wajib dipilih.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const created = await createPembayaran({
        date,
        amount,
        category,
        name,
        method: "transfer",
        bank_account_id: sourceAccount ? Number(sourceAccount) : undefined,
        payee_name: payeeName || null,
        reference: reference || null,
        approved_by_name: approvedBy || null,
        description: notes || null,
        // Selalu eksplisit: vihara transaksi adalah isi form, apa pun yang
        // sedang dipilih di header. Yayasan diturunkan server dari vihara ini.
        vihara_id: scope.viharaId,
      });
      // Lampiran diunggah selagi transaksi masih draft. Kalau unggahannya
      // gagal, transaksi belum terposting dan bisa diulang — lebih baik
      // daripada pengeluaran terposting tanpa bukti yang dikira sudah ada.
      if (attachment) {
        await uploadPembayaranAttachment(created.id, attachment);
      }
      await postPembayaran(created.id);
      setToast(
        attachment
          ? "Pengeluaran berhasil disimpan beserta lampirannya"
          : "Pengeluaran berhasil disimpan",
      );
      // Yayasan/vihara dipertahankan supaya entri berikutnya untuk vihara
      // yang sama tidak perlu dipilih ulang.
      resetForm({ keepScope: true });
      reloadToday();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengeluaran");
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell title="Input Pengeluaran" subtitle="Catat dana keluar dari vihara">
      {toast && (
        <Toast message={toast} tone="success" onClose={() => setToast(null)} />
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader
            title="Input Pengeluaran"
            subtitle="Pilih yayasan dan vihara terlebih dahulu"
          />
          <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-2">
            <YayasanViharaFields value={scope} onChange={setScope} disabled={pending} />
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
                  ? "Pilih vihara dulu — rekening mengikuti viharanya."
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
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {bankBrand(b.bank_name)} — {b.account_number}
                    {b.account_name ? ` (${b.account_name})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dibayarkan kepada / PIC">
              <Input
                value={payeeName}
                placeholder="Nama vendor / penerima"
                onChange={(e) => setPayeeName(e.target.value)}
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
              label="Lampiran Bukti"
              hint="PDF, JPG, atau PNG — maksimal 10 MB."
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                data-testid="form-lampiran"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-km-border-strong bg-km-panel px-2.5 py-1.5 text-[12px] text-km-ink file:mr-2 file:rounded-md file:border-0 file:bg-km-panel-soft file:px-2 file:py-1 file:text-[11px] file:text-km-ink-soft"
              />
            </Field>
            <Field label="Disetujui oleh">
              <Input
                value={approvedBy}
                placeholder="Nama approver"
                onChange={(e) => setApprovedBy(e.target.value)}
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
            <p className="mx-4 mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
            {(needVihara || needRekening) && (
              <span className="mr-auto text-[11px] font-medium text-km-amber-ink">
                {needVihara
                  ? "Pilih yayasan dan vihara dulu"
                  : "Pilih rekening sumber dulu"}
              </span>
            )}
            <Button type="button" variant="ghost" onClick={() => resetForm()}>
              Reset
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={pending || needVihara || needRekening}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3 w-3"
              >
                <path d="M3 8l4 4 6-7" />
              </svg>
              {pending ? "Menyimpan…" : "Simpan Pengeluaran"}
            </Button>
          </div>
        </Card>
      </form>

      <Card className="mt-3.5">
        <CardHeader title="Pengeluaran Hari Ini" />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
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
              </tr>
            </thead>
            <tbody>
              {todayLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : todayRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-km-ink-muted">
                    Belum ada pengeluaran hari ini
                  </td>
                </tr>
              ) : (
                todayRows.map((r) => (
                  <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft">
                    <Td>{r.date.slice(0, 10)}</Td>
                    <Td className="whitespace-nowrap">{r.vihara_name ?? "—"}</Td>
                    <Td>{r.name}</Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td>
                      <DanaTag category={debetDanaCategory(r.category)} />
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[11px] text-km-ink-soft">
                      {r.bank_label ?? "—"}
                    </Td>
                    <Td className="text-right font-mono tabular-nums font-medium text-km-red">
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
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
