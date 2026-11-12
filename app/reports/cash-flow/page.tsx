"use client";

import { useEffect, useState } from "react";
import { getEntities, formatIDR, type Entity } from "@/lib/shared";
import { getCashFlow, type CashFlow } from "@/lib/financials";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { Field, Input, Select } from "@/components/Field";
import { Metric } from "@/components/Metric";

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
};
const today = () => new Date().toLocaleDateString("en-CA");

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlow | null>(null);
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
    getCashFlow({
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
      title="Laporan Arus Kas"
      subtitle="F6.3 — Cash Flow Statement"
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
            <Metric label="Opening Cash" value={formatIDR(data.summary.opening_cash)} />
            <Metric label="Total Masuk" value={formatIDR(data.summary.total_inflow)} tone="success" />
            <Metric label="Total Keluar" value={formatIDR(data.summary.total_outflow)} tone="danger" />
            <Metric
              label="Closing Cash"
              value={formatIDR(data.summary.closing_cash)}
              tone={data.summary.closing_cash >= 0 ? "success" : "danger"}
              sub={`Net ${data.summary.net_movement >= 0 ? "+" : ""}${formatIDR(data.summary.net_movement)}`}
            />
          </div>

          <Card>
            <table className="w-full text-[13px]">
              <thead className="bg-km-panel-soft">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted">
                    Kategori
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-km-ink-muted">
                    Masuk
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-km-ink-muted">
                    Keluar
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-km-ink-muted">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((s) => (
                  <tr key={s.key} className="border-t border-km-border">
                    <td className="px-4 py-2 font-medium text-km-ink">{s.label}</td>
                    <td className="px-4 py-2 text-right text-km-teal-ink">
                      {s.inflow > 0 ? formatIDR(s.inflow) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-km-red-ink">
                      {s.outflow > 0 ? formatIDR(s.outflow) : "—"}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-semibold ${
                        s.net >= 0 ? "text-km-teal-ink" : "text-km-red-ink"
                      }`}
                    >
                      {formatIDR(s.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-km-panel-soft">
                <tr className="border-t-2 border-km-border-strong font-semibold">
                  <td className="px-4 py-2.5 text-km-ink">Total movement</td>
                  <td className="px-4 py-2.5 text-right text-km-teal-ink">{formatIDR(data.summary.total_inflow)}</td>
                  <td className="px-4 py-2.5 text-right text-km-red-ink">{formatIDR(data.summary.total_outflow)}</td>
                  <td
                    className={`px-4 py-2.5 text-right ${
                      data.summary.net_movement >= 0 ? "text-km-teal-ink" : "text-km-red-ink"
                    }`}
                  >
                    {formatIDR(data.summary.net_movement)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
