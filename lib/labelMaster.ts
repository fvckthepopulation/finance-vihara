import type { LabelMaster } from "@/components/MasterTransaksiPage";

// ============================================================================
// Sebutan dua layar master yang bentuknya kembar (FV-29 & FV-45).
//
// Di satu berkas supaya perbedaannya bisa dibaca sekali lihat — dan supaya
// jelas bahwa yang berbeda cuma sebutan dan satu aturan: wajib atau tidaknya
// akun COA di tingkat Nama.
// ============================================================================

export const LABEL_PENGELUARAN: LabelMaster = {
  jenis: "pengeluaran",
  judul: "Master Pengeluaran",
  subjudul: "Kategori Biaya dan Nama Pengeluaran",
  kategori: "Kategori Biaya",
  nama: "Nama Pengeluaran",
  namaKecil: "nama pengeluaran",
  akun: "Akun Biaya (COA)",
  akunHint: "Akun inilah yang jadi akun debit saat pengeluaran ini dijurnal.",
  akunWajib: true,
  bawaanHint: "Dipakai hanya kalau Nama Pengeluaran belum punya akunnya sendiri.",
  contohKode: "biaya_kebersihan",
};

export const LABEL_PENERIMAAN: LabelMaster = {
  jenis: "penerimaan",
  judul: "Master Penerimaan",
  subjudul: "Kategori Dana dan Nama Penerimaan",
  kategori: "Kategori Dana",
  nama: "Nama Penerimaan",
  namaKecil: "nama penerimaan",
  akun: "Akun Pendapatan (COA)",
  // Sengaja panjang: ini keputusan akuntansi, bukan sekadar isian. Mengisinya
  // memakukan akun pendapatan satu nama dan melepasnya dari pembedaan kanal
  // yang dipakai laporan ISAK 35.
  akunHint:
    "Kosongkan untuk mengikuti aturan bawaan: akun pendapatan ditentukan kanal " +
    "penerimaan (KalyanaMitta / transfer / tunai) dan pembatasan dananya. Isi " +
    "hanya bila nama ini memang selalu masuk ke satu akun tertentu.",
  akunWajib: false,
  bawaanHint:
    "Akun pendapatan bawaan kategori. Kosong = ikuti aturan kanal × pembatasan (ISAK 35).",
  contohKode: "dana_pendidikan",
};
