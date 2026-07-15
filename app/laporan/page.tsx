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
  Row3,
  Table3Head,
  LapTitle,
  TopbarSelect,
} from "@/components/ReportRows";
import { Toast } from "@/components/Toast";
import { exportIsak35Excel } from "@/lib/isak35Excel";
import { num } from "@/lib/kasBank";
import {
  ArusKasRow,
  Isak35Mode,
  Isak35Response,
  MONTHS_ID,
  TpDp,
  getIsak35,
  isak35PeriodLabel,
} from "@/lib/laporanKeuangan";
import { useVihara } from "@/lib/useVihara";
import { Vihara, listViharas } from "@/lib/vihara";

const YAYASAN = "Yayasan Dhammavihara Indonesia";

// Blok laporan (LapTitle/LapHeader/LapRow/Row3/…) dipakai bersama dengan
// /konsolidasi — lihat components/ReportRows.tsx.

type TabKey = "posisi" | "penghasilan" | "perubahan" | "aruskas";

const TABS: { key: TabKey; label: string }[] = [
  { key: "posisi", label: "Posisi Keuangan" },
  { key: "penghasilan", label: "Penghasilan Komprehensif" },
  { key: "perubahan", label: "Perubahan Aset Neto" },
  { key: "aruskas", label: "Arus Kas" },
];

export default function LaporanPage() {
  const now = new Date();
  const [mode, setMode] = useState<Isak35Mode>("ytd");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<TabKey>("posisi");
  const [data, setData] = useState<Isak35Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viharas, setViharas] = useState<Vihara[]>([]);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const { viharaId, ready: viharaReady } = useVihara();

  useEffect(() => {
    listViharas({})
      .then((r) => setViharas(r.data))
      .catch(() => {
        /* user vihara tetap mungkin tak boleh list — org pakai fallback */
      });
  }, []);

  useEffect(() => {
    if (!viharaReady) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getIsak35({ mode, year, month, vihara_id: viharaId })
      .then((d) => {
        if (alive) setData(d);
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
  }, [mode, year, month, viharaId, viharaReady]);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const periodeLabel = isak35PeriodLabel(mode, year, month);
  const vihara = viharaId != null ? viharas.find((v) => v.id === viharaId) : undefined;
  const org = viharaId == null ? YAYASAN : vihara?.name ?? `Vihara #${viharaId}`;
  const orgCode = viharaId == null ? "YDI" : vihara?.code ?? `V${viharaId}`;

  async function handleExport() {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const filename = await exportIsak35Excel({
        data,
        org,
        orgCode,
        periodeLabel,
        vihara_id: viharaId,
      });
      setToast({ message: `Excel berhasil diunduh — 6 sheet (${filename})`, tone: "success" });
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Gagal export Excel",
        tone: "error",
      });
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

  return (
    <AppShell
      title="Laporan Keuangan"
      subtitle="Entitas Berorientasi Nonlaba · ISAK 35"
      actions={periodSelector}
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <CardHeader
          title="Laporan Keuangan — ISAK 35"
          subtitle={
            <>
              Entitas Berorientasi Nonlaba · <span className="font-medium">{periodeLabel}</span>
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
          <p className="px-4 py-12 text-center text-[12px] text-km-ink-muted">Memuat laporan…</p>
        ) : !data ? (
          <p className="px-4 py-12 text-center text-[12px] text-km-ink-muted">
            Laporan belum tersedia.
          </p>
        ) : (
          <>
            {tab === "posisi" && <PosisiTab data={data} org={org} periode={periodeLabel} />}
            {tab === "penghasilan" && <PenghasilanTab data={data} org={org} periode={periodeLabel} />}
            {tab === "perubahan" && <PerubahanTab data={data} org={org} periode={periodeLabel} />}
            {tab === "aruskas" && <ArusKasTab data={data} org={org} periode={periodeLabel} />}
          </>
        )}
      </Card>

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </AppShell>
  );
}

type TabProps = { data: Isak35Response; org: string; periode: string };

