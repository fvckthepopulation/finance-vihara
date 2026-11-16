import type { Row } from "exceljs";
import { api } from "./api";
import { num } from "./kasBank";
import type { KonsolidasiEntry, KonsolidasiPeriod } from "./konsolidasi";
import type { Isak35Mode, Money } from "./laporanKeuangan";

// ============================================================================
// Grup Konsolidasi (FV-66) — beberapa yayasan dilaporkan bersama tanpa
// mengubah master; transaksi antar anggota dieliminasi.
//   GET  /api/konsolidasi-groups            (pilihan laporan, sesuai akses)
//   GET  /api/konsolidasi-groups?master=1   (master, semua grup)
//   POST/PUT/DELETE /api/konsolidasi-groups (izin entities.manage)
//   GET  /api/laporan/konsolidasi-grup?group_id&mode&year&month
// ============================================================================

export type GrupAnggota = {
  id?: number;
  entity_id: number;
  code?: string;
  nama?: string;
  start_date: string;
  end_date: string | null;
};

export type GrupKonsolidasi = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  members: GrupAnggota[];
  users: { id: number; name: string; email: string }[];
};

export type GrupInput = {
  name: string;
  description?: string | null;
  active?: boolean;
  members: { entity_id: number; start_date: string; end_date: string | null }[];
  user_ids?: number[];
};

export function listGrup(master = false): Promise<{ data: GrupKonsolidasi[] }> {
  return api(`/api/konsolidasi-groups${master ? "?master=1" : ""}`);
}

export function simpanGrup(input: GrupInput, id?: number): Promise<GrupKonsolidasi> {
  return api(id ? `/api/konsolidasi-groups/${id}` : "/api/konsolidasi-groups", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(input),
  });
}

export function hapusGrup(id: number): Promise<unknown> {
  return api(`/api/konsolidasi-groups/${id}`, { method: "DELETE" });
}

export type EntryGrup = KonsolidasiEntry & {
  posisi: KonsolidasiEntry["posisi"] & { aset_lainnya?: Money; rekonsiliasi_sementara?: Money };
};

export type PeringatanGrup = {
  jenis: "penyaluran" | "piutang_utang";
  pesan: string;
  selisih: Money;
  transaksi: {
    journal_entry_id: number;
    code: string;
    entity_id: number;
    tanggal: string;
    deskripsi: string | null;
    akun: string;
    debit: Money;
    kredit: Money;
  }[];
};

export type KonsolidasiGrupResponse = {
  period: KonsolidasiPeriod;
  grup: { id: number; nama: string };
  anggota: {
    yayasan: { id: number; code: string; nama: string };
    periode: { start: string; end: string };
    entry: EntryGrup;
  }[];
  eliminasi: EntryGrup;
  total: EntryGrup | null;
  peringatan: PeringatanGrup[];
};

export function getKonsolidasiGrup(params: {
  groupId: number;
  mode: Isak35Mode;
  year: number;
  month?: number;
}): Promise<KonsolidasiGrupResponse> {
  const sp = new URLSearchParams({
    group_id: String(params.groupId),
    mode: params.mode,
    year: String(params.year),
  });
  if (params.mode === "bulan" && params.month) sp.set("month", String(params.month));
  return api(`/api/laporan/konsolidasi-grup?${sp}`);
}

/** Baris tabel laporan grup: [label, pengambil angka, tebal?]. */
export type BarisGrup = { bagian?: string; label: string; ambil: (e: EntryGrup) => Money | undefined; tebal?: boolean };

