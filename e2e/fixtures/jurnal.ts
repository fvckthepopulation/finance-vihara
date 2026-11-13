import { apiCall } from "./auth";

/**
 * Pembantu asersi jurnal untuk skenario penguji.
 *
 * Kolom "Jurnal yang Diharapkan" di sheet mereka ditulis sebagai
 * `Dr <akun> <nama> Rp <nominal> / Kr <akun> <nama> Rp <nominal>`. Di sini
 * yang dibandingkan hanya kode akun dan nominalnya — nama akun ikut berubah
 * kalau COA diubah, dan itu bukan yang sedang diuji.
 */

export type BarisJurnal = {
  account_code: string;
  debit: string;
  credit: string;
};

export type JurnalDetail = {
  id: number;
  vihara_id: number | null;
  status: string;
  total_debit: string;
  total_credit: string;
  lines: BarisJurnal[];
};

/** Jurnal milik satu transaksi, dicari lewat kode dokumennya (PAY-…/RCV-…). */
export async function jurnalDariKode(token: string, kode: string): Promise<JurnalDetail> {
  const daftar = await apiCall<{ data: Array<{ id: number; description: string }> }>(
    token,
    `/api/journal-entries?q=${encodeURIComponent(kode)}&per_page=5`,
  );
  const cocok = daftar.body.data.find((j) => j.description.includes(kode));
  if (!cocok) {
    throw new Error(`Jurnal untuk ${kode} tidak ditemukan`);
  }
  const detail = await apiCall<JurnalDetail>(token, `/api/journal-entries/${cocok.id}`);

  return detail.body;
}

/**
 * Jurnal itu persis satu baris debit dan satu baris kredit, dengan akun dan
 * nominal yang disebut? Dipakai seluruh skenario PNR/PGL yang jurnalnya
 * memang dua baris.
 */
export function cocokJurnalSederhana(
  jurnal: JurnalDetail,
  harapan: { debit: string; kredit: string; nominal: number },
): { debit: string; kredit: string; nominal: number } {
  const debit = jurnal.lines.filter((l) => Number(l.debit) > 0);
  const kredit = jurnal.lines.filter((l) => Number(l.credit) > 0);

  return {
    debit: debit.length === 1 ? debit[0].account_code : `(${debit.length} baris debit)`,
    kredit: kredit.length === 1 ? kredit[0].account_code : `(${kredit.length} baris kredit)`,
    nominal: Number(jurnal.total_debit),
  };
}
