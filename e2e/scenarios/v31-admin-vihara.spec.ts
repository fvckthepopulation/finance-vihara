/**
 * v31 — Admin Vihara.
 * Yang diuji: 3 vihara terdaftar; Kelola pada baris VVG menampilkan seksi
 * "Rekening Bank" (BCA + Mandiri) dan "PIC Kas Kecil" (Lili, Epi);
 * tambah PIC baru → muncul; Nonaktif → tertandai; Hapus → hilang.
 */
import { test, expect, Page, Locator } from "@playwright/test";
import { login, pickViharaVVG } from "../fixtures/auth";
import { uniq } from "../fixtures/uniq";

async function openKelolaVVG(page: Page): Promise<void> {
  await page.goto("/admin/vihara");
  const row = page.locator("tr", { hasText: "Vipassan" }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "Kelola" }).click();
}

function picSection(page: Page): Locator {
  return page.locator("div").filter({ has: page.getByText("PIC Kas Kecil", { exact: true }) }).last();
}

test.describe("v31 admin vihara", () => {
  test("3 vihara terdaftar; Kelola VVG → rekening + PIC", async ({ page }) => {
    await login(page, "admin");
    await openKelolaVVG(page);

    // 3 vihara di tabel utama.
    const viharaRows = page.locator("tbody tr").filter({ has: page.getByRole("button", { name: /Kelola|Tutup/ }) });
    await expect(viharaRows).toHaveCount(3);

    // Seksi Rekening Bank: BCA + Mandiri.
    await expect(page.locator("p", { hasText: /^Rekening Bank$/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("6280-3488-88").first()).toBeVisible();
    await expect(page.getByText(/Mandiri/).first()).toBeVisible();

    // Seksi PIC Kas Kecil: Lili + Epi.
    const section = picSection(page);
    await expect(section.getByText("Lili", { exact: true })).toBeVisible();
    await expect(section.getByText("Epi", { exact: true })).toBeVisible();
  });

  test("tambah PIC → muncul; Nonaktif → hilang dari daftar; Hapus → hilang", async ({ page }) => {
    await login(page, "admin");
    await openKelolaVVG(page);

    const section = picSection(page);
    const picA = uniq("PIC-E2E-A");
    const picB = uniq("PIC-E2E-B");

    // Tambah PIC A.
    await section.getByPlaceholder("Nama PIC").fill(picA);
    await section.getByRole("button", { name: "Tambah" }).click();
    await expect(page.getByText("PIC ditambahkan")).toBeVisible({ timeout: 10_000 });
    const itemA = section.locator("li", { hasText: picA });
    await expect(itemA).toBeVisible();

    // Nonaktifkan A → endpoint master hanya mengembalikan PIC aktif,
    // sehingga baris hilang dari daftar setelah reload.
    await itemA.getByRole("button", { name: "Nonaktif" }).click();
    await expect(page.getByText("PIC dinonaktifkan")).toBeVisible({ timeout: 10_000 });
    await expect(section.locator("li", { hasText: picA })).toHaveCount(0, { timeout: 10_000 });

    // Tambah PIC B lalu Hapus (belum dipakai transaksi) → hilang permanen.
    await section.getByPlaceholder("Nama PIC").fill(picB);
    await section.getByRole("button", { name: "Tambah" }).click();
    const itemB = section.locator("li", { hasText: picB });
    await expect(itemB).toBeVisible({ timeout: 10_000 });
    await itemB.getByRole("button", { name: "Hapus" }).click();
    await expect(page.getByText("PIC dihapus")).toBeVisible({ timeout: 10_000 });

    // Refresh penuh → keduanya tidak terdaftar.
    await openKelolaVVG(page);
    const fresh = picSection(page);
    await expect(fresh.getByText("Lili", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(fresh.locator("li", { hasText: picA })).toHaveCount(0);
    await expect(fresh.locator("li", { hasText: picB })).toHaveCount(0);
  });
});
