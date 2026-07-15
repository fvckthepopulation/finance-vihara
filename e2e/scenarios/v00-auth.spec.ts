/**
 * v00 — Autentikasi.
 * Yang diuji: login sukses, login gagal (password salah), logout,
 * dan redirect ke /login saat akses halaman terproteksi tanpa sesi.
 */
import { test, expect } from "@playwright/test";
import { USERS, login, logout } from "../fixtures/auth";

test.describe("v00 auth", () => {
  test("login sukses sebagai admin → dashboard", async ({ page }) => {
    await login(page, "admin");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("header")).toContainText("Dashboard");
  });

  test("password salah → pesan error, tetap di /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.admin.email);
    await page.getByLabel("Password").fill("salah-total");
    await page.getByRole("button", { name: "Masuk" }).click();
    // Error ditampilkan dalam <p> bergaya merah di dalam form.
    await expect(page.locator('form p[class*="km-red"]')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout → kembali ke /login", async ({ page }) => {
    await login(page, "admin");
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("akses /dashboard tanpa login → redirect /login", async ({ page }) => {
    await page.goto("/login"); // origin dulu agar bisa akses localStorage
    await page.evaluate(() => localStorage.clear());
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
