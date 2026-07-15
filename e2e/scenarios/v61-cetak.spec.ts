/**
 * v61 — Laporan Penerimaan Dana (/cetak).
 * Yang diuji: form periode + Preview menampilkan laporan (I. PENERIMAAN DANA,
 * SALDO BERSIH); Export mengunduh Laporan_*.xlsx (2 sheet).
 */
import { test, expect, Page } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";

async function openCetakVVG(page: Page) {
  await login(page, "admin");
  await page.goto("/cetak");
  await expect(
    page.locator("header").getByText("Laporan Penerimaan Dana").first(),
  ).toBeVisible({ timeout: 15_000 });
  await pickViharaVVG(page);
  // Periode tahun berjalan penuh.
  const year = new Date().getFullYear();
  await page.getByLabel("Dari tanggal").fill(`${year}-01-01`);
  await page.getByLabel("Sampai tanggal").fill(`${year}-12-31`);
}

test.describe("v61 cetak laporan penerimaan dana", () => {
  test("preview menampilkan penerimaan dana dan saldo bersih", async ({ page }) => {
    await openCetakVVG(page);

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("I. PENERIMAAN DANA").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("II. PENGELUARAN").first()).toBeVisible();
    await expect(page.getByText(/SALDO BERSIH/).first()).toBeVisible();

    // Tutup preview.
    await page.getByRole("button", { name: "Tutup preview" }).click();
    await expect(page.getByText("I. PENERIMAAN DANA")).toHaveCount(0);
  });

  test("export mengunduh file Laporan_*.xlsx", async ({ page }) => {
    await openCetakVVG(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^Laporan_/);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});
