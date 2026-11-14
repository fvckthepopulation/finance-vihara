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
  punyaPembatasan: false,
  akunPerNama: true,
};

export const LABEL_PENERIMAAN: LabelMaster = {
  jenis: "penerimaan",
  judul: "Master Penerimaan",
  subjudul: "Kategori Dana dan Nama Penerimaan",
  kategori: "Kategori Dana",
  nama: "Nama Penerimaan",
  namaKecil: "nama penerimaan",
  akun: "Akun Pendapatan (COA)",
  // Akun penerimaan TIDAK dipilih per nama (FV-49): diturunkan dari
  // pembatasan kategorinya × kanal penerimaan, dan itulah yang ditampilkan.
  akunHint:
    "Diwarisi dari Kategori Dana — ditentukan jenis pembatasannya dan kanal " +
    "penerimaannya (KalyanaMitta / transfer / tunai).",
  akunWajib: false,
  bawaanHint:
    "Hanya untuk kategori Belum Teridentifikasi (suspense), mis. 2310. " +
    "Kategori Tanpa/Dengan Pembatasan memakai aturan kanal × pembatasan.",
  contohKode: "dana_pendidikan",
  punyaPembatasan: true,
  akunPerNama: false,
};
