/**
 * v10 — Input Penerimaan.
 * Yang diuji: cascade kategori → nama penerimaan, metode Transfer Bank
 * membuka pilihan Rekening Tujuan, blocking hint saat "Semua Vihara",
 * submit penerimaan tunai → toast sukses + baris di "Penerimaan Hari Ini".
 */
import { test, expect } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

test.describe("v10 penerimaan", () => {
  test("hint blokir muncul saat Semua Vihara terpilih", async ({ page }) => {
    await login(page, "admin");
    const select = page.getByLabel("Pilih vihara");
    await expect(select.locator("option")).toHaveCount(4, { timeout: 10_000 });
    await select.selectOption({ index: 0 }); // "Semua Vihara"
    await page.goto("/penerimaan");
    await expect(page.getByText("Pilih vihara dulu di header")).toBeVisible();
  });

  test("cascade kategori → nama; Transfer Bank membuka Rekening Tujuan", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/penerimaan");

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

    const catatan = uniq("E2E-PNR");
    await page.getByLabel("Jumlah (Rp) *").fill("123000");
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
