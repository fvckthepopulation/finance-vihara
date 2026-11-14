/**
 * C-PGL — Input Pengeluaran, skenario ENV-C dari penguji.
 *
 * Sumber: "Test scenario Finance Vihara.xlsx" (v2.1) sheet Detail ENV-C.
 *
 * Peta akun beban yang diuji (sheet "Data uji"):
 *   Biaya Bhikkhu    5100 ← Bank Donasi 1130
 *   Biaya Perayaan   5200 ← Bank Donasi 1130
 *   Biaya Operasional 6100 ← Bank Operasional 1120
 *   Biaya Paramita   5300 ← Bank Donasi 1130
 *
 * Catatan P-19: sheet menulis "Biaya Paramita belum punya akun di COA v2".
 * Di sistem ini akunnya ADA — 5300 Beban Kegiatan Paramita — jadi yang diuji
 * akun itu, dan temuan P-19 bisa ditutup.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, viharaIdsByCode } from "../fixtures/auth";
import { cocokJurnalSederhana, jurnalDariKode } from "../fixtures/jurnal";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";
import { bersihkanYayasanUji } from "../fixtures/yayasanUji";

type Dibuat = { id: number; code: string };

test.describe.configure({ mode: "serial" });

const HARI_INI = () => new Date().toLocaleDateString("en-CA");

test.describe("ENV-C · Input Pengeluaran", () => {
  let admin = "";
  let viharaVvg = 0;
  let rekDonasi = 0;
  let rekOperasional = 0;
  const dibuat: number[] = [];

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;

    const rek = await apiCall<{ data: Array<{ id: number; coa_account_code: string }> }>(
      admin,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}&type=bank`,
    );
    rekDonasi = rek.body.data.find((b) => b.coa_account_code === "1130")!.id;
    // Rekening Operasional (1120) belum tentu ada di data contoh; kalau tidak
    // ada, skenario yang membutuhkannya dilewati dengan alasan, bukan
    // dipaksa memakai rekening donasi sehingga jurnalnya salah.
    rekOperasional =
      rek.body.data.find((b) => b.coa_account_code === "1120")?.id ?? 0;
  });

  test.afterAll(async () => {
    for (const id of dibuat) {
      await apiCall(admin, `/api/pembayaran/${id}`, { method: "DELETE" });
    }
  });

  async function ujiPengeluaran(opts: {
    category: string;
    name: string;
    amount: number;
    bankAccountId: number;
    debit: string;
    kredit: string;
  }) {
    const bukti = uniq("BKK-UJI");
    const res = await apiCall<Dibuat>(admin, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        category: opts.category,
        name: opts.name,
        amount: opts.amount,
        vihara_id: viharaVvg,
        bank_account_id: opts.bankAccountId,
        payee_name: "Vendor Uji",
        reference: bukti,
      }),
    });
    expect(res.status, `simpan pengeluaran ${opts.category}`).toBe(201);
    dibuat.push(res.body.id);

    await apiCall(admin, `/api/pembayaran/${res.body.id}/post`, { method: "POST" });

    const jurnal = await jurnalDariKode(admin, res.body.code);
    expect(cocokJurnalSederhana(jurnal, {
      debit: opts.debit,
      kredit: opts.kredit,
      nominal: opts.amount,
    })).toEqual({ debit: opts.debit, kredit: opts.kredit, nominal: opts.amount });
    expect(jurnal.vihara_id).toBe(viharaVvg);

    return res.body;
  }

  // CATATAN PERUBAHAN: sheet ENV-C menulis C-PGL-01 dan C-PGL-02 dikredit ke
  // 1130 Bank Donasi. Keputusan FV-56 (jawaban (a) atas Perlu Konfirmasi no.1)
  // mengubahnya: SELURUH pengeluaran keluar dari 1120 Bank Operasional, dan
  // dana donasi dipindahkan lebih dulu lewat transfer antar rekening.
  // Pembatasan dananya dilacak di aset neto 3200 (FV-55), bukan lewat
  // rekening mana yang dipakai.
  test("C-PGL-01: Biaya Bhikkhu Rp 800.000 → Dr 5100 / Kr 1120 (FV-56)", async () => {
    await ujiPengeluaran({
      category: "biaya_bhikkhu",
      name: "Biaya Makan Bhikkhu",
      amount: 800_000,
      bankAccountId: rekOperasional,
      debit: "5100",
      kredit: "1120",
    });
  });

  test("C-PGL-02: Biaya Perayaan Rp 1.200.000 → Dr 5200 / Kr 1120 (FV-56)", async () => {
    await ujiPengeluaran({
      category: "biaya_perayaan",
      name: "Biaya Perayaan Waisak",
      amount: 1_200_000,
      bankAccountId: rekOperasional,
      debit: "5200",
      kredit: "1120",
    });
  });

  // Sejak FV-56 data contoh memang punya rekening Bank Operasional, jadi
  // skenario ini tidak lagi dilewati — inilah yang dulu berstatus Blocked.
  test("C-PGL-03: Biaya Operasional Rp 250.000 dari Bank Operasional → Dr 6100 / Kr 1120", async () => {
    await ujiPengeluaran({
      category: "biaya_operasional",
      name: "Biaya ATK",
      amount: 250_000,
      bankAccountId: rekOperasional,
      debit: "6100",
      kredit: "1120",
    });
  });

  test("C-PGL-04 (P-19): Biaya Paramita Rp 300.000 → Dr 5300 / Kr 1120 (FV-56)", async () => {
    await ujiPengeluaran({
      category: "biaya_paramita",
      name: "Biaya Baksos",
      amount: 300_000,
      bankAccountId: rekOperasional,
      debit: "5300",
      kredit: "1120",
    });
  });

  test("C-PGL-01: lewat form — tersimpan, detailnya sama dengan input", async ({ page }) => {
    const bukti = uniq("BKK-FORM");
    await login(page, "admin");
    await page.goto("/pembayaran");

    const yayasan = page.getByTestId("form-yayasan");
    await expect(yayasan).toBeEnabled({ timeout: 15_000 });
    await expect
      .poll(async () => (await yayasan.locator("option").allTextContents()).join("|"), {
        timeout: 15_000,
      })
      .not.toContain("Memuat");
    if ((await yayasan.inputValue()) === "") {
      await yayasan.selectOption({ index: 1 });
    }
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    await page.getByLabel("Jumlah (Rp) *").fill("800000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Bhikkhu/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Makan Bhikkhu/);
    await selectByLabelRegex(page.getByTestId("form-rekening"), /BCA|Mandiri/);
    await page.getByTestId("form-penerima").fill("Vendor Uji");
    await page.getByLabel("No. Bukti / Referensi").fill(bukti);
    await page.getByTestId("tombol-submit").click();

    await expect(page.getByText(/disimpan dan disetujui/)).toBeVisible({ timeout: 15_000 });

    const daftar = await apiCall<{ data: Array<{ id: number; reference: string | null }> }>(
      admin,
      "/api/pembayaran?per_page=5",
    );
    const baris = daftar.body.data.find((p) => p.reference === bukti);
    expect(baris, "transaksinya tersimpan").toBeTruthy();
    dibuat.push(baris!.id);

    // Detailnya memuat kembali apa yang diinput.
    await page.getByTestId(`detail-pengeluaran-${baris!.id}`).click();
    const modal = page.getByTestId("detail-pengeluaran");
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal).toContainText("Vendor Uji");
    await expect(modal).toContainText(bukti);
    await expect(modal).toContainText("Biaya Bhikkhu");
  });

  test("C-PGL-05: pengeluaran di yayasan lain memakai rekening yayasannya sendiri", async () => {
    const stamp = Date.now().toString().slice(-5);
    const yayasan = await apiCall<{ id: number }>(admin, "/api/entities", {
      method: "POST",
      body: JSON.stringify({
        code: `YP${stamp}`,
        legal_name: `Yayasan Pariyatti ${stamp}`,
        address: "Semarang",
      }),
    });
    expect(yayasan.status).toBe(201);

    const vihara = await apiCall<{ id: number }>(admin, "/api/viharas", {
      method: "POST",
      body: JSON.stringify({
        entity_id: yayasan.body.id,
        name: `Vihara Pariyatti ${stamp}`,
        bank_name: "BNI",
        bank_account_number: `7777-${stamp}`,
        bank_account_holder: `Vihara Pariyatti ${stamp}`,
      }),
    });
    expect(vihara.status).toBe(201);

    // Rekening Bank Operasional milik yayasan baru (FV-36: pemiliknya yayasan).
    const rek = await apiCall<{ id: number }>(
      admin,
      `/api/entities/${yayasan.body.id}/bank-accounts`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "bank",
          bank_name: "Bank BNI",
          account_number: `7777-${stamp}`,
          account_name: `Yayasan Pariyatti ${stamp}`,
          coa_account_code: "1120",
        }),
      },
    );
    expect(rek.status).toBe(201);

    try {
      // Dropdown vihara itu hanya memuat rekening yayasannya sendiri.
      const pilihan = await apiCall<{ data: Array<{ id: number; entity_id: number }> }>(
        admin,
        `/api/masters/vihara-bank-accounts?vihara_id=${vihara.body.id}&type=bank`,
      );
      expect(pilihan.body.data.length).toBeGreaterThan(0);
      for (const b of pilihan.body.data) {
        expect(b.entity_id, "rekening yayasan lain tidak boleh ikut").toBe(yayasan.body.id);
      }

      const res = await apiCall<Dibuat>(admin, "/api/pembayaran", {
        method: "POST",
        body: JSON.stringify({
          date: HARI_INI(),
          method: "transfer",
          category: "biaya_operasional",
          name: "Biaya ATK",
          amount: 100_000,
          vihara_id: vihara.body.id,
          bank_account_id: rek.body.id,
          payee_name: "Vendor Uji",
        }),
      });
      expect(res.status).toBe(201);
      await apiCall(admin, `/api/pembayaran/${res.body.id}/post`, { method: "POST" });

      const jurnal = await jurnalDariKode(admin, res.body.code);
      expect(cocokJurnalSederhana(jurnal, { debit: "6100", kredit: "1120", nominal: 100_000 }))
        .toEqual({ debit: "6100", kredit: "1120", nominal: 100_000 });
      expect(jurnal.vihara_id).toBe(vihara.body.id);

      await apiCall(admin, `/api/pembayaran/${res.body.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "pembersihan uji e2e" }),
      });
      await apiCall(admin, `/api/pembayaran/${res.body.id}`, { method: "DELETE" });
      await apiCall(admin, `/api/vihara-bank-accounts/${rek.body.id}`, { method: "DELETE" });
    } finally {
      await bersihkanYayasanUji(admin, yayasan.body.id, [vihara.body.id]);
    }
  });

  test("C-PGL-07 (P-15): pembatalan hanya untuk pemegang izin, dan ada jejaknya", async () => {
    const res = await apiCall<Dibuat>(admin, "/api/pembayaran", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: "transfer",
        // Sheet memakai Beban Lainnya 6300, tapi kategori itu belum punya
        // Nama Pengeluaran terdaftar di data contoh; yang diuji di sini izin
        // dan jejak auditnya, bukan akunnya.
        category: "biaya_operasional",
        name: "Biaya ATK",
        amount: 10_000,
        vihara_id: viharaVvg,
        // Pengeluaran keluar dari Bank Operasional sejak FV-56.
        bank_account_id: rekOperasional,
        payee_name: "Vendor Uji",
      }),
    });
    expect(res.status).toBe(201);
    dibuat.push(res.body.id);
    await apiCall(admin, `/api/pembayaran/${res.body.id}/post`, { method: "POST" });

    // Role tanpa izin pembatalan ditolak.
    const adminVihara = await apiToken({ email: "admin.vihara@vvg.test", password: "password" });
    const ditolak = await apiCall(adminVihara, `/api/pembayaran/${res.body.id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason: "coba batalkan" }),
    });
    expect(ditolak.status, "Admin Vihara tidak memegang izin pembatalan").toBe(403);

    // Pemegang izin bisa, dan jejaknya tersimpan — bukan hard delete.
    const batal = await apiCall(admin, `/api/pembayaran/${res.body.id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason: "uji jejak audit" }),
    });
    expect(batal.status).toBe(200);

    const detail = await apiCall<{
      status: string;
      void_reason: string | null;
      voided_at: string | null;
      voided_by_user_id: number | null;
    }>(admin, `/api/pembayaran/${res.body.id}`);
    expect(detail.body.status).toBe("cancelled");
    expect(detail.body.void_reason).toBe("uji jejak audit");
    expect(detail.body.voided_at, "kapan dibatalkan tercatat").toBeTruthy();
    expect(detail.body.voided_by_user_id, "siapa yang membatalkan tercatat").toBeTruthy();

    // Jurnalnya DIBALIK, bukan dihapus: ada entri asli dan entri pembalik,
    // dan kalau dijumlahkan beban akun itu kembali nol.
    const semua = await apiCall<{ data: Array<{ id: number }> }>(
      admin,
      `/api/journal-entries?q=${encodeURIComponent(res.body.code)}&per_page=10`,
    );
    expect(
      semua.body.data.length,
      "ada jurnal asli DAN jurnal pembaliknya",
    ).toBeGreaterThanOrEqual(2);

    let bersih = 0;
    for (const j of semua.body.data) {
      const detail = await apiCall<{ lines: Array<{ account_code: string; debit: string; credit: string }> }>(
        admin,
        `/api/journal-entries/${j.id}`,
      );
      bersih += detail.body.lines
        .filter((l) => l.account_code === "6100")
        .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    }
    expect(bersih, "beban kembali nol setelah dibatalkan").toBe(0);
  });
});
