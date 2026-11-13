/**
 * v20 — Kas & Bank (/cash).
 * Yang diuji (vihara VVG): kartu rekening BCA + Mandiri dengan norek dan
 * "Saldo per buku", kartu Kas Kecil menampilkan PIC Lili & Epi, tombol
 * "Kelola Kas Kecil" menuju /petty-cash, filter mutasi per rekening BCA.
 */
import { test, expect } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";

test.describe("v20 kas & bank", () => {
  test("kartu rekening + kas kecil render untuk VVG", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/cash");

    await expect(page.getByText("6280-3488-88").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("1570-0122-5555-4").first()).toBeVisible();
    // Rekening milik yayasan (FV-36): pemegang akses tingkat yayasan melihat
    // saldo utuh rekening — yang dicocokkan dengan rekening koran.
    await expect(page.getByText("Saldo rekening (per buku)").first()).toBeVisible();
    await expect(page.getByText("AKTIF").first()).toBeVisible();

    // Kas Kecil card: PIC Lili & Epi.
    await expect(page.getByText("Lili").first()).toBeVisible();
    await expect(page.getByText("Epi").first()).toBeVisible();
  });

  test("Kelola Kas Kecil → /petty-cash", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/cash");

    await page.getByRole("button", { name: "Kelola Kas Kecil" }).click();
    await page.waitForURL("**/petty-cash");
    await expect(page.locator("header")).toContainText("Kas Kecil");
  });

  test("filter mutasi ke BCA → semua baris rekening BCA", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/cash");

    const filter = page.getByLabel("Filter rekening");
    await expect(filter).toBeVisible({ timeout: 15_000 });
    await selectByLabelRegex(filter, /BCA/);
    await page.waitForTimeout(800);

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await rows.nth(i).innerText();
      if (/Tidak ada|Belum ada/i.test(text)) continue;
      expect(text).toContain("BCA");
    }
  });
});
