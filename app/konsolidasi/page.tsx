"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import {
  fmtRp,
  Hdr3,
  LapHeader,
  LapRow,
  LapTitle,
  Row3,
  Table3Head,
  TopbarSelect,
} from "@/components/ReportRows";
import { Toast } from "@/components/Toast";
import { num } from "@/lib/kasBank";
import {
  getKonsolidasi,
  KonsolidasiPerVihara,
  KonsolidasiResponse,
  viharaColor,
} from "@/lib/konsolidasi";
import { exportKonsolidasiExcel } from "@/lib/konsolidasiExcel";
import { Isak35Mode, isak35PeriodLabel, MONTHS_ID } from "@/lib/laporanKeuangan";

type TabKey =
  | "ringkasan"
  | "posisi"
  | "penghasilan"
  | "perubahan"
  | "aruskas"
  | "perbandingan";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "posisi", label: "Posisi Keuangan" },
  { key: "penghasilan", label: "Penghasilan Komprehensif" },
  { key: "perubahan", label: "Perubahan Aset Neto" },
  { key: "aruskas", label: "Arus Kas" },
  { key: "perbandingan", label: "Perbandingan Vihara" },
];

/** per_vihara + warna identitasnya. */
type VRow = KonsolidasiPerVihara & { warna: string };

