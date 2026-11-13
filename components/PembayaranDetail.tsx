"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import {
  categoryLabel,
  STATUS_LABEL,
  fetchPembayaranAttachment,
  getPembayaran,
  Pembayaran,
} from "@/lib/pembayaran";
import { fmtTanggal } from "@/lib/tanggal";

// ============================================================================
// Detail satu pengeluaran, termasuk lampiran buktinya.
//
// Lampiran duduk di disk privat dan endpoint unduhnya butuh token serta
// dijaga hirarki vihara, jadi tidak bisa dipasang sebagai <img src> biasa:
// berkasnya diambil sebagai blob lebih dulu. Gambar ditampilkan langsung,
// PDF dibuka di tab baru — keduanya dari blob yang sama.
// ============================================================================

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

export function PembayaranDetail({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<Pembayaran | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lampiranUrl, setLampiranUrl] = useState<string | null>(null);
  const [lampiranTipe, setLampiranTipe] = useState<string | null>(null);
  const [memuatLampiran, setMemuatLampiran] = useState(false);

  useEffect(() => {
    let alive = true;
    getPembayaran(id)
      .then((d) => alive && setData(d))
      .catch((e) =>
        alive && setError(e instanceof Error ? e.message : "Gagal memuat detail"),
      );
    return () => {
      alive = false;
    };
  }, [id]);

  // Ambil lampiran begitu diketahui ada. URL objeknya dicabut saat modal
  // ditutup supaya tidak menumpuk di memori.
  useEffect(() => {
    if (!data?.attachment_path) return;
    let alive = true;
    let url: string | null = null;
    setMemuatLampiran(true);
    fetchPembayaranAttachment(id)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setLampiranUrl(url);
        setLampiranTipe(blob.type);
      })
      .catch((e) =>
        alive && setError(e instanceof Error ? e.message : "Gagal membuka lampiran"),
      )
      .finally(() => alive && setMemuatLampiran(false));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, data?.attachment_path]);

  const baris: Array<[string, React.ReactNode]> = data
    ? [
        ["Yayasan", data.entity?.legal_name ?? "—"],
        ["Vihara", data.vihara?.name ?? "—"],
        ["Tanggal", fmtTanggal(data.date)],
        ["Jumlah", fmtRp(data.amount)],
        ["Kategori Biaya", data.category ? categoryLabel(data.category) : "—"],
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
      ]
    : [];

  return (
    <Modal
      title={data ? `Detail ${data.code}` : "Detail pengeluaran"}
      onClose={onClose}
      width="max-w-2xl"
      testId="detail-pengeluaran"
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="default" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="px-4 py-4">
        {error && (
          <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
            {error}
          </p>
        )}

        {!data && !error && <p className="text-[12px] text-km-ink-muted">Memuat…</p>}

        {data && (
          <>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {baris.map(([label, nilai]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[10.5px] uppercase tracking-wide text-km-ink-muted">
                    {label}
                  </dt>
                  <dd className="break-words text-[12.5px] text-km-ink">{nilai}</dd>
                </div>
              ))}
            </dl>

            {/* Jejak persetujuan — dicatat sistem, bukan diketik penginput.
                Nilai lama di approved_by_name tetap ditampilkan tapi diberi
                keterangan, supaya tidak tertukar dengan penyetuju yang sah. */}
            <div className="mt-4 border-t border-km-border pt-3">
              <p className="mb-2 text-[10.5px] uppercase tracking-wide text-km-ink-muted">
                Status &amp; Persetujuan
              </p>
              <div className="space-y-1 text-[12.5px]">
                <p data-testid="detail-status">
                  <span className="text-km-ink-muted">Status: </span>
                  {STATUS_LABEL[data.status] ?? data.status}
                </p>
                <p>
                  <span className="text-km-ink-muted">Diajukan oleh: </span>
                  {data.submitted_by?.name
                    ? `${data.submitted_by.name} — ${fmtTanggal(data.submitted_at)}`
                    : "—"}
                </p>
                <p data-testid="detail-penyetuju">
                  <span className="text-km-ink-muted">Disetujui oleh: </span>
                  {data.status === "posted" && data.posted_by?.name
                    ? `${data.posted_by.name} — ${fmtTanggal(data.posted_at)}`
                    : "—"}
                </p>
                {data.status === "rejected" && (
                  <p className="text-km-red-ink">
                    <span className="text-km-ink-muted">Ditolak oleh: </span>
                    {data.rejected_by?.name ?? "—"} — {fmtTanggal(data.rejected_at)}
                    {data.reject_reason ? ` · ${data.reject_reason}` : ""}
                  </p>
                )}
                {data.approved_by_name && (
                  <p className="text-[11.5px] text-km-ink-muted" data-testid="penyetuju-manual">
                    Catatan penginput (diisi manual): {data.approved_by_name}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-km-border pt-3">
              <p className="mb-2 text-[10.5px] uppercase tracking-wide text-km-ink-muted">
                Lampiran Bukti
              </p>
              {!data.attachment_path ? (
                <p className="text-[12px] text-km-ink-muted" data-testid="tanpa-lampiran">
                  Tidak ada lampiran
                </p>
              ) : memuatLampiran ? (
                <p className="text-[12px] text-km-ink-muted">Memuat lampiran…</p>
              ) : lampiranUrl ? (
                lampiranTipe?.startsWith("image/") ? (
                  <a href={lampiranUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lampiranUrl}
                      alt={`Lampiran ${data.code}`}
                      data-testid="lampiran-gambar"
                      className="max-h-80 rounded-lg border border-km-border"
                    />
                  </a>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    data-testid="lampiran-buka"
                    onClick={() => window.open(lampiranUrl, "_blank", "noopener")}
                  >
                    Buka lampiran (PDF)
                  </Button>
                )
              ) : null}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
