"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag, DANA_CATEGORY_LABEL, GrayTag } from "@/components/DanaTag";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/Field";
import { Toast } from "@/components/Toast";
import { bankBrand, listViharaBankAccounts, ViharaBankAccount } from "@/lib/kasBank";
import { createPenerimaan, postPenerimaan } from "@/lib/penerimaan";
import { listTransactionNames, TransactionName } from "@/lib/transactionNames";
import { listTransactions, TransactionRow } from "@/lib/transactions";
import { useAuth } from "@/lib/useAuth";
import { useVihara } from "@/lib/useVihara";

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const DANA_CATEGORIES = [
  "dana_bhikkhu",
  "dana_operasional",
  "dana_paramita",
  "dana_perayaan",
] as const;

const METHOD_LABEL: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer Bank",
  auto_credit: "Auto Credit",
};

const today = () => new Date().toISOString().slice(0, 10);

export default function PenerimaanPage() {
  const { user } = useAuth();
  const { viharaId, fixed, ready: viharaReady } = useVihara();

  // ----- form state -----
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"tunai" | "transfer">("tunai");
  const [destAccount, setDestAccount] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const receivedByTouched = useRef(false);

  // ----- masters -----
  const [names, setNames] = useState<TransactionName[]>([]);
  const [namesLoading, setNamesLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<ViharaBankAccount[]>([]);

  // ----- tabel hari ini -----
  const [todayRows, setTodayRows] = useState<TransactionRow[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);

  // Prefill "Diterima oleh" dengan nama user login (sekali, selama belum diedit).
  useEffect(() => {
    if (user && !receivedByTouched.current) setReceivedBy(user.name);
  }, [user]);

  // Rekening tujuan mengikuti vihara aktif — refetch saat selector berubah.
  useEffect(() => {
    if (!viharaReady) return;
    setDestAccount("");
    if (viharaId == null) {
      setBankAccounts([]);
      return;
    }
    listViharaBankAccounts(viharaId)
      .then((list) => setBankAccounts(list.filter((b) => b.active)))
      .catch(() => setBankAccounts([]));
  }, [viharaId, viharaReady]);

  // Cascade: kategori → daftar nama penerimaan.
  useEffect(() => {
    setName("");
    if (!category) {
      setNames([]);
      return;
    }
    let alive = true;
    setNamesLoading(true);
    listTransactionNames({ type: "penerimaan", category })
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
  }, [category]);

  const reloadToday = useCallback(() => {
    if (!viharaReady) return;
    setTodayLoading(true);
    const d = today();
    listTransactions({
      tipe: "Penerimaan",
      from: d,
      to: d,
      vihara_id: viharaId,
      per_page: 100,
    })
      .then((res) => setTodayRows(res.data))
      .catch(() => setTodayRows([]))
      .finally(() => setTodayLoading(false));
  }, [viharaId, viharaReady]);

  useEffect(() => {
    reloadToday();
  }, [reloadToday]);

  const needVihara = !fixed && viharaId == null;

  function resetForm() {
    setDate(today());
    setAmount(0);
    setCategory("");
    setName("");
    setMethod("tunai");
    setDestAccount("");
    setNotes("");
    setError(null);
    receivedByTouched.current = false;
    setReceivedBy(user?.name ?? "");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (needVihara) return;
    setError(null);
    setPending(true);
    try {
      const created = await createPenerimaan({
        date,
        amount,
        category,
        name,
        method,
        bank_account_id:
          method === "transfer" && destAccount ? Number(destAccount) : undefined,
        received_by: receivedBy || null,
        description: notes || null,
        ...(fixed ? {} : { vihara_id: viharaId! }),
      });
      await postPenerimaan(created.id);
      setToast("Penerimaan berhasil disimpan");
      resetForm();
      reloadToday();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan penerimaan");
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell title="Input Penerimaan" subtitle="Catat dana masuk ke vihara">
      {toast && (
        <Toast message={toast} tone="success" onClose={() => setToast(null)} />
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader
            title="Input Penerimaan Dana"
            subtitle="Pilih kategori dana terlebih dahulu"
          />
          <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-2">
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
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">— Pilih kategori dana —</option>
                {DANA_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DANA_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nama Penerimaan *">
              <Select
                required
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
            <Field label="Metode Penerimaan *">
              <Select
                required
                value={method}
                onChange={(e) => setMethod(e.target.value as "tunai" | "transfer")}
              >
                <option value="tunai">Tunai</option>
                <option value="transfer">Transfer Bank</option>
              </Select>
            </Field>
            {method === "transfer" && (
              <Field label="Rekening Tujuan">
                <Select
                  value={destAccount}
                  onChange={(e) => setDestAccount(e.target.value)}
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
            )}
            <Field label="Diterima oleh">
              <Input
                value={receivedBy}
                placeholder="Nama bendahara / admin"
                onChange={(e) => {
                  receivedByTouched.current = true;
                  setReceivedBy(e.target.value);
                }}
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
            {needVihara && (
              <span className="mr-auto text-[11px] font-medium text-km-amber-ink">
                Pilih vihara dulu di header
              </span>
            )}
            <Button type="button" variant="ghost" onClick={resetForm}>
              Reset
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={pending || needVihara}
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
              {pending ? "Menyimpan…" : "Simpan Penerimaan"}
            </Button>
          </div>
        </Card>
      </form>

      <Card className="mt-3.5">
        <CardHeader title="Penerimaan Hari Ini" />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                <Th>Tanggal</Th>
                <Th>Nama Penerimaan</Th>
                <Th>Kategori Dana</Th>
                <Th>Metode</Th>
                <Th className="text-right">Jumlah</Th>
              </tr>
            </thead>
            <tbody>
              {todayLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : todayRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-km-ink-muted">
                    Belum ada penerimaan hari ini
                  </td>
                </tr>
              ) : (
                todayRows.map((r) => (
                  <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft">
                    <Td>{r.date.slice(0, 10)}</Td>
                    <Td>{r.name}</Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td>
                      <GrayTag>{METHOD_LABEL[r.method] ?? r.method}</GrayTag>
                    </Td>
                    <Td className="text-right font-mono tabular-nums font-medium text-km-green">
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
