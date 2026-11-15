"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { dialog } from "@/components/Dialog";
import { num } from "@/lib/kasBank";
import {
  deletePettyCash,
  fetchPettyCashAttachment,
  getPettyCash,
  pettyCashSourceLabel,
  PettyCashEntry,
  postPettyCash,
  voidPettyCashMovement,
} from "@/lib/pettyCash";
import { fmtTanggal } from "@/lib/tanggal";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Detail satu mutasi kas kecil (FV-84) — isi lengkap, lampiran, jejak
// pembuat/penyetuju/pembatalan, dan jalan keluar sebuah draft (FV-81):
// Ubah & Hapus untuk yang boleh mencatat, Posting untuk yang boleh
// menyetujui. Server memeriksa hal yang sama; tombol yang hilang bukan
// satu-satunya penjaga.
// ============================================================================

const fmtRp = (n: string | number | null | undefined) =>
  "Rp " + Math.round(num(n ?? 0)).toLocaleString("id-ID");

const fmtWaktu = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fmtTanggal(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS: Record<string, string> = {
  draft: "Draft — menunggu persetujuan",
  posted: "Terposting",
  cancelled: "Dibatalkan",
};

export function PettyCashDetail({
  id,
  onClose,
  onChanged,
  onUbah,
}: {
  id: number;
  onClose: () => void;
  /** Dipanggil setiap mutasi berubah (posting, hapus, batal). */
  onChanged?: (pesan: string) => void;
  /** Buka form ubah draft; tanpa ini tombol Ubah tidak ditampilkan. */
  onUbah?: (row: PettyCashEntry) => void;
}) {
  const { can } = useAuth();
  const [data, setData] = useState<PettyCashEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lampiranUrl, setLampiranUrl] = useState<string | null>(null);
  const [lampiranTipe, setLampiranTipe] = useState<string | null>(null);
  const [sedang, setSedang] = useState(false);

  useEffect(() => {
    let alive = true;
    getPettyCash(id)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Gagal memuat detail"));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!data?.attachment_path) {
      setLampiranUrl(null);
      return;
    }
    let alive = true;
    let url: string | null = null;
    fetchPettyCashAttachment(id)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setLampiranUrl(url);
        setLampiranTipe(blob.type);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Gagal membuka lampiran"));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, data?.attachment_path]);

  const draft = data?.status === "draft";
  const bolehCatat = draft && can("petty_cash.declare");
  const bolehPosting = draft && can("petty_cash.approve");
  const bolehBatal = data?.status === "posted" && can("petty_cash.void");
  const topup = data?.subtype === "topup";
  const judul = `Mutasi kas kecil #${id}`;

  async function posting() {
    if (!data) return;
    const ya = await dialog.confirm({
      title: `Posting ${judul}`,
      message: `${topup ? "Pengisian" : "Penggunaan"} ${fmtRp(data.amount)} akan dijurnal dan mengubah saldo PIC.`,
      confirmLabel: "Posting",
      action: () => postPettyCash(data.id),
    });
    if (!ya) return;
    onChanged?.(`${judul} diposting`);
    onClose();
  }

  async function hapus() {
    if (!data) return;
    const ya = await dialog.confirm({
      title: `Hapus draft ${judul}`,
      message: "Draft belum membuat jurnal. Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: "Hapus",
      tone: "danger",
      action: () => deletePettyCash(data.id),
    });
    if (!ya) return;
    onChanged?.(`${judul} dihapus`);
    onClose();
  }

  async function batalkan() {
    if (!data) return;
    setSedang(true);
    const alasan = await dialog.prompt({
      title: `Batalkan ${judul}`,
      message: "Mutasi TIDAK dihapus: sistem membuat jurnal pembalik dan menandainya dibatalkan.",
      label: "Alasan pembatalan",
      confirmLabel: "Batalkan Mutasi",
      tone: "danger",
      action: (a) => voidPettyCashMovement(data.id, a),
    });
    setSedang(false);
    if (alasan == null) return;
    onChanged?.(`${judul} dibatalkan`);
    onClose();
  }

  const baris: Array<[string, React.ReactNode]> = data
    ? [
        ["Tipe", topup ? "Pengisian" : "Penggunaan"],
        ["Status", STATUS[data.status ?? ""] ?? data.status ?? "—"],
        ["Tanggal", fmtTanggal((data.movement_date ?? data.date ?? "").slice(0, 10))],
        ["Vihara", data.vihara?.name ?? "—"],
        ["PIC", data.pic?.name ?? data.pic_name ?? "—"],
        ["Jumlah", fmtRp(data.amount)],
        ...(topup
          ? ([
              ["Sumber pengisian", pettyCashSourceLabel(data) ?? "Dana Tunai"],
              ["Keterangan transfer", data.reference || "—"],
            ] as Array<[string, React.ReactNode]>)
          : ([
              ["Kategori Biaya", data.category_label ?? data.category ?? "—"],
              ["Nama Pengeluaran", data.name || data.description || "—"],
              [
                "Akun beban",
                data.counterpart_account
                  ? `${data.counterpart_account.code} ${data.counterpart_account.name}`
                  : (data.counterpart_account_code ?? "—"),
              ],
              ["No. Bukti / Kuitansi", data.reference || "—"],
            ] as Array<[string, React.ReactNode]>)),
        ["Catatan", data.notes || "—"],
        ["No. Jurnal", data.journal_entry_id ? `JE-${data.journal_entry_id}` : "—"],
      ]
    : [];

  return (
    <Modal
      title={judul}
      onClose={onClose}
      width="max-w-2xl"
      testId="detail-kaskecil"
      footer={
        <>
          {draft && (
            <span className="mr-auto text-[11px] text-km-ink-muted">Draft — belum dijurnal.</span>
          )}
          {bolehCatat && onUbah && data && (
            <Button
              type="button"
              variant="default"
              data-testid="detail-kaskecil-ubah"
              onClick={() => {
                onClose();
                onUbah(data);
              }}
            >
              Ubah
            </Button>
          )}
          {bolehCatat && (
            <Button type="button" variant="danger" data-testid="detail-kaskecil-hapus" onClick={hapus}>
              Hapus
            </Button>
          )}
          {bolehPosting && (
            <Button type="button" variant="success" data-testid="detail-kaskecil-posting" onClick={posting}>
              Posting
            </Button>
          )}
          {bolehBatal && (
            <Button
              type="button"
              variant="danger"
              disabled={sedang}
              data-testid="detail-kaskecil-batal"
              onClick={batalkan}
            >
              Batalkan
            </Button>
          )}
          <Button type="button" variant="default" onClick={onClose}>
            Tutup
          </Button>
        </>
      }
    >
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
                <dt className="text-[10.5px] uppercase tracking-wide text-km-ink-muted">{label}</dt>
                <dd className="whitespace-pre-line break-words text-[12.5px] text-km-ink" data-testid={`detail-kk-${label}`}>
                  {nilai}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 space-y-1 border-t border-km-border pt-3 text-[12.5px]">
            <p className="mb-1 text-[10.5px] uppercase tracking-wide text-km-ink-muted">Jejak</p>
            <p>
              <span className="text-km-ink-muted">Dibuat oleh: </span>
              {data.created_by?.name ?? "—"} — {fmtWaktu(data.created_at)}
            </p>
            <p>
              <span className="text-km-ink-muted">Diposting oleh: </span>
              {data.journal_entry?.posted_by?.name
                ? `${data.journal_entry.posted_by.name} — ${fmtWaktu(data.journal_entry.posted_at ?? data.posted_at)}`
                : "—"}
            </p>
            {data.status === "cancelled" && (
              <p className="text-km-red-ink">
                <span className="text-km-ink-muted">Dibatalkan oleh: </span>
                {data.voided_by?.name ?? "—"} — {fmtWaktu(data.voided_at)}
                {data.void_reason ? ` · Alasan: ${data.void_reason}` : ""}
              </p>
            )}
            {data.journal_entry?.description && (
              <p>
                <span className="text-km-ink-muted">Deskripsi jurnal: </span>
                {data.journal_entry.description}
              </p>
            )}
          </div>

          <div className="mt-4 border-t border-km-border pt-3">
            <p className="mb-2 text-[10.5px] uppercase tracking-wide text-km-ink-muted">Lampiran Bukti</p>
            {!data.attachment_path ? (
              <p className="text-[12px] text-km-ink-muted" data-testid="kk-tanpa-lampiran">
                Tidak ada lampiran
              </p>
            ) : !lampiranUrl ? (
              <p className="text-[12px] text-km-ink-muted">Memuat lampiran…</p>
            ) : lampiranTipe?.startsWith("image/") ? (
              <a href={lampiranUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lampiranUrl}
                  alt={`Lampiran ${judul}`}
                  data-testid="kk-lampiran-gambar"
                  className="max-h-80 rounded-lg border border-km-border"
                />
              </a>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="default"
                data-testid="kk-lampiran-buka"
                onClick={() => window.open(lampiranUrl, "_blank", "noopener")}
              >
                Buka lampiran (PDF)
              </Button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
