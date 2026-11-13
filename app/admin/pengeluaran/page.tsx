"use client";

import { MasterTransaksiPage } from "@/components/MasterTransaksiPage";
import { LABEL_PENGELUARAN } from "@/lib/labelMaster";

/**
 * Master Pengeluaran (FV-29) — Kategori Biaya + Nama Pengeluaran.
 *
 * Isi layarnya ada di MasterTransaksiPage, yang dipakai bersama Master
 * Penerimaan (FV-45): bentuk masternya identik, yang berbeda hanya sebutan
 * dan wajib-tidaknya akun COA di tingkat Nama.
 */
export default function MasterPengeluaranPage() {
  return <MasterTransaksiPage label={LABEL_PENGELUARAN} />;
}
