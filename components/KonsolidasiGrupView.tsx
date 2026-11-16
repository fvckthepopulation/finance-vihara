"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { num } from "@/lib/kasBank";
import { BARIS_GRUP, exportGrupExcel, KonsolidasiGrupResponse } from "@/lib/konsolidasiGrup";

const rp = (n: number) =>
  Math.abs(n) < 0.005 ? "–" : `${n < 0 ? "(" : ""}${Math.round(Math.abs(n)).toLocaleString("id-ID")}${n < 0 ? ")" : ""}`;

const tgl = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Laporan Grup Konsolidasi (FV-66): kolom per yayasan anggota, kolom
 * Eliminasi, dan Total Grup. Kolom per yayasan bisa disembunyikan.
 */
export function KonsolidasiGrupView({
  data,
  periodeLabel,
  loading,
  onToast,
}: {
  data: KonsolidasiGrupResponse;
  periodeLabel: string;
  loading: boolean;
  onToast: (t: { message: string; tone: "success" | "error" }) => void;
}) {
  const [perYayasan, setPerYayasan] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const f = await exportGrupExcel(data, periodeLabel);
      onToast({ message: `Export grup konsolidasi berhasil (${f})`, tone: "success" });
    } catch (e) {
      onToast({ message: e instanceof Error ? e.message : "Gagal export Excel", tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  const kodeYayasan = new Map(data.anggota.map((a) => [a.yayasan.id, a.yayasan.code]));

  return (
    <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} data-testid="grup-konsolidasi">
      <CardHeader
        title={`Grup Konsolidasi — ${data.grup.nama}`}
        subtitle={
          <>
            {data.anggota.length} yayasan anggota · <span className="font-medium">{periodeLabel}</span>
          </>
        }
        right={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] text-km-ink-soft">
              <input
                type="checkbox"
                checked={perYayasan}
                onChange={(e) => setPerYayasan(e.target.checked)}
                data-testid="grup-toggle-kolom"
              />
              Kolom per yayasan
            </label>
            <Button variant="primary" onClick={handleExport} disabled={exporting}>
              {exporting ? "Menyiapkan…" : "Export Excel"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-km-border px-4 py-2.5">
        {data.anggota.map((a) => (
          <span
            key={a.yayasan.id}
            className="rounded-full border border-km-border bg-km-panel-soft px-3 py-1 text-[11px] text-km-ink-soft"
            data-testid="grup-anggota"
          >
            <strong className="text-km-ink">{a.yayasan.code}</strong> {a.yayasan.nama} · {tgl(a.periode.start)} – {tgl(a.periode.end)}
          </span>
        ))}
        {data.anggota.length === 0 && (
          <span className="text-[12px] text-km-ink-muted">Tidak ada yayasan anggota pada periode ini.</span>
        )}
      </div>

      {data.peringatan.map((p) => (
        <div
          key={p.jenis}
          className="border-b border-km-border bg-km-amber-soft px-4 py-3 text-[12px] text-km-amber-ink"
          data-testid="grup-peringatan"
        >
          <p className="font-semibold">⚠ {p.pesan}</p>
          <p className="mt-0.5">
            Selisih Rp {rp(num(p.selisih))}. Yang dieliminasi hanya bagian yang cocok; periksa jurnal berikut:
          </p>
          <ul className="mt-1.5 list-disc pl-5">
            {p.transaksi.map((t, i) => (
              <li key={`${t.journal_entry_id}-${t.akun}-${i}`}>
                {t.code} · {t.tanggal} · {kodeYayasan.get(t.entity_id) ?? ""} · akun {t.akun} ·{" "}
                {num(t.debit) > 0 ? `Dr ${rp(num(t.debit))}` : `Kr ${rp(num(t.kredit))}`}
                {t.deskripsi ? ` — ${t.deskripsi}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]" data-testid="grup-tabel">
          <thead>
            <tr className="border-b border-km-border bg-km-panel-soft text-[11px] uppercase tracking-wide text-km-ink-muted">
              <th className="px-4 py-2 text-left font-semibold">Uraian</th>
              {perYayasan &&
                data.anggota.map((a) => (
                  <th key={a.yayasan.id} className="px-3 py-2 text-right font-semibold" data-testid="grup-kolom-yayasan">
                    {a.yayasan.code}
                  </th>
                ))}
              <th className="px-3 py-2 text-right font-semibold">Eliminasi</th>
              <th className="px-4 py-2 text-right font-semibold">Total Grup</th>
            </tr>
          </thead>
          <tbody>
            {BARIS_GRUP.map((b) => (
              <FragmentBaris key={b.label} bagian={b.bagian} kolom={(perYayasan ? data.anggota.length : 0) + 3}>
                <tr
                  className={`border-b border-km-border ${b.tebal ? "font-semibold" : ""}`}
                  data-testid={`grup-baris-${b.label}`}
                >
                  <td className="px-4 py-1.5">{b.label}</td>
                  {perYayasan &&
                    data.anggota.map((a) => (
                      <td key={a.yayasan.id} className="px-3 py-1.5 text-right tabular-nums">
                        {rp(num(b.ambil(a.entry) ?? 0))}
                      </td>
                    ))}
                  <td className="px-3 py-1.5 text-right tabular-nums text-km-ink-soft" data-testid="grup-eliminasi">
                    {rp(num(b.ambil(data.eliminasi) ?? 0))}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums" data-testid="grup-total">
                    {data.total ? rp(num(b.ambil(data.total) ?? 0)) : "–"}
                  </td>
                </tr>
              </FragmentBaris>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-km-ink-muted">
        Total Grup = jumlah kolom yayasan + kolom Eliminasi. Kolom tiap yayasan sama dengan Laporan Keuangan yayasan itu;
        eliminasi hanya berlaku di laporan grup (penyaluran 5400 ↔ penerimaan 4410/4420, piutang 1320 ↔ utang 2320).
      </p>
    </Card>
  );
}

function FragmentBaris({ bagian, kolom, children }: { bagian?: string; kolom: number; children: React.ReactNode }) {
  return (
    <>
      {bagian && (
        <tr className="bg-km-panel-soft">
          <td colSpan={kolom} className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-km-ink-soft">
            {bagian}
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
