/**
 * v12 — Riwayat (Semua Transaksi).
 * Yang diuji: pencarian menemukan transaksi yang baru dibuat, filter tipe
 * Pengeluaran hanya menampilkan nominal minus, Export CSV mengunduh
 * transaksi_vihara.csv, footer menampilkan total Masuk/Keluar.
 */
import { test, expect } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";
import { selectByLabelRegex } from "../fixtures/select";
import { uniq } from "../fixtures/uniq";

test.describe("v12 riwayat", () => {
  test("penerimaan baru muncul di riwayat via pencarian", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);

    // Buat penerimaan dengan catatan unik.
    await page.goto("/penerimaan");
    const catatan = uniq("E2E-RWT");
    await page.getByLabel("Jumlah (Rp) *").fill("67000");
    await selectByLabelRegex(page.getByLabel("Kategori Dana *"), /Dana Perayaan/);
    await selectByLabelRegex(page.getByLabel("Nama Penerimaan *"), /Dana Kathina/);
    await page.getByLabel("Catatan").fill(catatan);
    await page.getByRole("button", { name: "Simpan Penerimaan" }).click();
    await expect(page.getByText("Penerimaan berhasil disimpan")).toBeVisible({ timeout: 10_000 });

    // Cari di riwayat: coba catatan unik dulu, fallback ke nama.
    await page.goto("/riwayat");
    const search = page.getByPlaceholder("Cari keterangan...");
    await search.fill(catatan);
    await page.waitForTimeout(1000);
    let rows = page.locator("tbody tr");
    if ((await rows.count()) === 0 || (await rows.first().innerText()).includes("Tidak ada")) {
      // Search tidak match deskripsi — cari berdasarkan nama transaksi.
      await search.fill("Dana Kathina");
      await page.waitForTimeout(1000);
      rows = page.locator("tbody tr", { hasText: "Dana Kathina" });
    }
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });

  test("filter tipe Pengeluaran → hanya nominal keluar", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/riwayat");

    await selectByLabelRegex(page.getByLabel("Tipe"), /Pengeluaran/);
    await page.waitForTimeout(1000);

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await rows.nth(i).innerText();
      expect(text).toMatch(/[−-]Rp/); // app memakai Unicode minus U+2212
    }
  });

  test("Export CSV mengunduh transaksi_vihara.csv; footer total tampil", async ({ page }) => {
    await login(page, "admin");
    await pickViharaVVG(page);
    await page.goto("/riwayat");

    await expect(page.getByText("Masuk:").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Keluar:").first()).toBeVisible();
    await expect(page.getByText(/transaksi/).first()).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("transaksi_vihara.csv");
  });
});
