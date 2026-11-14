"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import {
  BankBook,
  getBankBook,
  reconcileJournalLine,
} from "@/lib/cash";
import { formatIDR } from "@/lib/shared";
import { AppShell } from "@/components/AppShell";
import { Td, Th } from "@/components/Tabel";
import { Badge } from "@/components/Badge";
import { Card, CardHeader } from "@/components/Card";
import { Field, Input, Select } from "@/components/Field";
import { Metric } from "@/components/Metric";

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
};

const today = () => new Date().toLocaleDateString("en-CA");

export default function BankBookPage({
  params,
}: {
  params: Promise<{ accountCode: string }>;
}) {
  const { accountCode } = use(params);
  const decoded = decodeURIComponent(accountCode);

  const [data, setData] = useState<BankBook | null>(null);
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(today());
  const [reconStatus, setReconStatus] = useState<"" | "reconciled" | "unreconciled">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getBankBook(decoded, { start_date: start, end_date: end, recon_status: reconStatus })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [decoded, start, end, reconStatus]);

  useEffect(load, [load]);

  async function toggleReconcile(lineId: number, currentReconciled: boolean) {
    setUpdating(lineId);
    try {
      await reconcileJournalLine(lineId, { reconciled: !currentReconciled });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal update");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <AppShell
      title={data ? `${data.account.code} — ${data.account.name}` : decoded}
      subtitle="Buku besar rekening + rekonsiliasi bank"
      actions={
        <>
          <div className="w-36">
            <Field label="Dari">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
          </div>
          <div className="w-36">
            <Field label="Sampai">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <div className="w-44">
            <Field label="Status rekon">
              <Select value={reconStatus} onChange={(e) => setReconStatus(e.target.value as "" | "reconciled" | "unreconciled")}>
                <option value="">Semua</option>
                <option value="reconciled">Sudah cocok</option>
                <option value="unreconciled">Belum cocok</option>
              </Select>
            </Field>
          </div>
        </>
      }
    >
      <div className="space-y-3.5">
        <Link href="/cash" className="inline-block text-[12px] text-km-ink-muted hover:underline">
          ← Kembali ke dashboard kas
        </Link>

        {error && (
          <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
            {error}
          </p>
        )}

        {loading && <p className="text-[12px] text-km-ink-muted">Memuat…</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Metric label="Saldo Awal" value={formatIDR(data.opening_balance)} />
              <Metric
                label="Total Masuk"
                value={formatIDR(data.totals.debit)}
                tone="success"
              />
              <Metric
                label="Total Keluar"
                value={formatIDR(data.totals.credit)}
                tone="danger"
              />
              <Metric
                label="Saldo Akhir"
                value={formatIDR(data.closing_balance)}
                tone={data.closing_balance >= 0 ? "success" : "danger"}
                sub={`${data.totals.reconciled_count}/${data.totals.count} cocok`}
              />
            </div>

            <Card>
              <CardHeader
                title="Mutasi"
                subtitle="Centang kalau cocok dengan rekening koran"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-km-panel-soft">
                    <tr>
                      <Th className="w-12 text-center">Cocok?</Th>
                      <Th>Tanggal</Th>
                      <Th>Keterangan</Th>
                      <Th>Referensi</Th>
                      <Th className="whitespace-nowrap text-right">Masuk</Th>
                      <Th className="whitespace-nowrap text-right">Keluar</Th>
                      <Th className="whitespace-nowrap text-right">Saldo</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-km-ink-muted">
                          Tidak ada mutasi pada periode ini.
                        </td>
                      </tr>
                    )}
                    {data.rows.map((r) => {
                      const isRecon = !!r.reconciled_at;
                      return (
                        <tr
                          key={r.id}
                          className={`border-t border-km-border ${isRecon ? "bg-km-teal-soft/30" : ""}`}
                        >
                          <Td className="text-center">
                            <input
                              type="checkbox"
                              checked={isRecon}
                              disabled={updating === r.id}
                              onChange={() => toggleReconcile(r.id, isRecon)}
                              className="h-4 w-4 cursor-pointer accent-km-teal"
                            />
                          </Td>
                          <Td>{r.entry_date.slice(0, 10)}</Td>
                          <Td>
                            <p>{r.description || r.entry_description}</p>
                            {r.bank_statement_ref && (
                              <p className="text-[10px] text-km-ink-muted">Statement: {r.bank_statement_ref}</p>
                            )}
                          </Td>
                          <Td>
                            {r.reference_type ? (
                              <Badge tone={r.reference_type === "ar_payment" || r.reference_type === "ar_invoice" ? "info" : "warn"}>
                                {r.reference_type}
                              </Badge>
                            ) : "—"}
                          </Td>
                          <Td className="whitespace-nowrap text-right tabular-nums">
                            {r.debit > 0 ? <span className="text-km-teal-ink font-medium">{formatIDR(r.debit)}</span> : "—"}
                          </Td>
                          <Td className="whitespace-nowrap text-right tabular-nums">
                            {r.credit > 0 ? <span className="text-km-red-ink font-medium">{formatIDR(r.credit)}</span> : "—"}
                          </Td>
                          <Td className={`text-right font-semibold ${r.running_balance < 0 ? "text-km-red-ink" : ""}`}>
                            {formatIDR(r.running_balance)}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-km-panel-soft">
                    <tr className="border-t-2 border-km-border-strong font-semibold">
                      <Td colSpan={4} className="text-[11px] uppercase text-km-ink-muted">
                        Total movement
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatIDR(data.totals.debit)}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatIDR(data.totals.credit)}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatIDR(data.closing_balance)}</Td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
