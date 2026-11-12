/**
 * v02 — Vihara selector (topbar).
 * Yang diuji: admin melihat select "Pilih vihara" berisi "Semua Vihara" + 3 vihara,
 * pilihan VVG persist saat pindah halaman; bendahara tidak melihat select
 * (chip statis) dan form penerimaan tidak terblokir hint pilih vihara.
 */
import { test, expect } from "@playwright/test";
import { apiCall, apiToken, login, pickViharaVVG, viharaIdsByCode } from "../fixtures/auth";

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

  test("badge menampilkan NAMA vihara, bukan id, dan nama penuh saat di-hover", async ({
    page,
  }) => {
    await login(page, "bendahara");
    await page.goto("/pembayaran");

    const chip = page.getByTestId("vihara-fixed");
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await expect(chip).toContainText("Vipassan");

    // Penanda darurat berisi id ("Vihara #1") tidak boleh muncul di mana pun:
    // itulah yang dilihat pengguna ketika daftar vihara gagal dimuat.
    await expect(page.locator("body")).not.toContainText(/Vihara #\d/);

    // Nama panjang dipotong di layar, tapi utuh di atribut title (hover).
    const judul = await chip.getAttribute("title");
    expect(judul).toBeTruthy();
    expect(judul).toContain("Vipassan");
    await expect(chip).toHaveClass(/truncate/);
  });

  test("badge tetap bernama walau role tidak punya izin master", async ({ page }) => {
    // Inti FV-13: nama diambil dari /api/viharas yang dijaga `masters.view`.
    // Role operasional tanpa izin itu membuat badge jatuh ke "Vihara #1".
    const stamp = Date.now().toString().slice(-6);
    const namaRole = `e2e_badge_${stamp}`;
    const email = `${namaRole}@uji.test`;
    const token = await apiToken("admin");
    const viharaVvg = (await viharaIdsByCode()).VVG;
    const vvg = await apiCall<{ entity_id: number }>(token, `/api/viharas/${viharaVvg}`);

    const role = await apiCall<{ id: number }>(token, "/api/admin/roles", {
      method: "POST",
      body: JSON.stringify({ name: namaRole, permissions: ["pembayaran.view"] }),
    });
    const user = await apiCall<{ id: number }>(token, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Badge Uji",
        email,
        password: "password123",
        role: namaRole,
        entity_id: vvg.body.entity_id,
        scope_type: "vihara",
        vihara_ids: [viharaVvg],
      }),
    });

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("password123");
      await page.getByRole("button", { name: "Masuk" }).click();
      await page.waitForURL("**/dashboard");

      const chip = page.getByTestId("vihara-fixed");
      await expect(chip).toBeVisible({ timeout: 10_000 });
      await expect(chip).toContainText("Vipassan");
      await expect(page.locator("body")).not.toContainText(/Vihara #\d/);
    } finally {
      await apiCall(token, `/api/admin/users/${user.body.id}`, { method: "DELETE" });
      await apiCall(token, `/api/admin/roles/${role.body.id}`, { method: "DELETE" });
    }
  });
});
