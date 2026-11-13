"use client";

import { MasterTransaksiPage } from "@/components/MasterTransaksiPage";
import { LABEL_PENERIMAAN } from "@/lib/labelMaster";

/**
 * Master Penerimaan (FV-45 poin 5) — Kategori Dana + Nama Penerimaan, dengan
 * akun pendapatan COA per nama.
 *
 * Layarnya sama dengan Master Pengeluaran; lihat MasterTransaksiPage. Satu
 * perbedaan yang disengaja: akun COA di sini OPSIONAL, karena akun pendapatan
 * penerimaan biasanya diturunkan dari kanal × pembatasan ISAK 35.
 */
export default function MasterPenerimaanPage() {
  return <MasterTransaksiPage label={LABEL_PENERIMAAN} />;
}
