import type { Worksheet } from "exceljs";
import { num } from "./kasBank";
import { KonsolidasiResponse } from "./konsolidasi";
import { listTransactions, TransactionRow } from "./transactions";

// ============================================================================
// Export Excel Laporan Konsolidasi Yayasan — ala mockup exportKonsolidasi():
//   1. Posisi Keuangan            4. Arus Kas
//   2. Penghasilan Komprehensif   5. Perbandingan Vihara
//   3. Perubahan Aset Neto        6..N. Detail transaksi per vihara (6. VVG, …)
// ExcelJS dimuat via dynamic import supaya bundle halaman tetap ramping.
// ============================================================================

const FMT = "#,##0";

type Cell = string | number | null;

const BOLD_RE =
  /^(TOTAL|SUBTOTAL|ARUS KAS BERSIH|KENAIKAN|KAS DAN SETARA|ASET NETO AKHIR|ASET$|LIABILITAS$|ASET NETO$|PENDAPATAN DAN DUKUNGAN|BEBAN( —|$)|ARUS KAS DARI|CHECK)/;

function addRows(ws: Worksheet, rows: Cell[][]) {
  rows.forEach((cells) => {
    const row = ws.addRow(cells.map((c) => (c === null ? "" : c)));
    const first = cells[0];
    if (typeof first === "string" && BOLD_RE.test(first)) row.font = { bold: true };
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

// Detail transaksi satu vihara — semua halaman (per_page maks 200, cap 25 hlm).
async function fetchViharaTransactions(
  viharaId: number,
  from: string,
  to: string,
): Promise<TransactionRow[]> {
  const all: TransactionRow[] = [];
  let page = 1;
  for (;;) {
    const res = await listTransactions({ vihara_id: viharaId, from, to, per_page: 200, page });
    all.push(...res.data);
    if (page >= res.last_page || page >= 25) break;
    page += 1;
  }
  return all;
}

function addDetailSheet(ws: Worksheet, rows: TransactionRow[]) {
  const cols = [
    { header: "Tanggal", width: 12 },
    { header: "Tipe", width: 12 },
    { header: "Kode", width: 16 },
    { header: "Nama", width: 30 },
    { header: "Kategori", width: 20 },
    { header: "Jumlah (Rp)", width: 16 },
    { header: "Metode", width: 14 },
    { header: "Sumber", width: 10 },
    { header: "Donatur / Penerima", width: 26 },
  ];
  ws.columns = cols.map((c) => ({ width: c.width }));
  const header = ws.addRow(cols.map((c) => c.header));
  header.font = { bold: true };
  [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) => {
      const row = ws.addRow([
        t.date.slice(0, 10),
        t.tipe,
        t.code,
        t.name ?? "",
        t.category_label || t.category,
        num(t.amount),
        t.method || "",
        t.source === "km" ? "KM" : "Manual",
        t.counterparty ?? "",
      ]);
      const cell = row.getCell(6);
      cell.numFmt = FMT;
      cell.alignment = { horizontal: "right" };
    });
}

/** Bangun workbook konsolidasi (5 sheet laporan + detail per vihara) lalu unduh. */
export async function exportKonsolidasiExcel(opts: {
  data: KonsolidasiResponse;
  periodeLabel: string;
}): Promise<string> {
  const { data, periodeLabel } = opts;
  const org = data.yayasan.nama;
  const K = data.konsolidasi;
  const VD = data.per_vihara;
  const TODAY = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Detail per vihara di-fetch paralel dengan load ExcelJS.
  const [ExcelJS, details] = await Promise.all([
    import("exceljs").then((m) => m.default ?? m),
    Promise.all(
      VD.map((v) => fetchViharaTransactions(v.vihara.id, data.period.start, data.period.end)),
    ),
  ]);

  const wb = new ExcelJS.Workbook();

  // ── Sheet 1: Posisi Keuangan Konsolidasi ──
  const liabTotal = num(K.posisi.liabilitas);
  const anTotal = num(K.posisi.aset_neto.total);
  const selisih = Math.abs(num(K.posisi.selisih));
  const ws1 = wb.addWorksheet("1. Posisi Keuangan");
  ws1.columns = [{ width: 52 }, { width: 18 }];
  const s1: Cell[][] = [
    [org], ["LAPORAN POSISI KEUANGAN KONSOLIDASI"], [`Per ${periodeLabel}`], [`Disusun: ${TODAY}`], [],
    ["ASET"],
    ...VD.map((v): Cell[] => [`  ${v.vihara.name} — Kas & Bank`, num(v.posisi.kas_setara)]),
    ["SUBTOTAL KAS DAN SETARA KAS", num(K.posisi.kas_setara)],
    ...VD.map((v): Cell[] => [`  ${v.vihara.name} — Piutang PG`, num(v.posisi.pg_clearing)]),
    ["SUBTOTAL PIUTANG PG (1160)", num(K.posisi.pg_clearing)],
    ["TOTAL ASET", num(K.posisi.total_aset)], [],
    ["LIABILITAS"],
    ...VD.filter((v) => num(v.posisi.liabilitas) !== 0).map((v): Cell[] => [
      `  ${v.vihara.name}`,
      num(v.posisi.liabilitas),
    ]),
    ["TOTAL LIABILITAS", liabTotal], [],
    ["ASET NETO"],
    ["  3100 · Aset Neto Tanpa Pembatasan", num(K.posisi.aset_neto.tp)],
    ["  3200 · Aset Neto Dengan Pembatasan", num(K.posisi.aset_neto.dp)],
    ["TOTAL ASET NETO", anTotal],
    ["TOTAL LIABILITAS DAN ASET NETO", liabTotal + anTotal], [],
    ["CHECK Balance", K.posisi.balance_ok ? "✓ Balance" : `Selisih = ${selisih.toLocaleString("id-ID")}`],
  ];
  addRows(ws1, s1);

  // ── Sheet 2: Penghasilan Komprehensif Konsolidasi ──
  const ws2 = wb.addWorksheet("2. Penghasilan Komprehensif");
  ws2.columns = [{ width: 46 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const s2: Cell[][] = [
    [org], ["LAPORAN PENGHASILAN KOMPREHENSIF KONSOLIDASI"], [`Untuk Periode: ${periodeLabel}`], [],
    ["Uraian", "Tanpa Pembatasan", "Dengan Pembatasan", "Total"],
    ["PENDAPATAN DAN DUKUNGAN — PER VIHARA"],
    ...VD.map((v): Cell[] => [
      `  ${v.vihara.name}`,
      num(v.pendapatan.tp),
      num(v.pendapatan.dp),
      num(v.pendapatan.total),
    ]),
    ["TOTAL PENDAPATAN DAN DUKUNGAN", num(K.pendapatan.tp), num(K.pendapatan.dp), num(K.pendapatan.total)], [],
    ["BEBAN — PER VIHARA"],
    ...VD.filter((v) => num(v.beban.total) > 0).map((v): Cell[] => [
      `  ${v.vihara.name}`,
      num(v.beban.total),
      "",
      num(v.beban.total),
    ]),
    ["TOTAL BEBAN", num(K.beban.total), "", num(K.beban.total)], [],
    ["KENAIKAN / (PENURUNAN) ASET NETO"],
    ...VD.map((v): Cell[] => [
      `  ${v.vihara.name}`,
      num(v.kenaikan.tp),
      num(v.kenaikan.dp),
      num(v.kenaikan.total),
    ]),
    ["TOTAL KENAIKAN ASET NETO", num(K.kenaikan.tp), num(K.kenaikan.dp), num(K.kenaikan.total)],
  ];
  addRows(ws2, s2);

  // ── Sheet 3: Perubahan Aset Neto ── (awal = aset neto akhir − kenaikan)
  const awal = {
    tp: num(K.posisi.aset_neto.tp) - num(K.kenaikan.tp),
    dp: num(K.posisi.aset_neto.dp) - num(K.kenaikan.dp),
    total: num(K.posisi.aset_neto.total) - num(K.kenaikan.total),
  };
  const ws3 = wb.addWorksheet("3. Perubahan Aset Neto");
  ws3.columns = [{ width: 46 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const s3: Cell[][] = [
    [org], ["LAPORAN PERUBAHAN ASET NETO KONSOLIDASI"], [`Untuk Periode: ${periodeLabel}`], [],
    ["Uraian", "Tanpa Pembatasan", "Dengan Pembatasan", "Total"],
    ["Aset neto awal periode", awal.tp, awal.dp, awal.total],
    ["Pendapatan periode berjalan", num(K.pendapatan.tp), num(K.pendapatan.dp), num(K.pendapatan.total)],
    ["Beban periode berjalan", -Math.abs(num(K.beban.total)), 0, -Math.abs(num(K.beban.total))],
    ["KENAIKAN / (PENURUNAN) ASET NETO", num(K.kenaikan.tp), num(K.kenaikan.dp), num(K.kenaikan.total)],
    ["ASET NETO AKHIR PERIODE", num(K.posisi.aset_neto.tp), num(K.posisi.aset_neto.dp), num(K.posisi.aset_neto.total)],
  ];
  addRows(ws3, s3);

  // ── Sheet 4: Arus Kas ──
  const arusBersih = num(K.arus_kas_bersih);
  const kasAkhir = num(K.posisi.kas_setara);
  const ws4 = wb.addWorksheet("4. Arus Kas");
  ws4.columns = [{ width: 52 }, { width: 18 }];
  const s4: Cell[][] = [
    [org], ["LAPORAN ARUS KAS KONSOLIDASI"], [`Untuk Periode: ${periodeLabel}`], [],
    ["ARUS KAS DARI AKTIVITAS OPERASI"],
    ...VD.map((v): Cell[] => [`  ${v.vihara.name}`, num(v.arus_kas_bersih)]),
    ["ARUS KAS BERSIH DARI AKTIVITAS OPERASI", arusBersih],
    ["Arus Kas Investasi", 0],
    ["Arus Kas Pendanaan", 0],
    ["KENAIKAN / (PENURUNAN) KAS", arusBersih],
    ["Kas dan Setara Kas Awal Periode", kasAkhir - arusBersih],
    ["KAS DAN SETARA KAS AKHIR PERIODE", kasAkhir],
  ];
  addRows(ws4, s4);

  // ── Sheet 5: Perbandingan Vihara ──
  const ws5 = wb.addWorksheet("5. Perbandingan Vihara");
  ws5.columns = [{ width: 35 }, { width: 12 }, ...Array(8).fill({ width: 16 })];
  const s5: Cell[][] = [
    [org], ["PERBANDINGAN KEUANGAN ANTAR VIHARA"], [`Periode: ${periodeLabel}`], [],
    ["Vihara", "Kota", "Pendapatan TP", "Pendapatan DP", "Total Pendapatan", "Total Beban", "Kenaikan Aset Neto", "Kas & Bank", "Piutang PG", "Total Aset"],
    ...VD.map((v): Cell[] => [
      v.vihara.name,
      v.vihara.kota ?? "",
      num(v.pendapatan.tp),
      num(v.pendapatan.dp),
      num(v.pendapatan.total),
      num(v.beban.total),
      num(v.kenaikan.total),
      num(v.posisi.kas_setara),
      num(v.posisi.pg_clearing),
      num(v.posisi.total_aset),
    ]),
    [],
    ["TOTAL YAYASAN", "", num(K.pendapatan.tp), num(K.pendapatan.dp), num(K.pendapatan.total), num(K.beban.total), num(K.kenaikan.total), num(K.posisi.kas_setara), num(K.posisi.pg_clearing), num(K.posisi.total_aset)],
  ];
  addRows(ws5, s5);

  // ── Sheet 6..N: Detail per vihara ──
  VD.forEach((v, i) => {
    addDetailSheet(wb.addWorksheet(`${i + 6}. ${v.vihara.code}`), details[i]);
  });

  const filename = `KonsolidasiYayasan_${data.yayasan.singkatan}_${periodeLabel.replace(/\s+/g, "_")}.xlsx`;
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
