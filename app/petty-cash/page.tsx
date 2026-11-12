"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { Field, Input, MoneyInput, Select } from "@/components/Field";
import { Toast } from "@/components/Toast";
import { bankBrand, listViharaBankAccounts, num, ViharaBankAccount } from "@/lib/kasBank";
import {
  createPettyCash,
  getPettyCashSummary,
  listPettyCash,
  listPettyCashPics,
  pettyCashDate,
  PettyCashEntry,
  pettyCashPicId,
  pettyCashPicName,
  PettyCashPic,
  pettyCashSourceLabel,
  PettyCashSummary,
  postPettyCash,
} from "@/lib/pettyCash";
import { YayasanViharaFields, YayasanViharaValue } from "@/components/YayasanViharaFields";

const fmtRp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const fmtTgl = (iso: string) =>
  new Date(iso.slice(0, 10)).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-CA");

// Warna kartu/tag per PIC — siklus mengikuti mockup (biru, ungu, lalu hijau/amber).
const PIC_COLORS = [
  { bg: "var(--km-blue-soft)", text: "var(--km-blue)" },
  { bg: "var(--km-purple-soft)", text: "var(--km-purple)" },
  { bg: "var(--km-green-soft)", text: "var(--km-green)" },
  { bg: "var(--km-amber-soft)", text: "var(--km-amber)" },
];
const picColor = (i: number) => PIC_COLORS[((i % PIC_COLORS.length) + PIC_COLORS.length) % PIC_COLORS.length];

type ToastMsg = { message: string; tone: "success" | "error" };

