/**
 * v11 — Input Pengeluaran.
 * Yang diuji: cascade kategori biaya → nama pengeluaran, submit pengeluaran
 * via Transfer Bank (rekening BCA) → toast sukses + baris di
 * "Pengeluaran Hari Ini" dengan tag Debet Dana "Dana Operasional".
 */
import { test, expect } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

test.describe("v11 pengeluaran", () => {
  test("cascade kategori biaya → nama pengeluaran", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/pembayaran");

    const nama = page.getByLabel("Nama Pengeluaran *");
    await expect(nama).toBeDisabled();
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await expect(nama).toBeEnabled();
    await nama.locator("option", { hasText: "Biaya ATK" }).first().waitFor({ state: "attached" });
  });

  test("submit pengeluaran → toast + baris Hari Ini dengan tag dana", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/pembayaran");

    const bukti = uniq("E2E-PAY");
    await page.getByLabel("Jumlah (Rp) *").fill("45000");
    await selectByLabelRegex(page.getByLabel("Kategori Biaya *"), /Biaya Operasional/);
    await selectByLabelRegex(page.getByLabel("Nama Pengeluaran *"), /Biaya ATK/);
    await selectByLabelRegex(page.getByLabel("Transfer dari Rekening"), /BCA/);
    await page.getByLabel("No. Bukti / Referensi").fill(bukti);
    await page.getByRole("button", { name: "Simpan Pengeluaran" }).click();

    await expect(page.getByText("Pengeluaran berhasil disimpan")).toBeVisible({ timeout: 10_000 });

    const row = page
      .locator("tr", { hasText: "Biaya ATK" })
      .filter({ hasText: "45.000" })
      .filter({ hasText: "Dana Operasional" });
    await expect(row.first()).toBeVisible({ timeout: 10_000 });
  });
});
