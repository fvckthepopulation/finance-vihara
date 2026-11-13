import { apiCall } from "./auth";

/**
 * Yayasan sementara untuk skenario lintas-yayasan.
 *
 * Yayasan yang sudah pernah menyimpan transaksi TIDAK bisa dihapus — jurnalnya
 * tetap menunjuk ke sana, dan itu memang benar. Kalau dibiarkan aktif, yayasan
 * sisa uji membuat seluruh form di spec lain terkunci di "Pilih yayasan dulu"
 * (pilihan tunggal tidak lagi terisi sendiri).
 *
 * Jadi pembersihannya dua lapis: coba hapus, dan kalau ditolak, NONAKTIFKAN.
 * `/api/my-scope` hanya memuat yayasan aktif, sehingga yayasan sisa tidak
 * pernah muncul di dropdown mana pun.
 */
export async function bersihkanYayasanUji(
  token: string,
  yayasanId: number,
  viharaIds: number[] = [],
): Promise<void> {
  for (const id of viharaIds) {
    await apiCall(token, `/api/viharas/${id}`, { method: "DELETE" });
  }

  const hapus = await apiCall(token, `/api/entities/${yayasanId}`, { method: "DELETE" });
  if (hapus.status === 200) {
    return;
  }

  await apiCall(token, `/api/entities/${yayasanId}`, {
    method: "PATCH",
    body: JSON.stringify({ active: false }),
  });
}
