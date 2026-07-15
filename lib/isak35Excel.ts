import type { Worksheet } from "exceljs";
import { num } from "./kasBank";
import { Isak35Response } from "./laporanKeuangan";
import { listTransactions, TransactionRow } from "./transactions";

// ============================================================================
// Export Excel Laporan ISAK 35 — 6 sheet ala mockup exportLaporanXLSX():
//   1. Posisi Keuangan          4. Arus Kas
//   2. Penghasilan Komprehensif 5. Detail Penerimaan
//   3. Perubahan Aset Neto      6. Detail Pengeluaran
// ExcelJS dimuat via dynamic import supaya bundle halaman tetap ramping.
// ============================================================================

const FMT = "#,##0";

type Cell = string | number | null;

function addRows(ws: Worksheet, rows: Cell[][], boldLabels: RegExp) {
  rows.forEach((cells) => {
    const row = ws.addRow(cells.map((c) => (c === null ? "" : c)));
    const first = cells[0];
    if (typeof first === "string" && boldLabels.test(first)) row.font = { bold: true };
    cells.forEach((c, i) => {
      if (typeof c === "number") {
        const cell = row.getCell(i + 1);
        cell.numFmt = FMT;
        cell.alignment = { horizontal: "right" };
      }
    });
  });
  // Baris judul (org + nama laporan) selalu bold.
  ws.getRow(1).font = { bold: true };
  ws.getRow(2).font = { bold: true };
}

const BOLD_RE = /^(TOTAL|ARUS KAS BERSIH|KENAIKAN|KAS DAN SETARA|ASET NETO AKHIR|ASET$|LIABILITAS$|ASET NETO$|PENDAPATAN DAN DUKUNGAN$|BEBAN$|ARUS KAS DARI|REKONSILIASI$)/;

function detailColumns(tipe: "Penerimaan" | "Pengeluaran") {
  return [
    { header: "Tanggal", width: 12 },
    { header: "Kode", width: 16 },
    { header: `Nama ${tipe}`, width: 30 },
    { header: "Kategori", width: 20 },
    { header: "Metode", width: 16 },
    { header: "Sumber", width: 10 },
    { header: tipe === "Penerimaan" ? "Donatur / Sumber" : "Dibayarkan ke", width: 26 },
    { header: "Jumlah (Rp)", width: 16 },
  ];
}

function addDetailSheet(ws: Worksheet, tipe: "Penerimaan" | "Pengeluaran", rows: TransactionRow[]) {
  const cols = detailColumns(tipe);
  ws.columns = cols.map((c) => ({ width: c.width }));
  const header = ws.addRow(cols.map((c) => c.header));
  header.font = { bold: true };
  let total = 0;
  [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) => {
      total += num(t.amount);
      const row = ws.addRow([
        t.date.slice(0, 10),
        t.code,
        t.name,
        t.category_label || t.category,
        t.method || "",
        t.source === "km" ? "KM" : "Manual",
        t.counterparty ?? "",
        num(t.amount),
      ]);
      const cell = row.getCell(8);
      cell.numFmt = FMT;
      cell.alignment = { horizontal: "right" };
    });
  ws.addRow([]);
  const totalRow = ws.addRow([`TOTAL ${tipe.toUpperCase()}`, "", "", "", "", "", "", total]);
  totalRow.font = { bold: true };
  const tc = totalRow.getCell(8);
  tc.numFmt = FMT;
  tc.alignment = { horizontal: "right" };
}

export type ExportIsak35Options = {
  data: Isak35Response;
  /** Nama organisasi pada judul laporan (nama vihara / yayasan). */
  org: string;
  /** Kode singkat untuk nama file — kode vihara atau "YDI". */
  orgCode: string;
  /** Label periode, mis. "YTD 2025" / "November 2025". */
  periodeLabel: string;
  vihara_id: number | null;
};