// ── TAB 1: LAPORAN POSISI KEUANGAN ──
function PosisiTab({ data, org, periode }: TabProps) {
  const p = data.posisi;
  const pg = num(p.pg_clearing);
  const totalLiabAsetNeto = num(p.liabilitas.total) + num(p.aset_neto.total);
  return (
    <div className="max-w-[600px] px-6 py-5">
      <LapTitle org={org} jenis="LAPORAN POSISI KEUANGAN" periode={`Per ${periode}`} />
      <LapHeader>ASET</LapHeader>
      <LapHeader>Kas dan Setara Kas</LapHeader>
      {p.kas_setara.rows.map((r) => (
        <LapRow
          key={r.code}
          indent={1}
          code={r.code}
          label={r.name}
          value={num(r.balance)}
          labelMuted={num(r.balance) === 0}
        />
      ))}
      <LapRow label="TOTAL KAS DAN SETARA KAS" value={num(p.kas_setara.total)} isTotal tone="green" />
      <LapRow
        indent={1}
        code="1160"
        label="Payment Gateway Clearing (KM belum settle)"
        value={pg}
        tone={pg > 0 ? "amber" : "muted"}
        labelMuted={pg <= 0}
      />
      <LapRow label="TOTAL ASET" value={num(p.total_aset)} isTotal tone="green" />

      <LapHeader>LIABILITAS</LapHeader>
      {p.liabilitas.rows.map((r) => (
        <LapRow
          key={r.code}
          indent={1}
          code={r.code}
          label={r.name}
          value={num(r.balance)}
          labelMuted={num(r.balance) === 0}
          tone={num(r.balance) === 0 ? "muted" : undefined}
        />
      ))}
      <LapRow label="TOTAL LIABILITAS" value={num(p.liabilitas.total)} isTotal />

      <LapHeader>ASET NETO</LapHeader>
      <LapRow indent={1} code="3100" label="Aset Neto Tanpa Pembatasan" value={num(p.aset_neto.tp)} />
      <LapRow indent={1} code="3200" label="Aset Neto Dengan Pembatasan" value={num(p.aset_neto.dp)} />
      <LapRow label="TOTAL ASET NETO" value={num(p.aset_neto.total)} isTotal tone="accent" />
      <LapRow label="TOTAL LIABILITAS DAN ASET NETO" value={totalLiabAsetNeto} isTotal tone="accent" />

      <div className="border-t border-km-border/40 bg-[#F8F7F2] px-4 py-2.5 text-[11px] leading-relaxed">
        {p.balance_ok ? (
          <strong className="text-km-green">
            ✓ Balance — Total Aset = Total Liabilitas + Total Aset Neto = {fmtRp(num(p.total_aset))}
          </strong>
        ) : (
          <strong className="text-km-red-ink">
            ⚠ Tidak balance — selisih {fmtRp(num(p.selisih))} (Total Aset {fmtRp(num(p.total_aset))} vs
            Liabilitas + Aset Neto {fmtRp(totalLiabAsetNeto)})
          </strong>
        )}
      </div>
    </div>
  );
}

