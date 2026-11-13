"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { STATUS_LABEL, StatusTransaksi, bisaDilanjutkan } from "@/lib/statusTransaksi";
import { fmtTanggal } from "@/lib/tanggal";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Detail satu transaksi — dipakai penerimaan DAN pengeluaran.
//
// Lampiran duduk di disk privat dan endpoint unduhnya butuh token serta
// dijaga hirarki vihara, jadi tidak bisa dipasang sebagai <img src> biasa:
// berkasnya diambil sebagai blob lebih dulu. Gambar ditampilkan langsung,
// PDF dibuka di tab baru — keduanya dari blob yang sama.
//
// Di sinilah juga jalan keluar sebuah draft (FV-44): Ubah, Hapus, dan Ajukan
// Persetujuan. Sebelumnya detail hanya bisa dibaca, jadi draft yang tersimpan
// tidak bisa dilanjutkan sama sekali — satu-satunya jalan adalah menginput
// ulang dari awal dan membiarkan draft lama menumpuk di daftar.
//
// Yang menentukan tombolnya muncul bukan cuma status, tapi juga SIAPA: draft
// adalah pekerjaan setengah jadi milik pembuatnya. Rekan satu vihara hanya
// melihat. Server memeriksa hal yang sama — tombol yang hilang bukan
// satu-satunya penjaga.
// ============================================================================

export type BarisDetail = [string, React.ReactNode];

/** Bentuk minimum yang dipakai komponen ini; penerimaan & pengeluaran punya semua. */
export type BarisTransaksi = {
  id: number;
  code: string;
  status: StatusTransaksi;
  attachment_path: string | null;
  created_by_user_id: number | null;
  created_by?: { id: number; name: string } | null;
  submitted_at?: string | null;
  submitted_by?: { id: number; name: string } | null;
  posted_at?: string | null;
  posted_by?: { id: number; name: string } | null;
  rejected_at?: string | null;
  rejected_by?: { id: number; name: string } | null;
  reject_reason?: string | null;
  approved_by_name?: string | null;
};

export type ModulTransaksi<T extends BarisTransaksi> = {
  /** Dipakai di judul, pesan, dan data-testid: "pengeluaran" / "penerimaan". */
  sebutan: string;
  /** Izin mencatat — tanpa ini tombol lanjut draft tidak relevan. */
  izinCatat: string;
  ambil: (id: number) => Promise<T>;
  lampiran: (id: number) => Promise<Blob>;
  hapus: (id: number) => Promise<void>;
  ajukan: (id: number) => Promise<unknown>;
  /** Baris isian yang ditampilkan, urutannya mengikuti form inputnya. */
  baris: (row: T) => BarisDetail[];
};

/** Form ubah draft — dipasok per modul, karena fieldnya memang berbeda. */
export type FormUbahProps<T> = {
  row: T;
  onClose: () => void;
  onSaved: (pesan: string) => void;
};