/** Bangun workbook 6 sheet lalu unduh. Return nama file .xlsx. */
export async function exportIsak35Excel(opts: ExportIsak35Options): Promise<string> {
  const { data, org, orgCode, periodeLabel } = opts;
  const { posisi, penghasilan, perubahan, arus_kas: ak, period } = data;

  // Detail transaksi periode (sheet 5 & 6) — fetch paralel dengan load ExcelJS.
  // API membatasi per_page maks 200 → ambil semua halaman (cap 25 hlm/5000 baris).
  const listParams = {
    from: period.start,
    to: period.end,
    per_page: 200,
    vihara_id: opts.vihara_id,
  };
  async function fetchAll(tipe: "Penerimaan" | "Pengeluaran"): Promise<TransactionRow[]> {
    const all: TransactionRow[] = [];
    let page = 1;
    for (;;) {
      const res = await listTransactions({ ...listParams, tipe, page });
      all.push(...res.data);
      if (page >= res.last_page || page >= 25) break;
      page += 1;
    }
    return all;
  }
  const [ExcelJS, masuk, keluar] = await Promise.all([
    import("exceljs").then((m) => m.default ?? m),
    fetchAll("Penerimaan"),
    fetchAll("Pengeluaran"),
  ]);

  const wb = new ExcelJS.Workbook();
  const TODAY = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

  // ── Sheet 1: Posisi Keuangan ──
  const ws1 = wb.addWorksheet("1. Posisi Keuangan");
  ws1.columns = [{ width: 48 }, { width: 18 }];
  const s1: Cell[][] = [
    [org], ["LAPORAN POSISI KEUANGAN"], [`Per ${periodeLabel}`], [`Disusun: ${TODAY}`], [],
    ["ASET"],
    ["Kas dan Setara Kas"],
    ...posisi.kas_setara.rows.map((r): Cell[] => [`  ${r.code} · ${r.name}`, num(r.balance)]),
    ["TOTAL KAS DAN SETARA KAS", num(posisi.kas_setara.total)],
    ["  1160 · Payment Gateway Clearing (KM belum settle)", num(posisi.pg_clearing)],
    ["TOTAL ASET", num(posisi.total_aset)], [],
    ["LIABILITAS"],
    ...posisi.liabilitas.rows.map((r): Cell[] => [`  ${r.code} · ${r.name}`, num(r.balance)]),
    ["TOTAL LIABILITAS", num(posisi.liabilitas.total)], [],
    ["ASET NETO"],
    ["  3100 · Aset Neto Tanpa Pembatasan", num(posisi.aset_neto.tp)],
    ["  3200 · Aset Neto Dengan Pembatasan", num(posisi.aset_neto.dp)],
    ["TOTAL ASET NETO", num(posisi.aset_neto.total)],
    ["TOTAL LIABILITAS DAN ASET NETO", num(posisi.liabilitas.total) + num(posisi.aset_neto.total)], [],
    ["CHECK: Total Aset = Total Liabilitas + Aset Neto", posisi.balance_ok ? "BALANCE ✓" : `Selisih ${num(posisi.selisih).toLocaleString("id-ID")}`],
  ];
  addRows(ws1, s1, BOLD_RE);

  // ── Sheet 2: Penghasilan Komprehensif ──
  const ws2 = wb.addWorksheet("2. Penghasilan Komprehensif");
  ws2.columns = [{ width: 52 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const p = penghasilan;
  const s2: Cell[][] = [
    [org], ["LAPORAN PENGHASILAN KOMPREHENSIF"], [`Untuk Periode: ${periodeLabel}`], [`Disusun: ${TODAY}`], [],
    ["Uraian", "Tanpa Pembatasan", "Dengan Pembatasan", "Total"],
    ["PENDAPATAN DAN DUKUNGAN"],
    ...p.pendapatan.rows.map((r): Cell[] => [
      `  ${r.code} · ${r.label}`,
      r.tp === null ? "" : num(r.tp),
      r.dp === null ? "" : num(r.dp),
      num(r.total),
    ]),
    ["TOTAL PENDAPATAN DAN DUKUNGAN", num(p.pendapatan.tp), num(p.pendapatan.dp), num(p.pendapatan.total)], [],
    ["BEBAN"],
    ...p.beban.rows.map((r): Cell[] => [`  ${r.label}`, num(r.total), "", num(r.total)]),
    ["TOTAL BEBAN", num(p.beban.total), "", num(p.beban.total)], [],
    ["KENAIKAN / (PENURUNAN) ASET NETO", num(p.kenaikan.tp), num(p.kenaikan.dp), num(p.kenaikan.total)],
    ["Catatan: beban dialokasikan seluruhnya ke kolom Tanpa Pembatasan sesuai praktik ISAK 35."],
  ];
  addRows(ws2, s2, BOLD_RE);

  // ── Sheet 3: Perubahan Aset Neto ──
  const ws3 = wb.addWorksheet("3. Perubahan Aset Neto");
  ws3.columns = [{ width: 46 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const negAbs = (v: string | number) => -Math.abs(num(v));
  const s3: Cell[][] = [
    [org], ["LAPORAN PERUBAHAN ASET NETO"], [`Untuk Periode: ${periodeLabel}`], [],
    ["Uraian", "Tanpa Pembatasan", "Dengan Pembatasan", "Total"],
    ["Aset neto awal periode", num(perubahan.awal.tp), num(perubahan.awal.dp), num(perubahan.awal.total)],
    ["Pendapatan periode berjalan", num(perubahan.pendapatan.tp), num(perubahan.pendapatan.dp), num(perubahan.pendapatan.total)],
    ["Beban periode berjalan", negAbs(perubahan.beban.tp), negAbs(perubahan.beban.dp), negAbs(perubahan.beban.total)],
    ["KENAIKAN / (PENURUNAN) ASET NETO", num(perubahan.kenaikan.tp), num(perubahan.kenaikan.dp), num(perubahan.kenaikan.total)],
    ["ASET NETO AKHIR PERIODE", num(perubahan.akhir.tp), num(perubahan.akhir.dp), num(perubahan.akhir.total)],
  ];
  addRows(ws3, s3, BOLD_RE);

  // ── Sheet 4: Arus Kas ──
  const ws4 = wb.addWorksheet("4. Arus Kas");
  ws4.columns = [{ width: 52 }, { width: 18 }];
  const kenaikanKas = num(ak.operasi.total) + num(ak.investasi.total) + num(ak.pendanaan.total);
  const s4: Cell[][] = [
    [org], ["LAPORAN ARUS KAS (Metode Langsung)"], [`Untuk Periode: ${periodeLabel}`], [],
    ["ARUS KAS DARI AKTIVITAS OPERASI"],
    ...ak.operasi.rows.map((r): Cell[] => [`  ${r.label}`, num(r.amount)]),
    ["ARUS KAS BERSIH DARI AKTIVITAS OPERASI", num(ak.operasi.total)], [],
    ["ARUS KAS DARI AKTIVITAS INVESTASI"],
    ...ak.investasi.rows.map((r): Cell[] => [`  ${r.label}`, num(r.amount)]),
    ["ARUS KAS BERSIH DARI AKTIVITAS INVESTASI", num(ak.investasi.total)], [],
    ["ARUS KAS DARI AKTIVITAS PENDANAAN"],
    ...ak.pendanaan.rows.map((r): Cell[] => [`  ${r.label}`, num(r.amount)]),
    ["ARUS KAS BERSIH DARI AKTIVITAS PENDANAAN", num(ak.pendanaan.total)], [],
    ["REKONSILIASI"],
    ["KENAIKAN / (PENURUNAN) KAS DAN SETARA KAS", kenaikanKas],
    ["Kas dan setara kas awal periode", num(ak.kas_awal)],
    ["KAS DAN SETARA KAS AKHIR PERIODE", num(ak.kas_akhir)],
    ["CHECK: Arus kas bersih = saldo kas aktual", ak.check_kas_akhir_ok ? "✓ Cocok" : "Ada selisih"],
  ];
  addRows(ws4, s4, BOLD_RE);

  // ── Sheet 5 & 6: Detail transaksi ──
  addDetailSheet(wb.addWorksheet("5. Detail Penerimaan"), "Penerimaan", masuk);
  addDetailSheet(wb.addWorksheet("6. Detail Pengeluaran"), "Pengeluaran", keluar);

  const filename = `LaporanISAK35_${orgCode}_${periodeLabel.replace(/\s+/g, "_")}.xlsx`;
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return filename;
}
