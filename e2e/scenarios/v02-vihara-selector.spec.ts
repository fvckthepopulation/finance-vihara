/**
 * v02 — Vihara selector (topbar).
 * Yang diuji: admin melihat select "Pilih vihara" berisi "Semua Vihara" + 3 vihara,
 * pilihan VVG persist saat pindah halaman; bendahara tidak melihat select
 * (chip statis) dan form penerimaan tidak terblokir hint pilih vihara.
 */
import { test, expect } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";

test.describe("v02 vihara selector", () => {
  test("admin: opsi lengkap + pilihan persist antar halaman", async ({ page }) => {
    await login(page, "admin");
    const select = page.getByLabel("Pilih vihara");
    await expect(select).toBeVisible();

    // Opsi vihara dimuat async — tunggu sampai lengkap (Semua Vihara + 3 vihara).
    await expect(select.locator("option")).toHaveCount(4, { timeout: 10_000 });
    const labels = await select.locator("option").allTextContents();
    expect(labels[0]).toContain("Semua Vihara");
    expect(labels.some((l) => l.includes("Vipassan"))).toBeTruthy();

    await pickViharaVVG(page);
    const chosen = await select.inputValue();
    expect(chosen).not.toBe("");

    await page.goto("/riwayat");
    await expect(page.locator("header")).toContainText("Semua Transaksi");
    await expect(page.getByLabel("Pilih vihara")).toHaveValue(chosen);
  });

  test("bendahara: tanpa select, form penerimaan tidak terblokir", async ({ page }) => {
    await login(page, "bendahara");
    await expect(page.getByLabel("Pilih vihara")).toHaveCount(0);

    await page.goto("/penerimaan");
    await expect(page.locator("header")).toContainText("Input Penerimaan");
    await expect(page.getByText("Pilih vihara dulu di header")).toHaveCount(0);
  });
});
