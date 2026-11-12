"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DANA_CATEGORY_LABEL } from "@/components/DanaTag";
import { Field, FormGrid, Input, Select } from "@/components/Field";
import { Toast } from "@/components/Toast";
import { exportCetakExcel, groupCetak } from "@/lib/cetakExcel";
import { num } from "@/lib/kasBank";
import { listTransactions, TransactionRow, TransactionTipe } from "@/lib/transactions";
import { useVihara } from "@/lib/useVihara";
import { listViharas, Vihara } from "@/lib/vihara";

const YAYASAN = "Yayasan Dhammavihara Indonesia";

const DANA_OPTIONS = ["dana_perayaan", "dana_operasional", "dana_bhikkhu", "dana_paramita"];

/** Filter dana → kategori biaya padanannya untuk sisi pengeluaran. */
const DANA_TO_BIAYA: Record<string, string> = {
  dana_perayaan: "biaya_perayaan",
  dana_operasional: "biaya_operasional",
  dana_bhikkhu: "biaya_bhikkhu",
  dana_paramita: "biaya_paramita",
};

const MAX_PAGES = 10; // cap pagination per tipe (10 × 200 = 2.000 baris)

const fmtRp = (n: number) =>
  (n < 0 ? "-" : "") + "Rp " + Math.round(Math.abs(n)).toLocaleString("id-ID");

const fmtDate = (iso: string) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type LoadedReport = {
  rows: TransactionRow[];
  truncated: boolean;
  dari: string;
  sampai: string;
  org: string;
};

// ── HTML laporan ala mockup previewLaporan() — dipakai preview & print ──
function buildLaporanHtml(r: LoadedReport): string {
  const masuk = r.rows.filter((t) => t.tipe === "Penerimaan");
  const keluar = r.rows.filter((t) => t.tipe === "Pengeluaran");
  const totalMasuk = masuk.reduce((a, t) => a + num(t.amount), 0);
  const totalKeluar = keluar.reduce((a, t) => a + num(t.amount), 0);
  const saldo = totalMasuk - totalKeluar;

  const groupHtml = (rows: TransactionRow[]) =>
    groupCetak(rows)
      .map(
        (g) => `
        <div style="margin-bottom:10px">
          <div style="font-size:12px;font-weight:600;color:#444;margin-bottom:4px">${escapeHtml(g.label)} — ${fmtRp(g.total)}</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            ${g.items
              .map(
                (it) =>
                  `<tr><td style="padding:3px 8px 3px 16px;color:#555">${escapeHtml(it.name)}</td><td style="text-align:right;padding:3px 8px;font-weight:500;white-space:nowrap">${fmtRp(it.amount)}</td></tr>`,
              )
              .join("")}
          </table>
        </div>`,
      )
      .join("");

  return `
    <div style="text-align:center;margin-bottom:20px;border-bottom:1px solid #ccc;padding-bottom:14px">
      <div style="font-size:16px;font-weight:700">LAPORAN KEUANGAN ${escapeHtml(r.org.toUpperCase())}</div>
      <div style="font-size:13px;color:#666;margin-top:4px">Periode: ${fmtDate(r.dari)} s/d ${fmtDate(r.sampai)}</div>
      <div style="font-size:11px;color:#888;margin-top:2px">Dicetak: ${fmtDate(isoToday())}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center">
        <div style="font-size:11px;color:#666">Total Penerimaan</div>
        <div style="font-size:18px;font-weight:600;color:#1A6B4A">${fmtRp(totalMasuk)}</div>
      </div>
      <div style="border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center">
        <div style="font-size:11px;color:#666">Total Pengeluaran</div>
        <div style="font-size:18px;font-weight:600;color:#A32D2D">${fmtRp(totalKeluar)}</div>
      </div>
      <div style="border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center">
        <div style="font-size:11px;color:#666">Surplus / (Defisit)</div>
        <div style="font-size:18px;font-weight:600;color:${saldo >= 0 ? "#1A6B4A" : "#A32D2D"}">${fmtRp(Math.abs(saldo))}</div>
      </div>
    </div>

    <div style="margin-bottom:18px">
      <div style="font-size:13px;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px">I. PENERIMAAN DANA</div>
      ${groupHtml(masuk) || '<div style="font-size:11px;color:#888;padding:4px 0">Tidak ada penerimaan pada periode/filter ini.</div>'}
      <div style="font-size:12px;font-weight:700;border-top:1px solid #ddd;padding-top:6px;text-align:right">Total Penerimaan: ${fmtRp(totalMasuk)}</div>
    </div>

    <div style="margin-bottom:18px">
      <div style="font-size:13px;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px">II. PENGELUARAN</div>
      ${groupHtml(keluar) || '<div style="font-size:11px;color:#888;padding:4px 0">Tidak ada pengeluaran pada periode/filter ini.</div>'}
      <div style="font-size:12px;font-weight:700;border-top:1px solid #ddd;padding-top:6px;text-align:right">Total Pengeluaran: ${fmtRp(totalKeluar)}</div>
    </div>

    <div style="font-size:13px;font-weight:700;border-top:2px solid #333;padding-top:8px;text-align:right">
      SALDO BERSIH: ${fmtRp(Math.abs(saldo))} ${saldo < 0 ? "(DEFISIT)" : ""}
    </div>

    <div style="margin-top:24px;font-size:11px;color:#888">
      <div>Laporan ini dibuat secara otomatis oleh Sistem Keuangan ${escapeHtml(r.org)}.</div>
      <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
        <div style="text-align:center"><div style="border-top:1px solid #555;padding-top:4px;margin-top:40px">Bendahara</div></div>
        <div style="text-align:center"><div style="border-top:1px solid #555;padding-top:4px;margin-top:40px">Ketua / Pengurus</div></div>
      </div>
    </div>`;
}

