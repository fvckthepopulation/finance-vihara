/**
 * v43 — Daftar pengeluaran, font angka, pagination, pencarian, permission
 *       Semua Transaksi (FV-22, FV-23, FV-26, FV-27, FV-28).
 *
 * Lima laporan yang bermuara pada satu hal: daftar data harus bisa ditelusuri.
 * Pengeluaran kemarin harus bisa dibuka lagi, nominal harus terbaca, daftar
 * yang panjang harus dipotong per halaman di server, tiap daftar harus punya
 * pencarian, dan menu Semua Transaksi harus bisa diberikan per role dengan
 * datanya tetap dibatasi jangkauan vihara.
 */
import { test, expect, Page } from "@playwright/test";
import { apiCall, apiToken, login } from "../fixtures/auth";

test.describe.configure({ mode: "serial" });

/** Halaman-halaman yang WAJIB punya pagination (FV-26) + pencarian (FV-27). */
const DAFTAR: Array<{ url: string; cari?: string }> = [
  { url: "/pengeluaran", cari: "filter-cari" },
  { url: "/riwayat", cari: "cari-transaksi" },
  { url: "/jurnal", cari: "cari-jurnal" },
  { url: "/persetujuan", cari: "filter-cari" },
  { url: "/petty-cash", cari: "cari-kaskecil" },
  { url: "/admin/users", cari: "cari-user" },
  { url: "/admin/roles", cari: "cari-role" },
  { url: "/admin/vihara" },
];

const INFO = /^(Menampilkan \d+–\d+ dari \d+ data|Tidak ada data)$/;

async function infoPagination(page: Page): Promise<string> {
  const info = page.getByTestId("pagination-info").first();
  await expect(info).toBeVisible({ timeout: 15_000 });
  return (await info.textContent())?.trim() ?? "";
}

