import type { Worksheet } from "exceljs";
import { num } from "./kasBank";
import { TransactionRow } from "./transactions";

// ============================================================================
// Export Excel Laporan Penerimaan Dana (/cetak) — 2 sheet ala mockup
// exportCetakXLSX(): "Ringkasan" (total per kategori + rincian nama) dan
// "Detail Transaksi" (semua baris + TOTAL MASUK/KELUAR).
// ExcelJS dimuat via dynamic import supaya bundle halaman tetap ramping.
// ============================================================================

const FMT = "#,##0";

export type CetakGroup = {
  label: string;
  total: number;
  /** Rincian per nama transaksi, terurut nominal desc. */
  items: { name: string; amount: number }[];
};

/** Nama transaksi untuk agregasi — API bisa mengirim name null (fallback deskripsi/kode). */
export function txName(t: TransactionRow): string {
  return t.name || t.description || t.code || "(tanpa nama)";
}

/** Kelompokkan transaksi per kategori → per nama (agregat), urut nominal desc. */
export function groupCetak(rows: TransactionRow[]): CetakGroup[] {
  const byCat = new Map<string, { total: number; items: Map<string, number> }>();
  for (const t of rows) {
    const label = t.category_label || t.category || "Lainnya";
    let g = byCat.get(label);
    if (!g) {
      g = { total: 0, items: new Map() };
      byCat.set(label, g);
    }
    const amount = num(t.amount);
    const name = txName(t);
    g.total += amount;
    g.items.set(name, (g.items.get(name) ?? 0) + amount);
  }
  return [...byCat.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([label, g]) => ({
      label,
      total: g.total,
      items: [...g.items.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({ name, amount })),
    }));
}

function numCell(ws: Worksheet, rowIdx: number, colIdx: number) {
  const cell = ws.getRow(rowIdx).getCell(colIdx);
  cell.numFmt = FMT;
  cell.alignment = { horizontal: "right" };
}

/** Bangun workbook 2 sheet lalu unduh. Return nama file .xlsx. */
export async function exportCetakExcel(opts: {
  rows: TransactionRow[];
  org: string;
  orgCode: string;
  dari: string; // YYYY-MM-DD
  sampai: string; // YYYY-MM-DD
}): Promise<string> {
  const { rows, org, orgCode, dari, sampai } = opts;
  const masuk = rows.filter((t) => t.tipe === "Penerimaan");
  const keluar = rows.filter((t) => t.tipe === "Pengeluaran");
  const totalMasuk = masuk.reduce((a, t) => a + num(t.amount), 0);
  const totalKeluar = keluar.reduce((a, t) => a + num(t.amount), 0);

  const ExcelJS = await import("exceljs").then((m) => m.default ?? m);
  const wb = new ExcelJS.Workbook();

  // ── Sheet 1: Ringkasan ──
  const ws1 = wb.addWorksheet("Ringkasan");
  ws1.columns = [{ width: 40 }, { width: 18 }];
  const addRow = (label: string, value?: number, bold = false) => {
    const r = ws1.addRow(value === undefined ? [label] : [label, value]);
    if (bold) r.font = { bold: true };
    if (value !== undefined) numCell(ws1, r.number, 2);
    return r;
  };
  addRow(`LAPORAN KEUANGAN — ${org.toUpperCase()}`, undefined, true);
  addRow(`Periode: ${dari} s/d ${sampai}`, undefined, true);
  ws1.addRow([]);
  addRow("PENERIMAAN", undefined, true);
  ws1.addRow(["Uraian", "Jumlah (Rp)"]).font = { bold: true };
  for (const g of groupCetak(masuk)) {
    addRow(`  ${g.label}`, g.total, true);
    for (const it of g.items) addRow(`    ${it.name}`, it.amount);
  }
  addRow("TOTAL PENERIMAAN", totalMasuk, true);
  ws1.addRow([]);
  addRow("PENGELUARAN", undefined, true);
  for (const g of groupCetak(keluar)) {
    addRow(`  ${g.label}`, g.total, true);
    for (const it of g.items) addRow(`    ${it.name}`, it.amount);
  }
  addRow("TOTAL PENGELUARAN", totalKeluar, true);
  ws1.addRow([]);
  addRow("SURPLUS / (DEFISIT)", totalMasuk - totalKeluar, true);
  ws1.addRow([]);
  ws1.addRow([
    "Dicetak:",
    new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
  ]);

  // ── Sheet 2: Detail Transaksi ──
  const ws2 = wb.addWorksheet("Detail Transaksi");
  const cols = [
    { header: "Tanggal", width: 12 },
    { header: "Tipe", width: 12 },
    { header: "Kode", width: 16 },
    { header: "Nama", width: 30 },
    { header: "Kategori", width: 20 },
    { header: "Metode", width: 14 },
    { header: "Sumber", width: 10 },
    { header: "Donatur / Penerima", width: 26 },
    { header: "Jumlah (Rp)", width: 16 },
  ];
  ws2.columns = cols.map((c) => ({ width: c.width }));
  ws2.addRow(cols.map((c) => c.header)).font = { bold: true };
  [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) => {
      const r = ws2.addRow([
        t.date.slice(0, 10),
        t.tipe,
        t.code,
        t.name ?? "",
        t.category_label || t.category,
        t.method || "",
        t.source === "km" ? "KM" : "Manual",
        t.counterparty ?? "",
        num(t.amount),
      ]);
      numCell(ws2, r.number, 9);
    });
  ws2.addRow([]);
  const rm = ws2.addRow(["", "", "", "", "", "", "", "TOTAL MASUK", totalMasuk]);
  rm.font = { bold: true };
  numCell(ws2, rm.number, 9);
  const rk = ws2.addRow(["", "", "", "", "", "", "", "TOTAL KELUAR", totalKeluar]);
  rk.font = { bold: true };
  numCell(ws2, rk.number, 9);

  const filename = `Laporan_${orgCode}_${dari}_sd_${sampai}.xlsx`;
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
