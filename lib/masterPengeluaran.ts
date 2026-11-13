// ============================================================================
// Master Pengeluaran (FV-29) — Kategori Biaya (induk) + Nama Pengeluaran.
//
// Isi aturannya ada di lib/masterTransaksi.ts, yang dipakai bersama dengan
// Master Penerimaan (FV-45). Berkas ini hanya mengikat jenisnya, supaya
// pemanggil lama tidak perlu ikut berubah.
//
// `code` kategori adalah kunci yang disimpan kolom pembayaran.category, jadi
// tidak bisa diubah setelah dibuat: mengubahnya akan memutus transaksi lama.
// Akun COA di tingkat Nama Pengeluaran-lah yang dipakai jurnal sebagai akun
// debit; akun kategori hanya cadangan.
// ============================================================================

import {
  AkunMaster,
  FilterDaftar,
  KategoriInput,
  KategoriTransaksi,
  NamaInput,
  NamaTransaksi,
  createKategori,
  createNama,
  deleteKategori,
  deleteNama,
  listAkunMaster,
  listKategori,
  listNama,
  updateKategori,
  updateNama,
} from "./masterTransaksi";

export type { Halaman } from "./masterTransaksi";

export type KategoriBiaya = KategoriTransaksi;
export type NamaPengeluaran = NamaTransaksi;
export type AkunBeban = AkunMaster;
export type NamaPengeluaranInput = NamaInput;

export const listKategoriBiaya = (p: FilterDaftar = {}) => listKategori("pengeluaran", p);

export const createKategoriBiaya = (payload: KategoriInput) =>
  createKategori("pengeluaran", payload);

export const updateKategoriBiaya = (
  id: number,
  payload: Parameters<typeof updateKategori>[2],
) => updateKategori("pengeluaran", id, payload);

export const deleteKategoriBiaya = (id: number) => deleteKategori("pengeluaran", id);

export const listNamaPengeluaran = (p: FilterDaftar & { category?: string } = {}) =>
  listNama("pengeluaran", p);

export const createNamaPengeluaran = (payload: NamaInput) =>
  createNama("pengeluaran", payload);

export const updateNamaPengeluaran = (
  id: number,
  payload: Parameters<typeof updateNama>[2],
) => updateNama("pengeluaran", id, payload);

export const deleteNamaPengeluaran = (id: number) => deleteNama("pengeluaran", id);

export const listAkunBeban = (category?: string) => listAkunMaster("pengeluaran", category);
