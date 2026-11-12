/**
 * v30 — RBAC gating.
 * Yang diuji: viewer tidak melihat menu admin "Users"/"Roles" di sidebar;
 * bendahara melihat menu "Input Penerimaan", form penerimaan aktif
 * (tanpa blokir pilih vihara) dan chip vihara statis tampil di topbar.
 */
import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

test.describe("v30 rbac", () => {
  test("viewer: sidebar tanpa Users/Roles", async ({ page }) => {
    await login(page, "viewer");
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();
    await expect(nav.getByText("Users", { exact: true })).toHaveCount(0);
    await expect(nav.getByText("Roles", { exact: true })).toHaveCount(0);
  });

  test("bendahara: menu Input Penerimaan + form aktif + chip vihara", async ({ page }) => {
    await login(page, "bendahara");

    const nav = page.locator("nav").first();
    await expect(nav.getByText("Input Penerimaan", { exact: true })).toBeVisible();

    // Chip vihara statis di topbar (bukan select).
    await expect(page.getByLabel("Pilih vihara")).toHaveCount(0);
    const chip = page.locator("header span").filter({ hasText: /Vipassan|Vihara #/ });
    await expect(chip.first()).toBeVisible({ timeout: 10_000 });

    // Form penerimaan terbuka dengan field aktif.
    await page.goto("/penerimaan");
    await expect(page.getByText("Pilih vihara dulu di header")).toHaveCount(0);
    await expect(page.getByLabel("Jumlah (Rp) *")).toBeEnabled();
    await expect(page.getByLabel("Kategori Dana *")).toBeEnabled();
    // Vihara terisi sendiri karena bendahara hanya memegang satu.
    await expect(page.getByTestId("form-vihara")).not.toHaveValue("");
    // Simpan sengaja masih tertahan sampai Jumlah diisi (penahan FV-9);
    // yang diuji di sini: tidak ada lagi blokir "pilih vihara dulu".
    await expect(page.getByText("Pilih yayasan dan vihara dulu")).toHaveCount(0);
    await page.getByLabel("Jumlah (Rp) *").fill("10000");
    await expect(page.getByRole("button", { name: "Simpan Penerimaan" })).toBeEnabled();
  });
});
