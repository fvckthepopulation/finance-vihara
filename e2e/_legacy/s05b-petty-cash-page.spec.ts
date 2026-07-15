/**
 * S-05b: Petty Cash — halaman gabungan (panel mockup):
 * metric cards, form deklarasi inline multi-item, modal Isi Kembali,
 * dan riwayat mutasi dengan saldo berjalan.
 *
 * Catatan: admin punya petty_cash.create + approve → submit langsung posted.
 * User `input` hanya create → submit jadi draft menunggu approval.
 */
import { test, expect, Page } from "@playwright/test";
import { login } from "../fixtures/auth";
import { today, uniq } from "../fixtures/uniq";
import { selectByLabelRegex, waitForOptions } from "../fixtures/select";

async function fillDeklarasiItem(
  page: Page,
  opts: { amount: string; description: string; kategori?: string },
): Promise<void> {
  await page.getByLabel("Tanggal pengeluaran").first().fill(today());

  const unitUsaha = page.getByLabel("Unit Usaha").first();
  await waitForOptions(unitUsaha);
  await unitUsaha.selectOption({ index: 1 });

  await page.getByLabel("Kategori").first().selectOption({ label: opts.kategori ?? "Beli ATK" });
  await page.getByLabel("Jumlah (Rp)").first().fill(opts.amount);
  await page.getByLabel("Keterangan pengeluaran").first().fill(opts.description);
}

test.describe("S-05b: Petty Cash page (panel mockup)", () => {
  test("metric cards & seksi utama tampil", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/petty-cash");

    await expect(page.getByText("Saldo kas kecil saat ini")).toBeVisible();
    await expect(page.getByText("Perlu diisi kembali")).toBeVisible();
    await expect(page.getByText("Deklarasi bulan ini")).toBeVisible();
    await expect(page.getByText("Pengisian terakhir")).toBeVisible();

    await expect(page.getByText("Form deklarasi pengeluaran petty cash")).toBeVisible();
    await expect(page.getByText("Riwayat mutasi kas kecil")).toBeVisible();
    await expect(page.getByRole("button", { name: /Isi Kembali/ })).toBeVisible();
  });

  test("admin submit deklarasi → langsung posted & muncul di riwayat", async ({ page }) => {
    const description = `ATK e2e ${uniq("PCE")}`;

    await login(page, "admin");
    await page.goto("/petty-cash");

    await fillDeklarasiItem(page, { amount: "50000", description });

    // Total deklarasi terhitung
    await expect(page.getByText(/Total deklarasi:/)).toBeVisible();
    await expect(page.getByText(/50\.000/).first()).toBeVisible();

    await page.getByRole("button", { name: /Submit deklarasi/ }).click();
    // Admin punya petty_cash.approve → langsung diposting
    await expect(page.getByText(/deklarasi diposting/i)).toBeVisible({ timeout: 10_000 });

    // Riwayat memuat baris baru (refresh otomatis via reload versi list)
    const row = page.locator("tr", { hasText: description });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText("Deklarasi")).toBeVisible();
    await expect(row.locator("span.inline-flex").filter({ hasText: /^Posted$/ })).toBeVisible();
    // Saldo berjalan terisi untuk movement posted
    await expect(row.getByText(/Rp/).nth(0)).toBeVisible();
  });

  test("multi-item: tambah & hapus item pengeluaran", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/petty-cash");

    await expect(page.getByLabel("Jumlah (Rp)")).toHaveCount(1);

    await page.getByRole("button", { name: /Tambah item pengeluaran/ }).click();
    await expect(page.getByLabel("Jumlah (Rp)")).toHaveCount(2);

    // Total = jumlah semua item
    await page.getByLabel("Jumlah (Rp)").nth(0).fill("10000");
    await page.getByLabel("Jumlah (Rp)").nth(1).fill("15000");
    await expect(page.getByText(/25\.000/).first()).toBeVisible();

    // Hapus item kedua
    await page.getByRole("button", { name: "Hapus item" }).nth(1).click();
    await expect(page.getByLabel("Jumlah (Rp)")).toHaveCount(1);
  });

  test("admin isi kembali via modal → posted & badge Pengisian di riwayat", async ({ page }) => {
    const description = `Refill e2e ${uniq("PCF")}`;

    await login(page, "admin");
    await page.goto("/petty-cash");

    await page.getByRole("button", { name: /Isi Kembali/ }).click();
    const modal = page.locator("div.fixed.inset-0");
    await expect(modal.getByText("Pengisian kembali petty cash", { exact: true })).toBeVisible();

    const entitas = modal.getByLabel("Entitas");
    await waitForOptions(entitas);
    await entitas.selectOption({ index: 1 });

    await selectByLabelRegex(modal.getByLabel(/Sumber dana/), /10[14]-/);
    await modal.getByLabel("Tanggal").fill(today());
    await modal.getByLabel("Jumlah (Rp)").fill("250000");
    await modal.getByLabel("Keterangan").fill(description);

    await modal.getByRole("button", { name: /Proses pengisian/ }).click();
    await expect(page.getByText(/Pengisian .* diposting/i)).toBeVisible({ timeout: 10_000 });

    const row = page.locator("tr", { hasText: description });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText("Pengisian")).toBeVisible();
    await expect(row.locator("span.inline-flex").filter({ hasText: /^Posted$/ })).toBeVisible();
  });

  test("input (tanpa approve) submit deklarasi → draft menunggu approval, Edit → detail", async ({ page }) => {
    const description = `Transport e2e ${uniq("PCD")}`;

    await login(page, "input");
    await page.goto("/petty-cash");

    await fillDeklarasiItem(page, {
      amount: "20000",
      description,
      kategori: "Transport / Perjalanan",
    });

    await page.getByRole("button", { name: /Submit deklarasi/ }).click();
    await expect(page.getByText(/menunggu approval/i)).toBeVisible({ timeout: 10_000 });

    const row = page.locator("tr", { hasText: description });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator("span.inline-flex").filter({ hasText: /^Draft$/ })).toBeVisible();

    // Draft punya tombol Edit → menuju halaman detail
    await row.getByRole("link", { name: /Edit/ }).click();
    await page.waitForURL(/\/petty-cash\/\d+$/);
    await expect(
      page.locator("span.inline-flex").filter({ hasText: /^Draft$/ }).first(),
    ).toBeVisible();
  });

  test("filter riwayat per bulan & status bekerja", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/petty-cash");

    const riwayat = page.locator("text=Riwayat mutasi kas kecil").locator("../..");
    const selects = riwayat.locator("select");

    // Filter status Posted → tidak ada badge Draft di tabel
    await selects.nth(1).selectOption("posted");
    await expect(page.getByText(/\d+ mutasi/)).toBeVisible();
    await expect(
      page.locator("tbody span.inline-flex").filter({ hasText: /^Draft$/ }),
    ).toHaveCount(0, { timeout: 10_000 });
  });
});