export default function CetakPage() {
  const now = new Date();
  const [dari, setDari] = useState(`${now.getFullYear()}-01-01`);
  const [sampai, setSampai] = useState(isoToday());
  const [dana, setDana] = useState("");
  const [tipe, setTipe] = useState<TransactionTipe | "">("");

  const [viharas, setViharas] = useState<Vihara[]>([]);
  const { viharaId, ready: viharaReady } = useVihara();

  const [busy, setBusy] = useState<null | "preview" | "print" | "export">(null);
  const [preview, setPreview] = useState<LoadedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    listViharas({})
      .then((r) => setViharas(r.data))
      .catch(() => {
        /* user vihara tetap mungkin tak boleh list — org pakai fallback */
      });
  }, []);

  const vihara = viharaId != null ? viharas.find((v) => v.id === viharaId) : undefined;
  const org = viharaId == null ? YAYASAN : vihara?.name ?? "";
  const orgCode = viharaId == null ? "YDI" : vihara?.code ?? "";

  // Ambil transaksi posted sesuai filter — paginasi per_page 200, cap 10 hlm/tipe.
  async function fetchRows(): Promise<{ rows: TransactionRow[]; truncated: boolean }> {
    const tipes: TransactionTipe[] = tipe ? [tipe] : ["Penerimaan", "Pengeluaran"];
    const rows: TransactionRow[] = [];
    let truncated = false;
    for (const t of tipes) {
      const category = dana
        ? t === "Penerimaan"
          ? dana
          : DANA_TO_BIAYA[dana] ?? dana
        : undefined;
      let page = 1;
      for (;;) {
        const res = await listTransactions({
          from: dari,
          to: sampai,
          tipe: t,
          category,
          status: "posted",
          vihara_id: viharaId,
          per_page: 200,
          page,
        });
        rows.push(...res.data);
        if (page >= res.last_page) break;
        if (page >= MAX_PAGES) {
          truncated = true;
          break;
        }
        page += 1;
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return { rows, truncated };
  }

  async function withBusy(kind: "preview" | "print" | "export", fn: () => Promise<void>) {
    if (busy || !viharaReady) return;
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data laporan");
    } finally {
      setBusy(null);
    }
  }

  const handlePreview = () =>
    withBusy("preview", async () => {
      const { rows, truncated } = await fetchRows();
      setPreview({ rows, truncated, dari, sampai, org });
    });

  const handlePrint = () =>
    withBusy("print", async () => {
      const { rows, truncated } = await fetchRows();
      const report: LoadedReport = { rows, truncated, dari, sampai, org };
      setPreview(report);
      const w = window.open("about:blank", "_blank");
      if (!w) throw new Error("Popup diblokir browser — izinkan popup untuk mencetak");
      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>Laporan Keuangan ${escapeHtml(org)}</title>
        <style>body{font-family:Arial,sans-serif;padding:30px 40px;color:#222;font-size:12px}@media print{body{padding:20px}}</style>
      </head><body>${buildLaporanHtml(report)}</body></html>`);
      w.document.close();
      setTimeout(() => w.print(), 400);
    });

  const handleExport = () =>
    withBusy("export", async () => {
      const { rows } = await fetchRows();
      const filename = await exportCetakExcel({ rows, org, orgCode, dari, sampai });
      setToast({ message: `Excel berhasil diunduh — 2 sheet (${filename})`, tone: "success" });
      setTimeout(() => setToast(null), 4000);
    });

  const previewHtml = useMemo(() => (preview ? buildLaporanHtml(preview) : ""), [preview]);

  return (
    <AppShell
      title="Laporan Penerimaan Dana"
      subtitle="Ringkasan dan detail penerimaan dana seluruh kategori"
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
          {error}
        </p>
      )}

      <Card>
        <CardHeader title="Cetak / Export Laporan" subtitle="Pilih periode dan jenis laporan" />
        <div className="border-b border-km-border">
          <FormGrid className="lg:grid-cols-4">
            <Field label="Dari Tanggal">
              <Input
                type="date"
                value={dari}
                onChange={(e) => setDari(e.target.value)}
                aria-label="Dari tanggal"
              />
            </Field>
            <Field label="Sampai Tanggal">
              <Input
                type="date"
                value={sampai}
                onChange={(e) => setSampai(e.target.value)}
                aria-label="Sampai tanggal"
              />
            </Field>
            <Field label="Filter Kategori Dana">
              <Select value={dana} onChange={(e) => setDana(e.target.value)} aria-label="Filter kategori dana">
                <option value="">Semua Dana</option>
                {DANA_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {DANA_CATEGORY_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Filter Tipe">
              <Select
                value={tipe}
                onChange={(e) => setTipe(e.target.value as TransactionTipe | "")}
                aria-label="Filter tipe"
              >
                <option value="">Penerimaan &amp; Pengeluaran</option>
                <option value="Penerimaan">Penerimaan saja</option>
                <option value="Pengeluaran">Pengeluaran saja</option>
              </Select>
            </Field>
          </FormGrid>
        </div>
        <div className="flex flex-wrap gap-2.5 px-4 py-3.5">
          <Button variant="success" onClick={handlePrint} disabled={busy !== null || !viharaReady}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 6V2h8v4M4 11H2V6h12v5h-2" />
              <rect x="4" y="9" width="8" height="5" />
            </svg>
            {busy === "print" ? "Menyiapkan…" : "Cetak / Print"}
          </Button>
          <Button variant="ghost" onClick={handleExport} disabled={busy !== null || !viharaReady}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 13h8M8 3v7M5 7l3 3 3-3" />
            </svg>
            {busy === "export" ? "Mengunduh…" : "Export"}
          </Button>
          <Button variant="primary" onClick={handlePreview} disabled={busy !== null || !viharaReady}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="3" />
              <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
            </svg>
            {busy === "preview" ? "Memuat…" : "Preview"}
          </Button>
        </div>
      </Card>

      {preview && (
        <Card className="mt-4">
          <CardHeader
            title="Preview Laporan"
            right={
              <Button onClick={() => setPreview(null)}>Tutup preview</Button>
            }
          />
          {preview.truncated && (
            <p className="border-b border-km-border bg-km-amber-soft px-4 py-2 text-[11px] text-km-amber-ink">
              ⚠ Data melebihi {MAX_PAGES * 200} baris per tipe — laporan dipotong. Persempit periode
              atau filter untuk hasil lengkap.
            </p>
          )}
          <div
            className="px-6 py-5 text-[12px]"
            // HTML dibangun lokal dari data API (nama/label di-escape) — pola
            // mockup: markup yang sama dipakai untuk preview dan window print.
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </Card>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </AppShell>
  );
}
