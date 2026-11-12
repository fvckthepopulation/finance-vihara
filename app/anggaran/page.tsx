"use client";

import { ReactNode, SelectHTMLAttributes, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag, danaCategoryLabel } from "@/components/DanaTag";
import { MoneyInput } from "@/components/Field";
import { Toast } from "@/components/Toast";
import {
  AnggaranItemInput,
  AnggaranResponse,
  getAnggaran,
  saveAnggaran,
} from "@/lib/anggaran";
import { num } from "@/lib/kasBank";
import { TransactionName, listTransactionNames } from "@/lib/transactionNames";
import { useAuth } from "@/lib/useAuth";
import { useVihara } from "@/lib/useVihara";

const fmtRp = (n: number) =>
  (n < 0 ? "-" : "") + "Rp " + Math.round(Math.abs(n)).toLocaleString("id-ID");

const pctOf = (real: number, target: number) =>
  target > 0 ? Math.round((real / target) * 100) : 0;

function TopbarSelect({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-lg border border-km-border-strong bg-km-panel px-2 py-1.5 text-[12px] text-km-ink ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

// Progress bar ala mockup .prog-bar / .prog-fill (tinggi 5px + label %).
function ProgBar({ pct, fill }: { pct: number; fill: string }) {
  return (
    <div className="flex min-w-[140px] items-center gap-2">
      <div className="h-[5px] flex-1 overflow-hidden rounded bg-km-border/60">
        <div
          className="h-full rounded transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: fill }}
        />
      </div>
      <span className="min-w-[32px] text-[11px] tabular-nums text-km-ink-muted">{pct}%</span>
    </div>
  );
}

function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10.5px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle text-km-ink ${className}`}>{children}</td>;
}

// Baris detail lokal — gabungan dari API + baris baru yang ditambah user.
type DetailRow = { category: string; name: string; target: number; realisasi: number };

const detKey = (r: { category: string; name: string }) => `${r.category}|${r.name}`;

export default function AnggaranPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<AnggaranResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  // Nilai editable lokal + set kunci yang berubah (dikirim saat Simpan).
  const [penTargets, setPenTargets] = useState<Record<string, number>>({});
  const [pengTargets, setPengTargets] = useState<Record<string, number>>({});
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const [names, setNames] = useState<TransactionName[]>([]);
  const { viharaId, ready: viharaReady } = useVihara();
  const { can } = useAuth();
  const canManage = can("anggaran.manage");

  const refetch = useCallback(() => {
    if (!viharaReady || viharaId == null) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getAnggaran({ year, vihara_id: viharaId })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setPenTargets(Object.fromEntries(d.penerimaan.map((r) => [r.category, num(r.target)])));
        setPengTargets(Object.fromEntries(d.pengeluaran.map((r) => [r.category, num(r.target)])));
        setDetailRows(
          d.detail.map((r) => ({
            category: r.category,
            name: r.name,
            target: num(r.target),
            realisasi: num(r.realisasi),
          })),
        );
        setDirty(new Set());
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Gagal memuat");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [year, viharaId, viharaReady]);

  useEffect(() => refetch(), [refetch]);

  useEffect(() => {
    listTransactionNames({ type: "pengeluaran" })
      .then(setNames)
      .catch(() => {});
  }, []);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  // Opsi "tambah pos" — nama pengeluaran yang belum ada di tabel detail.
  const addableByCategory = useMemo(() => {
    const existing = new Set(detailRows.map(detKey));
    const groups = new Map<string, TransactionName[]>();
    names.forEach((n) => {
      if (existing.has(detKey(n))) return;
      const list = groups.get(n.category) ?? [];
      list.push(n);
      groups.set(n.category, list);
    });
    return groups;
  }, [names, detailRows]);

  function markDirty(key: string) {
    setDirty((prev) => new Set(prev).add(key));
  }

  function addDetailRow(value: string) {
    const [category, ...rest] = value.split("|");
    const name = rest.join("|");
    if (!category || !name) return;
    setDetailRows((rows) =>
      rows.some((r) => r.category === category && r.name === name)
        ? rows
        : [...rows, { category, name, target: 0, realisasi: 0 }],
    );
  }

  async function handleSave() {
    if (viharaId == null || saving) return;
    const items: AnggaranItemInput[] = [];
    dirty.forEach((key) => {
      const [kind, category, ...rest] = key.split("|");
      if (kind === "pen") {
        items.push({ type: "penerimaan", category, amount: penTargets[category] ?? 0 });
      } else if (kind === "peng") {
        items.push({ type: "pengeluaran", category, amount: pengTargets[category] ?? 0 });
      } else if (kind === "det") {
        const name = rest.join("|");
        const row = detailRows.find((r) => r.category === category && r.name === name);
        items.push({ type: "pengeluaran", category, name, amount: row?.target ?? 0 });
      }
    });
    if (items.length === 0) {
      setToast({ message: "Tidak ada perubahan untuk disimpan", tone: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setSaving(true);
    try {
      await saveAnggaran({ year, vihara_id: viharaId, items });
      setToast({ message: "Anggaran berhasil disimpan", tone: "success" });
      refetch();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Gagal menyimpan", tone: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const yearSelector = (
    <TopbarSelect
      value={year}
      onChange={(e) => setYear(Number(e.target.value))}
      className="max-w-[90px]"
      aria-label="Tahun"
    >
      {years.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </TopbarSelect>
  );

  const needVihara = viharaReady && viharaId == null;

  return (
    <AppShell
      title="Anggaran"
      subtitle="Target penerimaan dan anggaran pengeluaran"
      actions={yearSelector}
    >
      {needVihara ? (
        <Card>
          <p className="px-4 py-12 text-center text-[13px] text-km-ink-muted">
            Pilih vihara dulu di header untuk mengelola anggaran.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
              {error}
            </p>
          )}

          <div className="rounded-lg border border-km-blue/40 bg-km-blue-soft px-3.5 py-2.5 text-[12px] text-km-blue-ink">
            ☸ Anggaran ditetapkan per kategori dana dan kategori biaya untuk periode tahunan.
            Realisasi diambil otomatis dari transaksi yang sudah dicatat.
          </div>

          {/* Kartu 1: Target Penerimaan */}
          <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <CardHeader
              title="Target Penerimaan per Kategori Dana"
              subtitle={`Tahun ${year}`}
              right={
                canManage && (
                  <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
                    {saving ? "Menyimpan…" : "Simpan Anggaran"}
                  </Button>
                )
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-km-bg">
                  <tr>
                    <Th>Kategori Dana</Th>
                    <Th className="text-right">Target (Rp)</Th>
                    <Th className="text-right">Realisasi</Th>
                    <Th className="text-right">Sisa</Th>
                    <Th className="min-w-[140px]">Progress</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.penerimaan ?? []).map((r) => {
                    const target = penTargets[r.category] ?? 0;
                    const real = num(r.realisasi);
                    const pct = pctOf(real, target);
                    const sisa = target - real;
                    const fill =
                      pct >= 100 ? "var(--km-green)" : pct > 70 ? "var(--km-amber)" : "var(--km-accent)";
                    return (
                      <tr key={r.category} className="border-t border-km-border">
                        <Td><DanaTag category={r.category} label={r.label} /></Td>
                        <Td className="text-right">
                          {canManage ? (
                            <MoneyInput
                              value={target}
                              onChange={(v) => {
                                setPenTargets((m) => ({ ...m, [r.category]: v }));
                                markDirty(`pen|${r.category}`);
                              }}
                              className="ml-auto max-w-[130px] text-right"
                              aria-label={`Target ${r.label}`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums">{fmtRp(target)}</span>
                          )}
                        </Td>
                        <Td className="text-right font-mono tabular-nums font-medium text-km-green">
                          {fmtRp(real)}
                        </Td>
                        <Td
                          className={`text-right font-mono tabular-nums ${
                            sisa >= 0 ? "text-km-ink-soft" : "text-km-red"
                          }`}
                        >
                          {fmtRp(Math.abs(sisa))}
                          {sisa < 0 ? " (lebih)" : ""}
                        </Td>
                        <Td><ProgBar pct={pct} fill={fill} /></Td>
                      </tr>
                    );
                  })}
                  {!loading && (data?.penerimaan ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-km-ink-muted">
                        Belum ada data anggaran.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Kartu 2: Anggaran Pengeluaran */}
          <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <CardHeader title="Anggaran Pengeluaran per Kategori Biaya" />
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-km-bg">
                  <tr>
                    <Th>Kategori Biaya</Th>
                    <Th className="text-right">Anggaran (Rp)</Th>
                    <Th className="text-right">Realisasi</Th>
                    <Th className="text-right">Sisa</Th>
                    <Th className="min-w-[140px]">Progress</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.pengeluaran ?? []).map((r) => {
                    const target = pengTargets[r.category] ?? 0;
                    const real = num(r.realisasi);
                    const pct = pctOf(real, target);
                    const sisa = target - real;
                    const fill =
                      pct >= 100 ? "var(--km-red)" : pct > 80 ? "var(--km-amber)" : "var(--km-green)";
                    return (
                      <tr key={r.category} className="border-t border-km-border">
                        <Td><DanaTag category={r.category} label={r.label} /></Td>
                        <Td className="text-right">
                          {canManage ? (
                            <MoneyInput
                              value={target}
                              onChange={(v) => {
                                setPengTargets((m) => ({ ...m, [r.category]: v }));
                                markDirty(`peng|${r.category}`);
                              }}
                              className="ml-auto max-w-[130px] text-right"
                              aria-label={`Anggaran ${r.label}`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums">{fmtRp(target)}</span>
                          )}
                        </Td>
                        <Td className="text-right font-mono tabular-nums font-medium text-km-red">
                          {fmtRp(real)}
                        </Td>
                        <Td
                          className={`text-right font-mono tabular-nums ${
                            sisa >= 0 ? "text-km-ink-soft" : "text-km-red"
                          }`}
                        >
                          {fmtRp(Math.abs(sisa))}
                          {sisa < 0 ? " ⚠ Melebihi" : ""}
                        </Td>
                        <Td><ProgBar pct={pct} fill={fill} /></Td>
                      </tr>
                    );
                  })}
                  {!loading && (data?.pengeluaran ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-km-ink-muted">
                        Belum ada data anggaran.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Kartu 3: Anggaran per Jenis Pengeluaran */}
          <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <CardHeader
              title="Anggaran per Jenis Pengeluaran"
              subtitle="Detail anggaran tiap pos biaya"
              right={
                canManage && addableByCategory.size > 0 ? (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addDetailRow(e.target.value);
                    }}
                    className="max-w-[220px] rounded-lg border border-km-border-strong bg-km-panel px-2 py-1.5 text-[12px] text-km-ink"
                    aria-label="Tambah pos pengeluaran"
                  >
                    <option value="">+ Tambah pos pengeluaran…</option>
                    {[...addableByCategory.entries()].map(([category, list]) => (
                      <optgroup key={category} label={danaCategoryLabel(category)}>
                        {list.map((n) => (
                          <option key={n.id} value={`${n.category}|${n.name}`}>
                            {n.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : undefined
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-km-bg">
                  <tr>
                    <Th>Nama Pengeluaran</Th>
                    <Th>Kategori</Th>
                    <Th className="text-right">Anggaran (Rp)</Th>
                    <Th className="text-right">Realisasi</Th>
                    <Th className="text-right">%</Th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r) => {
                    const pct = pctOf(r.realisasi, r.target);
                    return (
                      <tr key={detKey(r)} className="border-t border-km-border">
                        <Td>{r.name}</Td>
                        <Td><DanaTag category={r.category} /></Td>
                        <Td className="text-right">
                          {canManage ? (
                            <MoneyInput
                              value={r.target}
                              onChange={(v) => {
                                setDetailRows((rows) =>
                                  rows.map((row) =>
                                    detKey(row) === detKey(r) ? { ...row, target: v } : row,
                                  ),
                                );
                                markDirty(`det|${r.category}|${r.name}`);
                              }}
                              className="ml-auto max-w-[120px] text-right"
                              aria-label={`Anggaran ${r.name}`}
                            />
                          ) : (
                            <span className="font-mono tabular-nums">{fmtRp(r.target)}</span>
                          )}
                        </Td>
                        <Td className="text-right font-mono tabular-nums text-km-red">
                          {r.realisasi ? fmtRp(r.realisasi) : "-"}
                        </Td>
                        <Td
                          className={`text-right font-mono tabular-nums ${
                            pct > 100 ? "text-km-red" : pct > 80 ? "text-km-amber-ink" : "text-km-ink-muted"
                          }`}
                        >
                          {r.target > 0 ? `${pct}%` : "-"}
                        </Td>
                      </tr>
                    );
                  })}
                  {detailRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-km-ink-muted">
                        {loading
                          ? "Memuat…"
                          : "Mulai catat transaksi untuk melihat realisasi, atau tambah pos untuk dianggarkan."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </AppShell>
  );
}
