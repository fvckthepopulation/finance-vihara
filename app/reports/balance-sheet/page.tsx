"use client";

import { useEffect, useState } from "react";
import { getEntities, formatIDR, type Entity } from "@/lib/shared";
import { getBalanceSheet, type BalanceSheet, type BSSection } from "@/lib/financials";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { Field, Input, Select } from "@/components/Field";
import { Metric } from "@/components/Metric";

const today = () => new Date().toLocaleDateString("en-CA");

const ASSET_KEYS = ["Aset Lancar", "Aset Tetap", "Aset Lainnya"];

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [asOf, setAsOf] = useState(today());
  const [entityId, setEntityId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntities().then(setEntities).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getBalanceSheet({ as_of_date: asOf, entity_id: entityId === "" ? undefined : entityId })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [asOf, entityId]);

  return (
    <AppShell
      title="Neraca"
      subtitle="F6.2 — Balance Sheet"
      actions={
        <>
          <div className="w-36">
            <Field label="Per tanggal">
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
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
        <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Metric label="Total Aset" value={formatIDR(data.summary.total_asset)} tone="success" />
            <Metric label="Total Kewajiban" value={formatIDR(data.summary.total_liability)} />
            <Metric label="Total Ekuitas" value={formatIDR(data.summary.total_equity)} />
            <Metric
              label="Balance Check"
              value={formatIDR(Math.abs(data.summary.balance_check))}
              tone={Math.abs(data.summary.balance_check) < 0.01 ? "success" : "danger"}
              sub={Math.abs(data.summary.balance_check) < 0.01 ? "✓ Balanced" : "Selisih!"}
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Card>
              <table className="w-full text-[13px]">
                <thead className="bg-km-panel-soft">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted" colSpan={2}>
                      Aset
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.sections
                    .filter((s) => ASSET_KEYS.includes(s.label))
                    .map((s) => renderSection(s))}
                  <tr className="border-t-2 border-km-border-strong">
                    <td className="px-4 py-3 text-[13px] font-bold text-km-ink">
                      TOTAL ASET
                    </td>
                    <td className="px-4 py-3 text-right text-[14px] font-bold text-km-teal-ink">
                      {formatIDR(data.summary.total_asset)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <Card>
              <table className="w-full text-[13px]">
                <thead className="bg-km-panel-soft">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted" colSpan={2}>
                      Kewajiban + Ekuitas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.sections
                    .filter((s) => !ASSET_KEYS.includes(s.label))
                    .map((s) => renderSection(s))}
                  <tr className="border-t-2 border-km-border-strong">
                    <td className="px-4 py-3 text-[13px] font-bold text-km-ink">
                      TOTAL KEWAJIBAN + EKUITAS
                    </td>
                    <td className="px-4 py-3 text-right text-[14px] font-bold text-km-teal-ink">
                      {formatIDR(data.summary.total_liability_equity)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function renderSection(s: BSSection) {
  if (s.rows.length === 0) return null;
  return (
    <>
      <tr key={`s-${s.label}`} className="bg-km-panel-soft">
        <td className="px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-km-ink" colSpan={2}>
          {s.label}
        </td>
      </tr>
      {s.rows.map((r) => (
        <tr key={r.code} className="border-t border-km-border">
          <td className="px-4 py-1.5 pl-8 text-km-ink">
            <span className="text-[11px] text-km-ink-muted mr-2">{r.code}</span>
            {r.name}
            {r.synthetic && <span className="ml-1 text-[10px] text-km-amber-deep">⭐</span>}
          </td>
          <td className="px-4 py-1.5 text-right text-km-ink">{formatIDR(r.balance)}</td>
        </tr>
      ))}
      <tr className="border-t border-km-border bg-km-panel-soft">
        <td className="px-4 py-2 pl-8 text-[12px] font-semibold text-km-ink">
          Total {s.label}
        </td>
        <td className="px-4 py-2 text-right font-semibold text-km-ink">
          {formatIDR(s.total)}
        </td>
      </tr>
    </>
  );
}
