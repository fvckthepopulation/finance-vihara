"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PenerimaInput } from "@/components/PenerimaInput";
import { bankBrand, listViharaBankAccounts, ViharaBankAccount } from "@/lib/kasBank";
import {
  CategoryOption,
  getPenerimaanCategories,
  Penerimaan,
  updatePenerimaan,
  uploadPenerimaanAttachment,
} from "@/lib/penerimaan";
import { listTransactionNames, TransactionName } from "@/lib/transactionNames";

// ============================================================================
// Ubah draft penerimaan (FV-45 poin 2, mengikuti FV-44).
//
// Sama seperti pada pengeluaran: Yayasan dan Vihara ditampilkan tapi tidak
// bisa diubah — draft melekat pada viharanya, dan memindahkannya berarti
// memindahkan transaksi antar jangkauan akses. Status tetap Draft sesudah
// disimpan; mengajukannya tindakan tersendiri.
// ============================================================================

export function PenerimaanDraftForm({
  row,
  onClose,
  onSaved,
}: {
  row: Penerimaan;
  onClose: () => void;
  onSaved: (pesan: string) => void;
}) {
  const [date, setDate] = useState(row.date.slice(0, 10));
  const [amount, setAmount] = useState(Number(row.amount) || 0);
  const [category, setCategory] = useState(row.category ?? "");
  const [name, setName] = useState(row.name ?? "");
  const [method, setMethod] = useState<"tunai" | "transfer">(
    row.method === "transfer" ? "transfer" : "tunai",
  );
  const [rekening, setRekening] = useState(
    row.bank_account?.id != null ? String(row.bank_account.id) : "",
  );
  const [donatur, setDonatur] = useState(row.source_name ?? "");
  const [donaturId, setDonaturId] = useState<number | null>(row.source_payee_id ?? null);
  const [reference, setReference] = useState(row.reference ?? "");
  const [notes, setNotes] = useState(row.description ?? "");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [kategori, setKategori] = useState<CategoryOption[]>([]);
  const [names, setNames] = useState<TransactionName[]>([]);
  const [namesLoading, setNamesLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<ViharaBankAccount[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const viharaId = row.vihara?.id ?? row.vihara_id ?? null;

  useEffect(() => {
    let alive = true;
    getPenerimaanCategories()
      .then((list) => alive && setKategori(list))
      .catch(() => alive && setKategori([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (viharaId == null) return;
    let alive = true;
    listViharaBankAccounts(viharaId, "bank")
      .then((list) => alive && setBankAccounts(list.filter((b) => b.active)))
      .catch(() => alive && setBankAccounts([]));
    return () => {
      alive = false;
    };
  }, [viharaId]);

  useEffect(() => {
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

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updatePenerimaan(row.id, {
        date,
        method,
        amount: amount || undefined,
        category: category || undefined,
        name: name || undefined,
        // Tunai tidak lewat rekening: kirim null supaya tujuannya kembali ke
        // Kas Penerimaan Langsung kalau metodenya diubah dari transfer.
        bank_account_id: method === "transfer" && rekening ? Number(rekening) : null,
        source_name: donatur || null,
        source_payee_id: donaturId,
        reference: reference || null,
        description: notes || null,
      });
      if (attachment) {
        await uploadPenerimaanAttachment(row.id, attachment);
      }
      onSaved("Draft diperbarui — statusnya tetap Draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan draft");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={`Ubah Draft ${row.code}`}
      onClose={onClose}
      onSubmit={simpan}
      width="max-w-2xl"
      testId="form-ubah-penerimaan"
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={pending} data-testid="simpan-draft">
            {pending ? "Menyimpan…" : "Simpan Draft"}
          </Button>
        </>
      }
    >
      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label="Yayasan" hint="Mengikuti vihara draft ini — tidak bisa dipindah.">
          <Input value={row.entity?.legal_name ?? "—"} disabled readOnly />
        </Field>
        <Field label="Vihara">
          <Input value={row.vihara?.name ?? "—"} disabled readOnly />
        </Field>
        <Field label="Tanggal *">
          <Input
            type="date"
            required
            data-testid="ubah-tanggal"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Jumlah (Rp)">
          <MoneyInput value={amount} onChange={setAmount} data-testid="ubah-jumlah" />
        </Field>
        <Field label="Kategori Dana">
          <Select
            data-testid="ubah-kategori"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setName("");
            }}
          >
            <option value="">— Pilih kategori dana —</option>
            {kategori.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nama Penerimaan">
          <Select
            data-testid="ubah-nama"
            disabled={!category || namesLoading}
            value={name}
            onChange={(e) => setName(e.target.value)}
          >
            <option value="">
              {!category
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
        <Field label="Metode Penerimaan">
          <Select
            data-testid="ubah-metode"
            value={method}
            onChange={(e) => setMethod(e.target.value as "tunai" | "transfer")}
          >
            <option value="tunai">Tunai</option>
            <option value="transfer">Transfer Bank</option>
          </Select>
        </Field>
        {method === "transfer" ? (
          <Field label="Rekening Tujuan">
            <Select
              data-testid="ubah-rekening"
              value={rekening}
              onChange={(e) => setRekening(e.target.value)}
            >
              <option value="">— Pilih rekening —</option>
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
        <Field label="Donatur / Sumber">
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
            data-testid="ubah-referensi"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <Field
          label="Ganti Lampiran Bukti"
          hint={
            row.attachment_path
              ? "Sudah ada lampiran; memilih berkas baru menggantinya."
              : "PDF, JPG, atau PNG — maksimal 10 MB."
          }
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            data-testid="ubah-lampiran"
            onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-km-border-strong bg-km-panel px-2.5 py-1.5 text-[12px] text-km-ink file:mr-2 file:rounded-md file:border-0 file:bg-km-panel-soft file:px-2 file:py-1 file:text-[11px] file:text-km-ink-soft"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Catatan">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