export const BARIS_GRUP: BarisGrup[] = [
  { bagian: "PENGHASILAN KOMPREHENSIF", label: "Pendapatan — Tanpa Pembatasan", ambil: (e) => e.pendapatan.tp },
  { label: "Pendapatan — Dengan Pembatasan", ambil: (e) => e.pendapatan.dp },
  { label: "Total Pendapatan", ambil: (e) => e.pendapatan.total, tebal: true },
  { label: "Beban Program", ambil: (e) => e.beban.program },
  { label: "Beban Administrasi & Umum", ambil: (e) => e.beban.admin },
  { label: "Beban Fundraising", ambil: (e) => e.beban.fundraising },
  { label: "Total Beban", ambil: (e) => e.beban.total, tebal: true },
  { bagian: "PERUBAHAN ASET NETO", label: "Kenaikan — Tanpa Pembatasan", ambil: (e) => e.kenaikan.tp },
  { label: "Kenaikan — Dengan Pembatasan", ambil: (e) => e.kenaikan.dp },
  { label: "Kenaikan Aset Neto", ambil: (e) => e.kenaikan.total, tebal: true },
  { bagian: "POSISI KEUANGAN", label: "Kas dan Setara Kas", ambil: (e) => e.posisi.kas_setara },
  { label: "Piutang Payment Gateway", ambil: (e) => e.posisi.pg_clearing },
  { label: "Aset Lancar Lainnya", ambil: (e) => e.posisi.aset_lainnya },
  { label: "Total Aset", ambil: (e) => e.posisi.total_aset, tebal: true },
  { label: "Liabilitas", ambil: (e) => e.posisi.liabilitas },
  { label: "Aset Neto — Tanpa Pembatasan", ambil: (e) => e.posisi.aset_neto.tp },
  { label: "Aset Neto — Dengan Pembatasan", ambil: (e) => e.posisi.aset_neto.dp },
  { label: "Total Aset Neto", ambil: (e) => e.posisi.aset_neto.total, tebal: true },
  { bagian: "ARUS KAS", label: "Arus Kas Bersih", ambil: (e) => e.arus_kas_bersih, tebal: true },
];

/** Export Excel laporan grup: satu sheet tabel + sheet peringatan bila ada. */
export async function exportGrupExcel(data: KonsolidasiGrupResponse, periodeLabel: string): Promise<string> {
  const ExcelJS = await import("exceljs").then((m) => m.default ?? m);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Konsolidasi Grup");
  const kolom = [...data.anggota.map((a) => a.yayasan.code), "Eliminasi", "Total Grup"];
  ws.columns = [{ width: 40 }, ...kolom.map(() => ({ width: 18 }))];
  ws.addRow([`GRUP KONSOLIDASI — ${data.grup.nama.toUpperCase()}`]).font = { bold: true };
  ws.addRow([periodeLabel]);
  ws.addRow([]);
  ws.addRow(["Uraian", ...kolom]).font = { bold: true };
  const angka = (r: Row) => {
    for (let i = 2; i <= kolom.length + 1; i++) {
      const c = r.getCell(i);
      c.numFmt = "#,##0;(#,##0);-";
      c.alignment = { horizontal: "right" };
    }
  };
  for (const b of BARIS_GRUP) {
    if (b.bagian) ws.addRow([b.bagian]).font = { bold: true };
    const r = ws.addRow([
      `  ${b.label}`,
      ...data.anggota.map((a) => num(b.ambil(a.entry) ?? 0)),
      num(b.ambil(data.eliminasi) ?? 0),
      data.total ? num(b.ambil(data.total) ?? 0) : 0,
    ]);
    if (b.tebal) r.font = { bold: true };
    angka(r);
  }
  ws.addRow([]);
  ws.addRow(["Total Grup = jumlah kolom yayasan + kolom Eliminasi (eliminasi bernilai negatif)."]);

  if (data.peringatan.length > 0) {
    const wp = wb.addWorksheet("Peringatan");
    wp.columns = [{ width: 12 }, { width: 12 }, { width: 10 }, { width: 40 }, { width: 8 }, { width: 16 }, { width: 16 }];
    for (const p of data.peringatan) {
      wp.addRow([p.pesan]).font = { bold: true };
      wp.addRow(["Selisih", num(p.selisih)]);
      wp.addRow(["No. JE", "Tanggal", "Yayasan", "Deskripsi", "Akun", "Debit", "Kredit"]).font = { bold: true };
      const kode = new Map(data.anggota.map((a) => [a.yayasan.id, a.yayasan.code]));
      for (const t of p.transaksi) {
        wp.addRow([t.code, t.tanggal, kode.get(t.entity_id) ?? "", t.deskripsi ?? "", t.akun, num(t.debit), num(t.kredit)]);
      }
      wp.addRow([]);
    }
  }

  const filename = `KonsolidasiGrup_${data.grup.nama.replace(/[^A-Za-z0-9]+/g, "_")}_${data.period.start}_sd_${data.period.end}.xlsx`;
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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
