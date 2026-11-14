import { apiCall } from "./auth";

/**
 * Memilih rekening menurut AKUN COA-nya, bukan menurut urutan daftar.
 *
 * Sejak FV-56 akun rekening menentukan sah-tidaknya sebuah transaksi:
 * seluruh pengeluaran keluar dari Bank Operasional (1120), sementara donasi
 * masuk ke Bank Donasi (1130). Spec yang mengambil `daftar[0]` karena itu
 * bisa memilih rekening yang salah dan ditolak server — dan kegagalannya
 * tidak ada hubungannya dengan apa yang sedang diuji.
 */
type Rekening = { id: number; coa_account_code: string | null };

async function pilih(token: string, viharaId: number, akun: string): Promise<number> {
  const res = await apiCall<{ data: Rekening[] }>(
    token,
    `/api/masters/vihara-bank-accounts?vihara_id=${viharaId}&type=bank`,
  );
  const cocok = res.body.data.find((b) => b.coa_account_code === akun);
  if (!cocok) {
    throw new Error(
      `Tidak ada rekening berakun ${akun} untuk vihara ${viharaId}. ` +
        `Yang ada: ${res.body.data.map((b) => b.coa_account_code).join(", ") || "(kosong)"}`,
    );
  }

  return cocok.id;
}

/** Rekening yang sah untuk PENGELUARAN — Bank Operasional (1120). */
export const rekeningPengeluaran = (token: string, viharaId: number) =>
  pilih(token, viharaId, "1120");

/** Rekening penerimaan donasi — Bank Donasi (1130). */
export const rekeningDonasi = (token: string, viharaId: number) =>
  pilih(token, viharaId, "1130");
