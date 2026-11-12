/**
 * v10 — Input Penerimaan.
 * Yang diuji: cascade kategori → nama penerimaan, metode Transfer Bank
 * membuka pilihan Rekening Tujuan, penahan sebelum vihara dipilih,
 * submit penerimaan tunai → toast sukses + baris di "Penerimaan Hari Ini".
 *
 * Sejak vihara transaksi pindah dari header ke form (seragam dengan Input
 * Pengeluaran), tiap tes memilih vihara DI FORM. Header tetap dipakai
 * karena yang menyaring tabel "Penerimaan Hari Ini" masih header.
 */
import { test, expect } from "@playwright/test";
import { apiToken, login, pickViharaVVG, viharaIdsByCode } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

test.describe("v10 penerimaan", () => {
  let viharaVvg = 0;

  test.beforeAll(async () => {
    await apiToken("admin");
    viharaVvg = (await viharaIdsByCode()).VVG;
  });

  test("penahan muncul sampai vihara dipilih di form", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/penerimaan");

    // Pilihan header tidak lagi menentukan — yang menahan adalah isi form.
    await expect(page.getByTestId("form-vihara")).toHaveValue("", { timeout: 10_000 });
    await expect(page.getByText("Pilih yayasan dan vihara dulu")).toBeVisible();

    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));
    await expect(page.getByText("Pilih yayasan dan vihara dulu")).toHaveCount(0);
  });

  test("cascade kategori → nama; Transfer Bank membuka Rekening Tujuan", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/penerimaan");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    // Nama Penerimaan disabled sebelum kategori dipilih.
    const nama = page.getByLabel("Nama Penerimaan *");
    await expect(nama).toBeDisabled();

    await selectByLabelRegex(page.getByLabel("Kategori Dana *"), /Dana Perayaan/);
    await expect(nama).toBeEnabled();
    await nama.locator("option", { hasText: "Dana Kathina" }).first().waitFor({ state: "attached" });

    // Transfer Bank → Rekening Tujuan muncul dengan BCA + Mandiri.
    await expect(page.getByLabel("Rekening Tujuan")).toHaveCount(0);
    await selectByLabelRegex(page.getByLabel("Metode Penerimaan *"), /Transfer Bank/);
    const rekening = page.getByLabel("Rekening Tujuan");
    await expect(rekening).toBeVisible();
    // Opsi rekening dimuat async setelah vihara dipilih — tunggu sampai
    // benar-benar terisi, jangan baca isinya begitu select muncul (dulu
    // flaky: lolos sendirian, gagal di suite penuh).
    await expect
      .poll(async () => await rekening.locator("option").allTextContents(), {
        timeout: 10_000,
      })
      .toEqual(
        expect.arrayContaining([
          expect.stringContaining("6280-3488-88"),
          expect.stringContaining("Mandiri"),
        ]),
      );
  });

  test("submit penerimaan tunai → toast + baris Hari Ini", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/penerimaan");
    await page.getByTestId("form-vihara").selectOption(String(viharaVvg));

    const catatan = uniq("E2E-PNR");
    // Isian yang diketik sebelum React selesai hydrate hilang saat hydrate
    // (dulu flaky: Jumlah terkirim 0 dan API menolak). Format ribuan
    // "123.000" hanya muncul bila React yang menangani ketikan, jadi itu
    // tanda isian benar-benar masuk ke state.
    const jumlah = page.getByLabel("Jumlah (Rp) *");
    await expect(async () => {
      await jumlah.fill("123000");
      await expect(jumlah).toHaveValue("123.000", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await selectByLabelRegex(page.getByLabel("Kategori Dana *"), /Dana Perayaan/);
    await selectByLabelRegex(page.getByLabel("Nama Penerimaan *"), /Dana Kathina/);
    await page.getByLabel("Catatan").fill(catatan);
    await page.getByRole("button", { name: "Simpan Penerimaan" }).click();

    await expect(page.getByText("Penerimaan berhasil disimpan")).toBeVisible({ timeout: 10_000 });

    // Baris baru di card "Penerimaan Hari Ini".
    const row = page.locator("tr", { hasText: "Dana Kathina" }).filter({ hasText: "123.000" });
    await expect(row.first()).toBeVisible({ timeout: 10_000 });
  });
});