export default function KonsolidasiPage() {
  const now = new Date();
  const [mode, setMode] = useState<Isak35Mode>("ytd");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<TabKey>("ringkasan");
  const [data, setData] = useState<KonsolidasiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getKonsolidasi({ mode, year, month })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        if ((e as Error & { status?: number }).status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : "Gagal memuat");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, year, month]);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const periodeLabel = isak35PeriodLabel(mode, year, month);

  async function handleExport() {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const filename = await exportKonsolidasiExcel({ data, periodeLabel });
      setToast({
        message: `Export konsolidasi berhasil — ${5 + data.per_vihara.length} sheet (${filename})`,
        tone: "success",
      });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Gagal export Excel", tone: "error" });
    } finally {
      setExporting(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const periodSelector = (
    <div className="flex items-center gap-1.5">
      <TopbarSelect
        value={mode}
        onChange={(e) => setMode(e.target.value as Isak35Mode)}
        className="max-w-[110px]"
        aria-label="Mode periode"
      >
        <option value="ytd">YTD</option>
        <option value="bulan">Per Bulan</option>
      </TopbarSelect>
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
      {mode === "bulan" && (
        <TopbarSelect
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="max-w-[105px]"
          aria-label="Bulan"
        >
          {MONTHS_ID.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </TopbarSelect>
      )}
    </div>
  );

  const vd: VRow[] =
    data?.per_vihara.map((v, i) => ({ ...v, warna: viharaColor(v.vihara.code, i) })) ?? [];

  return (
    <AppShell
      title="Konsolidasi Yayasan"
      subtitle="Laporan gabungan seluruh vihara dalam naungan Yayasan Dhammavihara Indonesia"
      actions={forbidden ? undefined : periodSelector}
    >
      {forbidden ? (
        <Card>
          <CardHeader
            title="Khusus level yayasan"
            subtitle="Akun Anda terhubung ke satu vihara"
          />
          <div className="px-4 py-5 text-[13px] text-km-ink-soft">
            <p>
              Laporan konsolidasi menggabungkan seluruh vihara dan hanya tersedia untuk pengurus
              level yayasan. Silakan gunakan menu <strong>Laporan Keuangan</strong> untuk laporan
              vihara Anda.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {error && (
            <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
              {error}
            </p>
          )}

          <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <CardHeader
              title={`Laporan Konsolidasi — ${data?.yayasan.nama ?? "Yayasan Dhammavihara Indonesia"}`}
              subtitle={
                <>
                  Gabungan {data?.per_vihara.length ?? "—"} vihara ·{" "}
                  <span className="font-medium">{periodeLabel}</span>
                </>
              }
              right={
                <Button variant="primary" onClick={handleExport} disabled={!data || exporting}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 13h8M8 3v7M5 7l3 3 3-3" />
                  </svg>
                  {exporting ? "Menyiapkan…" : "Export Excel"}
                </Button>
              }
            />

            {/* Chips daftar vihara */}
            {vd.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-km-border px-4 py-2.5">
                {vd.map((v) => (
                  <span
                    key={v.vihara.id}
                    data-testid="konsol-chip"
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{
                      background: `${v.warna}22`,
                      color: v.warna,
                      border: `1px solid ${v.warna}44`,
                    }}
                  >
                    {v.vihara.name}
                    {v.vihara.kota ? ` · ${v.vihara.kota}` : ""}
                  </span>
                ))}
              </div>
            )}

            {/* Tab garis bawah ala mockup .tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-km-border px-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[12.5px] transition ${
                    tab === t.key
                      ? "border-km-accent font-semibold text-km-accent-ink"
                      : "border-transparent text-km-ink-muted hover:text-km-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {loading && !data ? (
              <p className="px-4 py-12 text-center text-[12px] text-km-ink-muted">
                Memuat laporan konsolidasi…
              </p>
            ) : !data ? (
              <p className="px-4 py-12 text-center text-[12px] text-km-ink-muted">
                Laporan konsolidasi belum tersedia.
              </p>
            ) : (
              <>
                {tab === "ringkasan" && <RingkasanTab data={data} vd={vd} periode={periodeLabel} />}
                {tab === "posisi" && <PosisiTab data={data} vd={vd} periode={periodeLabel} />}
                {tab === "penghasilan" && <PenghasilanTab data={data} vd={vd} periode={periodeLabel} />}
                {tab === "perubahan" && <PerubahanTab data={data} periode={periodeLabel} />}
                {tab === "aruskas" && <ArusKasTab data={data} vd={vd} periode={periodeLabel} />}
                {tab === "perbandingan" && <PerbandinganTab data={data} vd={vd} />}
              </>
            )}
          </Card>
        </>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </AppShell>
  );
}

type TabProps = { data: KonsolidasiResponse; vd: VRow[]; periode: string };

function ViharaNameCell({ v }: { v: VRow }) {
  return (
    <div className="flex items-start gap-1.5">
      <span
        className="mt-1 inline-block h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: v.warna }}
      />
      <div>
        <div className="text-[11px] font-semibold leading-tight" style={{ color: v.warna }}>
          {v.vihara.name}
        </div>
        <div className="text-[10px] text-km-ink-muted">{v.vihara.kota ?? ""}</div>
      </div>
    </div>
  );
}

// ── TAB 1: RINGKASAN ──
function RingkasanTab({ data, vd, periode }: TabProps) {
  const K = data.konsolidasi;
  const totalPend = num(K.pendapatan.total);
  const totalBeban = num(K.beban.total);
  const kenTotal = num(K.kenaikan.total);
  const pct = (v: number) => (totalPend > 0 ? Math.round((v / totalPend) * 100) : 0);
  const sub = `${vd.length} vihara · ${periode}`;
  return (
    <div className="p-4">
      {/* 3 metric cards */}
      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-km-border bg-km-panel px-3.5 py-3">
          <p className="text-[11px] text-km-ink-muted">Total Pendapatan</p>
          <p className="mt-1 text-[20px] font-medium leading-tight text-km-green">{fmtRp(totalPend)}</p>
          <p className="mt-1 text-[11px] text-km-ink-muted">{sub}</p>
        </div>
        <div className="rounded-xl border border-km-border bg-km-panel px-3.5 py-3">
          <p className="text-[11px] text-km-ink-muted">Total Beban</p>
          <p className="mt-1 text-[20px] font-medium leading-tight text-km-red-ink">{fmtRp(totalBeban)}</p>
          <p className="mt-1 text-[11px] text-km-ink-muted">{sub}</p>
        </div>
        <div className="rounded-xl border border-km-border bg-km-panel px-3.5 py-3">
          <p className="text-[11px] text-km-ink-muted">Kenaikan Aset Neto</p>
          <p
            className={`mt-1 text-[20px] font-medium leading-tight ${
              kenTotal >= 0 ? "text-km-green" : "text-km-red-ink"
            }`}
          >
            {fmtRp(kenTotal)}
          </p>
          <p className="mt-1 text-[11px] text-km-ink-muted">{sub}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* Porsi pendapatan per vihara */}
        <Card>
          <CardHeader
            title="Porsi Pendapatan per Vihara"
            subtitle="Kontribusi masing-masing vihara terhadap total pendapatan yayasan"
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-km-bg">
                  <th className="min-w-[140px] px-3 py-1.5 text-left text-[10px] font-semibold text-km-ink-muted">
                    Vihara
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-km-ink-muted">
                    Pendapatan
                  </th>
                  <th className="px-1.5 py-1.5 text-right text-[10px] font-semibold text-km-ink-muted">%</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-km-ink-muted">Beban</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-km-ink-muted">
                    Kenaikan
                  </th>
                </tr>
              </thead>
              <tbody>
                {vd.map((v) => {
                  const ken = num(v.kenaikan.total);
                  return (
                    <tr key={v.vihara.id} className="border-b border-km-border/40">
                      <td className="px-3 py-1.5">
                        <ViharaNameCell v={v} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-[11px] font-medium text-km-green">
                        {fmtRp(num(v.pendapatan.total))}
                      </td>
                      <td className="px-1.5 py-1.5 text-right text-[11px] text-km-ink-muted">
                        {pct(num(v.pendapatan.total))}%
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-[11px] text-km-red-ink">
                        {fmtRp(num(v.beban.total))}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-1.5 text-right text-[11px] font-semibold ${
                          ken >= 0 ? "text-km-green" : "text-km-red-ink"
                        }`}
                      >
                        {fmtRp(ken)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-[1.5px] border-km-border bg-[#F8F7F2]">
                  <td className="px-3 py-1.5 text-[11px] font-bold">Total Yayasan</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-[11px] font-bold text-km-green">
                    {fmtRp(totalPend)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right text-[11px] font-bold text-km-ink-muted">100%</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-[11px] font-bold text-km-red-ink">
                    {fmtRp(totalBeban)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-1.5 text-right text-[11px] font-bold ${
                      kenTotal >= 0 ? "text-km-green" : "text-km-red-ink"
                    }`}
                  >
                    {fmtRp(kenTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Posisi aset per vihara */}
        <Card>
          <CardHeader title="Posisi Aset per Vihara" />
          {vd.map((v) => (
            <div key={v.vihara.id} className="border-b border-km-border/40 px-4 py-2.5">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-[12px] font-semibold" style={{ color: v.warna }}>
                  {v.vihara.name}
                </span>
                <span className="text-[12px] font-semibold">{fmtRp(num(v.posisi.total_aset))}</span>
              </div>
              <div className="text-[10px] text-km-ink-muted">
                Kas: {fmtRp(num(v.posisi.kas_setara))} · Piutang PG: {fmtRp(num(v.posisi.pg_clearing))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t-[1.5px] border-km-border px-4 py-2.5 text-[12px] font-semibold">
            <span>TOTAL ASET YAYASAN</span>
            <span className="text-km-green">{fmtRp(num(K.posisi.total_aset))}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── TAB 2: POSISI KEUANGAN KONSOLIDASI ──
function PosisiTab({ data, vd, periode }: TabProps) {
  const K = data.konsolidasi;
  const liab = num(K.posisi.liabilitas);
  const anTotal = num(K.posisi.aset_neto.total);
  const viharaLiab = vd.filter((v) => num(v.posisi.liabilitas) !== 0);
  return (
    <div className="max-w-[680px] px-6 py-5">
      <LapTitle org={data.yayasan.nama} jenis="LAPORAN POSISI KEUANGAN KONSOLIDASI" periode={`Per ${periode}`} />
      <LapHeader>ASET</LapHeader>
      <LapHeader>Kas dan Setara Kas</LapHeader>
      {vd.map((v) => (
        <LapRow
          key={v.vihara.id}
          indent={1}
          label={`${v.vihara.name} — Kas & Bank`}
          labelColor={v.warna}
          value={num(v.posisi.kas_setara)}
        />
      ))}
      <LapRow label="Subtotal Kas dan Setara Kas" value={num(K.posisi.kas_setara)} isTotal tone="green" />
      <LapHeader>Piutang Platform (1160)</LapHeader>
      {vd.map((v) => (
        <LapRow
          key={v.vihara.id}
          indent={1}
          label={`${v.vihara.name} — Piutang PG`}
          labelColor={v.warna}
          value={num(v.posisi.pg_clearing)}
        />
      ))}
      <LapRow label="Subtotal Piutang PG" value={num(K.posisi.pg_clearing)} isTotal bold />
      <LapRow label="TOTAL ASET" value={num(K.posisi.total_aset)} isTotal tone="green" />

      <LapHeader>LIABILITAS</LapHeader>
      {viharaLiab.map((v) => (
        <LapRow
          key={v.vihara.id}
          indent={1}
          label={v.vihara.name}
          labelColor={v.warna}
          value={num(v.posisi.liabilitas)}
        />
      ))}
      <LapRow label="TOTAL LIABILITAS" value={liab} isTotal />

      <LapHeader>ASET NETO</LapHeader>
      <LapRow indent={1} code="3100" label="Aset Neto Tanpa Pembatasan" value={num(K.posisi.aset_neto.tp)} />
      <LapRow indent={1} code="3200" label="Aset Neto Dengan Pembatasan" value={num(K.posisi.aset_neto.dp)} />
      <LapRow label="TOTAL ASET NETO" value={anTotal} isTotal tone="accent" />
      <LapRow label="TOTAL LIABILITAS DAN ASET NETO" value={liab + anTotal} isTotal tone="accent" />

      {/* Footer check balance konsolidasi + per vihara */}
      <div className="border-t border-km-border/40 bg-[#F8F7F2] px-4 py-2.5 text-[11px] leading-[1.8]">
        {K.posisi.balance_ok ? (
          <div className="font-semibold text-km-green">
            ✓ Balance — Total Aset Konsolidasi = Total Liabilitas + Aset Neto
          </div>
        ) : (
          <div className="font-semibold text-km-amber-ink">
            ⚠ Tidak balance — selisih {fmtRp(Math.abs(num(K.posisi.selisih)))}
          </div>
        )}
        {vd.map((v) => (
          <div
            key={v.vihara.id}
            className={v.posisi.balance_ok ? "text-km-ink-muted" : "text-km-amber-ink"}
          >
            {v.vihara.name}: Aset {fmtRp(num(v.posisi.total_aset))}{" "}
            {v.posisi.balance_ok ? "= ✓" : `≠ selisih ${fmtRp(Math.abs(num(v.posisi.selisih)))}`} · Kenaikan{" "}
            {fmtRp(num(v.kenaikan.total))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAB 3: PENGHASILAN KOMPREHENSIF KONSOLIDASI ──
function PenghasilanTab({ data, vd, periode }: TabProps) {
  const K = data.konsolidasi;
  const kenTotal = num(K.kenaikan.total);
  return (
    <div className="px-6 py-5">
      <LapTitle
        org={data.yayasan.nama}
        jenis="LAPORAN PENGHASILAN KOMPREHENSIF KONSOLIDASI"
        periode={`Untuk Periode: ${periode}`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <Table3Head />
          <tbody>
            <Hdr3>PENDAPATAN DAN DUKUNGAN — PER VIHARA</Hdr3>
            {vd.map((v) => (
              <Row3
                key={v.vihara.id}
                indent={1}
                label={v.vihara.name}
                labelColor={v.warna}
                tp={num(v.pendapatan.tp)}
                dp={num(v.pendapatan.dp)}
                total={num(v.pendapatan.total)}
              />
            ))}
            <Row3
              label="TOTAL PENDAPATAN DAN DUKUNGAN"
              tp={num(K.pendapatan.tp)}
              dp={num(K.pendapatan.dp)}
              total={num(K.pendapatan.total)}
              isTotal
              tone="green"
            />
            <Hdr3>BEBAN — PER VIHARA</Hdr3>
            {vd
              .filter((v) => num(v.beban.total) > 0)
              .map((v) => (
                <Row3
                  key={v.vihara.id}
                  indent={1}
                  label={v.vihara.name}
                  labelColor={v.warna}
                  tp={num(v.beban.total)}
                  dp={null}
                  total={num(v.beban.total)}
                />
              ))}
            <Row3
              label="TOTAL BEBAN"
              tp={num(K.beban.total)}
              dp={null}
              total={num(K.beban.total)}
              isTotal
              tone="red"
            />
            <Hdr3>KENAIKAN / (PENURUNAN) ASET NETO</Hdr3>
            {vd.map((v) => (
              <Row3
                key={v.vihara.id}
                indent={1}
                label={v.vihara.name}
                labelColor={v.warna}
                tp={num(v.kenaikan.tp)}
                dp={num(v.kenaikan.dp)}
                total={num(v.kenaikan.total)}
                tone={num(v.kenaikan.total) >= 0 ? "green" : "red"}
              />
            ))}
            <Row3
              label="TOTAL KENAIKAN ASET NETO"
              tp={num(K.kenaikan.tp)}
              dp={num(K.kenaikan.dp)}
              total={kenTotal}
              isTotal
              tone={kenTotal >= 0 ? "green" : "red"}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── TAB 4: PERUBAHAN ASET NETO KONSOLIDASI ──
// Backend tidak mengirim aset neto awal konsolidasi — diturunkan:
// awal = aset neto akhir − kenaikan (per kolom TP/DP/Total).
function PerubahanTab({ data, periode }: { data: KonsolidasiResponse; periode: string }) {
  const K = data.konsolidasi;
  const akhir = {
    tp: num(K.posisi.aset_neto.tp),
    dp: num(K.posisi.aset_neto.dp),
    total: num(K.posisi.aset_neto.total),
  };
  const ken = { tp: num(K.kenaikan.tp), dp: num(K.kenaikan.dp), total: num(K.kenaikan.total) };
  const awal = { tp: akhir.tp - ken.tp, dp: akhir.dp - ken.dp, total: akhir.total - ken.total };
  const beban = num(K.beban.total);
  return (
    <div className="max-w-[700px] px-6 py-5">
      <LapTitle
        org={data.yayasan.nama}
        jenis="LAPORAN PERUBAHAN ASET NETO KONSOLIDASI"
        periode={`Untuk Periode: ${periode}`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <Table3Head />
          <tbody>
            <Row3 label="Aset neto awal periode" tp={awal.tp} dp={awal.dp} total={awal.total} />
            <Row3
              indent={1}
              label="Pendapatan periode berjalan"
              tp={num(K.pendapatan.tp)}
              dp={num(K.pendapatan.dp)}
              total={num(K.pendapatan.total)}
              tone="green"
            />
            <Row3
              indent={1}
              label="Beban periode berjalan"
              tp={-Math.abs(beban)}
              dp={null}
              total={-Math.abs(beban)}
              tone="red"
            />
            <Row3
              label="KENAIKAN / (PENURUNAN) ASET NETO"
              tp={ken.tp}
              dp={ken.dp}
              total={ken.total}
              bold
              tone={ken.total >= 0 ? "green" : "red"}
            />
            <Row3
              label="ASET NETO AKHIR PERIODE"
              tp={akhir.tp}
              dp={akhir.dp}
              total={akhir.total}
              isTotal
              tone="accent"
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── TAB 5: ARUS KAS KONSOLIDASI ──
function ArusKasTab({ data, vd, periode }: TabProps) {
  const K = data.konsolidasi;
  const arusBersih = num(K.arus_kas_bersih);
  const kasAkhir = num(K.posisi.kas_setara);
  const kasAwal = kasAkhir - arusBersih;
  return (
    <div className="max-w-[600px] px-6 py-5">
      <LapTitle org={data.yayasan.nama} jenis="LAPORAN ARUS KAS KONSOLIDASI" periode={`Untuk Periode: ${periode}`} />
      <LapHeader>ARUS KAS DARI AKTIVITAS OPERASI</LapHeader>
      {vd.map((v) => {
        const ak = num(v.arus_kas_bersih);
        return (
          <LapRow
            key={v.vihara.id}
            indent={1}
            label={v.vihara.name}
            labelColor={v.warna}
            value={ak}
            tone={ak >= 0 ? "green" : "red"}
          />
        );
      })}
      <LapRow
        label="ARUS KAS BERSIH DARI AKTIVITAS OPERASI"
        value={arusBersih}
        isTotal
        tone={arusBersih >= 0 ? "green" : "red"}
      />
      <LapRow label="Arus Kas Investasi" value={0} tone="muted" labelMuted />
      <LapRow label="Arus Kas Pendanaan" value={0} tone="muted" labelMuted />
      <LapRow label="KENAIKAN / (PENURUNAN) KAS" value={arusBersih} isTotal />
      <LapRow label="Kas dan Setara Kas Awal Periode" value={kasAwal} />
      <LapRow label="KAS DAN SETARA KAS AKHIR PERIODE" value={kasAkhir} isTotal tone="accent" />
    </div>
  );
}

// ── TAB 6: PERBANDINGAN VIHARA ──
function PerbandinganTab({ data, vd }: { data: KonsolidasiResponse; vd: VRow[] }) {
  const K = data.konsolidasi;
  const kenTotal = num(K.kenaikan.total);
  const th = "px-3 py-2 text-right text-[11px] font-semibold text-km-ink-muted";
  const td = "whitespace-nowrap px-3 py-2 text-right text-[12px] tabular-nums";
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-[11px] font-semibold text-km-ink-muted">Vihara</th>
            <th className={th}>Pendapatan</th>
            <th className={th}>Beban</th>
            <th className={th}>Kenaikan Aset Neto</th>
            <th className={th}>Total Aset</th>
            <th className={th}>Piutang PG</th>
          </tr>
        </thead>
        <tbody>
          {vd.map((v) => {
            const ken = num(v.kenaikan.total);
            return (
              <tr key={v.vihara.id} className="border-b border-km-border/40">
                <td className="px-4 py-2 text-[12px] font-semibold" style={{ color: v.warna }}>
                  {v.vihara.name}
                  <br />
                  <span className="text-[10px] font-normal text-km-ink-muted">{v.vihara.kota ?? ""}</span>
                </td>
                <td className={`${td} text-km-green`}>{fmtRp(num(v.pendapatan.total))}</td>
                <td className={`${td} text-km-red-ink`}>{fmtRp(num(v.beban.total))}</td>
                <td className={`${td} font-semibold ${ken >= 0 ? "text-km-green" : "text-km-red-ink"}`}>
                  {fmtRp(ken)}
                </td>
                <td className={td}>{fmtRp(num(v.posisi.total_aset))}</td>
                <td className={`${td} text-km-amber-ink`}>{fmtRp(num(v.posisi.pg_clearing))}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-km-border bg-[#F8F7F2]">
            <td className="px-4 py-2 text-[12px] font-bold">TOTAL YAYASAN</td>
            <td className={`${td} font-bold text-km-green`}>{fmtRp(num(K.pendapatan.total))}</td>
            <td className={`${td} font-bold text-km-red-ink`}>{fmtRp(num(K.beban.total))}</td>
            <td className={`${td} font-bold ${kenTotal >= 0 ? "text-km-green" : "text-km-red-ink"}`}>
              {fmtRp(kenTotal)}
            </td>
            <td className={`${td} font-bold`}>{fmtRp(num(K.posisi.total_aset))}</td>
            <td className={`${td} font-bold text-km-amber-ink`}>{fmtRp(num(K.posisi.pg_clearing))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
