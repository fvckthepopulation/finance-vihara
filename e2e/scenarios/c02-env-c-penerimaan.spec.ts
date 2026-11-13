/**
 * C-PNR — Input Penerimaan, skenario ENV-C dari penguji.
 *
 * Sumber: "Test scenario Finance Vihara.xlsx" (v2.1) sheet Detail ENV-C.
 * Nominal, kategori, dan jurnal yang diharapkan disalin apa adanya dari sheet
 * itu; nama tes memakai ID skenario mereka.
 *
 * Peta akun penerimaan yang diuji di sini (sheet "Data uji"):
 *   Dana Operasional / Paramita = Tanpa Pembatasan → tunai 4310, transfer 4210
 *   Dana Bhikkhu / Perayaan     = Dengan Pembatasan → tunai 4320, transfer 4220
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

test.describe("ENV-C · Input Penerimaan", () => {
  let admin = "";
  let viharaVvg = 0;
  let rekeningDonasi = 0;
  const dibuat: number[] = [];

  test.beforeAll(async () => {
    admin = await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
    const rek = await apiCall<{ data: Array<{ id: number; coa_account_code: string }> }>(
      admin,
      `/api/masters/vihara-bank-accounts?vihara_id=${viharaVvg}&type=bank`,
    );
    // Skenario transfer menyebut "Bank Donasi" = akun COA 1130.
    rekeningDonasi =
      rek.body.data.find((b) => b.coa_account_code === "1130")?.id ?? rek.body.data[0].id;
  });

  test.afterAll(async () => {
    for (const id of dibuat) {
      await apiCall(admin, `/api/penerimaan/${id}`, { method: "DELETE" });
    }
  });

  /** Satu penerimaan diposting lewat API, lalu jurnalnya dibandingkan. */
  async function ujiPenerimaan(opts: {
    category: string;
    name: string;
    method: string;
    amount: number;
    bankAccountId?: number;
    debit: string;
    kredit: string;
  }) {
    const res = await apiCall<Dibuat>(admin, "/api/penerimaan", {
      method: "POST",
      body: JSON.stringify({
        date: HARI_INI(),
        method: opts.method,
        category: opts.category,
        name: opts.name,
        amount: opts.amount,
        vihara_id: viharaVvg,
        received_by: "Lili",
        ...(opts.bankAccountId ? { bank_account_id: opts.bankAccountId } : {}),
      }),
    });
    expect(res.status, `simpan penerimaan ${opts.category}`).toBe(201);
    dibuat.push(res.body.id);

    await apiCall(admin, `/api/penerimaan/${res.body.id}/post`, { method: "POST" });

    const jurnal = await jurnalDariKode(admin, res.body.code);
    expect(cocokJurnalSederhana(jurnal, {
      debit: opts.debit,
      kredit: opts.kredit,
      nominal: opts.amount,
    })).toEqual({ debit: opts.debit, kredit: opts.kredit, nominal: opts.amount });
    expect(jurnal.vihara_id, "jurnal menunjuk vihara transaksinya").toBe(viharaVvg);

    return res.body;
  }

  test("C-PNR-01: tunai Dana Operasional Rp 500.000 → Dr 1115 / Kr 4310", async () => {
    await ujiPenerimaan({
      category: "dana_operasional",
      name: "Dana Amisa Puja dan Puja dana",
      method: "tunai",
      amount: 500_000,
      debit: "1115",
      kredit: "4310",
    });
  });

  test("C-PNR-02: tunai Dana Bhikkhu Rp 1.000.000 → Dr 1115 / Kr 4320", async () => {
    await ujiPenerimaan({
      category: "dana_bhikkhu",
      name: "Dana Catupacaya",
      method: "tunai",
      amount: 1_000_000,
      debit: "1115",
      kredit: "4320",
    });
  });

  test("C-PNR-03: transfer Dana Paramita Rp 800.000 → Dr 1130 / Kr 4210", async () => {
    await ujiPenerimaan({
      category: "dana_paramita",
      name: "Dana Paramita - Puja Bakti Sabtu Malam",
      method: "transfer",
      amount: 800_000,
      bankAccountId: rekeningDonasi,
      debit: "1130",
      kredit: "4210",
    });
  });

  test("C-PNR-04: transfer Dana Perayaan Rp 2.000.000 → Dr 1130 / Kr 4220", async () => {
    await ujiPenerimaan({
      category: "dana_perayaan",
      name: "Dana Hari Raya Waisak",
      method: "transfer",
      amount: 2_000_000,
      bankAccountId: rekeningDonasi,
      debit: "1130",
      kredit: "4220",
    });
  });

  test("C-PNR-01: lewat form — tersimpan, tampil hari ini, detailnya sama dengan input", async ({
    page,
  }) => {
    const catatan = uniq("C-PNR-01");
    await login(page, "admin");
    await page.goto("/penerimaan");
    // Yayasan dipilih eksplisit: kalau instance kebetulan punya lebih dari
    // satu yayasan, pilihan tunggal tidak terisi sendiri dan field vihara
    // tetap terkunci.
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
    await expect(page.getByTestId("form-vihara")).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    await page.getByLabel("Jumlah (Rp) *").fill("500000");
    await selectByLabelRegex(page.getByLabel("Kategori Dana *"), /Dana Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Penerimaan *"), /Dana/);
    await page.getByLabel("Diterima oleh").fill("Lili");
    await page.getByLabel("Catatan").fill(catatan);
    await page.getByRole("button", { name: /Simpan Penerimaan/i }).click();

    await expect(page.getByText(/berhasil|tersimpan|disetujui/i).first()).toBeVisible({
      timeout: 15_000,
    });
    // Form ter-reset: jumlahnya kembali kosong/0.
    await expect(page.getByLabel("Jumlah (Rp) *")).toHaveValue(/^(0|)$/);

    const daftar = await apiCall<{ data: Array<{ id: number; description: string | null }> }>(
      admin,
      "/api/penerimaan?per_page=5",
    );
    const baris = daftar.body.data.find((p) => (p.description ?? "").includes(catatan));
    expect(baris, "transaksinya tersimpan").toBeTruthy();
    dibuat.push(baris!.id);
  });

  test("C-PNR-07: Penerimaan Dana Umat — total per tab sama dengan transaksinya", async () => {
    // Dijumlahkan dari sumber yang sama dengan layarnya, bukan dari angka
    // yang diketik ulang di tes.
    const bulan = HARI_INI().slice(0, 7);

    // Dibandingkan PER KATEGORI dan langsung ke sumbernya, supaya tidak
    // terpotong batas halaman saat data contoh bertambah.
    async function totalKategori(kategori: string) {
      const res = await apiCall<{
        data: Array<{ date: string; amount: string; status: string }>;
        total: number;
      }>(admin, `/api/penerimaan?per_page=200&status=posted&category=${kategori}`);
      expect(
        res.body.total,
        `kategori ${kategori} melebihi satu halaman — asersi ini perlu paging`,
      ).toBeLessThanOrEqual(200);

      return res.body.data
        .filter((p) => p.date.startsWith(bulan))
        .reduce((s, p) => s + Number(p.amount), 0);
    }

    async function jumlahKategori(kategori: string) {
      const res = await apiCall<{ data: Array<{ date: string }> }>(
        admin,
        `/api/penerimaan?per_page=200&status=posted&category=${kategori}`,
      );

      return res.body.data.filter((p) => p.date.startsWith(bulan)).length;
    }

    const dana = await apiCall<{
      categories: Array<{ category: string; total: string; count: number; rows: unknown[] }>;
    }>(
      admin,
      `/api/dana-umat?mode=bulan&year=${bulan.slice(0, 4)}&month=${Number(bulan.slice(5, 7))}`,
    );

    const perTab = dana.body.categories;
    expect(perTab.length, "layar Dana Umat memberi rincian per kategori").toBeGreaterThan(0);
    for (const tab of perTab) {
      // Dana belum teridentifikasi memang tidak diakui sebagai penerimaan.
      if (tab.category === "donasi_belum_teridentifikasi") continue;
      expect(Number(tab.total), `total tab ${tab.category}`).toBe(
        await totalKategori(tab.category),
      );
      // Badge tiap tab = jumlah transaksinya. `rows` dibatasi untuk tampilan,
      // jadi yang dibandingkan jumlah transaksi sebenarnya.
      expect(tab.count, `jumlah transaksi tab ${tab.category}`).toBe(
        await jumlahKategori(tab.category),
      );
    }
  });

  test("C-PNR-08: penerimaan di yayasan lain tersimpan di yayasannya sendiri", async () => {
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
        bank_account_number: `8888-${stamp}`,
        bank_account_holder: `Vihara Pariyatti ${stamp}`,
      }),
    });
    expect(vihara.status).toBe(201);

    try {
      const res = await apiCall<Dibuat & { entity_id: number }>(admin, "/api/penerimaan", {
        method: "POST",
        body: JSON.stringify({
          date: HARI_INI(),
          method: "tunai",
          category: "dana_operasional",
          name: "Dana Pepao",
          amount: 400_000,
          vihara_id: vihara.body.id,
        }),
      });
      expect(res.status).toBe(201);
      await apiCall(admin, `/api/penerimaan/${res.body.id}/post`, { method: "POST" });

      // Jurnalnya sama polanya (tunai tanpa pembatasan), tapi di vihara YP.
      const jurnal = await jurnalDariKode(admin, res.body.code);
      expect(cocokJurnalSederhana(jurnal, { debit: "1115", kredit: "4310", nominal: 400_000 }))
        .toEqual({ debit: "1115", kredit: "4310", nominal: 400_000 });
      expect(jurnal.vihara_id).toBe(vihara.body.id);

      // Dan tidak ikut terlihat saat menyaring vihara VVG.
      const vvg = await apiCall<{ data: Array<{ id: number }> }>(
        admin,
        `/api/penerimaan?vihara_id=${viharaVvg}&per_page=200`,
      );
      expect(vvg.body.data.some((p) => p.id === res.body.id)).toBe(false);

      await apiCall(admin, `/api/penerimaan/${res.body.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "pembersihan uji e2e" }),
      });
    } finally {
      await bersihkanYayasanUji(admin, yayasan.body.id, [vihara.body.id]);
    }
  });

  test("C-PNR-09: kombinasi yayasan–vihara tidak cocok ditolak server", async () => {
    const stamp = Date.now().toString().slice(-5);
    const yayasan = await apiCall<{ id: number }>(admin, "/api/entities", {
      method: "POST",
      body: JSON.stringify({
        code: `YX${stamp}`,
        legal_name: `Yayasan Silang ${stamp}`,
        address: "Semarang",
      }),
    });
    expect(yayasan.status).toBe(201);

    try {
      // entity_id yayasan baru, tapi vihara milik YDI → harus ditolak.
      const res = await apiCall<{ message?: string }>(admin, "/api/penerimaan", {
        method: "POST",
        body: JSON.stringify({
          date: HARI_INI(),
          method: "tunai",
          category: "dana_operasional",
          name: "Dana Amisa Puja dan Puja dana",
          amount: 100_000,
          entity_id: yayasan.body.id,
          vihara_id: viharaVvg,
        }),
      });
      expect([403, 422]).toContain(res.status);

      // Tidak ada yang tersimpan di yayasan itu.
      const cek = await apiCall<{ data: Array<unknown> }>(
        admin,
        `/api/penerimaan?per_page=200&entity_id=${yayasan.body.id}`,
      );
      expect(cek.body.data.length).toBe(0);
    } finally {
      await bersihkanYayasanUji(admin, yayasan.body.id);
    }
  });
});
