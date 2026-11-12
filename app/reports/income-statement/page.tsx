"use client";

import { useEffect, useState } from "react";
import { getEntities, formatIDR, type Entity } from "@/lib/shared";
import { getIncomeStatement, type IncomeStatement } from "@/lib/financials";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { Field, Input, Select } from "@/components/Field";
import { Metric } from "@/components/Metric";

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
};
const today = () => new Date().toLocaleDateString("en-CA");

export default function IncomeStatementPage() {
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(today());
  const [entityId, setEntityId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntities().then(setEntities).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getIncomeStatement({
      period_start: start,
      period_end: end,
      entity_id: entityId === "" ? undefined : entityId,
    })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [start, end, entityId]);

  return (
    <AppShell
      title="Laporan Laba Rugi"
      subtitle="F6.1 — Income Statement / Profit & Loss"
      actions={
        <>
          <div className="w-32">
            <Field label="Dari">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
          </div>
          <div className="w-32">
            <Field label="Sampai">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Entity">
              <Select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">Konsolidasi</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.code}</option>
                ))}
              </Select>
            </Field>
          </div>
        </>
      }
    >
      {loading && <p className="text-[12px] text-km-ink-muted">Memuat…</p>}
      {error && (
        <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Metric label="Total Pendapatan" value={formatIDR(data.summary.total_revenue)} tone="success" />
            <Metric label="Gross Profit" value={formatIDR(data.summary.gross_profit)} />
            <Metric label="Operating Income" value={formatIDR(data.summary.operating_income)} />
            <Metric
              label="Net Income"
              value={formatIDR(data.summary.net_income)}
              tone={data.summary.net_income >= 0 ? "success" : "danger"}
              sub={data.summary.net_income >= 0 ? "Laba" : "Rugi"}
            />
          </div>

          <Card>
            <table className="w-full text-[13px]">
              <thead className="bg-km-panel-soft">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted">
                    Akun
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-km-ink-muted">
                    Jumlah
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((section) => {
                  if (section.rows.length === 0) return null;
                  return (
                    <>
                      <tr key={`s-${section.label}`} className="bg-km-panel-soft">
                        <td className="px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-km-ink" colSpan={2}>
                          {section.label}
                        </td>
                      </tr>
                      {section.rows.map((r) => (
                        <tr key={r.code} className="border-t border-km-border">
                          <td className="px-4 py-1.5 pl-8 text-km-ink">
                            <span className="text-[11px] text-km-ink-muted mr-2">{r.code}</span>
                            {r.name}
                          </td>
                          <td className="px-4 py-1.5 text-right text-km-ink">{formatIDR(r.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-km-border bg-km-panel-soft">
                        <td className="px-4 py-2 pl-8 text-[12px] font-semibold text-km-ink">
                          Total {section.label}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-km-ink">
                          {formatIDR(section.total)}
                        </td>
                      </tr>
                    </>
                  );
                })}
                <tr className="border-t-2 border-km-border-strong">
                  <td className="px-4 py-3 text-[14px] font-bold text-km-ink">
                    LABA / (RUGI) BERSIH
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-[16px] font-bold ${
                      data.summary.net_income >= 0 ? "text-km-teal-ink" : "text-km-red-ink"
                    }`}
                  >
                    {formatIDR(data.summary.net_income)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
