"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { Select } from "@/components/Field";
import { bankShortLabel, bankTitle, getKasBank, KasBankData, num } from "@/lib/kasBank";
import {
  ReconciliationBankSummary,
  createOrOpenRun,
  getReconciliationSummary,
} from "@/lib/reconciliation";
import { useVihara } from "@/lib/useVihara";

const fmtRp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const fmtTgl = (iso: string) =>
  new Date(iso.slice(0, 10)).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

export default function KasBankPage() {
  const router = useRouter();
  const { viharaId, fixed, ready } = useVihara();

  const [data, setData] = useState<KasBankData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filter mutasi: "" = semua rekening; angka = bank_account_id.
  const [filterRek, setFilterRek] = useState("");
  // Ringkasan rekonsiliasi per rekening (banks[] dari GET /api/reconciliation).
  const [reconBanks, setReconBanks] = useState<ReconciliationBankSummary[]>([]);
  const [openingRekon, setOpeningRekon] = useState<number | null>(null);
  const mutasiRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    getKasBank({ vihara_id: viharaId })
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat kas & bank"))
      .finally(() => setLoading(false));
  }, [viharaId, ready]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Reset filter bila daftar rekening berubah (ganti vihara).
  useEffect(() => {
    setFilterRek("");
  }, [viharaId]);

  // Status rekonsiliasi per rekening — non-blocking; kartu tetap render tanpa ini.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    getReconciliationSummary(viharaId)
      .then((s) => { if (alive) setReconBanks(s.banks); })
      .catch(() => { if (alive) setReconBanks([]); });
    return () => { alive = false; };
  }, [viharaId, ready]);

  // Buka (atau buat) run rekonsiliasi bulan berjalan untuk rekening ini.
  async function openRekonsiliasi(bankAccountId: number) {
    setOpeningRekon(bankAccountId);
    try {
      const runId = await createOrOpenRun(bankAccountId);
      router.push(`/rekonsiliasi/${runId}`);
    } catch {
      router.push("/rekonsiliasi"); // fallback: halaman daftar rekonsiliasi
    } finally {
      setOpeningRekon(null);
    }
  }

  function rekonSubline(bankAccountId: number): string {
    const b = reconBanks.find((x) => x.bank_account_id === bankAccountId);
    if (!b || b.last_run_status == null || b.last_run_status === "none") {
      return "Rekonsiliasi: belum dilakukan";
    }
    if (b.last_run_status === "in_progress") return "Rekonsiliasi: sedang berjalan";
    return b.last_completed_month
      ? `Rekonsiliasi terakhir: ${b.last_completed_month}`
      : "Rekonsiliasi: selesai";
  }

  const accounts = data?.bank_accounts ?? [];
  const pics = data?.kas_kecil.pics ?? [];
  const kasTunai = num(data?.kas_tunai);
  const showViharaName = !fixed && viharaId == null;

  const mutasi = useMemo(() => {
    const rows = data?.mutasi ?? [];
    if (!filterRek) return rows;
    const id = Number(filterRek);
    return rows.filter((m) => m.bank_account_id === id);
  }, [data, filterRek]);

  function showMutasi(bankAccountId: number) {
    setFilterRek(String(bankAccountId));
    mutasiRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <AppShell title="Kas & Bank" subtitle="Posisi kas tunai dan rekening bank vihara">
      <div className="space-y-3.5">
        {error && (
          <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
            {error}
          </p>
        )}

        {/* ── Kartu rekening + kas kecil ── */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a, i) => (
            <Card key={a.id}>
              <div className="border-b border-km-border px-4 py-3.5">
                <div className="mb-2.5 flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[.06em] text-km-ink-muted">
                      {bankTitle(a.bank_name)}
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-km-ink">
                      {a.account_name}
                      {/* Pemilik rekening adalah yayasan; vihara pengguna
                          disebut hanya kalau rekeningnya memang dibatasi
                          (kosong = seluruh vihara yayasan) — FV-36. */}
                      {showViharaName && a.entity_name ? (
                        <span className="block text-[11px] font-normal text-km-ink-soft">
                          {a.entity_name}
                        </span>
                      ) : null}
                      {a.vihara_names.length > 0 ? (
                        <span className="block text-[10.5px] font-normal text-km-ink-muted">
                          Khusus: {a.vihara_names.join(", ")}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-[3px] tabular-nums text-[11px] text-km-ink-muted">{a.account_number}</p>
                  </div>
                  <span
                    className={`rounded px-2 py-[3px] text-[10px] font-semibold ${
                      i === 0 ? "bg-km-blue-soft text-km-blue" : "bg-km-green-soft text-km-green"
                    }`}
                  >
                    AKTIF
                  </span>
                </div>
                {/* Dua angka yang berbeda arti (FV-36):
                    - saldo utuh rekening = yang dicocokkan dengan rekening
                      koran, hanya untuk pemegang akses tingkat yayasan;
                    - porsi vihara = masuk − keluar milik viharanya sendiri.
                    User berjangkauan vihara hanya berhak atas porsinya. */}
                {a.saldo_penuh_tersedia ? (
                  <>
                    <p className="text-[11px] text-km-ink-muted">Saldo rekening (per buku)</p>
                    <p className="mt-0.5 text-[22px] font-semibold text-km-green">
                      {fmtRp(num(a.saldo))}
                    </p>
                    {a.porsi_per_vihara.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {a.porsi_per_vihara.map((p) => (
                          <p
                            key={p.vihara_id}
                            className="flex justify-between text-[11px] text-km-ink-muted"
                          >
                            <span>{p.vihara_name}</span>
                            <span
                              className={`tabular-nums ${num(p.porsi) < 0 ? "text-km-red" : ""}`}
                            >
                              {fmtRp(num(p.porsi))}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-km-ink-muted">Porsi vihara ini</p>
                    <p
                      className={`mt-0.5 text-[22px] font-semibold ${
                        num(a.porsi) < 0 ? "text-km-red" : "text-km-green"
                      }`}
                    >
                      {fmtRp(num(a.porsi))}
                    </p>
                    {num(a.porsi) < 0 && (
                      <p className="mt-1 text-[11px] text-km-red-ink">
                        Vihara ini memakai dana rekening bersama melebihi yang masuk untuknya.
                      </p>
                    )}
                    <p className="mt-1 text-[10.5px] text-km-ink-muted">
                      Rekening milik yayasan — saldo utuhnya memuat dana vihara lain.
                    </p>
                  </>
                )}
                <p className="mt-1 text-[11px] text-km-ink-muted">{rekonSubline(a.id)}</p>
              </div>
              <div className="flex gap-1.5 px-4 py-2">
                <Button
                  size="sm"
                  className="flex-1 justify-center"
                  disabled={openingRekon === a.id}
                  onClick={() => openRekonsiliasi(a.id)}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
                    <path d="M3 5h10M3 8h7M3 11h4" />
                  </svg>
                  Rekonsiliasi
                </Button>
                <Button size="sm" variant="ghost" onClick={() => showMutasi(a.id)}>
                  Mutasi
                </Button>
              </div>
            </Card>
          ))}

          {/* Kartu Kas Kecil */}
          <Card>
            <div className="border-b border-km-border px-4 py-3.5">
              <div className="mb-2.5 flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[.06em] text-km-ink-muted">Kas Kecil</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-km-ink">Petty Cash</p>
                  <p className="mt-[3px] text-[11px] text-km-ink-muted">
                    PIC: {pics.length > 0 ? pics.map((p) => p.name).join(" & ") : "—"}
                  </p>
                </div>
                <span className="rounded bg-km-amber-soft px-2 py-[3px] text-[10px] font-semibold text-km-amber">
                  TUNAI
                </span>
              </div>
              {pics.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-4">
                  {pics.map((p) => (
                    <div key={p.id}>
                      <p className="text-[10px] text-km-ink-muted">{p.name}</p>
                      <p className="text-[14px] font-medium text-km-ink">{fmtRp(num(p.saldo))}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-km-ink-muted">Total kas kecil</p>
              <p className="mt-0.5 text-[22px] font-semibold text-km-amber">
                {fmtRp(num(data?.kas_kecil.total))}
              </p>
              {kasTunai > 0 && (
                <p className="mt-1 text-[11px] text-km-ink-muted">Kas tunai: {fmtRp(kasTunai)}</p>
              )}
            </div>
            <div className="px-4 py-2">
              <Button size="sm" className="w-full justify-center" onClick={() => router.push("/petty-cash")}>
                Kelola Kas Kecil →
              </Button>
            </div>
          </Card>

          {!loading && accounts.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-2">
              <p className="px-4 py-6 text-center text-[12px] text-km-ink-muted">
                Belum ada rekening bank — tambahkan di Admin → Vihara.
              </p>
            </Card>
          )}
        </div>

        {/* ── Mutasi gabungan ── */}
        <div ref={mutasiRef}>
          <Card>
            <CardHeader
              title="Mutasi Transaksi Bank"
              subtitle="Penerimaan & pengeluaran via bank/transfer"
              right={
                <Select
                  value={filterRek}
                  onChange={(e) => setFilterRek(e.target.value)}
                  className="max-w-44"
                  aria-label="Filter rekening"
                >
                  <option value="">Semua Rekening</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {bankShortLabel(a)}
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
                    <Th>Keterangan</Th>
                    <Th>Rekening</Th>
                    <Th>Tipe</Th>
                    <Th className="text-right">Masuk</Th>
                    <Th className="text-right">Keluar</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-km-ink-muted">Memuat…</td>
                    </tr>
                  ) : mutasi.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-km-ink-muted">
                        Belum ada transaksi bank pada periode ini
                      </td>
                    </tr>
                  ) : (
                    mutasi.map((m, i) => {
                      const masuk = num(m.masuk);
                      const keluar = num(m.keluar);
                      const isMasuk = masuk > 0;
                      return (
                        <tr key={i} className="border-t border-km-border hover:bg-km-panel-soft">
                          <Td className="whitespace-nowrap">{fmtTgl(m.date)}</Td>
                          <Td>{m.name}</Td>
                          <Td>
                            <span className="inline-flex items-center whitespace-nowrap rounded-full border border-km-border bg-km-bg px-2 py-0.5 text-[11px] font-medium text-km-ink-muted">
                              {m.bank_label ?? "—"}
                            </span>
                          </Td>
                          <Td>
                            {isMasuk ? (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-green-soft px-2 py-0.5 text-[11px] font-medium text-km-green">
                                → Masuk
                              </span>
                            ) : (
                              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-km-red-soft px-2 py-0.5 text-[11px] font-medium text-km-red">
                                ← Keluar
                              </span>
                            )}
                          </Td>
                          <Td className="text-right tabular-nums text-km-green">
                            {masuk > 0 ? fmtRp(masuk) : "—"}
                          </Td>
                          <Td className="text-right tabular-nums text-km-red">
                            {keluar > 0 ? fmtRp(keluar) : "—"}
                          </Td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
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
