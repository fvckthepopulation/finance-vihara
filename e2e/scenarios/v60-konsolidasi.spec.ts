/**
 * v60 — Konsolidasi Yayasan (/konsolidasi).
 * Yang diuji: 6 tab render dari /api/laporan/konsolidasi; Ringkasan menampilkan
 * chip semua vihara + baris "Total Yayasan"; tab Perbandingan menampilkan
 * "TOTAL YAYASAN"; Export Excel mengunduh KonsolidasiYayasan_*.xlsx; sidebar
 * user vihara tetap (bendahara) tidak memuat menu Konsolidasi Yayasan.
 */
import { test, expect, Page } from "@playwright/test";
import { login } from "../fixtures/auth";

const TAB_NAMES = [
  "Ringkasan",
  "Posisi Keuangan",
  "Penghasilan Komprehensif",
  "Perubahan Aset Neto",
  "Arus Kas",
  "Perbandingan Vihara",
];

async function openKonsolidasi(page: Page) {
  await login(page, "admin");
  await page.goto("/konsolidasi");
  // Tunggu data konsolidasi termuat (baris total tab Ringkasan default).
  await expect(page.getByText("Total Yayasan", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("v60 konsolidasi yayasan", () => {
  test("6 tab render; ringkasan per vihara; perbandingan total yayasan", async ({ page }) => {
    await openKonsolidasi(page);

    for (const name of TAB_NAMES) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    // Chips vihara — minimal 3 vihara tergabung, nama VVG tampil.
    const chips = page.getByTestId("konsol-chip");
    expect(await chips.count()).toBeGreaterThanOrEqual(3);
    await expect(chips.filter({ hasText: "Vipassan" }).first()).toBeVisible();

    // Ringkasan: porsi pendapatan + posisi aset.
    await expect(page.getByText("Porsi Pendapatan per Vihara").first()).toBeVisible();
    await expect(page.getByText("TOTAL ASET YAYASAN").first()).toBeVisible();

    // Tab Posisi Keuangan.
    await page.getByRole("button", { name: "Posisi Keuangan", exact: true }).click();
    await expect(page.getByText("LAPORAN POSISI KEUANGAN KONSOLIDASI").first()).toBeVisible();
    await expect(page.getByText("Subtotal Kas dan Setara Kas").first()).toBeVisible();

    // Tab Penghasilan Komprehensif.
    await page.getByRole("button", { name: "Penghasilan Komprehensif", exact: true }).click();
    await expect(page.getByText("PENDAPATAN DAN DUKUNGAN — PER VIHARA").first()).toBeVisible();

    // Tab Perubahan Aset Neto.
    await page.getByRole("button", { name: "Perubahan Aset Neto", exact: true }).click();
    await expect(page.getByText("ASET NETO AKHIR PERIODE").first()).toBeVisible();

    // Tab Arus Kas.
    await page.getByRole("button", { name: "Arus Kas", exact: true }).click();
    await expect(page.getByText("ARUS KAS BERSIH DARI AKTIVITAS OPERASI").first()).toBeVisible();

    // Tab Perbandingan Vihara.
    await page.getByRole("button", { name: "Perbandingan Vihara", exact: true }).click();
    await expect(page.getByText("TOTAL YAYASAN", { exact: true }).first()).toBeVisible();
  });

  test("export Excel mengunduh file KonsolidasiYayasan_*.xlsx", async ({ page }) => {
    await openKonsolidasi(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: "Export Excel" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^KonsolidasiYayasan_/);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("bendahara (vihara tetap): sidebar tanpa menu Konsolidasi Yayasan", async ({ page }) => {
    await login(page, "bendahara");
    // Pastikan sidebar sudah render (Dashboard selalu tampil).
    await expect(
      page.locator("aside").getByRole("link", { name: "Dashboard" }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("aside").getByRole("link", { name: "Konsolidasi Yayasan" }),
    ).toHaveCount(0);
  });
});
