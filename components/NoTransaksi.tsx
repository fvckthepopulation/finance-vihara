"use client";

/**
 * No. Transaksi sebagai kolom pertama tabel (FV-40).
 *
 * Nomornya sudah ada sejak baris disimpan — termasuk saat masih draft — jadi
 * draft pun bisa dirujuk. Dibuat bisa diklik untuk membuka detail: di tabel
 * yang lebar, nomor di kolom pertama lebih dekat dijangkau daripada tombol
 * Detail di ujung kanan.
 *
 * Dirender sebagai <button>, bukan <a href>: tujuannya membuka modal di
 * halaman yang sama, dan tautan yang tidak menuju ke mana-mana menyesatkan
 * pembaca layar maupun klik-tengah.
 */
export function NoTransaksi({
  code,
  onClick,
  testId,
}: {
  code: string | null | undefined;
  onClick?: () => void;
  testId?: string;
}) {
  if (!code) return <span className="text-km-ink-muted">—</span>;
  if (!onClick) {
    return <span className="kode whitespace-nowrap text-km-ink-soft">{code}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      title="Buka detail transaksi"
      className="kode whitespace-nowrap font-medium text-km-blue hover:underline"
    >
      {code}
    </button>
  );
}
