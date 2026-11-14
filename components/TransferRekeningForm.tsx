"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { bankBrand, listViharaBankAccounts, ViharaBankAccount } from "@/lib/kasBank";

// ============================================================================
// Transfer antar rekening (FV-56).
//
// Konsekuensi langsung dari aturan "seluruh pengeluaran keluar dari Bank
// Operasional": donasi masuk ke Bank Donasi, jadi harus ada jalan
// memindahkannya sebelum bisa dibelanjakan. Tanpa layar ini aturan itu justru
// mengunci aplikasinya.
//
// Yang dicatat hanya perpindahan kas — bukan pendapatan atau beban. Pembatasan
// dananya tidak ikut pindah: itu dilacak di aset neto dan dilepas saat dananya
// dipakai sesuai tujuannya (FV-55).
// ============================================================================

const today = () => new Date().toISOString().slice(0, 10);

export function TransferRekeningForm({
  viharaId,
  onClose,
  onSelesai,
}: {
  /** Vihara yang sedang dipilih di header; boleh null (tingkat yayasan). */
  viharaId: number | null;
  onClose: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [rekening, setRekening] = useState<ViharaBankAccount[]>([]);
  const [dari, setDari] = useState("");
  const [ke, setKe] = useState("");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [catatan, setCatatan] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listViharaBankAccounts(viharaId, "bank")
      .then((list) => alive && setRekening(list.filter((b) => b.active)))
      .catch(() => alive && setRekening([]));
    return () => {
      alive = false;
    };
  }, [viharaId]);

  const label = (b: ViharaBankAccount) =>
    `${bankBrand(b.bank_name)} — ${b.account_number ?? "—"}` +
    (b.coa_account_code ? ` · akun ${b.coa_account_code}` : "");

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api(`/api/kas-bank/transfer`, {
        method: "POST",
        body: JSON.stringify({
          from_bank_account_id: Number(dari),
          to_bank_account_id: Number(ke),
          date,
          amount,
          vihara_id: viharaId ?? undefined,
          description: catatan || undefined,
        }),
      });
      onSelesai("Transfer antar rekening tercatat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat transfer");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title="Transfer Antar Rekening"
      onClose={onClose}
      onSubmit={simpan}
      testId="form-transfer-rekening"
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={pending || !dari || !ke || amount <= 0}
            data-testid="simpan-transfer"
          >
            {pending ? "Menyimpan…" : "Catat Transfer"}
          </Button>
        </>
      }
    >
      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2.5">
        <p className="rounded-lg border border-km-blue-soft bg-km-blue-soft px-3 py-2 text-[11px] leading-relaxed text-km-blue-ink">
          Memindahkan dana antar rekening milik yayasan yang sama. Tidak dicatat sebagai
          penerimaan maupun pengeluaran, dan tidak mengubah pembatasan dana.
        </p>
        <Field label="Dari rekening *">
          <Select
            required
            data-testid="transfer-dari"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
          >
            <option value="">— Pilih rekening asal —</option>
            {rekening.map((b) => (
              <option key={b.id} value={b.id}>
                {label(b)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ke rekening *">
          <Select required data-testid="transfer-ke" value={ke} onChange={(e) => setKe(e.target.value)}>
            <option value="">— Pilih rekening tujuan —</option>
            {rekening
              .filter((b) => String(b.id) !== dari)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {label(b)}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Tanggal *">
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Jumlah (Rp) *">
          <MoneyInput value={amount} onChange={setAmount} data-testid="transfer-jumlah" />
        </Field>
        <Field label="Catatan">
          <Textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
