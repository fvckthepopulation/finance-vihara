"use client";

import {
  BarisDetail,
  ModulTransaksi,
  TransaksiDetail,
} from "@/components/TransaksiDetail";
import {
  deletePembayaran,
  fetchPembayaranAttachment,
  getPembayaran,
  Pembayaran,
  postPembayaran,
  rejectPembayaran,
  submitPembayaran,
} from "@/lib/pembayaran";
import { danaCategoryLabel } from "@/components/DanaTag";
import { fmtTanggal } from "@/lib/tanggal";

// ============================================================================
// Detail satu pengeluaran. Isi dan perilakunya ada di TransaksiDetail, yang
// dipakai bersama dengan penerimaan (FV-45); di sini hanya baris isiannya —
// urutannya mengikuti form Input Pengeluaran — dan form ubah draftnya.
// ============================================================================

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const MODUL: ModulTransaksi<Pembayaran> = {
  sebutan: "pengeluaran",
  izinCatat: "pembayaran.create",
  izinSetujui: "pembayaran.approve",
  ambil: getPembayaran,
  lampiran: fetchPembayaranAttachment,
  hapus: deletePembayaran,
  ajukan: submitPembayaran,
  setujui: postPembayaran,
  tolak: (id, alasan) => rejectPembayaran(id, alasan),
  baris: (data): BarisDetail[] => [
    ["Yayasan", data.entity?.legal_name ?? "—"],
    ["Vihara", data.vihara?.name ?? "—"],
    ["Tanggal", fmtTanggal(data.date)],
    ["Jumlah", fmtRp(data.amount)],
    ["Kategori Biaya", data.category ? danaCategoryLabel(data.category) : "—"],
    ["Nama Pengeluaran", data.name ?? "—"],
    ["Metode Pembayaran", data.method === "transfer" ? "Transfer Bank" : data.method],
    [
      "Transfer dari Rekening",
      data.bank_account
        ? `${data.bank_account.bank_name} ${data.bank_account.account_number}`
        : (data.source_account?.name ?? data.source_account_code ?? "—"),
    ],
    ["Dibayarkan kepada / PIC", data.payee_name ?? "—"],
    ["No. Bukti / Referensi", data.reference ?? "—"],
    ["Catatan", data.description ?? "—"],
  ],
};

export function PembayaranDetail({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  /** Dipanggil saat draft diubah/dihapus/diajukan, agar daftar ikut segar. */
  onChanged?: () => void;
}) {
  return (
    <TransaksiDetail
      modul={MODUL}
      id={id}
      onClose={onClose}
      onChanged={onChanged}
      ubahHref={(row) => `/pembayaran?draft=${row.id}`}
    />
  );
}
