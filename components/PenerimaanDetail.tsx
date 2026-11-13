"use client";

import {
  BarisDetail,
  ModulTransaksi,
  TransaksiDetail,
} from "@/components/TransaksiDetail";
import { PenerimaanDraftForm } from "@/components/PenerimaanDraftForm";
import { danaCategoryLabel } from "@/components/DanaTag";
import {
  deletePenerimaan,
  fetchPenerimaanAttachment,
  getPenerimaan,
  Penerimaan,
  submitPenerimaan,
} from "@/lib/penerimaan";
import { fmtTanggal } from "@/lib/tanggal";

// ============================================================================
// Detail satu penerimaan — isi dan perilakunya dari TransaksiDetail, komponen
// yang sama dengan pengeluaran (FV-45). Di sini hanya baris isiannya, urut
// seperti form Input Penerimaan, dan form ubah draftnya.
// ============================================================================

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const METODE: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer Bank",
  auto_credit: "Auto Credit (KalyanaMitta)",
};

const MODUL: ModulTransaksi<Penerimaan> = {
  sebutan: "penerimaan",
  izinCatat: "penerimaan.create",
  ambil: getPenerimaan,
  lampiran: fetchPenerimaanAttachment,
  hapus: deletePenerimaan,
  ajukan: submitPenerimaan,
  baris: (data): BarisDetail[] => [
    ["Yayasan", data.entity?.legal_name ?? "—"],
    ["Vihara", data.vihara?.name ?? "—"],
    ["Tanggal", fmtTanggal(data.date)],
    ["Jumlah", fmtRp(data.amount)],
    ["Kategori Dana", data.category ? danaCategoryLabel(data.category) : "—"],
    ["Nama Penerimaan", data.name ?? "—"],
    ["Metode Penerimaan", METODE[data.method] ?? data.method],
    [
      "Masuk ke",
      data.bank_account
        ? `${data.bank_account.bank_name} ${data.bank_account.account_number}`
        : (data.destination_account?.name ?? data.destination_account_code ?? "—"),
    ],
    ["Donatur / Sumber", data.source_payee?.name ?? data.source_name ?? "—"],
    ["No. Bukti / Referensi", data.reference ?? "—"],
    ["Diterima oleh", data.received_by ?? "—"],
    ["Catatan", data.description ?? "—"],
  ],
};

export function PenerimaanDetail({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged?: () => void;
}) {
  return (
    <TransaksiDetail
      modul={MODUL}
      id={id}
      onClose={onClose}
      onChanged={onChanged}
      FormUbah={(props) => <PenerimaanDraftForm {...props} />}
    />
  );
}