export default function PettyCashPage() {
  // Kas Kecil adalah pandangan PER VIHARA — saldo, PIC, dan mutasinya milik
  // satu vihara. Jadi viharanya dipilih DI HALAMAN INI, bukan diwarisi dari
  // pemilih di header: saldo yang terlihat dan transaksi yang dicatat harus
  // menunjuk vihara yang sama, dan harus terbaca jelas yang mana.
  const [scope, setScope] = useState<YayasanViharaValue>({ entityId: null, viharaId: null });
  const viharaId = scope.viharaId;
  const ready = true;
  const fixed = false;
  const needVihara = viharaId == null;

  const [summary, setSummary] = useState<PettyCashSummary | null>(null);
  const [pics, setPics] = useState<PettyCashPic[]>([]);
  const [bankAccounts, setBankAccounts] = useState<ViharaBankAccount[]>([]);
  const [rows, setRows] = useState<PettyCashEntry[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [filterPic, setFilterPic] = useState("");
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const reloadSummary = useCallback(() => {
    if (!ready) return;
    getPettyCashSummary(viharaId)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [viharaId, ready]);

  const reloadRows = useCallback(() => {
    if (!ready) return;
    setRowsLoading(true);
    listPettyCash({
      vihara_id: viharaId,
      pic_id: filterPic ? Number(filterPic) : undefined,
    })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setRowsLoading(false));
  }, [viharaId, ready, filterPic]);

  useEffect(() => {
    reloadSummary();
  }, [reloadSummary]);

  useEffect(() => {
    reloadRows();
  }, [reloadRows]);

  // Masters — PIC & rekening bank vihara aktif (form terblokir saat "Semua Vihara").
  useEffect(() => {
    if (!ready) return;
    listPettyCashPics(viharaId)
      .then((list) => setPics(list.filter((p) => p.active)))
      .catch(() => setPics([]));
    if (viharaId != null) {
      listViharaBankAccounts(viharaId)
        .then((list) => setBankAccounts(list.filter((b) => b.active)))
        .catch(() => setBankAccounts([]));
    } else {
      setBankAccounts([]);
    }
  }, [viharaId, ready]);

  useEffect(() => {
    setFilterPic("");
  }, [viharaId]);

  // Urutan warna PIC konsisten di kartu ringkasan + tag riwayat.
  const picColorIndex = useMemo(() => {
    const map = new Map<number, number>();
    const source = summary?.pics.length ? summary.pics : pics;
    source.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [summary, pics]);

  function afterSaved(message: string) {
    setToast({ message, tone: "success" });
    reloadSummary();
    reloadRows();
  }

  return (
    <AppShell title="Kas Kecil" subtitle="Kelola kas kecil per PIC">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div className="space-y-3.5">
        {/* ── Vihara yang sedang dikelola ── */}
        <Card>
          <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-2">
            <YayasanViharaFields value={scope} onChange={setScope} />
          </div>
          {needVihara && (
            <p className="border-t border-km-border bg-km-panel-soft px-4 py-2 text-[11px] font-medium text-km-amber-ink">
              Pilih yayasan dan vihara dulu — saldo dan mutasi di bawah mengikuti pilihan ini.
            </p>
          )}
        </Card>

        {/* ── Ringkasan per PIC ── */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {(summary?.pics ?? []).map((p, i) => {
            const c = picColor(picColorIndex.get(p.id) ?? i);
            return (
              <Card key={p.id}>
                <div className="border-b border-km-border px-4 py-3" style={{ background: c.bg }}>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[.06em]"
                    style={{ color: c.text }}
                  >
                    Kas Kecil — {p.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 px-4 py-3.5">
                  <div>
                    <p className="mb-1 text-[11px] text-km-ink-muted">Saldo Awal</p>
                    <p className="text-[18px] font-medium text-km-ink">{fmtRp(num(p.saldo_awal))}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-km-ink-muted">Saldo Saat Ini</p>
                    <p className="text-[18px] font-semibold text-km-green">{fmtRp(num(p.saldo))}</p>
                  </div>
                </div>
                <p className="px-4 pb-3.5 text-[11px] text-km-ink-muted">
                  Total pengisian: {fmtRp(num(p.total_isi))} | Terpakai: {fmtRp(num(p.total_pakai))} | {p.count} mutasi
                </p>
              </Card>
            );
          })}
          {summary && summary.pics.length === 0 && (
            <Card className="sm:col-span-2">
              <p className="px-4 py-6 text-center text-[12px] text-km-ink-muted">
                Belum ada PIC kas kecil — tambahkan di Admin → Vihara.
              </p>
            </Card>
          )}
        </div>

        {/* ── Form pengisian & penggunaan ── */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <TopupForm
            pics={pics}
            bankAccounts={bankAccounts}
            viharaId={viharaId}
            fixed={fixed}
            needVihara={needVihara}
            onSaved={() => afterSaved("Pengisian kas kecil tercatat")}
            onError={(m) => setToast({ message: m, tone: "error" })}
          />
          <UsageForm
            pics={pics}
            viharaId={viharaId}
            fixed={fixed}
            needVihara={needVihara}
            onSaved={() => afterSaved("Penggunaan kas kecil tercatat")}
            onError={(m) => setToast({ message: m, tone: "error" })}
          />
        </div>

        {/* ── Riwayat mutasi ── */}
        <Card>
          <CardHeader
            title="Riwayat Mutasi Kas Kecil"
            right={
              <Select
                value={filterPic}
                onChange={(e) => setFilterPic(e.target.value)}
                className="max-w-36"
                aria-label="Filter PIC"
              >
                <option value="">Semua PIC</option>
                {pics.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-km-panel-soft">
                <tr>
                  <Th>Tanggal</Th>
                  <Th>PIC</Th>
                  <Th>Keterangan</Th>
                  <Th>Tipe</Th>
                  <Th className="text-right">Masuk</Th>
                  <Th className="text-right">Keluar</Th>
                  <Th>No. Bukti</Th>
                </tr>
              </thead>
              <tbody>
                {rowsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-km-ink-muted">Memuat…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-km-ink-muted">
                      Belum ada mutasi kas kecil
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isTopup = r.subtype === "topup";
                    const amount = num(r.amount);
                    const picId = pettyCashPicId(r);
                    const c = picColor(picId != null ? picColorIndex.get(picId) ?? 0 : 0);
                    return (
                      <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft">
                        <Td className="whitespace-nowrap">{fmtTgl(pettyCashDate(r))}</Td>
                        <Td>
                          <span
                            className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: c.bg, color: c.text }}
                          >
                            {pettyCashPicName(r)}
                          </span>
                        </Td>
                        <Td>
                          {r.description ||
                            (isTopup
                              ? pettyCashSourceLabel(r)
                                ? `Pengisian via ${pettyCashSourceLabel(r)}`
                                : "Pengisian"
                              : "—")}
                        </Td>
                        <Td>
                          <span className="flex items-center gap-1.5">
                            {isTopup ? (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-green-soft px-2 py-0.5 text-[11px] font-medium text-km-green">
                                Pengisian
                              </span>
                            ) : (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-red-soft px-2 py-0.5 text-[11px] font-medium text-km-red">
                                Penggunaan
                              </span>
                            )}
                            {r.status === "draft" && (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-amber-soft px-1.5 py-0.5 text-[10px] font-medium text-km-amber">
                                Draft
                              </span>
                            )}
                          </span>
                        </Td>
                        <Td className="text-right font-mono tabular-nums text-km-green">
                          {isTopup ? fmtRp(amount) : "—"}
                        </Td>
                        <Td className="text-right font-mono tabular-nums text-km-red">
                          {!isTopup ? fmtRp(amount) : "—"}
                        </Td>
                        <Td className="text-[11px] text-km-ink-muted">{r.reference || "—"}</Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

// ── Form Pengisian Kas Kecil ────────────────────────────────────────────────
function TopupForm({
  pics,
  bankAccounts,
  viharaId,
  fixed,
  needVihara,
  onSaved,
  onError,
}: {
  pics: PettyCashPic[];
  bankAccounts: ViharaBankAccount[];
  viharaId: number | null;
  fixed: boolean;
  needVihara: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [date, setDate] = useState(today());
  const [picId, setPicId] = useState("");
  const [amount, setAmount] = useState(0);
  const [source, setSource] = useState(""); // "" = Dana Tunai
  const [transferNote, setTransferNote] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPicId("");
    setSource("");
  }, [viharaId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (needVihara || !picId) return;
    setPending(true);
    try {
      const created = await createPettyCash({
        date,
        pic_id: Number(picId),
        subtype: "topup",
        amount,
        ...(source ? { source_bank_account_id: Number(source) } : {}),
        ...(source && transferNote ? { reference: transferNote } : {}),
        ...(notes ? { description: notes } : {}),
        ...(fixed ? {} : { vihara_id: viharaId! }),
      });
      await postPettyCash(created.id);
      setDate(today());
      setPicId("");
      setAmount(0);
      setSource("");
      setTransferNote("");
      setNotes("");
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Gagal mencatat pengisian");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader title="Pengisian Kas Kecil" />
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5">
          <Field label="Tanggal">
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="PIC Kas Kecil">
            <Select required value={picId} onChange={(e) => setPicId(e.target.value)} disabled={needVihara}>
              <option value="">— Pilih PIC —</option>
              {pics.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jumlah Pengisian (Rp)">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Ambil dari">
            <Select value={source} onChange={(e) => setSource(e.target.value)} disabled={needVihara}>
              <option value="">Dana Tunai</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  Rekening {bankBrand(b.bank_name)} — {b.account_number}
                </option>
              ))}
            </Select>
          </Field>
          {source && (
            <Field label="Keterangan Transfer">
              <Input
                value={transferNote}
                placeholder="No. referensi transfer, jika ada"
                onChange={(e) => setTransferNote(e.target.value)}
              />
            </Field>
          )}
          <Field label="Catatan">
            <Input value={notes} placeholder="Periode pengisian, dll." onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
          {needVihara && (
            <span className="mr-auto text-[11px] font-medium text-km-amber-ink">
              Pilih vihara dulu di header
            </span>
          )}
          <Button type="submit" variant="success" disabled={pending || needVihara}>
            {pending ? "Menyimpan…" : "Catat Pengisian"}
          </Button>
        </div>
      </Card>
    </form>
  );
}

// ── Form Penggunaan Kas Kecil ───────────────────────────────────────────────
function UsageForm({
  pics,
  viharaId,
  fixed,
  needVihara,
  onSaved,
  onError,
}: {
  pics: PettyCashPic[];
  viharaId: number | null;
  fixed: boolean;
  needVihara: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [date, setDate] = useState(today());
  const [picId, setPicId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPicId("");
  }, [viharaId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (needVihara || !picId) return;
    setPending(true);
    try {
      const created = await createPettyCash({
        date,
        pic_id: Number(picId),
        subtype: "usage",
        amount,
        ...(reference ? { reference } : {}),
        ...(purpose ? { description: purpose } : {}),
        ...(fixed ? {} : { vihara_id: viharaId! }),
      });
      await postPettyCash(created.id);
      setDate(today());
      setPicId("");
      setPurpose("");
      setAmount(0);
      setReference("");
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Gagal mencatat penggunaan");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader title="Penggunaan Kas Kecil" />
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5">
          <Field label="Tanggal">
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="PIC Kas Kecil">
            <Select required value={picId} onChange={(e) => setPicId(e.target.value)} disabled={needVihara}>
              <option value="">— Pilih PIC —</option>
              {pics.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Keperluan">
            <Input
              required
              value={purpose}
              placeholder="Beli ATK, transport, dll."
              onChange={(e) => setPurpose(e.target.value)}
            />
          </Field>
          <Field label="Jumlah (Rp)">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="No. Bukti / Kuitansi">
            <Input value={reference} placeholder="BKK-001" onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
          {needVihara && (
            <span className="mr-auto text-[11px] font-medium text-km-amber-ink">
              Pilih vihara dulu di header
            </span>
          )}
          <Button type="submit" variant="danger" disabled={pending || needVihara}>
            {pending ? "Menyimpan…" : "Catat Penggunaan"}
          </Button>
        </div>
      </Card>
    </form>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
