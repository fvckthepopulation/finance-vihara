/**
 * Format tanggal untuk ditampilkan.
 *
 * Sengaja TIDAK memakai `new Date(...)`. Nilai dari API berbentuk
 * "2026-11-12T00:00:00+07:00" atau "2026-11-12"; kalau diserahkan ke Date
 * lalu di-`toLocaleDateString`, hasilnya bergantung zona waktu peramban —
 * `new Date("2026-11-12")` dibaca sebagai tengah malam UTC, sehingga di zona
 * yang lebih barat tampil menjadi 11 November. Tanggal transaksi adalah
 * tanggal kalender, bukan titik waktu, jadi bagiannya cukup dipotong dan
 * disusun ulang.
 */
export function fmtTanggal(nilai: string | null | undefined): string {
  if (!nilai) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nilai);
  if (!m) return nilai;
  const [, tahun, bulan, hari] = m;
  return `${hari}/${bulan}/${tahun}`;
}
