// ============================================================================
// Status transaksi — satu daftar untuk penerimaan DAN pengeluaran.
//
// Keduanya melewati siklus yang sama (FV-20/FV-21): draft → diajukan →
// disetujui/ditolak, plus pembatalan sesudah posted. Sebelumnya tiap modul
// punya daftarnya sendiri, dan yang penerimaan masih berisi tiga keadaan lama
// dengan label berbeda ("Diposting" vs "Disetujui") — layar yang sama jadi
// menyebut keadaan yang sama dengan dua nama.
// ============================================================================

export type StatusTransaksi =
  | "draft"
  | "submitted"
  | "posted"
  | "rejected"
  | "cancelled";

/** Label siklus draft → pengajuan → persetujuan, sesuai nama di laporan QC. */
export const STATUS_LABEL: Record<StatusTransaksi, string> = {
  draft: "Draft",
  submitted: "Menunggu Persetujuan",
  posted: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

export const STATUS_TONE: Record<
  StatusTransaksi,
  "neutral" | "info" | "warn" | "success" | "danger"
> = {
  draft: "neutral",
  submitted: "warn",
  posted: "success",
  rejected: "danger",
  cancelled: "danger",
};

/** Masih boleh diubah/dihapus/diajukan pembuatnya (FV-44). */
export const bisaDilanjutkan = (status: StatusTransaksi): boolean =>
  status === "draft" || status === "rejected";