export function TransaksiDetail<T extends BarisTransaksi>({
  modul,
  id,
  onClose,
  onChanged,
  FormUbah,
}: {
  modul: ModulTransaksi<T>;
  id: number;
  onClose: () => void;
  /** Dipanggil setiap draft berubah, supaya daftar pemanggil ikut segar. */
  onChanged?: () => void;
  FormUbah?: (props: FormUbahProps<T>) => React.ReactNode;
}) {
  const { user, can, hasRole } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lampiranUrl, setLampiranUrl] = useState<string | null>(null);
  const [lampiranTipe, setLampiranTipe] = useState<string | null>(null);
  const [memuatLampiran, setMemuatLampiran] = useState(false);
  const [sedang, setSedang] = useState<null | "ajukan" | "hapus">(null);
  const [ubah, setUbah] = useState(false);

  const muat = useCallback(() => {
    return modul
      .ambil(id)
      .then((d) => {
        setData(d);
        return d;
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Gagal memuat detail");
        return null;
      });
    // modul adalah objek konstanta per modul; sengaja tidak jadi dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let alive = true;
    modul
      .ambil(id)
      .then((d) => alive && setData(d))
      .catch(
        (e) => alive && setError(e instanceof Error ? e.message : "Gagal memuat detail"),
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Ambil lampiran begitu diketahui ada. URL objeknya dicabut saat modal
  // ditutup supaya tidak menumpuk di memori.
  useEffect(() => {
    if (!data?.attachment_path) {
      setLampiranUrl(null);
      return;
    }
    let alive = true;
    let url: string | null = null;
    setMemuatLampiran(true);
    modul
      .lampiran(id)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setLampiranUrl(url);
        setLampiranTipe(blob.type);
      })
      .catch(
        (e) => alive && setError(e instanceof Error ? e.message : "Gagal membuka lampiran"),
      )
      .finally(() => alive && setMemuatLampiran(false));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data?.attachment_path]);

  // Pembuatnya, atau superadmin. Baris impor (tanpa pembuat) hanya superadmin.
  const milikSaya =
    data != null && user != null && data.created_by_user_id === user.id;
  const bolehLanjut =
    data != null &&
    bisaDilanjutkan(data.status) &&
    (hasRole("superadmin") || (milikSaya && can(modul.izinCatat)));
  // Hapus hanya untuk DRAFT. Yang sudah ditolak masih boleh diperbaiki dan
  // diajukan lagi — itu memang gunanya penolakan — tapi tidak dibuang, supaya
  // jejak penolakannya tidak hilang dari riwayat. Server menerapkan batas
  // yang sama, jadi tombolnya tidak boleh menjanjikan lebih.
  const bolehHapus = bolehLanjut && data.status === "draft";

  async function ajukan() {
    if (!data) return;
    setError(null);
    setSedang("ajukan");
    try {
      await modul.ajukan(data.id);
      setInfo(`${ucfirst(modul.sebutan)} diajukan — menunggu persetujuan`);
      await muat();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengajukan");
    } finally {
      setSedang(null);
    }
  }

  async function hapus() {
    if (!data) return;
    const ya = window.confirm(
      `Hapus draft ${data.code}?\n\nDraft belum membuat jurnal, jadi tidak ada ` +
        `yang perlu dibalik. Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!ya) return;
    setError(null);
    setSedang("hapus");
    try {
      await modul.hapus(data.id);
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus draft");
      setSedang(null);
    }
  }

  const baris = data ? modul.baris(data) : [];

  if (ubah && data && FormUbah) {
    return (
      <>
        {FormUbah({
          row: data,
          onClose: () => setUbah(false),
          onSaved: async (pesan: string) => {
            setUbah(false);
            setInfo(pesan);
            await muat();
            onChanged?.();
          },
        })}
      </>
    );
  }

  return (
    <Modal
      title={data ? `Detail ${data.code}` : `Detail ${modul.sebutan}`}
      onClose={onClose}
      width="max-w-2xl"
      testId={`detail-${modul.sebutan}`}
      footer={
        <>
          {bolehLanjut && (
            <span className="mr-auto text-[11px] text-km-ink-muted">
              Draft milik Anda — masih bisa diubah.
            </span>
          )}
          {bolehLanjut && FormUbah && (
            <Button
              type="button"
              variant="default"
              disabled={sedang !== null}
              onClick={() => setUbah(true)}
              data-testid="ubah-draft"
            >
              Ubah
            </Button>
          )}
          {bolehHapus && (
            <Button
              type="button"
              variant="danger"
              disabled={sedang !== null}
              onClick={hapus}
              data-testid="hapus-draft"
            >
              {sedang === "hapus" ? "Menghapus…" : "Hapus"}
            </Button>
          )}
          {bolehLanjut && (
            <Button
              type="button"
              variant="primary"
              disabled={sedang !== null}
              onClick={ajukan}
              data-testid="ajukan-draft"
            >
              {sedang === "ajukan" ? "Mengajukan…" : "Ajukan Persetujuan"}
            </Button>
          )}
          <Button type="button" variant="default" onClick={onClose}>
            Tutup
          </Button>
        </>
      }
    >
      <div>
        {error && (
          <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
            {error}
          </p>
        )}
        {info && (
          <p
            className="mb-3 rounded-lg border border-km-green bg-km-green-soft px-3 py-2 text-[12px] text-km-green-ink"
            data-testid="detail-info"
          >
            {info}
          </p>
        )}

        {!data && !error && <p className="text-[12px] text-km-ink-muted">Memuat…</p>}

        {data && (
          <>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[10.5px] uppercase tracking-wide text-km-ink-muted">
                  No. Transaksi
                </dt>
                <dd className="kode break-words text-[12.5px] font-medium text-km-ink">
                  {data.code}
                </dd>
              </div>
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
                <p data-testid="detail-pembuat">
                  <span className="text-km-ink-muted">Dibuat oleh: </span>
                  {data.created_by?.name ?? "—"}
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

const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