test.describe("v43 daftar, pencarian & pagination", () => {
  test("FV-22: daftar pengeluaran lengkap bisa dibuka dari Input Pengeluaran", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/pembayaran");

    const link = page.getByTestId("link-semua-pengeluaran");
    await expect(link).toHaveText(/Lihat semua pengeluaran/);
    await link.click();
    await page.waitForURL("**/pengeluaran");

    // Saringan yang diminta: rentang tanggal, vihara, kategori, status, cari.
    for (const id of [
      "filter-dari",
      "filter-sampai",
      "filter-vihara",
      "filter-kategori",
      "filter-status",
      "filter-cari",
      "reset-filter",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    // Bawaan rentang tanggal = bulan berjalan.
    const dari = await page.getByTestId("filter-dari").inputValue();
    expect(dari, "tanggal awal = tanggal 1 bulan berjalan").toMatch(/^\d{4}-\d{2}-01$/);

    expect(await infoPagination(page)).toMatch(INFO);

    // Tiap baris punya tombol Detail, dan detailnya benar-benar terbuka.
    const detail = page.locator('[data-testid^="detail-pengeluaran-"]').first();
    await expect(detail).toBeVisible({ timeout: 15_000 });
    await detail.click();
    await expect(page.getByTestId("detail-pengeluaran")).toBeVisible({ timeout: 10_000 });
  });

  test("FV-22: saringan tanpa hasil berkata 'Tidak ada pengeluaran', bukan error", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/pengeluaran");
    await page.getByTestId("filter-cari").fill("zzz-pasti-tidak-ada");
    await expect(page.getByText("Tidak ada pengeluaran")).toBeVisible({ timeout: 15_000 });
    expect(await infoPagination(page)).toBe("Tidak ada data");
  });

  test("FV-22 & FV-28: bendahara vihara hanya melihat pengeluaran viharanya", async ({ page }) => {
    await login(page, "bendahara"); // scope vihara [VVG]
    await page.goto("/pengeluaran");

    // Tunggu baris data sebenarnya — baris "Memuat…" juga sebuah <tr>.
    await expect(page.locator('[data-testid^="detail-pengeluaran-"]').first()).toBeVisible({
      timeout: 20_000,
    });
    const baris = page.locator("tbody tr");

    // Kolom Vihara (kolom ke-2) tidak boleh menyebut vihara lain.
    const viharaKolom = await baris.locator("td:nth-child(2)").allTextContents();
    expect(viharaKolom.length).toBeGreaterThan(0);
    for (const v of viharaKolom) {
      expect(v, "bendahara VVG tidak boleh melihat vihara lain").toMatch(/Vipassan|—/);
    }

    // Pilihan vihara di saringan pun hanya berisi vihara dalam jangkauannya.
    const opsi = await page.getByTestId("filter-vihara").locator("option").allTextContents();
    expect(opsi.filter((o) => !/Semua vihara/.test(o)).every((o) => /Vipassan/.test(o))).toBe(true);
  });

  test("FV-23: nominal memakai font utama + tabular-nums, bukan monospace", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/pengeluaran");

    await expect(page.locator('[data-testid^="detail-pengeluaran-"]').first()).toBeVisible({
      timeout: 20_000,
    });
    const baris = page.locator("tbody tr").first();

    const jumlah = baris.locator("td:nth-child(6)"); // kolom Jumlah
    await expect(jumlah).toContainText("Rp");

    const gaya = await jumlah.evaluate((el) => {
      const c = getComputedStyle(el);
      return {
        family: c.fontFamily,
        numeric: c.fontVariantNumeric,
        size: parseFloat(c.fontSize),
      };
    });
    expect(gaya.family.toLowerCase()).not.toMatch(/mono|courier|menlo|consolas/);
    expect(gaya.numeric).toMatch(/tabular-nums/);

    // Ukurannya minimal sama dengan kolom teks lain di tabel yang sama.
    const ukuranNama = await baris
      .locator("td:nth-child(3)")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(gaya.size).toBeGreaterThanOrEqual(ukuranNama);

    // Format nominalnya tetap "Rp 1.234".
    await expect(jumlah).toHaveText(/^Rp [\d.]+$/);
  });

  for (const { url, cari } of DAFTAR) {
    test(`FV-26 & FV-27: ${url} punya pagination${cari ? " + pencarian" : ""}`, async ({ page }) => {
      await login(page, "admin");
      await page.goto(url);

      expect(await infoPagination(page), `pagination-info di ${url}`).toMatch(INFO);

      // Pemilih jumlah baris: 10 / 20 / 50 / 100, bawaan 20.
      const perPage = page.getByTestId("per-page").first();
      await expect(perPage).toBeVisible();
      expect(await perPage.inputValue()).toBe("20");
      expect(await perPage.locator("option").allTextContents()).toEqual(["10", "20", "50", "100"]);

      if (cari) await expect(page.getByTestId(cari)).toBeVisible();
    });
  }

  test("FV-26: ganti jumlah baris memotong daftar, bukan memuat semuanya", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/jurnal");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("per-page").first().selectOption("10");
    await expect(page.getByTestId("pagination-info")).toHaveText(/^Menampilkan 1–10 dari \d+ data$/, {
      timeout: 15_000,
    });
    expect(await page.locator("tbody tr").count()).toBe(10);

    // Halaman 2 memuat baris yang berbeda — datanya diambil per halaman.
    const halaman1 = (await page.locator("tbody tr").allTextContents()).join("|");
    await page.getByRole("button", { name: "›" }).click();
    await expect(page.getByTestId("pagination-info")).toHaveText(/^Menampilkan 11–20 dari \d+ data$/, {
      timeout: 15_000,
    });
    const halaman2 = (await page.locator("tbody tr").allTextContents()).join("|");
    expect(halaman2).not.toBe(halaman1);
  });

  test("FV-26: kata kunci berubah → kembali ke halaman 1", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/jurnal");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("per-page").first().selectOption("10");
    await page.getByRole("button", { name: "›" }).click();
    await expect(page.getByTestId("pagination-info")).toHaveText(/^Menampilkan 11–/, {
      timeout: 15_000,
    });

    await page.getByTestId("cari-jurnal").fill("pembayaran");
    await expect(page.getByTestId("pagination-info")).toHaveText(/^Menampilkan 1–/, {
      timeout: 15_000,
    });
  });

  test("FV-27: pencarian jurnal tidak membedakan huruf besar/kecil", async ({ page }) => {
    const token = await apiToken("admin");
    const kecil = await apiCall<{ total: number }>(token, "/api/journal-entries?q=pembayaran");
    const besar = await apiCall<{ total: number }>(token, "/api/journal-entries?q=PEMBAYARAN");
    expect(kecil.body.total).toBeGreaterThan(0);
    expect(besar.body.total).toBe(kecil.body.total);

    await login(page, "admin");
    await page.goto("/jurnal");
    await page.getByTestId("cari-jurnal").fill("PEMBAYARAN");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("tbody")).toContainText(/Pembayaran/);
  });

  test("FV-27: pencarian tanpa hasil berkata 'Data tidak ditemukan'", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/petty-cash");
    await expect(page.getByTestId("pagination-info")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("cari-kaskecil").fill("zzz-pasti-tidak-ada");
    await expect(page.getByText("Data tidak ditemukan")).toBeVisible({ timeout: 15_000 });
  });

  test("FV-27: pencarian kas kecil dilakukan di server", async ({ page }) => {
    const token = await apiToken("admin");
    const semua = await apiCall<{ total: number }>(token, "/api/petty-cash?per_page=10");
    const kosong = await apiCall<{ total: number }>(
      token,
      "/api/petty-cash?per_page=10&q=zzz-pasti-tidak-ada",
    );
    expect(semua.body.total).toBeGreaterThan(0);
    expect(kosong.body.total).toBe(0);
    await page.close();
  });

  test("FV-27: pencarian rekonsiliasi ada di kedua rinciannya", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/rekonsiliasi");
    await expect(page.getByTestId("cari-pg-pending")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("cari-pg-settlement")).toBeVisible();
    // Dua tabel rincian, dua navigasi halaman.
    expect(await page.getByTestId("pagination-info").count()).toBe(2);
  });

  test("FV-28: transaksi.view ada di permission matrix", async () => {
    const token = await apiToken("admin");
    const { body } = await apiCall<{ catalog: string[]; hidden?: string[] }>(
      token,
      "/api/admin/permissions",
    );
    expect(body.catalog).toContain("transaksi.view");
    expect(body.hidden ?? []).not.toContain("transaksi.view");
  });

  test("FV-28: menu Semua Transaksi diatur transaksi.view, bukan izin lain", async ({ page }) => {
    await login(page, "bendahara");
    await expect(page.getByRole("link", { name: "Semua Transaksi" })).toBeVisible({
      timeout: 10_000,
    });

    const token = await apiToken("bendahara");
    const daftar = await apiCall<{ data: Array<{ vihara_name: string | null }> }>(
      token,
      "/api/transactions?per_page=50",
    );
    expect(daftar.status).toBe(200);
    expect(daftar.body.data.length).toBeGreaterThan(0);
    for (const t of daftar.body.data) {
      expect(t.vihara_name ?? "Vipassan").toMatch(/Vipassan/);
    }
  });

  test("FV-28: antrean persetujuan tidak ikut terkunci transaksi.view", async () => {
    // Mengunci /transactions dengan transaksi.view pernah mematikan layar
    // Persetujuan untuk role yang HANYA menyetujui. /approvals menerima
    // transaksi.view ATAU izin approve.
    const approver = await apiToken("approver");
    expect((await apiCall(approver, "/api/approvals?status=submitted")).status).toBe(200);
  });

  test("FV-28: Export CSV terpisah di reports.export", async () => {
    const bendahara = await apiToken("bendahara");
    const admin = await apiToken("admin");
    expect((await apiCall(bendahara, "/api/transactions/export")).status).toBe(403);
    expect((await apiCall(admin, "/api/transactions/export")).status).toBe(200);
  });

  test("FV-28: tanpa transaksi.view, API menolak", async () => {
    const admin = await apiToken("admin");
    // Role sementara tanpa transaksi.view — diuji lewat user viewer yang
    // permission-nya dicabut, lalu dipasang kembali.
    const roles = await apiCall<Array<{ id: number; name: string; permissions: string[] }>>(
      admin,
      "/api/admin/roles",
    );
    const viewer = roles.body.find((r) => r.name === "viewer");
    expect(viewer, "role viewer harus ada").toBeTruthy();
    const semula = viewer!.permissions;

    await apiCall(admin, `/api/admin/roles/${viewer!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: semula.filter((p) => p !== "transaksi.view") }),
    });
    try {
      const token = await apiToken("viewer");
      expect((await apiCall(token, "/api/transactions")).status).toBe(403);
      // viewer juga tidak menyetujui apa pun, jadi antreannya pun tertutup.
      expect((await apiCall(token, "/api/approvals")).status).toBe(403);
    } finally {
      await apiCall(admin, `/api/admin/roles/${viewer!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: semula }),
      });
    }
  });
});
