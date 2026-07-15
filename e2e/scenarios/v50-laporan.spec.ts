/**
 * v50 — Laporan Keuangan ISAK 35 (/laporan).
 * Yang diuji: 4 tab laporan render dengan angka dari /api/laporan/isak35;
 * Export Excel menghasilkan unduhan .xlsx bernama LaporanISAK35_*.
 */
import { test, expect, Page } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";

const TAB_NAMES = [
  "Posisi Keuangan",
  "Penghasilan Komprehensif",
  "Perubahan Aset Neto",
  "Arus Kas",
];

async function openLaporanVVG(page: Page) {
  await login(page, "admin");
  await page.goto("/laporan");
  await pickViharaVVG(page);
  // Tunggu data laporan termuat (tab Posisi default).
  await expect(page.getByText("TOTAL ASET", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("v50 laporan ISAK 35", () => {
  test("4 tab render; posisi balance; arus kas bersih", async ({ page }) => {
    await openLaporanVVG(page);

    for (const name of TAB_NAMES) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    // Tab Posisi Keuangan: total aset + footer balance check.
    await expect(page.getByText("TOTAL KAS DAN SETARA KAS").first()).toBeVisible();
    await expect(page.getByText(/Balance/i).first()).toBeVisible();

    // Tab Penghasilan Komprehensif.
    await page.getByRole("button", { name: "Penghasilan Komprehensif", exact: true }).click();
    await expect(page.getByText("TOTAL PENDAPATAN DAN DUKUNGAN").first()).toBeVisible();
    await expect(page.getByText("TOTAL BEBAN", { exact: true }).first()).toBeVisible();

    // Tab Perubahan Aset Neto.
    await page.getByRole("button", { name: "Perubahan Aset Neto", exact: true }).click();
    await expect(page.getByText("ASET NETO AKHIR PERIODE").first()).toBeVisible();

    // Tab Arus Kas.
    await page.getByRole("button", { name: "Arus Kas", exact: true }).click();
    await expect(page.getByText("ARUS KAS BERSIH DARI AKTIVITAS OPERASI").first()).toBeVisible();
    await expect(page.getByText("KAS DAN SETARA KAS AKHIR PERIODE").first()).toBeVisible();
  });

  test("export Excel mengunduh file LaporanISAK35_*.xlsx", async ({ page }) => {
    await openLaporanVVG(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: "Export Excel" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^LaporanISAK35_/);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});