// ── TAB 2: LAPORAN PENGHASILAN KOMPREHENSIF ──
function PenghasilanTab({ data, org, periode }: TabProps) {
  const p = data.penghasilan;
  const kenaikan = num(p.kenaikan.total);
  return (
    <div className="px-6 py-5">
      <LapTitle org={org} jenis="LAPORAN PENGHASILAN KOMPREHENSIF" periode={`Untuk Periode: ${periode}`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <Table3Head />
          <tbody>
            <Hdr3>PENDAPATAN DAN DUKUNGAN</Hdr3>
            {p.pendapatan.rows.map((r) => (
              <Row3
                key={r.code}
                indent={1}
                code={r.code}
                label={r.label}
                tp={r.tp === null ? null : num(r.tp)}
                dp={r.dp === null ? null : num(r.dp)}
                total={num(r.total)}
                labelMuted={num(r.total) === 0}
              />
            ))}
            <Row3
              label="TOTAL PENDAPATAN DAN DUKUNGAN"
              tp={num(p.pendapatan.tp)}
              dp={num(p.pendapatan.dp)}
              total={num(p.pendapatan.total)}
              isTotal
              tone="green"
            />
            <Hdr3>BEBAN</Hdr3>
            {p.beban.rows.map((r) => (
              <Row3
                key={r.group}
                indent={1}
                label={r.label}
                tp={num(r.total)}
                dp={null}
                total={num(r.total)}
                labelMuted={num(r.total) === 0}
              />
            ))}
            <Row3
              label="TOTAL BEBAN"
              tp={num(p.beban.total)}
              dp={null}
              total={num(p.beban.total)}
              isTotal
              tone="red"
            />
            <Hdr3>KENAIKAN / (PENURUNAN) ASET NETO</Hdr3>
            <Row3
              label="Kenaikan / (penurunan) aset neto"
              tp={num(p.kenaikan.tp)}
              dp={num(p.kenaikan.dp)}
              total={kenaikan}
              isTotal
              tone={kenaikan >= 0 ? "green" : "red"}
            />
            <tr>
              <td colSpan={4} className="bg-[#F8F7F2] px-4 pb-2.5 pt-1.5 text-[10px] text-km-ink-muted">
                ⓘ <strong>Rumus:</strong> Kenaikan Aset Neto = Total Pendapatan (
                {fmtRp(num(p.pendapatan.total))}) − Total Beban ({fmtRp(num(p.beban.total))}) ={" "}
                <strong>{fmtRp(kenaikan)}</strong> · Beban dialokasikan seluruhnya ke kolom Tanpa
                Pembatasan sesuai praktik ISAK 35.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── TAB 3: LAPORAN PERUBAHAN ASET NETO ──
function PerubahanTab({ data, org, periode }: TabProps) {
  const p = data.perubahan;
  const n3 = (v: TpDp) => ({ tp: num(v.tp), dp: num(v.dp), total: num(v.total) });
  const awal = n3(p.awal);
  const pend = n3(p.pendapatan);
  const beban = n3(p.beban);
  const kenaikan = n3(p.kenaikan);
  const akhir = n3(p.akhir);
  return (
    <div className="max-w-[700px] px-6 py-5">
      <LapTitle org={org} jenis="LAPORAN PERUBAHAN ASET NETO" periode={`Untuk Periode: ${periode}`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <Table3Head />
          <tbody>
            <Row3 label="Aset neto awal periode" tp={awal.tp} dp={awal.dp} total={awal.total} />
            <Row3
              indent={1}
              label="Pendapatan periode berjalan"
              tp={pend.tp}
              dp={pend.dp}
              total={pend.total}
              tone="green"
            />
            <Row3
              indent={1}
              label="Beban periode berjalan"
              tp={-Math.abs(beban.tp)}
              dp={-Math.abs(beban.dp)}
              total={-Math.abs(beban.total)}
              tone="red"
            />
            <Row3
              label="KENAIKAN / (PENURUNAN) ASET NETO"
              tp={kenaikan.tp}
              dp={kenaikan.dp}
              total={kenaikan.total}
              bold
              tone={kenaikan.total >= 0 ? "green" : "red"}
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

// ── TAB 4: LAPORAN ARUS KAS ──
function ArusKasTab({ data, org, periode }: TabProps) {
  const ak = data.arus_kas;
  const kenaikanKas = num(ak.operasi.total) + num(ak.investasi.total) + num(ak.pendanaan.total);
  const rowsOf = (rows: ArusKasRow[], zeroMuted = false) =>
    rows.map((r) => {
      const amount = num(r.amount);
      return (
        <LapRow
          key={r.key}
          indent={1}
          label={r.label}
          value={amount}
          tone={amount === 0 && zeroMuted ? "muted" : amount >= 0 ? "green" : "red"}
          labelMuted={amount === 0}
        />
      );
    });
  return (
    <div className="max-w-[600px] px-6 py-5">
      <LapTitle org={org} jenis="LAPORAN ARUS KAS" periode={`Untuk Periode: ${periode}`} />
      <LapHeader>ARUS KAS DARI AKTIVITAS OPERASI</LapHeader>
      {rowsOf(ak.operasi.rows)}
      <LapRow
        label="ARUS KAS BERSIH DARI AKTIVITAS OPERASI"
        value={num(ak.operasi.total)}
        isTotal
        tone={num(ak.operasi.total) >= 0 ? "green" : "red"}
      />
      <LapHeader>ARUS KAS DARI AKTIVITAS INVESTASI</LapHeader>
      {rowsOf(ak.investasi.rows, true)}
      <LapRow label="ARUS KAS BERSIH DARI AKTIVITAS INVESTASI" value={num(ak.investasi.total)} isTotal />
      <LapHeader>ARUS KAS DARI AKTIVITAS PENDANAAN</LapHeader>
      {rowsOf(ak.pendanaan.rows, true)}
      <LapRow label="ARUS KAS BERSIH DARI AKTIVITAS PENDANAAN" value={num(ak.pendanaan.total)} isTotal />
      <LapHeader>REKONSILIASI</LapHeader>
      <LapRow
        label="KENAIKAN / (PENURUNAN) KAS"
        value={kenaikanKas}
        bold
        tone={kenaikanKas >= 0 ? "green" : "red"}
      />
      <LapRow label="Kas dan setara kas awal periode" value={num(ak.kas_awal)} />
      <LapRow label="KAS DAN SETARA KAS AKHIR PERIODE" value={num(ak.kas_akhir)} isTotal tone="accent" />
      {ak.check_kas_akhir_ok && (
        <div className="bg-[#F8F7F2] px-4 py-2 text-[11px]">
          <span className="font-semibold text-km-green">✓ Arus kas bersih = saldo kas aktual</span>
        </div>
      )}
    </div>
  );
}
